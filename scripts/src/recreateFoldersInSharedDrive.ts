/**
 * recreateFoldersInSharedDrive.ts — Pinnacle³
 *
 * For each of the 5 existing cases (5–9):
 *   1. Reads the full folder tree from case_folders
 *   2. Recreates the entire structure inside the Shared Drive
 *      (root → top-level subfolders → criteria subfolders)
 *   3. Updates all case_folders rows with the new drive_id / drive_url
 *   4. Deletes stale drive_watch_channels and re-registers fresh ones
 *      for every new Shared Drive folder
 *   5. Sets case_petition_setup.drive_sync_status = 'synced'
 *
 * Does NOT delete old personal Drive folders.
 * Does NOT move any files.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run recreate:folders
 */

import crypto from "crypto";
import pg from "pg";
import { google } from "googleapis";

// ─── Config ──────────────────────────────────────────────────────────────────

const SHARED_DRIVE_ID = process.env.DRIVE_ROOT_FOLDER_ID;
if (!SHARED_DRIVE_ID) { console.error("ERROR: DRIVE_ROOT_FOLDER_ID not set"); process.exit(1); }

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }

const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!SA_JSON) { console.error("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }

const CHANNEL_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Drive client ─────────────────────────────────────────────────────────────

function buildDriveClient() {
  const credentials = JSON.parse(SA_JSON!) as Record<string, unknown>;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

const drive = buildDriveClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createFolder(name: string, parentId: string): Promise<{ driveId: string; driveUrl: string }> {
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      driveId: SHARED_DRIVE_ID!,
    },
    fields: "id,webViewLink",
  });
  const driveId = res.data.id;
  const driveUrl = res.data.webViewLink;
  if (!driveId || !driveUrl) throw new Error(`Drive folder creation returned incomplete data for "${name}"`);
  return { driveId, driveUrl };
}

function getWebhookUrl(): string | null {
  const primary = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (primary) return `https://${primary}/api/drive/webhook`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}/api/drive/webhook`;
  return null;
}

async function registerWatch(
  pool: pg.Pool,
  caseId: number,
  driveFolderId: string,
  webhookUrl: string,
): Promise<boolean> {
  try {
    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CHANNEL_LIFETIME_MS);

    const res = await drive.files.watch({
      supportsAllDrives: true,
      fileId: driveFolderId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token: channelToken,
        expiration: String(expiresAt.getTime()),
      },
    });

    const resourceId = res.data.resourceId ?? "";

    await pool.query(
      `INSERT INTO drive_watch_channels
         (case_id, channel_id, resource_id, drive_folder_id, channel_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [caseId, channelId, resourceId, driveFolderId, channelToken, expiresAt],
    );
    return true;
  } catch {
    return false;
  }
}

// ─── DB row type ──────────────────────────────────────────────────────────────

interface FolderRow {
  id: number;
  case_id: number;
  folder_type: string;
  name: string;
  criteria_index: number | null;
  parent_folder_id: number | null;
  staff_only: boolean;
  visa_category: string;
  drive_id: string;
  drive_url: string;
}

// ─── Per-case migration ───────────────────────────────────────────────────────

