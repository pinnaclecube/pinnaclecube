/**
 * adminProspects.ts — Pinnacle³
 *
 * Staff-only prospect management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, inArray, getTableColumns } from "drizzle-orm";
import {
  db,
  prospectsTable,
  purchasesTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail, prospectInviteEmail } from "../services/emailService";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── List prospects ────────────────────────────────────────────────────────────

// linkStatus values:
//   "paid"    — paymentReceivedAt is set (or purchase row is "completed")
//   "active"  — invoiceStripeSessionId present and purchase row status is "pending"
//   "expired" — invoiceStripeSessionId present and purchase row status is "expired"
//   "sent"    — invoiceSentAt set but no session ID stored (legacy/edge case)
//   null      — no invoice sent
type LinkStatus = "paid" | "active" | "expired" | "sent" | null;

function computeLinkStatus(
  p: { paymentReceivedAt: Date | null; invoiceSentAt: Date | null; invoiceStripeSessionId: string | null },
  purchaseStatusMap: Map<string, string>,
): LinkStatus {
  if (p.paymentReceivedAt) return "paid";
  if (!p.invoiceSentAt) return null;
  // Invoice was sent but session ID wasn't recorded (pre-migration row).
  if (!p.invoiceStripeSessionId) return "sent";
  const status = purchaseStatusMap.get(p.invoiceStripeSessionId);
  if (status === "pending") return "active";
  if (status === "expired") return "expired";
  if (status === "completed") return "paid";
  // Session ID stored but no matching purchase row — shouldn't happen in practice.
  return "sent";
}

router.get(
  "/admin/prospects",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    // Exclude roadmapUploadedData (large base64) from list responses — it's only
    // needed server-side for email attachments and on the individual detail page.
    const { roadmapUploadedData: _omit, ...listCols } = getTableColumns(prospectsTable);
    const prospects = await db.select(listCols).from(prospectsTable).orderBy(desc(prospectsTable.createdAt));

    // Enrich prospects that have invoices with the DB-level purchase status for
    // their specific session. Join by invoiceStripeSessionId → purchasesTable.stripeSessionId
    // so we get the exact session that was invoiced, not just any session for that email.
    const purchaseStatusMap = new Map<string, string>();
    const sessionIds = prospects
      .map((p) => p.invoiceStripeSessionId)
      .filter((id): id is string => Boolean(id));

    if (sessionIds.length > 0) {
      const purchases = await db
        .select({
          stripeSessionId: purchasesTable.stripeSessionId,
          status: purchasesTable.status,
        })
        .from(purchasesTable)
        .where(inArray(purchasesTable.stripeSessionId, sessionIds));

      for (const row of purchases) {
        if (row.stripeSessionId) {
          purchaseStatusMap.set(row.stripeSessionId, row.status ?? "pending");
        }
      }
    }

    const prospectsWithStatus = prospects.map((p) => ({
      ...p,
      linkStatus: computeLinkStatus(p, purchaseStatusMap) as LinkStatus,
    }));

    res.json({ prospects: prospectsWithStatus, total: prospectsWithStatus.length });
  },
);

// ─── Create prospect ───────────────────────────────────────────────────────────

const CreateProspectBody = z.object({
  fullName: z.string().min(1),
  email: z.string().optional().default(""),
  phone: z.string().optional(),
  currentRole: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fieldOfWork: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  sourceType: z.string().optional(),
  internalNotes: z.string().optional(),
  publicationsSignal: z.boolean().optional(),
  awardsSignal: z.boolean().optional(),
  leadershipSignal: z.boolean().optional(),
});

router.post(
  "/admin/prospects",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateProspectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const [prospect] = await db.insert(prospectsTable).values({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      currentRole: parsed.data.currentRole ?? null,
      linkedinUrl: parsed.data.linkedinUrl ?? null,
      fieldOfWork: parsed.data.fieldOfWork ?? null,
      yearsOfExperience: parsed.data.yearsOfExperience ?? null,
      sourceType: parsed.data.sourceType ?? "manual",
      internalNotes: parsed.data.internalNotes ?? null,
      publicationsSignal: parsed.data.publicationsSignal ?? false,
      awardsSignal: parsed.data.awardsSignal ?? false,
      leadershipSignal: parsed.data.leadershipSignal ?? false,
      status: "new",
      registrationStatus: "not_invited",
    }).returning();

    res.json({ prospect });
  },
);

// ─── Get prospect ──────────────────────────────────────────────────────────────

router.get(
  "/admin/prospects/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

    res.json({ prospect });
  },
);

// ─── Update prospect ───────────────────────────────────────────────────────────

const UpdateProspectBody = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  currentRole: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fieldOfWork: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  sourceType: z.string().optional(),
  internalNotes: z.string().optional(),
  status: z.enum(["new", "in_contact", "qualified", "not_qualified", "converted"]).optional(),
  publicationsSignal: z.boolean().optional(),
  awardsSignal: z.boolean().optional(),
  leadershipSignal: z.boolean().optional(),
  ownerStaffUser: z.string().optional(),
  summary: z.string().optional(),
});

router.patch(
  "/admin/prospects/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const parsed = UpdateProspectBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) updates[k] = v;
    }

    const [updated] = await db.update(prospectsTable).set(updates).where(eq(prospectsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Prospect not found" }); return; }

    res.json({ prospect: updated });
  },
);

// ─── Delete prospect ───────────────────────────────────────────────────────────

router.delete(
  "/admin/prospects/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [deleted] = await db
      .delete(prospectsTable)
      .where(eq(prospectsTable.id, id))
      .returning({ id: prospectsTable.id });

    if (!deleted) { res.status(404).json({ error: "Prospect not found" }); return; }

    res.json({ success: true });
  },
);

// ─── Invite prospect ───────────────────────────────────────────────────────────

router.post(
  "/admin/prospects/:id/invite",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

    await db.update(prospectsTable).set({
      registrationStatus: "invited",
      status: prospect.status === "new" ? "in_contact" : prospect.status,
    }).where(eq(prospectsTable.id, id));

    const registrationLink = `${process.env.FRONTEND_URL ?? "https://pinnaclecube.com"}/register?invite=${encodeURIComponent(prospect.email)}`;
    const firstName = prospect.fullName.split(" ")[0] ?? prospect.fullName;

    void sendEmail(prospect.email, prospectInviteEmail(firstName, registrationLink));
    console.info(`[adminProspects] Invitation email sent to ${prospect.email} (prospect #${id})`);

    res.json({
      success: true,
      message: `Registration invite sent to ${prospect.email}`,
      registrationLink,
    });
  },
);

export default router;
