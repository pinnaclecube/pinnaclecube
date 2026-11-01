/**
 * generator.ts — Evidence Package module, stage 6 content generation (spec §4 stage 6).
 *
 * Builds the structured content for each document role via claude-sonnet-4-5. The
 * §7.1 guardrail table is placed VERBATIM in the system prompt. Content is grounded
 * only in the provided extracts/classifications (passed in by the orchestrator — no
 * DB here, so the prompt + schema parts are unit-checkable offline). final_merits is
 * generated last by the orchestrator because it depends on the criterion documents.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { logger } from "../../lib/logger";
import type { RenderContent } from "./renderer";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4000;
const MODEL_TIMEOUT_MS = 40_000;
const MODEL_RETRY_TIMEOUT_MS = 20_000;

// ─── §7.1 guardrail table — placed VERBATIM in every generation system prompt ────

export const GUARDRAIL_TABLE = `| # | Rule |
|---|---|
| G1 | Use only facts present in the provided extracts and classifications. Never invent names, dates, employers, metrics, or citations. |
| G2 | Every quantitative claim (number, %, rank, count, salary, citation count) must be traceable to a specific source file in the group. If it is not in an extract, do not state it. |
| G3 | Cite the supporting exhibit in brackets by code, e.g. [Exhibit E2]. Do not cite exhibits not in this package. |
| G4 | Use the applicant's name exactly as given. Do not introduce titles or honorifics not in the record. |
| G5 | Do not copy staff review notes or internal commentary into output prose. Those are guidance, not content. |
| G6 | Do not assert that a legal criterion is "met" in a sub_exhibit; sub-exhibits describe evidence. Legal conclusions belong only in criterion and final_merits documents. |
| G7 | No preamble, no meta-commentary, no markdown fences. Output only the requested JSON. |
| G8 | When evidence is thin or a required type is missing, say so plainly in the relevance note rather than overstating. |`;

function systemPrompt(roleInstructions: string): string {
  return `You draft content for a US EB-1A petition evidence package. Follow every rule in this guardrail table exactly:\n\n${GUARDRAIL_TABLE}\n\n${roleInstructions}`;
}

function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned) as T;
}

async function callModel<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const ai = getAI();
  const run = async (timeoutMs: number) => {
    const res = await ai.messages.create(
      { model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: "user", content: user }] },
      { timeout: timeoutMs, maxRetries: 0 },
    );
    const raw = res.content.map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("");
    return schema.parse(extractJson(raw));
  };
  try {
    return await run(MODEL_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw err;
    logger.warn({ err }, "[package/generator] parse failed — retrying once");
    return await run(MODEL_RETRY_TIMEOUT_MS);
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────────

const SubExhibitOut = z.object({
  source_summary: z.string().min(1),
  relevance_note: z.string().min(1),
  figures: z.array(z.object({ source_file_id: z.number().int(), caption: z.string() })).default([]),
});
const CriterionOut = z.object({
  regulatory_standard: z.string().min(1),
  evidence_summary: z.string().min(1),
  argument: z.string().min(1),
  conclusion: z.string().min(1),
});
const FinalMeritsOut = z.object({
  introduction: z.string().min(1),
  criteria_met: z.string().min(1),
  totality_argument: z.string().min(1),
  conclusion: z.string().min(1),
});
export type SubExhibitOutT = z.infer<typeof SubExhibitOut>;

// ─── Grounding (passed in by the orchestrator) ──────────────────────────────────

export interface SubExhibitGrounding {
  applicantName: string; criterionName: string; exhibitCode: string;
  groupTitle: string; groupDescription?: string | null;
  files: { fileId: number; name: string; evidenceType?: string | null; summary?: string | null; extract: string }[];
}
export interface CriterionGrounding {
  applicantName: string; criterionName: string; regulation: string; exhibitCode: string;
  subExhibits: { code: string; title: string; summary?: string | null }[];
}
export interface FinalMeritsGrounding {
  applicantName: string;
  criteria: { name: string; code: string; satisfiable: boolean; subExhibits: { code: string; title: string }[] }[];
}

// ─── Per-role generation + mapping to RenderContent ─────────────────────────────

export async function generateSubExhibit(g: SubExhibitGrounding): Promise<{ content: Extract<RenderContent, { kind: "sub_exhibit" }>; figures: { sourceFileId: number; caption: string }[] }> {
  const user = [
    `APPLICANT: ${g.applicantName}`,
    `CRITERION: ${g.criterionName}  EXHIBIT: ${g.exhibitCode}`,
    `GROUP: ${g.groupTitle}${g.groupDescription ? ` — ${g.groupDescription}` : ""}`,
    `FILES (source_file_id, name, type, extract):`,
    ...g.files.map((f) => `  {id:${f.fileId}, name:${JSON.stringify(f.name)}, type:${JSON.stringify(f.evidenceType ?? "")}, text:${JSON.stringify((f.extract || f.summary || "").slice(0, 1200))}}`),
    `\nReturn JSON: {"source_summary":string,"relevance_note":string,"figures":[{"source_file_id":number,"caption":string}]}`,
    `One figure entry per source file, caption as "<short source label> — <one-line description>".`,
  ].join("\n");
  const out = await callModel(systemPrompt("You are drafting a SUB-EXHIBIT: describe the evidence factually; do NOT assert a legal criterion is met (G6)."), user, SubExhibitOut);
  return {
    content: { kind: "sub_exhibit", sourceSummary: out.source_summary, relevanceNote: out.relevance_note },
    figures: out.figures.map((f) => ({ sourceFileId: f.source_file_id, caption: f.caption })),
  };
}

export async function generateCriterion(g: CriterionGrounding, regulation: string): Promise<Extract<RenderContent, { kind: "criterion" }>> {
  const user = [
    `APPLICANT: ${g.applicantName}`,
    `CRITERION: ${g.criterionName}  (${regulation})  EXHIBIT: ${g.exhibitCode}`,
    `SUB-EXHIBITS in this criterion (cite by code):`,
    ...g.subExhibits.map((s) => `  [Exhibit ${s.code}] ${s.title}${s.summary ? ` — ${s.summary}` : ""}`),
    `\nReturn JSON: {"regulatory_standard":string,"evidence_summary":string,"argument":string,"conclusion":string}`,
  ].join("\n");
  const out = await callModel(systemPrompt("You are drafting a CRITERION document: tie the sub-exhibits to the regulatory standard and argue the criterion is satisfied, citing exhibits by code."), user, CriterionOut);
  return { kind: "criterion", regulation, regulatoryStandard: out.regulatory_standard, evidenceSummary: out.evidence_summary, argument: out.argument, conclusion: out.conclusion };
}

export async function generateFinalMerits(g: FinalMeritsGrounding, regulation: string): Promise<Extract<RenderContent, { kind: "final_merits" }>> {
  const user = [
    `APPLICANT: ${g.applicantName}`,
    `CRITERIA (code, name, satisfiable, sub-exhibits):`,
    ...g.criteria.map((c) => `  ${c.code} ${c.name} satisfiable=${c.satisfiable} -> ${c.subExhibits.map((s) => s.code).join(", ")}`),
    `\nReturn JSON: {"introduction":string,"criteria_met":string,"totality_argument":string,"conclusion":string}`,
    `Make the final-merits (Kazarian step two) totality argument; cite criteria and exhibits by code.`,
  ].join("\n");
  const out = await callModel(systemPrompt("You are drafting the FINAL MERITS brief: argue the totality of the evidence establishes sustained national/international acclaim."), user, FinalMeritsOut);
  return { kind: "final_merits", regulation, introduction: out.introduction, criteriaMet: out.criteria_met, totalityArgument: out.totality_argument, conclusion: out.conclusion };
}
