/**
 * caseExhibits.ts — Pinnacle³
 *
 * Staff-controlled assessment and exhibit generation routes.
 * All generation endpoints fire-and-forget — HTTP response is returned
 * immediately while background work proceeds asynchronously.
 *
 * Dual-auth GET /cases/:id/exhibits: staff sees everything, authenticated
 * clients see only publishedToClient=true documents for their own case.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  criteriaAssessmentsTable,
  exhibitDocumentsTable,
  petitionPackageTable,
  petitionCriteriaExhibitsTable,
  casePetitionSetupTable,
  profilesTable,
  notificationsTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { verifyToken } from "../services/auth";
import {
  assessCriteriaEvidence,
  assessAllCriteria,
} from "../services/criteriaAssessmentService";
import {
  generateCriteriaExhibits,
  generateAllCriteriaExhibits,
  generateCoverLetter,
  generatePersonalDeclaration,
  generateFieldBrief,
  generateRecommendationTemplates,
} from "../services/exhibitGeneratorService";
import { logger } from "../lib/logger";
import { z } from "zod/v4";
import multer from "multer";
import { uploadFileToDrive, getCaseDriveFolderId } from "../services/driveUploadService";
import {
  createDriveFolder,
  listDriveFolderFiles,
  listDriveSubfolders,
  shareDriveFile,
  getDriveClient,
} from "../services/driveService";
import { sendEmail } from "../services/emailService";
import { logActivity } from "../services/activityLogger";

const uploadMw = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Coerces Express 5 string | string[] param to a single string. */
function param(raw: string | string[]): string {
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

function parseCaseId(raw: string | string[]): number | null {
  const n = parseInt(param(raw), 10);
  return isNaN(n) ? null : n;
}

function staffId(req: Request): string {
  return (req as any).staffUser?.id ?? "staff";
}

/** Minimal HTML-escape for values interpolated into notification email bodies. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Staff tokens built at startup — avoids re-reading env on every dual-auth request
const STAFF_TOKENS: ReadonlySet<string> = new Set(
  [process.env.STAFF_SECRET, process.env.STAFF_SECRET_CHRIS].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  ),
);

function isStaffRequest(req: Request): boolean {
  const token = req.headers["x-staff-token"];
  return typeof token === "string" && STAFF_TOKENS.has(token);
}

// ═════════════════════════════════════════════════════════════════════════════
// Assessment Routes
// ═════════════════════════════════════════════════════════════════════════════

// ─── POST /cases/:caseSetupId/assess/criteria/:criteriaCode ───────────────────
// Synchronous — awaits the Claude assessment before responding.

router.post(
  "/cases/:caseSetupId/assess/criteria/:criteriaCode",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }
    const criteriaCode = param(req.params.criteriaCode);

    const assessment = await assessCriteriaEvidence(caseSetupId, criteriaCode);
    res.json({ assessment });
  },
);

// ─── POST /cases/:caseSetupId/assess/all ─────────────────────────────────────
// Fire-and-forget — responds immediately, assessments run in background.

router.post(
  "/cases/:caseSetupId/assess/all",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Assessment started", caseSetupId });

    assessAllCriteria(caseSetupId).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] assessAllCriteria background error"),
    );
  },
);

// ─── PATCH /cases/:caseSetupId/assess/criteria/:criteriaCode/override ─────────

const OverrideBody = z.object({
  decision: z.enum(["proceed", "skip"]),
  note: z.string().min(1),
});

router.patch(
  "/cases/:caseSetupId/assess/criteria/:criteriaCode/override",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }
    const criteriaCode = param(req.params.criteriaCode);

    const parsed = OverrideBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const { decision, note } = parsed.data;
    const now = new Date();
    const sid = staffId(req);

    // Upsert: update existing assessment or create a shell override record
    const existing = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(
        and(
          eq(criteriaAssessmentsTable.caseSetupId, caseSetupId),
          eq(criteriaAssessmentsTable.criteriaCode, criteriaCode),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "No assessment found for this criteria — run assessment first" });
      return;
    }

    const [updated] = await db
      .update(criteriaAssessmentsTable)
      .set({
        staffOverride: true,
        staffOverrideBy: sid,
        staffOverrideAt: now,
        staffOverrideNote: note,
        finalDecision: decision,
      })
      .where(
        and(
          eq(criteriaAssessmentsTable.caseSetupId, caseSetupId),
          eq(criteriaAssessmentsTable.criteriaCode, criteriaCode),
        ),
      )
      .returning();

    logger.info({ caseSetupId, criteriaCode, decision, staffId: sid }, "[caseExhibits] assessment override applied");
    res.json({ assessment: updated });
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// Exhibit Generation Routes (all fire-and-forget)
// ═════════════════════════════════════════════════════════════════════════════

// ─── POST /cases/:caseSetupId/exhibits/generate/criteria/:criteriaCode ────────

router.post(
  "/cases/:caseSetupId/exhibits/generate/criteria/:criteriaCode",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }
    const criteriaCode = param(req.params.criteriaCode);

    res.json({ message: "Generation started", criteriaCode });

    generateCriteriaExhibits(caseSetupId, criteriaCode, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, criteriaCode, err }, "[caseExhibits] generateCriteriaExhibits background error"),
    );
  },
);

// ─── POST /cases/:caseSetupId/exhibits/generate/all ──────────────────────────

router.post(
  "/cases/:caseSetupId/exhibits/generate/all",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Full package generation started", caseSetupId });

    generateAllCriteriaExhibits(caseSetupId, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] generateAllCriteriaExhibits background error"),
    );
  },
);

// ─── POST /cases/:caseSetupId/exhibits/generate/cover-letter ─────────────────

router.post(
  "/cases/:caseSetupId/exhibits/generate/cover-letter",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Cover letter generation started", caseSetupId });

    generateCoverLetter(caseSetupId, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] generateCoverLetter background error"),
    );
  },
);

// ─── POST /cases/:caseSetupId/exhibits/generate/personal-declaration ──────────

router.post(
  "/cases/:caseSetupId/exhibits/generate/personal-declaration",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Personal declaration generation started", caseSetupId });

    generatePersonalDeclaration(caseSetupId, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] generatePersonalDeclaration background error"),
    );
  },
);

// ─── POST /cases/:caseSetupId/exhibits/generate/field-brief ──────────────────

router.post(
  "/cases/:caseSetupId/exhibits/generate/field-brief",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Field brief generation started", caseSetupId });

    generateFieldBrief(caseSetupId, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] generateFieldBrief background error"),
    );
  },
);

// ─── POST /cases/:caseSetupId/exhibits/generate/recommendation-templates ──────

router.post(
  "/cases/:caseSetupId/exhibits/generate/recommendation-templates",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    res.json({ message: "Recommendation templates generation started", caseSetupId });

    generateRecommendationTemplates(caseSetupId, staffId(req)).catch((err) =>
      logger.error({ caseSetupId, err }, "[caseExhibits] generateRecommendationTemplates background error"),
    );
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// Status & Listing Routes
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /cases/:caseSetupId/exhibits/status ──────────────────────────────────

router.get(
  "/cases/:caseSetupId/exhibits/status",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    const [assessments, exhibitDocs, criteria, pkgRows] = await Promise.all([
      db.select().from(criteriaAssessmentsTable).where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId)),
      db.select().from(exhibitDocumentsTable).where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId)),
      db.select().from(petitionCriteriaExhibitsTable).where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId)),
      db.select().from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, caseSetupId)).limit(1),
    ]);

    const pkg = pkgRows[0] ?? null;

    // Group exhibit documents by documentType
    const docsByType: Record<string, typeof exhibitDocs> = {};
    for (const doc of exhibitDocs) {
      const key = doc.documentType ?? "unknown";
      (docsByType[key] ??= []).push(doc);
    }

    // Readiness calculation
    // Expected: (criteria × 2) + 4 package docs (cover letter, declaration, field brief, reco templates)
    const criteriaCount = criteria.length;
    const expectedItems = (criteriaCount * 2) + 4;

    const completedAssessments = assessments.filter((a) => a.assessedAt != null).length;
    const completedMainExhibits = (docsByType["main_document"] ?? []).length;
    const packageDocsCompleted = [
      pkg?.coverLetterDriveFileId,
      pkg?.personalDeclarationDriveFileId,
      pkg?.fieldBriefDriveFileId,
      pkg?.recoTemplatesStatus === "draft" ? "yes" : null,
    ].filter(Boolean).length;

    const completedItems = completedAssessments + completedMainExhibits + packageDocsCompleted;
    const readinessPercentage = expectedItems > 0
      ? Math.round((completedItems / expectedItems) * 100)
      : 0;

    res.json({
      caseSetupId,
      assessments,
      exhibitDocumentsByType: docsByType,
      exhibitDocumentsTotal: exhibitDocs.length,
      petitionPackage: pkg,
      readiness: {
        percentage: readinessPercentage,
        completedItems,
        expectedItems,
        breakdown: {
          completedAssessments,
          totalCriteria: criteriaCount,
          completedMainExhibits,
          packageDocsCompleted,
        },
      },
    });
  },
);

// ─── GET /cases/:caseSetupId/exhibits ─────────────────────────────────────────
// Dual-auth: staff sees all, client sees only publishedToClient=true documents.

router.get(
  "/cases/:caseSetupId/exhibits",
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    // ── Staff path ────────────────────────────────────────────────────────────
    if (isStaffRequest(req)) {
      const docs = await db
        .select()
        .from(exhibitDocumentsTable)
        .where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId));
      res.json({ exhibits: docs, total: docs.length });
      return;
    }

    // ── Client path — JWT required ────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let profileId: number;
    try {
      const payload = verifyToken(authHeader.slice(7));
      profileId = payload.sub;
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Verify case belongs to this client
    const [caseSetup] = await db
      .select({ profileId: casePetitionSetupTable.profileId })
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.id, caseSetupId))
      .limit(1);

    if (!caseSetup || caseSetup.profileId !== profileId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Verify disclaimer acceptance
    const [profile] = await db
      .select({ disclaimerAccepted: profilesTable.disclaimerAccepted, disclaimerVersion: profilesTable.disclaimerVersion })
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId))
      .limit(1);

    const currentVersion = process.env.CURRENT_DISCLAIMER_VERSION ?? "1.0";
    if (!profile?.disclaimerAccepted || profile.disclaimerVersion !== currentVersion) {
      res.status(403).json({ error: "Disclaimer update required", requiresReconsent: true });
      return;
    }

    const docs = await db
      .select()
      .from(exhibitDocumentsTable)
      .where(
        and(
          eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
          eq(exhibitDocumentsTable.publishedToClient, true),
        ),
      );

    // Strip internal fields before returning to client
    const safeExhibits = docs.map(({ driveFileId: _df, publishedBy: _pb, ...rest }) => rest);
    res.json({ exhibits: safeExhibits, total: safeExhibits.length });
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// Publish / Unpublish
// ═════════════════════════════════════════════════════════════════════════════

// ─── PATCH /cases/:caseSetupId/exhibits/:exhibitId/publish ───────────────────

router.patch(
  "/cases/:caseSetupId/exhibits/:exhibitId/publish",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    const exhibitId = parseCaseId(req.params.exhibitId);
    if (!caseSetupId || !exhibitId) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [updated] = await db
      .update(exhibitDocumentsTable)
      .set({
        publishedToClient: true,
        publishedAt: new Date(),
        publishedBy: staffId(req),
      })
      .where(
        and(
          eq(exhibitDocumentsTable.id, exhibitId),
          eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
        ),
      )
      .returning();

    if (!updated) { res.status(404).json({ error: "Exhibit document not found" }); return; }

    logger.info({ exhibitId, caseSetupId, staffId: staffId(req) }, "[caseExhibits] exhibit published");
    res.json({ success: true, exhibit: updated });
  },
);

// ─── PATCH /cases/:caseSetupId/exhibits/:exhibitId/unpublish ─────────────────

router.patch(
  "/cases/:caseSetupId/exhibits/:exhibitId/unpublish",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    const exhibitId = parseCaseId(req.params.exhibitId);
    if (!caseSetupId || !exhibitId) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [updated] = await db
      .update(exhibitDocumentsTable)
      .set({
        publishedToClient: false,
        publishedAt: null,
        publishedBy: null,
      })
      .where(
        and(
          eq(exhibitDocumentsTable.id, exhibitId),
          eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
        ),
      )
      .returning();

    if (!updated) { res.status(404).json({ error: "Exhibit document not found" }); return; }

    logger.info({ exhibitId, caseSetupId, staffId: staffId(req) }, "[caseExhibits] exhibit unpublished");
    res.json({ success: true, exhibit: updated });
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// Drive-backed Exhibits file manager
//
// The case's "Exhibits" Drive folder is the source of truth. Staff can upload
// from the app or drop files directly in Drive — both surface here. A file is
// "sent to client" when it has an exhibit_documents row with publishedToClient
// = true (keyed by driveFileId); sending also notifies the client.
// ═════════════════════════════════════════════════════════════════════════════

/** Case → profile (id + contact fields for the client notification). */
async function caseProfile(caseSetupId: number) {
  const [row] = await db
    .select({
      profileId: casePetitionSetupTable.profileId,
      email: profilesTable.email,
      name: profilesTable.name,
      firstName: profilesTable.firstName,
    })
    .from(casePetitionSetupTable)
    .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
    .where(eq(casePetitionSetupTable.id, caseSetupId))
    .limit(1);
  return row ?? null;
}

/**
 * Verifies `folderId` is the case's Exhibits root or a descendant of it, by
 * walking up the parent chain (bounded). Prevents writing into unrelated
 * folders when a folderId is supplied by the client.
 */
async function isWithinExhibits(folderId: string, exhibitsRootId: string): Promise<boolean> {
  if (folderId === exhibitsRootId) return true;
  const drive = getDriveClient();
  let current: string | null = folderId;
  for (let depth = 0; depth < 8 && current; depth++) {
    const r = await drive.files.get({ supportsAllDrives: true, fileId: current, fields: "id,parents" });
    const parents: string[] = r.data.parents ?? [];
    if (parents.includes(exhibitsRootId)) return true;
    current = parents[0] ?? null;
  }
  return false;
}

/** Resolves the Exhibits root folder for a case, 400-ing if absent. */
async function resolveExhibitsRoot(caseSetupId: number, res: Response): Promise<string | null> {
  const root = await getCaseDriveFolderId(caseSetupId, "exhibits");
  if (!root) { res.status(400).json({ error: "This case has no Exhibits Drive folder" }); return null; }
  return root;
}

interface CollectedFile { driveFileId: string; name: string; webViewLink: string; folderPath: string }
const EXHIBITS_TREE_MAX_DEPTH = 5;

/** Depth-first collect of every file in the Exhibits folder tree, each tagged
 * with its folder path relative to the Exhibits root ("" = root). */
async function collectExhibitTreeFiles(rootId: string): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  async function walk(folderId: string, path: string, depth: number): Promise<void> {
    const [files, subs] = await Promise.all([
      listDriveFolderFiles(folderId),
      depth < EXHIBITS_TREE_MAX_DEPTH ? listDriveSubfolders(folderId) : Promise.resolve([]),
    ]);
    for (const f of files) out.push({ driveFileId: f.id, name: f.name, webViewLink: f.webViewLink, folderPath: path });
    for (const s of subs) await walk(s.id, path ? `${path}/${s.name}` : s.name, depth + 1);
  }
  await walk(rootId, "", 0);
  return out;
}

