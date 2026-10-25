/**
 * letterGenerationService.ts — Pinnacle³
 *
 * Step 4 — generate a referee reference-letter draft from the assembled context,
 * using the shared Anthropic client (claude-sonnet-4-5, non-streaming). Persists
 * to letter_drafts (prior draft → 'superseded'). The house template + hard rules
 * live in the system prompt. Anti-repetition: the openings of this case's other
 * referee drafts are passed so voices vary between referees.
 */

import { eq, and, ne, inArray, desc, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import {
  db,
  refereesTable,
  referenceLettersTable,
  refereeProjectsTable,
  refereeEvidenceTable,
  letterDraftsTable,
} from "@workspace/db";
import { buildLetterContext, serializeLetterContext } from "./letterContextService";
import { logger } from "../lib/logger";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4000;

// Lazy client — matches the getAI() pattern used by every other AI service here
// (reuses the same ANTHROPIC_API_KEY / base-URL config; never inits at boot).
function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; error?: { type?: string } } | null;
  return e?.status === 429 || e?.error?.type === "rate_limit_error";
}

// ─── House template + hard rules (system prompt) ─────────────────────────────────

const SYSTEM_PROMPT = `You draft reference letters that support U.S. immigration petitions (EB-1A / EB-2 NIW / O-1A). You write ONE letter, in the first-person voice of the referee described in the context, addressed to U.S. Citizenship and Immigration Services.

Produce the letter body as clean Markdown, following this structure:
1. A letterhead placeholder line exactly: "[Referee's institutional letterhead]", then the date line: "[Date]".
2. Addressee: "U.S. Citizenship and Immigration Services".
3. Opening: the referee introduces themselves (title, organization, credentials, years in the field) and states the purpose: to support [applicant]'s petition.
4. Basis of knowledge: how, where, and when the referee knows the applicant. If they worked together, ground it in the shared organization and period. If they did NOT work together (independent), describe knowing the work by reputation, through its published or public impact, or within the field — never claim first-hand collaboration. Explain why the referee is qualified to judge this work.
5. Body: 2–3 substantive narratives drawn ONLY from the mapped projects and evidence — the concrete problem, what the applicant did, and the specific, quantified outcomes, written as the referee's first-hand or expert observation.
6. Criteria framing: explicit paragraph(s) tying the work to "original contributions of major significance" and/or a "leading or critical role," matching what the mapped data actually supports.
7. Comparative assessment: why this ability is rare among peers in the field.
8. Closing endorsement and a signature block: the referee's name, title, organization, and email.

HARD RULES:
- Write in the first person, in the referee's voice. Natural, human, professional prose.
- Use ONLY facts present in the provided context. Never invent metrics, dates, venues, publications, awards, employers, or events. If a useful detail is missing, write around it rather than fabricating.
- An independent referee (worked together = NO) must never claim to have personally collaborated with or directly supervised the applicant.
- Do NOT use em dashes. Do NOT use formulaic transitions ("Furthermore," "Moreover," "In conclusion"), inflated adjectives, or marketing language. Plain American English.
- Vary voice, vocabulary, sentence rhythm, and paragraph structure. You will be given the openings already used by other referees for the same applicant — do NOT echo their phrasing, structure, or opening lines.
- Length: 900 to 1,300 words.
- Output ONLY the letter in Markdown. No preamble, no commentary, no code fences.`;

// ─── Eligibility gate ─────────────────────────────────────────────────────────────

export interface Eligibility { ok: boolean; reasons: string[] }

export async function checkEligibility(
  referee: typeof refereesTable.$inferSelect,
): Promise<Eligibility> {
  const reasons: string[] = [];

  if (!referee.willingnessConfirmed) reasons.push("Confirm this referee's willingness to provide a letter first.");
  if (referee.isLocked) reasons.push("This referee is locked (a letter was already confirmed). Unlock it to generate a new draft.");

  const [activeLetter] = await db
    .select({ status: referenceLettersTable.status })
    .from(referenceLettersTable)
    .where(and(eq(referenceLettersTable.refereeId, referee.id), eq(referenceLettersTable.isActive, true)))
    .limit(1);
  if (activeLetter && (activeLetter.status === "pending_review" || activeLetter.status === "confirmed")) {
    reasons.push("A reference letter is already pending client review or confirmed. Resolve it before generating a new draft.");
  }

  const [{ projects }] = await db
    .select({ projects: sql<number>`count(*)::int` })
    .from(refereeProjectsTable)
    .where(eq(refereeProjectsTable.refereeId, referee.id));
  const [{ evidence }] = await db
    .select({ evidence: sql<number>`count(*)::int` })
    .from(refereeEvidenceTable)
    .where(eq(refereeEvidenceTable.refereeId, referee.id));
  if ((projects ?? 0) + (evidence ?? 0) === 0) {
    reasons.push("Map at least one project or evidence item for this referee first.");
  }

  return { ok: reasons.length === 0, reasons };
}

