/**
 * dryRunMigrateFolders.ts — Pinnacle³
 *
 * Dry-run preview of moving existing client case root folders from personal
 * Drive into the Shared Drive at DRIVE_ROOT_FOLDER_ID.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts tsx src/dryRunMigrateFolders.ts
 *
 * Does NOT modify anything in Drive or the database.
 * Prints MOVE / SKIP for each root folder and a summary at the end.
 */

import pg from "pg";
import { google } from "googleapis";

// ─── Config ──────────────────────────────────────────────────────────────────

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
  console.log("=".repeat(70));
  console.log("DRY-RUN: Migrate client root folders → Shared Drive");
  console.log(`Shared Drive ID : ${SHARED_DRIVE_ID}`);
  console.log("Mode            : DRY RUN — no Drive changes will be made");
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

  // ── 3. Inspect each root folder ───────────────────────────────────────────
  let moveCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    process.stdout.write(`Case ID ${String(row.case_id).padStart(4)} │ "${row.name}" │ ${row.drive_id} │ `);

    let currentParentId: string | null = null;
    let action: "MOVE" | "SKIP" | "ERROR" = "ERROR";
    let errorMsg = "";

    try {
      const res = await drive.files.get({
        supportsAllDrives: true,
        fileId: row.drive_id,
        fields: "id,name,parents",
      });

      const parents = res.data.parents ?? [];
      currentParentId = parents[0] ?? null;

      // SKIP if already a direct child of the Shared Drive root
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

    if (action === "MOVE") {
      console.log(`current parent: ${currentParentId ?? "(none)"}`);
      console.log(`             │ Action         : MOVE`);
      console.log(`             │ Would move to  : ${SHARED_DRIVE_ID}`);
    } else if (action === "SKIP") {
      console.log(`current parent: ${currentParentId ?? "(none)"}`);
      console.log(`             │ Action         : SKIP (already in Shared Drive)`);
    } else {
      console.log(`ERROR`);
      console.log(`             │ Action         : ERROR — ${errorMsg}`);
    }

    console.log();
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log(`  Total inspected : ${rows.length}`);
  console.log(`  Would MOVE      : ${moveCount}`);
  console.log(`  Would SKIP      : ${skipCount} (already in Shared Drive)`);
  console.log(`  Errors          : ${errorCount}`);
  console.log("=".repeat(70));
  console.log();
  if (moveCount > 0) {
    console.log(`Next step: confirm to run the live migration for ${moveCount} folder(s).`);
  } else {
    console.log("All root folders are already in the Shared Drive. No migration needed.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
