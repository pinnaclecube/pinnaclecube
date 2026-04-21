import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import {
  db,
  applicationsTable,
  profilesTable,
  clientUserProductsTable,
  activityTable,
  clientActivityLogTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { z } from "zod/v4";
import { sendEmail, blueprintApprovedEmail, blueprintDeclinedEmail } from "../services/emailService";

const router: IRouter = Router();

const VALID_STATUSES = [
  "submitted",
  "under_review",
  "needs_more_info",
  "approved",
  "declined",
  "access_granted",
] as const;

const VALID_PAYMENT_STATUSES = ["pending", "received", "waived"] as const;

const STATUS_MESSAGES: Record<string, string> = {
  approved: "Great news — your application has been approved. Next step: payment.",
  needs_more_info: "We need a bit more information about your application.",
  declined: "Thank you for applying — we're unable to proceed at this time.",
};

async function notifyClient(
  profileId: number | null | undefined,
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  if (!profileId) return;
  try {
    await db.insert(clientActivityLogTable).values({
      profileId,
      eventType,
      eventData: { message, ...metadata },
    });
    await db.insert(activityTable).values({
      profileId,
      type: eventType,
      description: message,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("[adminBlueprint] notification error:", err);
  }
}

router.get(
  "/internal/blueprint-applications",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const applications = await db
      .select({
        id: applicationsTable.id,
        fullName: applicationsTable.fullName,
        email: applicationsTable.email,
        currentRole: applicationsTable.currentRole,
        visaPath: applicationsTable.visaPath,
        field: applicationsTable.field,
        status: applicationsTable.status,
        paymentStatus: applicationsTable.paymentStatus,
        adminConfidenceScore: applicationsTable.adminConfidenceScore,
        adminEstimatedTimeline: applicationsTable.adminEstimatedTimeline,
        profileId: applicationsTable.profileId,
        createdAt: applicationsTable.createdAt,
        adminReviewedAt: applicationsTable.adminReviewedAt,
      })
      .from(applicationsTable)
      .orderBy(desc(applicationsTable.createdAt));

    res.json({ applications, total: applications.length });
  }
);

router.get(
  "/internal/blueprint-applications/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid application ID" });
      return;
    }

    const [application] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .limit(1);

    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    let profile = null;
    if (application.profileId) {
      const [p] = await db
        .select({
          id: profilesTable.id,
          name: profilesTable.name,
          email: profilesTable.email,
          accessLevel: profilesTable.accessLevel,
          visaTarget: profilesTable.visaTarget,
          createdAt: profilesTable.createdAt,
        })
        .from(profilesTable)
        .where(eq(profilesTable.id, application.profileId))
        .limit(1);
      profile = p ?? null;
    }

    res.json({ application, profile });
  }
);

const UpdateStatusBody = z.object({
  status: z.enum(VALID_STATUSES),
  adminReviewNotes: z.string().optional(),
  adminConfidenceScore: z.number().int().min(1).max(10).optional(),
  adminEstimatedTimeline: z.string().optional(),
});

router.patch(
  "/internal/blueprint-applications/:id/status",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid application ID" });
      return;
    }

    const parsed = UpdateStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const { status, adminReviewNotes, adminConfidenceScore, adminEstimatedTimeline } = parsed.data;

    const updateData: Record<string, unknown> = {
      status,
      adminReviewedAt: new Date(),
      adminReviewedBy: "staff",
    };
    if (adminReviewNotes !== undefined) updateData.adminReviewNotes = adminReviewNotes;
    if (adminConfidenceScore !== undefined) updateData.adminConfidenceScore = adminConfidenceScore;
    if (adminEstimatedTimeline !== undefined) updateData.adminEstimatedTimeline = adminEstimatedTimeline;

    const [updated] = await db
      .update(applicationsTable)
      .set(updateData)
      .where(eq(applicationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const message = STATUS_MESSAGES[status];
    if (message && updated.profileId) {
      await notifyClient(updated.profileId, `blueprint_status_${status}`, message, {
        applicationId: id,
        status,
      });
    }

    // Send decision email to applicant
    if (updated.email) {
      const firstName = (updated.fullName ?? updated.email).split(" ")[0];
      if (status === "approved") {
        sendEmail(updated.email, blueprintApprovedEmail(firstName)).catch(() => {});
      } else if (status === "declined") {
        sendEmail(updated.email, blueprintDeclinedEmail(firstName)).catch(() => {});
      }
    }

    console.info(`[staff] Application #${id} status → ${status}`);
    res.json({ success: true, application: updated });
  }
);

