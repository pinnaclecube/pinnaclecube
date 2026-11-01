/**
 * orchestrator.ts — Evidence Package module, stages 1 + 7 (spec §4).
 *
 * Durable worker that drains package_generation_jobs, mirroring the Step-4
 * letter-generation pattern (atomic claim, stale reclaim, bounded drain). runJob
 * advances the pipeline idempotently — scan -> extract -> classify -> group ->
 * (pause) -> plan -> generate -> assemble — persisting after each stage so a
 * retry (after a timeout/crash) resumes from the first incomplete stage. The
 * model-bearing stages (classify, generate) persist per item, so they make
 * progress across cron ticks even when a single tick runs out of budget.
 *
 * Retry rule: up to MAX_ATTEMPTS. A stage error or a stale 'processing' reclaim
 * counts an attempt; normal multi-tick continuation does not.
 */

import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db, packageGenerationJobsTable, exhibitDocumentsTable, evidenceClassificationsTable,
  evidenceGroupsTable, caseFolderItemsTable, casePetitionSetupTable, profilesTable,
} from "@workspace/db";
import { describeExhibitCode, criterionByKey, PACKAGE_TEMPLATES } from "@workspace/shared";
import { runGroupingForCase } from "../evidenceGroupingService";
import { downloadDriveFile } from "../driveService";
import { uploadFileToDrive } from "../driveUploadService";
import { logger } from "../../lib/logger";
import { scanCaseEvidence } from "./scanner";
import { extractFile, type FileExtract } from "./extractor";
import { classifyExtracts } from "./classifier";
import { planPackage } from "./planner";
import { generateSubExhibit, generateCriterion, generateFinalMerits } from "./generator";
import { renderExhibitDocx, type FigureInput, type RenderContent } from "./renderer";
import { ensureCacheFolder, ensurePackageFolder, assemblePackage, notifyPackageReady } from "./assembly";
import { pauseForGroupReview } from "./jobs";

const STALE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
type Job = typeof packageGenerationJobsTable.$inferSelect;

// ─── Claim (fresh queued, then stale-processing reclaim counts an attempt) ──────

async function claimNextJob(): Promise<Job | null> {
  const queued = await db.select({ id: packageGenerationJobsTable.id })
    .from(packageGenerationJobsTable)
    .where(eq(packageGenerationJobsTable.status, "queued"))
    .orderBy(asc(packageGenerationJobsTable.createdAt)).limit(5);
  for (const c of queued) {
    const [claimed] = await db.update(packageGenerationJobsTable)
      .set({ status: "processing", startedAt: new Date() })
      .where(and(eq(packageGenerationJobsTable.id, c.id), eq(packageGenerationJobsTable.status, "queued")))
      .returning();
    if (claimed) return claimed;
  }
  const threshold = new Date(Date.now() - STALE_MS);
  const stale = await db.select({ id: packageGenerationJobsTable.id })
    .from(packageGenerationJobsTable)
    .where(and(eq(packageGenerationJobsTable.status, "processing"), lt(packageGenerationJobsTable.startedAt, threshold)))
    .limit(5);
  for (const c of stale) {
    const [claimed] = await db.update(packageGenerationJobsTable)
      .set({ status: "processing", startedAt: new Date(), attempts: sql`${packageGenerationJobsTable.attempts} + 1` })
      .where(and(eq(packageGenerationJobsTable.id, c.id), eq(packageGenerationJobsTable.status, "processing"), lt(packageGenerationJobsTable.startedAt, threshold)))
      .returning();
    if (claimed) return claimed;
  }
  return null;
}

function markStage(job: Job, stage: string, patch: Record<string, unknown>) {
  const ss = (job.stageStatus ?? {}) as Record<string, unknown>;
  ss[stage] = { ...(ss[stage] as object ?? {}), ...patch };
  return ss;
}

// ─── Stages ──────────────────────────────────────────────────────────────────

/** Scan + extract into an in-memory map (page images uploaded to the _cache
 * folder). Re-runs each tick; cheap relative to the model stages. */
async function scanAndExtract(caseSetupId: number, version: number): Promise<Map<number, FileExtract>> {
  const scan = await scanCaseEvidence(caseSetupId);
  const cacheFolderId = await ensureCacheFolder(caseSetupId, version);
  const map = new Map<number, FileExtract>();
  for (const f of scan.files) {
    const ex = await extractFile(f, { uploadFolderId: cacheFolderId });
    map.set(f.fileId, ex);
  }
  return map;
}

