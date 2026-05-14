import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import Stripe from "stripe";
import { db, profilesTable, pendingAccessGrantsTable, clientUserProductsTable, purchasesTable, readinessIntakeTable } from "@workspace/db";
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  stripPassword,
} from "../services/auth";
import { requireClientAuth } from "../middlewares/clientAuth";
import { sendEmail, welcomeEmail, passwordResetRequestEmail, prospectAccountCreatedEmail, paymentReceivedStaffAlertEmail } from "../services/emailService";
import { logger } from "../lib/logger";

const STAFF_EMAIL = "support@pinnaclecube.com";

const router = Router();

const CURRENT_DISCLAIMER_VERSION =
  process.env.CURRENT_DISCLAIMER_VERSION ?? "1.0";

// ─── POST /api/auth/register ─────────────────────────────────────────────────
const registerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  disclaimer_accepted: z.literal(true),
  disclaimer_version: z.string(),
});

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { first_name, last_name, email, password, disclaimer_version } =
    parsed.data;

  // Check email uniqueness
  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const fullName = `${first_name} ${last_name}`.trim();

  const [profile] = await db
    .insert(profilesTable)
    .values({
      name: fullName,
      firstName: first_name,
      lastName: last_name,
      email: email.toLowerCase(),
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date(),
      disclaimerVersion: disclaimer_version,
      profession: "",
      currentStatus: "new",
      visaTarget: "eb1a",
    })
    .returning();

  // Google Drive folder creation triggered here when Drive is configured:
  // await googleDrive.createClientRootFolders(profile.id, profile.email);

  const token = generateToken(profile);
  res.status(201).json({ token, user: stripPassword(profile) });

  // Fire-and-forget welcome email
  sendEmail(profile.email, welcomeEmail(first_name)).catch(() => {});

  // Apply any pending access grants from pre-registration Stripe payments
  try {
    const grants = await db
      .select()
      .from(pendingAccessGrantsTable)
      .where(eq(pendingAccessGrantsTable.email, email.toLowerCase()))
      .orderBy(desc(pendingAccessGrantsTable.createdAt));

    if (grants.length > 0) {
      const topGrant = grants[0];
      await db.update(profilesTable)
        .set({ accessLevel: topGrant.accessLevel })
        .where(eq(profilesTable.id, profile.id));

      for (const grant of grants) {
        await db.insert(clientUserProductsTable).values({
          profileId: profile.id,
          clientEmail: email.toLowerCase(),
          product: grant.product,
          stripeSessionId: grant.stripeSessionId ?? undefined,
          amountPaid: "0",
          status: "active",
        }).onConflictDoNothing();
      }

      await db.delete(pendingAccessGrantsTable)
        .where(eq(pendingAccessGrantsTable.email, email.toLowerCase()));
    }
  } catch {
    // Non-fatal: do not block registration if grant application fails
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { email, password } = parsed.data;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, email.toLowerCase()))
    .limit(1);

  if (!profile || !profile.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await comparePassword(password, profile.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const requiresReconsent =
    !profile.disclaimerAccepted ||
    profile.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION;

  const requiresPasswordChange = profile.mustChangePassword ?? false;

  const token = generateToken(profile);
  res.json({
    token,
    requiresReconsent,
    requiresPasswordChange,
    user: stripPassword(profile),
  });
});

// ─── POST /api/auth/accept-disclaimer ────────────────────────────────────────
router.post("/auth/accept-disclaimer", async (req, res) => {
  // Lighter auth check — bypasses disclaimer gate so users can accept it
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  let payload: { sub: number };
  try {
    payload = verifyToken(authHeader.slice(7)) as { sub: number };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { disclaimer_version } = req.body as { disclaimer_version?: string };
  if (!disclaimer_version) {
    res.status(400).json({ error: "disclaimer_version is required" });
    return;
  }

  await db
    .update(profilesTable)
    .set({
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date(),
      disclaimerVersion: disclaimer_version,
    })
    .where(eq(profilesTable.id, payload.sub));

  res.json({ success: true });
});

// ─── POST /api/auth/update-profile ───────────────────────────────────────────
const updateProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  marital_status: z.string().optional(),
  linkedin_url: z.string().optional(),
  bio: z.string().optional(),
});

