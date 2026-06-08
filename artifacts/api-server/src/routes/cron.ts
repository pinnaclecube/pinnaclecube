/**
 * cron.ts — Pinnacle³
 *
 * Scheduled-job endpoints invoked by Vercel Cron (see `crons` in vercel.json).
 *
 * On Replit these ran as in-process `setInterval` loops started after
 * `app.listen()`. Serverless functions are stateless and short-lived, so the
 * same work is triggered by Vercel Cron issuing a GET request on a schedule.
 *
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron
 * requests when the `CRON_SECRET` env var is set. We reject anything that does
 * not carry the matching bearer so these endpoints can't be triggered publicly.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { purgeExpiredPendingGrants } from "../services/pendingGrantsCleanup";
import { renewExpiringSoonChannels } from "../services/driveWatchService";
import { seedReferenceData } from "../services/seedReferenceData";

const router: IRouter = Router();

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  return req.get("authorization") === `Bearer ${secret}`;
}

/** Wrap a job so cron endpoints share auth, logging, and error handling. */
function cronHandler(name: string, job: () => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!isAuthorizedCron(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const startedAt = Date.now();
    try {
      await job();
      const durationMs = Date.now() - startedAt;
      logger.info({ job: name, durationMs }, "[cron] job completed");
      res.json({ ok: true, job: name, durationMs });
    } catch (err) {
      logger.error({ err, job: name }, "[cron] job failed");
      res.status(500).json({ ok: false, job: name, error: "job failed" });
    }
  };
}

// Renew Google Drive watch channels expiring within the lookahead window.
// Was: startDriveChannelRenewal() every 24h.
router.get(
  "/cron/drive-channel-renewal",
  cronHandler("drive-channel-renewal", renewExpiringSoonChannels),
);

// Purge pending access grants older than 48h.
// Was: startPendingGrantsCleanup() every 6h.
router.get(
  "/cron/pending-grants-cleanup",
  cronHandler("pending-grants-cleanup", purgeExpiredPendingGrants),
);

// Seed reference data (visa_criteria etc.) + fix orphaned access.
// Was: run once after app.listen(). Idempotent — safe to invoke post-deploy
// and on a schedule. Trigger manually after each deploy if you prefer.
router.get("/cron/seed", cronHandler("seed", seedReferenceData));

export default router;
