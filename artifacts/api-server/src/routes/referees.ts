/**
 * referees.ts — Pinnacle³
 *
 * Reference Letter module — referee intake (Step 1).
 *
 * Dual-auth (X-Staff-Token OR client Bearer JWT), following the caseFolders
 * precedent. Clients are scoped to their own case; staff may act on any case.
 *
 * GET    /cases/:caseId/referees        — list referees (+ contributions, names)
 * POST   /cases/:caseId/referees        — create a referee (+ contributions)
 * PUT    /referees/:id                  — update; upsert contributions
 * DELETE /referees/:id                  — delete (cascades contributions + CV row)
 * POST   /referees/:id/cv               — upload CV PDF to the case's Drive folder
 * GET    /lookups/degree-types
 * GET    /lookups/contribution-types
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, and, desc, inArray, notInArray, asc } from "drizzle-orm";
import { Readable } from "stream";
import multer from "multer";
import { z } from "zod/v4";
import {
  db,
  refereesTable,
  refereeContributionsTable,
  degreeTypesTable,
  contributionTypesTable,
  casePetitionSetupTable,
  caseFoldersTable,
} from "@workspace/db";
import { getDriveClient, createDriveFolder } from "../services/driveService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const CV_FOLDER_NAME = "Referee CVs";

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

/** Loads a referee and authorizes the caller against its case. */
async function loadAuthorizedReferee(
  req: AugmentedRequest,
  res: Response,
  refereeId: number,
): Promise<typeof refereesTable.$inferSelect | null> {
  if (isNaN(refereeId)) {
    res.status(400).json({ error: "Invalid referee id" });
    return null;
  }
  const [referee] = await db
    .select()
    .from(refereesTable)
    .where(eq(refereesTable.id, refereeId))
    .limit(1);

  if (!referee) {
    res.status(404).json({ error: "Referee not found" });
    return null;
  }
  const caseRecord = await authorizeCase(req, res, referee.caseId);
  if (!caseRecord) return null; // authorizeCase already sent the response
  return referee;
}

function actorRole(req: AugmentedRequest): "client" | "staff" {
  return req.staffUser && !req.clientUser ? "staff" : "client";
}

// ─── Validation (shared by every write path) ────────────────────────────────────

const ContributionInput = z.object({
  contributionTypeId: z.number().int().positive(),
  details: z.string().trim().min(1, "Details are required for each selected contribution"),
});

const RefereeInput = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  title: z.string().trim().min(1, "Title is required"),
  organization: z.string().trim().min(1, "Organization is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().nullish(),
  country: z.string().trim().nullish(),
  degreeTypeId: z.number().int().positive().nullish(),
  fieldOfExpertise: z.string().trim().nullish(),
  profileUrl: z.string().trim().nullish(),
  willingnessConfirmed: z.boolean().optional().default(false),
  workedTogether: z.boolean().optional().default(false),
  contributions: z.array(ContributionInput).optional().default([]),
});

type RefereeInputType = z.infer<typeof RefereeInput>;

// ─── Serialization ──────────────────────────────────────────────────────────────
// Attaches degree name + contributions (with type names) to a set of referees.

async function withRelations(referees: (typeof refereesTable.$inferSelect)[]) {
  if (referees.length === 0) return [];

  const refereeIds = referees.map((r) => r.id);

  const contributions = await db
    .select({
      id: refereeContributionsTable.id,
      refereeId: refereeContributionsTable.refereeId,
      contributionTypeId: refereeContributionsTable.contributionTypeId,
      details: refereeContributionsTable.details,
      contributionTypeName: contributionTypesTable.name,
    })
    .from(refereeContributionsTable)
    .leftJoin(
      contributionTypesTable,
      eq(refereeContributionsTable.contributionTypeId, contributionTypesTable.id),
    )
    .where(inArray(refereeContributionsTable.refereeId, refereeIds));

  const degrees = await db.select().from(degreeTypesTable);
  const degreeName = new Map(degrees.map((d) => [d.id, d.name]));

  return referees.map((r) => ({
    ...r,
    degreeName: r.degreeTypeId != null ? degreeName.get(r.degreeTypeId) ?? null : null,
    contributions: contributions.filter((c) => c.refereeId === r.id),
  }));
}

// Persists the contribution set: upserts provided rows, deletes any that were
// unchecked (i.e. no longer present in the payload).
async function syncContributions(
  refereeId: number,
  contributions: RefereeInputType["contributions"],
): Promise<void> {
  for (const c of contributions) {
    await db
      .insert(refereeContributionsTable)
      .values({ refereeId, contributionTypeId: c.contributionTypeId, details: c.details })
      .onConflictDoUpdate({
        target: [refereeContributionsTable.refereeId, refereeContributionsTable.contributionTypeId],
        set: { details: c.details },
      });
  }

  const keepTypeIds = contributions.map((c) => c.contributionTypeId);
  if (keepTypeIds.length > 0) {
    await db
      .delete(refereeContributionsTable)
      .where(
        and(
          eq(refereeContributionsTable.refereeId, refereeId),
          notInArray(refereeContributionsTable.contributionTypeId, keepTypeIds),
        ),
      );
  } else {
    await db.delete(refereeContributionsTable).where(eq(refereeContributionsTable.refereeId, refereeId));
  }
}

// ─── Lookups ────────────────────────────────────────────────────────────────────

