/**
 * caseFolders.ts — Pinnacle³
 *
 * In-app Drive folder and file management for both clients and staff.
 *
 * GET   /cases/me                              — client: resolve their own case
 * GET   /cases/:caseId/folders                 — list folders (client: excludes staffOnly)
 * POST  /cases/:caseId/folders                 — create a subfolder in Drive
 * PATCH /cases/:caseId/folders/:folderId       — update folder (staff only: toggle staffOnly)
 * GET   /cases/:caseId/folders/:folderId/files — list files in a folder (from DB)
 * POST  /cases/:caseId/folders/:folderId/files — upload a file to Drive + DB
 *
 * Auth: X-Staff-Token (staff) OR Bearer JWT (client).
 * Client routes enforce that the case belongs to the authenticated profile.
 * Staff-only folders are filtered out of client responses.
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { Readable } from "stream";
import multer from "multer";
import {
  db,
  caseFoldersTable,
  caseFolderItemsTable,
  casePetitionSetupTable,
} from "@workspace/db";
import { getDriveClient } from "../services/driveService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) {
    requireStaffAuth(req, res, next);
  } else {
    void requireClientAuth(req, res, next);
  }
}

// ─── Case access guard ────────────────────────────────────────────────────────

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

// ─── GET /cases/me ────────────────────────────────────────────────────────────
// Resolves the authenticated client's case setup ID.
// Must be declared BEFORE /cases/:caseId/* to prevent "me" matching as a param.

router.get("/cases/me", requireClientAuth, async (req: Request, res: Response): Promise<void> => {
  const clientUser = (req as AugmentedRequest).clientUser!;

  const [caseRecord] = await db
    .select({ id: casePetitionSetupTable.id, visaPath: casePetitionSetupTable.visaPath })
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.profileId, clientUser.id))
    .limit(1);

  if (!caseRecord) {
    res.status(404).json({ error: "No case found for this account" });
    return;
  }

  res.json({ caseId: caseRecord.id, visaPath: caseRecord.visaPath });
});

// ─── GET /cases/:caseId/folders ───────────────────────────────────────────────
// Returns the full flat folder list for a case.
// Client users have staffOnly=true folders filtered out server-side.

router.get(
  "/cases/:caseId/folders",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const isClient = !!aug.clientUser;
    const conditions = [eq(caseFoldersTable.caseId, caseId)];
    if (isClient) {
      conditions.push(eq(caseFoldersTable.staffOnly, false));
    }

    const folders = await db
      .select()
      .from(caseFoldersTable)
      .where(and(...conditions));

    res.json({ folders });
  },
);

// ─── POST /cases/:caseId/folders ──────────────────────────────────────────────
// Creates a subfolder inside a parent Drive folder and saves to DB.
// Only staff may set staffOnly=true on a new folder.

router.post(
  "/cases/:caseId/folders",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const { parentFolderId, name, staffOnly } = req.body as {
      parentFolderId?: number;
      name?: string;
      staffOnly?: boolean;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!parentFolderId) {
      res.status(400).json({ error: "parentFolderId is required" });
      return;
    }

    // Verify parent folder belongs to this case
    const [parent] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.id, parentFolderId), eq(caseFoldersTable.caseId, caseId)))
      .limit(1);

    if (!parent) {
      res.status(404).json({ error: "Parent folder not found in this case" });
      return;
    }

    // Only staff may create staff-only folders
    const isStaffReq = !!aug.staffUser;
    const folderStaffOnly = isStaffReq && !!staffOnly;

    logger.info({ caseId, parentFolderId, name, staffOnly: folderStaffOnly }, "[caseFolders] creating subfolder");

    const drive = getDriveClient();
    const driveRes = await drive.files.create({
      requestBody: {
        name: name.trim(),
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent.driveId],
      },
      fields: "id,webViewLink",
    });

    const driveId = driveRes.data.id;
    const driveUrl = driveRes.data.webViewLink;

    if (!driveId || !driveUrl) {
      res.status(502).json({ error: "Drive folder creation returned incomplete data" });
      return;
    }

    const [newFolder] = await db
      .insert(caseFoldersTable)
      .values({
        caseId,
        name: name.trim(),
        folderType: "custom",
        parentFolderId,
        driveId,
        driveUrl,
        visaCategory: parent.visaCategory,
        criteriaIndex: null,
        staffOnly: folderStaffOnly,
      })
      .returning();

    logger.info({ caseId, folderId: newFolder.id, driveId }, "[caseFolders] subfolder created");
    res.status(201).json({ folder: newFolder });
  },
);

// ─── PATCH /cases/:caseId/folders/:folderId ───────────────────────────────────
// Staff-only endpoint to update folder metadata (e.g. toggle staffOnly).

router.patch(
  "/cases/:caseId/folders/:folderId",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const folderId = parseInt(req.params.folderId as string, 10);

    if (isNaN(caseId) || isNaN(folderId)) {
      res.status(400).json({ error: "Invalid caseId or folderId" });
      return;
    }

    const [folder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.id, folderId), eq(caseFoldersTable.caseId, caseId)))
      .limit(1);

    if (!folder) {
      res.status(404).json({ error: "Folder not found in this case" });
      return;
    }

    if (folder.folderType === "root") {
      res.status(400).json({ error: "Cannot modify the root folder" });
      return;
    }

    const { staffOnly } = req.body as { staffOnly?: boolean };

    const [updated] = await db
      .update(caseFoldersTable)
      .set({ staffOnly: !!staffOnly })
      .where(eq(caseFoldersTable.id, folderId))
      .returning();

    logger.info({ caseId, folderId, staffOnly: updated.staffOnly }, "[caseFolders] folder updated");
    res.json({ folder: updated });
  },
);

// ─── GET /cases/:caseId/folders/:folderId/files ───────────────────────────────
// Returns all items in a folder, read directly from the DB (not Drive API).

router.get(
  "/cases/:caseId/folders/:folderId/files",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const folderId = parseInt(req.params.folderId as string, 10);

    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    if (isNaN(folderId)) {
      res.status(400).json({ error: "Invalid folderId" });
      return;
    }

    const folderConditions = [
      eq(caseFoldersTable.id, folderId),
      eq(caseFoldersTable.caseId, caseId),
    ];
    // Clients cannot access staff-only folders
    if (aug.clientUser) {
      folderConditions.push(eq(caseFoldersTable.staffOnly, false));
    }

    const [folder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(...folderConditions))
      .limit(1);

    if (!folder) {
      res.status(404).json({ error: "Folder not found in this case" });
      return;
    }

    const items = await db
      .select()
      .from(caseFolderItemsTable)
      .where(eq(caseFolderItemsTable.caseFolderId, folderId));

    res.json({ items });
  },
);

// ─── POST /cases/:caseId/folders/:folderId/files ──────────────────────────────
// Uploads a file to Drive and records it in case_folder_items.
// Captures who uploaded the file (client name or "Staff") for audit trail.

router.post(
  "/cases/:caseId/folders/:folderId/files",
  requireAnyAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const folderId = parseInt(req.params.folderId as string, 10);

    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    if (isNaN(folderId)) {
      res.status(400).json({ error: "Invalid folderId" });
      return;
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const [folder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.id, folderId), eq(caseFoldersTable.caseId, caseId)))
      .limit(1);

    if (!folder) {
      res.status(404).json({ error: "Folder not found in this case" });
      return;
    }

    // Capture uploader identity for audit trail.
    // source: "staff" when a staff member uploads on behalf of a client,
    //         "app"   when the client uploads themselves.
    const isStaffUpload = !!aug.staffUser && !aug.clientUser;
    const addedBySource = isStaffUpload ? "staff" : "app";
    const addedByProfileId = aug.clientUser?.id ?? null;
    const addedByLabel = aug.clientUser?.name ?? (aug.staffUser ? "Staff" : null);

    logger.info(
      { caseId, folderId, filename: file.originalname, size: file.size, addedByLabel },
      "[caseFolders] uploading file to Drive",
    );

    const drive = getDriveClient();
    const driveRes = await drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: [folder.driveId],
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: "id,webViewLink,name,mimeType",
    });

    const driveId = driveRes.data.id;
    const driveUrl = driveRes.data.webViewLink;

    if (!driveId || !driveUrl) {
      res.status(502).json({ error: "Drive upload returned incomplete data" });
      return;
    }

    const [newItem] = await db
      .insert(caseFolderItemsTable)
      .values({
        caseFolderId: folderId,
        driveId,
        name: file.originalname,
        mimeType: file.mimetype,
        driveUrl,
        addedBySource,
        addedByProfileId,
        addedByLabel,
      })
      .onConflictDoUpdate({
        target: caseFolderItemsTable.driveId,
        set: { name: file.originalname, driveUrl, addedByLabel },
      })
      .returning();

    logger.info(
      { caseId, folderId, itemId: newItem.id, driveId },
      "[caseFolders] file uploaded",
    );
    res.status(201).json({ item: newItem });
  },
);

export default router;
