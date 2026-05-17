/**
 * exhibitGeneratorService.ts — Pinnacle³
 *
 * Six fire-and-forget generation functions for the full petition document suite.
 * Every function creates a document_generation_jobs record, tracks lifecycle
 * (pending → processing → completed | failed), uploads PDFs to Drive, and
 * persists results to exhibit_documents / petition_package.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  db,
  documentGenerationJobsTable,
  petitionCriteriaExhibitsTable,
  criteriaAssessmentsTable,
  exhibitDocumentsTable,
  petitionPackageTable,
} from "@workspace/db";
import { buildClientContext } from "./petitionDocumentGenerator";
import { fetchCaseDocuments, type FetchedDocument } from "./driveDocumentFetcher";
import { uploadPdfToDrive, getCaseDriveFolderId } from "./driveUploadService";
import { EXHIBIT_GENERATION_CONFIG } from "../lib/exhibitTemplateConfig";
import {
  createDocument,
  addSectionHeading,
  addBodyText,
  addEvidenceTable,
  addPageBreak,
  finalizePdf,
  type DocType,
  type DocumentMetadata,
} from "./legalPdfTemplate";
import { logger } from "../lib/logger";

void addEvidenceTable; // imported per spec — used by callers via legalPdfTemplate directly

// ─── AI client ────────────────────────────────────────────────────────────────

function getAI(): Anthropic {
  const apiKey =
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY or provision the Anthropic integration.");
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson<T>(raw: string): T {
  const stripped = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : stripped) as T;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
}

/** Renders multi-section Claude output to a PDFKit document. */
function renderToPdf(
  docType: DocType,
  title: string,
  meta: DocumentMetadata,
  content: string,
): ReturnType<typeof createDocument> {
  const doc = createDocument(docType, title, meta);
  const paragraphs = content.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (/^[IVX]+\.\s/.test(trimmed) || /^(HEADER|SUBHEADER):/.test(trimmed)) {
      addSectionHeading(doc, trimmed.replace(/^(HEADER|SUBHEADER):\s*/, ""));
    } else {
      addBodyText(doc, trimmed);
    }
  }
  return doc;
}

// ─── Job lifecycle ────────────────────────────────────────────────────────────

async function createJob(params: {
  profileId: number;
  triggeredByStaffId: string;
  caseSetupId: number;
  criteriaCode?: string | null;
  docSubtype: string;
}) {
  const [job] = await db
    .insert(documentGenerationJobsTable)
    .values({ ...params, status: "pending" })
    .returning();
  if (!job) throw new Error("Failed to create document_generation_jobs record");
  return job;
}

async function updateJob(
  jobId: number,
  status: "processing" | "completed" | "failed",
  errorMessage?: string,
) {
  await db
    .update(documentGenerationJobsTable)
    .set({
      status,
      ...(status === "completed" ? { completedAt: new Date() } : {}),
      ...(errorMessage ? { errorMessage: errorMessage.slice(0, 2000) } : {}),
    })
    .where(eq(documentGenerationJobsTable.id, jobId));
}

// ─── Exhibit document record ──────────────────────────────────────────────────

async function saveExhibitDoc(params: {
  caseSetupId: number;
  profileId: number;
  jobId: number;
  documentType: string;
  exhibitLabel: string | null;
  criteriaCode: string | null;
  fileName: string;
  driveFileId: string;
  driveUrl: string;
}) {
  await db.insert(exhibitDocumentsTable).values(params);
}

// ─── visaPath → category key ──────────────────────────────────────────────────

function resolveVisaCategory(visaPath: string): "EB1A" | "NIW" | "O1A" {
  const n = visaPath.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n === "niw") return "NIW";
  if (n === "o1a") return "O1A";
  return "EB1A";
}

// ─── Shared Claude call wrapper ───────────────────────────────────────────────

