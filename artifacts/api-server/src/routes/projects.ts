/**
 * projects.ts — Pinnacle³
 *
 * Projects module — EB-1A project documentation intake.
 *
 * Dual-auth (X-Staff-Token OR client Bearer JWT), following the referee module
 * precedent exactly. Clients are scoped to their own case; staff may act on any
 * case with full parity. `created_by` / `uploaded_by` are stamped from the caller.
 *
 * GET    /cases/:caseId/projects          — list (summary + completion + doc count)
 * POST   /cases/:caseId/projects          — create (title only; rejects the 11th)
 * GET    /projects/:id                    — full detail (+ documents + completion)
 * PUT    /projects/:id                    — partial update (any subset of sections)
 * PUT    /cases/:caseId/projects/reorder  — set sort_order from an ordered id list
 * DELETE /projects/:id                    — delete (cascades documents)
 * POST   /projects/:id/documents          — upload evidence to the case Drive folder
 * DELETE /project-documents/:id
 * GET    /project-documents/:id/download  — proxy stream (dual-auth, own case)
 * GET    /lookups/employment-types | criticality-levels | project-document-categories
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { Readable } from "stream";
import multer from "multer";
import { z } from "zod/v4";
import {
  db,
  caseProjectsTable,
  projectDocumentsTable,
  projectDocumentCategoriesTable,
  employmentTypesTable,
  criticalityLevelsTable,
  casePetitionSetupTable,
  caseFoldersTable,
} from "@workspace/db";
import { getDriveClient, createDriveFolder, downloadDriveFile } from "../services/driveService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const PROJECT_FOLDER_NAME = "Project Evidence";
const MAX_PROJECTS = 10;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ALLOWED_DOC_MIMES = new Set([PDF_MIME, DOCX_MIME, XLSX_MIME, "image/png", "image/jpeg"]);

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

// Builds a header-safe Content-Disposition value (RFC 6266). HTTP header values
// must be ASCII, so we emit an ASCII fallback via `filename=` plus the full
// UTF-8 name via `filename*=`.
function attachmentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// ─── Auth helpers (mirror the referee module) ────────────────────────────────────

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) {
    requireStaffAuth(req, res, next);
  } else {
    void requireClientAuth(req, res, next);
  }
}

/** Loads the case and enforces client ownership (staff may access any case). */
async function authorizeCase(
  req: AugmentedRequest,
  res: Response,
  caseId: number,
): Promise<typeof casePetitionSetupTable.$inferSelect | null> {
  if (isNaN(caseId)) {
    res.status(400).json({ error: "Invalid caseId" });
    return null;
  }
  const [caseRecord] = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseId))
    .limit(1);

  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return null;
  }
  if (req.clientUser && caseRecord.profileId !== req.clientUser.id) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return caseRecord;
}

/** Loads a project and authorizes the caller against its case. */
async function loadAuthorizedProject(
  req: AugmentedRequest,
  res: Response,
  projectId: number,
): Promise<typeof caseProjectsTable.$inferSelect | null> {
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project id" });
    return null;
  }
  const [project] = await db
    .select()
    .from(caseProjectsTable)
    .where(eq(caseProjectsTable.id, projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }
  const caseRecord = await authorizeCase(req, res, project.caseId);
  if (!caseRecord) return null; // authorizeCase already sent the response
  return project;
}

function actorRole(req: AugmentedRequest): "client" | "staff" {
  return req.staffUser && !req.clientUser ? "staff" : "client";
}

// Finds (or creates) a named per-case Drive subfolder under the case root,
// registering it in case_folders. Returns its Drive folder id, or null if the
// case has no Drive root yet. Mirrors the referee module helper.
async function getOrCreateCaseSubfolder(
  caseId: number,
  folderName: string,
): Promise<string | null> {
  const [rootFolder] = await db
    .select()
    .from(caseFoldersTable)
    .where(and(eq(caseFoldersTable.caseId, caseId), eq(caseFoldersTable.folderType, "root")))
    .limit(1);
  if (!rootFolder) return null;

  const [existing] = await db
    .select()
    .from(caseFoldersTable)
    .where(and(eq(caseFoldersTable.caseId, caseId), eq(caseFoldersTable.name, folderName)))
    .limit(1);
  if (existing) return existing.driveId;

  const created = await createDriveFolder(folderName, rootFolder.driveId);
  await db.insert(caseFoldersTable).values({
    caseId,
    name: folderName,
    folderType: "custom",
    parentFolderId: rootFolder.id,
    driveId: created.driveId,
    driveUrl: created.driveUrl,
    visaCategory: rootFolder.visaCategory,
    staffOnly: false,
  });
  return created.driveId;
}

