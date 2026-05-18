import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { addProfileSseClient, removeProfileSseClient } from "../services/sseService";
import { z } from "zod";

const router = Router();

router.get("/notifications", requireClientAuth, async (req: any, res: Response): Promise<void> => {
  const notifications = await db.select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.profileId, req.clientUser.id),
        eq(notificationsTable.userType, "client"),
      )
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json({ notifications });
});

// ─── GET /notifications/stream ────────────────────────────────────────────────
//
// SSE stream for real-time client notification bell updates.
// Uses fetch() + ReadableStream on the client (not EventSource) so the
// Bearer JWT can be forwarded in the Authorization header.

router.get(
  "/notifications/stream",
  requireClientAuth,
  (req: any, res: Response): void => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write("event: connected\ndata: {}\n\n");

    const profileId = req.clientUser.id as number;
    addProfileSseClient(profileId, res);

    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 30_000);

    req.on("close", () => {
      clearInterval(ping);
      removeProfileSseClient(profileId, res);
    });
  },
);

router.patch("/notifications/:id/read", requireClientAuth, async (req: any, res: Response): Promise<void> => {
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
        eq(notificationsTable.profileId, req.clientUser.id),
      )
    )
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json({ notification });
});

router.post("/notifications/read-by-type", requireClientAuth, async (req: any, res: Response): Promise<void> => {
  const parsed = z.object({ type: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing required field: type" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ status: "read" })
    .where(
      and(
        eq(notificationsTable.profileId, req.clientUser.id),
        eq(notificationsTable.status, "unread"),
        eq(notificationsTable.userType, "client"),
        eq(notificationsTable.notificationType, parsed.data.type),
      )
    );

  res.json({ success: true });
});

router.post("/notifications/read-all", requireClientAuth, async (req: any, res: Response): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ status: "read" })
    .where(
      and(
        eq(notificationsTable.profileId, req.clientUser.id),
        eq(notificationsTable.status, "unread"),
        eq(notificationsTable.userType, "client"),
      )
    );

  res.json({ success: true });
});

router.delete("/notifications/:id", requireClientAuth, async (req: any, res: Response): Promise<void> => {
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
        eq(notificationsTable.profileId, req.clientUser.id),
      )
    );

  res.json({ success: true });
});

export default router;
