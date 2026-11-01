/**
 * classifier.ts — Evidence Package module, stage 4 (spec section 4 stage 4).
 *
 * Pass 1 (classify): batches the short extracts (10 per model call), asks
 *   claude-sonnet-4-5 for JSON matching evidence_classifications, validates it,
 *   and persists one row per file.
 * Pass 2 (group): reuses the Step 5 grouping (evidenceGroupingService.
 *   runGroupingForCase — unmodified) to cluster files by criterion, then enriches
 *   each confirmed group with sortDate (min member date) and missingTypes
 *   (expected evidence types for the criterion absent from the group), computed
 *   from the pass-1 classifications. Those values are persisted onto the
 *   sub_exhibit exhibit_documents rows by the planner (stage 5, section 5.1).
 *
 * The pure helpers (schema parse, date parse, expected types, group summary,
 * prompt build) take no IO so they can be unit-checked in isolation.
 */

import { and, eq, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import {
  db,
  evidenceClassificationsTable,
  evidenceGroupsTable,
  caseFolderItemsTable,
  casePetitionSetupTable,
} from "@workspace/db";
import { getCriteriaFolders, type VisaCategory } from "../../config/driveFolderConfig";
import { criterionKeyForFolderName } from "../evidenceSyncService";
import { logger } from "../../lib/logger";
import type { FileExtract } from "./extractor";

const MODEL = "claude-sonnet-4-5";
const CLASSIFY_BATCH = 10;
const SNIPPET_CHARS = 800;
const MAX_TOKENS = 4000;
const MODEL_TIMEOUT_MS = 35_000;
const MODEL_RETRY_TIMEOUT_MS = 18_000;

// ─── Controlled vocabulary + per-criterion expected types (for missingTypes) ────

export const EVIDENCE_TYPES = [
  "award_certificate", "award_announcement", "selection_or_nomination_letter",
  "membership_certificate", "membership_criteria", "invitation_letter",
  "published_article_about_applicant", "press_media_coverage", "publication_masthead",
  "review_invitation", "completed_review_or_feedback", "editor_confirmation",
  "scholarly_article", "journal_information", "citation_report",
  "patent_or_ip", "adoption_or_usage_evidence", "impact_metrics", "expert_opinion_letter",
  "exhibition_catalog", "venue_information",
  "employment_or_role_letter", "org_importance_evidence", "org_chart", "outcomes_evidence",
  "salary_record_or_contract", "comparative_wage_data",
  "sales_or_revenue_record", "comparative_market_data",
  "degree_or_certification", "resume_or_cv", "other",
] as const;

const EXPECTED_TYPES: Record<string, string[]> = {
  extraordinary_ability_awards: ["award_certificate", "award_announcement", "selection_or_nomination_letter"],
  membership_in_associations: ["membership_certificate", "membership_criteria", "invitation_letter"],
  published_material_about_the_alien: ["published_article_about_applicant", "press_media_coverage", "publication_masthead"],
  judge_of_others_work: ["review_invitation", "completed_review_or_feedback", "editor_confirmation"],
  original_contributions: ["adoption_or_usage_evidence", "impact_metrics", "expert_opinion_letter"],
  scholarly_articles: ["scholarly_article", "journal_information", "citation_report"],
  artistic_exhibitions: ["exhibition_catalog", "venue_information", "invitation_letter"],
  leading_or_critical_role: ["employment_or_role_letter", "org_importance_evidence", "outcomes_evidence"],
  high_salary: ["salary_record_or_contract", "comparative_wage_data"],
  commercial_success: ["sales_or_revenue_record", "comparative_market_data"],
};

export function expectedTypesForCriterion(key: string | null | undefined): string[] {
  return (key && EXPECTED_TYPES[key]) || [];
}

// ─── Zod schema matching evidence_classifications (pass-1 output) ────────────────

const ClassificationItem = z.object({
  file_id: z.number().int(),
  evidence_type: z.string().nullish(),
  criterion: z.string().nullish(),
  confidence: z.number().int().min(0).max(100).nullish(),
  sort_date: z.string().nullish(),
  summary: z.string().nullish(),
});
const ClassificationResult = z.object({ classifications: z.array(ClassificationItem).default([]) });
export type ClassificationResultT = z.infer<typeof ClassificationResult>;

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned) as T;
}

export function parseClassifications(raw: string): ClassificationResultT {
  return ClassificationResult.parse(extractJson(raw));
}