/** Figures for a group's member files (page images downloaded from the cache). */
async function figuresForGroup(fileIds: number[], extracts: Map<number, FileExtract>, captionById: Map<number, string>): Promise<FigureInput[]> {
  const figs: FigureInput[] = [];
  for (const id of fileIds) {
    const ex = extracts.get(id);
    if (!ex?.ok) continue;
    const first = ex.pages.find((p) => p.driveId);
    if (!first?.driveId) continue;
    try {
      const png = await downloadDriveFile(first.driveId);
      figs.push({ caption: captionById.get(id) ?? `${ex.fileName} — page 1`, png });
    } catch (err) {
      logger.warn({ err, fileId: id }, "[package/orchestrator] figure download failed");
    }
  }
  return figs;
}

/** Generate + render every not-yet-rendered planned document (final_merits last),
 * uploading each .docx and persisting content_json + wordDriveId. Bounded by the
 * deadline; returns true when every planned doc is rendered. */
async function generateDocuments(caseSetupId: number, version: number, extracts: Map<number, FileExtract>, folderId: string, deadline: number): Promise<boolean> {
  const docs = await db.select().from(exhibitDocumentsTable)
    .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.packageVersion, version)))
    .orderBy(asc(exhibitDocumentsTable.id));

  const [prof] = await db
    .select({ name: profilesTable.name })
    .from(casePetitionSetupTable)
    .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
    .where(eq(casePetitionSetupTable.id, caseSetupId)).limit(1);
  const applicantName = prof?.name ?? "the applicant";

  // dependency order: sub_exhibits, then criterion, then index, then final_merits
  const rank = (r: string | null) => (r === "final_merits" ? 3 : r === "index" ? 2 : r === "criterion" ? 1 : 0);
  const pending = docs.filter((d) => d.renderStatus !== "rendered").sort((a, b) => rank(a.role) - rank(b.role));

  for (const d of pending) {
    if (Date.now() > deadline) return false; // continue next tick
    const code = d.exhibitCode ?? "";
    const crit = criterionByKey(d.criteriaCode ?? undefined);
    let content: RenderContent;
    let figures: FigureInput[] = [];

    if (d.role === "sub_exhibit" && d.evidenceGroupId) {
      const members = await db.select({ id: caseFolderItemsTable.id, name: caseFolderItemsTable.name })
        .from(caseFolderItemsTable).where(eq(caseFolderItemsTable.groupId, d.evidenceGroupId));
      const classes = await db.select().from(evidenceClassificationsTable)
        .where(and(eq(evidenceClassificationsTable.caseSetupId, caseSetupId), eq(evidenceClassificationsTable.packageVersion, version),
          inArray(evidenceClassificationsTable.fileId, members.map((m) => m.id))));
      const classByFile = new Map(classes.map((c) => [c.fileId, c]));
      const gen = await generateSubExhibit({
        applicantName, criterionName: crit?.name ?? "Evidence", exhibitCode: code,
        groupTitle: d.exhibitLabel ?? d.fileName,
        files: members.map((m) => ({
          fileId: m.id, name: m.name,
          evidenceType: classByFile.get(m.id)?.evidenceType ?? null,
          summary: classByFile.get(m.id)?.summary ?? null,
          extract: extracts.get(m.id)?.text ?? "",
        })),
      });
      content = gen.content;
      const captionById = new Map(gen.figures.map((f) => [f.sourceFileId, f.caption]));
      figures = await figuresForGroup(members.map((m) => m.id), extracts, captionById);
    } else if (d.role === "criterion") {
      const subs = docs.filter((x) => x.role === "sub_exhibit" && x.criteriaCode === d.criteriaCode);
      content = await generateCriterion({
        applicantName, criterionName: crit?.name ?? "Criterion", regulation: crit?.regulation ?? "", exhibitCode: code,
        subExhibits: subs.map((s) => ({ code: s.exhibitCode ?? "", title: s.exhibitLabel ?? s.fileName })),
      }, crit?.regulation ?? "");
    } else if (d.role === "final_merits") {
      const byCrit = new Map<string, typeof docs>();
      for (const x of docs) if (x.role === "sub_exhibit") { const k = x.criteriaCode ?? ""; (byCrit.get(k) ?? byCrit.set(k, []).get(k)!).push(x); }
      const fm = await generateFinalMerits({
        applicantName,
        criteria: [...byCrit.entries()].map(([k, subs]) => ({ name: criterionByKey(k)?.name ?? k, code: criterionByKey(k)?.letter ?? "Z", satisfiable: true, subExhibits: subs.map((s) => ({ code: s.exhibitCode ?? "", title: s.exhibitLabel ?? s.fileName })) })),
      }, "8 C.F.R. § 204.5(h)(2)");
      content = fm;
    } else {
      continue; // index is rendered at assembly
    }

    const meta = { applicantName, criterionName: crit?.name, generatedAt: new Date(), approved: false };
    const rendered = await renderExhibitDocx({ role: d.role as never, exhibitCode: code, content, meta, figures });
    const upload = await uploadFileToDrive(rendered.buffer, d.fileName, DOCX_MIME, folderId);
    await db.update(exhibitDocumentsTable).set({
      contentJson: content as unknown as object, flags: rendered.flags,
      wordDriveId: upload.driveFileId, wordDriveUrl: upload.driveUrl, renderStatus: "rendered",
    }).where(eq(exhibitDocumentsTable.id, d.id));
  }
  // done if nothing non-rendered remains (index excluded — assembled separately)
  const remaining = await db.select({ id: exhibitDocumentsTable.id }).from(exhibitDocumentsTable)
    .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.packageVersion, version),
      inArray(exhibitDocumentsTable.role, ["sub_exhibit", "criterion", "final_merits"]), eq(exhibitDocumentsTable.renderStatus, "pending")));
  return remaining.length === 0;
}

