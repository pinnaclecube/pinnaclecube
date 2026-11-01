/**
 * planner.ts — Evidence Package module, stage 5 (spec section 4 stage 5).
 *
 * Deterministic (NO AI). From the confirmed groups' summaries it produces the
 * document plan — one sub_exhibit per group, one criterion document per criterion
 * with >=1 group, one index, one final_merits — assigns exhibit codes (ordered
 * within a criterion by group sortDate), computes satisfiability + the
 * incomplete_group flag, and the per-criterion temporal spread. planPackage
 * persists the plan as exhibit_documents rows (renderStatus='pending').
 *
 * buildPlan is pure (group summaries -> plan) so it can be unit-checked offline.
 */

import { and, eq } from "drizzle-orm";
import { db, exhibitDocumentsTable, casePetitionSetupTable } from "@workspace/db";
import {
  PACKAGE_TEMPLATES, subExhibitCode, criterionCode, criterionByKey,
  INDEX_CODE, FINAL_MERITS_CODE, type DocRole,
} from "@workspace/shared";
import { summarizePackageGroups, type GroupSummary } from "./classifier";
import { logger } from "../../lib/logger";

export interface PlanFlag { kind: string; message: string; severity: "info" | "warning" | "error" }

export interface PlannedDocument {
  role: DocRole;
  exhibitCode: string;
  title: string;
  criterion: string | null;
  evidenceGroupId: number | null;
  feedingFileCount: number;
  satisfiable: boolean;
  sortDate: Date | null;
  missingTypes: string[];
  flags: PlanFlag[];
}

export interface CriterionSpread {
  criterion: string;
  letter: string;
  groups: number;
  files: number;
  earliest: Date | null;
  latest: Date | null;
  spanMonths: number | null;
  singleYearCluster: boolean; // all dated evidence in one calendar year — weakens "sustained"
}

export interface PackagePlan {
  caseSetupId: number;
  packageVersion: number;
  documents: PlannedDocument[];
  temporalSpread: CriterionSpread[];
}

const MIN_GROUPS_FOR_CRITERION = 1;

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "document";
export function plannedFileName(code: string, title: string): string {
  return `${code} - ${slug(title)}.docx`;
}

function orderGroups(groups: GroupSummary[]): GroupSummary[] {
  // sortDate ascending (nulls last), then title, then groupId — stable + deterministic.
  return [...groups].sort((a, b) => {
    const at = a.sortDate ? a.sortDate.getTime() : Infinity;
    const bt = b.sortDate ? b.sortDate.getTime() : Infinity;
    if (at !== bt) return at - bt;
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    return a.groupId - b.groupId;
  });
}

function spreadFor(criterion: string, letter: string, groups: GroupSummary[]): CriterionSpread {
  const dates = groups.map((g) => g.sortDate).filter((d): d is Date => d != null);
  const files = groups.reduce((n, g) => n + g.fileCount, 0);
  if (dates.length === 0) {
    return { criterion, letter, groups: groups.length, files, earliest: null, latest: null, spanMonths: null, singleYearCluster: false };
  }
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
  const spanMonths = Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const singleYearCluster = earliest.getUTCFullYear() === latest.getUTCFullYear();
  return { criterion, letter, groups: groups.length, files, earliest, latest, spanMonths, singleYearCluster };
}

