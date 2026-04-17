import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";

const router = Router();

router.get("/notifications", requireClientAuth, async (req: any, res): Promise<void> => {
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

router.patch("/notifications/:id/read", requireClientAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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

router.post("/notifications/read-all", requireClientAuth, async (req: any, res): Promise<void> => {
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

router.delete("/notifications/:id", requireClientAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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