async function migrateCase(pool: pg.Pool, caseId: number, webhookUrl: string | null): Promise<void> {
  const sep = "-".repeat(60);
  console.log(sep);

  // ── Step 1: load full folder tree ─────────────────────────────────────────
  const { rows } = await pool.query<FolderRow>(`
    SELECT id, case_id, folder_type, name, criteria_index,
           parent_folder_id, staff_only, visa_category, drive_id, drive_url
    FROM case_folders
    WHERE case_id = $1
    ORDER BY
      CASE folder_type
        WHEN 'root'        THEN 0
        WHEN 'resume'      THEN 1
        WHEN 'evidence'    THEN 2
        WHEN 'demographics'THEN 3
        WHEN 'exhibits'    THEN 4
        ELSE               5
      END,
      criteria_index NULLS LAST
  `, [caseId]);

  const root = rows.find(r => r.folder_type === "root");
  if (!root) { console.log(`Case ${caseId}: no root folder row found — skipping`); return; }

  const topLevel = rows.filter(r => ["resume", "evidence", "demographics", "exhibits"].includes(r.folder_type));
  const criteria  = rows.filter(r => r.folder_type === "criteria");

  console.log(`Case ID ${caseId} │ "${root.name}"`);
  console.log(`  Old root Drive ID : ${root.drive_id}`);
  console.log(`  Top-level folders : ${topLevel.length}`);
  console.log(`  Criteria folders  : ${criteria.length}`);
  console.log(`  Total folders     : ${rows.length}`);
  console.log();

  // ── Step 2: create new root in Shared Drive ────────────────────────────────
  process.stdout.write(`  [1/7] Creating root folder in Shared Drive... `);
  const newRoot = await createFolder(root.name, SHARED_DRIVE_ID!);
  console.log(`OK → ${newRoot.driveId}`);

  await pool.query(
    `UPDATE case_folders SET drive_id = $1, drive_url = $2 WHERE id = $3`,
    [newRoot.driveId, newRoot.driveUrl, root.id],
  );

  // ── Step 3: create top-level subfolders ───────────────────────────────────
  process.stdout.write(`  [2/7] Creating top-level subfolders... `);
  const newDriveIdByDbId = new Map<number, string>();
  newDriveIdByDbId.set(root.id, newRoot.driveId);

  let evidenceDriveId = "";

  for (const folder of topLevel) {
    const created = await createFolder(folder.name, newRoot.driveId);
    newDriveIdByDbId.set(folder.id, created.driveId);
    await pool.query(
      `UPDATE case_folders SET drive_id = $1, drive_url = $2 WHERE id = $3`,
      [created.driveId, created.driveUrl, folder.id],
    );
    if (folder.folder_type === "evidence") evidenceDriveId = created.driveId;
  }
  console.log(`OK (${topLevel.length} created)`);

  if (!evidenceDriveId) {
    console.log(`  WARNING: no 'evidence' folder found — criteria will be skipped`);
  }

  // ── Step 4: create criteria subfolders ────────────────────────────────────
  process.stdout.write(`  [3/7] Creating criteria subfolders... `);
  for (const folder of criteria) {
    const parentDriveId = evidenceDriveId || newRoot.driveId;
    const created = await createFolder(folder.name, parentDriveId);
    newDriveIdByDbId.set(folder.id, created.driveId);
    await pool.query(
      `UPDATE case_folders SET drive_id = $1, drive_url = $2 WHERE id = $3`,
      [created.driveId, created.driveUrl, folder.id],
    );
  }
  console.log(`OK (${criteria.length} created)`);

  // ── Step 5: confirm DB rows updated ───────────────────────────────────────
  const { rows: updated } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM case_folders WHERE case_id = $1`, [caseId],
  );
  const dbRowsUpdated = parseInt(updated[0].count, 10);
  console.log(`  [4/7] DB rows updated : ${dbRowsUpdated} case_folders rows now point to Shared Drive`);

  // ── Step 6: delete stale watch channels and re-register ───────────────────
  const { rowCount: deletedChannels } = await pool.query(
    `DELETE FROM drive_watch_channels WHERE case_id = $1`, [caseId],
  );
  process.stdout.write(`  [5/7] Deleted ${deletedChannels ?? 0} stale watch channel(s). Re-registering... `);

  let watchSuccessCount = 0;
  let watchFailCount = 0;
  const allNewDriveIds = Array.from(newDriveIdByDbId.values());

  if (webhookUrl) {
    for (const driveFolderId of allNewDriveIds) {
      const ok = await registerWatch(pool, caseId, driveFolderId, webhookUrl);
      if (ok) watchSuccessCount++; else watchFailCount++;
    }
    console.log(`OK (${watchSuccessCount} registered, ${watchFailCount} failed)`);
  } else {
    console.log(`SKIPPED (no webhook URL available — REPLIT_DOMAINS not set)`);
  }

  // ── Step 7: update drive_sync_status ──────────────────────────────────────
  await pool.query(
    `UPDATE case_petition_setup SET drive_sync_status = 'synced', updated_at = NOW() WHERE id = $1`,
    [caseId],
  );
  console.log(`  [6/7] case_petition_setup.drive_sync_status = 'synced'`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  console.log(`  ✓ Case ${caseId} complete`);
  console.log(`    Old root  : ${root.drive_id}`);
  console.log(`    New root  : ${newRoot.driveId}`);
  console.log(`    Folders created in Shared Drive : ${rows.length}`);
  console.log(`    DB rows updated                 : ${dbRowsUpdated}`);
  console.log(`    Watch channels registered       : ${watchSuccessCount}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("Recreate case folder structures inside Shared Drive");
  console.log(`Shared Drive ID : ${SHARED_DRIVE_ID}`);
  console.log("=".repeat(70));
  console.log();

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const webhookUrl = getWebhookUrl();

  if (webhookUrl) {
    console.log(`Webhook URL     : ${webhookUrl}`);
  } else {
    console.log(`Webhook URL     : (unavailable — watch channels will be skipped)`);
  }
  console.log();

  const CASE_IDS = [5, 6, 7, 8, 9];
  let successCount = 0;
  let failCount = 0;

  for (const caseId of CASE_IDS) {
    try {
      await migrateCase(pool, caseId, webhookUrl);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Case ${caseId} FAILED: ${msg}`);
      failCount++;
    }

    if (caseId !== CASE_IDS[CASE_IDS.length - 1]) {
      process.stdout.write(`\n  Waiting 2s before next case...\n\n`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await pool.end();

  console.log();
  console.log("=".repeat(70));
  console.log("FINAL SUMMARY");
  console.log(`  Cases succeeded : ${successCount}`);
  console.log(`  Cases failed    : ${failCount}`);
  console.log("=".repeat(70));

  if (failCount > 0) process.exit(1);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
