/**
 * letterGenerationWorker.ts — Pinnacle³
 *
 * Step 4 (async) — drains the letter_generation_jobs queue. Claims queued jobs one
 * at a time (atomic optimistic claim), generates the draft (the slow model call,
 * off the request path), links it to the job, then notifies staff + client (app
 * notification + email). Bounded per invocation to stay under the function limit.
 * Never throws out of the drain loop.
 */

import { eq, and, asc, sql } from "drizzle-orm";
import {
  db,
  refereesTable,
  letterGenerationJobsTable,
  casePetitionSetupTable,
  profilesTable,
  notificationsTable,
} from "@workspace/db";
import { generateLetterDraft } from "./letterGenerationService";
import { insertStaffNotification } from "./staffNotificationService";
import { sendEmail, referenceLetterDraftReadyEmail } from "./emailService";
import { logger } from "../lib/logger";

const SUPPORT_EMAIL = "support@pinnaclecube.com";
const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";

async function claimNextJob(): Promise<typeof letterGenerationJobsTable.$inferSelect | null> {
  const candidates = await db
    .select({ id: letterGenerationJobsTable.id })
    .from(letterGenerationJobsTable)
    .where(eq(letterGenerationJobsTable.status, "queued"))
    .orderBy(asc(letterGenerationJobsTable.createdAt))
    .limit(5);

  for (const c of candidates) {
    // Atomic claim: only succeeds if the row is still 'queued'.
    const [claimed] = await db
      .update(letterGenerationJobsTable)
      .set({
        status: "processing",
        startedAt: new Date(),
        attempts: sql`${letterGenerationJobsTable.attempts} + 1`,
      })
      .where(and(eq(letterGenerationJobsTable.id, c.id), eq(letterGenerationJobsTable.status, "queued")))
      .returning();
    if (claimed) return claimed;
  }
  return null;
}

async function notifyDraftReady(referee: typeof refereesTable.$inferSelect): Promise<void> {
  try {
    const [row] = await db
      .select({
        profileId: casePetitionSetupTable.profileId,
        email: profilesTable.email,
        firstName: profilesTable.firstName,
        name: profilesTable.name,
      })
      .from(casePetitionSetupTable)
      .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
      .where(eq(casePetitionSetupTable.id, referee.caseId))
      .limit(1);

    const clientName = row?.name ?? "the client";
    const firstName = row?.firstName ?? row?.name?.split(" ")[0] ?? "there";

    // Staff — in-app bell + support email.
    await insertStaffNotification(
      `Reference letter draft ready — ${clientName}`,
      `A draft reference letter for ${referee.fullName} has been generated and is ready to review and finalize.`,
      row?.profileId ? `/internal/case/${row.profileId}?tab=reference-letters` : null,
      referee.caseId,
    );
    await sendEmail(SUPPORT_EMAIL, {
      subject: `Reference letter draft ready — ${clientName} — ${referee.fullName}`,
      html: `<p>A draft reference letter for <strong>${referee.fullName}</strong> (${clientName}) has been generated and is ready to review and finalize.</p><p><a href="${APP_URL}${row?.profileId ? `/internal/case/${row.profileId}?tab=reference-letters` : "/internal/cases"}">Open the case</a></p>`,
      text: `A draft reference letter for ${referee.fullName} (${clientName}) is ready to review and finalize.`,
    });

    // Client — in-app notification + email.
    if (row?.profileId) {
      await db.insert(notificationsTable).values({
        profileId: row.profileId,
        userType: "client",
        caseSetupId: referee.caseId,
        notificationType: "reference_letter",
        title: "Your reference letter draft is ready",
        message: `The draft reference letter for ${referee.fullName} is ready to view. Our team will review and finalize it before it is sent for your confirmation.`,
        link: "/reference-letters",
        status: "unread",
        priority: "medium",
      });
    }
    if (row?.email) {
      await sendEmail(row.email, referenceLetterDraftReadyEmail(firstName, referee.fullName));
    }
  } catch (err) {
    logger.error({ err, refereeId: referee.id }, "[letterWorker] notify failed — draft still saved");
  }
}

export async function drainLetterGenerationQueue(
  opts?: { budgetMs?: number; maxJobs?: number },
): Promise<{ processed: number; failed: number; remaining: number }> {
  const budgetMs = opts?.budgetMs ?? 45000; // leave headroom under the 60s limit
  const maxJobs = opts?.maxJobs ?? 3;
  const start = Date.now();
  let processed = 0;
  let failed = 0;

  while (processed + failed < maxJobs && Date.now() - start < budgetMs) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      const [referee] = await db
        .select()
        .from(refereesTable)
        .where(eq(refereesTable.id, job.refereeId))
        .limit(1);
      if (!referee) throw new Error("Referee no longer exists");

      const draft = await generateLetterDraft(referee, {
        feedback: job.feedback,
        generatedBy: job.requestedBy === "staff" ? "staff" : "client",
      });

      await db
        .update(letterGenerationJobsTable)
        .set({ status: "done", draftId: draft.id, completedAt: new Date(), error: null })
        .where(eq(letterGenerationJobsTable.id, job.id));

      await notifyDraftReady(referee);
      processed++;
    } catch (err) {
      logger.error({ err, jobId: job.id, refereeId: job.refereeId }, "[letterWorker] job failed");
      await db
        .update(letterGenerationJobsTable)
        .set({
          status: "failed",
          error: err instanceof Error ? err.message.slice(0, 500) : "generation failed",
          completedAt: new Date(),
        })
        .where(eq(letterGenerationJobsTable.id, job.id));
      failed++;
    }
  }

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(letterGenerationJobsTable)
    .where(eq(letterGenerationJobsTable.status, "queued"));

  logger.info({ processed, failed, remaining }, "[letterWorker] drain complete");
  return { processed, failed, remaining: remaining ?? 0 };
}
