// Pinnacle³ email service — all client-facing transactional emails
// Uses Resend via Replit Connectors integration
import { getUncachableResendClient } from "./resend";

const FROM = "Pinnacle³ <support@pinnaclecube.com>";
const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";

// ─── Shared layout ─────────────────────────────────────────────────────────────

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
        <!-- Header -->
        <tr>
          <td style="background:#1E2D6B;padding:28px 40px;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px;">Pinnacle³</span>
            <span style="color:#a0aec0;font-size:13px;margin-left:10px;">EB-1A · EB-2 NIW · O-1A</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #e9ecef;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.8;">
              This email was sent by Pinnacle³ advisory platform · <a href="${APP_URL}" style="color:#1E2D6B;text-decoration:none;">pinnaclecube.com</a><br>
              For questions, reply to this email or contact <a href="mailto:support@pinnaclecube.com" style="color:#1E2D6B;text-decoration:none;">support@pinnaclecube.com</a><br>
              470 Olde Worthington Rd, Westerville, OH 43082
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">${text}</p>`;
}

function btn(text: string, url: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="background:#1E2D6B;border-radius:7px;padding:13px 28px;">
      <a href="${url}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${text}</a>
    </td></tr>
  </table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #e9ecef;margin:24px 0;">`;
}

function badge(label: string, color: string) {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${color};color:#fff;">${label}</span>`;
}

// ─── Template 1: Welcome ───────────────────────────────────────────────────────

export function welcomeEmail(firstName: string): { subject: string; html: string; text: string } {
  return {
    subject: "Welcome to Pinnacle³ — your EB-1A journey starts here",
    html: layout(`
      ${h1(`Welcome, ${firstName}!`)}
      ${p("Your Pinnacle³ account is ready. We're here to help you build an extraordinary EB-1A, EB-2 NIW, or O-1A case — step by step.")}
      ${p("Here's what you can do right now:")}
      <ul style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:15px;line-height:2;">
        <li>Complete your <strong>readiness intake</strong> to unlock your visa profile</li>
        <li>Browse the <strong>Resource Hub</strong> for 13 in-depth strategy guides</li>
        <li>Explore our advisory products — Excellence Lab, Evidence Vault, and Elite Blueprint</li>
      </ul>
      ${btn("Go to your dashboard", `${APP_URL}/dashboard`)}
      ${divider()}
      ${p("Questions? Just reply to this email — we read every one.")}
    `),
    text: `Welcome, ${firstName}!\n\nYour Pinnacle³ account is ready. Log in at ${APP_URL}/dashboard to get started.\n\nQuestions? Reply to this email.`,
  };
}

// ─── Template 2: Purchase confirmation ────────────────────────────────────────

export function purchaseConfirmationEmail(
  firstName: string,
  productLabel: string,
  amount: string,
): { subject: string; html: string; text: string } {
  return {
    subject: `Your Pinnacle³ purchase is confirmed — ${productLabel}`,
    html: layout(`
      ${h1("Payment confirmed — you're in!")}
      ${p(`Thank you, ${firstName}. Your purchase of <strong>${productLabel}</strong> is confirmed and your access is now active.`)}
      <table cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Product</td><td style="font-size:13px;color:#6b7280;padding-bottom:6px;text-align:right;">Amount</td></tr>
        <tr>
          <td style="font-size:16px;font-weight:600;color:#111827;">${productLabel}</td>
          <td style="font-size:16px;font-weight:600;color:#111827;text-align:right;">$${amount}</td>
        </tr>
      </table>
      ${btn("Access your account", `${APP_URL}/dashboard`)}
      ${divider()}
      ${p("Save this email as your receipt. If you have any questions about your purchase, reply here and we'll sort it out.")}
    `),
    text: `Payment confirmed! Your purchase of ${productLabel} ($${amount}) is active.\n\nLog in at ${APP_URL}/dashboard.\n\nKeep this email as your receipt.`,
  };
}

// ─── Template 3: Blueprint application received ───────────────────────────────

