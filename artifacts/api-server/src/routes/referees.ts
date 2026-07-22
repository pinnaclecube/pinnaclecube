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
import { eq, and, desc, inArray, notInArray, asc, sql } from "drizzle-orm";
import { Readable } from "stream";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod/v4";
import {
  db,
  refereesTable,
  refereeContributionsTable,
  degreeTypesTable,
  contributionTypesTable,
  casePetitionSetupTable,
  caseFoldersTable,
  referenceLettersTable,
  profilesTable,
} from "@workspace/db";
import { getDriveClient, createDriveFolder, downloadDriveFile } from "../services/driveService";
import {
  sendEmail,
  referenceLetterReviewEmail,
  referenceLetterConfirmedStaffEmail,
} from "../services/emailService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const CV_FOLDER_NAME = "Referee CVs";
const LETTER_FOLDER_NAME = "Reference Letters";

const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
const SUPPORT_EMAIL = "support@pinnaclecube.com";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

// Blocks edits once a referee is locked (client confirmed its reference letter).
// Applies to BOTH portals — staff must explicitly unlock first, no silent bypass.
function assertNotLocked(
  referee: typeof refereesTable.$inferSelect,
  res: Response,
): boolean {
  if (referee.isLocked) {
    res.status(403).json({
      error: "This referee is locked because the reference letter was confirmed. Unlock it first to make changes.",
      locked: true,
    });
    return false;
  }
  return true;
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

  // Active reference letter (if any) per referee — rides along so both UIs can
  // render letter status + lock state without an extra call.
  const letters = await db
    .select()
    .from(referenceLettersTable)
    .where(
      and(
        inArray(referenceLettersTable.refereeId, refereeIds),
        eq(referenceLettersTable.isActive, true),
      ),
    );
  const letterByReferee = new Map(letters.map((l) => [l.refereeId, l]));

  return referees.map((r) => ({
    ...r,
    degreeName: r.degreeTypeId != null ? degreeName.get(r.degreeTypeId) ?? null : null,
    contributions: contributions.filter((c) => c.refereeId === r.id),
    activeLetter: letterByReferee.get(r.id) ?? null,
  }));
}

// Finds (or creates) a named per-case Drive subfolder under the case root,
// registering it in case_folders. Returns its Drive folder id, or null if the
// case has no Drive root yet. Reused by CV and reference-letter uploads.
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

// Resolves the case owner's email, first name, and full name (for emails).
async function getCaseClient(
  caseId: number,
): Promise<{ email: string; firstName: string; name: string } | null> {
  const [row] = await db
    .select({
      email: profilesTable.email,
      firstName: profilesTable.firstName,
      name: profilesTable.name,
    })
    .from(casePetitionSetupTable)
    .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
    .where(eq(casePetitionSetupTable.id, caseId))
    .limit(1);
  if (!row) return null;
  const firstName = row.firstName ?? row.name?.split(" ")[0] ?? "there";
  return { email: row.email, firstName, name: row.name ?? firstName };
}

// Sends the client review email for a referee's active letter. Fire-and-forget
// friendly: returns a warning string on failure instead of throwing.
async function sendReviewEmail(
  referee: typeof refereesTable.$inferSelect,
): Promise<string | null> {
  const client = await getCaseClient(referee.caseId);
  if (!client) return "Could not resolve the client's email — review email not sent.";
  try {
    await sendEmail(
      client.email,
      referenceLetterReviewEmail(client.firstName, {
        fullName: referee.fullName,
        title: referee.title,
        organization: referee.organization,
      }),
    );
    return null;
  } catch (err) {
    logger.error({ err, refereeId: referee.id }, "[referees] review email failed");
    return "The letter was saved, but the review email could not be sent. Use 'Resend review email'.";
  }
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

// ─── Export all referees for a case to Excel (staff only) ───────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
}