// ─── Anti-repetition: openings of the case's other referee drafts ────────────────

async function otherRefereeOpenings(caseId: number, refereeId: number): Promise<string[]> {
  const rows = await db
    .select({
      refereeId: letterDraftsTable.refereeId,
      content: letterDraftsTable.content,
      version: letterDraftsTable.version,
    })
    .from(letterDraftsTable)
    .innerJoin(refereesTable, eq(refereesTable.id, letterDraftsTable.refereeId))
    .where(
      and(
        eq(refereesTable.caseId, caseId),
        ne(letterDraftsTable.refereeId, refereeId),
        inArray(letterDraftsTable.status, ["draft", "finalized"]),
      ),
    )
    .orderBy(desc(letterDraftsTable.version));

  // Latest draft per other referee → its first paragraph (opening).
  const seen = new Set<number>();
  const openings: string[] = [];
  for (const r of rows) {
    if (seen.has(r.refereeId)) continue;
    seen.add(r.refereeId);
    // Skip boilerplate lines (letterhead placeholder, date, addressee); take the
    // first real prose paragraph as the "opening" fingerprint.
    const cleaned = r.content
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return t && !t.startsWith("[") && !/citizenship and immigration/i.test(t);
      })
      .join("\n")
      .trim();
    openings.push(cleaned.slice(0, 400));
  }
  return openings;
}

// ─── Generate + persist ──────────────────────────────────────────────────────────

export interface GenerateOptions {
  feedback?: string | null;       // change-request / instructions for regeneration
  generatedBy: "client" | "staff";
}

async function callModel(systemExtras: string, userMessage: string): Promise<string> {
  const ai = getAI();
  const attempt = async () => {
    const response = await ai.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT + systemExtras,
      messages: [{ role: "user", content: userMessage }],
    });
    return response.content
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();
  };
  try {
    return await attempt();
  } catch (err) {
    if (isRateLimit(err)) {
      await new Promise((r) => setTimeout(r, 3000));
      return await attempt();
    }
    throw err;
  }
}

export async function generateLetterDraft(
  referee: typeof refereesTable.$inferSelect,
  opts: GenerateOptions,
): Promise<typeof letterDraftsTable.$inferSelect> {
  const ctx = await buildLetterContext(referee.id);
  if (!ctx) throw new Error("Could not assemble letter context");

  const openings = await otherRefereeOpenings(referee.caseId, referee.id);
  const systemExtras = openings.length
    ? `\n\nOPENINGS ALREADY USED BY OTHER REFEREES FOR THIS APPLICANT (do not echo their phrasing, structure, or opening lines):\n${openings.map((o, i) => `(${i + 1}) ${o}`).join("\n")}`
    : "";

  let userMessage = serializeLetterContext(ctx);
  if (opts.feedback?.trim()) {
    userMessage += `\n\n=== REVISION REQUEST (apply to this draft) ===\n${opts.feedback.trim()}`;
  }
  userMessage += "\n\nWrite the complete reference letter now, following the system instructions exactly.";

  const content = await callModel(systemExtras, userMessage);
  if (!content) throw new Error("The model returned an empty draft");

  // Supersede the prior draft and insert the new version.
  const draft = await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxV: sql<number>`coalesce(max(${letterDraftsTable.version}), 0)` })
      .from(letterDraftsTable)
      .where(eq(letterDraftsTable.refereeId, referee.id));
    const nextVersion = (maxRow?.maxV ?? 0) + 1;

    await tx
      .update(letterDraftsTable)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(and(eq(letterDraftsTable.refereeId, referee.id), eq(letterDraftsTable.status, "draft")));

    const [inserted] = await tx
      .insert(letterDraftsTable)
      .values({
        refereeId: referee.id,
        version: nextVersion,
        content,
        generatedBy: opts.generatedBy,
        feedbackProvided: opts.feedback?.trim() || null,
        status: "draft",
      })
      .returning();
    return inserted;
  });

  logger.info(
    { refereeId: referee.id, version: draft.version, by: opts.generatedBy, words: content.split(/\s+/).length },
    "[letterGen] draft generated",
  );
  return draft;
}
