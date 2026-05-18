/**
 * dryRunMigrateFolders.ts — Pinnacle³
 *
 * Migrates existing client case root folders from personal Drive into the
 * Shared Drive at DRIVE_ROOT_FOLDER_ID.
 *
 * Usage:
 *   Dry-run  : pnpm --filter @workspace/scripts run migrate:folders:dry-run
 *   Live move: pnpm --filter @workspace/scripts run migrate:folders:execute
 *
 * In dry-run mode no Drive changes are made.
 * In execute mode each root folder is reparented via drive.files.update.
 */

import pg from "pg";
import { google } from "googleapis";

// ─── Config ──────────────────────────────────────────────────────────────────

const EXECUTE = process.argv.includes("--execute");

const SHARED_DRIVE_ID = process.env.DRIVE_ROOT_FOLDER_ID;
if (!SHARED_DRIVE_ID) {
  console.error("ERROR: DRIVE_ROOT_FOLDER_ID is not set");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!SERVICE_ACCOUNT_JSON) {
  console.error("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  process.exit(1);
}

// ─── Drive client ─────────────────────────────────────────────────────────────

function buildDriveClient() {
  const credentials = JSON.parse(SERVICE_ACCOUNT_JSON!) as Record<string, unknown>;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface RootFolderRow {
  case_id: number;
  drive_id: string;
  name: string;
  drive_url: string;
}

async function main() {
  const mode = EXECUTE ? "LIVE EXECUTE" : "DRY RUN";

  console.log("=".repeat(70));
  console.log(`${mode}: Migrate client root folders → Shared Drive`);
  console.log(`Shared Drive ID : ${SHARED_DRIVE_ID}`);
  console.log(`Mode            : ${mode}${EXECUTE ? " — Drive changes WILL be made" : " — no Drive changes will be made"}`);
  console.log("=".repeat(70));
  console.log();

  // ── 1. Query all root folders ──────────────────────────────────────────────
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  let rows: RootFolderRow[];
  try {
    const result = await pool.query<RootFolderRow>(`
      SELECT
        cf.case_id,
        cf.drive_id,
        cf.name,
        cf.drive_url
      FROM case_folders cf
      WHERE cf.folder_type = 'root'
      ORDER BY cf.case_id
    `);
    rows = result.rows;
  } finally {
    await pool.end();
  }

  if (rows.length === 0) {
    console.log("No root folders found in case_folders. Nothing to migrate.");
    return;
  }

  console.log(`Found ${rows.length} root folder(s) to inspect.\n`);

  // ── 2. Build Drive client ──────────────────────────────────────────────────
  const drive = buildDriveClient();

  // ── 3. Inspect and optionally move each root folder ───────────────────────
  let moveCount = 0;
  let skipCount = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    console.log(`Case ID ${String(row.case_id).padStart(4)} │ "${row.name}"`);
    console.log(`             │ Drive folder ID : ${row.drive_id}`);

    let currentParentId: string | null = null;
    let action: "MOVE" | "SKIP" | "ERROR" = "ERROR";
    let errorMsg = "";

    // Fetch current parents
    try {
      const res = await drive.files.get({
        supportsAllDrives: true,
        fileId: row.drive_id,
        fields: "id,name,parents",
      });

      const parents = res.data.parents ?? [];
      currentParentId = parents[0] ?? null;

      if (currentParentId === SHARED_DRIVE_ID) {
        action = "SKIP";
        skipCount++;
      } else {
        action = "MOVE";
        moveCount++;
      }
    } catch (err) {
      action = "ERROR";
      errorMsg = err instanceof Error ? err.message : String(err);
      errorCount++;
    }

    console.log(`             │ Current parent  : ${currentParentId ?? "(none)"}`);
    console.log(`             │ Action          : ${action}${action === "SKIP" ? " (already in Shared Drive)" : ""}`);

    if (action === "ERROR") {
      console.log(`             │ Error           : ${errorMsg}`);
      console.log();
      continue;
    }

    if (action === "SKIP") {
      console.log();
      continue;
    }

    // action === "MOVE"
    if (!EXECUTE) {
      console.log(`             │ Would move to   : ${SHARED_DRIVE_ID}`);
      console.log();
      continue;
    }

    // ── Live move ────────────────────────────────────────────────────────────
    try {
      const updateRes = await drive.files.update({
        supportsAllDrives: true,
        fileId: row.drive_id,
        addParents: SHARED_DRIVE_ID!,
        removeParents: currentParentId ?? undefined,
        fields: "id,name,parents",
      });

      const newParents = updateRes.data.parents ?? [];
      const movedTo = newParents[0] ?? "(unknown)";

      console.log(`             │ Move result     : SUCCESS`);
      console.log(`             │ New parent ID   : ${movedTo}`);
      console.log(`             │ Drive response  : id=${updateRes.data.id}, name="${updateRes.data.name}"`);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`             │ Move result     : FAILED — ${msg}`);
      errorCount++;
      moveCount--; // revert the count since the move didn't succeed
    }

    console.log();
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log(`  Total inspected : ${rows.length}`);
  if (EXECUTE) {
    console.log(`  Moved (success) : ${successCount}`);
    console.log(`  Skipped         : ${skipCount} (already in Shared Drive)`);
    console.log(`  Failed          : ${errorCount}`);
  } else {
    console.log(`  Would MOVE      : ${moveCount}`);
    console.log(`  Would SKIP      : ${skipCount} (already in Shared Drive)`);
    console.log(`  Errors          : ${errorCount}`);
  }
  console.log("=".repeat(70));

  if (EXECUTE && successCount > 0) {
    console.log();
    console.log(`✓ ${successCount} folder(s) successfully moved into the Shared Drive.`);
  }
  if (EXECUTE && errorCount > 0) {
    console.log();
    console.log(`✗ ${errorCount} folder(s) failed — check errors above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