// ─── Completion ("X of 9") ───────────────────────────────────────────────────────
// A section is complete when all of its listed text fields are non-empty.
// Section 1 is judged on the spec's required subset, not every Section-1 column.

const SECTION_FIELDS: Record<string, (keyof typeof caseProjectsTable.$inferSelect)[]> = {
  section1: ["title", "organization", "roleTitle", "summary", "startDate"],
  section2: ["problemBefore", "baselineMetrics", "constraintsRisks", "failureConsequences"],
  section3: [
    "whyChosen", "decisionAuthority", "stakeholdersInfluenced",
    "criticalEventsLed", "indispensabilityEvidence", "leadershipOutcomes",
  ],
  section4: ["originalIdea", "approachDifference", "originalityProof", "contributionReach", "downstreamImpact"],
  section5: ["beforeAfterMetrics", "revenueCostSavings", "adoptionMetrics", "evidenceNotes"],
  section6: ["testimonials", "pressRecognition", "awardsCommendations", "strategicImportance"],
  section7: ["architectureMethods", "alternativesInferior", "reproducibility", "ipStatus"],
  section8: ["externalUsers", "adoptionEvidence", "academicCitations", "talksInvitations"],
  section9: ["uniquenessVsPeers", "measurableDifferences", "expertiseScarcity"],
};

function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function computeCompletion(project: typeof caseProjectsTable.$inferSelect) {
  const sections: Record<string, boolean> = {};
  let complete = 0;
  for (const [section, fields] of Object.entries(SECTION_FIELDS)) {
    const done = fields.every((f) => isFilled(project[f]));
    sections[section] = done;
    if (done) complete += 1;
  }
  return { sections, complete, total: Object.keys(SECTION_FIELDS).length };
}

// ─── Validation (shared by both portals) ─────────────────────────────────────────

const textField = z.string().trim().nullish();
const dateField = z.string().trim().nullish(); // 'YYYY-MM-DD'
const lookupId = z.number().int().positive().nullish();

// Accepts any subset of section fields — each section saves independently.
// Unknown keys are stripped by zod; absent keys are left untouched on update.
const ProjectUpdate = z.object({
  // Section 1
  title: z.string().trim().min(1, "Title cannot be empty").optional(),
  organization: textField,
  industryDomain: textField,
  startDate: dateField,
  endDate: dateField,
  isOngoing: z.boolean().optional(),
  roleTitle: textField,
  employmentTypeId: lookupId,
  teamComposition: textField,
  summary: textField,
  criticalityId: lookupId,
  criticalityJustification: textField,
  regulatoryContext: textField,
  // Section 2
  problemBefore: textField,
  baselineMetrics: textField,
  constraintsRisks: textField,
  failureConsequences: textField,
  // Section 3
  whyChosen: textField,
  decisionAuthority: textField,
  stakeholdersInfluenced: textField,
  criticalEventsLed: textField,
  indispensabilityEvidence: textField,
  leadershipOutcomes: textField,
  // Section 4
  originalIdea: textField,
  approachDifference: textField,
  originalityProof: textField,
  contributionReach: textField,
  downstreamImpact: textField,
  // Section 5
  beforeAfterMetrics: textField,
  revenueCostSavings: textField,
  adoptionMetrics: textField,
  evidenceNotes: textField,
  // Section 6
  testimonials: textField,
  pressRecognition: textField,
  awardsCommendations: textField,
  strategicImportance: textField,
  // Section 7
  architectureMethods: textField,
  alternativesInferior: textField,
  reproducibility: textField,
  ipStatus: textField,
  // Section 8
  externalUsers: textField,
  adoptionEvidence: textField,
  academicCitations: textField,
  talksInvitations: textField,
  // Section 9
  uniquenessVsPeers: textField,
  measurableDifferences: textField,
  expertiseScarcity: textField,
});

