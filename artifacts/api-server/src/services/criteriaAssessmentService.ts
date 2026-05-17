/**
 * criteriaAssessmentService.ts — Pinnacle³
 *
 * AI-powered criteria assessment using Claude Opus.
 * Fetches case documents from Drive, builds an adjudicator-perspective
 * prompt, and persists a full assessment record to criteria_assessments.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import {
  db,
  criteriaAssessmentsTable,
  petitionCriteriaExhibitsTable,
} from "@workspace/db";
import { buildClientContext } from "./petitionDocumentGenerator";
import { fetchCaseDocuments } from "./driveDocumentFetcher";
import { EXHIBIT_GENERATION_CONFIG } from "../lib/exhibitTemplateConfig";
import { logger } from "../lib/logger";

// ─── AI client ────────────────────────────────────────────────────────────────

function getAI(): Anthropic {
  const apiKey =
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) {
    throw new Error(
      "Set ANTHROPIC_API_KEY or provision the Replit Anthropic AI integration.",
    );
  }
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson<T>(raw: string): T {
  const stripped = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const cleaned = match ? match[0] : stripped;
  return JSON.parse(cleaned) as T;
}

/** Maps visaTarget / visaPath values to the EXHIBIT_GENERATION_CONFIG key. */
function resolveVisaCategory(visaPath: string): "EB1A" | "NIW" | "O1A" {
  const normalized = visaPath.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "niw") return "NIW";
  if (normalized === "o1a") return "O1A";
  return "EB1A"; // default — covers eb1a, eb1, etc.
}

// ─── Claude response shape ────────────────────────────────────────────────────

interface AssessmentResponse {
  recommendation: string;
  confidence_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missing_evidence: string[];
  adjudicator_concerns: string[];
  proceed_recommendation: boolean;
  rfe_risk: string;
}

// ─── assessCriteriaEvidence ───────────────────────────────────────────────────

