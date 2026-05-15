/**
 * driveWebhook.ts — Pinnacle³
 *
 * POST /drive/webhook  — receives Google Drive push notifications
 * GET  /drive/events   — SSE stream for real-time Drive sync updates
 *
 * The SSE endpoint accepts both client (Bearer JWT) and staff (X-Staff-Token)
 * auth so the FolderBrowser component can connect via fetch() with the same
 * auth headers it uses for all other requests (EventSource is avoided because
 * it cannot send custom headers).
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, driveWatchChannelsTable } from "@workspace/db";
import { syncFolderContents } from "../services/driveWatchService";
import { addSseClient, removeSseClient, emitToCase } from "../services/sseService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Combined auth for SSE ────────────────────────────────────────────────────

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) {
    requireStaffAuth(req, res, next);
  } else {
    void requireClientAuth(req, res, next);
  }
}

// ─── POST /drive/webhook ──────────────────────────────────────────────────────
//
// Google Drive calls this URL when files change inside a watched folder.
// No auth — the channelToken header is the verification mechanism.
// Must respond 200 quickly; all processing happens after the response.

router.post("/drive/webhook", (req: Request, res: Response): void => {
  // Acknowledge immediately — Drive requires 2xx within a few seconds
  res.status(200).end();

  const channelId = req.headers["x-goog-channel-id"] as string | undefined;
  const channelToken = req.headers["x-goog-channel-token"] as string | undefined;
  const resourceState = req.headers["x-goog-resource-state"] as string | undefined;

  logger.info({ channelId, resourceState }, "[driveWebhook] notification received");

  // Drive sends a "sync" ping when the channel is first registered — nothing to do
  if (!channelId || resourceState === "sync") return;

  // Process asynchronously so we don't hold up the ack
  void (async () => {
    try {
      // 1. Look up channel and verify token
      const [channel] = await db
        .select()
        .from(driveWatchChannelsTable)
        .where(eq(driveWatchChannelsTable.channelId, channelId))
        .limit(1);

      if (!channel) {
        logger.warn({ channelId }, "[driveWebhook] unknown channel — ignoring");
        return;
      }

      if (channelToken && channel.channelToken !== channelToken) {
        logger.warn({ channelId }, "[driveWebhook] token mismatch — ignoring");
        return;
      }

      // 2. Sync the watched root folder's direct file children
      const itemCount = await syncFolderContents(channel.driveFolderId);

      // 3. Push real-time update to all SSE clients watching this case
      emitToCase(channel.caseId, "drive_sync", {
        caseId: channel.caseId,
        driveFolderId: channel.driveFolderId,
        itemCount,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        { caseId: channel.caseId, itemCount },
        "[driveWebhook] sync complete and SSE emitted",
      );
    } catch (err) {
      logger.error({ channelId, err }, "[driveWebhook] error processing notification");
    }
  })();
});

// ─── GET /drive/events ────────────────────────────────────────────────────────
//
// SSE stream — subscribe with ?caseId=N to receive real-time drive_sync events.
// Accessible to both authenticated clients and staff. Uses fetch() + streaming
// on the client side (not EventSource) so custom auth headers are forwarded.

router.get(
  "/drive/events",
  requireAnyAuth,
  (req: Request, res: Response): void => {
    const caseId = parseInt(req.query.caseId as string, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ error: "caseId query param is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx / proxy buffering
    res.flushHeaders();

    // Initial handshake event
    res.write("event: connected\ndata: {}\n\n");

    addSseClient(caseId, res);

    // Keep-alive comment every 30 s (prevents proxy timeouts)
    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(ping);
      }
    }, 30_000);

    req.on("close", () => {
      clearInterval(ping);
      removeSseClient(caseId, res);
    });
  },
);

export default router;