async function callClaude(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ═════════════════════════════════════════════════════════════════════════════
// Function 1 — generateCriteriaExhibits
// ═════════════════════════════════════════════════════════════════════════════

export async function generateCriteriaExhibits(
  caseSetupId: number,
  criteriaCode: string,
  triggeredByStaffId: string,
): Promise<void> {
  // Load exhibit row
  const exhibits = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId));
  const exhibit = exhibits.find((e) => e.criteriaCode === criteriaCode);
  if (!exhibit) throw new Error(`No exhibit row for caseSetupId=${caseSetupId} criteriaCode=${criteriaCode}`);

  const { profileId, criteriaName, exhibitNumber: exhibitLetter } = exhibit;

  const job = await createJob({ profileId, triggeredByStaffId, caseSetupId, criteriaCode, docSubtype: "criteria_exhibits" });

  try {
    await updateJob(job.id, "processing");

    const clientCtx = await buildClientContext(profileId);
    const visaCategory = resolveVisaCategory(clientCtx.visaPath);
    const visaCatConfig = EXHIBIT_GENERATION_CONFIG.visaCategories[visaCategory];
    const criteriaConfig = visaCatConfig?.criteria[criteriaName] ?? null;

    // Load assessment
    const assessments = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(
        and(
          eq(criteriaAssessmentsTable.caseSetupId, caseSetupId),
          eq(criteriaAssessmentsTable.criteriaCode, criteriaCode),
        ),
      )
      .limit(1);
    const assessment = assessments[0] ?? null;

    // Fetch documents — criteria folder + resume + demographics
    const fetchResult = await fetchCaseDocuments(caseSetupId);
    const criteriaDocuments = fetchResult.grouped.byCriteria[criteriaName] ?? [];
    const documents: FetchedDocument[] = [
      ...criteriaDocuments,
      ...fetchResult.grouped.resume,
      ...fetchResult.grouped.demographics,
    ];

    // Drive folder
    const exhibitsFolderId = await getCaseDriveFolderId(caseSetupId, "exhibits");
    if (!exhibitsFolderId) throw new Error(`No 'exhibits' Drive folder for caseSetupId=${caseSetupId}`);

    const meta: DocumentMetadata = {
      clientName: clientCtx.clientName,
      clientEmail: clientCtx.clientEmail,
      generatedAt: new Date(),
      staffName: "Pinnacle³ Staff",
      visaPath: clientCtx.visaPath,
    };

    const criteriaContext = [
      `Client: ${clientCtx.clientName} | Visa: ${visaCategory} | Criterion: ${criteriaName}`,
      `CFR: ${criteriaConfig?.cfr ?? "See applicable regulation"}`,
      `Requirement: ${criteriaConfig?.requirement ?? ""}`,
      `Key Elements: ${(criteriaConfig?.keyElements ?? []).join(", ")}`,
      assessment ? `Assessment — Strengths: ${(assessment.strengths as string[]).join("; ")}` : "",
      assessment ? `Assessment — Weaknesses: ${(assessment.weaknesses as string[]).join("; ")}` : "",
      assessment ? `Adjudicator Concerns: ${(assessment.adjudicatorConcerns as string[]).join("; ")}` : "",
    ].filter(Boolean).join("\n");

    const docText = documents
      .map((d) => `=== ${d.fileName} | Folder: ${d.folderName} ===\n${d.textContent}`)
      .join("\n\n");

    // ── Call 1: Main Document ─────────────────────────────────────────────────
    const mainText = await callClaude(
      `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}\n\n${EXHIBIT_GENERATION_CONFIG.documentTypes.mainDocument.systemPrompt}`,
      `${criteriaContext}\n\nDOCUMENTS (${documents.length} files):\n${docText}\n\nGenerate the complete Main Criterion Document. Output legal prose only — no markdown fences, no code blocks, no commentary outside the document.`,
      4000,
    );

    const mainDoc = renderToPdf(
      "criteria_exhibit",
      `${criteriaName} — ${clientCtx.clientName}`,
      meta,
      mainText,
    );
    const mainPdf = await finalizePdf(mainDoc);
    const mainFileName = `Main_${criteriaCode}_${sanitize(clientCtx.clientName)}.pdf`;
    const mainUpload = await uploadPdfToDrive(mainPdf, mainFileName, exhibitsFolderId);

    await saveExhibitDoc({
      caseSetupId,
      profileId,
      jobId: job.id,
      documentType: "main_document",
      exhibitLabel: exhibitLetter,
      criteriaCode,
      fileName: mainFileName,
      driveFileId: mainUpload.driveFileId,
      driveUrl: mainUpload.driveUrl,
    });

    // ── Call 2: Index Exhibit ─────────────────────────────────────────────────
    const fileList = criteriaDocuments
      .map((d, i) => `${exhibitLetter}${i + 2}: ${d.fileName} (${d.mimeType})`)
      .join("\n");

    const indexText = await callClaude(
      `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}\n\n${EXHIBIT_GENERATION_CONFIG.documentTypes.indexExhibit.systemPrompt}`,
      `${criteriaContext}\n\nFiles in criteria folder:\n${fileList}\nTable type: ${criteriaConfig?.tableType ?? "general"}\nReference sub-exhibits by number (${exhibitLetter}2, ${exhibitLetter}3, etc.)\n\nGenerate the Index Exhibit ${exhibitLetter}1.`,
      3000,
    );

    const indexLabel = `${exhibitLetter}1`;
    const indexDoc = renderToPdf(
      "exhibit_index",
      `Exhibit ${indexLabel}: ${criteriaName} Index — ${clientCtx.clientName}`,
      meta,
      indexText,
    );
    const indexPdf = await finalizePdf(indexDoc);
    const indexFileName = `${indexLabel}_Index_${criteriaCode}.pdf`;
    const indexUpload = await uploadPdfToDrive(indexPdf, indexFileName, exhibitsFolderId);

    await saveExhibitDoc({
      caseSetupId,
      profileId,
      jobId: job.id,
      documentType: "index_exhibit",
      exhibitLabel: indexLabel,
      criteriaCode,
      fileName: indexFileName,
      driveFileId: indexUpload.driveFileId,
      driveUrl: indexUpload.driveUrl,
    });

    // ── Calls 3+: Sub-Exhibits (one per criteria folder document) ─────────────
    for (let i = 0; i < criteriaDocuments.length; i++) {
      const subDoc = criteriaDocuments[i]!;
      const subLabel = `${exhibitLetter}${i + 2}`;

      const subText = await callClaude(
        `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}\n\n${EXHIBIT_GENERATION_CONFIG.documentTypes.subExhibit.systemPrompt}`,
        `${criteriaContext}\nExhibit Number: ${subLabel}\n\n=== ${subDoc.fileName} ===\n${subDoc.textContent}\n\nGenerate Sub-Exhibit ${subLabel}. Include figure placeholders where data supports charts.`,
        3000,
      );

      const subDocPdf = renderToPdf(
        "criteria_exhibit",
        `Exhibit ${subLabel} — ${subDoc.fileName}`,
        meta,
        subText,
      );
      const subPdf = await finalizePdf(subDocPdf);
      const subFileName = `${subLabel}_${sanitize(subDoc.fileName)}.pdf`;
      const subUpload = await uploadPdfToDrive(subPdf, subFileName, exhibitsFolderId);

      await saveExhibitDoc({
        caseSetupId,
        profileId,
        jobId: job.id,
        documentType: "sub_exhibit",
        exhibitLabel: subLabel,
        criteriaCode,
        fileName: subFileName,
        driveFileId: subUpload.driveFileId,
        driveUrl: subUpload.driveUrl,
      });

      if (i < criteriaDocuments.length - 1) await delay(1500);
    }

    // Update petition_criteria_exhibits with main doc Drive info
    await db
      .update(petitionCriteriaExhibitsTable)
      .set({
        status: "draft",
        driveFileId: mainUpload.driveFileId,
        driveUrl: mainUpload.driveUrl,
        driveUploadedAt: new Date(),
      })
      .where(eq(petitionCriteriaExhibitsTable.id, exhibit.id));

    await updateJob(job.id, "completed");
    logger.info({ caseSetupId, criteriaCode, jobId: job.id }, "[exhibitGen] criteria exhibits complete");
  } catch (err) {
    await updateJob(job.id, "failed", String(err));
    logger.error({ caseSetupId, criteriaCode, jobId: job.id, err }, "[exhibitGen] generateCriteriaExhibits failed");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Function 2 — generateAllCriteriaExhibits
// ═════════════════════════════════════════════════════════════════════════════

export async function generateAllCriteriaExhibits(
  caseSetupId: number,
  triggeredByStaffId: string,
): Promise<void> {
  const allExhibits = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId));

  const allAssessments = await db
    .select()
    .from(criteriaAssessmentsTable)
    .where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId));

  const assessmentMap = new Map(allAssessments.map((a) => [a.criteriaCode, a]));

  const eligible = allExhibits.filter((ex) => {
    const assessment = assessmentMap.get(ex.criteriaCode);
    return assessment?.finalDecision === "proceed" || ex.staffApprovedBy != null;
  });

  if (eligible.length === 0) {
    logger.warn({ caseSetupId }, "[exhibitGen] generateAllCriteriaExhibits — no eligible criteria");
    return;
  }

  for (let i = 0; i < eligible.length; i++) {
    try {
      await generateCriteriaExhibits(caseSetupId, eligible[i]!.criteriaCode, triggeredByStaffId);
    } catch (err) {
      logger.error({ caseSetupId, criteriaCode: eligible[i]!.criteriaCode, err }, "[exhibitGen] generateAllCriteriaExhibits — one failed, continuing");
    }
    if (i < eligible.length - 1) await delay(3000);
  }

  logger.info({ caseSetupId, count: eligible.length }, "[exhibitGen] generateAllCriteriaExhibits complete");
}

