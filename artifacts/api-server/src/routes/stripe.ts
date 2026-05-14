import { Router } from "express";
import Stripe from "stripe";
import crypto from "crypto";
import { db, purchasesTable, clientUserProductsTable, profilesTable, pendingAccessGrantsTable, prospectsTable, readinessIntakeTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail, purchaseConfirmationEmail, prospectAccountCreatedEmail, paymentReceivedStaffAlertEmail } from "../services/emailService";
import { hashPassword } from "../services/auth";

const STAFF_EMAIL = "support@pinnaclecube.com";

const router = Router();

// ─── Product configuration ─────────────────────────────────────────────────────
// Prices and mode are driven by Stripe Price IDs set via environment variables.
// To change pricing, update the price in the Stripe dashboard — no code change needed.

interface ProductConfig {
  label: string;
  displayPrice: string;
  numericAmount: string; // Plain numeric string for DB NUMERIC columns
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
  // Elite Blueprint uses inline price_data — numericAmount is resolved from
  // session.amount_total at webhook time instead of a fixed config value.
  elite_blueprint: {
    label: "Elite Blueprint",
    displayPrice: "custom",
    numericAmount: "0", // overridden from session.amount_total in webhook handler
    accessLevel: "elite_blueprint",
    mode: "payment",
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

// ─── GET /api/stripe/products — returns display prices for frontend ────────────

router.get("/stripe/products", (_req, res): void => {
  const products = Object.entries(PRODUCT_CONFIGS).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    displayPrice: cfg.displayPrice,
    mode: cfg.mode,
    configured: Boolean(getPriceId(key)),
  }));
  res.json({ products });
});

// ─── POST /api/stripe/checkout ────────────────────────────────────────────────

router.post("/stripe/checkout", async (req, res): Promise<void> => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Payment system is not configured. Please contact support." });
    return;
  }

  const { product, success_url, cancel_url, customer_email } = req.body as {
    product: string;
    success_url?: string;
    cancel_url?: string;
    customer_email?: string;
  };

  const config = PRODUCT_CONFIGS[product];
  if (!config) {
    res.status(400).json({ error: `Unknown product: ${product}` });
    return;
  }

  const priceId = getPriceId(product);
  if (!priceId) {
    res.status(503).json({ error: "Product pricing not configured. Please contact support." });
    return;
  }

  try {
    const origin = (req.headers.origin as string) ?? "https://pinnaclecube.com";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: config.mode,
      success_url: success_url ?? `${origin}/dashboard`,
      cancel_url: cancel_url ?? `${origin}/products`,
      customer_email: customer_email || undefined,
      metadata: { product },
    });

    if (customer_email) {
      await db
        .insert(purchasesTable)
        .values({
          userEmail: customer_email,
          product,
          amount: config.numericAmount,
          currency: "usd",
          status: "pending",
          stripeSessionId: session.id,
        })
        .onConflictDoNothing();
    }

    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    console.error("[stripe/checkout] Error:", msg, err);
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Note: raw body middleware applied in app.ts BEFORE express.json()

