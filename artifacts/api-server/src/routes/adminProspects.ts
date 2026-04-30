/**
 * adminProspects.ts — Pinnacle³
 *
 * Staff-only prospect management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  prospectsTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail, prospectInviteEmail } from "../services/emailService";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── List prospects ────────────────────────────────────────────────────────────

router.get(
  "/admin/prospects",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const prospects = await db.select().from(prospectsTable).orderBy(desc(prospectsTable.createdAt));
    res.json({ prospects, total: prospects.length });
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
