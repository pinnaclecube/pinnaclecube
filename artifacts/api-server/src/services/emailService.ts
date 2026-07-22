// Pinnacle³ email service — all client-facing transactional emails
// Uses Resend via Replit Connectors integration
import type { CreateEmailOptions } from "resend";
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
        <li>Explore our advisory products — Excellence Lab, Evidence Engine, and Elite Blueprint</li>
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
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">Our Excellence Lab and Evidence Engine products are available to all clients and are an excellent starting point for strengthening your profile.</p>
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
  variant: "new" | "reminder" | "reopened" = "new",
): { subject: string; html: string; text: string } {
  const priorityColor = priority === "high" ? "#dc2626" : priority === "medium" ? "#d97706" : "#6b7280";

  const heading =
    variant === "reminder" ? "Reminder: action still needed"
      : variant === "reopened" ? "A task has been reopened"
        : "You have a new action item";
  const lead =
    variant === "reminder"
      ? `Hi ${firstName}, this is a reminder about a task your advisory team needs you to complete.`
      : variant === "reopened"
        ? `Hi ${firstName}, your advisory team has reopened a task that needs your attention again.`
        : `Hi ${firstName}, your advisory team has assigned you a task that requires your attention.`;
  const subject =
    variant === "reminder" ? `Reminder: ${title}`
      : variant === "reopened" ? `Reopened: ${title}`
        : `Action required: ${title}`;
  const tag =
    variant === "reminder" ? "REMINDER"
      : variant === "reopened" ? "REOPENED TASK"
        : "ACTION ITEM";
  const textLabel =
    variant === "reminder" ? "Reminder about a task"
      : variant === "reopened" ? "A task has been reopened"
        : "New action item";

  return {
    subject,
    html: layout(`
      ${h1(heading)}
      ${p(lead)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">${tag}</span>
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
    text: `Hi ${firstName},\n\n${textLabel} from your advisory team:\n\n"${title}"${description ? "\n\n" + description : ""}\n\nPriority: ${priority}\n\nLog in at ${APP_URL}/dashboard`,
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

// ─── Template 7: Contact form — client confirmation ───────────────────────────

export function contactFormConfirmationEmail(
  firstName: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "We received your inquiry — Pinnacle³",
    html: layout(`
      ${h1(`Thank you, ${firstName}!`)}
      ${p("We've received your inquiry and a member of our advisory team will be in touch at the earliest opportunity.")}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E2D6B;">WHAT HAPPENS NEXT</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
            Our team reviews every inquiry personally — you can typically expect a response within <strong>1–2 business days</strong>.
          </p>
        </td></tr>
      </table>
      ${p("In the meantime, explore our <a href=\"" + APP_URL + "/resources\" style=\"color:#1E2D6B;\">Resource Hub</a> or take our free <a href=\"" + APP_URL + "/instant-profile-insight/start\" style=\"color:#1E2D6B;\">Profile Insight Assessment</a>.")}
      ${btn("Explore Pinnacle³", APP_URL)}
    `),
    text: `Thank you, ${firstName}!\n\nWe've received your inquiry. A member of our advisory team will be in touch — typically within 1–2 business days.\n\nVisit us at ${APP_URL}`,
  };
}

// ─── Template 8: Contact form — staff alert ────────────────────────────────────

export function contactFormStaffAlertEmail(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  reason: string,
): { subject: string; html: string; text: string } {
  return {
    subject: `New contact inquiry — ${firstName} ${lastName}`,
    html: layout(`
      ${h1("New Contact Form Inquiry")}
      ${p("A new inquiry has been submitted through the Pinnacle³ website and added to the prospects queue.")}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Contact Details</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;width:110px;">Name</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${firstName} ${lastName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Email</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;"><a href="mailto:${email}" style="color:#1E2D6B;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Phone</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${phone || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Reason</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${reason}</td>
        </tr>
      </table>
      ${btn("View Prospects Queue", `${APP_URL}/internal/prospects`)}
    `),
    text: `New contact form inquiry:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone || "—"}\nReason: ${reason}\n\nView prospects queue at ${APP_URL}/internal/prospects`,
  };
}

// ─── Template 9: Booth lead — lead confirmation ───────────────────────────────

export function boothLeadConfirmationEmail(
  firstName: string,
  eventName?: string,
): { subject: string; html: string; text: string } {
  const eventLine = eventName ? ` at <strong>${eventName}</strong>` : "";
  return {
    subject: "Great meeting you — here's what Pinnacle³ can do for you",
    html: layout(`
      ${h1(`Great meeting you, ${firstName}!`)}
      ${p(`Thank you for stopping by our booth${eventLine}. We'd love to help you build an extraordinary EB-1A, EB-2 NIW, or O-1A case.`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Our Advisory Products</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;vertical-align:top;width:30%;">
            <span style="font-size:13px;font-weight:700;color:#1E2D6B;">Excellence Lab</span><br>
            <span style="font-size:12px;color:#6b7280;">$249 one-time</span>
          </td>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;font-size:13px;color:#374151;">Self-paced EB-1A/NIW strategy course with 8 criteria frameworks, evidence templates, and expert guidance.</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;vertical-align:top;">
            <span style="font-size:13px;font-weight:700;color:#1E2D6B;">Evidence Engine</span><br>
            <span style="font-size:12px;color:#6b7280;">$49/month</span>
          </td>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;font-size:13px;color:#374151;">Structured Google Drive workspace, evidence tracking, and expert review of your documents.</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;vertical-align:top;">
            <span style="font-size:13px;font-weight:700;color:#1E2D6B;">Elite Blueprint</span><br>
            <span style="font-size:12px;color:#6b7280;">Application-only</span>
          </td>
          <td style="padding:12px 16px;border-top:1px solid #e9ecef;font-size:13px;color:#374151;">Full-service advisory: dedicated strategist, end-to-end case planning, and hands-on support.</td>
        </tr>
      </table>
      ${p("Not sure where to start? Our free <strong>Instant Profile Insight</strong> assessment takes 2 minutes and tells you which visa path fits your background best.")}
      ${btn("Take the free assessment", `${APP_URL}/instant-profile-insight/start`)}
      <table cellpadding="0" cellspacing="0" style="margin:12px 0 0;">
        <tr><td>
          <a href="${APP_URL}/excellence-lab" style="color:#1E2D6B;font-size:14px;font-weight:600;text-decoration:none;">Explore Excellence Lab →</a>
        </td></tr>
      </table>
      ${divider()}
      ${p("Questions? Just reply to this email — we'd love to continue the conversation.")}
    `),
    text: `Great meeting you${eventName ? ` at ${eventName}` : ""}, ${firstName}!\n\nThank you for visiting our booth. Here's a quick look at what Pinnacle³ offers:\n\n- Excellence Lab ($249): Self-paced EB-1A/NIW strategy course\n- Evidence Engine ($49/mo): Structured evidence workspace\n- Elite Blueprint (application-only): Full-service advisory\n\nNot sure where to start? Take our free 2-minute Instant Profile Insight: ${APP_URL}/instant-profile-insight/start\n\nQuestions? Reply to this email.`,
  };
}

// ─── Template 10: Booth lead — staff alert ────────────────────────────────────

export function boothLeadStaffAlertEmail(
  fullName: string,
  email: string,
  phone: string | undefined,
  fieldOfWork: string | undefined,
  visaTarget: string | undefined,
  eventName: string | undefined,
): { subject: string; html: string; text: string } {
  return {
    subject: `New booth lead — ${fullName}${eventName ? ` (${eventName})` : ""}`,
    html: layout(`
      ${h1("New Booth Lead")}
      ${p(`A new lead was captured at the booth${eventName ? ` — <strong>${eventName}</strong>` : ""} and added to the prospects queue.`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Lead Details</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;width:120px;">Name</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Email</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;"><a href="mailto:${email}" style="color:#1E2D6B;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Phone</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${phone || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Field</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${fieldOfWork || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Visa Interest</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${visaTarget || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Event</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${eventName || "—"}</td>
        </tr>
      </table>
      ${btn("View in Prospects Queue", `${APP_URL}/internal/prospects`)}
    `),
    text: `New booth lead captured${eventName ? ` at ${eventName}` : ""}:\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || "—"}\nField: ${fieldOfWork || "—"}\nVisa Interest: ${visaTarget || "—"}\nEvent: ${eventName || "—"}\n\nView prospects queue at ${APP_URL}/internal/prospects`,
  };
}

// ─── Template 11: Payment received — staff alert ─────────────────────────────

export function paymentReceivedStaffAlertEmail(
  clientName: string,
  clientEmail: string,
  productLabel: string,
  amountDisplay: string,
  isNewAccount: boolean,
): { subject: string; html: string; text: string } {
  return {
    subject: `💳 Payment received — ${clientName} (${productLabel})`,
    html: layout(`
      ${h1("Payment Received")}
      ${p(`A client has just completed payment for <strong>${productLabel}</strong>. ${isNewAccount ? "A new portal account has been created and credentials emailed to the client." : "The client already had an account — their access has been upgraded."}`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Payment Details</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;width:130px;">Client</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${clientName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Email</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;"><a href="mailto:${clientEmail}" style="color:#1E2D6B;">${clientEmail}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Product</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${productLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Amount</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#16a34a;border-top:1px solid #e9ecef;">${amountDisplay}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Account</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${isNewAccount ? "New — credentials sent to client" : "Existing — access upgraded"}</td>
        </tr>
      </table>
      ${btn("View in Cases", `${APP_URL}/internal/cases`)}
    `),
    text: `Payment received!\n\nClient: ${clientName}\nEmail: ${clientEmail}\nProduct: ${productLabel}\nAmount: ${amountDisplay}\nAccount: ${isNewAccount ? "New — credentials sent to client" : "Existing — access upgraded"}\n\nView cases at ${APP_URL}/internal/cases`,
  };
}

// ─── Template 12: Staff invitation ────────────────────────────────────────────

export function prospectInviteEmail(
  firstName: string,
  registrationLink: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "You're invited to Pinnacle³ — create your account",
    html: layout(`
      ${h1(`Hi ${firstName}, you're invited!`)}
      ${p("Your Pinnacle³ advisory account is ready to be activated. Click the button below to create your password and access your personalized dashboard.")}
      ${btn("Activate my account", registrationLink)}
      ${divider()}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E2D6B;">WHAT TO EXPECT</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
            Once you activate your account you'll find your personalized visa readiness intake, strategy resources, and direct access to your Pinnacle³ advisory team.
          </p>
        </td></tr>
      </table>
      ${p("If the button above doesn't work, copy and paste this link into your browser:")}
      <p style="font-size:13px;color:#6b7280;word-break:break-all;">${registrationLink}</p>
      ${p("If you weren't expecting this invitation, you can safely ignore this email.")}
    `),
    text: `Hi ${firstName},\n\nYou've been invited to Pinnacle³. Click the link below to create your account:\n\n${registrationLink}\n\nIf you weren't expecting this, you can safely ignore this email.`,
  };
}

// ─── Template 12: Prospect proposal / invoice ──────────────────────────────────

export function invoiceEmail(
  firstName: string,
  productLabel: string,
  displayPrice: string,
  paymentUrl: string,
  visaCategory?: string | null,
): { subject: string; html: string; text: string } {
  const visaLine = visaCategory
    ? `<strong>${visaCategory}</strong> `
    : "";
  return {
    subject: `Your Pinnacle³ ${visaCategory ? visaCategory + " " : ""}Proposal — next step inside`,
    html: layout(`
      ${h1(`${firstName}, your personalized roadmap is ready`)}
      ${p(`We've reviewed your profile and prepared a custom ${visaLine}immigration strategy for you. Your proposal includes a personalized roadmap and a recommended first step to start building your case.`)}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#1E2D6B;text-transform:uppercase;letter-spacing:.5px;">Recommended product</p>
          <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">${productLabel}</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#1E2D6B;">${displayPrice}</p>
        </td></tr>
      </table>
      ${p("Your personalized roadmap is attached to this email as a PDF. Review it and when you're ready to move forward, complete your payment using the secure link below.")}
      ${btn("Complete payment — get started", paymentUrl)}
      ${divider()}
      ${p("Questions about the roadmap or the product? Simply reply to this email — we're happy to walk you through everything on a quick call.")}
      ${p(`<em style="color:#6b7280;font-size:13px;">Your payment link is unique to you and expires in 24 hours. If it expires, contact us and we'll generate a new one.</em>`)}
    `),
    text: `Hi ${firstName},\n\nYour personalized${visaCategory ? " " + visaCategory : ""} immigration roadmap is ready.\n\nRecommended: ${productLabel} — ${displayPrice}\n\nYour roadmap is attached as a PDF. When ready to move forward, complete payment here:\n${paymentUrl}\n\nQuestions? Reply to this email.`,
  };
}

// ─── Template 9a: User-initiated password reset link ─────────────────────────

export function passwordResetRequestEmail(
  firstName: string,
  resetUrl: string,
): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your Pinnacle³ password",
    html: layout(`
      ${h1("Password reset request")}
      ${p(`Hi ${firstName}, we received a request to reset the password for your Pinnacle³ account.`)}
      ${p("Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.")}
      ${btn("Reset my password →", resetUrl)}
      ${divider()}
      ${p("If you didn't request a password reset, you can safely ignore this email — your account is unchanged.")}
      ${p(`<em style="color:#6b7280;font-size:13px;">For security, this link expires in 1 hour and can only be used once.</em>`)}
    `),
    text: `Hi ${firstName},\n\nWe received a request to reset your Pinnacle³ password.\n\nReset your password here (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email — your account is unchanged.`,
  };
}

// ─── Template 9b: Prospect account created with temp password ─────────────────

export function prospectAccountCreatedEmail(
  firstName: string,
  email: string,
  tempPassword: string,
  productLabel: string,
): { subject: string; html: string; text: string } {
  const loginUrl = `${APP_URL}/login`;
  return {
    subject: "Your Pinnacle³ account is ready — sign in now",
    html: layout(`
      ${h1(`Welcome to Pinnacle³, ${firstName}!`)}
      ${p(`Your payment for <strong>${productLabel}</strong> is confirmed and your account has been created. You're all set to get started.`)}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#1E2D6B;text-transform:uppercase;letter-spacing:.5px;">Your login credentials</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Temporary password:</strong> <code style="background:#e8ecf8;padding:3px 10px;border-radius:4px;font-family:monospace;font-size:16px;font-weight:700;color:#1E2D6B;letter-spacing:.05em;">${tempPassword}</code></p>
        </td></tr>
      </table>
      ${p("You will be asked to set a permanent password on your first login. The process takes less than a minute.")}
      ${btn("Sign in & set your password →", loginUrl)}
      ${divider()}
      ${p("<strong>Keep this email safe</strong> — this is the only time your temporary password will be shown. If you run into any trouble, just reply here and we'll help immediately.")}
    `),
    text: `Welcome to Pinnacle³, ${firstName}!\n\nYour payment for ${productLabel} is confirmed and your account is ready.\n\nLogin credentials:\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou'll be prompted to set a permanent password on first login.\n\nSign in at: ${loginUrl}\n\nKeep this email safe — this is the only time the temporary password is shown.`,
  };
}

// ─── Template 10: Case Activation ─────────────────────────────────────────────

export function caseActivationEmail(
  firstName: string,
  productLabel: string,
  visaCategory: string,
): { subject: string; html: string; text: string } {
  const loginUrl = `${APP_URL}/login`;
  return {
    subject: "Your Pinnacle³ case is ready — log in to get started",
    html: layout(`
      ${h1(`Your case is set up, ${firstName}!`)}
      ${p("Great news — your Pinnacle³ case has been configured and is ready for you. Here's a summary of what's been set up:")}
      <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#1E2D6B;text-transform:uppercase;letter-spacing:.5px;">Case Details</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Product:</strong> ${productLabel}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Visa Category:</strong> ${visaCategory}</p>
        </td></tr>
      </table>
      ${p("Log in to your dashboard to review your case, upload evidence, and track progress. Your advisory team is already working on your petition strategy.")}
      ${btn("Access your dashboard →", loginUrl)}
      ${divider()}
      ${p("Your login credentials were included in our previous email. If you haven't set your permanent password yet, you'll be prompted to do so on first sign-in.")}
      ${p("Questions? Reply to this email or reach us at <a href=\"mailto:support@pinnaclecube.com\" style=\"color:#1E2D6B;\">support@pinnaclecube.com</a> — we're here to help.")}
    `),
    text: `Your case is set up, ${firstName}!\n\nYour Pinnacle³ case has been configured and is ready for you.\n\nCase Details:\nProduct: ${productLabel}\nVisa Category: ${visaCategory}\n\nLog in to your dashboard to review your case and track progress:\n${loginUrl}\n\nYour login credentials were included in our previous email. If you haven't set your password yet, you'll be prompted on first sign-in.\n\nQuestions? Contact us at support@pinnaclecube.com`,
  };
}

// ─── Template 16: Task completed — staff alert ────────────────────────────────

export function taskCompletedStaffAlertEmail(
  clientName: string,
  taskTitle: string,
  completedAt: Date,
  clientNote: string | null,
  caseUrl: string,
): { subject: string; html: string; text: string } {
  const formattedDate = completedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
  return {
    subject: `Task Completed — ${clientName}`,
    html: layout(`
      ${h1("A client completed a task")}
      ${p(`<strong>${clientName}</strong> has marked an action item as complete.`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Task Details</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;width:140px;">Client</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${clientName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Task</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${taskTitle}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Completed at</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;border-top:1px solid #e9ecef;">${formattedDate} ET</td>
        </tr>
        ${clientNote ? `
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;vertical-align:top;">Client note</td>
          <td style="padding:10px 16px;font-size:14px;color:#374151;border-top:1px solid #e9ecef;line-height:1.6;">${clientNote}</td>
        </tr>` : ""}
      </table>
      ${btn("View client case", caseUrl)}
    `),
    text: `Task Completed — ${clientName}\n\nClient: ${clientName}\nTask: ${taskTitle}\nCompleted: ${formattedDate} ET${clientNote ? `\nClient note: ${clientNote}` : ""}\n\nView case: ${caseUrl}`,
  };
}

// ─── Template: reference letter ready for client review ─────────────────────────

export function referenceLetterReviewEmail(
  clientFirstName: string,
  referee: { fullName: string; title: string; organization: string },
): { subject: string; html: string; text: string } {
  return {
    subject: `Reference letter ready for your review — ${referee.fullName}`,
    html: layout(`
      ${h1("Your reference letter is ready to review")}
      ${p(`Hi ${clientFirstName}, a reference letter has been prepared for the following referee and is ready for your review:`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;padding:18px 22px;margin:0 0 20px;width:100%;">
        <tr><td>
          <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">${referee.fullName}</p>
          <p style="margin:6px 0 0;font-size:14px;color:#374151;">${referee.title}, ${referee.organization}</p>
        </td></tr>
      </table>
      ${p("Please log in to your client portal to <strong>download and review the letter in detail</strong>. Carefully check the facts, dates, titles, contribution details, and the spelling of all names.")}
      ${p("<strong>Important:</strong> once you confirm, this reference letter <strong>and this referee's details will be locked</strong> — no further edits can be made. If anything needs correction, please contact us <strong>before</strong> confirming.")}
      ${btn("Log in to review", `${APP_URL}/login`)}
      ${divider()}
      ${p("Questions? Just reply to this email — we read every one.")}
    `),
    text: `Hi ${clientFirstName},\n\nA reference letter is ready for your review:\n${referee.fullName} — ${referee.title}, ${referee.organization}\n\nLog in to your client portal to download and review the letter IN DETAIL — check the facts, dates, titles, contribution details, and spelling of names: ${APP_URL}/login\n\nIMPORTANT: once you confirm, this reference letter and this referee's details will be LOCKED and no further edits can be made. If anything needs correction, contact us BEFORE confirming.`,
  };
}

// ─── Template: client confirmed reference letter (staff alert) ──────────────────

export function referenceLetterConfirmedStaffEmail(
  caseRef: string,
  referee: { fullName: string; title: string; organization: string },
  letter: { version: number; confirmedAt: Date },
  caseUrl: string,
): { subject: string; html: string; text: string } {
  const formattedDate = letter.confirmedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
  return {
    subject: `Client confirmed reference letter — ${caseRef} — ${referee.fullName}`,
    html: layout(`
      ${h1("A client confirmed a reference letter")}
      ${p(`<strong>${caseRef}</strong> has reviewed and confirmed the reference letter below. The referee and letter are now <strong>locked</strong>.`)}
      <table cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:8px;width:100%;margin:0 0 24px;overflow:hidden;">
        <tr style="background:#f8f9fb;">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Confirmation Details</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;width:150px;">Case</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${caseRef}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Referee</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e9ecef;">${referee.fullName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Title / Organization</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;border-top:1px solid #e9ecef;">${referee.title}, ${referee.organization}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Letter version</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;border-top:1px solid #e9ecef;">v${letter.version}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e9ecef;">Confirmed at</td>
          <td style="padding:10px 16px;font-size:14px;color:#111827;border-top:1px solid #e9ecef;">${formattedDate} ET</td>
        </tr>
      </table>
      ${btn("View client case", caseUrl)}
    `),
    text: `Client confirmed reference letter — ${caseRef} — ${referee.fullName}\n\nCase: ${caseRef}\nReferee: ${referee.fullName} (${referee.title}, ${referee.organization})\nLetter version: v${letter.version}\nConfirmed at: ${formattedDate} ET\n\nThe referee and letter are now locked.\n\nView case: ${caseUrl}`,
  };
}

// ─── Sender helper ─────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  attachments?: EmailAttachment[];
  cc?: string[];
}

export async function sendEmail(
  to: string,
  template: { subject: string; html: string; text: string },
  options?: SendEmailOptions,
): Promise<void> {
  try {
    const { client } = await getUncachableResendClient();

    const payload: CreateEmailOptions = {
      from: FROM,
      to: [to],
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...(options?.cc?.length ? { cc: options.cc } : {}),
      ...(options?.attachments?.length
        ? {
            attachments: options.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
            })),
          }
        : {}),
    };

    const { error } = await client.emails.send(payload);
    if (error) {
      console.error("[emailService] Resend error:", error);
    }
  } catch (err) {
    console.error("[emailService] Failed to send email to", to, err);
  }
}
