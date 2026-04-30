import { Router } from "express";
import Stripe from "stripe";
import { db, purchasesTable, clientUserProductsTable, profilesTable, pendingAccessGrantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail, purchaseConfirmationEmail } from "../services/emailService";

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
              amountPaid: config.numericAmount,
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
          sendEmail(
            customerEmail,
            purchaseConfirmationEmail(firstName, config.label, config.displayPrice),
          ).catch(() => {});
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
