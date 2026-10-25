/**
 * letterContextService.ts — Pinnacle³
 *
 * Step 4 — assembles everything the AI needs to draft a referee's reference
 * letter: applicant profile, referee intake + contributions, mapped projects
 * (all completed sections), and mapped evidence (with text extracted from the
 * file itself). Reuses extractText + downloadDriveFile. Never fails the whole
 * assembly on an extraction error — logs and falls back to label + notes.
 */

import { eq, inArray } from "drizzle-orm";
import {
  db,
  refereesTable,
  refereeContributionsTable,
  contributionTypesTable,
  degreeTypesTable,
  caseProjectsTable,
  refereeProjectsTable,
  refereeEvidenceTable,
  caseFolderItemsTable,
  casePetitionSetupTable,
  profilesTable,
  readinessIntakeTable,
  employmentTypesTable,
  criticalityLevelsTable,
} from "@workspace/db";
import { downloadDriveFile } from "./driveService";
import { extractText } from "./evidenceProcessing";
import { criterionDisplayName } from "./evidenceSyncService";
import { logger } from "../lib/logger";

const PER_FILE_WORD_CAP = 3000;
const TOTAL_EVIDENCE_WORD_BUDGET = 24000; // truncate evidence first, never project/intake

// Ordered [column, label] for the project documentation sections (1–9).
const PROJECT_FIELDS: [keyof typeof caseProjectsTable.$inferSelect, string][] = [
  ["industryDomain", "Industry / domain"],
  ["teamComposition", "Team composition"],
  ["summary", "Summary"],
  ["criticalityJustification", "Criticality justification"],
  ["regulatoryContext", "Regulatory context"],
  ["problemBefore", "Problem before involvement"],
  ["baselineMetrics", "Baseline metrics"],
  ["constraintsRisks", "Constraints & risks"],
  ["failureConsequences", "Consequences of failure"],
  ["whyChosen", "Why chosen for the role"],
  ["decisionAuthority", "Decision authority"],
  ["stakeholdersInfluenced", "Stakeholders influenced"],
  ["criticalEventsLed", "Critical events led"],
  ["indispensabilityEvidence", "Evidence of indispensability"],
  ["leadershipOutcomes", "Leadership outcomes"],
  ["originalIdea", "Original idea / method"],
  ["approachDifference", "How the approach differed / was superior"],
  ["originalityProof", "Proof of originality"],
  ["contributionReach", "Where the contribution is used"],
  ["downstreamImpact", "Downstream impact"],
  ["beforeAfterMetrics", "Before vs. after metrics"],
  ["revenueCostSavings", "Revenue / cost savings"],
  ["adoptionMetrics", "Adoption metrics"],
  ["evidenceNotes", "Evidence notes"],
  ["testimonials", "Testimonials"],
  ["pressRecognition", "Press / recognition"],
  ["awardsCommendations", "Awards & commendations"],
  ["strategicImportance", "Strategic importance"],
  ["architectureMethods", "Architecture / methods"],
  ["alternativesInferior", "Why alternatives were inferior"],
  ["reproducibility", "Reproducibility"],
  ["ipStatus", "IP status"],
  ["externalUsers", "External users"],
  ["adoptionEvidence", "Adoption evidence"],
  ["academicCitations", "Academic citations"],
  ["talksInvitations", "Talks / invitations"],
  ["uniquenessVsPeers", "Uniqueness vs. peers"],
  ["measurableDifferences", "Measurable differences"],
  ["expertiseScarcity", "Why the expertise is scarce"],
];

