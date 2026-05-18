/**
 * adminNotifications.ts — Pinnacle³
 *
 * Staff notification endpoints (all require X-Staff-Token).
 *
 * GET    /admin/notifications          — list staff notifications (newest first, limit 50)
 * GET    /admin/notifications/stream   — SSE stream for real-time badge updates
 * PATCH  /admin/notifications/:id/read — mark one notification read
 * POST   /admin/notifications/read-all — mark all staff notifications read
 * DELETE /admin/notifications/:id      — delete a notification
 */

import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { addStaffSseClient, removeStaffSseClient } from "../services/sseService";

const router = Router();

router.get(
  "/admin/notifications",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userType, "staff"))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json({ notifications });
  },
);

// ─── GET /admin/notifications/stream ─────────────────────────────────────────
//
// SSE stream for real-time staff notification bell updates.
// Registered before /:id routes so the path "stream" isn't parsed as an id.

router.get(
  "/admin/notifications/stream",
  requireStaffAuth,
  (req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write("event: connected\ndata: {}\n\n");

    addStaffSseClient(res);

    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 30_000);

    req.on("close", () => {
      clearInterval(ping);
      removeStaffSseClient(res);
    });
  },
);

router.patch(
  "/admin/notifications/:id/read",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    const [notification] = await db
      .update(notificationsTable)
      .set({ status: "read" })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userType, "staff"),
        ),
      )
      .returning();

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ notification });
  },
);

router.post(
  "/admin/notifications/read-all",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    await db
      .update(notificationsTable)
      .set({ status: "read" })
      .where(
        and(
          eq(notificationsTable.userType, "staff"),
          eq(notificationsTable.status, "unread"),
        ),
      );

    res.json({ success: true });
  },
);

router.delete(
  "/admin/notifications/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    await db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userType, "staff"),
        ),
      );

    res.json({ success: true });
  },
);

export default router;
