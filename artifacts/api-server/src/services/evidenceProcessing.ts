/**
 * evidenceProcessing.ts — Pinnacle³
 *
 * Shared helpers for text extraction and AI summary generation.
 * Used by both the upload route and the Drive ingest poller.
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Lazy Anthropic client ────────────────────────────────────────────────────

function getAI(): Anthropic | null {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ─── Text extraction ──────────────────────────────────────────────────────────

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  const lowerName = originalName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text ?? "";
    } catch {
      return "";
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.google-apps.document" ||
    lowerName.endsWith(".docx")
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    } catch {
      return "";
    }
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv")
  ) {
    return buffer.toString("utf8");
  }

  return "";
}

// ─── Claude summary ───────────────────────────────────────────────────────────

export async function generateAISummary(
  extractedText: string,
  legalStandard: string,
  clientField: string,
): Promise<string | null> {
  const ai = getAI();
  if (!ai || !extractedText.trim()) return null;

  try {
    const msg = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are an immigration evidence analyst assisting with a US visa petition.

Client's professional field: ${clientField}

USCIS criterion legal standard:
"${legalStandard}"

Extracted text from evidence document (first 3000 chars):
${extractedText.slice(0, 3000)}

Write a concise 2-3 sentence summary explaining what this document demonstrates specifically in relation to the USCIS criterion above. Be factual, specific, and use language suitable for a petition support letter. Do not speculate beyond what the text shows.`,
        },
      ],
    });

    const block = msg.content[0];
    return block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}
