import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, profilesTable, pendingAccessGrantsTable, clientUserProductsTable, purchasesTable } from "@workspace/db";
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  stripPassword,
} from "../services/auth";
import { requireClientAuth } from "../middlewares/clientAuth";
import { sendEmail, welcomeEmail } from "../services/emailService";

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