type ProjectUpdateType = z.infer<typeof ProjectUpdate>;

// Builds the DB update set from parsed input: only keys the caller actually sent,
// with empty strings normalized to null so clearing a field works.
function buildUpdateSet(data: ProjectUpdateType): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue; // not provided → leave untouched
    if (typeof value === "string") {
      const trimmed = value.trim();
      set[key] = trimmed === "" ? null : trimmed;
    } else {
      set[key] = value;
    }
  }
  // Ongoing projects have no end date.
  if (set.isOngoing === true) set.endDate = null;
  return set;
}

// ─── Serialization ────────────────────────────────────────────────────────────────

async function documentsFor(projectId: number) {
  return db
    .select({
      id: projectDocumentsTable.id,
      projectId: projectDocumentsTable.projectId,
      categoryId: projectDocumentsTable.categoryId,
      categoryName: projectDocumentCategoriesTable.name,
      driveFileId: projectDocumentsTable.driveFileId,
      fileName: projectDocumentsTable.fileName,
      description: projectDocumentsTable.description,
      uploadedBy: projectDocumentsTable.uploadedBy,
      createdAt: projectDocumentsTable.createdAt,
    })
    .from(projectDocumentsTable)
    .leftJoin(
      projectDocumentCategoriesTable,
      eq(projectDocumentsTable.categoryId, projectDocumentCategoriesTable.id),
    )
    .where(eq(projectDocumentsTable.projectId, projectId))
    .orderBy(asc(projectDocumentsTable.createdAt));
}

// ─── Lookups ────────────────────────────────────────────────────────────────────

router.get("/lookups/employment-types", requireAnyAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(employmentTypesTable)
    .where(eq(employmentTypesTable.isActive, true))
    .orderBy(asc(employmentTypesTable.sortOrder));
  res.json({ employmentTypes: rows });
});

router.get("/lookups/criticality-levels", requireAnyAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(criticalityLevelsTable)
    .where(eq(criticalityLevelsTable.isActive, true))
    .orderBy(asc(criticalityLevelsTable.sortOrder));
  res.json({ criticalityLevels: rows });
});

router.get("/lookups/project-document-categories", requireAnyAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(projectDocumentCategoriesTable)
    .where(eq(projectDocumentCategoriesTable.isActive, true))
    .orderBy(asc(projectDocumentCategoriesTable.sortOrder));
  res.json({ projectDocumentCategories: rows });
});

// ─── List ───────────────────────────────────────────────────────────────────────

router.get(
  "/cases/:caseId/projects",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const projects = await db
      .select()
      .from(caseProjectsTable)
      .where(eq(caseProjectsTable.caseId, caseId))
      .orderBy(asc(caseProjectsTable.sortOrder), asc(caseProjectsTable.id));

    const countMap = new Map<number, number>();
    if (projects.length > 0) {
      const counts = await db
        .select({
          projectId: projectDocumentsTable.projectId,
          count: sql<number>`count(*)::int`,
        })
        .from(projectDocumentsTable)
        .where(inArray(projectDocumentsTable.projectId, projects.map((p) => p.id)))
        .groupBy(projectDocumentsTable.projectId);
      for (const c of counts) countMap.set(c.projectId, c.count);
    }

    const list = projects.map((p) => ({
      id: p.id,
      title: p.title,
      organization: p.organization,
      roleTitle: p.roleTitle,
      startDate: p.startDate,
      endDate: p.endDate,
      isOngoing: p.isOngoing,
      sortOrder: p.sortOrder,
      isLocked: p.isLocked,
      createdBy: p.createdBy,
      documentCount: countMap.get(p.id) ?? 0,
      completion: computeCompletion(p),
    }));

    res.json({ projects: list, maxProjects: MAX_PROJECTS });
  },
);

// ─── Create (title only; rejects the 11th) ───────────────────────────────────────

