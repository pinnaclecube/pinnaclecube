/**
 * driveUploadService.ts — Pinnacle³
 *
 * Reusable utility for uploading PDF buffers to Google Drive and
 * resolving case folder IDs. All Drive interactions delegate to the
 * shared singleton client in driveService.ts.
 */

import { Readable } from "stream";
import { eq, and } from "drizzle-orm";
import { db, caseFoldersTable } from "@workspace/db";
import { getDriveClient } from "./driveService";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  driveFileId: string;
  driveUrl: string;
  fileName: string;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads a PDF buffer to a specific Google Drive folder.
 * Sets the file to "anyone with the link can view" after upload.
 * Returns the Drive file ID, shareable URL, and file name.
 */
export async function uploadPdfToDrive(
  pdfBuffer: Buffer,
  fileName: string,
  driveFolderId: string,
): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  logger.info({ fileName, driveFolderId }, "[driveUpload] uploading PDF");

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      mimeType: "application/pdf",
      parents: [driveFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id,webViewLink",
  });

  const fileId = response.data.id;
  const webViewLink = response.data.webViewLink;

  if (!fileId || !webViewLink) {
    throw new Error(
      `Drive upload returned incomplete metadata for file "${fileName}"`,
    );
  }

  await drive.permissions.create({
    supportsAllDrives: true,
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  logger.info({ fileName, fileId }, "[driveUpload] PDF uploaded and shared");

  return {
    driveFileId: fileId,
    driveUrl: webViewLink,
    fileName,
  };
}

/**
 * Uploads any buffer (docx, png, pdf, …) to a Drive folder with an explicit mime
 * type. Unlike uploadPdfToDrive it does NOT make the file public by default
 * (Evidence Package page-image cache + exhibit docs stay private); pass
 * { share: true } to grant anyone-with-link read. Spec section 9.
 */
export async function uploadFileToDrive(
  data: Buffer,
  fileName: string,
  mimeType: string,
  driveFolderId: string,
  opts?: { share?: boolean },
): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: fileName, mimeType, parents: [driveFolderId] },
    media: { mimeType, body: Readable.from(data) },
    fields: "id,webViewLink",
  });
  const fileId = response.data.id;
  if (!fileId) {
    throw new Error(`Drive upload returned no id for file "${fileName}"`);
  }
  if (opts?.share) {
    await drive.permissions.create({
      supportsAllDrives: true,
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });
  }
  return { driveFileId: fileId, driveUrl: response.data.webViewLink ?? "", fileName };
}

// ─── Folder resolver ──────────────────────────────────────────────────────────

/**
 * Returns the Google Drive folder ID for a named folder type within a case.
 * folderType matches the values stored in case_folders.folder_type
 * e.g. "exhibits" | "root" | "resume" | "evidence" | "demographics"
 * Returns null if no matching folder row exists.
 */
export async function getCaseDriveFolderId(
  caseSetupId: number,
  folderType: string,
): Promise<string | null> {
  const [folder] = await db
    .select({ driveId: caseFoldersTable.driveId })
    .from(caseFoldersTable)
    .where(
      and(
        eq(caseFoldersTable.caseId, caseSetupId),
        eq(caseFoldersTable.folderType, folderType as "root" | "resume" | "evidence" | "demographics" | "exhibits" | "criteria" | "custom"),
      ),
    )
    .limit(1);

  return folder?.driveId ?? null;
}