// ─── runJob ──────────────────────────────────────────────────────────────────

async function runJob(job: Job, deadline: number): Promise<"done" | "paused" | "continue" | "failed"> {
  const caseId = job.caseSetupId;
  const version = job.packageVersion;
  try {
    const { folderId } = await ensurePackageFolder(caseId, version);

    // scan + extract (in-memory; page images cached to Drive)
    const extracts = await scanAndExtract(caseId, version);

    // classify (idempotent: skip if already classified for this version)
    const already = await db.select({ n: sql<number>`count(*)::int` }).from(evidenceClassificationsTable)
      .where(and(eq(evidenceClassificationsTable.caseSetupId, caseId), eq(evidenceClassificationsTable.packageVersion, version)));
    if ((already[0]?.n ?? 0) === 0) {
      await classifyExtracts(caseId, version, [...extracts.values()]);
    }

    // group (reuse Step 5; idempotent)
    await runGroupingForCase(caseId);

    // pause for group review if requested and not yet resumed
    const [js] = await db.select().from(packageGenerationJobsTable).where(eq(packageGenerationJobsTable.id, job.id)).limit(1);
    const reviewed = ((js?.stageStatus ?? {}) as Record<string, unknown>)["group_review_done"];
    if (job.confirmGroupsFirst && !reviewed) {
      await pauseForGroupReview(job.id);
      return "paused";
    }

    // plan (idempotent re-plan)
    await planPackage(caseId, version);

    // generate (bounded; persists per doc)
    const allRendered = await generateDocuments(caseId, version, extracts, folderId, deadline);
    if (!allRendered) return "continue";

    // assemble + notify
    const result = await assemblePackage(caseId, version);
    await notifyPackageReady(caseId, version, result);
    return "done";
  } catch (err) {
    logger.error({ err, jobId: job.id, caseId }, "[package/orchestrator] job error");
    const attempts = (job.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      await db.update(packageGenerationJobsTable).set({ status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "package generation failed", completedAt: new Date() }).where(eq(packageGenerationJobsTable.id, job.id));
      return "failed";
    }
    await db.update(packageGenerationJobsTable).set({ status: "queued", attempts: attempts + 1, error: err instanceof Error ? err.message.slice(0, 500) : "error" }).where(eq(packageGenerationJobsTable.id, job.id));
    return "continue";
  }
}

export async function drainPackageQueue(opts?: { budgetMs?: number }): Promise<{ processed: number }> {
  const budgetMs = opts?.budgetMs ?? 50_000;
  const start = Date.now();
  let processed = 0;
  const job = await claimNextJob();
  if (!job) return { processed: 0 };

  await db.update(packageGenerationJobsTable).set({ stage: "running", stageStatus: markStage(job, "run", { startedAt: new Date().toISOString() }) }).where(eq(packageGenerationJobsTable.id, job.id));
  const outcome = await runJob(job, start + budgetMs);
  processed = 1;

  if (outcome === "done") {
    await db.update(packageGenerationJobsTable).set({ status: "ready_for_review", stage: "ready_for_review", completedAt: new Date(), error: null }).where(eq(packageGenerationJobsTable.id, job.id));
  } else if (outcome === "continue") {
    // leave 'queued' (runJob set it on error) or set queued for the next tick
    await db.update(packageGenerationJobsTable).set({ status: "queued" }).where(and(eq(packageGenerationJobsTable.id, job.id), eq(packageGenerationJobsTable.status, "processing")));
  }
  logger.info({ jobId: job.id, outcome }, "[package/orchestrator] tick complete");
  return { processed };
}
