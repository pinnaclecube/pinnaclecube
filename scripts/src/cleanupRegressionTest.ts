/**
 * cleanupRegressionTest.ts — Deletes T2/T5 Drive items and their DB rows.
 * One-shot cleanup; safe to re-run.
 */

import pg from "pg";
import { google } from "googleapis";

const DATABASE_URL = process.env.DATABASE_URL!;
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;

const driveAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(SA_JSON) as Record<string, unknown>,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

const T2_FOLDER_DRIVE_ID = "1-3osfaG-qpfQlij1xI9GEjmi4L5hxl6V";
const T5_FILE_DRIVE_ID   = "1NWIe1dXmE8pTXBUvzOEgfc8D60aoj8dT";

async function deleteDriveItem(id: string, label: string): Promise<void> {
  try {
    await drive.files.delete({ fileId: id, supportsAllDrives: true });
    console.log(`  Deleted Drive item (${label}): ${id}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404") || msg.includes("File not found")) {
      console.log(`  Already gone (${label}): ${id}`);
    } else {
      console.log(`  Drive delete failed (${label}): ${msg}`);
    }
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    // Delete from Drive
    await deleteDriveItem(T2_FOLDER_DRIVE_ID, "T2 subfolder");
    await deleteDriveItem(T5_FILE_DRIVE_ID,   "T5 file");

    // Delete T2 DB row from case_folders
    const t2Del = await pool.query(
      `DELETE FROM case_folders WHERE drive_id = $1 RETURNING id, name`,
      [T2_FOLDER_DRIVE_ID]
    );
    if (t2Del.rowCount && t2Del.rowCount > 0) {
      console.log(`  Deleted case_folders row for T2: id=${(t2Del.rows[0] as {id:number}).id}`);
    } else {
      console.log(`  T2 case_folders row already gone`);
    }

    // Delete T5 DB row from case_folder_items
    const t5Del = await pool.query(
      `DELETE FROM case_folder_items WHERE drive_id = $1 RETURNING id, name`,
      [T5_FILE_DRIVE_ID]
    );
    if (t5Del.rowCount && t5Del.rowCount > 0) {
      console.log(`  Deleted case_folder_items row for T5: id=${(t5Del.rows[0] as {id:number}).id}`);
    } else {
      console.log(`  T5 case_folder_items row already gone`);
    }

    console.log("\nCleanup complete.");
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