router.get("/lookups/degree-types", requireAnyAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(degreeTypesTable)
    .where(eq(degreeTypesTable.isActive, true))
    .orderBy(asc(degreeTypesTable.sortOrder));
  res.json({ degreeTypes: rows });
});

router.get("/lookups/contribution-types", requireAnyAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(contributionTypesTable)
    .where(eq(contributionTypesTable.isActive, true))
    .orderBy(asc(contributionTypesTable.sortOrder));
  res.json({ contributionTypes: rows });
});

// ─── List ───────────────────────────────────────────────────────────────────────

router.get(
  "/cases/:caseId/referees",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const referees = await db
      .select()
      .from(refereesTable)
      .where(eq(refereesTable.caseId, caseId))
      .orderBy(desc(refereesTable.createdAt));

    res.json({ referees: await withRelations(referees) });
  },
);

// ─── Create ───────────────────────────────────────────────────────────────────

router.post(
  "/cases/:caseId/referees",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const parsed = RefereeInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }
    const data = parsed.data;

    const [referee] = await db
      .insert(refereesTable)
      .values({
        caseId,
        fullName: data.fullName,
        title: data.title,
        organization: data.organization,
        email: data.email,
        phone: data.phone ?? null,
        country: data.country ?? null,
        degreeTypeId: data.degreeTypeId ?? null,
        fieldOfExpertise: data.fieldOfExpertise ?? null,
        profileUrl: data.profileUrl ?? null,
        willingnessConfirmed: data.willingnessConfirmed,
        workedTogether: data.workedTogether,
        createdBy: actorRole(aug),
      })
      .returning();

    await syncContributions(referee.id, data.contributions);

    logger.info({ caseId, refereeId: referee.id, by: actorRole(aug) }, "[referees] created");
    const [withRels] = await withRelations([referee]);
    res.status(201).json({ referee: withRels });
  },
);

// ─── Update (+ contribution upsert) ─────────────────────────────────────────────

router.put(
  "/referees/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const existing = await loadAuthorizedReferee(aug, res, refereeId);
    if (!existing) return;

    const parsed = RefereeInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }
    const data = parsed.data;

    const [updated] = await db
      .update(refereesTable)
      .set({
        fullName: data.fullName,
        title: data.title,
        organization: data.organization,
        email: data.email,
        phone: data.phone ?? null,
        country: data.country ?? null,
        degreeTypeId: data.degreeTypeId ?? null,
        fieldOfExpertise: data.fieldOfExpertise ?? null,
        profileUrl: data.profileUrl ?? null,
        willingnessConfirmed: data.willingnessConfirmed,
        workedTogether: data.workedTogether,
        updatedAt: new Date(),
      })
      .where(eq(refereesTable.id, refereeId))
      .returning();

    await syncContributions(refereeId, data.contributions);

    logger.info({ refereeId, by: actorRole(aug) }, "[referees] updated");
    const [withRels] = await withRelations([updated]);
    res.json({ referee: withRels });
  },
);

// ─── Delete ─────────────────────────────────────────────────────────────────────

router.delete(
  "/referees/:id",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const existing = await loadAuthorizedReferee(aug, res, refereeId);
    if (!existing) return;

    // referee_contributions cascade-delete via FK
    await db.delete(refereesTable).where(eq(refereesTable.id, refereeId));
    logger.info({ refereeId, by: actorRole(aug) }, "[referees] deleted");
    res.json({ ok: true });
  },
);

// ─── CV upload ──────────────────────────────────────────────────────────────────

router.post(
  "/referees/:id/cv",
  requireAnyAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "CV must be a PDF" });
      return;
    }

    // Resolve the case's root Drive folder.
    const [rootFolder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.caseId, referee.caseId), eq(caseFoldersTable.folderType, "root")))
      .limit(1);

    if (!rootFolder) {
      res.status(409).json({ error: "This case has no Drive folder set up yet" });
      return;
    }

    // Find or create the per-case "Referee CVs" subfolder.
    let [cvFolder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.caseId, referee.caseId), eq(caseFoldersTable.name, CV_FOLDER_NAME)))
      .limit(1);

    if (!cvFolder) {
      const created = await createDriveFolder(CV_FOLDER_NAME, rootFolder.driveId);
      [cvFolder] = await db
        .insert(caseFoldersTable)
        .values({
          caseId: referee.caseId,
          name: CV_FOLDER_NAME,
          folderType: "custom",
          parentFolderId: rootFolder.id,
          driveId: created.driveId,
          driveUrl: created.driveUrl,
          visaCategory: rootFolder.visaCategory,
          staffOnly: false,
        })
        .returning();
    }

    // Upload the CV into the subfolder.
    const drive = getDriveClient();
    const driveRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `${referee.fullName} — CV.pdf`,
        parents: [cvFolder.driveId],
      },
      media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
      fields: "id,webViewLink",
    });

    const cvDriveFileId = driveRes.data.id;
    if (!cvDriveFileId) {
      res.status(502).json({ error: "Drive upload returned incomplete data" });
      return;
    }

    const [updated] = await db
      .update(refereesTable)
      .set({ cvDriveFileId, updatedAt: new Date() })
      .where(eq(refereesTable.id, refereeId))
      .returning();

    logger.info({ refereeId, cvDriveFileId, by: actorRole(aug) }, "[referees] CV uploaded");
    res.status(201).json({
      cvDriveFileId,
      cvDriveUrl: driveRes.data.webViewLink ?? null,
      referee: updated,
    });
  },
);

export default router;
