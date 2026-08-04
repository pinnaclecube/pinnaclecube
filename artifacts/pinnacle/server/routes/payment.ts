import { Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Product pricing configuration - single source of truth
const PRODUCT_PRICES: Record<string, number> = {
  excellence_lab: 24900, // $249.00 in cents
  evidence_vault: 4900,  // $49.00 in cents
  elite_blueprint: 99900, // $999.00 in cents
};

interface ProcessPaymentRequest {
  sessionId: string;
}

export async function paymentProvisionAndLogin(
  req: Request<{}, {}, ProcessPaymentRequest>,
  res: Response
) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // Retrieve the Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price.product"],
    });

    // Verify payment was successful
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Extract product and amount from session
    const productKey = session.metadata?.product;
    if (!productKey) {
      return res.status(400).json({ error: "Product not specified in session" });
    }

    // Validate product exists in our pricing config
    const expectedPrice = PRODUCT_PRICES[productKey];
    if (expectedPrice === undefined) {
      return res.status(400).json({ error: "Invalid product" });
    }

    // Validate amount paid matches expected price
    const amountPaid = session.amount_total; // in cents
    if (amountPaid !== expectedPrice) {
      console.error(
        `Price mismatch: expected ${expectedPrice} but received ${amountPaid} for product ${productKey}`
      );
      return res.status(400).json({
        error: "Payment amount does not match product price",
      });
    }

    // Check if payment has already been processed
    const existingPayment = await db.payment.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (existingPayment) {
      return res.status(400).json({ error: "Payment already processed" });
    }

    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      return res.status(400).json({ error: "Customer email not found" });
    }

    // Find or create user
    let user = await db.user.findUnique({
      where: { email: customerEmail },
    });

    let requiresPasswordChange = false;

    if (!user) {
      // Create new user with temporary password
      const tempPassword = Math.random().toString(36).slice(-12);
      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      user = await db.user.create({
        data: {
          email: customerEmail,
          password: hashedPassword,
          accessLevel: productKey,
          requiresPasswordChange: true,
        },
      });

      requiresPasswordChange = true;

      // TODO: Send email with temporary password
    } else {
      // Update existing user's access level
      user = await db.user.update({
        where: { id: user.id },
        data: { accessLevel: productKey },
      });
    }

    // Record payment
    await db.payment.create({
      data: {
        userId: user.id,
        stripeSessionId: sessionId,
        product: productKey,
        amount: amountPaid,
        status: "completed",
      },
    });

    // Generate JWT token
    const jwt = await import("jsonwebtoken");
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      product: productKey,
      requiresPasswordChange,
    });
  } catch (error) {
    console.error("Payment provision error:", error);
    return res.status(500).json({ error: "Failed to process payment" });
  }
}