/** Files in the Exhibits tree that have NOT yet been sent to the client. */
async function pendingExhibitFiles(caseSetupId: number, rootId: string): Promise<CollectedFile[]> {
  const [collected, publishedRows] = await Promise.all([
    collectExhibitTreeFiles(rootId),
    db
      .select({ driveFileId: exhibitDocumentsTable.driveFileId })
      .from(exhibitDocumentsTable)
      .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.publishedToClient, true))),
  ]);
  const publishedSet = new Set(publishedRows.map((r) => r.driveFileId).filter(Boolean) as string[]);
  return collected.filter((f) => !publishedSet.has(f.driveFileId));
}

// ─── GET /cases/:caseSetupId/exhibits/drive ──────────────────────────────────
// Lists one Drive folder (defaults to the Exhibits root): its subfolders and
// files, each file annotated with its send-to-client state.
router.get(
  "/cases/:caseSetupId/exhibits/drive",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const root = await resolveExhibitsRoot(caseSetupId, res);
    if (!root) return;

    const requested = typeof req.query.folderId === "string" ? req.query.folderId : "";
    const folderId = requested || root;
    if (requested && !(await isWithinExhibits(requested, root))) {
      res.status(403).json({ error: "Folder is outside this case's Exhibits folder" });
      return;
    }

    const [subfolders, files, rows] = await Promise.all([
      listDriveSubfolders(folderId),
      listDriveFolderFiles(folderId),
      db
        .select({
          id: exhibitDocumentsTable.id,
          driveFileId: exhibitDocumentsTable.driveFileId,
          publishedToClient: exhibitDocumentsTable.publishedToClient,
          publishedAt: exhibitDocumentsTable.publishedAt,
        })
        .from(exhibitDocumentsTable)
        .where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId)),
    ]);

    const byDriveId = new Map(rows.filter((r) => r.driveFileId).map((r) => [r.driveFileId as string, r]));

    const annotatedFiles = files.map((f) => {
      const row = byDriveId.get(f.id);
      return {
        driveFileId: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink,
        exhibitId: row?.id ?? null,
        publishedToClient: row?.publishedToClient ?? false,
        publishedAt: row?.publishedAt ?? null,
      };
    });

    res.json({
      root,
      folderId,
      isRoot: folderId === root,
      subfolders: subfolders.map((s) => ({ driveFileId: s.id, name: s.name, webViewLink: s.webViewLink })),
      files: annotatedFiles,
    });
  },
);

