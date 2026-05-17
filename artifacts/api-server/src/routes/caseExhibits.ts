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

export default router;
