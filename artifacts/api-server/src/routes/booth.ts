/**
 * booth.ts — Pinnacle³
 *
 * Public booth lead capture endpoint.
 * No authentication required — used at events/conferences to capture visitor details.
 * Creates a prospect record and sends confirmation + staff alert emails.
 */

import { Router, type Request, type Response } from "express";
import { db, prospectsTable } from "@workspace/db";
import { z } from "zod/v4";
import {
  sendEmail,
  boothLeadConfirmationEmail,
  boothLeadStaffAlertEmail,
} from "../services/emailService";

const router = Router();

const STAFF_EMAIL = "support@pinnaclecube.com";

const BoothLeadBody = z.object({
  fullName: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  fieldOfWork: z.string().optional(),
  visaTarget: z.string().optional(),
  eventName: z.string().optional(),
});

router.post(
  "/booth/lead",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = BoothLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      return;
    }

    const { fullName, email, phone, fieldOfWork, visaTarget, eventName } = parsed.data;
    const firstName = fullName.split(" ")[0] ?? fullName;

    const notes = [
      eventName ? `Event: ${eventName}` : null,
      visaTarget ? `Visa interest: ${visaTarget}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    try {
      await db.insert(prospectsTable).values({
        fullName,
        email,
        phone: phone || null,
        fieldOfWork: fieldOfWork || null,
        sourceType: "booth",
        status: "new",
        internalNotes: notes || null,
      });

      void sendEmail(email, boothLeadConfirmationEmail(firstName, eventName));
      void sendEmail(
        STAFF_EMAIL,
        boothLeadStaffAlertEmail(fullName, email, phone, fieldOfWork, visaTarget, eventName),
      );

      res.json({ success: true });
    } catch (err) {
      console.error("[booth] Error:", err);
      res.status(500).json({ error: "Failed to save lead" });
    }
  },
);

export default router;
