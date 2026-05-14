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

function drive() {
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

/**
 * Creates a Google Drive folder with the given name inside `parentDriveId`.
 * Returns the new folder's Drive ID and web view URL.
 */
export async function createDriveFolder(
  name: string,
  parentDriveId: string,
): Promise<DriveFolder> {
  logger.info({ name, parentDriveId }, "[driveService] creating folder");

  const res = await drive().files.create({
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
