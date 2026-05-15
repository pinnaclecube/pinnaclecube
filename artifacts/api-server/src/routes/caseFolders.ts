/**
 * caseFolders.ts — Pinnacle³
 *
 * In-app Drive folder and file management for both clients and staff.
 *
 * GET  /cases/me                         — client: resolve their own case
 * GET  /cases/:caseId/folders            — list all folders for a case
 * POST /cases/:caseId/folders            — create a subfolder in Drive
 * GET  /cases/:caseId/folders/:folderId/files  — list files in a folder
 * POST /cases/:caseId/folders/:folderId/files  — upload a file to Drive
 *
 * Auth: X-Staff-Token (staff) OR Bearer JWT (client).
 * Client routes enforce that the case belongs to the authenticated profile.
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

// ─── Combined auth middleware ─────────────────────────────────────────────────
// Routes that serve both clients and staff dispatch to the right middleware
// based on which auth credential is present.

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) {
    requireStaffAuth(req, res, next);
  } else {
    void requireClientAuth(req, res, next);
  }
}

// ─── Case access guard ────────────────────────────────────────────────────────

async function authorizeCase(
  req: Request,
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

  const clientUser = (req as Request & { clientUser?: { id: number } }).clientUser;
  if (clientUser && caseRecord.profileId !== clientUser.id) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }

  return caseRecord;
}

// ─── GET /cases/me ────────────────────────────────────────────────────────────
// Resolves the authenticated client's case setup ID.
// Must be declared BEFORE /cases/:caseId/* to prevent "me" matching as a param.

router.get("/cases/me", requireClientAuth, async (req: Request, res: Response): Promise<void> => {
  const clientUser = (req as Request & { clientUser: { id: number } }).clientUser;

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

router.get(
  "/cases/:caseId/folders",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(req, res, caseId);
    if (!caseRecord) return;

    const folders = await db
      .select()
      .from(caseFoldersTable)
      .where(eq(caseFoldersTable.caseId, caseId));

    res.json({ folders });
  },
);

// ─── POST /cases/:caseId/folders ──────────────────────────────────────────────

router.post(
  "/cases/:caseId/folders",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(req, res, caseId);
    if (!caseRecord) return;

    const { parentFolderId, name } = req.body as { parentFolderId?: number; name?: string };

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

    logger.info({ caseId, parentFolderId, name }, "[caseFolders] creating subfolder");

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
      })
      .returning();

    logger.info({ caseId, folderId: newFolder.id, driveId }, "[caseFolders] subfolder created");
    res.status(201).json({ folder: newFolder });
  },
);

// ─── GET /cases/:caseId/folders/:folderId/files ───────────────────────────────

router.get(
  "/cases/:caseId/folders/:folderId/files",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const folderId = parseInt(req.params.folderId as string, 10);

    const caseRecord = await authorizeCase(req, res, caseId);
    if (!caseRecord) return;

    if (isNaN(folderId)) {
      res.status(400).json({ error: "Invalid folderId" });
      return;
    }

    // Verify folder belongs to this case
    const [folder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.id, folderId), eq(caseFoldersTable.caseId, caseId)))
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

router.post(
  "/cases/:caseId/folders/:folderId/files",
  requireAnyAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    const folderId = parseInt(req.params.folderId as string, 10);

    const caseRecord = await authorizeCase(req, res, caseId);
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

    // Verify folder belongs to this case
    const [folder] = await db
      .select()
      .from(caseFoldersTable)
      .where(and(eq(caseFoldersTable.id, folderId), eq(caseFoldersTable.caseId, caseId)))
      .limit(1);

    if (!folder) {
      res.status(404).json({ error: "Folder not found in this case" });
      return;
    }

    logger.info(
      { caseId, folderId, filename: file.originalname, size: file.size },
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
        addedBySource: "app",
      })
      .onConflictDoUpdate({
        target: caseFolderItemsTable.driveId,
        set: { name: file.originalname, driveUrl },
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
