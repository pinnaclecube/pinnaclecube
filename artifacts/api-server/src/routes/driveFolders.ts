/**
 * driveFolders.ts — Pinnacle³
 *
 * Handles in-app creation of Google Drive subfolders.
 *
 * Client route:  POST /api/drive/folders
 * Staff route:   POST /api/admin/drive-folders
 *
 * Both routes:
 *  1. Verify the parent Drive ID belongs to the target profile.
 *  2. Create a folder in Google Drive under that parent.
 *  3. Save the record to drive_subfolders.
 *  4. Return the new folder object.
 *  If the Drive API call fails the DB record is never written (create-then-save
 *  order ensures no orphaned records).
 */

import { Router, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, clientDriveFoldersTable, driveSubfoldersTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { getDriveClient, findOrCreateFolder } from "../services/googleDrive";

const router = Router();

// ─── Shared helpers ────────────────────────────────────────────────────────────

const createFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
  parentDriveId: z.string().min(1),
});

const staffCreateFolderBodySchema = createFolderBodySchema.extend({
  profileId: z.number().int().positive(),
});

interface ParentResolution {
  parentType: "criteria_folder" | "subfolder";
  parentId: number;
  parentDriveId: string;
}

async function resolveParent(
  profileId: number,
  parentDriveId: string,
): Promise<ParentResolution | null> {
  // 1. Check criteria folders (top-level connected Drive folders)
  const [criteriaFolder] = await db
    .select({ id: clientDriveFoldersTable.id })
    .from(clientDriveFoldersTable)
    .where(
      and(
        eq(clientDriveFoldersTable.profileId, profileId),
        eq(clientDriveFoldersTable.driveFolderId, parentDriveId),
      ),
    )
    .limit(1);

  if (criteriaFolder) {
    return { parentType: "criteria_folder", parentId: criteriaFolder.id, parentDriveId };
  }

  // 2. Check app-created subfolders
  const [subfolder] = await db
    .select({ id: driveSubfoldersTable.id })
    .from(driveSubfoldersTable)
    .where(
      and(
        eq(driveSubfoldersTable.profileId, profileId),
        eq(driveSubfoldersTable.driveId, parentDriveId),
      ),
    )
    .limit(1);

  if (subfolder) {
    return { parentType: "subfolder", parentId: subfolder.id, parentDriveId };
  }

  // 3. Drive-native subfolder: the parentDriveId wasn't created through the app but
  //    may be a real subfolder of one of the profile's criteria folders (e.g. the user
  //    created it directly in Google Drive). Verify by fetching the folder's metadata
  //    from Drive and checking whether its parent is one of this profile's criteria folders.
  try {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId: parentDriveId,
      fields: "id,name,parents",
    });
    const driveParents: string[] = (meta.data.parents as string[] | undefined) ?? [];

    if (driveParents.length > 0) {
      // Fetch all criteria folders for this profile
      const criteriaFolders = await db
        .select({ id: clientDriveFoldersTable.id, driveFolderId: clientDriveFoldersTable.driveFolderId })
        .from(clientDriveFoldersTable)
        .where(eq(clientDriveFoldersTable.profileId, profileId));

      const criteriaIds = new Set(criteriaFolders.map((f) => f.driveFolderId));
      const matchingCriteria = criteriaFolders.find((f) => driveParents.includes(f.driveFolderId));

      if (matchingCriteria) {
        // The parent is a direct child of a criteria folder — valid
        return { parentType: "criteria_folder", parentId: matchingCriteria.id, parentDriveId };
      }

      // Also check one level deeper: the parentDriveId's grandparent might be a criteria folder
      // (i.e. the user is creating inside a Drive-native sub-subfolder)
      const grandparentMeta = await Promise.all(
        driveParents.map((pid) =>
          drive.files.get({ fileId: pid, fields: "id,parents" }).catch(() => null),
        ),
      );
      for (const gm of grandparentMeta) {
        const gParents: string[] = (gm?.data?.parents as string[] | undefined) ?? [];
        const matchingGrandparent = criteriaFolders.find((f) => gParents.includes(f.driveFolderId));
        if (matchingGrandparent) {
          return { parentType: "criteria_folder", parentId: matchingGrandparent.id, parentDriveId };
        }
      }

      void criteriaIds; // suppress unused-variable lint
    }
  } catch {
    // Drive metadata lookup failed — fall through to deny
  }

  return null;
}

async function createSubfolder(
  profileId: number,
  name: string,
  parentDriveId: string,
  role: "client" | "staff",
  createdBy: string,
) {
  const parent = await resolveParent(profileId, parentDriveId);
  if (!parent) {
    throw Object.assign(new Error("Parent folder not found or not permitted"), { status: 403 });
  }

  // Create in Google Drive first — if this throws we never write to DB
  const drive = getDriveClient();
  let driveFolder: { id: string; webViewLink: string };
  try {
    driveFolder = await findOrCreateFolder(drive, name, parentDriveId);
  } catch (err: any) {
    throw Object.assign(
      new Error("Google Drive folder creation failed: " + (err?.message ?? "unknown error")),
      { status: 502 },
    );
  }

  // Save record to DB
  const [newFolder] = await db
    .insert(driveSubfoldersTable)
    .values({
      name,
      profileId,
      parentType: parent.parentType,
      parentId: parent.parentId,
      parentDriveId,
      driveId: driveFolder.id,
      driveUrl: driveFolder.webViewLink ?? null,
      role,
      createdBy,
    })
    .returning();

  return newFolder;
}

// ─── POST /api/drive/folders — client ─────────────────────────────────────────

router.post("/drive/folders", requireClientAuth, async (req: any, res: Response) => {
  const parsed = createFolderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { name, parentDriveId } = parsed.data;
  const profileId: number = req.clientUser.id;

  try {
    const folder = await createSubfolder(
      profileId,
      name,
      parentDriveId,
      "client",
      String(profileId),
    );
    res.status(201).json({ folder });
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to create folder" });
  }
});

// ─── POST /api/admin/drive-folders — staff ────────────────────────────────────

router.post("/admin/drive-folders", requireStaffAuth, async (req: any, res: Response) => {
  const parsed = staffCreateFolderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { name, parentDriveId, profileId } = parsed.data;
  const staffId: string = req.staffUser?.id ?? "staff";

  try {
    const folder = await createSubfolder(
      profileId,
      name,
      parentDriveId,
      "staff",
      `staff:${staffId}`,
    );
    res.status(201).json({ folder });
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to create folder" });
  }
});

export default router;
