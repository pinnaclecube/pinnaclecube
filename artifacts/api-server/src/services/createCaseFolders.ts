/**
 * createCaseFolders.ts — Pinnacle³
 *
 * Creates the full Google Drive folder tree for a case and persists every
 * folder record to case_folders immediately after creation.
 *
 * Call createCaseFolders(caseId) after a new case is created.
 * The function is safe to call again as a retry — it clears any partial
 * records before re-running.
 */

import { eq, and } from "drizzle-orm";
import {
  db,
  casePetitionSetupTable,
  caseFoldersTable,
  profilesTable,
} from "@workspace/db";
import {
  type VisaCategory,
  getTopLevelFolders,
  getCriteriaFolders,
} from "../config/driveFolderConfig";
import { createDriveFolder } from "./driveService";
import { registerDriveWatch } from "./driveWatchService";
import { logger } from "../lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeVisaCategory(visaPath: string): VisaCategory {
  const upper = visaPath.toUpperCase().replace(/[-_\s]/g, "");
  if (upper === "EB1A" || upper === "EB1") return "EB1A";
  if (upper === "NIW" || upper === "EB2NIW" || upper === "EB2") return "NIW";
  if (upper === "O1A" || upper === "O1") return "O1A";
  throw new Error(`Cannot map visaPath "${visaPath}" to a known VisaCategory (EB1A | NIW | O1A)`);
}

// ─── Core folder-creation logic ───────────────────────────────────────────────

async function doCreateFolders(caseId: number): Promise<void> {
  const driveRootId = process.env.DRIVE_ROOT_FOLDER_ID ?? process.env.ROOT_FOLDER_ID;
  if (!driveRootId) {
    throw new Error("DRIVE_ROOT_FOLDER_ID environment variable is not set");
  }

  // 1. Fetch case setup
  const [caseSetup] = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseId))
    .limit(1);
  if (!caseSetup) throw new Error(`Case ${caseId} not found`);

  const visaCategory = normalizeVisaCategory(caseSetup.visaPath);

  // 2. Fetch client profile for folder name
  const [profile] = await db
    .select({ name: profilesTable.name })
    .from(profilesTable)
    .where(eq(profilesTable.id, caseSetup.profileId))
    .limit(1);
  if (!profile) throw new Error(`Profile ${caseSetup.profileId} not found`);

  const clientName = profile.name;
  const rootFolderName = `${clientName} — Case ${caseId}`;

  // 3. Create root Drive folder
  logger.info({ caseId, rootFolderName }, "[createCaseFolders] creating root folder");
  const rootDrive = await createDriveFolder(rootFolderName, driveRootId);

  const [rootRecord] = await db
    .insert(caseFoldersTable)
    .values({
      caseId,
      name: rootFolderName,
      folderType: "root",
      parentFolderId: null,
      driveId: rootDrive.driveId,
      driveUrl: rootDrive.driveUrl,
      visaCategory,
      criteriaIndex: null,
    })
    .returning();

  // 4. Create top-level folders (Resume, Evidence, Demographics, Exhibits)
  let evidenceDriveId: string | null = null;
  let evidenceDbId: number | null = null;

  for (const folder of getTopLevelFolders(visaCategory)) {
    logger.info({ caseId, folder: folder.name }, "[createCaseFolders] creating top-level folder");
    const folderDrive = await createDriveFolder(folder.name, rootDrive.driveId);

    const [record] = await db
      .insert(caseFoldersTable)
      .values({
        caseId,
        name: folder.name,
        folderType: folder.type,
        parentFolderId: rootRecord.id,
        driveId: folderDrive.driveId,
        driveUrl: folderDrive.driveUrl,
        visaCategory,
        criteriaIndex: null,
      })
      .returning();

    if (folder.type === "evidence") {
      evidenceDriveId = folderDrive.driveId;
      evidenceDbId = record.id;
    }
  }

  if (!evidenceDriveId || !evidenceDbId) {
    throw new Error("Evidence folder was not found in top-level folders — check VISA_FOLDER_STRUCTURE config");
  }

  // 5. Create criteria subfolders inside Evidence
  for (const criterion of getCriteriaFolders(visaCategory)) {
    logger.info({ caseId, criterion: criterion.name }, "[createCaseFolders] creating criteria folder");
    const criterionDrive = await createDriveFolder(criterion.name, evidenceDriveId);

    await db.insert(caseFoldersTable).values({
      caseId,
      name: criterion.name,
      folderType: "criteria",
      parentFolderId: evidenceDbId,
      driveId: criterionDrive.driveId,
      driveUrl: criterionDrive.driveUrl,
      visaCategory,
      criteriaIndex: criterion.index,
    });
  }

  // 6. Mark case as fully synced
  await db
    .update(casePetitionSetupTable)
    .set({ driveSyncStatus: "synced", driveSyncError: null })
    .where(eq(casePetitionSetupTable.id, caseId));
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Creates the full Drive folder tree for the given case.
 *
 * - Sets drive_sync_status = 'pending' before starting.
 * - Saves each folder record immediately after creation (no end-batching).
 * - Retries the entire operation once on failure, clearing any partial records.
 * - Sets drive_sync_status = 'synced' on success, 'failed' on final error.
 */