function words(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
function truncateWords(s: string, cap: number): string {
  const parts = s.trim().split(/\s+/);
  return parts.length <= cap ? s.trim() : parts.slice(0, cap).join(" ") + " […truncated]";
}
function fmtMonth(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export interface LetterContext {
  applicant: {
    name: string; role: string; field: string; visaPath: string;
    yearsExperience: string | null; company: string | null;
  };
  referee: {
    fullName: string; title: string; organization: string; country: string | null;
    degree: string | null; fieldOfExpertise: string | null;
    workedTogether: boolean; sharedOrganization: string | null; sharedPeriod: string | null;
  };
  contributions: { type: string; details: string }[];
  projects: {
    title: string; organization: string | null; timeline: string; role: string | null;
    employmentType: string | null; criticality: string | null;
    sections: { label: string; value: string }[];
    attestationNotes: string | null;
  }[];
  evidence: {
    displayLabel: string; criterion: string; attestationNotes: string | null;
    fileName: string; extractedText: string | null; extractionFailed: boolean;
  }[];
}

export async function buildLetterContext(refereeId: number): Promise<LetterContext | null> {
  const [referee] = await db.select().from(refereesTable).where(eq(refereesTable.id, refereeId)).limit(1);
  if (!referee) return null;

  // ── Applicant (case → profile + readiness intake) ───────────────────────────
  const [caseRow] = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, referee.caseId))
    .limit(1);
  const profileId = caseRow?.profileId ?? null;
  const [profile] = profileId
    ? await db.select().from(profilesTable).where(eq(profilesTable.id, profileId)).limit(1)
    : [undefined];
  const [intake] = profileId
    ? await db.select().from(readinessIntakeTable).where(eq(readinessIntakeTable.profileId, profileId)).limit(1)
    : [undefined];

  const applicant = {
    name: profile?.name ?? intake?.fullName ?? "the applicant",
    role: intake?.currentRole ?? profile?.profession ?? "",
    field: intake?.fieldOfWork ?? profile?.profession ?? "",
    visaPath: (caseRow?.visaPath ?? profile?.visaTarget ?? "eb1a").toUpperCase(),
    yearsExperience: intake?.yearsExperience ?? null,
    company: intake?.company ?? null,
  };

  // ── Referee intake ───────────────────────────────────────────────────────────
  let degree: string | null = null;
  if (referee.degreeTypeId != null) {
    const [d] = await db.select().from(degreeTypesTable).where(eq(degreeTypesTable.id, referee.degreeTypeId)).limit(1);
    degree = d?.name ?? null;
  }
  const contribRows = await db
    .select({
      details: refereeContributionsTable.details,
      type: contributionTypesTable.name,
    })
    .from(refereeContributionsTable)
    .leftJoin(contributionTypesTable, eq(contributionTypesTable.id, refereeContributionsTable.contributionTypeId))
    .where(eq(refereeContributionsTable.refereeId, refereeId));

  // ── Mapped projects (all completed sections) ─────────────────────────────────
  const projRows = await db
    .select({
      project: caseProjectsTable,
      attestationNotes: refereeProjectsTable.attestationNotes,
      employmentType: employmentTypesTable.name,
      criticality: criticalityLevelsTable.name,
    })
    .from(refereeProjectsTable)
    .innerJoin(caseProjectsTable, eq(caseProjectsTable.id, refereeProjectsTable.projectId))
    .leftJoin(employmentTypesTable, eq(employmentTypesTable.id, caseProjectsTable.employmentTypeId))
    .leftJoin(criticalityLevelsTable, eq(criticalityLevelsTable.id, caseProjectsTable.criticalityId))
    .where(eq(refereeProjectsTable.refereeId, refereeId));

  const projects = projRows.map((r) => {
    const p = r.project;
    const start = fmtMonth(p.startDate);
    const end = p.isOngoing ? "Present" : fmtMonth(p.endDate);
    const timeline = start || end ? [start || "—", end || "—"].join(" – ") : "";
    const sections = PROJECT_FIELDS
      .map(([key, label]) => ({ label, value: String(p[key] ?? "").trim() }))
      .filter((s) => s.value);
    return {
      title: p.title,
      organization: p.organization,
      timeline,
      role: p.roleTitle,
      employmentType: r.employmentType ?? null,
      criticality: r.criticality ?? null,
      sections,
      attestationNotes: r.attestationNotes,
    };
  });

  // ── Mapped evidence (with text extraction, budgeted) ─────────────────────────
  const evRows = await db
    .select({
      displayLabel: refereeEvidenceTable.displayLabel,
      attestationNotes: refereeEvidenceTable.attestationNotes,
      driveId: caseFolderItemsTable.driveId,
      fileName: caseFolderItemsTable.name,
      mimeType: caseFolderItemsTable.mimeType,
      criterion: caseFolderItemsTable.criterionFolder,
    })
    .from(refereeEvidenceTable)
    .innerJoin(caseFolderItemsTable, eq(caseFolderItemsTable.id, refereeEvidenceTable.evidenceFileId))
    .where(eq(refereeEvidenceTable.refereeId, refereeId));

  // Per-file cap shrinks as the number of mapped files grows (evidence truncates
  // first, never project/referee data).
  const perFileCap = evRows.length > 0
    ? Math.min(PER_FILE_WORD_CAP, Math.floor(TOTAL_EVIDENCE_WORD_BUDGET / evRows.length))
    : PER_FILE_WORD_CAP;

  const evidence: LetterContext["evidence"] = [];
  for (const e of evRows) {
    let extractedText: string | null = null;
    let extractionFailed = false;
    try {
      const buffer = await downloadDriveFile(e.driveId);
      const text = await extractText(buffer, e.mimeType, e.fileName);
      extractedText = text && text.trim() ? truncateWords(text, perFileCap) : null;
    } catch (err) {
      extractionFailed = true;
      logger.error({ err, refereeId, fileName: e.fileName }, "[letterContext] evidence extraction failed — using label + notes only");
    }
    evidence.push({
      displayLabel: e.displayLabel,
      criterion: criterionDisplayName(e.criterion ?? "unclassified"),
      attestationNotes: e.attestationNotes,
      fileName: e.fileName,
      extractedText,
      extractionFailed,
    });
  }

  return {
    applicant,
    referee: {
      fullName: referee.fullName,
      title: referee.title,
      organization: referee.organization,
      country: referee.country,
      degree,
      fieldOfExpertise: referee.fieldOfExpertise,
      workedTogether: referee.workedTogether,
      sharedOrganization: referee.sharedOrganization,
      sharedPeriod: referee.sharedPeriod,
    },
    contributions: contribRows.map((c) => ({ type: c.type ?? "Contribution", details: c.details })),
    projects,
    evidence,
  };
}

