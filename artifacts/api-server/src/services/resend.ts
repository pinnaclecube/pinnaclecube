// Resend email service — uses Replit Connectors integration
// Integration: connector:ccfg_resend_01K69QKYK789WN202XSE3QS17V
import { Resend } from "resend";

let connectionSettings: Record<string, any> | undefined;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    throw new Error("Resend not connected");
  }

  return {
    apiKey: connectionSettings.settings.api_key as string,
    fromEmail: (connectionSettings.settings.from_email as string | undefined) ?? "",
  };
}

// WARNING: Never cache this client — tokens expire.
// Always call this function to get a fresh client.
export async function getUncachableResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  // Prefer a direct API key — works on any host (Vercel, custom domain, local).
  // Set RESEND_API_KEY from the Resend dashboard. Falls back to the Replit
  // Connectors integration when running on Replit (no RESEND_API_KEY set).
  const directKey = process.env.RESEND_API_KEY?.trim();
  if (directKey) {
    return {
      client: new Resend(directKey),
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() ?? "",
    };
  }

  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}
