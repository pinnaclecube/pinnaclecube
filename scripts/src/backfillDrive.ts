/**
 * backfillDrive.ts — Pinnacle³
 *
 * One-time backfill script: provisions Google Drive workspaces for all existing
 * clients who have Evidence Vault or Elite Blueprint access but no Drive folder
 * yet (driveSyncStatus IS NULL).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill:drive
 *
 * Required environment variables (same as the API server):
 *   API_BASE_URL  — base URL of the running API server, e.g. http://localhost:80
 *   STAFF_SECRET  — value of the X-Staff-Token header used to authenticate
 *
 * The script calls POST /api/admin/drive/backfill on the API server, which
 * handles the actual provisioning. Run GET /api/admin/drive/backfill/preview
 * first to see which profiles would be affected without making changes.
 *
 * Safe to re-run — the endpoint skips profiles that already have driveSyncStatus
 * set (null check) and autoProvisionDrive uses upsert logic in Drive.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:80";
const STAFF_SECRET = process.env.STAFF_SECRET;

if (!STAFF_SECRET) {
  console.error("[backfillDrive] ERROR: STAFF_SECRET env var is required.");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Staff-Token": STAFF_SECRET,
};

async function previewBackfill(): Promise<number> {
  console.log("[backfillDrive] Fetching dry-run preview...");
  const res = await fetch(`${API_BASE_URL}/api/admin/drive/backfill/preview`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Preview request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    count: number;
    profiles: Array<{
      id: number;
      email: string;
      name: string;
      visaTarget: string;
      accessLevel: string;
      driveSyncStatus: string | null;
      createdAt: string;
    }>;
  };

  console.log(`[backfillDrive] ${data.count} profile(s) need Drive provisioning:\n`);

  if (data.count === 0) {
    console.log("  (none — all eligible clients already have driveSyncStatus set)");
  } else {
    for (const p of data.profiles) {
      console.log(`  • [${p.id}] ${p.email} — ${p.name} (${p.accessLevel}, ${p.visaTarget})`);
    }
  }

  console.log("");
  return data.count;
}

async function runBackfill(): Promise<void> {
  console.log("[backfillDrive] Sending backfill request to API server...");
  const res = await fetch(`${API_BASE_URL}/api/admin/drive/backfill`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backfill request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    message: string;
    profiles: Array<{ profileId: number; email: string; status: string }>;
  };

  console.log(`[backfillDrive] ${data.message}`);
  console.log(
    "[backfillDrive] Provisioning is running in the background on the API server.",
  );
  console.log(
    "[backfillDrive] Check the API server logs for per-profile [drive/backfill] entries.",
  );
  console.log(
    "[backfillDrive] Re-run this script (preview mode) after ~30 s to confirm all statuses are set.",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--preview");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Pinnacle³ — Drive Workspace Backfill   ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  API:  ${API_BASE_URL}`);
  console.log(`  Mode: ${dryRun ? "preview (dry-run)" : "live"}\n`);

  const count = await previewBackfill();

  if (dryRun) {
    console.log("[backfillDrive] Dry-run complete — pass no flags to run for real.");
    return;
  }

  if (count === 0) {
    console.log("[backfillDrive] Nothing to do.");
    return;
  }

  await runBackfill();
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[backfillDrive] Fatal error: ${msg}`);
  process.exit(1);
});