router.post(
  "/cases/:caseId/projects",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      res.status(400).json({ error: "A project title is required" });
      return;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(caseProjectsTable)
      .where(eq(caseProjectsTable.caseId, caseId));
    if ((count ?? 0) >= MAX_PROJECTS) {
      res.status(409).json({ error: `A case can have at most ${MAX_PROJECTS} projects.` });
      return;
    }

    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${caseProjectsTable.sortOrder}), -1)` })
      .from(caseProjectsTable)
      .where(eq(caseProjectsTable.caseId, caseId));

    const [project] = await db
      .insert(caseProjectsTable)
      .values({
        caseId,
        title,
        sortOrder: (maxSort ?? -1) + 1,
        createdBy: actorRole(aug),
      })
      .returning();

    logger.info({ caseId, projectId: project.id, by: actorRole(aug) }, "[projects] created");
    res.status(201).json({
      project: { ...project, documents: [], completion: computeCompletion(project) },
    });
  },
);

// ─── Detail ───────────────────────────────────────────────────────────────────────

router.get(
  "/projects/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const projectId = parseInt(req.params.id as string, 10);
    const project = await loadAuthorizedProject(aug, res, projectId);
    if (!project) return;

    const documents = await documentsFor(projectId);
    res.json({ project: { ...project, documents, completion: computeCompletion(project) } });
  },
);

// ─── Partial update (any subset of sections saves independently) ─────────────────

router.put(
  "/projects/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const projectId = parseInt(req.params.id as string, 10);
    const existing = await loadAuthorizedProject(aug, res, projectId);
    if (!existing) return;

    const parsed = ProjectUpdate.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const set = buildUpdateSet(parsed.data);
    if (Object.keys(set).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    set.updatedAt = new Date();

    const [updated] = await db
      .update(caseProjectsTable)
      .set(set)
      .where(eq(caseProjectsTable.id, projectId))
      .returning();

    const documents = await documentsFor(projectId);
    logger.info({ projectId, fields: Object.keys(set), by: actorRole(aug) }, "[projects] updated");
    res.json({ project: { ...updated, documents, completion: computeCompletion(updated) } });
  },
);

// ─── Reorder ────────────────────────────────────────────────────────────────────

const ReorderInput = z.object({ order: z.array(z.number().int().positive()).min(1) });

router.put(
  "/cases/:caseId/projects/reorder",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const parsed = ReorderInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const projects = await db
      .select({ id: caseProjectsTable.id })
      .from(caseProjectsTable)
      .where(eq(caseProjectsTable.caseId, caseId));
    const owned = new Set(projects.map((p) => p.id));
    const order = parsed.data.order.filter((id) => owned.has(id));

    await db.transaction(async (tx) => {
      for (let i = 0; i < order.length; i++) {
        await tx
          .update(caseProjectsTable)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(caseProjectsTable.id, order[i]), eq(caseProjectsTable.caseId, caseId)));
      }
    });

    logger.info({ caseId, count: order.length, by: actorRole(aug) }, "[projects] reordered");
    res.json({ ok: true });
  },
);

// ─── Delete (cascades documents) ──────────────────────────────────────────────────

router.delete(
  "/projects/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const projectId = parseInt(req.params.id as string, 10);
    const existing = await loadAuthorizedProject(aug, res, projectId);
    if (!existing) return;

    // project_documents + referee_projects cascade-delete via FK.
    await db.delete(caseProjectsTable).where(eq(caseProjectsTable.id, projectId));
    logger.info({ projectId, by: actorRole(aug) }, "[projects] deleted");
    res.json({ ok: true });
  },
);

// ─── Document upload ──────────────────────────────────────────────────────────────

router.post(
  "/projects/:id/documents",
  requireAnyAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const projectId = parseInt(req.params.id as string, 10);
    const project = await loadAuthorizedProject(aug, res, projectId);
    if (!project) return;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (!ALLOWED_DOC_MIMES.has(file.mimetype)) {
      res.status(400).json({ error: "File must be a PDF, DOCX, XLSX, PNG, or JPG" });
      return;
    }

    const categoryId = parseInt(req.body?.categoryId as string, 10);
    if (isNaN(categoryId)) {
      res.status(400).json({ error: "A document category is required" });
      return;
    }
    const [category] = await db
      .select({ id: projectDocumentCategoriesTable.id })
      .from(projectDocumentCategoriesTable)
      .where(eq(projectDocumentCategoriesTable.id, categoryId))
      .limit(1);
    if (!category) {
      res.status(400).json({ error: "Invalid document category" });
      return;
    }
    const description =
      typeof req.body?.description === "string" && req.body.description.trim()
        ? req.body.description.trim()
        : null;

    const folderDriveId = await getOrCreateCaseSubfolder(project.caseId, PROJECT_FOLDER_NAME);
    if (!folderDriveId) {
      res.status(409).json({ error: "This case has no Drive folder set up yet" });
      return;
    }

    const fileName = file.originalname;
    const drive = getDriveClient();
    const driveRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: fileName, parents: [folderDriveId] },
      media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
      fields: "id,webViewLink",
    });
    const driveFileId = driveRes.data.id;
    if (!driveFileId) {
      res.status(502).json({ error: "Drive upload returned incomplete data" });
      return;
    }

    const [doc] = await db
      .insert(projectDocumentsTable)
      .values({
        projectId,
        categoryId,
        driveFileId,
        fileName,
        description,
        uploadedBy: actorRole(aug),
      })
      .returning();

    const [withCategory] = await db
      .select({
        id: projectDocumentsTable.id,
        projectId: projectDocumentsTable.projectId,
        categoryId: projectDocumentsTable.categoryId,
        categoryName: projectDocumentCategoriesTable.name,
        driveFileId: projectDocumentsTable.driveFileId,
        fileName: projectDocumentsTable.fileName,
        description: projectDocumentsTable.description,
        uploadedBy: projectDocumentsTable.uploadedBy,
        createdAt: projectDocumentsTable.createdAt,
      })
      .from(projectDocumentsTable)
      .leftJoin(
        projectDocumentCategoriesTable,
        eq(projectDocumentsTable.categoryId, projectDocumentCategoriesTable.id),
      )
      .where(eq(projectDocumentsTable.id, doc.id))
      .limit(1);

    logger.info({ projectId, documentId: doc.id, by: actorRole(aug) }, "[projects] document uploaded");
    res.status(201).json({
      document: withCategory,
      driveUrl: driveRes.data.webViewLink ?? null,
    });
  },
);

// ─── Document delete ──────────────────────────────────────────────────────────────

router.delete(
  "/project-documents/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const docId = parseInt(req.params.id as string, 10);
    if (isNaN(docId)) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const [doc] = await db
      .select()
      .from(projectDocumentsTable)
      .where(eq(projectDocumentsTable.id, docId))
      .limit(1);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const project = await loadAuthorizedProject(aug, res, doc.projectId);
    if (!project) return;

    await db.delete(projectDocumentsTable).where(eq(projectDocumentsTable.id, docId));
    logger.info({ documentId: docId, by: actorRole(aug) }, "[projects] document deleted");
    res.json({ ok: true });
  },
);

// ─── Document download (proxy stream, dual-auth, own case) ───────────────────────

router.get(
  "/project-documents/:id/download",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const docId = parseInt(req.params.id as string, 10);
    if (isNaN(docId)) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const [doc] = await db
      .select()
      .from(projectDocumentsTable)
      .where(eq(projectDocumentsTable.id, docId))
      .limit(1);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const project = await loadAuthorizedProject(aug, res, doc.projectId);
    if (!project) return;

    let buffer: Buffer;
    try {
      buffer = await downloadDriveFile(doc.driveFileId);
    } catch (err) {
      logger.error({ err, docId }, "[projects] document download failed");
      res.status(502).json({ error: "Could not retrieve the document from storage" });
      return;
    }

    const fileName = doc.fileName ?? `project-document-${docId}`;
    const lower = fileName.toLowerCase();
    const contentType = lower.endsWith(".pdf")
      ? PDF_MIME
      : lower.endsWith(".docx")
        ? DOCX_MIME
        : lower.endsWith(".xlsx")
          ? XLSX_MIME
          : lower.endsWith(".png")
            ? "image/png"
            : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
              ? "image/jpeg"
              : "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", attachmentDisposition(fileName));
    res.end(buffer);
  },
);

export default router;
