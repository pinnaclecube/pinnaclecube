/**
 * contact.ts — Pinnacle³
 *
 * Public contact form endpoint.
 * Creates a prospect record and sends emails to both the user and staff.
 */

import { Router, type Request, type Response } from "express";
import { db, prospectsTable } from "@workspace/db";
import { z } from "zod/v4";
import {
  sendEmail,
  contactFormConfirmationEmail,
  contactFormStaffAlertEmail,
} from "../services/emailService";

const router = Router();

const STAFF_EMAIL = "support@pinnaclecube.com";

const ContactBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  countryCode: z.string().min(1),
  phone: z.string().optional(),
  reason: z.string().min(1),
});

router.post(
  "/api/contact",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ContactBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      return;
    }

    const { firstName, lastName, email, countryCode, phone, reason } = parsed.data;
    const fullName = `${firstName} ${lastName}`.trim();
    const fullPhone = phone ? `${countryCode} ${phone}` : countryCode;

    try {
      await db.insert(prospectsTable).values({
        fullName,
        email,
        phone: fullPhone,
        sourceType: "contact_form",
        status: "new",
        internalNotes: `Reason: ${reason}`,
      });

      void sendEmail(email, contactFormConfirmationEmail(firstName));
      void sendEmail(STAFF_EMAIL, contactFormStaffAlertEmail(firstName, lastName, email, fullPhone, reason));

      res.json({ success: true });
    } catch (err) {
      console.error("[contact] Error:", err);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  }
);

export default router;