function letterStatusLabel(
  referee: { isLocked?: boolean | null; activeLetter?: { status?: string } | null },
): string {
  if (referee.isLocked) return "Confirmed & locked";
  const status = referee.activeLetter?.status;
  if (status === "pending_review") return "Pending client review";
  if (status === "confirmed") return "Confirmed";
  if (referee.activeLetter) return status ?? "Uploaded";
  return "No letter";
}

router.get(
  "/cases/:caseId/referees/export",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const rows = await db
      .select()
      .from(refereesTable)
      .where(eq(refereesTable.caseId, caseId))
      .orderBy(desc(refereesTable.createdAt));
    const referees = await withRelations(rows);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Pinnacle³";
    const sheet = workbook.addWorksheet("Referees");

    sheet.columns = [
      { header: "Full Name", key: "fullName", width: 24 },
      { header: "Title", key: "title", width: 22 },
      { header: "Organization", key: "organization", width: 26 },
      { header: "Email", key: "email", width: 26 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Country", key: "country", width: 16 },
      { header: "Highest Degree", key: "degree", width: 16 },
      { header: "Field of Expertise", key: "field", width: 22 },
      { header: "Profile URL", key: "profileUrl", width: 30 },
      { header: "Willingness Confirmed", key: "willing", width: 20 },
      { header: "Worked Together", key: "worked", width: 16 },
      { header: "Added By", key: "addedBy", width: 12 },
      { header: "CV Uploaded", key: "cv", width: 12 },
      { header: "CV Link", key: "cvLink", width: 30 },
      { header: "Contributions", key: "contributions", width: 50 },
      { header: "Reference Letter Status", key: "letterStatus", width: 22 },
      { header: "Letter Version", key: "letterVersion", width: 14 },
      { header: "Letter Link", key: "letterLink", width: 30 },
      { header: "Letter Uploaded At", key: "letterUploadedAt", width: 22 },
      { header: "Letter Confirmed At", key: "letterConfirmedAt", width: 22 },
      { header: "Locked", key: "locked", width: 10 },
      { header: "Locked At", key: "lockedAt", width: 22 },
      { header: "Unlocked At", key: "unlockedAt", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const r of referees) {
      const letter = r.activeLetter;
      const contributions = r.contributions
        .map((c) => `${c.contributionTypeName ?? `#${c.contributionTypeId}`}: ${c.details}`)
        .join("\n");
      sheet.addRow({
        fullName: r.fullName,
        title: r.title,
        organization: r.organization,
        email: r.email,
        phone: r.phone ?? "",
        country: r.country ?? "",
        degree: r.degreeName ?? "",
        field: r.fieldOfExpertise ?? "",
        profileUrl: r.profileUrl ?? "",
        willing: r.willingnessConfirmed ? "Yes" : "No",
        worked: r.workedTogether ? "Yes" : "No",
        addedBy: r.createdBy,
        cv: r.cvDriveFileId ? "Yes" : "No",
        cvLink: r.cvDriveFileId ? `https://drive.google.com/file/d/${r.cvDriveFileId}/view` : "",
        contributions,
        letterStatus: letterStatusLabel(r),
        letterVersion: letter ? letter.version : "",
        letterLink: letter
          ? letter.driveUrl ?? `https://drive.google.com/file/d/${letter.driveFileId}/view`
          : "",
        letterUploadedAt: fmtDate(letter?.uploadedByStaffAt),
        letterConfirmedAt: fmtDate(letter?.confirmedAt),
        locked: r.isLocked ? "Yes" : "No",
        lockedAt: fmtDate(r.lockedAt),
        unlockedAt: fmtDate(r.unlockedAt),
        createdAt: fmtDate(r.createdAt),
      });
    }
    sheet.getColumn("contributions").alignment = { wrapText: true, vertical: "top" };

    const client = await getCaseClient(caseId);
    const safeName = (client?.name ?? `Case ${caseId}`).replace(/[^\w .-]/g, "").trim() || `Case ${caseId}`;
    const fileName = `Referees — ${safeName}.xlsx`;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName.replace(/"/g, "")}"`,
    );
    logger.info({ caseId, count: referees.length, by: actorRole(aug) }, "[referees] exported to Excel");
    res.end(buffer);
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
    if (!assertNotLocked(existing, res)) return;

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
    if (!assertNotLocked(existing, res)) return;

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
    if (!assertNotLocked(referee, res)) return;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "CV must be a PDF" });
      return;
    }

    // Find (or create) the per-case "Referee CVs" subfolder.
    const cvFolderDriveId = await getOrCreateCaseSubfolder(referee.caseId, CV_FOLDER_NAME);
    if (!cvFolderDriveId) {
      res.status(409).json({ error: "This case has no Drive folder set up yet" });
      return;
    }

    // Upload the CV into the subfolder.
    const drive = getDriveClient();
    const driveRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `${referee.fullName} — CV.pdf`,
        parents: [cvFolderDriveId],
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

// ─── Client (or staff): download the active reference letter ────────────────────

router.get(
  "/referees/:id/letter/download",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const [letter] = await db
      .select()
      .from(referenceLettersTable)
      .where(
        and(
          eq(referenceLettersTable.refereeId, refereeId),
          eq(referenceLettersTable.isActive, true),
        ),
      )
      .limit(1);
    if (!letter) {
      res.status(404).json({ error: "No reference letter available for this referee" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await downloadDriveFile(letter.driveFileId);
    } catch (err) {
      logger.error({ err, refereeId, letterId: letter.id }, "[referees] letter download failed");
      res.status(502).json({ error: "Could not retrieve the letter from storage" });
      return;
    }

    const fileName = letter.fileName ?? `${referee.fullName} — Reference Letter`;
    const isDocx = fileName.toLowerCase().endsWith(".docx");
    res.setHeader("Content-Type", isDocx ? DOCX_MIME : "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName.replace(/"/g, "")}"`,
    );
    res.end(buffer);
  },
);

// ─── Client: confirm the active reference letter (locks referee + letter) ───────

router.post(
  "/referees/:id/letter/confirm",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const [letter] = await db
      .select()
      .from(referenceLettersTable)
      .where(
        and(
          eq(referenceLettersTable.refereeId, refereeId),
          eq(referenceLettersTable.isActive, true),
        ),
      )
      .limit(1);
    if (!letter) {
      res.status(404).json({ error: "No reference letter to confirm for this referee" });
      return;
    }
    if (letter.status !== "pending_review") {
      res.status(409).json({ error: "This reference letter has already been confirmed" });
      return;
    }

    const confirmedAt = new Date();
    // Atomic: mark the letter confirmed AND lock the referee together.
    const updatedLetter = await db.transaction(async (tx) => {
      const [l] = await tx
        .update(referenceLettersTable)
        .set({ status: "confirmed", confirmedAt, updatedAt: confirmedAt })
        .where(eq(referenceLettersTable.id, letter.id))
        .returning();
      await tx
        .update(refereesTable)
        .set({ isLocked: true, lockedAt: confirmedAt, updatedAt: confirmedAt })
        .where(eq(refereesTable.id, refereeId));
      return l;
    });

    // Notify staff (support inbox) — non-fatal: never rolls back the confirmation.
    try {
      const [caseRow] = await db
        .select({ profileId: casePetitionSetupTable.profileId })
        .from(casePetitionSetupTable)
        .where(eq(casePetitionSetupTable.id, referee.caseId))
        .limit(1);
      const client = await getCaseClient(referee.caseId);
      const caseRef = client?.name ?? `Case #${referee.caseId}`;
      const caseUrl = caseRow
        ? `${APP_URL}/internal/case/${caseRow.profileId}`
        : `${APP_URL}/internal/cases`;
      await sendEmail(
        SUPPORT_EMAIL,
        referenceLetterConfirmedStaffEmail(
          caseRef,
          {
            fullName: referee.fullName,
            title: referee.title,
            organization: referee.organization,
          },
          { version: updatedLetter.version, confirmedAt },
          caseUrl,
        ),
      );
    } catch (err) {
      logger.error({ err, refereeId }, "[referees] confirmation staff email failed");
    }

    logger.info({ refereeId, letterId: letter.id }, "[referees] reference letter confirmed + locked");
    const [fresh] = await db
      .select()
      .from(refereesTable)
      .where(eq(refereesTable.id, refereeId))
      .limit(1);
    const [withRels] = await withRelations([fresh]);
    res.json({ referee: withRels });
  },
);

// ─── Staff: upload a reference letter (PDF/DOCX) ────────────────────────────────

router.post(
  "/referees/:id/letter",
  requireStaffAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;
    if (!assertNotLocked(referee, res)) return;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (file.mimetype !== "application/pdf" && file.mimetype !== DOCX_MIME) {
      res.status(400).json({ error: "Reference letter must be a PDF or DOCX" });
      return;
    }

    const folderDriveId = await getOrCreateCaseSubfolder(referee.caseId, LETTER_FOLDER_NAME);
    if (!folderDriveId) {
      res.status(409).json({ error: "This case has no Drive folder set up yet" });
      return;
    }

    const ext = file.mimetype === "application/pdf" ? "pdf" : "docx";
    const fileName = `${referee.fullName} — Reference Letter.${ext}`;

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

    // Deactivate any prior active letter and insert the new one (version + 1).
    const letter = await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ maxV: sql<number>`coalesce(max(${referenceLettersTable.version}), 0)` })
        .from(referenceLettersTable)
        .where(eq(referenceLettersTable.refereeId, refereeId));
      const nextVersion = (maxRow?.maxV ?? 0) + 1;

      await tx
        .update(referenceLettersTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(referenceLettersTable.refereeId, refereeId),
            eq(referenceLettersTable.isActive, true),
          ),
        );

      const [inserted] = await tx
        .insert(referenceLettersTable)
        .values({
          refereeId,
          driveFileId,
          driveUrl: driveRes.data.webViewLink ?? null,
          fileName,
          version: nextVersion,
          status: "pending_review",
          isActive: true,
          uploadedByStaffAt: new Date(),
        })
        .returning();
      return inserted;
    });

    // Trigger the client review email — non-fatal (upload still succeeds).
    const warning = await sendReviewEmail(referee);

    logger.info(
      { refereeId, letterId: letter.id, version: letter.version },
      "[referees] reference letter uploaded",
    );
    res.status(201).json({ letter, warning });
  },
);

