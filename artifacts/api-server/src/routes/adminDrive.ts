/**
 * adminDrive.ts — Pinnacle³
 *
 * Staff-only Drive management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { isNull, inArray, and, eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { autoProvisionDrive } from "../services/googleDrive";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Shared query ─────────────────────────────────────────────────────────────
// Returns all profiles that need Drive provisioning:
//   - driveSyncStatus IS NULL (never been attempted)
//   - accessLevel is one of the two products that include Drive (Evidence Vault
//     or Elite Blueprint)

const DRIVE_ELIGIBLE_ACCESS_LEVELS = ["evidence_vault", "elite_blueprint"] as const;

async function fetchUnprovisionedProfiles() {
  return db
    .select({
      id: profilesTable.id,
      email: profilesTable.email,
      name: profilesTable.name,
      visaTarget: profilesTable.visaTarget,
      accessLevel: profilesTable.accessLevel,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .where(
      and(
        isNull(profilesTable.driveSyncStatus),
        inArray(profilesTable.accessLevel, [...DRIVE_ELIGIBLE_ACCESS_LEVELS]),
      ),
    );
}

// ─── GET /admin/drive/backfill/preview ────────────────────────────────────────
// Dry-run: returns the list of profiles that would be provisioned without
// making any Drive API calls. Run this first to review scope before backfilling.

router.get(
  "/admin/drive/backfill/preview",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const profiles = await fetchUnprovisionedProfiles();
    res.json({ count: profiles.length, profiles });
  },
);

// ─── POST /admin/drive/backfill ───────────────────────────────────────────────
// Provisions Drive workspaces for all eligible profiles that have none yet.
// Responds immediately with the list of profiles queued; provisioning runs in
// the background sequentially with a 2-second delay between each to stay within
// Drive API rate limits.
//
// Safe to re-run: profiles that already have driveSyncStatus set are excluded
// by the query, and autoProvisionDrive uses upsert logic inside Drive.

router.post(
  "/admin/drive/backfill",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profiles = await fetchUnprovisionedProfiles();

    req.log.info({ count: profiles.length }, "[drive/backfill] Starting Drive backfill");

    res.json({
      message: `Backfill started for ${profiles.length} profile(s).`,
      profiles: profiles.map((p) => ({ profileId: p.id, email: p.email })),
    });

    (async () => {
      for (const profile of profiles) {
        // autoProvisionDrive handles its own retry and catches all errors
        // internally, updating driveSyncStatus to "synced" or "failed".
        // The authoritative result is the driveSyncStatus column — check
        // it after the call to log the real outcome.
        await autoProvisionDrive(profile.id, profile.email, profile.visaTarget);

        const [updated] = await db
          .select({ driveSyncStatus: profilesTable.driveSyncStatus })
          .from(profilesTable)
          .where(eq(profilesTable.id, profile.id))
          .limit(1);

        const status = updated?.driveSyncStatus ?? "unknown";
        const level = status === "synced" ? "info" : "error";
        logger[level](
          { profileId: profile.id, email: profile.email, driveSyncStatus: status },
          "[drive/backfill] Profile processed",
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      }

      logger.info({ count: profiles.length }, "[drive/backfill] Backfill complete");
    })().catch((err) => {
      logger.error({ err }, "[drive/backfill] Unexpected error in background loop");
    });
  },
);

export default router;