const UpdatePaymentBody = z.object({
  paymentStatus: z.enum(VALID_PAYMENT_STATUSES),
  paymentNotes: z.string().optional(),
});

router.patch(
  "/internal/blueprint-applications/:id/payment",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid application ID" });
      return;
    }

    const parsed = UpdatePaymentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const updateData: Record<string, unknown> = {
      paymentStatus: parsed.data.paymentStatus,
    };
    if (parsed.data.paymentNotes !== undefined) updateData.paymentNotes = parsed.data.paymentNotes;
    if (parsed.data.paymentStatus === "received") {
      updateData.paymentReceivedAt = new Date();
      updateData.paymentReceivedBy = "staff";
    }

    const [updated] = await db
      .update(applicationsTable)
      .set(updateData)
      .where(eq(applicationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    console.info(`[staff] Application #${id} payment → ${parsed.data.paymentStatus}`);
    res.json({ success: true, paymentStatus: updated.paymentStatus });
  }
);

const GrantAccessBody = z.object({
  includeExcellenceLab: z.boolean(),
  grantNotes: z.string().optional(),
});

router.post(
  "/internal/blueprint-applications/:id/grant-access",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid application ID" });
      return;
    }

    const parsed = GrantAccessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const { includeExcellenceLab, grantNotes } = parsed.data;

    const [application] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .limit(1);

    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // Guard: must be approved
    if (application.status !== "approved") {
      res.status(400).json({
        error: "Cannot grant access",
        reason: `Application status is '${application.status}'. Must be 'approved' before granting access.`,
      });
      return;
    }

    // Guard: must have payment
    if (!["received", "waived"].includes(application.paymentStatus ?? "")) {
      res.status(400).json({
        error: "Cannot grant access",
        reason: `Payment status is '${application.paymentStatus ?? "pending"}'. Payment must be received or waived.`,
      });
      return;
    }

    if (!application.profileId) {
      res.status(400).json({
        error: "Cannot grant access",
        reason: "Applicant does not have a Pinnacle account yet. Ask them to register first.",
      });
      return;
    }

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, application.profileId))
      .limit(1);

    if (!profile) {
      res.status(400).json({ error: "Profile not found for this application" });
      return;
    }

    const productsToGrant: string[] = ["elite_blueprint", "evidence_vault"];
    if (includeExcellenceLab) productsToGrant.push("excellence_lab");

    // Insert product rows (skip if already exists for this profile+product)
    const existing = await db
      .select({ product: clientUserProductsTable.product })
      .from(clientUserProductsTable)
      .where(eq(clientUserProductsTable.profileId, application.profileId));

    const existingProducts = new Set(existing.map((r) => r.product));
    const toInsert = productsToGrant.filter((p) => !existingProducts.has(p));

    if (toInsert.length > 0) {
      await db.insert(clientUserProductsTable).values(
        toInsert.map((product) => ({
          profileId: application.profileId!,
          clientEmail: profile.email,
          product,
          offlinePayment: true,
          grantedByStaffId: "staff",
          grantNotes: grantNotes ?? null,
          status: "active",
        }))
      );
    }

    // Elevate profile.accessLevel to elite_blueprint
    await db
      .update(profilesTable)
      .set({ accessLevel: "elite_blueprint" })
      .where(eq(profilesTable.id, application.profileId));

    // Update application status
    await db
      .update(applicationsTable)
      .set({ status: "access_granted", includeExcellenceLab })
      .where(eq(applicationsTable.id, id));

    // Log to clientActivityLogTable + activityTable
    await notifyClient(
      application.profileId,
      "blueprint_access_granted",
      "Your Elite Blueprint access is ready — log in to get started.",
      {
        applicationId: id,
        productsGranted: productsToGrant,
        includeExcellenceLab,
      }
    );

    console.info(
      `[staff] Access granted for application #${id} → profile ${application.profileId}: [${productsToGrant.join(", ")}]`
    );

    res.json({
      success: true,
      productsGranted: productsToGrant,
      alreadyHad: [...existingProducts].filter((p) => productsToGrant.includes(p)),
    });
  }
);

export default router;
