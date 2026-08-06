import { db } from "@workspace/db";
import { products } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { Request } from "express";

interface ProcessPaymentInput {
  productId: string;
  amount: number;
  // Add other payment fields as needed
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ROUNDING_TOLERANCE = 0.01;

/**
 * Validates the submitted payment amount against the product's actual price
 * from the database.
 *
 * @param productId - The ID of the product being purchased
 * @param submittedAmount - The amount submitted by the user
 * @param req - Express request object for logging
 * @returns ValidationResult indicating if the amount is valid
 */
export async function validatePaymentAmount(
  productId: string,
  submittedAmount: number,
  req: Request
): Promise<ValidationResult> {
  try {
    // Fetch the product price from the database
    const [product] = await db
      .select({ price: products.price })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      req.log.warn({ productId }, "Product not found during payment validation");
      return {
        valid: false,
        error: "Product not found",
      };
    }

    const actualPrice = Number(product.price);

    // Check if submitted amount is less than product price
    if (submittedAmount < actualPrice) {
      req.log.warn(
        { productId, submittedAmount, actualPrice },
        "Payment amount is less than product price"
      );
      return {
        valid: false,
        error: "Payment amount is less than the product price",
      };
    }

    // Check if the difference exceeds acceptable rounding tolerance
    const priceDifference = Math.abs(submittedAmount - actualPrice);
    if (priceDifference > ROUNDING_TOLERANCE) {
      req.log.warn(
        { productId, submittedAmount, actualPrice, priceDifference },
        "Payment amount differs from product price by more than acceptable tolerance"
      );
      return {
        valid: false,
        error: `Payment amount differs from product price by more than acceptable tolerance (${ROUNDING_TOLERANCE})`,
      };
    }

    req.log.info(
      { productId, submittedAmount, actualPrice },
      "Payment amount validated successfully"
    );

    return { valid: true };
  } catch (error) {
    req.log.error(
      { error, productId, submittedAmount },
      "Error during payment amount validation"
    );
    return {
      valid: false,
      error: "Failed to validate payment amount",
    };
  }
}

/**
 * Processes a payment after validating the amount against the product price.
 *
 * @param input - Payment details including productId and amount
 * @param req - Express request object for logging
 * @returns Payment processing result
 */
export async function processPayment(
  input: ProcessPaymentInput,
  req: Request
): Promise<{ success: boolean; error?: string; paymentId?: string }> {
  const { productId, amount } = input;

  // Validate the payment amount against the product price
  const validation = await validatePaymentAmount(productId, amount, req);

  if (!validation.valid) {
    req.log.warn(
      { productId, amount, error: validation.error },
      "Payment validation failed"
    );
    return {
      success: false,
      error: validation.error,
    };
  }

  // Proceed to payment gateway
  try {
    req.log.info({ productId, amount }, "Processing payment with gateway");

    // TODO: Implement actual payment gateway integration
    // Example: const paymentResult = await stripe.paymentIntents.create({...});

    // Placeholder for successful payment processing
    const paymentId = `pay_${Date.now()}`;

    req.log.info({ productId, amount, paymentId }, "Payment processed successfully");

    return {
      success: true,
      paymentId,
    };
  } catch (error) {
    req.log.error({ error, productId, amount }, "Payment processing failed");
    return {
      success: false,
      error: "Payment processing failed",
    };
  }
}