// ─── POST /cases/:caseSetupId/exhibits/folder ────────────────────────────────
// Creates a subfolder inside the Exhibits folder (or inside a given subfolder).
const CreateFolderBody = z.object({ name: z.string().min(1).max(200), parentId: z.string().optional() });
router.post(
  "/cases/:caseSetupId/exhibits/folder",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const parsed = CreateFolderBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }
    const root = await resolveExhibitsRoot(caseSetupId, res);
    if (!root) return;

    const parentId = parsed.data.parentId || root;
    if (parentId !== root && !(await isWithinExhibits(parentId, root))) {
      res.status(403).json({ error: "Parent folder is outside this case's Exhibits folder" });
      return;
    }

    const folder = await createDriveFolder(parsed.data.name.trim(), parentId);
    logger.info({ caseSetupId, folderId: folder.driveId, staffId: staffId(req) }, "[caseExhibits] exhibit subfolder created");
    res.status(201).json({ folder: { driveFileId: folder.driveId, name: parsed.data.name.trim(), webViewLink: folder.driveUrl } });
  },
);

// ─── POST /cases/:caseSetupId/exhibits/upload ────────────────────────────────
// Staff uploads a finished exhibit (built offline) into the Exhibits folder or a
// chosen subfolder. The file surfaces in the Drive listing; publish it with
// Send to client.
router.post(
  "/cases/:caseSetupId/exhibits/upload",
  requireStaffAuth,
  uploadMw.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const file = (req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string } }).file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const root = await resolveExhibitsRoot(caseSetupId, res);
    if (!root) return;

    const requested = typeof req.body?.folderId === "string" ? req.body.folderId.trim() : "";
    const folderId = requested || root;
    if (requested && requested !== root && !(await isWithinExhibits(requested, root))) {
      res.status(403).json({ error: "Folder is outside this case's Exhibits folder" });
      return;
    }

    const up = await uploadFileToDrive(
      file.buffer, file.originalname, file.mimetype || "application/octet-stream", folderId, { share: true },
    );
    logger.info({ caseSetupId, driveFileId: up.driveFileId, staffId: staffId(req) }, "[caseExhibits] exhibit uploaded to Drive");
    res.status(201).json({ file: { driveFileId: up.driveFileId, name: file.originalname, webViewLink: up.driveUrl } });
  },
);

