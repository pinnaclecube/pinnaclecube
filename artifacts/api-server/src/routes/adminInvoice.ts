/**
 * adminInvoice.ts — Pinnacle³
 *
 * Staff-only routes for generating a Stripe checkout link, sending a
 * proposal email with roadmap PDF attachment, and converting a prospect to a case.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, prospectsTable, pendingAccessGrantsTable, purchasesTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail, invoiceEmail } from "../services/emailService";
import Stripe from "stripe";
import PDFDocument from "pdfkit";

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
};

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

// ─── POST /api/admin/prospects/:id/invoice ────────────────────────────────────
// Creates a Stripe Checkout Session, stores a pending access grant (in case
// the prospect pays before registering), updates the prospect record with
// invoice metadata, and sends the proposal email with roadmap PDF attached.

router.post(
  "/admin/prospects/:id/invoice",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { product } = req.body as { product?: string };
    if (!product || !PRODUCT_CONFIGS[product]) {
      res.status(400).json({ error: "product must be one of: excellence_lab, evidence_vault" });
      return;
    }

    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payment system is not configured. Contact support." });
      return;
    }

    const priceId = getPriceId(product);
    if (!priceId) {
      res.status(503).json({ error: "Product pricing not configured. Contact support." });
      return;
    }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
    if (!prospect.email) { res.status(400).json({ error: "Prospect has no email address" }); return; }

    const config = PRODUCT_CONFIGS[product];
    const origin = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";

    // Create Stripe Checkout Session
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: config.mode,
        success_url: `${origin}/dashboard`,
        cancel_url: `${origin}/products`,
        customer_email: prospect.email,
        expires_at: Math.floor(Date.now() / 1000) + 86400, // 24-hour expiry
        metadata: { product, prospectId: String(id) },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Stripe error";
      res.status(500).json({ error: msg });
      return;
    }

    // Store pending access grant (handles payment before registration)
    await db.insert(pendingAccessGrantsTable).values({
      email: prospect.email,
      product,
      accessLevel: config.accessLevel,
      stripeSessionId: session.id,
    });

    // Track in purchases table
    await db.insert(purchasesTable).values({
      userEmail: prospect.email,
      product,
      amount: config.numericAmount,
      currency: "usd",
      status: "pending",
      stripeSessionId: session.id,
    }).onConflictDoNothing();

    // Update prospect record
    await db.update(prospectsTable).set({
      invoiceSentAt: new Date(),
      invoiceProduct: product,
      invoiceCheckoutUrl: session.url,
    }).where(eq(prospectsTable.id, id));

    // Build & send proposal email (with roadmap PDF if available)
    const firstName = prospect.fullName.split(" ")[0] ?? prospect.fullName;
    const checkoutUrl = session.url!;

    let attachments: Array<{ filename: string; content: Buffer }> | undefined;

    if (prospect.roadmapContent) {
      try {
        const roadmap = JSON.parse(prospect.roadmapContent) as RoadmapData;
        const pdfBuffer = await generateProposalPDF(roadmap, prospect.fullName);
        const safeName = prospect.fullName.replace(/\s+/g, "_");
        const safeVisa = (prospect.roadmapVisaCategory ?? "Roadmap").replace(/\s+/g, "_");
        attachments = [{ filename: `${safeName}_${safeVisa}_Roadmap.pdf`, content: pdfBuffer }];
      } catch {
        // PDF generation failure should not block invoice sending
      }
    }

    await sendEmail(
      prospect.email,
      invoiceEmail(firstName, config.label, config.displayPrice, checkoutUrl, prospect.roadmapVisaCategory),
      attachments,
    );

    const [updated] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    res.json({ success: true, checkoutUrl, stripeSessionId: session.id, prospect: updated });
  },
);

// ─── POST /api/admin/prospects/:id/convert ────────────────────────────────────
// Marks a prospect as "converted" and optionally sends them an invite email.

router.post(
  "/admin/prospects/:id/convert",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

    const [updated] = await db.update(prospectsTable).set({
      status: "converted",
    }).where(eq(prospectsTable.id, id)).returning();

    res.json({ success: true, prospect: updated });
  },
);

export default router;