router.post(
  "/auth/update-profile",
  requireClientAuth,
  async (req: any, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = {};

    if (data.first_name !== undefined) {
      updates.firstName = data.first_name;
      updates.name = `${data.first_name} ${req.clientUser.lastName ?? ""}`.trim();
    }
    if (data.last_name !== undefined) {
      updates.lastName = data.last_name;
      updates.name = `${req.clientUser.firstName ?? ""} ${data.last_name}`.trim();
    }
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.country !== undefined) updates.country = data.country;
    if (data.city !== undefined) updates.city = data.city;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.nationality !== undefined) updates.nationality = data.nationality;
    if (data.marital_status !== undefined) updates.maritalStatus = data.marital_status;
    if (data.linkedin_url !== undefined) updates.linkedinUrl = data.linkedin_url;
    if (data.bio !== undefined) updates.bio = data.bio;

    const [updated] = await db
      .update(profilesTable)
      .set(updates)
      .where(eq(profilesTable.id, req.clientUser.id))
      .returning();

    res.json({ user: stripPassword(updated) });
  },
);

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post(
  "/auth/reset-password",
  requireClientAuth,
  async (req: any, res) => {
    const { new_password } = req.body as { new_password?: string };
    if (!new_password || new_password.length < 8) {
      res.status(400).json({ error: "new_password must be at least 8 characters" });
      return;
    }

    const passwordHash = await hashPassword(new_password);
    await db
      .update(profilesTable)
      .set({ passwordHash })
      .where(eq(profilesTable.id, req.clientUser.id));

    res.json({ success: true });
  },
);

// ─── POST /api/auth/set-password ─────────────────────────────────────────────
// First-login password setup for accounts created via the prospect invoice flow.
// Uses a lighter auth check (token-only, no disclaimer/paywall gate) so new
// users can set their password before they've accepted the disclaimer.
router.post("/auth/set-password", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  let payload: { sub: number };
  try {
    payload = verifyToken(authHeader.slice(7)) as { sub: number };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { new_password } = req.body as { new_password?: string };
  if (!new_password || new_password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const passwordHash = await hashPassword(new_password);
  const [updated] = await db
    .update(profilesTable)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(profilesTable.id, payload.sub))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // Issue a fresh token so the client doesn't need to re-login
  const newToken = generateToken(updated);
  res.json({ success: true, token: newToken, user: stripPassword(updated) });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/auth/me", requireClientAuth, (req: any, res) => {
  res.json({ user: stripPassword(req.clientUser) });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// Generates a 1-hour reset token and emails a secure link if the account exists.
// Always returns 200 to prevent email enumeration — except when the user is not
// found, in which case returns 404 so the frontend can show a helpful message.
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, email.toLowerCase()))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "No account found with that email address." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(profilesTable)
    .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt })
    .where(eq(profilesTable.id, profile.id));

  const origin = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
  const resetUrl = `${origin}/reset-password?token=${token}`;
  const firstName = profile.firstName ?? profile.name.split(" ")[0] ?? "there";

  sendEmail(profile.email, passwordResetRequestEmail(firstName, resetUrl)).catch((err: unknown) => {
    console.error("[auth/forgot-password] Failed to send reset email:", err);
  });

  res.json({ success: true });
});

// ─── GET /api/auth/validate-reset-token ──────────────────────────────────────
// Validates a reset token without consuming it (used by the reset page on mount).
router.get("/auth/validate-reset-token", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) { res.status(400).json({ error: "token is required" }); return; }

  const [profile] = await db
    .select({ id: profilesTable.id, passwordResetExpiresAt: profilesTable.passwordResetExpiresAt })
    .from(profilesTable)
    .where(eq(profilesTable.passwordResetToken, token))
    .limit(1);

  if (!profile || !profile.passwordResetExpiresAt || profile.passwordResetExpiresAt < new Date()) {
    res.status(400).json({ error: "Token is invalid or has expired." });
    return;
  }

  res.json({ valid: true });
});

