import { Router } from "express";
import Stripe from "stripe";
import { db, purchasesTable, clientUserProductsTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail, purchaseConfirmationEmail } from "../services/emailService";

const router = Router();

const PRODUCT_CONFIGS: Record<string, { label: string; amountCents: number; accessLevel: string }> = {
  excellence_lab: { label: "Excellence Lab", amountCents: 29700, accessLevel: "excellence_lab" },
  evidence_vault: { label: "Evidence Vault (includes Excellence Lab)", amountCents: 49700, accessLevel: "evidence_vault" },
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

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

  try {
    const origin = (req.headers.origin as string) ?? "https://pinnaclecube.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: config.label },
            unit_amount: config.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
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
          amount: String(config.amountCents / 100),
          currency: "usd",
          status: "pending",
          stripeSessionId: session.id,
        })
        .onConflictDoNothing();
    }

    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe error";
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const product = session.metadata?.product;
    const customerEmail =
      session.customer_email ?? session.customer_details?.email ?? null;

    if (product && customerEmail) {
      try {
        // Mark purchase completed
        await db
          .update(purchasesTable)
          .set({ status: "completed" })
          .where(eq(purchasesTable.stripeSessionId, session.id));

        const config = PRODUCT_CONFIGS[product];
        if (!config) {
          res.json({ received: true });
          return;
        }

        // Find client profile
        const [profile] = await db
          .select({ id: profilesTable.id })
          .from(profilesTable)
          .where(eq(profilesTable.email, customerEmail))
          .limit(1);

        if (profile) {
          // Grant product in client_user_products
          await db
            .insert(clientUserProductsTable)
            .values({
              profileId: profile.id,
              clientEmail: customerEmail,
              product,
              stripeSessionId: session.id,
              amountPaid: String((session.amount_total ?? 0) / 100),
              status: "active",
            })
            .onConflictDoNothing();

          // Upgrade accessLevel on profile
          const [fullProfile] = await db
            .select({ firstName: profilesTable.firstName, name: profilesTable.name })
            .from(profilesTable)
            .where(eq(profilesTable.id, profile.id))
            .limit(1);

          await db
            .update(profilesTable)
            .set({ accessLevel: config.accessLevel })
            .where(eq(profilesTable.id, profile.id));

          // Send purchase confirmation email
          const firstName = fullProfile?.firstName ?? fullProfile?.name?.split(" ")[0] ?? "there";
          const amountDisplay = String((session.amount_total ?? 0) / 100);
          sendEmail(customerEmail, purchaseConfirmationEmail(firstName, config.label, amountDisplay)).catch(() => {});
        }
      } catch (err) {
        console.error("[stripe/webhook] Fulfillment error:", err);
      }
    }
  }

  res.json({ received: true });
});

export default router;
