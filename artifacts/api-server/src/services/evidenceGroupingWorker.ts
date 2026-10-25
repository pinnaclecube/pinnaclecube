/**
 * evidenceGroupingWorker.ts — Pinnacle³
 *
 * Step 5 — drains the evidence_grouping_jobs queue (mirrors letterGenerationWorker).
 * One case per claim; runs the AI grouping and records counts. Never throws out of
 * the loop. Also enqueues an auto job after sync when a case has many ungrouped
 * files and none has been grouped since.
 */

import { eq, and, asc, sql, desc } from "drizzle-orm";
import { db, evidenceGroupingJobsTable } from "@workspace/db";
import { runGroupingForCase, ungroupedFileCount } from "./evidenceGroupingService";
import { logger } from "../lib/logger";

const AUTO_UNGROUPED_THRESHOLD = 10;

async function claimNextJob(): Promise<typeof evidenceGroupingJobsTable.$inferSelect | null> {
  const candidates = await db
    .select({ id: evidenceGroupingJobsTable.id })
    .from(evidenceGroupingJobsTable)
    .where(eq(evidenceGroupingJobsTable.status, "queued"))
    .orderBy(asc(evidenceGroupingJobsTable.createdAt))
    .limit(5);
  for (const c of candidates) {
    const [claimed] = await db
      .update(evidenceGroupingJobsTable)
      .set({ status: "processing", startedAt: new Date(), attempts: sql`${evidenceGroupingJobsTable.attempts} + 1` })
      .where(and(eq(evidenceGroupingJobsTable.id, c.id), eq(evidenceGroupingJobsTable.status, "queued")))
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
    const ungrouped = await ungroupedFileCount(caseId);
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
