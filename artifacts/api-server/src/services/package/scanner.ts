/**
 * scanner.ts — Evidence Package module, stage 2 (spec section 4 stage 2).
 *
 * Walks the case's Evidence subtree and returns the candidate evidence files,
 * skipping any folder tagged as package output or template. The tag is the Drive
 * folder DESCRIPTION field (markers in PACKAGE_SKIP_TAGS). Reuses
 * getEvidenceSubtreeFolders + the case_folder_items registry; adds no new tables.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db, caseFolderItemsTable } from "@workspace/db";
import { getEvidenceSubtreeFolders } from "../evidenceSyncService";
import { getDriveFileDescription } from "../driveService";
import { logger } from "../../lib/logger";

export const PACKAGE_OUTPUT_TAG = "[pinnacle:package-output]";
export const PACKAGE_TEMPLATE_TAG = "[pinnacle:template]";
export const PACKAGE_SKIP_TAGS = [PACKAGE_OUTPUT_TAG, PACKAGE_TEMPLATE_TAG];

export interface ScannedFile {
  fileId: number;
  name: string;
  mimeType: string;
  driveId: string;
  driveUrl: string | null;
  criterion: string | null;
  folderId: number;
  folderName: string;
}

export interface ScanResult {
  caseSetupId: number;
  files: ScannedFile[];
  byMimeType: Record<string, number>;
  skippedFolders: { id: number; name: string; tag: string }[];
  scannedFolders: number;
}

export async function scanCaseEvidence(caseSetupId: number): Promise<ScanResult> {
  const subtree = await getEvidenceSubtreeFolders(caseSetupId);

  const skippedFolders: { id: number; name: string; tag: string }[] = [];
  const activeFolders: typeof subtree = [];
  for (const f of subtree) {
    let description = "";
    try {
      description = (await getDriveFileDescription(f.driveId)) ?? "";
    } catch (err) {
      // A description read failure must not drop a folder — log and keep it.
      logger.warn({ err, caseSetupId, folderId: f.id }, "[package/scanner] folder description read failed");
    }
    const tag = PACKAGE_SKIP_TAGS.find((t) => description.includes(t));
    if (tag) {
      skippedFolders.push({ id: f.id, name: f.name, tag });
      continue;
    }
    activeFolders.push(f);
  }

  const folderIds = activeFolders.map((f) => f.id);
  const items =
    folderIds.length === 0
      ? []
      : await db
          .select()
          .from(caseFolderItemsTable)
          .where(
            and(
              inArray(caseFolderItemsTable.caseFolderId, folderIds),
              eq(caseFolderItemsTable.isDeletedInDrive, false),
            ),
          );

  const folderName = new Map(activeFolders.map((f) => [f.id, f.name]));
  const files: ScannedFile[] = items.map((it) => ({
    fileId: it.id,
    name: it.name,
    mimeType: it.mimeType,
    driveId: it.driveId,
    driveUrl: it.driveUrl,
    criterion: it.criterionFolder,
    folderId: it.caseFolderId,
    folderName: folderName.get(it.caseFolderId) ?? "",
  }));

  const byMimeType: Record<string, number> = {};
  for (const f of files) byMimeType[f.mimeType] = (byMimeType[f.mimeType] ?? 0) + 1;

  logger.info(
    { caseSetupId, files: files.length, scannedFolders: activeFolders.length, skipped: skippedFolders.length },
    "[package/scanner] scan complete",
  );
  return { caseSetupId, files, byMimeType, skippedFolders, scannedFolders: activeFolders.length };
}
