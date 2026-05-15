/**
 * driveWatchService.ts — Pinnacle³
 *
 * Manages Google Drive push-notification watch channels and folder-content sync.
 *
 * - registerDriveWatch(caseId, rootDriveFolderId) — registers a Drive watch
 *   and persists the channel record in drive_watch_channels.
 * - syncFolderContents(driveFolderId) — fetches the current non-folder
 *   children of a Drive folder and upserts them into case_folder_items.
 * - startDriveChannelRenewal() — sets up a recurring job that renews
 *   channels expiring within the next 24 hours (runs every 6 hours).
 */

import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import {
  db,
  caseFoldersTable,
  caseFolderItemsTable,
  driveWatchChannelsTable,
} from "@workspace/db";
import { getDriveClient, listDriveFolderFiles } from "./driveService";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Drive channels last at most 7 days; we request the full lifetime. */
const CHANNEL_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Renewal job runs every 6 hours. */
const RENEWAL_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWebhookUrl(): string {
  // REPLIT_DOMAINS is a comma-separated list; use the first (primary) domain.
  const primary = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (primary) return `https://${primary}/api/drive/webhook`;
  // Fallback for local / dev environment
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}/api/drive/webhook`;
  throw new Error("Cannot determine webhook URL: REPLIT_DOMAINS is not set");
}

// ─── Watch registration ───────────────────────────────────────────────────────

/**
 * Registers a Google Drive push-notification channel for `rootDriveFolderId`
 * and stores the channel record in the database.
 * Non-fatal — logs a warning if the Drive API call fails.
 */
export async function registerDriveWatch(
  caseId: number,
  rootDriveFolderId: string,
): Promise<void> {
  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHANNEL_LIFETIME_MS);

  let webhookUrl: string;
  try {
    webhookUrl = getWebhookUrl();
  } catch (err) {
    logger.warn({ caseId, err }, "[driveWatch] cannot register watch — webhook URL unavailable");
    return;
  }

  const drive = getDriveClient();

  const res = await drive.files.watch({
    fileId: rootDriveFolderId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      token: channelToken,
      expiration: String(expiresAt.getTime()),
    },
  });

  const resourceId = res.data.resourceId ?? "";

  await db.insert(driveWatchChannelsTable).values({
    caseId,
    channelId,
    resourceId,
    driveFolderId: rootDriveFolderId,
    channelToken,
    expiresAt,
  });

  logger.info({ caseId, channelId, expiresAt }, "[driveWatch] watch channel registered");
}

// ─── Watch cancellation ───────────────────────────────────────────────────────

async function stopChannel(channelId: string, resourceId: string): Promise<void> {
  try {
    await getDriveClient().channels.stop({
      requestBody: { id: channelId, resourceId },
    });
  } catch (err) {
    logger.warn({ channelId, err }, "[driveWatch] failed to stop old channel (may already be expired)");
  }
}

// ─── Folder content sync ──────────────────────────────────────────────────────

/**
 * Fetches the non-folder direct children of `driveFolderId` from Drive
 * and upserts them into case_folder_items.
 *
 * Returns the number of items synced.
 */
export async function syncFolderContents(driveFolderId: string): Promise<number> {
  // Look up the case_folder record that owns this Drive folder
  const [folder] = await db
    .select()
    .from(caseFoldersTable)
    .where(eq(caseFoldersTable.driveId, driveFolderId))
    .limit(1);

  if (!folder) {
    logger.warn({ driveFolderId }, "[syncFolderContents] no case_folder found for drive_id — skipping");
    return 0;
  }

  const files = await listDriveFolderFiles(driveFolderId);
  let upsertCount = 0;

  for (const file of files) {
    await db
      .insert(caseFolderItemsTable)
      .values({
        caseFolderId: folder.id,
        driveId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        driveUrl: file.webViewLink,
        addedBySource: "drive",
      })
      .onConflictDoUpdate({
        target: caseFolderItemsTable.driveId,
        set: {
          name: file.name,
          driveUrl: file.webViewLink,
        },
      });
    upsertCount++;
  }

  logger.info(
    { driveFolderId, caseFolderId: folder.id, upsertCount },
    "[syncFolderContents] sync complete",
  );
  return upsertCount;
}

// ─── Channel renewal cron ─────────────────────────────────────────────────────

async function renewExpiringSoonChannels(): Promise<void> {
  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000); // expiring within 24 h

  const expiring = await db
    .select()
    .from(driveWatchChannelsTable)
    .where(lt(driveWatchChannelsTable.expiresAt, renewBefore));

  if (expiring.length === 0) return;

  logger.info({ count: expiring.length }, "[driveWatch] renewing expiring channels");

  for (const ch of expiring) {
    try {
      // Stop the old channel first (best-effort)
      await stopChannel(ch.channelId, ch.resourceId);

      // Register a fresh channel for the same folder
      await registerDriveWatch(ch.caseId, ch.driveFolderId);

      // Remove the old record (new one was inserted by registerDriveWatch)
      await db
        .delete(driveWatchChannelsTable)
        .where(eq(driveWatchChannelsTable.id, ch.id));

      logger.info({ caseId: ch.caseId, oldChannelId: ch.channelId }, "[driveWatch] channel renewed");
    } catch (err) {
      logger.error({ channelId: ch.channelId, err }, "[driveWatch] channel renewal failed");
    }
  }
}

/**
 * Starts the Drive channel renewal background job.
 * Call once from the server entry point after the server begins listening.
 */
export function startDriveChannelRenewal(): void {
  const run = async () => {
    try {
      await renewExpiringSoonChannels();
    } catch (err) {
      logger.error({ err }, "[driveWatch] renewal job error");
    }
  };

  // Run immediately on startup (catches any that expired while server was down),
  // then repeat every 6 hours.
  void run();
  setInterval(run, RENEWAL_INTERVAL_MS);
  logger.info("[driveWatch] channel renewal job started");
}