router.post("/stripe/webhook", async (req, res): Promise<void> => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    res.status(400).json({ error: "Missing webhook secret or signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    res.status(400).json({ error: msg });
    return;
  }

  // ── checkout.session.completed — grant access for both payment & subscription
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const product = session.metadata?.product;
    const customerEmail =
      session.customer_email ?? session.customer_details?.email ?? null;

    const prospectId = session.metadata?.prospectId
      ? parseInt(session.metadata.prospectId, 10)
      : null;

    // Mark the prospect as paid (and auto-convert) when prospectId is present and
    // payment is confirmed. Guard on payment_status to exclude async-payment flows
    // that complete the session before funds are settled. Write paymentReceivedAt
    // only when not already set to preserve the original first-paid timestamp.
    const paymentConfirmed = session.payment_status === "paid";

    // Track whether we auto-created a profile in the prospect block below so we
    // can skip the duplicate purchase-confirmation email in the general block.
    let profileJustCreated = false;

    if (prospectId && !isNaN(prospectId) && paymentConfirmed) {
      const [existingProspect] = await db
        .select()
        .from(prospectsTable)
        .where(eq(prospectsTable.id, prospectId))
        .limit(1);

      if (existingProspect && !existingProspect.paymentReceivedAt) {
        await db
          .update(prospectsTable)
          .set({
            paymentReceivedAt: new Date(),
            status: "converted",
          })
          .where(eq(prospectsTable.id, prospectId))
          .catch((err: unknown) => {
            console.error("[stripe/webhook] Failed to mark prospect paid:", err);
          });
      }

      // ── Auto-create a portal account for the prospect ───────────────────────
      // If the prospect paid via a staff-sent invoice link and doesn't have a
      // portal account yet, create one with a temporary password and email them
      // their login credentials. They'll be required to set a permanent password
      // on first login (mustChangePassword = true).
      if (existingProspect && existingProspect.email && product) {
        try {
          const config = PRODUCT_CONFIGS[product];
          const prospectEmail = existingProspect.email.toLowerCase();

          const [existingProfile] = await db
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.email, prospectEmail))
            .limit(1);

          let resolvedProfileId: number | null = null;

          if (!existingProfile) {
            // Generate a secure readable temp password (no ambiguous characters)
            const tempPassword = crypto.randomBytes(6).toString("hex"); // 12 hex chars

            const passwordHash = await hashPassword(tempPassword);

            const nameParts = existingProspect.fullName.trim().split(/\s+/);
            const firstName = nameParts[0] ?? existingProspect.fullName;
            const lastName = nameParts.slice(1).join(" ") || firstName;

            // Resolve amount for custom-priced products
            const resolvedAmountForProfile =
              config && config.numericAmount === "0" && session.amount_total
                ? String(Math.round(session.amount_total / 100))
                : config?.numericAmount ?? "0";

            const [newProfile] = await db
              .insert(profilesTable)
              .values({
                name: existingProspect.fullName,
                firstName,
                lastName,
                email: prospectEmail,
                passwordHash,
                mustChangePassword: true,
                disclaimerAccepted: false,
                profession: existingProspect.currentRole ?? "",
                currentStatus: "new",
                visaTarget: "eb1a",
                accessLevel: config?.accessLevel ?? "excellence_lab",
              })
              .returning();

            // Grant product access
            if (config && newProfile) {
              await db
                .insert(clientUserProductsTable)
                .values({
                  profileId: newProfile.id,
                  clientEmail: prospectEmail,
                  product,
                  stripeSessionId: session.id,
                  amountPaid: resolvedAmountForProfile,
                  status: "active",
                })
                .onConflictDoNothing();
            }

            // Link profile ↔ prospect
            if (newProfile) {
              await db
                .update(prospectsTable)
                .set({ linkedProfileId: newProfile.id })
                .where(eq(prospectsTable.id, prospectId));
              resolvedProfileId = newProfile.id;
            }

            // Clean up any stale pending grants for this email
            await db
              .delete(pendingAccessGrantsTable)
              .where(eq(pendingAccessGrantsTable.email, prospectEmail));

            // Send account-created email with temp credentials
            sendEmail(
              prospectEmail,
              prospectAccountCreatedEmail(
                firstName,
                prospectEmail,
                tempPassword,
                config?.label ?? "Pinnacle³",
              ),
            ).catch((err: unknown) => {
              console.error("[stripe/webhook] Failed to send account-created email to", prospectEmail, err);
            });

            profileJustCreated = true;
          } else {
            // Profile already exists — just make sure the prospect is linked
            if (!existingProspect.linkedProfileId) {
              await db
                .update(prospectsTable)
                .set({ linkedProfileId: existingProfile.id })
                .where(eq(prospectsTable.id, prospectId));
            }
            resolvedProfileId = existingProfile.id;
          }

          // ── Staff payment alert ───────────────────────────────────────
          if (resolvedProfileId) {
            const amountDisplay = config
              ? (config.numericAmount === "0" && session.amount_total
                  ? `$${Math.round(session.amount_total / 100)}`
                  : config.displayPrice)
              : session.amount_total
                ? `$${Math.round(session.amount_total / 100)}`
                : "—";
            sendEmail(
              STAFF_EMAIL,
              paymentReceivedStaffAlertEmail(
                existingProspect.fullName,
                prospectEmail,
                config?.label ?? product ?? "Unknown product",
                amountDisplay,
                profileJustCreated,
              ),
            ).catch((err: unknown) => {
              console.error("[stripe/webhook] Staff payment alert failed:", err);
            });
          }

        } catch (err) {
          console.error("[stripe/webhook] Auto-profile creation error:", err);
        }
      }
    }

    if (product && customerEmail) {
      try {
        await db
          .update(purchasesTable)
          .set({ status: "completed" })
          .where(eq(purchasesTable.stripeSessionId, session.id));

        const config = PRODUCT_CONFIGS[product];
        if (!config) {
          res.json({ received: true });
          return;
        }

        // For custom-priced products (Elite Blueprint), resolve the actual paid
        // amount from the session rather than the static config placeholder.
        const resolvedAmount =
          config.numericAmount === "0" && session.amount_total
            ? String(Math.round(session.amount_total / 100))
            : config.numericAmount;

        const [profile] = await db
          .select({ id: profilesTable.id })
          .from(profilesTable)
          .where(eq(profilesTable.email, customerEmail))
          .limit(1);

        if (profile) {
          await db
            .insert(clientUserProductsTable)
            .values({
              profileId: profile.id,
              clientEmail: customerEmail,
              product,
              stripeSessionId: session.id,
              amountPaid: resolvedAmount,
              status: "active",
            })
            .onConflictDoNothing();

          const [fullProfile] = await db
            .select({ firstName: profilesTable.firstName, name: profilesTable.name })
            .from(profilesTable)
            .where(eq(profilesTable.id, profile.id))
            .limit(1);

          await db
            .update(profilesTable)
            .set({ accessLevel: config.accessLevel })
            .where(eq(profilesTable.id, profile.id));

          // Remove any pending access grant for this session (now fulfilled)
          await db
            .delete(pendingAccessGrantsTable)
            .where(eq(pendingAccessGrantsTable.stripeSessionId, session.id));

          const firstName = fullProfile?.firstName ?? fullProfile?.name?.split(" ")[0] ?? "there";
          // Skip the generic purchase-confirmation email if we just created this
          // profile above — the account-created email already covers it.
          if (!profileJustCreated) {
            sendEmail(
              customerEmail,
              purchaseConfirmationEmail(firstName, config.label, config.displayPrice),
            ).catch(() => {});
          }

        } else {
          // No profile yet — store a pending grant. Applied when the user registers.
          await db
            .insert(pendingAccessGrantsTable)
            .values({
              email: customerEmail,
              product,
              accessLevel: config.accessLevel,
              stripeSessionId: session.id,
            })
            .onConflictDoNothing();
        }
      } catch (err) {
        console.error("[stripe/webhook] Fulfillment error:", err);
      }
    }
  }

  // ── checkout.session.expired — mark purchase expired, remove stale pending grant
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await db
        .update(purchasesTable)
        .set({ status: "expired" })
        .where(eq(purchasesTable.stripeSessionId, session.id));

      await db
        .delete(pendingAccessGrantsTable)
        .where(eq(pendingAccessGrantsTable.stripeSessionId, session.id));
    } catch (err) {
      console.error("[stripe/webhook] checkout.session.expired cleanup error:", err);
    }
  }

  // ── customer.subscription.deleted — revoke Evidence Engine access on cancel
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerEmail =
      typeof subscription.customer === "string"
        ? null
        : (subscription.customer as Stripe.Customer).email;

    if (customerEmail) {
      try {
        const [profile] = await db
          .select({ id: profilesTable.id, accessLevel: profilesTable.accessLevel })
          .from(profilesTable)
          .where(eq(profilesTable.email, customerEmail))
          .limit(1);

        if (profile && profile.accessLevel === "evidence_vault") {
          await db
            .update(profilesTable)
            .set({ accessLevel: "excellence_lab" })
            .where(eq(profilesTable.id, profile.id));

          await db
            .update(clientUserProductsTable)
            .set({ status: "cancelled" })
            .where(eq(clientUserProductsTable.clientEmail, customerEmail));
        }
      } catch (err) {
        console.error("[stripe/webhook] Subscription cancel error:", err);
      }
    }
  }

  res.json({ received: true });
});

export default router;