// ─── Staff: resend the client review email for the active pending letter ────────

router.post(
  "/referees/:id/letter/resend-email",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const [letter] = await db
      .select()
      .from(referenceLettersTable)
      .where(
        and(
          eq(referenceLettersTable.refereeId, refereeId),
          eq(referenceLettersTable.isActive, true),
          eq(referenceLettersTable.status, "pending_review"),
        ),
      )
      .limit(1);
    if (!letter) {
      res.status(404).json({ error: "No pending letter to resend for this referee" });
      return;
    }

    const warning = await sendReviewEmail(referee);
    res.json({ ok: !warning, warning });
  },
);

// ─── Staff: unlock a referee (re-opens edits, requires client re-confirm) ────────

router.post(
  "/referees/:id/unlock",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    await db.transaction(async (tx) => {
      await tx
        .update(refereesTable)
        .set({ isLocked: false, unlockedAt: new Date(), updatedAt: new Date() })
        .where(eq(refereesTable.id, refereeId));
      // Active letter returns to pending review; client must re-confirm.
      await tx
        .update(referenceLettersTable)
        .set({ status: "pending_review", confirmedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(referenceLettersTable.refereeId, refereeId),
            eq(referenceLettersTable.isActive, true),
          ),
        );
    });

    const [updated] = await db
      .select()
      .from(refereesTable)
      .where(eq(refereesTable.id, refereeId))
      .limit(1);
    logger.info({ refereeId, by: actorRole(aug) }, "[referees] referee unlocked");
    const [withRels] = await withRelations([updated]);
    res.json({ referee: withRels });
  },
);

export default router;
