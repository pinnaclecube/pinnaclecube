import { Router, type Request, type Response } from "express";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { getUncachableResendClient } from "../services/resend";

const router = Router();

// POST /api/email/test  — staff only, sends a test email to verify Resend is working
router.post(
  "/test",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { to } = req.body as { to?: string };
    if (!to || typeof to !== "string" || !to.includes("@")) {
      res.status(400).json({ error: "Provide a valid 'to' email address in the request body." });
      return;
    }

    try {
      const { client } = await getUncachableResendClient();

      const { data, error } = await client.emails.send({
        from: "Pinnacle³ <support@pinnaclecube.com>",
        to: [to],
        subject: "Pinnacle³ — test email",
        html: `
          <div style="font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a;">
            <div style="margin-bottom:24px;">
              <span style="font-size:22px;font-weight:700;color:#1E2D6B;">Pinnacle³</span>
            </div>
            <h2 style="font-size:20px;font-weight:600;margin-bottom:12px;">Test email — it works!</h2>
            <p style="color:#555;line-height:1.6;">
              This is a confirmation that your Resend integration is correctly configured
              and emails are sending from <strong>support@pinnaclecube.com</strong>.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="font-size:12px;color:#999;">
              Sent by Pinnacle³ advisory platform &middot; pinnaclecube.com
            </p>
          </div>`,
        text: "Pinnacle³ test email — your Resend integration is working correctly.",
      });

      if (error) {
        res.status(502).json({ error: "Resend API error", detail: error });
        return;
      }

      res.json({ success: true, messageId: data?.id });
    } catch (err: any) {
      console.error("[email/test] Failed:", err);
      res.status(500).json({ error: "Email send failed", detail: err?.message ?? "Unknown error" });
    }
  },
);

export default router;
