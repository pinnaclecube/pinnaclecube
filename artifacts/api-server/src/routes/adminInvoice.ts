/**
 * adminInvoice.ts — Pinnacle³
 *
 * Staff-only routes for generating a Stripe checkout link, sending a
 * proposal email with roadmap PDF attachment, and converting a prospect to a case.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, prospectsTable, purchasesTable, profilesTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail, invoiceEmail, prospectInviteEmail, prospectAccountCreatedEmail } from "../services/emailService";
import { provisionClientDriveFromProspect } from "../services/googleDrive";
import Stripe from "stripe";
import PDFDocument from "pdfkit";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router: IRouter = Router();

// ─── Product configuration (mirrors stripe.ts) ────────────────────────────────

interface ProductConfig {
  label: string;
  displayPrice: string;
  numericAmount: string;
  accessLevel: string;
  mode: "payment" | "subscription";
}

const PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  excellence_lab: {
    label: "Excellence Lab",
    displayPrice: "$249",
    numericAmount: "249",
    accessLevel: "excellence_lab",
    mode: "payment",
  },
  evidence_vault: {
    label: "Evidence Engine",
    displayPrice: "$49/mo",
    numericAmount: "49",
    accessLevel: "evidence_vault",
    mode: "subscription",
  },
  // elite_blueprint uses custom (staff-entered) pricing — no fixed price ID.
  // numericAmount and displayPrice are populated at invoice time from the request body.
  elite_blueprint: {
    label: "Elite Blueprint",
    displayPrice: "custom",
    numericAmount: "0",
    accessLevel: "elite_blueprint",
    mode: "payment",
  },
};

// Products that require a staff-entered custom price (no fixed Stripe Price ID).
const CUSTOM_PRICE_PRODUCTS = new Set(["elite_blueprint"]);

function getPriceId(product: string): string | null {
  if (product === "excellence_lab") return process.env.STRIPE_PRICE_EXCELLENCE_LAB ?? null;
  if (product === "evidence_vault") return process.env.STRIPE_PRICE_EVIDENCE_ENGINE ?? null;
  return null;
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// ─── Inline PDF generator (subset — just enough for the proposal email) ────────

const INDIGO_HEX = "#1E2D6B";
const GRAY_HEX = "#111827";

type RoadmapData = {
  prospectName: string;
  visaCategory: string;
  generatedDate: string;
  executiveSummary: {
    strongCriteria: number;
    partialCriteria: number;
    yearsExperience: string;
    approvalRateContext: string;
  };
  confidenceAnalysis: {
    currentConfidenceLow: number;
    currentConfidenceHigh: number;
    postConfidenceLow: number;
    postConfidenceHigh: number;
    upliftMessage: string;
  };
  roadmapPhases: Array<{
    phaseNumber: number;
    title: string;
    timeline: string;
    steps: string[];
  }>;
  [key: string]: unknown;
};

async function generateProposalPDF(roadmap: RoadmapData, prospectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const MARGIN = 50;
    const WIDTH = doc.page.width - MARGIN * 2;

    function checkPageBreak(h: number) {
      if (doc.y + h > doc.page.height - 80) doc.addPage();
    }

    function sectionHeader(icon: string, title: string) {
      checkPageBreak(50);
      doc.moveDown(0.5);
      doc.rect(MARGIN, doc.y, WIDTH, 28).fill(INDIGO_HEX);
      doc.fillColor("white").fontSize(11).font("Helvetica-Bold")
        .text(`${icon}  ${title}`, MARGIN + 10, doc.y - 24, { width: WIDTH - 20 });
      doc.fillColor(GRAY_HEX).moveDown(0.8);
    }

    function bodyText(text: string, opts: object = {}) {
      doc.fontSize(10).font("Helvetica").fillColor(GRAY_HEX)
        .text(text, { lineGap: 3, ...opts });
    }

    function bulletItem(text: string) {
      checkPageBreak(18);
      const x = doc.x;
      doc.fontSize(10).font("Helvetica").fillColor(INDIGO_HEX)
        .text("✓", x, doc.y, { width: 15 });
      doc.fontSize(10).font("Helvetica").fillColor(GRAY_HEX)
        .text(text, x + 18, doc.y - 12, { width: WIDTH - 18, lineGap: 2 });
      doc.moveDown(0.1);
    }

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill(INDIGO_HEX);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text("Pinnacle³", MARGIN, 18, { continued: true });
    doc.fillColor("#a0aec0").fontSize(11).font("Helvetica")
      .text("   EB-1A · EB-2 NIW · O-1A");
    doc.fillColor("white").fontSize(13).font("Helvetica")
      .text(`${roadmap.visaCategory} — Strategic Profile Assessment & Roadmap to Approval`, MARGIN, 42);

    doc.moveDown(2);

    doc.fillColor(GRAY_HEX).fontSize(14).font("Helvetica-Bold")
      .text(`Prepared for: ${prospectName} | ${roadmap.generatedDate}`, { align: "center" });
    doc.moveDown(1.5);

    // Confidence summary box
    const confY = doc.y;
    const half = (WIDTH - 10) / 2;
    doc.rect(MARGIN, confY, half, 55).fill("#fef2f2");
    doc.fillColor("#dc2626").fontSize(16).font("Helvetica-Bold")
      .text(`${roadmap.confidenceAnalysis.currentConfidenceLow}–${roadmap.confidenceAnalysis.currentConfidenceHigh}%`, MARGIN + 5, confY + 8, { width: half - 10, align: "center" });
    doc.fillColor("#991b1b").fontSize(8).font("Helvetica")
      .text("Current approval confidence", MARGIN + 5, confY + 30, { width: half - 10, align: "center" });

    const x2 = MARGIN + half + 10;
    doc.rect(x2, confY, half, 55).fill("#f0fdf4");
    doc.fillColor("#059669").fontSize(16).font("Helvetica-Bold")
      .text(`${roadmap.confidenceAnalysis.postConfidenceLow}–${roadmap.confidenceAnalysis.postConfidenceHigh}%`, x2 + 5, confY + 8, { width: half - 10, align: "center" });
    doc.fillColor("#065f46").fontSize(8).font("Helvetica")
      .text("After Pinnacle³ guidance", x2 + 5, confY + 30, { width: half - 10, align: "center" });

    doc.y = confY + 65;
    doc.moveDown(0.5);

    if (roadmap.confidenceAnalysis.upliftMessage) {
      doc.fillColor(INDIGO_HEX).fontSize(10).font("Helvetica-Bold")
        .text(roadmap.confidenceAnalysis.upliftMessage, { align: "center" });
      doc.moveDown(1);
    }

    // Roadmap phases
    sectionHeader("▶", "YOUR PERSONALIZED ROADMAP PHASES");

    roadmap.roadmapPhases.forEach((phase) => {
      checkPageBreak(70);
      doc.rect(MARGIN, doc.y, WIDTH, 1).fill("#e9ecef");
      doc.moveDown(0.3);
      doc.fillColor(INDIGO_HEX).fontSize(11).font("Helvetica-Bold")
        .text(`Phase ${phase.phaseNumber} — ${phase.title}`, { continued: true });
      doc.fillColor("#6b7280").fontSize(9).font("Helvetica")
        .text(`   ${phase.timeline}`);
      doc.moveDown(0.3);
      (phase.steps ?? []).forEach((step) => bulletItem(step));
      doc.moveDown(0.5);
    });

    // Footer note
    checkPageBreak(60);
    doc.moveDown(1);
    doc.rect(MARGIN, doc.y, WIDTH, 50).fill("#f0f4ff");
    doc.fillColor(INDIGO_HEX).fontSize(10).font("Helvetica-Bold")
      .text("Ready to build your case?", MARGIN + 10, doc.y - 46, { width: WIDTH - 20 });
    doc.fillColor(GRAY_HEX).fontSize(9).font("Helvetica")
      .text("Click the payment link in your email to get started with Pinnacle³. Questions? Reply directly to your proposal email.", MARGIN + 10, doc.y - 28, { width: WIDTH - 20 });

    doc.end();
  });
}

// ─── Helper: check if existing Stripe session is still open ──────────────────

async function getOpenSession(
  stripe: Stripe,
  email: string,
  product: string,
  storedCheckoutUrl?: string | null,
): Promise<{ session: Stripe.Checkout.Session; sessionId: string } | null> {
  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(and(eq(purchasesTable.userEmail, email), eq(purchasesTable.product, product), eq(purchasesTable.status, "pending")))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(1);

  if (!purchase?.stripeSessionId) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(purchase.stripeSessionId);
    if (session.status !== "open") return null;

    // If the prospect record has a stored checkout URL, verify this session matches it.
    // This prevents accidentally reusing a stale purchase row that belongs to a
    // different checkout session than the one currently shown on the prospect record.
    if (storedCheckoutUrl && session.url && session.url !== storedCheckoutUrl) return null;

    return { session, sessionId: purchase.stripeSessionId };
  } catch {
    // session not found or Stripe error — treat as no valid session
  }
  return null;
}

// ─── GET /api/admin/prospects/:id/invoice/status ──────────────────────────────
// Returns the Stripe session status and expiry for the prospect's most recent
// pending payment link. Used by the frontend to show/hide the "reusing existing
// link" indicator and the session expiry time.

router.get(
  "/admin/prospects/:id/invoice/status",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const stripe = getStripe();
    if (!stripe) { res.json({ status: "unconfigured" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
    if (!prospect.email || !prospect.invoiceCheckoutUrl || !prospect.invoiceProduct) {
      res.json({ status: "none" });
      return;
    }

    const open = await getOpenSession(stripe, prospect.email, prospect.invoiceProduct, prospect.invoiceCheckoutUrl);
    if (!open) {
      res.json({ status: "expired" });
      return;
    }

    res.json({
      status: "open",
      expiresAt: open.session.expires_at ? new Date(open.session.expires_at * 1000).toISOString() : null,
      checkoutUrl: open.session.url,
    });
  },
);

// ─── POST /api/admin/prospects/:id/invoice ────────────────────────────────────
// If the prospect already has an open (unexpired) Stripe Checkout Session for
// the same product, this route reuses it and simply resends the proposal email —
// no new session is created, no new pending_access_grants row is accumulated.
// A new session is only created when the existing one is expired, completed, or
// the product has changed.
// Pending access grants are created by the Stripe webhook AFTER confirmed payment.

router.post(
  "/admin/prospects/:id/invoice",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { product, customAmount } = req.body as { product?: string; customAmount?: number };
    if (!product || !PRODUCT_CONFIGS[product]) {
      res.status(400).json({ error: "product must be one of: excellence_lab, evidence_vault, elite_blueprint" });
      return;
    }

    // Elite Blueprint requires a staff-entered dollar amount (positive integer).
    const isCustomPrice = CUSTOM_PRICE_PRODUCTS.has(product);
    const customAmountDollars = isCustomPrice ? (customAmount ?? 0) : 0;
    if (isCustomPrice) {
      if (!Number.isInteger(customAmountDollars) || customAmountDollars < 1 || customAmountDollars > 999999) {
        res.status(400).json({ error: "customAmount must be a whole-dollar amount between $1 and $999,999" });
        return;
      }
    }

    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payment system is not configured. Contact support." });
      return;
    }

    const priceId = isCustomPrice ? null : getPriceId(product);
    if (!isCustomPrice && !priceId) {
      res.status(503).json({ error: "Product pricing not configured. Contact support." });
      return;
    }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
    if (!prospect.email) { res.status(400).json({ error: "Prospect has no email address" }); return; }

    const firstName = prospect.fullName.split(" ")[0] ?? prospect.fullName;

    // Build resolved config (Elite Blueprint overrides display/amount from custom input).
    const config = { ...PRODUCT_CONFIGS[product] };
    if (isCustomPrice) {
      config.displayPrice = `$${customAmountDollars.toLocaleString()}`;
      config.numericAmount = String(customAmountDollars);
    }

    // Check if there's an existing open session for the same product to reuse.
    // For custom-price products we skip reuse (amount may have changed).
    const sameProduct = !isCustomPrice && prospect.invoiceProduct === product;
    const existingOpen = sameProduct ? await getOpenSession(stripe, prospect.email, product, prospect.invoiceCheckoutUrl) : null;

    let checkoutUrl: string;
    let stripeSessionId: string;
    let reusingExistingSession = false;

    if (existingOpen) {
      // Reuse the existing session — just resend the email.
      checkoutUrl = existingOpen.session.url!;
      stripeSessionId = existingOpen.sessionId;
      reusingExistingSession = true;

      // Update invoiceSentAt and ensure session ID is recorded.
      await db.update(prospectsTable).set({
        invoiceSentAt: new Date(),
        invoiceStripeSessionId: stripeSessionId,
      }).where(eq(prospectsTable.id, id));
    } else {
      // Create a new Stripe Checkout Session.
      const origin = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
      let session: Stripe.Checkout.Session;
      try {
        const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = isCustomPrice
          ? {
              price_data: {
                currency: "usd",
                product_data: { name: config.label },
                unit_amount: customAmountDollars * 100, // cents
              },
              quantity: 1,
            }
          : { price: priceId!, quantity: 1 };

        session = await stripe.checkout.sessions.create({
          line_items: [lineItem],
          mode: config.mode,
          success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/products`,
          customer_email: prospect.email,
          expires_at: Math.floor(Date.now() / 1000) + 86400, // 24-hour expiry
          metadata: {
            product,
            prospectId: String(id),
            ...(isCustomPrice ? { customAmount: String(customAmountDollars) } : {}),
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stripe error";
        res.status(500).json({ error: msg });
        return;
      }

      checkoutUrl = session.url!;
      stripeSessionId = session.id;

      // Track in purchases table.
      await db.insert(purchasesTable).values({
        userEmail: prospect.email,
        product,
        amount: config.numericAmount,
        currency: "usd",
        status: "pending",
        stripeSessionId,
      }).onConflictDoNothing();

      // Update prospect record — store session ID for accurate status lookups.
      await db.update(prospectsTable).set({
        invoiceSentAt: new Date(),
        invoiceProduct: product,
        invoiceCheckoutUrl: checkoutUrl,
        invoiceStripeSessionId: stripeSessionId,
      }).where(eq(prospectsTable.id, id));
    }

    // Build & send proposal email (with roadmap PDF if available).
    // Uploaded roadmap always takes priority over the AI-generated one.
    let attachments: Array<{ filename: string; content: Buffer }> | undefined;

    if (prospect.roadmapUploadedData) {
      const buffer = Buffer.from(prospect.roadmapUploadedData, "base64");
      const fileName =
        prospect.roadmapUploadedFileName ??
        `${prospect.fullName.replace(/\s+/g, "_")}_Roadmap.pdf`;
      attachments = [{ filename: fileName, content: buffer }];
    } else if (prospect.roadmapContent) {
      try {
        const roadmap = JSON.parse(prospect.roadmapContent) as RoadmapData;
        const pdfBuffer = await generateProposalPDF(roadmap, prospect.fullName);
        const safeName = prospect.fullName.replace(/\s+/g, "_");
        const safeVisa = (prospect.roadmapVisaCategory ?? "Roadmap").replace(/\s+/g, "_");
        attachments = [{ filename: `${safeName}_${safeVisa}_Roadmap.pdf`, content: pdfBuffer }];
      } catch {
        // PDF generation failure should not block invoice sending.
      }
    }

    await sendEmail(
      prospect.email,
      invoiceEmail(firstName, config.label, config.displayPrice, checkoutUrl, prospect.roadmapVisaCategory),
      { attachments, cc: ["support@pinnaclecube.com"] },
    );

    const [updated] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    res.json({
      success: true,
      checkoutUrl,
      stripeSessionId,
      reusingExistingSession,
      prospect: updated,
      ...(isCustomPrice ? { customAmountDollars } : {}),
    });
  },
);

// ─── POST /api/admin/prospects/:id/convert ────────────────────────────────────
// Marks a prospect as "converted", sends a registration invite email (mirroring
// the /invite route), and updates registrationStatus to "invited" if not already.

router.post(
  "/admin/prospects/:id/convert",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

    const prospectEmail = prospect.email.toLowerCase();
    const nameParts = prospect.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? prospect.fullName;
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // ── Auto-create a profile if one doesn't exist for this email ──────────────
    let linkedProfileId = prospect.linkedProfileId ?? null;

    const [existingProfile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.email, prospectEmail))
      .limit(1);

    if (existingProfile) {
      linkedProfileId = existingProfile.id;
    } else {
      const tempPassword = crypto.randomBytes(6).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const [newProfile] = await db
        .insert(profilesTable)
        .values({
          name: prospect.fullName,
          firstName,
          lastName,
          email: prospectEmail,
          passwordHash,
          mustChangePassword: true,
          disclaimerAccepted: false,
          profession: prospect.currentRole ?? "",
          currentStatus: "new",
          visaTarget: (prospect.roadmapVisaCategory?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "eb1a"),
          accessLevel: "free",
        })
        .returning();

      if (newProfile) {
        linkedProfileId = newProfile.id;
        sendEmail(
          prospectEmail,
          prospectAccountCreatedEmail(firstName, prospectEmail, tempPassword, "Pinnacle³"),
        ).catch(() => {});
      }
    }

    const alreadyInvited = prospect.registrationStatus !== "not_invited";

    const [updated] = await db.update(prospectsTable).set({
      status: "converted",
      registrationStatus: alreadyInvited ? prospect.registrationStatus : "invited",
      ...(linkedProfileId ? { linkedProfileId } : {}),
    }).where(eq(prospectsTable.id, id)).returning();

    // ── Provision Drive workspace in background ──────────────────────────────
    if (linkedProfileId) {
      setImmediate(() => {
        provisionClientDriveFromProspect(linkedProfileId!, prospectEmail, {
          driveFileId: prospect.driveFileId,
          resumeFileName: prospect.resumeFileName,
          fullName: prospect.fullName,
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[convert] Drive provision failed for profile", linkedProfileId, ":", msg);
        });
      });
    }

    res.json({ success: true, prospect: updated, message: "Prospect converted and case created" });
  },
);

export default router;