export async function createCaseFolders(caseId: number): Promise<void> {
  logger.info({ caseId }, "[createCaseFolders] starting");

  await db
    .update(casePetitionSetupTable)
    .set({ driveSyncStatus: "pending", driveSyncError: null })
    .where(eq(casePetitionSetupTable.id, caseId));

  // After folders are created, register Drive push-notification watches for
  // every folder in the tree — not just the root. Google Drive push events
  // fire only for the directly-watched folder, so each subfolder (criteria,
  // resume, exhibits, …) needs its own channel to catch file drops.
  // Failures here are non-fatal — folder creation is considered successful
  // regardless of whether watch registration succeeds.
  async function tryRegisterAllWatches(): Promise<void> {
    try {
      const allFolders = await db
        .select({ id: caseFoldersTable.id, driveId: caseFoldersTable.driveId, folderType: caseFoldersTable.folderType })
        .from(caseFoldersTable)
        .where(eq(caseFoldersTable.caseId, caseId));

      if (allFolders.length === 0) {
        logger.warn({ caseId }, "[createCaseFolders] no folders found — skipping watch registration");
        return;
      }

      let registered = 0;
      for (const folder of allFolders) {
        try {
          await registerDriveWatch(caseId, folder.driveId);
          registered++;
        } catch (folderErr) {
          logger.warn(
            { caseId, folderId: folder.id, folderType: folder.folderType, err: folderErr },
            "[createCaseFolders] watch registration failed for folder (non-fatal)",
          );
        }
      }

      logger.info(
        { caseId, registered, total: allFolders.length },
        "[createCaseFolders] watch channels registered",
      );
    } catch (watchErr) {
      logger.warn({ caseId, err: watchErr }, "[createCaseFolders] watch registration pass failed (non-fatal)");
    }
  }

  try {
    await doCreateFolders(caseId);
    logger.info({ caseId }, "[createCaseFolders] completed successfully");
    await tryRegisterAllWatches();
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    logger.warn({ caseId, err: firstMsg }, "[createCaseFolders] first attempt failed — retrying once");

    try {
      // Clear any partial folder records before the retry
      await db.delete(caseFoldersTable).where(eq(caseFoldersTable.caseId, caseId));
      await doCreateFolders(caseId);
      logger.info({ caseId }, "[createCaseFolders] completed successfully on retry");
      await tryRegisterAllWatches();
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      logger.error({ caseId, err: retryMsg }, "[createCaseFolders] retry failed — marking as failed");

      await db
        .update(casePetitionSetupTable)
        .set({ driveSyncStatus: "failed", driveSyncError: retryMsg })
        .where(eq(casePetitionSetupTable.id, caseId));
    }
  }
}
