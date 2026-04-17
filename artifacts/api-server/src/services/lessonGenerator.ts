/**
 * lessonGenerator.ts — Pinnacle³
 *
 * Calls Claude Sonnet to generate a fully personalized lesson for one client.
 * No static lesson content exists — every lesson is generated on-demand and cached.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LessonDefinition } from "@workspace/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClientContext {
  intake: {
    visaPath: string;
    currentRole?: string | null;
    company?: string | null;
    country?: string | null;
    currentGoal?: string | null;
    updatedAt?: Date | string | null;
  };
  resumeText?: string | null;
  evidenceItems: Array<{
    primaryCriteriaId?: string | null;
    title: string;
    aiSummary?: string | null;
  }>;
  completedLessonIds: string[];
  blueprintNotes?: string | null;
  visaPath: string;
  clientName?: string | null;
  profession?: string | null;
}

export interface LessonContent {
  personalized_opening: string;
  concept_explanation: string;
  field_specific_examples: string;
  gap_aware_action_steps: string[];
  evidence_prompt: string;
  evidence_criteria_id: string;
  estimated_read_time_minutes: number;
}

// ─── Lazy AI client ───────────────────────────────────────────────────────────

function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) {
    throw new Error("Set ANTHROPIC_API_KEY or provision the Replit Anthropic AI integration.");
  }
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ─── Context builder ─────────────────────────────────────────────────────────

function buildClientSummary(ctx: ClientContext): string {
  const lines: string[] = [];

  if (ctx.clientName) lines.push(`Client name: ${ctx.clientName}`);
  lines.push(`Target visa: ${ctx.visaPath.toUpperCase()}`);
  if (ctx.profession) lines.push(`Professional field: ${ctx.profession}`);
  if (ctx.intake.currentRole) lines.push(`Current role: ${ctx.intake.currentRole}`);
  if (ctx.intake.company) lines.push(`Company: ${ctx.intake.company}`);
  if (ctx.intake.country) lines.push(`Country: ${ctx.intake.country}`);
  if (ctx.intake.currentGoal) lines.push(`Current goal: ${ctx.intake.currentGoal}`);
  if (ctx.blueprintNotes) lines.push(`Blueprint strategy notes: ${ctx.blueprintNotes}`);

  lines.push(`Completed lessons so far: ${ctx.completedLessonIds.length}`);

  if (ctx.evidenceItems.length > 0) {
    lines.push(`\nEvidence uploaded (${ctx.evidenceItems.length} items):`);
    const byCriteria: Record<string, string[]> = {};
    for (const item of ctx.evidenceItems) {
      const key = item.primaryCriteriaId ?? "general";
      if (!byCriteria[key]) byCriteria[key] = [];
      byCriteria[key].push(item.title);
    }
    for (const [cid, titles] of Object.entries(byCriteria)) {
      lines.push(`  ${cid}: ${titles.join(", ")}`);
    }
  } else {
    lines.push("No evidence uploaded yet.");
  }

  if (ctx.resumeText) {
    lines.push(`\nResume excerpt (first 800 chars):\n${ctx.resumeText.slice(0, 800)}`);
  }

  return lines.join("\n");
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function parseJSON(raw: string): LessonContent | null {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Find the first { and last } to extract the object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as LessonContent;
    // Validate required keys
    if (
      typeof parsed.personalized_opening === "string" &&
      typeof parsed.concept_explanation === "string" &&
      typeof parsed.field_specific_examples === "string" &&
      Array.isArray(parsed.gap_aware_action_steps) &&
      typeof parsed.evidence_prompt === "string" &&
      typeof parsed.evidence_criteria_id === "string"
    ) {
      if (typeof parsed.estimated_read_time_minutes !== "number") {
        parsed.estimated_read_time_minutes = 5;
      }
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generateLessonContent(
  lessonDefinition: LessonDefinition,
  clientContext: ClientContext,
): Promise<LessonContent> {
  const ai = getAI();
  const clientSummary = buildClientSummary(clientContext);

  const systemPrompt =
    "You are an expert EB1A/NIW/O1 immigration coaching specialist with 15 years of experience helping tech professionals qualify for US extraordinary ability visas. Generate a personalized lesson for a specific professional. Write in second person, directly addressing them. Reference their actual background, field, and current evidence gaps. Be specific and actionable. Never give generic advice.";

  const userPrompt = `Generate a personalized lesson for the following client.

LESSON: "${lessonDefinition.lessonTitle}"
Module: ${lessonDefinition.moduleName}
Learning objective: ${lessonDefinition.learningObjective}
${lessonDefinition.criteriaFocus ? `Criteria focus: ${lessonDefinition.criteriaFocus}` : ""}

CLIENT CONTEXT:
${clientSummary}

Return ONLY a valid JSON object with these exact keys (no other text, no markdown):
{
  "personalized_opening": "2-3 sentences referencing their actual role, field, and situation",
  "concept_explanation": "Core concept for this lesson explained in 250-300 words, tailored to their field",
  "field_specific_examples": "3 concrete examples from their specific field and role level",
  "gap_aware_action_steps": ["Step 1: specific action", "Step 2: ...", "Step 3: ..."],
  "evidence_prompt": "What specific evidence they should add to their vault based on this lesson",
  "evidence_criteria_id": "${lessonDefinition.criteriaFocus ?? clientContext.visaPath.toUpperCase() + "-01"}",
  "estimated_read_time_minutes": 5
}`;

  const callAI = async (prompt: string): Promise<string> => {
    const msg = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : "";
  };

  // First attempt
  const raw1 = await callAI(userPrompt);
  const result1 = parseJSON(raw1);
  if (result1) return result1;

  // Retry with explicit JSON instruction
  const retryPrompt = `${userPrompt}

IMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object — no text before or after, no markdown code fences, no comments. Start your response with { and end with }.`;

  const raw2 = await callAI(retryPrompt);
  const result2 = parseJSON(raw2);
  if (result2) return result2;

  // Fallback: return minimal valid content so the route doesn't crash
  return {
    personalized_opening: `This lesson covers "${lessonDefinition.lessonTitle}" — key content for your ${clientContext.visaPath.toUpperCase()} petition.`,
    concept_explanation: lessonDefinition.learningObjective,
    field_specific_examples: "Please refer to your advisor for field-specific examples.",
    gap_aware_action_steps: ["Review the learning objective", "Discuss with your consultant"],
    evidence_prompt: "Upload any relevant documents to your Evidence Vault for this criterion.",
    evidence_criteria_id: lessonDefinition.criteriaFocus ?? `${clientContext.visaPath.toUpperCase()}-01`,
    estimated_read_time_minutes: 5,
  };
}
