/**
 * driveWatchService.ts — Pinnacle³
 *
 * Manages Google Drive push-notification watch channels and folder-content sync.
 *
 * - registerDriveWatch(caseId, rootDriveFolderId) — registers a Drive watch
 *   and persists the channel record in drive_watch_channels.
 * - syncFolderContents(driveFolderId) — fetches the current non-folder
 *   children of a Drive folder and upserts them into case_folder_items.
 * - startDriveChannelRenewal() — sets up a recurring job (every 24 h) that
 *   renews channels expiring within the next 48 hours. Runs once immediately
 *   on startup. Failed renewals are persisted to channel_renewal_failures.
 */

import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import {
  db,
  caseFoldersTable,
  caseFolderItemsTable,
  driveWatchChannelsTable,
  channelRenewalFailuresTable,
} from "@workspace/db";
import { getDriveClient, listDriveFolderFiles, listDriveSubfolders } from "./driveService";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Drive channels last at most 7 days; we request the full lifetime. */
const CHANNEL_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Renewal job runs every 24 hours. */
const RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Renew channels that expire within the next 48 hours. */
const RENEWAL_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

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
    supportsAllDrives: true,
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
 * Fetches the direct children of `driveFolderId` from Drive and syncs them:
 *
 * - Non-folder files  → upserted into case_folder_items.
 * - Subfolders        → inserted into case_folders (if not already present),
 *                       a watch channel is registered for each new one, and
 *                       their contents are synced recursively.
 *
 * Returns the total count of files upserted + new subfolders persisted.
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

  // ── 1. Sync non-folder files (existing logic unchanged) ───────────────────

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

  // ── 2. Detect and persist subfolders created directly in Drive ────────────

  const subfolders = await listDriveSubfolders(driveFolderId);

  for (const subfolder of subfolders) {
    // Check if this subfolder is already tracked in case_folders
    const [existing] = await db
      .select()
      .from(caseFoldersTable)
      .where(eq(caseFoldersTable.driveId, subfolder.id))
      .limit(1);

    if (!existing) {
      // Persist the Drive-created subfolder as a 'custom' folder
      const [newFolder] = await db
        .insert(caseFoldersTable)
        .values({
          caseId: folder.caseId,
          name: subfolder.name,
          folderType: "custom",
          parentFolderId: folder.id,
          driveId: subfolder.id,
          driveUrl: subfolder.webViewLink,
          visaCategory: folder.visaCategory,
          staffOnly: false,
        })
        .returning();

      logger.info(
        { subfolderName: subfolder.name, driveId: subfolder.id, caseId: folder.caseId },
        "[syncFolderContents] new Drive subfolder detected and saved",
      );

      upsertCount++;

      // Register a watch channel so future changes inside this subfolder
      // also trigger webhooks — non-fatal if Drive API call fails
      try {
        await registerDriveWatch(folder.caseId, subfolder.id);
        logger.info(
          { subfolderDriveId: subfolder.id, caseId: folder.caseId },
          "[syncFolderContents] watch channel registered for new subfolder",
        );
      } catch (err) {
        logger.warn(
          { subfolderDriveId: subfolder.id, err },
          "[syncFolderContents] watch registration failed for new subfolder",
        );
      }

      // Recurse into the new subfolder to pick up any files already inside it
      if (newFolder) {
        await syncFolderContents(subfolder.id);
      }
    }
    // Already-tracked subfolders are intentionally NOT recursed into here.
    // Each tracked subfolder has its own watch channel (webhooks) and will be
    // iterated directly by the backfill loop, so recursing would multiply
    // Drive API calls by the depth of the folder hierarchy.
  }

  logger.info(
    { driveFolderId, caseFolderId: folder.id, upsertCount },
    "[syncFolderContents] sync complete",
  );
  return upsertCount;
}

// ─── Channel renewal cron ─────────────────────────────────────────────────────

async function renewExpiringSoonChannels(): Promise<void> {
  const renewBefore = new Date(Date.now() + RENEWAL_LOOKAHEAD_MS);

  const expiring = await db
    .select()
    .from(driveWatchChannelsTable)
    .where(lt(driveWatchChannelsTable.expiresAt, renewBefore));

  if (expiring.length === 0) {
    logger.info("[driveWatch] renewal check — no channels expiring within 48 h");
    return;
  }

  logger.info({ count: expiring.length }, "[driveWatch] renewing expiring channels");

  for (const ch of expiring) {
    try {
      // Stop the old channel first (best-effort — non-fatal if already expired)
      await stopChannel(ch.channelId, ch.resourceId);

      // Register a fresh channel for the same folder
      await registerDriveWatch(ch.caseId, ch.driveFolderId);

      // Remove the old DB record (new one was inserted by registerDriveWatch)
      await db
        .delete(driveWatchChannelsTable)
        .where(eq(driveWatchChannelsTable.id, ch.id));

      logger.info(
        { caseId: ch.caseId, oldChannelId: ch.channelId },
        "[driveWatch] channel renewed successfully",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { caseId: ch.caseId, channelId: ch.channelId, err: message },
        "[driveWatch] channel renewal failed",
      );

      // Persist the failure so staff can audit it via the admin dashboard
      try {
        await db.insert(channelRenewalFailuresTable).values({
          caseId: ch.caseId,
          oldChannelId: ch.channelId,
          driveFolderId: ch.driveFolderId,
          errorMessage: message,
        });
      } catch (dbErr) {
        logger.error({ caseId: ch.caseId, dbErr }, "[driveWatch] failed to persist renewal failure");
      }
    }
  }
}

/**
 * Starts the Drive channel renewal background job.
 * Call once from the server entry point after the server begins listening.
 *
 * - Runs immediately on startup to catch any channels that expired during downtime.
 * - Then repeats every 24 hours.
 * - Channels expiring within 48 hours are renewed on each run.
 * - Failed renewals are persisted to channel_renewal_failures for staff review.
 */
export function startDriveChannelRenewal(): void {
  const run = async () => {
    try {
      await renewExpiringSoonChannels();
    } catch (err) {
      logger.error({ err }, "[driveWatch] renewal job error");
    }
  };

  const nextRun = new Date(Date.now() + RENEWAL_INTERVAL_MS);

  void run();
  setInterval(run, RENEWAL_INTERVAL_MS);

  logger.info(
    {
      intervalHours: RENEWAL_INTERVAL_MS / (60 * 60 * 1000),
      lookaheadHours: RENEWAL_LOOKAHEAD_MS / (60 * 60 * 1000),
      nextScheduledRun: nextRun.toISOString(),
    },
    "[driveWatch] channel renewal job started — running initial check now",
  );
}