/** Tolerant date parse: ISO, YYYY-MM, or YYYY. Returns null when unparseable. */
export function parseSortDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  let iso: string | null = null;
  if (/^\d{4}$/.test(t)) iso = `${t}-01-01`;
  else if (/^\d{4}-\d{2}$/.test(t)) iso = `${t}-01`;
  else if (/^\d{4}-\d{2}-\d{2}/.test(t)) iso = t.slice(0, 10);
  const d = new Date((iso ?? t) + (iso && iso.length === 10 ? "T00:00:00Z" : ""));
  return isNaN(d.getTime()) ? null : d;
}

function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

function toVisaCategory(v: string | null | undefined): VisaCategory {
  const up = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return up === "NIW" || up === "O1A" ? (up as VisaCategory) : "EB1A";
}

// ─── Prompt (pure) ───────────────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify petition evidence FILES for a US extraordinary-ability petition. For each file decide: the single best-fit criterion KEY (from the VALID CRITERIA list), the evidence_type (from the EVIDENCE TYPES list), a confidence 0-100, the document's representative date (sort_date as YYYY-MM-DD, or YYYY-MM / YYYY if only that is known, else null), and a one-line factual summary. Judge only from the provided name and text snippet; never invent facts. Use "other" / null when unsure.
Return ONLY strict JSON, no prose, no code fences:
{"classifications":[{"file_id":number,"evidence_type":string,"criterion":string,"confidence":number,"sort_date":string|null,"summary":string}]}`;

export function buildClassifyPrompt(
  criteria: { key: string; label: string }[],
  files: { fileId: number; name: string; snippet: string }[],
): string {
  const crit = criteria.map((c) => `  {key:${JSON.stringify(c.key)}, label:${JSON.stringify(c.label)}}`).join("\n");
  const types = EVIDENCE_TYPES.map((t) => JSON.stringify(t)).join(", ");
  const fileLines = files
    .map((f) => `  {file_id:${f.fileId}, name:${JSON.stringify(f.name)}, text:${JSON.stringify(f.snippet)}}`)
    .join("\n");
  return `VALID CRITERIA (pick one key per file):\n${crit}\n\nEVIDENCE TYPES (pick one per file):\n[${types}]\n\nFILES:\n${fileLines}\n\nReturn the JSON now.`;
}

async function callModel(userMessage: string): Promise<ClassificationResultT> {
  const ai = getAI();
  const run = async (timeoutMs: number) => {
    const res = await ai.messages.create(
      { model: MODEL, max_tokens: MAX_TOKENS, system: CLASSIFY_SYSTEM, messages: [{ role: "user", content: userMessage }] },
      { timeout: timeoutMs, maxRetries: 0 },
    );
    const raw = res.content.map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("");
    return parseClassifications(raw);
  };
  try {
    return await run(MODEL_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw err;
    logger.warn({ err }, "[package/classifier] parse failed — retrying once");
    return await run(MODEL_RETRY_TIMEOUT_MS);
  }
}

// ─── Pass 1 — classify + persist ────────────────────────────────────────────────

export interface ClassifyResult {
  classified: number;
  byType: Record<string, number>;
  byCriterion: Record<string, number>;
  confidences: number[];
}

export async function classifyExtracts(
  caseSetupId: number,
  packageVersion: number,
  extracts: FileExtract[],
): Promise<ClassifyResult> {
  const [caseRow] = await db
    .select({ visaPath: casePetitionSetupTable.visaPath })
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseSetupId))
    .limit(1);
  const criteria = getCriteriaFolders(toVisaCategory(caseRow?.visaPath)).map((c) => ({
    key: criterionKeyForFolderName(c.name),
    label: c.name,
  }));
  const allowedKeys = new Set(criteria.map((c) => c.key));

  const usable = extracts.filter((e) => e.ok && (e.text?.trim().length ?? 0) > 0);
  const result: ClassifyResult = { classified: 0, byType: {}, byCriterion: {}, confidences: [] };

  for (let i = 0; i < usable.length; i += CLASSIFY_BATCH) {
    const batch = usable.slice(i, i + CLASSIFY_BATCH);
    const files = batch.map((e) => ({ fileId: e.fileId, name: e.fileName, snippet: e.text.slice(0, SNIPPET_CHARS) }));
    let parsed: ClassificationResultT;
    try {
      parsed = await callModel(buildClassifyPrompt(criteria, files));
    } catch (err) {
      logger.error({ err, caseSetupId, batchStart: i }, "[package/classifier] batch failed");
      continue; // skip this batch; stage proceeds (files remain unclassified)
    }
    const byId = new Map(parsed.classifications.map((c) => [c.file_id, c]));
    const rows = batch.map((e) => {
      const c = byId.get(e.fileId);
      const criterionKey = c?.criterion ? criterionKeyForFolderName(c.criterion) : null;
      const criterion = criterionKey && allowedKeys.has(criterionKey) ? criterionKey : null;
      const evidenceType = c?.evidence_type && (EVIDENCE_TYPES as readonly string[]).includes(c.evidence_type) ? c.evidence_type : "other";
      if (evidenceType) result.byType[evidenceType] = (result.byType[evidenceType] ?? 0) + 1;
      if (criterion) result.byCriterion[criterion] = (result.byCriterion[criterion] ?? 0) + 1;
      if (typeof c?.confidence === "number") result.confidences.push(c.confidence);
      return {
        caseSetupId,
        packageVersion,
        fileId: e.fileId,
        evidenceType,
        criterion,
        confidence: typeof c?.confidence === "number" ? c.confidence : null,
        sortDate: parseSortDate(c?.sort_date),
        summary: c?.summary?.trim() || null,
        rawJson: c ?? null,
      };
    });
    if (rows.length > 0) {
      await db.insert(evidenceClassificationsTable).values(rows);
      result.classified += rows.length;
    }
  }

  logger.info({ caseSetupId, packageVersion, ...{ classified: result.classified } }, "[package/classifier] pass 1 complete");
  return result;
}

// ─── Pass 2 — per-group enrichment (sortDate + missingTypes) ────────────────────

export interface GroupSummary {
  groupId: number;
  title: string;
  criterion: string | null;
  fileCount: number;
  sortDate: Date | null;
  evidenceTypes: string[];
  missingTypes: string[];
}

/** Pure: derive a group's sortDate (earliest member date) + missingTypes. */
export function computeGroupSummary(
  group: { id: number; name: string; criterion: string | null },
  members: { sortDate: Date | null; evidenceType: string | null }[],
): GroupSummary {
  const dates = members.map((m) => m.sortDate).filter((d): d is Date => d != null);
  const sortDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const present = new Set(members.map((m) => m.evidenceType).filter((t): t is string => !!t));
  const expected = expectedTypesForCriterion(group.criterion);
  const missingTypes = expected.filter((t) => !present.has(t));
  return {
    groupId: group.id,
    title: group.name,
    criterion: group.criterion,
    fileCount: members.length,
    sortDate,
    evidenceTypes: [...present],
    missingTypes,
  };
}

/** Reads confirmed groups + their members' classifications and summarizes them. */
export async function summarizePackageGroups(caseSetupId: number, packageVersion: number): Promise<GroupSummary[]> {
  const groups = await db
    .select({ id: evidenceGroupsTable.id, name: evidenceGroupsTable.name, criterion: evidenceGroupsTable.criterionFolder })
    .from(evidenceGroupsTable)
    .where(and(eq(evidenceGroupsTable.caseId, caseSetupId), eq(evidenceGroupsTable.status, "confirmed")));
  if (groups.length === 0) return [];

  const members = await db
    .select({ groupId: caseFolderItemsTable.groupId, fileId: caseFolderItemsTable.id })
    .from(caseFolderItemsTable)
    .where(inArray(caseFolderItemsTable.groupId, groups.map((g) => g.id)));

  const classes = await db
    .select({ fileId: evidenceClassificationsTable.fileId, evidenceType: evidenceClassificationsTable.evidenceType, sortDate: evidenceClassificationsTable.sortDate })
    .from(evidenceClassificationsTable)
    .where(and(eq(evidenceClassificationsTable.caseSetupId, caseSetupId), eq(evidenceClassificationsTable.packageVersion, packageVersion)));
  const classByFile = new Map(classes.map((c) => [c.fileId, c]));

  const membersByGroup = new Map<number, { sortDate: Date | null; evidenceType: string | null }[]>();
  for (const m of members) {
    if (m.groupId == null) continue;
    const c = classByFile.get(m.fileId);
    const arr = membersByGroup.get(m.groupId) ?? [];
    arr.push({ sortDate: c?.sortDate ?? null, evidenceType: c?.evidenceType ?? null });
    membersByGroup.set(m.groupId, arr);
  }

  return groups.map((g) => computeGroupSummary(g, membersByGroup.get(g.id) ?? []));
}
