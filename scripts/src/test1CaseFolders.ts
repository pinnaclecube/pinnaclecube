/**
 * test1CaseFolders.ts — Regression Test 1
 *
 * Creates a temporary profile + case, provisions the full Drive folder tree
 * inside the Shared Drive, verifies placement, then cleans up everything.
 *
 * Run: pnpm --filter @workspace/scripts run test1:folders
 */

import pg from "pg";
import { google } from "googleapis";

// ─── Config ──────────────────────────────────────────────────────────────────

const SHARED_DRIVE_ID = process.env.DRIVE_ROOT_FOLDER_ID;
if (!SHARED_DRIVE_ID) { console.error("ERROR: DRIVE_ROOT_FOLDER_ID not set"); process.exit(1); }
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!SA_JSON) { console.error("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }

// ─── EB1A folder config (mirrors driveFolderConfig.ts) ───────────────────────

const TOP_LEVEL = [
  { name: "Resume",      type: "resume"      },
  { name: "Evidence",    type: "evidence"    },
  { name: "Demographics",type: "demographics"},
  { name: "Exhibits",    type: "exhibits"    },
];

const EB1A_CRITERIA = [
  { name: "Extraordinary Ability Awards",      index: 0 },
  { name: "Membership in Associations",         index: 1 },
  { name: "Published Material About the Alien", index: 2 },
  { name: "Judge of Others' Work",              index: 3 },
  { name: "Original Contributions",             index: 4 },
  { name: "Scholarly Articles",                 index: 5 },
  { name: "Artistic Exhibitions",               index: 6 },
  { name: "Leading or Critical Role",           index: 7 },
  { name: "High Salary",                        index: 8 },
  { name: "Commercial Success",                 index: 9 },
];

// ─── Drive client ─────────────────────────────────────────────────────────────

const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(SA_JSON) as Record<string, unknown>,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

async function createDriveFolder(name: string, parentId: string): Promise<{ driveId: string; driveUrl: string }> {
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id,webViewLink",
  });
  const driveId = res.data.id;
  const driveUrl = res.data.webViewLink;
  if (!driveId || !driveUrl) throw new Error(`Drive folder creation returned incomplete data for "${name}"`);
  return { driveId, driveUrl };
}