// ─── Serialize context into the model's user message ─────────────────────────────

export function serializeLetterContext(ctx: LetterContext): string {
  const lines: string[] = [];
  const a = ctx.applicant;
  lines.push("=== APPLICANT (the petition beneficiary) ===");
  lines.push(`Name: ${a.name}`);
  if (a.role) lines.push(`Current role/title: ${a.role}`);
  if (a.field) lines.push(`Field: ${a.field}`);
  if (a.company) lines.push(`Company: ${a.company}`);
  if (a.yearsExperience) lines.push(`Years of experience: ${a.yearsExperience}`);
  lines.push(`Visa path: ${a.visaPath}`);

  const r = ctx.referee;
  lines.push("\n=== REFEREE (letter author, writes in first person) ===");
  lines.push(`Name: ${r.fullName}`);
  lines.push(`Title: ${r.title}`);
  lines.push(`Organization: ${r.organization}`);
  if (r.country) lines.push(`Country: ${r.country}`);
  if (r.degree) lines.push(`Highest degree: ${r.degree}`);
  if (r.fieldOfExpertise) lines.push(`Field of expertise: ${r.fieldOfExpertise}`);
  lines.push(`Worked directly with the applicant: ${r.workedTogether ? "YES" : "NO (independent — must NOT claim first-hand collaboration)"}`);
  if (r.sharedOrganization) lines.push(`Shared organization: ${r.sharedOrganization}`);
  if (r.sharedPeriod) lines.push(`Shared period: ${r.sharedPeriod}`);
  if (ctx.contributions.length) {
    lines.push("Contributions this referee can speak to:");
    for (const c of ctx.contributions) lines.push(`  - ${c.type}: ${c.details}`);
  }

  lines.push("\n=== MAPPED PROJECTS ===");
  if (!ctx.projects.length) lines.push("(none mapped)");
  ctx.projects.forEach((p, i) => {
    lines.push(`\n[Project ${i + 1}] ${p.title}`);
    if (p.organization) lines.push(`Organization: ${p.organization}`);
    if (p.role) lines.push(`Applicant's role: ${p.role}`);
    if (p.timeline) lines.push(`Timeline: ${p.timeline}`);
    if (p.employmentType) lines.push(`Employment type: ${p.employmentType}`);
    if (p.criticality) lines.push(`Criticality: ${p.criticality}`);
    for (const s of p.sections) lines.push(`${s.label}: ${s.value}`);
    if (p.attestationNotes) lines.push(`What this referee can attest to on this project: ${p.attestationNotes}`);
  });

  lines.push("\n=== MAPPED EVIDENCE ===");
  if (!ctx.evidence.length) lines.push("(none mapped)");
  ctx.evidence.forEach((e, i) => {
    lines.push(`\n[Evidence ${i + 1}] ${e.displayLabel}  (criterion: ${e.criterion})`);
    if (e.attestationNotes) lines.push(`What this referee can attest to: ${e.attestationNotes}`);
    if (e.extractedText) lines.push(`Extracted content:\n${e.extractedText}`);
    else lines.push(e.extractionFailed ? "(file text could not be extracted — rely on the label and notes above)" : "(no extractable text)");
  });

  return lines.join("\n");
}
