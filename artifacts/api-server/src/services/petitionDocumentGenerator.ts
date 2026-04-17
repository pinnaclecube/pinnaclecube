/**
 * petitionDocumentGenerator.ts — Pinnacle³
 *
 * Generates petition documents (criteria exhibits, recommendation letters,
 * exhibit index, cover letter) using Claude Sonnet and converts them to
 * PDF via legalPdfTemplate. Optionally uploads to Google Drive.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  readinessIntakeTable,
  evidenceTable,
  petitionCriteriaExhibitsTable,
  petitionRecoLettersTable,
  petitionPackageTable,
  documentGenerationJobsTable,
  visaCriteriaTable,
} from "@workspace/db";
import {
  createDocument,
  addSectionHeading,
  addBodyText,
  addEvidenceTable,
  addPageBreak,
  finalizePdf,
  type DocumentMetadata,
} from "./legalPdfTemplate";
import {
  uploadPetitionDraftFile,
  buildCriteriaExhibitName,
  buildRecoLetterName,
  buildExhibitIndexName,
  buildCoverLetterName,
} from "./googleDrive";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientContext {
  profileId: number;
  clientName: string;
  clientEmail: string;
  firstName: string;
  lastName: string;
  profession: string;
  visaPath: string;
  yearsExperience: number;
  fieldOfWork: string;
  company: string;
  country: string;
  keyAchievements: string;
  publications: string;
  awards: string;
  education: string;
}

export interface CriteriaExhibitJson {
  exhibit_title: string;
  legal_standard_section: string;
  petitioner_narrative: string;
  evidence_table: Array<{
    exhibit_ref: string;
    document_title: string;
    significance: string;
  }>;
  conclusion: string;
}

// ─── AI client ────────────────────────────────────────────────────────────────

function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "Anthropic AI integration is not provisioned. Add AI_INTEGRATIONS_ANTHROPIC_API_KEY.",
    );
  }
  return new Anthropic({ apiKey, baseURL });
}

// ─── Client context builder ───────────────────────────────────────────────────

export async function buildClientContext(profileId: number): Promise<ClientContext> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);

  const [intake] = await db
    .select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, profileId))
    .limit(1);

  const name = profile?.name ?? intake?.fullName ?? "Unknown";
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = (nameParts.slice(1).join(" ") || nameParts[0]) ?? "";

  return {
    profileId,
    clientName: name,
    clientEmail: profile?.email ?? intake?.email ?? "",
    firstName,
    lastName,
    profession: profile?.profession ?? intake?.currentRole ?? "",
    visaPath: profile?.visaTarget ?? intake?.visaPath ?? "eb1a",
    yearsExperience: profile?.yearsExperience ?? 0,
    fieldOfWork: intake?.fieldOfWork ?? profile?.profession ?? "",
    company: intake?.company ?? "",
    country: profile?.country ?? intake?.country ?? "",
    keyAchievements: intake?.keyAchievements ?? "",
    publications: intake?.publications ?? "",
    awards: intake?.awards ?? "",
    education: intake?.education ?? "",
  };
}

// ─── Drive upload (graceful no-op if not configured) ─────────────────────────

async function tryUploadDraft(
  profileId: number,
  subtype: "criteria_exhibit" | "recommendation_letter" | "exhibit_index" | "cover_letter",
  buffer: Buffer,
  fileName: string,
): Promise<{ driveFileId: string | null; driveUrl: string | null }> {
  try {
    const uploaded = await uploadPetitionDraftFile(profileId, subtype, buffer, fileName);
    return { driveFileId: uploaded.driveFileId, driveUrl: uploaded.driveFileUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[petitionGenerator] Drive upload skipped: ${msg}`);
    return { driveFileId: null, driveUrl: null };
  }
}

// ─── Parse JSON from Claude response ─────────────────────────────────────────

function extractJson<T>(raw: string): T {
  const stripped = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const cleaned = match ? match[0] : stripped;
  return JSON.parse(cleaned) as T;
}

// ─── 1. generateCriteriaExhibit ───────────────────────────────────────────────

export async function generateCriteriaExhibit(
  criteriaExhibitId: number,
  priorApprovedExhibitIds: number[] = [],
): Promise<void> {
  const [exhibit] = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(eq(petitionCriteriaExhibitsTable.id, criteriaExhibitId))
    .limit(1);

  if (!exhibit) throw new Error(`CriteriaExhibit ${criteriaExhibitId} not found`);

  const clientCtx = await buildClientContext(exhibit.profileId);

  // Fetch evidence items linked to this exhibit
  const evidenceIds = (exhibit.evidenceItemIds as number[]) ?? [];
  const evidenceItems = evidenceIds.length
    ? await db
        .select()
        .from(evidenceTable)
        .where(inArray(evidenceTable.id, evidenceIds))
    : [];

  // Fetch prior approved exhibits for context
  const priorExhibits =
    priorApprovedExhibitIds.length
      ? await db
          .select({
            criteriaName: petitionCriteriaExhibitsTable.criteriaName,
            exhibitNumber: petitionCriteriaExhibitsTable.exhibitNumber,
          })
          .from(petitionCriteriaExhibitsTable)
          .where(inArray(petitionCriteriaExhibitsTable.id, priorApprovedExhibitIds))
      : [];

  const evidenceSummary = evidenceItems
    .map(
      (e, i) =>
        `Evidence ${i + 1}: "${e.title}" — Type: ${e.evidenceType} — ${e.aiSummary ?? e.description ?? "No description"}`,
    )
    .join("\n");

  const priorExhibitList = priorExhibits
    .map((p) => `Tab ${p.exhibitNumber}: ${p.criteriaName}`)
    .join(", ");

  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system:
      "You are an expert US immigration attorney specializing in EB-1A, EB-2 NIW, and O-1 petitions. " +
      "Draft a formal exhibit document for USCIS. Write in professional legal petition style. " +
      "Be specific. Reference evidence by name. Never use placeholders.",
    messages: [
      {
        role: "user",
        content: `Generate a formal USCIS criteria exhibit for the following:

CLIENT: ${clientCtx.clientName}
VISA PATH: ${clientCtx.visaPath.toUpperCase()}
PROFESSION: ${clientCtx.profession}
FIELD: ${clientCtx.fieldOfWork}
YEARS EXPERIENCE: ${clientCtx.yearsExperience}
COMPANY: ${clientCtx.company}
COUNTRY: ${clientCtx.country}
KEY ACHIEVEMENTS: ${clientCtx.keyAchievements}
PUBLICATIONS: ${clientCtx.publications}
AWARDS: ${clientCtx.awards}

CRITERION BEING ARGUED:
Code: ${exhibit.criteriaCode}
Name: ${exhibit.criteriaName}
Tab/Exhibit Number: ${exhibit.exhibitNumber}
Legal Standard: (Standard for ${exhibit.criteriaCode} — ${exhibit.criteriaName})

EVIDENCE ATTACHED TO THIS CRITERION:
${evidenceSummary || "No evidence items mapped yet — draft based on stated achievements."}

PRIOR APPROVED EXHIBITS IN THIS PACKAGE:
${priorExhibitList || "None yet — this is the first exhibit."}

Return a JSON object with exactly these keys:
{
  "exhibit_title": "string — formal exhibit title, e.g. TAB 2 — CRITERION II: MEMBERSHIP",
  "legal_standard_section": "string — the specific legal standard text for this criterion and how it applies",
  "petitioner_narrative": "string — detailed legal narrative (3-6 paragraphs) arguing the criterion is met, citing evidence by title",
  "evidence_table": [
    {
      "exhibit_ref": "string — e.g. Exhibit 2-A",
      "document_title": "string — name of the evidence document",
      "significance": "string — why this evidence satisfies the criterion"
    }
  ],
  "conclusion": "string — one paragraph conclusion for this exhibit tab"
}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = extractJson<CriteriaExhibitJson>(raw);

  // Build PDF
  const meta: DocumentMetadata = {
    clientName: clientCtx.clientName,
    clientEmail: clientCtx.clientEmail,
    generatedAt: new Date(),
    staffName: "Pinnacle³ Staff",
    visaPath: clientCtx.visaPath,
  };

  const doc = createDocument("criteria_exhibit", parsed.exhibit_title, meta);
  addSectionHeading(doc, "I. Applicable Legal Standard");
  addBodyText(doc, parsed.legal_standard_section);
  addSectionHeading(doc, "II. Petitioner's Qualifications");
  addBodyText(doc, parsed.petitioner_narrative);
  if (parsed.evidence_table?.length) {
    addSectionHeading(doc, "III. Evidence Summary");
    addEvidenceTable(doc, parsed.evidence_table);
  }
  addPageBreak(doc);
  addSectionHeading(doc, "IV. Conclusion");
  addBodyText(doc, parsed.conclusion);
  const pdfBuffer = await finalizePdf(doc);

  // Upload to Drive
  const fileName = buildCriteriaExhibitName(
    parseInt(exhibit.exhibitNumber, 10) || 1,
    exhibit.criteriaCode,
    clientCtx.lastName,
    (exhibit.regenerationCount ?? 0) + 1,
  );
  const { driveFileId, driveUrl } = await tryUploadDraft(
    exhibit.profileId,
    "criteria_exhibit",
    pdfBuffer,
    fileName,
  );

  // Update DB
  await db
    .update(petitionCriteriaExhibitsTable)
    .set({
      status: "draft",
      driveDraftFileId: driveFileId,
      driveDraftUrl: driveUrl,
    })
    .where(eq(petitionCriteriaExhibitsTable.id, criteriaExhibitId));

  console.info(
    `[petitionGen] Criteria exhibit ${criteriaExhibitId} (${exhibit.criteriaCode}) → draft. Drive: ${driveUrl ?? "not uploaded"}`,
  );
}

// ─── 2. generateRecoLetter ────────────────────────────────────────────────────

export async function generateRecoLetter(recoLetterId: number): Promise<void> {
  const [reco] = await db
    .select()
    .from(petitionRecoLettersTable)
    .where(eq(petitionRecoLettersTable.id, recoLetterId))
    .limit(1);

  if (!reco) throw new Error(`RecoLetter ${recoLetterId} not found`);

  const clientCtx = await buildClientContext(reco.profileId);
  const criteriaSupported = (reco.criteriaSupported as string[]) ?? [];

  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system:
      "You are drafting a recommendation letter to be signed by an expert. " +
      "Write in first person as the recommender. Be specific and personal. " +
      "Write complete ready-to-review content.",
    messages: [
      {
        role: "user",
        content: `Draft a formal immigration recommendation letter.

RECOMMENDER INFORMATION:
Name: ${reco.recommenderName}
Title: ${reco.recommenderTitle}
Organization: ${reco.recommenderOrg}
Relationship to Petitioner: ${reco.recommenderRelationship}
Credentials: ${reco.recommenderCredentials ?? "Distinguished expert in the field"}

PETITIONER INFORMATION:
Name: ${clientCtx.clientName}
Profession: ${clientCtx.profession}
Field: ${clientCtx.fieldOfWork}
Company: ${clientCtx.company}
Years Experience: ${clientCtx.yearsExperience}
Key Achievements: ${clientCtx.keyAchievements}
Publications: ${clientCtx.publications}
Awards: ${clientCtx.awards}
Visa Type: ${clientCtx.visaPath.toUpperCase()}

CRITERIA THIS LETTER SHOULD SUPPORT:
${criteriaSupported.join(", ") || "General extraordinary ability"}

Write a complete business-format recommendation letter in first person as ${reco.recommenderName}. Include:
1. Opening paragraph: who I am and my relationship to the petitioner
2. Body paragraphs: specific knowledge of the petitioner's extraordinary work (2-4 paragraphs)
3. How their work satisfies the USCIS criteria listed above
4. Strong closing supporting the petition
5. Closing with signature block

Write the full letter text, ready for the recommender to review and sign. Include [DATE] and [ADDRESS] placeholders only for the letter header — all body content must be complete.`,
      },
    ],
  });

  const letterText = response.content[0].type === "text" ? response.content[0].text : "";

  // Build PDF
  const meta: DocumentMetadata = {
    clientName: clientCtx.clientName,
    clientEmail: clientCtx.clientEmail,
    generatedAt: new Date(),
    staffName: "Pinnacle³ Staff",
    visaPath: clientCtx.visaPath,
  };

  const title = `Letter of Recommendation — ${reco.recommenderName}, ${reco.recommenderTitle}`;
  const doc = createDocument("recommendation_letter", title, meta);
  addBodyText(doc, letterText);
  const pdfBuffer = await finalizePdf(doc);

  // Upload to Drive
  const recommenderLastName = reco.recommenderName.split(" ").pop() ?? reco.recommenderName;
  const fileName = buildRecoLetterName(recommenderLastName, clientCtx.lastName);
  const { driveFileId, driveUrl } = await tryUploadDraft(
    reco.profileId,
    "recommendation_letter",
    pdfBuffer,
    fileName,
  );

  await db
    .update(petitionRecoLettersTable)
    .set({ status: "draft", driveDraftFileId: driveFileId, driveDraftUrl: driveUrl })
    .where(eq(petitionRecoLettersTable.id, recoLetterId));

  console.info(
    `[petitionGen] Reco letter ${recoLetterId} (${reco.recommenderName}) → draft. Drive: ${driveUrl ?? "not uploaded"}`,
  );
}

// ─── 3. generateExhibitIndex ──────────────────────────────────────────────────

export async function generateExhibitIndex(caseSetupId: number): Promise<void> {
  // Fetch all approved exhibits
  const approvedExhibits = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(
      and(
        eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId),
        eq(petitionCriteriaExhibitsTable.status, "approved"),
      ),
    );

  const approvedRecos = await db
    .select()
    .from(petitionRecoLettersTable)
    .where(
      and(
        eq(petitionRecoLettersTable.caseSetupId, caseSetupId),
        eq(petitionRecoLettersTable.status, "approved"),
      ),
    );

  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);

  if (!pkg) throw new Error(`No petition package found for caseSetupId ${caseSetupId}`);

  const clientCtx = await buildClientContext(pkg.profileId);

  const exhibitList = approvedExhibits
    .sort((a, b) => (a.exhibitNumber > b.exhibitNumber ? 1 : -1))
    .map((e) => `Tab ${e.exhibitNumber}: ${e.criteriaName} (${e.criteriaCode})`)
    .join("\n");

  const recoList = approvedRecos
    .map((r) => `${r.recommenderName}, ${r.recommenderTitle}, ${r.recommenderOrg}`)
    .join("\n");

  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    system:
      "You are a senior immigration attorney preparing a formal USCIS petition package. " +
      "Generate a formal table of contents for the petition.",
    messages: [
      {
        role: "user",
        content: `Generate a formal exhibit index / table of contents for this ${clientCtx.visaPath.toUpperCase()} petition.

CLIENT: ${clientCtx.clientName}
VISA TYPE: ${clientCtx.visaPath.toUpperCase()}

CRITERIA EXHIBITS (already approved):
${exhibitList || "None"}

RECOMMENDATION LETTERS (already approved):
${recoList || "None"}

Write a professional formal table of contents in plain text format, as it would appear in an official USCIS petition package. Include an introduction paragraph, the numbered/tabbed exhibit list, recommendation letters section, and a closing note about the package organization. Format clearly for direct PDF inclusion.`,
      },
    ],
  });

  const indexText = response.content[0].type === "text" ? response.content[0].text : "";

  const meta: DocumentMetadata = {
    clientName: clientCtx.clientName,
    clientEmail: clientCtx.clientEmail,
    generatedAt: new Date(),
    visaPath: clientCtx.visaPath,
  };

  const doc = createDocument(
    "exhibit_index",
    `Exhibit Index — ${clientCtx.clientName} — ${clientCtx.visaPath.toUpperCase()} Petition`,
    meta,
  );
  addBodyText(doc, indexText);
  const pdfBuffer = await finalizePdf(doc);

  const fileName = buildExhibitIndexName(clientCtx.lastName);
  const { driveFileId, driveUrl } = await tryUploadDraft(
    pkg.profileId,
    "exhibit_index",
    pdfBuffer,
    fileName,
  );

  await db
    .update(petitionPackageTable)
    .set({
      exhibitIndexStatus: "draft",
      exhibitIndexDriveDraftUrl: driveUrl,
    })
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

  console.info(
    `[petitionGen] Exhibit index for caseSetup ${caseSetupId} → draft. Drive: ${driveUrl ?? "not uploaded"}`,
  );
}

// ─── 4. generateCoverLetter ───────────────────────────────────────────────────

export async function generateCoverLetter(caseSetupId: number): Promise<void> {
  const approvedExhibits = await db
    .select()
    .from(petitionCriteriaExhibitsTable)
    .where(
      and(
        eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId),
        eq(petitionCriteriaExhibitsTable.status, "approved"),
      ),
    );

  const approvedRecos = await db
    .select()
    .from(petitionRecoLettersTable)
    .where(
      and(
        eq(petitionRecoLettersTable.caseSetupId, caseSetupId),
        eq(petitionRecoLettersTable.status, "approved"),
      ),
    );

  const [pkg] = await db
    .select()
    .from(petitionPackageTable)
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
    .limit(1);

  if (!pkg) throw new Error(`No petition package found for caseSetupId ${caseSetupId}`);

  const clientCtx = await buildClientContext(pkg.profileId);

  const exhibitSummaries = approvedExhibits
    .sort((a, b) => (a.exhibitNumber > b.exhibitNumber ? 1 : -1))
    .map(
      (e) =>
        `Tab ${e.exhibitNumber} — ${e.criteriaName} (${e.criteriaCode}): Supporting evidence mapped.`,
    )
    .join("\n");

  const recoSummaries = approvedRecos
    .map((r) => `${r.recommenderName}, ${r.recommenderTitle} at ${r.recommenderOrg}`)
    .join("\n");

  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system:
      "You are a senior immigration attorney writing the main USCIS petition support letter. " +
      "Reference exhibits by tab number throughout. " +
      "Write 5-15 pages depending on criteria count. " +
      "Use formal legal petition prose.",
    messages: [
      {
        role: "user",
        content: `Write the complete petition support letter for:

CLIENT: ${clientCtx.clientName}
PROFESSION: ${clientCtx.profession}
FIELD: ${clientCtx.fieldOfWork}
COMPANY: ${clientCtx.company}
COUNTRY: ${clientCtx.country}
YEARS EXPERIENCE: ${clientCtx.yearsExperience}
VISA TYPE: ${clientCtx.visaPath.toUpperCase()}
KEY ACHIEVEMENTS: ${clientCtx.keyAchievements}
PUBLICATIONS: ${clientCtx.publications}
AWARDS: ${clientCtx.awards}
EDUCATION: ${clientCtx.education}

APPROVED EXHIBIT TABS:
${exhibitSummaries || "None"}

RECOMMENDATION LETTERS:
${recoSummaries || "None"}

Structure the letter with these sections:
I. Introduction (party names, visa type, purpose of letter)
II. Background and Qualifications of Petitioner (detailed biography)
III. Argument — Extraordinary Ability (address each criterion by tab number: "As demonstrated in Tab X...")
IV. Conclusion and Prayer for Relief (formal request to USCIS)

Write the complete letter in formal petition style. Reference exhibit tab numbers throughout Section III.`,
      },
    ],
  });

  const letterText = response.content[0].type === "text" ? response.content[0].text : "";

  const meta: DocumentMetadata = {
    clientName: clientCtx.clientName,
    clientEmail: clientCtx.clientEmail,
    generatedAt: new Date(),
    visaPath: clientCtx.visaPath,
  };

  const doc = createDocument(
    "cover_letter",
    `Petition Support Letter — ${clientCtx.clientName} — ${clientCtx.visaPath.toUpperCase()}`,
    meta,
  );
  addBodyText(doc, letterText);
  const pdfBuffer = await finalizePdf(doc);

  const fileName = buildCoverLetterName(clientCtx.lastName, clientCtx.visaPath);
  const { driveFileId, driveUrl } = await tryUploadDraft(
    pkg.profileId,
    "cover_letter",
    pdfBuffer,
    fileName,
  );

  await db
    .update(petitionPackageTable)
    .set({
      coverLetterStatus: "draft",
      coverLetterDriveDraftUrl: driveUrl,
    })
    .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

  console.info(
    `[petitionGen] Cover letter for caseSetup ${caseSetupId} → draft. Drive: ${driveUrl ?? "not uploaded"}`,
  );
}