async function getDriveFileInfo(driveId: string): Promise<{ name: string; parents: string[]; driveId: string }> {
  const res = await drive.files.get({
    fileId: driveId,
    fields: "id,name,parents,driveId",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return { name: res.data.name ?? "", parents: res.data.parents ?? [], driveId: res.data.driveId ?? "" };
}

async function deleteDriveFolder(driveId: string): Promise<void> {
  await drive.files.delete({ fileId: driveId, supportsAllDrives: true });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  const TEMP_EMAIL = "regression-test-temp@pinnacle3-test.invalid";
  let tempProfileId: number | null = null;
  let tempCaseId: number | null = null;
  let rootDriveId: string | null = null;
  const errors: string[] = [];

  try {
    // ── Step 1: Create temp profile ──────────────────────────────────────────
    console.log("[T1] Inserting temp profile...");
    const profRes = await pool.query<{ id: number }>(`
      INSERT INTO profiles (email, name, password_hash, must_change_password,
        disclaimer_version, profession, years_experience, current_status)
      VALUES ($1, $2, $3, false, '1', 'Software Engineer', 5, 'H-1B')
      RETURNING id
    `, [TEMP_EMAIL, "Regression Test User", "not-a-real-hash"]);
    tempProfileId = profRes.rows[0]!.id;
    console.log(`[T1] Profile created: id=${tempProfileId}`);

    // ── Step 2: Create temp case ─────────────────────────────────────────────
    console.log("[T1] Inserting temp case_petition_setup...");
    const caseRes = await pool.query<{ id: number }>(`
      INSERT INTO case_petition_setup (profile_id, visa_path, drive_sync_status, created_by_staff)
      VALUES ($1, 'EB1A', 'pending', 'regression-test')
      RETURNING id
    `, [tempProfileId]);
    tempCaseId = caseRes.rows[0]!.id;
    console.log(`[T1] Case created: id=${tempCaseId}`);

    // ── Step 3: Create Drive folders (mirrors createCaseFolders logic) ───────
    console.log(`[T1] Creating root folder in Shared Drive ${SHARED_DRIVE_ID}...`);
    const rootName = `Regression Test User — Case ${tempCaseId}`;
    const rootDrive = await createDriveFolder(rootName, SHARED_DRIVE_ID!);
    rootDriveId = rootDrive.driveId;
    console.log(`[T1] Root folder created: ${rootDriveId}`);

    // Insert root folder row
    const rootRow = await pool.query<{ id: number }>(`
      INSERT INTO case_folders (case_id, name, folder_type, parent_folder_id,
        drive_id, drive_url, visa_category, criteria_index)
      VALUES ($1, $2, 'root', NULL, $3, $4, 'EB1A', NULL)
      RETURNING id
    `, [tempCaseId, rootName, rootDrive.driveId, rootDrive.driveUrl]);
    const rootDbId = rootRow.rows[0]!.id;

    // Create top-level folders
    let evidenceDriveId: string | null = null;
    let evidenceDbId: number | null = null;

    for (const folder of TOP_LEVEL) {
      const fd = await createDriveFolder(folder.name, rootDrive.driveId);
      const fr = await pool.query<{ id: number }>(`
        INSERT INTO case_folders (case_id, name, folder_type, parent_folder_id,
          drive_id, drive_url, visa_category, criteria_index)
        VALUES ($1, $2, $3, $4, $5, $6, 'EB1A', NULL)
        RETURNING id
      `, [tempCaseId, folder.name, folder.type, rootDbId, fd.driveId, fd.driveUrl]);
      if (folder.type === "evidence") {
        evidenceDriveId = fd.driveId;
        evidenceDbId = fr.rows[0]!.id;
      }
      console.log(`[T1]   Created ${folder.type}: ${fd.driveId}`);
    }

    if (!evidenceDriveId || !evidenceDbId) throw new Error("Evidence folder not created");

    // Create criteria folders inside Evidence
    for (const crit of EB1A_CRITERIA) {
      const cd = await createDriveFolder(crit.name, evidenceDriveId);
      await pool.query(`
        INSERT INTO case_folders (case_id, name, folder_type, parent_folder_id,
          drive_id, drive_url, visa_category, criteria_index)
        VALUES ($1, $2, 'criteria', $3, $4, $5, 'EB1A', $6)
      `, [tempCaseId, crit.name, evidenceDbId, cd.driveId, cd.driveUrl, crit.index]);
    }
    console.log(`[T1] All folders created in Drive and DB`);

    // Mark synced
    await pool.query(`UPDATE case_petition_setup SET drive_sync_status='synced' WHERE id=$1`, [tempCaseId]);

    // ── Step 4: Verify root folder is directly inside Shared Drive ───────────
    console.log(`[T1] Verifying root folder ${rootDriveId} is inside Shared Drive ${SHARED_DRIVE_ID}...`);
    const info = await getDriveFileInfo(rootDriveId);
    const inSharedDrive = info.parents.includes(SHARED_DRIVE_ID!);

    // ── Step 5: Count DB rows ────────────────────────────────────────────────
    const countRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*) as count FROM case_folders WHERE case_id = $1
    `, [tempCaseId]);
    const folderCount = parseInt(countRes.rows[0]!.count, 10);

    const syncRes = await pool.query<{ drive_sync_status: string }>(`
      SELECT drive_sync_status FROM case_petition_setup WHERE id=$1
    `, [tempCaseId]);

    // ── Step 6: Print result table ───────────────────────────────────────────
    const allFolders = await pool.query(`
      SELECT folder_type, name, drive_id FROM case_folders WHERE case_id=$1 ORDER BY id
    `, [tempCaseId]);

    console.log("\n[T1] RESULT SUMMARY:");
    console.log(`  DB rows created:     ${folderCount}  (expected 15: root + 4 top-level + 10 criteria)`);
    console.log(`  drive_sync_status:   ${syncRes.rows[0]?.drive_sync_status}`);
    console.log(`  Root folder Drive ID:${rootDriveId}`);
    console.log(`  Root parents:        ${JSON.stringify(info.parents)}`);
    console.log(`  In Shared Drive:     ${inSharedDrive ? "YES" : "NO"}`);
    console.log(`  Root driveId field:  ${info.driveId} (matches shared drive: ${info.driveId === SHARED_DRIVE_ID})`);

    for (const row of allFolders.rows as Array<{ folder_type: string; name: string; drive_id: string }>) {
      console.log(`    [${row.folder_type.padEnd(10)}] ${row.name.padEnd(37)} ${row.drive_id}`);
    }

    if (!inSharedDrive) {
      errors.push(`Root folder parent ${JSON.stringify(info.parents)} does not include Shared Drive ${SHARED_DRIVE_ID}`);
    }
    if (folderCount !== 15) {
      errors.push(`Expected 15 DB rows, got ${folderCount}`);
    }

  } finally {
    console.log("\n[T1] CLEANUP:");

    // Delete root Drive folder (recursive — children are inside it)
    if (rootDriveId) {
      try {
        await deleteDriveFolder(rootDriveId);
        console.log(`  Deleted Drive root folder: ${rootDriveId}`);
      } catch (e: unknown) {
        console.log(`  Drive delete failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Delete DB rows
    if (tempCaseId !== null) {
      await pool.query(`DELETE FROM case_folders WHERE case_id=$1`, [tempCaseId]);
      await pool.query(`DELETE FROM case_petition_setup WHERE id=$1`, [tempCaseId]);
      console.log(`  Deleted DB rows for case ${tempCaseId}`);
    }
    if (tempProfileId !== null) {
      await pool.query(`DELETE FROM profiles WHERE id=$1`, [tempProfileId]);
      console.log(`  Deleted profile ${tempProfileId}`);
    }

    await pool.end();
  }

  if (errors.length > 0) {
    console.error("\n[T1] FAILURES:");
    for (const e of errors) console.error("  ✗", e);
    process.exit(1);
  } else {
    console.log("\n[T1] ALL CHECKS PASSED");
  }
}

main().catch(err => {
  console.error("[T1] FATAL:", err);
  process.exit(1);
});