// ─── POST /api/auth/reset-password-by-token ───────────────────────────────────
// Consumes a reset token, sets the new password, and returns a session JWT.
router.post("/auth/reset-password-by-token", async (req, res) => {
  const { token, new_password } = req.body as { token?: string; new_password?: string };
  if (!token || !new_password) {
    res.status(400).json({ error: "token and new_password are required" });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.passwordResetToken, token))
    .limit(1);

  if (!profile || !profile.passwordResetExpiresAt || profile.passwordResetExpiresAt < new Date()) {
    res.status(400).json({ error: "This reset link has expired or already been used. Please request a new one." });
    return;
  }

  const passwordHash = await hashPassword(new_password);

  const [updated] = await db
    .update(profilesTable)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    })
    .where(eq(profilesTable.id, profile.id))
    .returning();

  const sessionToken = generateToken(updated);
  res.json({ success: true, token: sessionToken, user: stripPassword(updated) });
});

// ─── POST /api/auth/payment-provision-and-login ──────────────────────────────
// Called by the /payment-success page immediately on load — does NOT wait for
// the Stripe webhook. Fetches the session directly from Stripe, creates/finds
// the profile + product access row, and returns a JWT in one shot.
// Idempotent: safe to call multiple times; onConflictDoNothing guards duplicates.

const PAYMENT_PRODUCT_CONFIGS: Record<string, {
  accessLevel: string;
  label: string;
  numericAmount: string;
}> = {
  excellence_lab: { accessLevel: "excellence_lab", label: "Excellence Lab", numericAmount: "249" },
  evidence_vault: { accessLevel: "evidence_vault", label: "Evidence Engine", numericAmount: "49" },
  elite_blueprint: { accessLevel: "elite_blueprint", label: "Elite Blueprint", numericAmount: "0" },
};

router.post("/auth/payment-provision-and-login", async (req, res): Promise<void> => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "Payment system not configured" });
    return;
  }

  // 1. Fetch the Stripe session directly — no webhook dependency
  let session: Stripe.Checkout.Session;
  try {
    const stripe = new Stripe(stripeKey);
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    res.status(400).json({ error: "Invalid or expired session" });
    return;
  }

  if (session.payment_status !== "paid") {
    res.status(402).json({ error: "Payment not yet confirmed" });
    return;
  }

  const product = session.metadata?.product ?? null;
  const customerEmail = (
    session.customer_email ?? session.customer_details?.email ?? null
  )?.toLowerCase();

  if (!customerEmail) {
    res.status(400).json({ error: "No email found on Stripe session" });
    return;
  }

  const config = product ? PAYMENT_PRODUCT_CONFIGS[product] : null;

  // 2. Find or create the profile
  const [existingProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, customerEmail))
    .limit(1);

  let profile = existingProfile ?? null;

  if (!profile) {
    const tempPassword = crypto.randomBytes(6).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    const rawName = session.customer_details?.name?.trim() ?? customerEmail;
    const nameParts = rawName.split(/\s+/);
    const firstName = nameParts[0] ?? "Client";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const resolvedAmount =
      config?.numericAmount === "0" && session.amount_total
        ? String(Math.round(session.amount_total / 100))
        : config?.numericAmount ?? "0";

    const [newProfile] = await db
      .insert(profilesTable)
      .values({
        name: rawName,
        firstName,
        lastName,
        email: customerEmail,
        passwordHash,
        mustChangePassword: true,
        disclaimerAccepted: false,
        profession: "",
        currentStatus: "new",
        visaTarget: "eb1a",
        accessLevel: config?.accessLevel ?? "excellence_lab",
      })
      .returning();

    profile = newProfile ?? null;

    if (config && product && profile) {
      await db
        .insert(clientUserProductsTable)
        .values({
          profileId: profile.id,
          clientEmail: customerEmail,
          product,
          stripeSessionId: sessionId,
          amountPaid: resolvedAmount,
          status: "active",
        })
        .onConflictDoNothing();
    }

    await db
      .delete(pendingAccessGrantsTable)
      .where(eq(pendingAccessGrantsTable.email, customerEmail));

    if (profile) {
      sendEmail(
        customerEmail,
        prospectAccountCreatedEmail(firstName, customerEmail, tempPassword, config?.label ?? "Pinnacle³"),
      ).catch(() => {});
    }
  } else {
    // Profile already exists — ensure product access row is present
    if (config && product) {
      const resolvedAmount =
        config.numericAmount === "0" && session.amount_total
          ? String(Math.round(session.amount_total / 100))
          : config.numericAmount;

      await db
        .insert(clientUserProductsTable)
        .values({
          profileId: profile.id,
          clientEmail: customerEmail,
          product,
          stripeSessionId: sessionId,
          amountPaid: resolvedAmount,
          status: "active",
        })
        .onConflictDoNothing();
    }
  }

  if (!profile) {
    res.status(500).json({ error: "Failed to create or find account" });
    return;
  }

  // ── Staff payment alert ─────────────────────────────────────────────────────
  const amountDisplay = config
    ? (config.numericAmount === "0" && session.amount_total
        ? `$${Math.round(session.amount_total / 100)}`
        : config.numericAmount !== "0"
          ? `$${config.numericAmount}`
          : "—")
    : session.amount_total
      ? `$${Math.round(session.amount_total / 100)}`
      : "—";

  sendEmail(
    STAFF_EMAIL,
    paymentReceivedStaffAlertEmail(
      profile.name ?? customerEmail,
      customerEmail,
      config?.label ?? product ?? "Unknown product",
      amountDisplay,
      !existingProfile,
    ),
  ).catch(() => {});

  const requiresPasswordChange = profile.mustChangePassword ?? false;
  const requiresReconsent =
    !profile.disclaimerAccepted ||
    profile.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION;

  const token = generateToken(profile);
  res.json({
    token,
    product,
    requiresPasswordChange,
    requiresReconsent,
    user: stripPassword(profile),
  });
});