/** Pure: build the document plan + temporal spread from the group summaries. */
export function buildPlan(caseSetupId: number, packageVersion: number, groupSummaries: GroupSummary[]): PackagePlan {
  const documents: PlannedDocument[] = [];
  const temporalSpread: CriterionSpread[] = [];

  // Group the summaries by criterion, keep template (A..J) order; unknown last.
  const order = PACKAGE_TEMPLATES.EB1A.criteria.map((c) => c.key);
  const byCriterion = new Map<string, GroupSummary[]>();
  for (const g of groupSummaries) {
    const key = g.criterion ?? "unclassified";
    (byCriterion.get(key) ?? byCriterion.set(key, []).get(key)!).push(g);
  }
  const keys = [...byCriterion.keys()].sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  let anyCriterionSatisfiable = false;

  for (const key of keys) {
    const crit = criterionByKey(key);
    const letter = crit?.letter ?? "Z";
    const name = crit?.name ?? "Unclassified";
    const groups = orderGroups(byCriterion.get(key)!);

    let criterionSatisfiable = false;
    groups.forEach((g, i) => {
      const code = subExhibitCode(key, i + 1);
      const satisfiable = g.fileCount >= 1; // has >=1 renderable document
      if (satisfiable) criterionSatisfiable = true;
      const flags: PlanFlag[] = [];
      if (g.missingTypes.length > 0) {
        flags.push({ kind: "incomplete_group", message: `missing evidence types: ${g.missingTypes.join(", ")}`, severity: "warning" });
      }
      if (!satisfiable) flags.push({ kind: "no_renderable_files", message: "group has no files to render", severity: "error" });
      documents.push({
        role: "sub_exhibit", exhibitCode: code, title: g.title, criterion: key,
        evidenceGroupId: g.groupId, feedingFileCount: g.fileCount, satisfiable,
        sortDate: g.sortDate, missingTypes: g.missingTypes, flags,
      });
    });

    const spread = spreadFor(key, letter, groups);
    temporalSpread.push(spread);

    // Criterion document (narrative) — depends on its sub_exhibits.
    const critSatisfiable = criterionSatisfiable && groups.length >= MIN_GROUPS_FOR_CRITERION;
    if (critSatisfiable) anyCriterionSatisfiable = true;
    const critFlags: PlanFlag[] = [];
    if (spread.singleYearCluster && groups.length > 1) {
      critFlags.push({ kind: "temporal_cluster", message: "all evidence clusters within a single calendar year", severity: "warning" });
    }
    if (!critSatisfiable) critFlags.push({ kind: "criterion_unsatisfiable", message: "no satisfiable sub-exhibits", severity: "error" });
    documents.push({
      role: "criterion", exhibitCode: criterionCode(key), title: name, criterion: key,
      evidenceGroupId: null, feedingFileCount: spread.files, satisfiable: critSatisfiable,
      sortDate: spread.earliest, missingTypes: [], flags: critFlags,
    });
  }

  // Index + final merits (final merits generated last; depends on everything).
  documents.push({
    role: "index", exhibitCode: INDEX_CODE, title: "Index of Exhibits", criterion: null,
    evidenceGroupId: null, feedingFileCount: 0, satisfiable: true, sortDate: null, missingTypes: [], flags: [],
  });
  documents.push({
    role: "final_merits", exhibitCode: FINAL_MERITS_CODE, title: "Final Merits Brief", criterion: null,
    evidenceGroupId: null, feedingFileCount: 0, satisfiable: anyCriterionSatisfiable, sortDate: null, missingTypes: [],
    flags: anyCriterionSatisfiable ? [] : [{ kind: "no_satisfiable_criteria", message: "no criterion is satisfiable", severity: "error" }],
  });

  return { caseSetupId, packageVersion, documents, temporalSpread };
}

/** Reads confirmed-group summaries, builds the plan, and persists planned
 * exhibit_documents rows (renderStatus='pending'). Re-planning clears prior
 * un-rendered rows for this version. */
export async function planPackage(caseSetupId: number, packageVersion: number): Promise<PackagePlan> {
  const [caseRow] = await db
    .select({ profileId: casePetitionSetupTable.profileId })
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseSetupId))
    .limit(1);
  if (!caseRow) throw new Error(`case_setup ${caseSetupId} not found`);

  const summaries = await summarizePackageGroups(caseSetupId, packageVersion);
  const plan = buildPlan(caseSetupId, packageVersion, summaries);

  await db.transaction(async (tx) => {
    // Clear prior pending plan rows for this version (idempotent re-plan); never
    // touch rows that are already rendered/approved.
    await tx.delete(exhibitDocumentsTable).where(and(
      eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
      eq(exhibitDocumentsTable.packageVersion, packageVersion),
      eq(exhibitDocumentsTable.renderStatus, "pending"),
    ));
    if (plan.documents.length > 0) {
      await tx.insert(exhibitDocumentsTable).values(plan.documents.map((d) => ({
        caseSetupId,
        profileId: caseRow.profileId,
        documentType: d.role,
        role: d.role,
        exhibitCode: d.exhibitCode,
        criteriaCode: d.criterion,
        fileName: plannedFileName(d.exhibitCode, d.title),
        exhibitLabel: d.title,
        packageVersion,
        evidenceGroupId: d.evidenceGroupId,
        sortDate: d.sortDate,
        missingTypes: d.missingTypes,
        flags: d.flags,
        renderStatus: "pending",
      })));
    }
  });

  logger.info(
    { caseSetupId, packageVersion, documents: plan.documents.length },
    "[package/planner] plan persisted",
  );
  return plan;
}
