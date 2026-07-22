/**
 * driveService.ts — Pinnacle³
 *
 * Thin wrapper around the Google Drive v3 API using a service-account credential.
 * All Drive interactions go through this module — nothing else imports googleapis.
 */

import { google } from "googleapis";
import { logger } from "../lib/logger";

// ─── Auth client ──────────────────────────────────────────────────────────────

function buildDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// Lazy singleton — only instantiated on first use so the process doesn't crash
// at startup if the env var is missing (dev/test environments).
let _drive: ReturnType<typeof google.drive> | null = null;

/** Returns the shared Drive v3 client, initializing it on first call. */
export function getDriveClient() {
  if (!_drive) _drive = buildDriveClient();
  return _drive;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DriveFolder {
  /** Google Drive file ID for the folder. */
  driveId: string;
  /** Shareable web URL for the folder. */
  driveUrl: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

/**
 * Creates a Google Drive folder with the given name inside `parentDriveId`.
 * Returns the new folder's Drive ID and web view URL.
 */
export async function createDriveFolder(
  name: string,
  parentDriveId: string,
): Promise<DriveFolder> {
  logger.info({ name, parentDriveId }, "[driveService] creating folder");

  const res = await getDriveClient().files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentDriveId],
    },
    fields: "id,webViewLink",
  });

  const driveId = res.data.id;
  const driveUrl = res.data.webViewLink;

  if (!driveId || !driveUrl) {
    throw new Error(`Drive folder creation returned incomplete data for "${name}"`);
  }

  logger.info({ name, driveId }, "[driveService] folder created");
  return { driveId, driveUrl };
}

/**
 * Lists the non-folder direct children of a Drive folder.
 * Returns files only (folders are excluded).
 */
export async function listDriveFolderFiles(
  folderId: string,
): Promise<DriveFileMetadata[]> {
  const res = await getDriveClient().files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "files(id,name,mimeType,webViewLink)",
    pageSize: 100,
  });

  return (res.data.files ?? []).filter(
    (f): f is DriveFileMetadata =>
      Boolean(f.id && f.name && f.mimeType && f.webViewLink),
  ) as DriveFileMetadata[];
}

/**
 * Lists the direct subfolder children of a Drive folder.
 * Returns folders only (non-folder files are excluded).
 */
export async function listDriveSubfolders(
  folderId: string,
): Promise<DriveFileMetadata[]> {
  const res = await getDriveClient().files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id,name,mimeType,webViewLink)",
    pageSize: 100,
  });

  return (res.data.files ?? []).filter(
    (f): f is DriveFileMetadata =>
      Boolean(f.id && f.name && f.mimeType && f.webViewLink),
  ) as DriveFileMetadata[];
}

// Download a Drive file's raw bytes (works for files in shared drives).
export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const res = await getDriveClient().files.get(
    { supportsAllDrives: true, fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