// ─── POST /api/auth/session-auto-login ───────────────────────────────────────
// Called by the /payment-success page after Stripe checkout. Accepts the
// checkout session ID, looks up the profile that was created by the webhook,
// and returns a JWT so the user can be signed in automatically.
// Returns 202 (not ready yet) while the webhook hasn't processed yet — the
// client polls until it gets a 200 or gives up after ~20 seconds.
router.post("/auth/session-auto-login", async (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  // Look up the client_user_products row written by the webhook
  const [purchase] = await db
    .select({
      clientEmail: clientUserProductsTable.clientEmail,
      product: clientUserProductsTable.product,
    })
    .from(clientUserProductsTable)
    .where(eq(clientUserProductsTable.stripeSessionId, sessionId))
    .limit(1);

  // Fallback: also check the purchases table (written slightly earlier)
  let email = purchase?.clientEmail ?? null;
  let product = purchase?.product ?? null;

  if (!email) {
    const [row] = await db
      .select({ userEmail: purchasesTable.userEmail, product: purchasesTable.product })
      .from(purchasesTable)
      .where(eq(purchasesTable.stripeSessionId, sessionId))
      .limit(1);
    email = row?.userEmail ?? null;
    product = row?.product ?? null;
  }

  if (!email) {
    // Webhook hasn't processed yet — tell the client to keep polling
    res.status(202).json({ ready: false });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, email.toLowerCase()))
    .limit(1);

  if (!profile) {
    res.status(202).json({ ready: false });
    return;
  }

  const requiresPasswordChange = profile.mustChangePassword ?? false;
  const requiresReconsent =
    !profile.disclaimerAccepted ||
    profile.disclaimerVersion !== (process.env.CURRENT_DISCLAIMER_VERSION ?? "1.0");

  const token = generateToken(profile);
  res.json({
    token,
    product,
    requiresPasswordChange,
    requiresReconsent,
    user: stripPassword(profile),
  });
});

export default router;
