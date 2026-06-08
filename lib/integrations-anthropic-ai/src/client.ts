import Anthropic from "@anthropic-ai/sdk";

// On Replit the AI_INTEGRATIONS_* vars are injected automatically and point the
// SDK at Replit's Anthropic proxy. Off Replit (Vercel), set a direct
// ANTHROPIC_API_KEY instead and leave the base URL unset so the SDK talks to
// api.anthropic.com. Either configuration works.
const apiKey =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "Anthropic API key missing. Set ANTHROPIC_API_KEY (direct Anthropic API) " +
      "or AI_INTEGRATIONS_ANTHROPIC_API_KEY (Replit AI integration).",
  );
}

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