// ─── GET /cases/:caseSetupId/exhibits/pending ────────────────────────────────
// Files across the whole Exhibits tree that have not yet been sent to the
// client — drives the case-level "Send to Client" button and its preview.
router.get(
  "/cases/:caseSetupId/exhibits/pending",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const root = await resolveExhibitsRoot(caseSetupId, res);
    if (!root) return;

    const pending = await pendingExhibitFiles(caseSetupId, root);
    res.json({
      count: pending.length,
      files: pending.map((f) => ({ driveFileId: f.driveFileId, name: f.name, folderPath: f.folderPath })),
    });
  },
);

// ─── POST /cases/:caseSetupId/exhibits/send-to-client ────────────────────────
// Case-level batch send. Shares and publishes every not-yet-sent file in the
// Exhibits tree, records the change log, and sends the client ONE notification
// + email that itemizes exactly what is included in this send.
router.post(
  "/cases/:caseSetupId/exhibits/send-to-client",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const root = await resolveExhibitsRoot(caseSetupId, res);
    if (!root) return;

    const prof = await caseProfile(caseSetupId);
    if (!prof) { res.status(404).json({ error: "Case not found" }); return; }

    const pending = await pendingExhibitFiles(caseSetupId, root);
    if (pending.length === 0) {
      res.json({ sent: 0, files: [], message: "Nothing new to send — all files are already shared." });
      return;
    }

    const now = new Date();
    const sid = staffId(req);

    // Existing rows (any publish state) so we upsert rather than duplicate.
    const existingRows = await db
      .select({ id: exhibitDocumentsTable.id, driveFileId: exhibitDocumentsTable.driveFileId })
      .from(exhibitDocumentsTable)
      .where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId));
    const rowByDriveId = new Map(existingRows.filter((r) => r.driveFileId).map((r) => [r.driveFileId as string, r.id]));

    for (const f of pending) {
      try { await shareDriveFile(f.driveFileId); }
      catch (err) { logger.warn({ caseSetupId, driveFileId: f.driveFileId, err }, "[caseExhibits] shareDriveFile failed (continuing)"); }

      const existingId = rowByDriveId.get(f.driveFileId);
      if (existingId) {
        await db.update(exhibitDocumentsTable)
          .set({ publishedToClient: true, publishedAt: now, publishedBy: sid, driveUrl: f.webViewLink || undefined })
          .where(eq(exhibitDocumentsTable.id, existingId));
      } else {
        await db.insert(exhibitDocumentsTable).values({
          caseSetupId, profileId: prof.profileId,
          documentType: "uploaded_exhibit",
          exhibitLabel: f.name,
          fileName: f.name,
          driveFileId: f.driveFileId,
          driveUrl: f.webViewLink ?? "",
          publishedToClient: true,
          publishedAt: now,
          publishedBy: sid,
        });
      }
    }

    // Change log (itemized list of what went out in this send).
    const changeLog = pending.map((f) => ({ name: f.name, folderPath: f.folderPath || "Exhibits" }));
    logActivity({
      profileId: prof.profileId, caseSetupId,
      eventType: "exhibits_sent_to_client", actor: "staff", actorName: sid, category: "exhibits",
      description: `Sent ${changeLog.length} document${changeLog.length !== 1 ? "s" : ""} to client`,
      metadata: { count: changeLog.length, files: changeLog },
    });

    // One notification + one email, itemizing this send.
    const names = changeLog.map((f) => f.name);
    const n = changeLog.length;
    try {
      const summary = names.slice(0, 5).join(", ") + (names.length > 5 ? `, and ${names.length - 5} more` : "");
      await db.insert(notificationsTable).values({
        profileId: prof.profileId, userType: "client", caseSetupId,
        notificationType: "exhibit_shared",
        title: `${n} new document${n !== 1 ? "s" : ""} shared with you`,
        message: `${n} document${n !== 1 ? "s" : ""} added to your Exhibits: ${summary}`,
        link: "/evidence", status: "unread", priority: "medium",
      });

      const appUrl = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
      const listHtml = changeLog
        .map((f) => `<li>${escapeHtml(f.name)}${f.folderPath && f.folderPath !== "Exhibits" ? ` <span style="color:#6b7280">— ${escapeHtml(f.folderPath)}</span>` : ""}</li>`)
        .join("");
      const listText = changeLog
        .map((f) => `• ${f.name}${f.folderPath && f.folderPath !== "Exhibits" ? ` — ${f.folderPath}` : ""}`)
        .join("\n");
      await sendEmail(prof.email, {
        subject: `${n} new document${n !== 1 ? "s" : ""} ready to view`,
        html: `<p>Hi ${escapeHtml(prof.firstName ?? prof.name ?? "there")},</p>`
          + `<p>The following ${n === 1 ? "document has" : `${n} documents have`} been shared with you and ${n === 1 ? "is" : "are"} now available in your Pinnacle³ portal:</p>`
          + `<ul>${listHtml}</ul>`
          + `<p><a href="${appUrl}/evidence">View your exhibits</a></p>`,
        text: `The following ${n === 1 ? "document has" : `${n} documents have`} been shared with you:\n\n${listText}\n\nView your exhibits: ${appUrl}/evidence`,
      });
    } catch (err) {
      logger.error({ caseSetupId, err }, "[caseExhibits] batch client notification failed");
    }

    logger.info({ caseSetupId, sent: n, staffId: sid }, "[caseExhibits] exhibits batch sent to client");
    res.json({ sent: n, files: changeLog });
  },
);

// ─── POST /cases/:caseSetupId/exhibits/recall ────────────────────────────────
// Un-shares a previously sent exhibit from the client's portal (Drive file is
// left in place; only publishedToClient is cleared).
const RecallBody = z.object({ driveFileId: z.string().min(1) });
router.post(
  "/cases/:caseSetupId/exhibits/recall",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseCaseId(req.params.caseSetupId);
    if (!caseSetupId) { res.status(400).json({ error: "Invalid caseId" }); return; }
    const parsed = RecallBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

    const [updated] = await db
      .update(exhibitDocumentsTable)
      .set({ publishedToClient: false, publishedAt: null, publishedBy: null })
      .where(and(
        eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
        eq(exhibitDocumentsTable.driveFileId, parsed.data.driveFileId),
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: "Exhibit not found" }); return; }
    logger.info({ caseSetupId, driveFileId: parsed.data.driveFileId, staffId: staffId(req) }, "[caseExhibits] exhibit recalled");
    res.json({ success: true, exhibit: updated });
  },
);

export default router;
