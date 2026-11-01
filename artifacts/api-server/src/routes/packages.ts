/**
 * packages.ts — Evidence Package module routes (spec §10). Staff only, EB-1A only.
 *
 *   POST /internal/cases/:caseId/packages   — new version + enqueue a job
 *   GET  /internal/packages/:jobId           — job status + its documents
 *   POST /internal/packages/:jobId/retry     — re-queue a failed job, or resume a
 *                                              job paused at awaiting_group_review
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, casePetitionSetupTable, petitionPackageTable, packageGenerationJobsTable, exhibitDocumentsTable, evidenceGroupsTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { resumeFromGroupReview } from "../services/package/jobs";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function loadEb1aCase(caseId: number, res: Response) {
  if (isNaN(caseId)) { res.status(400).json({ error: "Invalid caseId" }); return null; }
  const [c] = await db.select().from(casePetitionSetupTable).where(eq(casePetitionSetupTable.id, caseId)).limit(1);
  if (!c) { res.status(404).json({ error: "Case not found" }); return null; }
  if ((c.visaPath ?? "").toUpperCase() !== "EB1A") { res.status(400).json({ error: "Evidence packages are available for EB-1A cases only" }); return null; }
  return c;
}

const CreateInput = z.object({
  criteriaCodes: z.array(z.string()).nullish(),
  confirmGroupsFirst: z.boolean().default(false),
});

router.post(
  "/internal/cases/:caseId/packages",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const c = await loadEb1aCase(caseId, res);
    if (!c) return;
    const parsed = CreateInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

    // One active job per case (partial unique index backs this up).
    const [active] = await db.select().from(packageGenerationJobsTable)
      .where(and(eq(packageGenerationJobsTable.caseSetupId, caseId)))
      .orderBy(asc(packageGenerationJobsTable.id));
    if (active && ["queued", "processing", "awaiting_group_review"].includes(active.status)) {
      res.status(200).json({ job: active, alreadyRunning: true });
      return;
    }

    const [pkg] = await db.select({ v: petitionPackageTable.currentVersion }).from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, caseId)).limit(1);
    const version = (pkg?.v ?? 0) + 1;

    await db.insert(petitionPackageTable).values({ caseSetupId: caseId, profileId: c.profileId, currentVersion: version, packageStatus: "generating" })
      .onConflictDoUpdate({ target: petitionPackageTable.caseSetupId, set: { currentVersion: version, packageStatus: "generating" } });

    const [job] = await db.insert(packageGenerationJobsTable).values({
      caseSetupId: caseId, packageVersion: version, status: "queued",
      requestedBy: (req as Request & { staffUser?: { id: string } }).staffUser?.id ?? "staff",
      confirmGroupsFirst: parsed.data.confirmGroupsFirst,
      criteriaCodes: parsed.data.criteriaCodes ?? null,
    }).returning();
    logger.info({ caseId, version, jobId: job.id }, "[packages] job queued");
    res.status(202).json({ job, version });
  },
);

// UI-supporting read: latest package + active job + its documents + which criteria
// have confirmed groups (generate-modal defaults).
router.get(
  "/internal/cases/:caseId/packages",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const c = await loadEb1aCase(caseId, res);
    if (!c) return;
    const [pkg] = await db.select().from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, caseId)).limit(1);
    const [job] = await db.select().from(packageGenerationJobsTable)
      .where(eq(packageGenerationJobsTable.caseSetupId, caseId))
      .orderBy(desc(packageGenerationJobsTable.id)).limit(1);
    const version = pkg?.currentVersion ?? 0;
    const documents = version > 0
      ? await db.select().from(exhibitDocumentsTable)
          .where(and(eq(exhibitDocumentsTable.caseSetupId, caseId), eq(exhibitDocumentsTable.packageVersion, version)))
          .orderBy(asc(exhibitDocumentsTable.id))
      : [];
    const critRows = await db.selectDistinct({ c: evidenceGroupsTable.criterionFolder })
      .from(evidenceGroupsTable)
      .where(and(eq(evidenceGroupsTable.caseId, caseId), eq(evidenceGroupsTable.status, "confirmed")));
    res.json({
      package: pkg ?? null, job: job ?? null, documents,
      criteriaWithGroups: critRows.map((r) => r.c).filter((x): x is string => !!x),
    });
  },
);

router.get(
  "/internal/packages/:jobId",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const jobId = parseInt(req.params.jobId as string, 10);
    const [job] = await db.select().from(packageGenerationJobsTable).where(eq(packageGenerationJobsTable.id, jobId)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const documents = await db.select().from(exhibitDocumentsTable)
      .where(and(eq(exhibitDocumentsTable.caseSetupId, job.caseSetupId), eq(exhibitDocumentsTable.packageVersion, job.packageVersion)))
      .orderBy(asc(exhibitDocumentsTable.id));
    res.json({ job, documents });
  },
);

router.post(
  "/internal/packages/:jobId/retry",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const jobId = parseInt(req.params.jobId as string, 10);
    const [job] = await db.select().from(packageGenerationJobsTable).where(eq(packageGenerationJobsTable.id, jobId)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    if (job.status === "awaiting_group_review") {
      const ss = (job.stageStatus ?? {}) as Record<string, unknown>;
      ss["group_review_done"] = true;
      await db.update(packageGenerationJobsTable).set({ stageStatus: ss }).where(eq(packageGenerationJobsTable.id, jobId));
      await resumeFromGroupReview(jobId);
      res.json({ ok: true, resumed: true });
      return;
    }
    if (job.status === "failed") {
      await db.update(packageGenerationJobsTable).set({ status: "queued", error: null }).where(eq(packageGenerationJobsTable.id, jobId));
      res.json({ ok: true, requeued: true });
      return;
    }
    res.status(409).json({ error: `Cannot retry a job in status '${job.status}'` });
  },
);

export default router;
