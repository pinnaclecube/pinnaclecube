import { eq, inArray, max } from "drizzle-orm";
import {
  db,
  casePetitionSetupTable,
  petitionPackageTable,
  petitionCriteriaExhibitsTable,
  criteriaAssessmentsTable,
  exhibitDocumentsTable,
  caseFoldersTable,
  clientActionItemsTable,
  profilesTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

export interface ReadinessScore {
  total: number;
  band: "getting_started" | "in_progress" | "building" | "nearly_ready" | "filing_ready";
  bandLabel: string;
  bandColor: string;
  components: {
    driveConnected: number;
    assessmentsComplete: number;
    evidenceStrength: number;
    rfeRiskPenalty: number;
    exhibitsGenerated: number;
    packageDocuments: number;
    publishedToClient: number;
  };
  details: {
    totalCriteria: number;
    assessedCriteria: number;
    strongCriteria: number;
    borderlineCriteria: number;
    insufficientCriteria: number;
    highRfeCriteria: number;
    proceedCriteria: number;
    generatedExhibits: number;
    publishedExhibits: number;
    coverLetterDone: boolean;
    personalDeclarationDone: boolean;
    fieldBriefDone: boolean;
    recoTemplatesDone: boolean;
    pendingTasks: number;
    completedTasks: number;
    driveConnected: boolean;
  };
  nextActions: string[];
}

export interface CaseReadinessSummary {
  profileId: number;
  caseSetupId: number;
  clientName: string;
  clientEmail: string;
  visaPath: string;
  score: ReadinessScore;
  lastActivity: string | null;
}

function getBand(total: number): Pick<ReadinessScore, "band" | "bandLabel" | "bandColor"> {
  if (total <= 20) return { band: "getting_started", bandLabel: "Getting Started", bandColor: "#94A3B8" };
  if (total <= 40) return { band: "in_progress", bandLabel: "In Progress", bandColor: "#EF4444" };
  if (total <= 60) return { band: "building", bandLabel: "Building", bandColor: "#F59E0B" };
  if (total <= 80) return { band: "nearly_ready", bandLabel: "Nearly Ready", bandColor: "#3B82F6" };
  return { band: "filing_ready", bandLabel: "Filing Ready", bandColor: "#22C55E" };
}

export async function calculateReadinessScore(caseSetupId: number): Promise<ReadinessScore> {
  const caseRows = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseSetupId))
    .limit(1);

  const caseSetup = caseRows[0];
  if (!caseSetup) throw new Error(`Case setup ${caseSetupId} not found`);
  const profileId = caseSetup.profileId;

  const [criteria, assessments, exhibitDocs, pkgRows, folders, actionItems] = await Promise.all([
    db.select().from(petitionCriteriaExhibitsTable).where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId)),
    db.select().from(criteriaAssessmentsTable).where(eq(criteriaAssessmentsTable.caseSetupId, caseSetupId)),
    db.select().from(exhibitDocumentsTable).where(eq(exhibitDocumentsTable.caseSetupId, caseSetupId)),
    db.select().from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, caseSetupId)).limit(1),
    db.select().from(caseFoldersTable).where(eq(caseFoldersTable.caseId, caseSetupId)),
    db.select().from(clientActionItemsTable).where(eq(clientActionItemsTable.profileId, profileId)),
  ]);

  const pkg = pkgRows[0] ?? null;
  const totalCriteria = criteria.length;

  const driveConnected = folders.some((f) => f.driveId != null);

  const assessedCriteria = assessments.filter((a) => a.assessedAt != null).length;
  const strongCriteria = assessments.filter((a) => a.recommendation === "STRONG").length;
  const borderlineCriteria = assessments.filter((a) => a.recommendation === "BORDERLINE").length;
  const insufficientCriteria = assessments.filter(
    (a) => a.recommendation === "INSUFFICIENT" || a.recommendation === "WEAK",
  ).length;
  const highRfeCriteria = assessments.filter((a) => a.rfeRisk === "HIGH").length;
  const proceedCriteria = assessments.filter((a) => a.finalDecision === "proceed").length;

  const generatedExhibits = exhibitDocs.filter((d) => d.documentType === "main_document").length;
  const publishedExhibits = exhibitDocs.filter((d) => d.publishedToClient === true).length;

  const coverLetterDone = pkg?.coverLetterDriveFileId != null;
  const personalDeclarationDone = pkg?.personalDeclarationDriveFileId != null;
  const fieldBriefDone = pkg?.fieldBriefDriveFileId != null;
  const recoTemplatesDone = pkg?.recoTemplatesStatus === "draft";

  const pendingTasks = actionItems.filter((a) => a.status === "sent").length;
  const completedTasks = actionItems.filter((a) => a.status === "completed").length;

  // ── Scoring ───────────────────────────────────────────────────────────────

  const driveConnectedScore = driveConnected ? 10 : 0;
  const assessmentsCompleteScore = totalCriteria > 0 ? (assessedCriteria / totalCriteria) * 20 : 0;
  const evidenceStrengthScore =
    totalCriteria > 0 ? ((strongCriteria * 1.0 + borderlineCriteria * 0.5) / totalCriteria) * 15 : 0;
  const rfeRiskPenalty = -Math.min(highRfeCriteria * 2, 10);
  const exhibitsGeneratedScore = totalCriteria > 0 ? (generatedExhibits / totalCriteria) * 20 : 0;
  const completedPackageDocs = [coverLetterDone, personalDeclarationDone, fieldBriefDone, recoTemplatesDone].filter(
    Boolean,
  ).length;
  const packageDocumentsScore = (completedPackageDocs / 4) * 15;
  const publishedToClientScore = publishedExhibits > 0 ? 10 : 0;

  const rawTotal =
    driveConnectedScore +
    assessmentsCompleteScore +
    evidenceStrengthScore +
    rfeRiskPenalty +
    exhibitsGeneratedScore +
    packageDocumentsScore +
    publishedToClientScore;

  const total = Math.min(100, Math.max(0, Math.round(rawTotal)));

  // ── Next Actions ──────────────────────────────────────────────────────────

  const nextActions: string[] = [];
  if (assessedCriteria < totalCriteria) {
    nextActions.push(`Run assessments for ${totalCriteria - assessedCriteria} unassessed criteria`);
  }
  if (highRfeCriteria > 0) {
    nextActions.push(`Address HIGH RFE risk on ${highRfeCriteria} ${highRfeCriteria === 1 ? "criterion" : "criteria"}`);
  }
  if (generatedExhibits < proceedCriteria) {
    nextActions.push(`Generate exhibits for ${proceedCriteria - generatedExhibits} approved criteria`);
  }
  if (!coverLetterDone) nextActions.push("Generate cover letter");
  if (!personalDeclarationDone) nextActions.push("Generate personal declaration");
  if (publishedExhibits === 0 && generatedExhibits > 0) {
    nextActions.push(`Publish ${generatedExhibits} ready ${generatedExhibits === 1 ? "exhibit" : "exhibits"} to client`);
  }
  if (pendingTasks > 0) {
    nextActions.push(`Client has ${pendingTasks} pending ${pendingTasks === 1 ? "task" : "tasks"} awaiting completion`);
  }

  // ── Write back petition_readiness ─────────────────────────────────────────

  if (pkg) {
    try {
      await db
        .update(petitionPackageTable)
        .set({ petitionReadiness: total })
        .where(eq(petitionPackageTable.caseSetupId, caseSetupId));
    } catch (err) {
      logger.warn({ err, caseSetupId }, "Failed to write petitionReadiness to petition_package");
    }
  }

  return {
    total,
    ...getBand(total),
    components: {
      driveConnected: driveConnectedScore,
      assessmentsComplete: Math.round(assessmentsCompleteScore * 10) / 10,
      evidenceStrength: Math.round(evidenceStrengthScore * 10) / 10,
      rfeRiskPenalty,
      exhibitsGenerated: Math.round(exhibitsGeneratedScore * 10) / 10,
      packageDocuments: Math.round(packageDocumentsScore * 10) / 10,
      publishedToClient: publishedToClientScore,
    },
    details: {
      totalCriteria,
      assessedCriteria,
      strongCriteria,
      borderlineCriteria,
      insufficientCriteria,
      highRfeCriteria,
      proceedCriteria,
      generatedExhibits,
      publishedExhibits,
      coverLetterDone,
      personalDeclarationDone,
      fieldBriefDone,
      recoTemplatesDone,
      pendingTasks,
      completedTasks,
      driveConnected,
    },
    nextActions: nextActions.slice(0, 5),
  };
}