export async function assessCriteriaEvidence(
  caseSetupId: number,
  criteriaCode: string,
): Promise<typeof criteriaAssessmentsTable.$inferSelect> {
  // 1. Load criteria exhibit row
  const [exhibit] = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId))
    .then((rows) => rows.filter((r) => r.criteriaCode === criteriaCode))
    .then((rows) => rows.slice(0, 1));

  if (!exhibit) {
    throw new Error(
      `No petition_criteria_exhibit found for caseSetupId=${caseSetupId} criteriaCode=${criteriaCode}`,
    );
  }

  const { profileId, criteriaName } = exhibit;

  // 2. Load client context
  const clientCtx = await buildClientContext(profileId);

  // 3. Determine visa category
  const visaCategory = resolveVisaCategory(clientCtx.visaPath);

  // 4. Load criteria config
  const visaCategoryConfig = EXHIBIT_GENERATION_CONFIG.visaCategories[visaCategory];
  const criteriaConfig = visaCategoryConfig?.criteria[criteriaName] ?? null;

  // 5. Fetch case documents
  const fetchResult = await fetchCaseDocuments(caseSetupId);
  const { grouped } = fetchResult;

  // Filter to this criterion's docs + resume + demographics
  const criteriaDocuments = grouped.byCriteria[criteriaName] ?? [];
  const documents = [
    ...criteriaDocuments,
    ...grouped.resume,
    ...grouped.demographics,
  ];

  // 6. Short-circuit: no documents in this criteria folder
  if (grouped.emptyCriteriaFolders.includes(criteriaName)) {
    logger.warn(
      { caseSetupId, criteriaCode, criteriaName },
      "[assessment] criteria folder is empty — saving INSUFFICIENT record",
    );

    const [saved] = await db
      .insert(criteriaAssessmentsTable)
      .values({
        caseSetupId,
        profileId,
        criteriaCode,
        criteriaName,
        visaCategory,
        recommendation: "INSUFFICIENT",
        confidenceScore: 0,
        proceedRecommendation: false,
        rfeRisk: "HIGH",
        summary: `No documents were found in the Drive folder for ${criteriaName}. Assessment cannot be completed without evidence.`,
        strengths: [],
        weaknesses: ["No evidence documents uploaded for this criterion"],
        missingEvidence: ["All supporting documents for this criterion"],
        adjudicatorConcerns: ["Criterion cannot be argued without supporting evidence"],
        documentsAnalyzed: 0,
        assessmentJson: null,
        assessedAt: new Date(),
      })
      .returning();

    if (!saved) throw new Error("Failed to insert empty assessment record");
    return saved;
  }

  // 7. Build and call Claude
  const ai = getAI();

  const systemPrompt = [
    EXHIBIT_GENERATION_CONFIG.baseSystemPrompt,
    "",
    `You are now acting as an AAO adjudicator reviewing a ${visaCategory} petition.`,
    "Think critically — look for reasons to deny. Assess only what the evidence proves.",
    `Standard of proof: ${visaCategoryConfig?.standardOfProof ?? "preponderance of the evidence"}`,
    `Criterion: ${criteriaName}`,
    `CFR: ${criteriaConfig?.cfr ?? "See applicable regulation"}`,
    `Regulatory requirement: ${criteriaConfig?.requirement ?? "Extraordinary ability demonstrated by evidence"}`,
    `Key elements USCIS will evaluate: ${(criteriaConfig?.keyElements ?? []).join(", ")}`,
  ].join("\n");

  const userContent = [
    `Client: ${clientCtx.clientName} | Visa: ${visaCategory} | Criterion: ${criteriaName}`,
    "",
    `DOCUMENTS ANALYZED (${documents.length} files):`,
    documents
      .map((d) => `=== ${d.fileName} | Folder: ${d.folderName} ===\n${d.textContent}`)
      .join("\n\n"),
    "",
    'Return ONLY valid JSON — no markdown, no preamble:',
    '{',
    '  "recommendation": "STRONG" | "BORDERLINE" | "INSUFFICIENT",',
    '  "confidence_score": 0-100,',
    '  "summary": "2-3 sentence assessment",',
    '  "strengths": ["specific strength with document citation"],',
    '  "weaknesses": ["specific gap or weakness"],',
    '  "missing_evidence": ["what would strengthen this criterion"],',
    '  "adjudicator_concerns": ["likely USCIS objection or RFE basis"],',
    '  "proceed_recommendation": true | false,',
    '  "rfe_risk": "LOW" | "MEDIUM" | "HIGH"',
    '}',
  ].join("\n");

  const response = await ai.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  // 8. Parse JSON response
  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  const parsed = extractJson<AssessmentResponse>(raw);

  // 9. Save to criteria_assessments
  const [saved] = await db
    .insert(criteriaAssessmentsTable)
    .values({
      caseSetupId,
      profileId,
      criteriaCode,
      criteriaName,
      visaCategory,
      recommendation: parsed.recommendation ?? null,
      confidenceScore: parsed.confidence_score ?? null,
      summary: parsed.summary ?? null,
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      missingEvidence: parsed.missing_evidence ?? [],
      adjudicatorConcerns: parsed.adjudicator_concerns ?? [],
      proceedRecommendation: parsed.proceed_recommendation ?? null,
      rfeRisk: parsed.rfe_risk ?? null,
      documentsAnalyzed: documents.length,
      assessmentJson: parsed as unknown as Record<string, unknown>,
      assessedAt: new Date(),
    })
    .returning();

  if (!saved) throw new Error("Failed to insert assessment record");

  // 10. Staff alert for weak assessments
  if (parsed.recommendation === "INSUFFICIENT" || parsed.rfe_risk === "HIGH") {
    // TODO: replace with a proper staff notification once a shared notifyStaff()
    // utility is extracted from petitionAdmin.ts / adminBlueprint.ts
    logger.warn(
      {
        caseSetupId,
        profileId,
        criteriaCode,
        criteriaName,
        recommendation: parsed.recommendation,
        rfeRisk: parsed.rfe_risk,
        assessmentId: saved.id,
      },
      "[assessment] STAFF ALERT — criterion assessed as weak or insufficient",
    );
  }

  logger.info(
    {
      caseSetupId,
      criteriaCode,
      recommendation: parsed.recommendation,
      confidenceScore: parsed.confidence_score,
      rfeRisk: parsed.rfe_risk,
      assessmentId: saved.id,
    },
    "[assessment] criteria assessment saved",
  );

  return saved;
}

// ─── assessAllCriteria ────────────────────────────────────────────────────────

export async function assessAllCriteria(
  caseSetupId: number,
): Promise<Array<typeof criteriaAssessmentsTable.$inferSelect>> {
  const exhibits = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId));

  if (exhibits.length === 0) {
    logger.warn({ caseSetupId }, "[assessment] assessAllCriteria — no exhibits found");
    return [];
  }

  const results: Array<typeof criteriaAssessmentsTable.$inferSelect> = [];

  for (const exhibit of exhibits) {
    try {
      const result = await assessCriteriaEvidence(caseSetupId, exhibit.criteriaCode);
      results.push(result);
    } catch (err) {
      logger.error(
        { caseSetupId, criteriaCode: exhibit.criteriaCode, err },
        "[assessment] assessAllCriteria — individual assessment failed, continuing",
      );
    }

    // Rate-limit between calls to avoid Claude API pressure
    await new Promise<void>((r) => setTimeout(r, 2000));
  }

  logger.info(
    { caseSetupId, total: exhibits.length, completed: results.length },
    "[assessment] assessAllCriteria complete",
  );

  return results;
}
