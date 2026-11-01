/**
 * jobs.ts — Evidence Package module, job-status helpers.
 *
 * The awaiting_group_review pause (spec section 4 stage 4): after pass 2 the
 * orchestrator (phase 7) calls pauseForGroupReview when confirmGroupsFirst is
 * set, parking the job until staff finish curating groups via the Step 5 review
 * endpoints (+ the new split). Resume re-queues the job; the orchestrator picks up
 * at the first incomplete stage using stage_status.
 */

import { and, eq } from "drizzle-orm";
import { db, packageGenerationJobsTable } from "@workspace/db";
import { logger } from "../../lib/logger";

export async function pauseForGroupReview(jobId: number): Promise<void> {
  await db
    .update(packageGenerationJobsTable)
    .set({ status: "awaiting_group_review", stage: "classify_group" })
    .where(eq(packageGenerationJobsTable.id, jobId));
  logger.info({ jobId }, "[package/jobs] paused for group review");
}

export async function resumeFromGroupReview(jobId: number): Promise<boolean> {
  const [row] = await db
    .update(packageGenerationJobsTable)
    .set({ status: "queued" })
    .where(and(eq(packageGenerationJobsTable.id, jobId), eq(packageGenerationJobsTable.status, "awaiting_group_review")))
    .returning({ id: packageGenerationJobsTable.id });
  if (row) logger.info({ jobId }, "[package/jobs] resumed from group review");
  return !!row;
}
