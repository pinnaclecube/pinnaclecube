/**
 * evidenceGroupingWorker.ts — Pinnacle³
 *
 * Step 5 — drains the evidence_grouping_jobs queue (mirrors letterGenerationWorker).
 * One case per claim; runs the AI grouping and records counts. Never throws out of
 * the loop. Also enqueues an auto job after sync when a case has many ungrouped
 * files and none has been grouped since.
 */

import { eq, and, asc, lt, sql, desc } from "drizzle-orm";
import { db, evidenceGroupingJobsTable } from "@workspace/db";
import { runGroupingForCase, pendingGroupingFileCount } from "./evidenceGroupingService";
import { logger } from "../lib/logger";

const AUTO_UNGROUPED_THRESHOLD = 10;
// A job stuck in 'processing' past this long was killed mid-run (the serverless
// function timed out before it could write a terminal status). Such jobs are
// reclaimed and retried; a live run can never exceed the 60s function budget, so
// this threshold never steals an in-flight job.
const STALE_PROCESSING_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 3;

// SQL predicate for a claimable job: freshly queued, or a stale 'processing' job
// (killed mid-run) that still has attempts left.
function claimable(threshold: Date) {
  return sql`(${evidenceGroupingJobsTable.status} = 'queued') OR (${evidenceGroupingJobsTable.status} = 'processing' AND ${evidenceGroupingJobsTable.startedAt} < ${threshold} AND ${evidenceGroupingJobsTable.attempts} < ${MAX_ATTEMPTS})`;
}

// Give up on jobs that stayed stuck across MAX_ATTEMPTS runs — mark them failed so
// the case is no longer wedged by the one-active-per-case index.
async function failExhaustedStaleJobs(threshold: Date): Promise<void> {
  await db
    .update(evidenceGroupingJobsTable)
    .set({ status: "failed", error: "grouping did not complete (timed out or crashed) after repeated attempts", completedAt: new Date() })
    .where(and(
      eq(evidenceGroupingJobsTable.status, "processing"),
      lt(evidenceGroupingJobsTable.startedAt, threshold),
      sql`${evidenceGroupingJobsTable.attempts} >= ${MAX_ATTEMPTS}`,
    ));
}

async function claimNextJob(): Promise<typeof evidenceGroupingJobsTable.$inferSelect | null> {
  const threshold = new Date(Date.now() - STALE_PROCESSING_MS);
  const candidates = await db
    .select({ id: evidenceGroupingJobsTable.id })
    .from(evidenceGroupingJobsTable)
    .where(claimable(threshold))
    .orderBy(asc(evidenceGroupingJobsTable.createdAt))
    .limit(5);
  for (const c of candidates) {
    // Atomic claim: re-check the same predicate so two workers can't both take it
    // (claiming sets started_at = now, which fails a concurrent stale re-check).
    const [claimed] = await db
      .update(evidenceGroupingJobsTable)
      .set({ status: "processing", startedAt: new Date(), attempts: sql`${evidenceGroupingJobsTable.attempts} + 1` })
      .where(and(eq(evidenceGroupingJobsTable.id, c.id), claimable(threshold)))
      .returning();
    if (claimed) return claimed;
  }
  return null;
}

export async function drainEvidenceGroupingQueue(
  opts?: { budgetMs?: number; maxJobs?: number },
): Promise<{ processed: number; failed: number; remaining: number }> {
  const budgetMs = opts?.budgetMs ?? 45000;
  const maxJobs = opts?.maxJobs ?? 2;
  const start = Date.now();
  let processed = 0;
  let failed = 0;

  // Retire jobs that have exhausted their attempts so they stop blocking the case.
  await failExhaustedStaleJobs(new Date(Date.now() - STALE_PROCESSING_MS));

  while (processed + failed < maxJobs && Date.now() - start < budgetMs) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      const counts = await runGroupingForCase(job.caseId);
      await db
        .update(evidenceGroupingJobsTable)
        .set({ status: "done", newGroups: counts.newGroups, addSuggestions: counts.addSuggestions, completedAt: new Date(), error: null })
        .where(eq(evidenceGroupingJobsTable.id, job.id));
      processed++;
      // Large backlog: this run handled one batch. If files still await grouping,
      // queue the next batch so the backlog is worked through across cron ticks.
      // Files just reviewed are excluded, so this always makes progress (no loop).
      try {
        if (await pendingGroupingFileCount(job.caseId) > 0) {
          await db
            .insert(evidenceGroupingJobsTable)
            .values({ caseId: job.caseId, status: "queued", requestedBy: "auto" })
            .onConflictDoNothing();
        }
      } catch (err) {
        logger.warn({ err, caseId: job.caseId }, "[evidenceGroupingWorker] follow-up enqueue failed");
      }
    } catch (err) {
      logger.error({ err, jobId: job.id, caseId: job.caseId }, "[evidenceGroupingWorker] job failed");
      await db
        .update(evidenceGroupingJobsTable)
        .set({ status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "grouping failed", completedAt: new Date() })
        .where(eq(evidenceGroupingJobsTable.id, job.id));
      failed++;
    }
  }

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(evidenceGroupingJobsTable)
    .where(eq(evidenceGroupingJobsTable.status, "queued"));
  logger.info({ processed, failed, remaining }, "[evidenceGroupingWorker] drain complete");
  return { processed, failed, remaining: remaining ?? 0 };
}

// Enqueue a grouping job if a case has >= threshold ungrouped files and no job has
// run since (idempotent via the one-active-per-case partial unique index). Called
// after an evidence sync. Never throws.
export async function maybeAutoEnqueueGrouping(caseId: number): Promise<void> {
  try {
    const ungrouped = await pendingGroupingFileCount(caseId);
    if (ungrouped < AUTO_UNGROUPED_THRESHOLD) return;

    // Skip if an active job already exists, or one completed recently with nothing
    // new to do — the partial unique index also guards the active case.
    const [last] = await db
      .select({ status: evidenceGroupingJobsTable.status, completedAt: evidenceGroupingJobsTable.completedAt })
      .from(evidenceGroupingJobsTable)
      .where(eq(evidenceGroupingJobsTable.caseId, caseId))
      .orderBy(desc(evidenceGroupingJobsTable.createdAt))
      .limit(1);
    if (last && (last.status === "queued" || last.status === "processing")) return;
    // If the last run completed within the last 30 minutes, don't re-run on every sync.
    if (last?.completedAt && Date.now() - new Date(last.completedAt).getTime() < 30 * 60 * 1000) return;

    await db
      .insert(evidenceGroupingJobsTable)
      .values({ caseId, status: "queued", requestedBy: "auto" })
      .onConflictDoNothing();
    logger.info({ caseId, ungrouped }, "[evidenceGroupingWorker] auto-enqueued grouping");
  } catch (err) {
    logger.error({ err, caseId }, "[evidenceGroupingWorker] auto-enqueue failed");
  }
}
