/**
 * actionItems.ts — Pinnacle³
 *
 * Client-facing action-item endpoints (JWT-authenticated).
 *
 * GET  /action-items         — list all action items for the authenticated client
 * PATCH /action-items/:id/complete — mark an action item complete, optionally with a note
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, clientActionItemsTable, profilesTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { sendEmail, taskCompletedStaffAlertEmail } from "../services/emailService";
import { insertStaffNotification } from "../services/staffNotificationService";
import { z } from "zod";

const router: IRouter = Router();

const STAFF_EMAIL = "support@pinnaclecube.com";
const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";

// ─── GET /action-items ────────────────────────────────────────────────────────

router.get(
  "/action-items",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = (req as any).clientUser.id;

    const items = await db
      .select({
        id: clientActionItemsTable.id,
        profileId: clientActionItemsTable.profileId,
        title: clientActionItemsTable.title,
        description: clientActionItemsTable.description,
        priority: clientActionItemsTable.priority,
        status: clientActionItemsTable.status,
        adminNotes: clientActionItemsTable.adminNotes,
        sentAt: clientActionItemsTable.sentAt,
        clientCompletedAt: clientActionItemsTable.clientCompletedAt,
        adminCompletedAt: clientActionItemsTable.adminCompletedAt,
        createdAt: clientActionItemsTable.createdAt,
      })
      .from(clientActionItemsTable)
      .where(eq(clientActionItemsTable.profileId, profileId))
      .orderBy(desc(clientActionItemsTable.createdAt));

    res.json({ actionItems: items });
  },
);

// ─── PATCH /action-items/:id/complete ────────────────────────────────────────

const CompleteBody = z.object({
  note: z.string().max(2000).optional(),
});

router.patch(
  "/action-items/:id/complete",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid action item ID" });
      return;
    }

    const parsed = CompleteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }

    const profileId = (req as any).clientUser.id;

    // Verify the item exists and belongs to this client
    const [existing] = await db
      .select()
      .from(clientActionItemsTable)
      .where(
        and(
          eq(clientActionItemsTable.id, id),
          eq(clientActionItemsTable.profileId, profileId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Action item not found" });
      return;
    }

    if (existing.status === "cancelled") {
      res.status(409).json({ error: "Cannot complete a cancelled action item" });
      return;
    }

    // Build adminNotes — prepend client note if provided, preserve any existing notes
    const clientNote = parsed.data.note?.trim();
    const notePrefix = clientNote ? `Client note: ${clientNote}` : null;
    const updatedNotes = [notePrefix, existing.adminNotes]
      .filter(Boolean)
      .join("\n\n") || null;

    const now = new Date();

    const [updated] = await db
      .update(clientActionItemsTable)
      .set({
        status: "completed",
        clientCompletedAt: now,
        adminNotes: updatedNotes,
      })
      .where(
        and(
          eq(clientActionItemsTable.id, id),
          eq(clientActionItemsTable.profileId, profileId),
        ),
      )
      .returning({
        id: clientActionItemsTable.id,
        profileId: clientActionItemsTable.profileId,
        title: clientActionItemsTable.title,
        description: clientActionItemsTable.description,
        priority: clientActionItemsTable.priority,
        status: clientActionItemsTable.status,
        adminNotes: clientActionItemsTable.adminNotes,
        sentAt: clientActionItemsTable.sentAt,
        clientCompletedAt: clientActionItemsTable.clientCompletedAt,
        adminCompletedAt: clientActionItemsTable.adminCompletedAt,
        createdAt: clientActionItemsTable.createdAt,
      });

    if (!updated) {
      res.status(500).json({ error: "Failed to update action item" });
      return;
    }

    // Fetch client name for the staff alert email
    const [profile] = await db
      .select({ name: profilesTable.name, firstName: profilesTable.firstName, id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId))
      .limit(1);

    const clientName = profile?.name ?? profile?.firstName ?? "Client";
    const caseUrl = `${APP_URL}/internal/cases/${profileId}`;

    sendEmail(
      STAFF_EMAIL,
      taskCompletedStaffAlertEmail(clientName, updated.title, now, clientNote ?? null, caseUrl),
    ).catch(() => {});

    void insertStaffNotification(
      "Task Completed ✓",
      `${clientName} completed: ${updated.title}`,
      `/internal/case/${profileId}`,
    );

    res.json({ actionItem: updated });
  },
);

export default router;