export function blueprintApplicationReceivedEmail(
  firstName: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "We received your Elite Blueprint application",
    html: layout(`
      ${h1("Application received!")}
      ${p(`Thanks, ${firstName}. We've received your Elite Blueprint application and our team will review it carefully.`)}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E2D6B;">WHAT HAPPENS NEXT</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
            Our team reviews every application personally — typically within <strong>2–3 business days</strong>. 
            You'll receive an email with our decision and next steps.
          </p>
        </td></tr>
      </table>
      ${btn("Check application status", `${APP_URL}/blueprint`)}
      ${divider()}
      ${p("In the meantime, explore our <a href=\"" + APP_URL + "/resources\" style=\"color:#1E2D6B;\">Resource Hub</a> to start building your evidence strategy.")}
    `),
    text: `Thanks, ${firstName}! We've received your Elite Blueprint application.\n\nOur team reviews every application personally — typically within 2–3 business days. You'll get an email with our decision.\n\nCheck status at ${APP_URL}/blueprint`,
  };
}

// ─── Template 4: Blueprint decision — approved ────────────────────────────────

export function blueprintApprovedEmail(
  firstName: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "🎉 Your Elite Blueprint application is approved",
    html: layout(`
      ${h1("Congratulations — you're approved!")}
      ${badge("APPROVED", "#059669")}
      <div style="height:16px;"></div>
      ${p(`Great news, ${firstName}! We've reviewed your application and we're excited to work with you. Your Elite Blueprint application is <strong>approved</strong>.`)}
      ${p("The next step is completing your payment to activate your Elite Blueprint access and get paired with your advisory team.")}
      ${btn("Complete payment & get started", `${APP_URL}/blueprint`)}
      ${divider()}
      ${p("Questions before paying? Just reply to this email — we're happy to hop on a quick call.")}
    `),
    text: `Congratulations, ${firstName}! Your Elite Blueprint application is approved.\n\nNext step: complete payment to activate your access.\n\nGo to ${APP_URL}/blueprint`,
  };
}

// ─── Template 4b: Blueprint decision — declined ───────────────────────────────

export function blueprintDeclinedEmail(
  firstName: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "Your Elite Blueprint application — an update",
    html: layout(`
      ${h1("An update on your application")}
      ${p(`Hi ${firstName}, thank you for applying to the Elite Blueprint program and for sharing your background with us.`)}
      ${p("After careful review, we're not able to move forward with your application at this time. This isn't a reflection of your achievements — Elite Blueprint is a highly selective program with limited capacity.")}
      <table cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111827;">Still want to build your case?</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">Our Excellence Lab and Evidence Vault products are available to all clients and are an excellent starting point for strengthening your profile.</p>
        </td></tr>
      </table>
      ${btn("Explore our other products", `${APP_URL}/products`)}
      ${divider()}
      ${p("Thank you again for your interest in Pinnacle³. We wish you the very best in your immigration journey.")}
    `),
    text: `Hi ${firstName},\n\nThank you for applying to Elite Blueprint. After careful review, we're not able to move forward at this time.\n\nExplore our other products at ${APP_URL}/products\n\nWishing you all the best.`,
  };
}

// ─── Template 5: Action item assigned ────────────────────────────────────────

export function actionItemEmail(
  firstName: string,
  title: string,
  description: string | null,
  priority: string,
): { subject: string; html: string; text: string } {
  const priorityColor = priority === "high" ? "#dc2626" : priority === "medium" ? "#d97706" : "#6b7280";
  return {
    subject: `Action required: ${title}`,
    html: layout(`
      ${h1("You have a new action item")}
      ${p(`Hi ${firstName}, your advisory team has assigned you a task that requires your attention.`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">ACTION ITEM</span>
            ${badge(priority.toUpperCase(), priorityColor)}
          </div>
          <p style="margin:8px 0 0;font-size:17px;font-weight:700;color:#111827;">${title}</p>
          ${description ? `<p style="margin:10px 0 0;font-size:14px;color:#374151;line-height:1.7;">${description}</p>` : ""}
        </td></tr>
      </table>
      ${btn("View in dashboard", `${APP_URL}/dashboard`)}
      ${divider()}
      ${p("Log in to mark this complete or ask your advisory team a question.")}
    `),
    text: `Hi ${firstName},\n\nNew action item from your advisory team:\n\n"${title}"${description ? "\n\n" + description : ""}\n\nPriority: ${priority}\n\nLog in at ${APP_URL}/dashboard`,
  };
}

// ─── Template 6: Staff password reset ────────────────────────────────────────

export function passwordResetEmail(
  firstName: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "Your Pinnacle³ password has been reset",
    html: layout(`
      ${h1("Password updated")}
      ${p(`Hi ${firstName}, your Pinnacle³ account password was recently reset by the advisory team.`)}
      <table cellpadding="0" cellspacing="0" style="background:#fef3c7;border-left:4px solid #d97706;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0;font-size:14px;color:#92400e;line-height:1.7;">
            <strong>Was this unexpected?</strong> If you didn't request a password reset, please contact us immediately at 
            <a href="mailto:support@pinnaclecube.com" style="color:#92400e;">support@pinnaclecube.com</a>
          </p>
        </td></tr>
      </table>
      ${p("Your advisor will share your new credentials with you directly. Once you log in, we recommend changing your password from your account settings.")}
      ${btn("Log in to Pinnacle³", `${APP_URL}/login`)}
    `),
    text: `Hi ${firstName},\n\nYour Pinnacle³ password has been reset by the advisory team.\n\nIf this was unexpected, contact us at support@pinnaclecube.com\n\nLog in at ${APP_URL}/login`,
  };
}

// ─── Sender helper ─────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  template: { subject: string; html: string; text: string },
): Promise<void> {
  try {
    const { client } = await getUncachableResendClient();
    const { error } = await client.emails.send({
      from: FROM,
      to: [to],
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    if (error) {
      console.error("[emailService] Resend error:", error);
    }
  } catch (err) {
    console.error("[emailService] Failed to send email to", to, err);
  }
}
