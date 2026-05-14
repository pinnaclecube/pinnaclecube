import { db, clientDriveFoldersTable, clientDriveRootsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Reconciles client_drive_folders against client_drive_roots on startup.
 *
 * Detects and removes criterion folder records that share the same Drive ID as
 * the profile's evidence root folder — a provisioning data corruption where the
 * same folder was accidentally stored as both the root and a criterion subfolder.
 */
export async function reconcileDriveFolders(): Promise<void> {
  try {
    const roots = await db
      .select({
        profileId: clientDriveRootsTable.profileId,
        evidenceRootFolderId: clientDriveRootsTable.evidenceRootFolderId,
      })
      .from(clientDriveRootsTable);

    if (roots.length === 0) return;

    const folders = await db
      .select({
        id: clientDriveFoldersTable.id,
        profileId: clientDriveFoldersTable.profileId,
        criteriaId: clientDriveFoldersTable.criteriaId,
        driveFolderId: clientDriveFoldersTable.driveFolderId,
      })
      .from(clientDriveFoldersTable);

    const rootMap = new Map(roots.map((r) => [r.profileId, r.evidenceRootFolderId]));

    const malformed = folders.filter((f) => {
      const rootId = rootMap.get(f.profileId);
      return rootId !== undefined && rootId === f.driveFolderId;
    });

    if (malformed.length === 0) return;

    const ids = malformed.map((f) => f.id);
    await db.delete(clientDriveFoldersTable).where(inArray(clientDriveFoldersTable.id, ids));

    logger.info(
      { count: malformed.length, records: malformed.map((f) => ({ profileId: f.profileId, criteriaId: f.criteriaId })) },
      "[driveReconcile] Removed malformed criterion folder records (drive_folder_id matched evidence root)",
    );
  } catch (err) {
    logger.error({ err }, "[driveReconcile] Failed to reconcile drive folders");
  }
}