// ═════════════════════════════════════════════════════════════════════════════
// Function 3 — generateCoverLetter
// ═════════════════════════════════════════════════════════════════════════════

export async function generateCoverLetter(
  caseSetupId: number,
  triggeredByStaffId: string,
): Promise<void> {
  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);
  if (!pkg) throw new Error(`No petition_package for caseSetupId=${caseSetupId}`);

  const job = await createJob({ profileId: pkg.profileId, triggeredByStaffId, caseSetupId, docSubtype: "cover_letter" });

  try {
    await updateJob(job.id, "processing");

    const clientCtx = await buildClientContext(pkg.profileId);
    const visaCategory = resolveVisaCategory(clientCtx.visaPath);

    // All criteria with proceed decision
    const assessments = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId));
    const proceedAssessments = assessments.filter((a) => a.finalDecision === "proceed");

    // All exhibit documents for this case
    const exhibitDocs = await db
      .select()
      .from(exhibitDocumentsTable)
      .where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId));

    const criteriaList = proceedAssessments
      .map((a) => `${a.criteriaCode}: ${a.criteriaName} (${a.recommendation ?? "assessed"})`)
      .join("\n");

    const docList = exhibitDocs
      .map((d) => `${d.exhibitLabel ?? d.documentType}: ${d.fileName}`)
      .join("\n");

    const letterText = await callClaude(
      `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}\n\nYou are writing the main petition support letter for a ${visaCategory} petition. Reference exhibit labels throughout Section III.`,
      `Client: ${clientCtx.clientName} | Visa: ${visaCategory}
Profession: ${clientCtx.profession} | Field: ${clientCtx.fieldOfWork}
Years Experience: ${clientCtx.yearsExperience} | Company: ${clientCtx.company}
Key Achievements: ${clientCtx.keyAchievements}
Publications: ${clientCtx.publications} | Awards: ${clientCtx.awards}
Education: ${clientCtx.education}

CRITERIA WITH PROCEED DECISION:\n${criteriaList || "None"}

GENERATED EXHIBIT DOCUMENTS:\n${docList || "None"}

Structure:
I. Introduction
II. Background and Qualifications
III. Argument — Extraordinary Ability (reference each exhibit label)
IV. Conclusion and Prayer for Relief`,
      6000,
    );

    const meta: DocumentMetadata = {
      clientName: clientCtx.clientName,
      clientEmail: clientCtx.clientEmail,
      generatedAt: new Date(),
      visaPath: clientCtx.visaPath,
    };

    const doc = renderToPdf(
      "cover_letter",
      `Petition Support Letter — ${clientCtx.clientName} — ${visaCategory}`,
      meta,
      letterText,
    );
    const pdfBuffer = await finalizePdf(doc);
    const fileName = `Cover_Letter_${sanitize(clientCtx.clientName)}.pdf`;

    const rootFolderId = await getCaseDriveFolderId(caseSetupId, "root");
    if (!rootFolderId) throw new Error(`No 'root' Drive folder for caseSetupId=${caseSetupId}`);

    const upload = await uploadPdfToDrive(pdfBuffer, fileName, rootFolderId);

    await saveExhibitDoc({
      caseSetupId,
      profileId: pkg.profileId,
      jobId: job.id,
      documentType: "cover_letter",
      exhibitLabel: null,
      criteriaCode: null,
      fileName,
      driveFileId: upload.driveFileId,
      driveUrl: upload.driveUrl,
    });

    await db
      .update(petitionPackageTable)
      .set({
        coverLetterStatus: "draft",
        coverLetterJobId: job.id,
        coverLetterDriveFileId: upload.driveFileId,
        coverLetterDriveUrl: upload.driveUrl,
      })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    await updateJob(job.id, "completed");
    logger.info({ caseSetupId, jobId: job.id }, "[exhibitGen] cover letter complete");
  } catch (err) {
    await updateJob(job.id, "failed", String(err));
    logger.error({ caseSetupId, jobId: job.id, err }, "[exhibitGen] generateCoverLetter failed");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Function 4 — generatePersonalDeclaration
// ═════════════════════════════════════════════════════════════════════════════

export async function generatePersonalDeclaration(
  caseSetupId: number,
  triggeredByStaffId: string,
): Promise<void> {
  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);
  if (!pkg) throw new Error(`No petition_package for caseSetupId=${caseSetupId}`);

  const job = await createJob({ profileId: pkg.profileId, triggeredByStaffId, caseSetupId, docSubtype: "personal_declaration" });

  try {
    await updateJob(job.id, "processing");

    const clientCtx = await buildClientContext(pkg.profileId);
    const visaCategory = resolveVisaCategory(clientCtx.visaPath);

    const fetchResult = await fetchCaseDocuments(caseSetupId);
    const resumeDocs = fetchResult.grouped.resume;
    const demoDocs = fetchResult.grouped.demographics;

    const assessments = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId));

    const assessmentSummaries = assessments
      .map((a) => `${a.criteriaName}: ${a.summary ?? ""}`)
      .join("\n");

    const resumeText = [...resumeDocs, ...demoDocs]
      .map((d) => `=== ${d.fileName} ===\n${d.textContent}`)
      .join("\n\n");

    const declarationText = await callClaude(
      `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}

You are drafting a first-person personal declaration for ${clientCtx.clientName} for their ${visaCategory} petition. Write in first person as the beneficiary. Formal and precise. Cover educational background, career trajectory, and each selected criterion with specific personal examples from the documents provided. End with a jurat: "I declare under penalty of perjury under the laws of the United States that the foregoing is true and correct. Executed on [DATE].\n\n_________________________ ${clientCtx.clientName}"`,
      `All Resume + Demographics documents:\n${resumeText || "(no text extracted)"}\n\nAssessment summaries:\n${assessmentSummaries || "(none)"}`,
      5000,
    );

    const meta: DocumentMetadata = {
      clientName: clientCtx.clientName,
      clientEmail: clientCtx.clientEmail,
      generatedAt: new Date(),
      visaPath: clientCtx.visaPath,
    };

    const doc = renderToPdf(
      "criteria_exhibit",
      `Personal Declaration — ${clientCtx.clientName}`,
      meta,
      declarationText,
    );
    const pdfBuffer = await finalizePdf(doc);
    const fileName = `Personal_Declaration_${sanitize(clientCtx.clientName)}.pdf`;

    const rootFolderId = await getCaseDriveFolderId(caseSetupId, "root");
    if (!rootFolderId) throw new Error(`No 'root' Drive folder for caseSetupId=${caseSetupId}`);

    const upload = await uploadPdfToDrive(pdfBuffer, fileName, rootFolderId);

    await saveExhibitDoc({
      caseSetupId,
      profileId: pkg.profileId,
      jobId: job.id,
      documentType: "personal_declaration",
      exhibitLabel: null,
      criteriaCode: null,
      fileName,
      driveFileId: upload.driveFileId,
      driveUrl: upload.driveUrl,
    });

    await db
      .update(petitionPackageTable)
      .set({
        personalDeclarationStatus: "draft",
        personalDeclarationJobId: job.id,
        personalDeclarationDriveFileId: upload.driveFileId,
        personalDeclarationDriveUrl: upload.driveUrl,
      })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    await updateJob(job.id, "completed");
    logger.info({ caseSetupId, jobId: job.id }, "[exhibitGen] personal declaration complete");
  } catch (err) {
    await updateJob(job.id, "failed", String(err));
    logger.error({ caseSetupId, jobId: job.id, err }, "[exhibitGen] generatePersonalDeclaration failed");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Function 5 — generateFieldBrief
// ═════════════════════════════════════════════════════════════════════════════

export async function generateFieldBrief(
  caseSetupId: number,
  triggeredByStaffId: string,
): Promise<void> {
  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);
  if (!pkg) throw new Error(`No petition_package for caseSetupId=${caseSetupId}`);

  const job = await createJob({ profileId: pkg.profileId, triggeredByStaffId, caseSetupId, docSubtype: "field_brief" });

  try {
    await updateJob(job.id, "processing");

    const clientCtx = await buildClientContext(pkg.profileId);
    const visaCategory = resolveVisaCategory(clientCtx.visaPath);

    const fetchResult = await fetchCaseDocuments(caseSetupId);
    const resumeText = fetchResult.grouped.resume
      .map((d) => `=== ${d.fileName} ===\n${d.textContent}`)
      .join("\n\n");

    const assessments = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId));

    const assessmentSummaries = assessments
      .map((a) => `${a.criteriaName}: ${a.summary ?? ""}`)
      .join("\n");

    const niwNote = visaCategory === "NIW"
      ? "For this NIW case directly address Matter of Dhanasar Prongs 1 and 3 by name."
      : "";

    const briefText = await callClaude(
      `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}

You are drafting a Field of Significance brief. Establish why ${clientCtx.fieldOfWork || clientCtx.profession} is of national importance to the United States and why ${clientCtx.clientName}'s contributions are significant within it. ${niwNote} Include references to government priority areas, industry reports, and economic impact data where applicable.

Structure:
I. Overview of the Field
II. National Importance
III. Beneficiary's Position and Contributions
IV. Why the US Benefits
V. Conclusion`,
      `Client: ${clientCtx.clientName} | Field: ${clientCtx.fieldOfWork || clientCtx.profession} | Visa: ${visaCategory}

Resume documents:\n${resumeText || "(none)"}

Assessment summaries:\n${assessmentSummaries || "(none)"}`,
      4000,
    );

    const meta: DocumentMetadata = {
      clientName: clientCtx.clientName,
      clientEmail: clientCtx.clientEmail,
      generatedAt: new Date(),
      visaPath: clientCtx.visaPath,
    };

    const doc = renderToPdf(
      "criteria_exhibit",
      `Field of Significance Brief — ${clientCtx.clientName}`,
      meta,
      briefText,
    );
    const pdfBuffer = await finalizePdf(doc);
    const fileName = `Field_Brief_${sanitize(clientCtx.clientName)}.pdf`;

    const exhibitsFolderId = await getCaseDriveFolderId(caseSetupId, "exhibits");
    if (!exhibitsFolderId) throw new Error(`No 'exhibits' Drive folder for caseSetupId=${caseSetupId}`);

    const upload = await uploadPdfToDrive(pdfBuffer, fileName, exhibitsFolderId);

    await saveExhibitDoc({
      caseSetupId,
      profileId: pkg.profileId,
      jobId: job.id,
      documentType: "field_brief",
      exhibitLabel: null,
      criteriaCode: null,
      fileName,
      driveFileId: upload.driveFileId,
      driveUrl: upload.driveUrl,
    });

    await db
      .update(petitionPackageTable)
      .set({
        fieldBriefStatus: "draft",
        fieldBriefJobId: job.id,
        fieldBriefDriveFileId: upload.driveFileId,
        fieldBriefDriveUrl: upload.driveUrl,
      })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    await updateJob(job.id, "completed");
    logger.info({ caseSetupId, jobId: job.id }, "[exhibitGen] field brief complete");
  } catch (err) {
    await updateJob(job.id, "failed", String(err));
    logger.error({ caseSetupId, jobId: job.id, err }, "[exhibitGen] generateFieldBrief failed");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Function 6 — generateRecommendationTemplates
// ═════════════════════════════════════════════════════════════════════════════

const RECO_TYPES = [
  {
    key: "independent_expert",
    label: "Independent Expert",
    instruction:
      "someone who knows the beneficiary by reputation only, not a direct collaborator. This recommender has never worked with the beneficiary directly but is familiar with their published work and field contributions.",
  },
  {
    key: "direct_collaborator",
    label: "Direct Collaborator",
    instruction:
      "someone who has worked directly alongside the beneficiary and can speak to their day-to-day contributions, methodology, and professional conduct.",
  },
  {
    key: "industry_leader",
    label: "Industry Leader",
    instruction:
      "a senior figure speaking to the field-wide significance of the beneficiary's contributions and their standing within the broader professional community.",
  },
] as const;

export async function generateRecommendationTemplates(
  caseSetupId: number,
  triggeredByStaffId: string,
): Promise<void> {
  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);
  if (!pkg) throw new Error(`No petition_package for caseSetupId=${caseSetupId}`);

  const job = await createJob({ profileId: pkg.profileId, triggeredByStaffId, caseSetupId, docSubtype: "recommendation_templates" });

  try {
    await updateJob(job.id, "processing");

    const clientCtx = await buildClientContext(pkg.profileId);
    const visaCategory = resolveVisaCategory(clientCtx.visaPath);

    const assessments = await db
      .select()
      .from(criteriaAssessmentsTable)
      .where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId));

    const topStrengths = assessments
      .flatMap((a) => (a.strengths as string[]) ?? [])
      .slice(0, 8)
      .join("; ");

    const exhibitsFolderId = await getCaseDriveFolderId(caseSetupId, "exhibits");
    if (!exhibitsFolderId) throw new Error(`No 'exhibits' Drive folder for caseSetupId=${caseSetupId}`);

    const meta: DocumentMetadata = {
      clientName: clientCtx.clientName,
      clientEmail: clientCtx.clientEmail,
      generatedAt: new Date(),
      visaPath: clientCtx.visaPath,
    };

    const clientSummary = [
      `Beneficiary: ${clientCtx.clientName}`,
      `Profession: ${clientCtx.profession} | Field: ${clientCtx.fieldOfWork}`,
      `Visa: ${visaCategory} | Company: ${clientCtx.company}`,
      `Years Experience: ${clientCtx.yearsExperience}`,
      `Key Achievements: ${clientCtx.keyAchievements}`,
      `Publications: ${clientCtx.publications}`,
      `Awards: ${clientCtx.awards}`,
      `Top Strengths from Assessment: ${topStrengths}`,
    ].join("\n");

    for (let i = 0; i < RECO_TYPES.length; i++) {
      const reco = RECO_TYPES[i]!;

      const letterText = await callClaude(
        `${EXHIBIT_GENERATION_CONFIG.baseSystemPrompt}

You are drafting a recommendation letter TEMPLATE to be used as a starting point for a recommender who is ${reco.instruction}

IMPORTANT: Begin the document with this notice on its own line:
"DRAFT TEMPLATE — FOR RECOMMENDER USE ONLY — TO BE REVISED AND SIGNED BY RECOMMENDER"

Then write the full recommendation letter pre-populated with the beneficiary's specific achievements. Write in first person as an unnamed recommender of this type. Leave [RECOMMENDER NAME], [RECOMMENDER TITLE], [RECOMMENDER ORGANIZATION], and [DATE] as placeholders in the header only — all body content must be specific and complete.`,
        `${clientSummary}\n\nWrite the complete ${reco.label} recommendation letter template for this ${visaCategory} petition.`,
        2000,
      );

      const doc = createDocument(
        "recommendation_letter",
        `${reco.label} Recommendation Template — ${clientCtx.clientName}`,
        meta,
      );
      addBodyText(doc, letterText);
      const pdfBuffer = await finalizePdf(doc);
      const fileName = `Reco_Template_${reco.key}_${sanitize(clientCtx.clientName)}.pdf`;

      const upload = await uploadPdfToDrive(pdfBuffer, fileName, exhibitsFolderId);

      await saveExhibitDoc({
        caseSetupId,
        profileId: pkg.profileId,
        jobId: job.id,
        documentType: "recommendation_template",
        exhibitLabel: null,
        criteriaCode: null,
        fileName,
        driveFileId: upload.driveFileId,
        driveUrl: upload.driveUrl,
      });

      if (i < RECO_TYPES.length - 1) await delay(1500);
    }

    await db
      .update(petitionPackageTable)
      .set({
        recoTemplatesStatus: "draft",
        recoTemplatesJobId: job.id,
      })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    await updateJob(job.id, "completed");
    logger.info({ caseSetupId, jobId: job.id }, "[exhibitGen] recommendation templates complete");
  } catch (err) {
    await updateJob(job.id, "failed", String(err));
    logger.error({ caseSetupId, jobId: job.id, err }, "[exhibitGen] generateRecommendationTemplates failed");
  }
}