export async function getAllCasesReadiness(): Promise<CaseReadinessSummary[]> {
  const cases = await db
    .select({
      id: casePetitionSetupTable.id,
      profileId: casePetitionSetupTable.profileId,
      visaPath: casePetitionSetupTable.visaPath,
      updatedAt: casePetitionSetupTable.updatedAt,
    })
    .from(casePetitionSetupTable);

  if (cases.length === 0) return [];

  const profileIds = cases.map((c) => c.profileId);

  const [profiles, assessmentMax, exhibitMax] = await Promise.all([
    db
      .select({ id: profilesTable.id, name: profilesTable.name, email: profilesTable.email })
      .from(profilesTable)
      .where(inArray(profilesTable.id, profileIds)),
    db
      .select({
        caseSetupId: criteriaAssessmentsTable.caseSetupId,
        maxAt: max(criteriaAssessmentsTable.assessedAt),
      })
      .from(criteriaAssessmentsTable)
      .groupBy(criteriaAssessmentsTable.caseSetupId),
    db
      .select({
        caseSetupId: exhibitDocumentsTable.caseSetupId,
        maxAt: max(exhibitDocumentsTable.generatedAt),
      })
      .from(exhibitDocumentsTable)
      .groupBy(exhibitDocumentsTable.caseSetupId),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const assessmentMaxMap = new Map(assessmentMax.map((r) => [r.caseSetupId, r.maxAt]));
  const exhibitMaxMap = new Map(exhibitMax.map((r) => [r.caseSetupId, r.maxAt]));

  const results = await Promise.allSettled(
    cases.map(async (c): Promise<CaseReadinessSummary> => {
      const profile = profileMap.get(c.profileId);
      const score = await calculateReadinessScore(c.id);

      const timestamps: number[] = [];
      if (c.updatedAt) timestamps.push(c.updatedAt.getTime());
      const aMax = assessmentMaxMap.get(c.id);
      if (aMax) timestamps.push(new Date(aMax).getTime());
      const eMax = exhibitMaxMap.get(c.id);
      if (eMax) timestamps.push(new Date(eMax).getTime());

      const lastActivity = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;

      return {
        profileId: c.profileId,
        caseSetupId: c.id,
        clientName: profile?.name ?? "Unknown",
        clientEmail: profile?.email ?? "",
        visaPath: c.visaPath,
        score,
        lastActivity,
      };
    }),
  );

  const summaries: CaseReadinessSummary[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      summaries.push(r.value);
    } else {
      logger.error({ err: r.reason }, "Failed to calculate readiness for a case");
    }
  }

  return summaries.sort((a, b) => a.score.total - b.score.total);
}
