/**
 * evidenceRegistry.ts — Pinnacle³
 *
 * Step 3 — Evidence registry listing + referee→(projects, evidence) mapping.
 *
 * Dual-auth (X-Staff-Token OR client Bearer JWT), following the referee/projects
 * precedent. Clients are scoped to their own case; staff act on any case with full
 * parity. Mapping writes reuse the Step 2 lock guard (403 when the referee is locked).
 *
 * GET /cases/:caseId/evidence-files     — synced (throttled), grouped by criterion
 * GET /evidence-files/:id/download      — proxy stream (403 on staff-only for clients)
 * GET /referees/:id/mappings            — current project + evidence mappings
 * PUT /referees/:id/mappings            — full replace (projects, evidence, shared ctx)
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  caseFoldersTable,
  caseFolderItemsTable,
  casePetitionSetupTable,
  refereesTable,
  caseProjectsTable,
  refereeProjectsTable,
  evidenceGroupsTable,
  refereeEvidenceGroupsTable,
  projectDocumentsTable,
  referenceLettersTable,
} from "@workspace/db";
import { downloadDriveFile } from "../services/driveService";
import {
  syncCaseEvidence,
  getEvidenceSubtreeFolders,
  criterionKeyForFolderName,
  criterionDisplayName,
} from "../services/evidenceSyncService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// ─── Auth helpers (mirror referee/projects modules) ──────────────────────────────

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) requireStaffAuth(req, res, next);
  else void requireClientAuth(req, res, next);
}

async function authorizeCase(
  req: AugmentedRequest,
  res: Response,
  caseId: number,
): Promise<typeof casePetitionSetupTable.$inferSelect | null> {
  if (isNaN(caseId)) {
    res.status(400).json({ error: "Invalid caseId" });
    return null;
  }
  const [caseRecord] = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, caseId))
    .limit(1);
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return null;
  }
  if (req.clientUser && caseRecord.profileId !== req.clientUser.id) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return caseRecord;
}

async function loadAuthorizedReferee(
  req: AugmentedRequest,
  res: Response,
  refereeId: number,
): Promise<typeof refereesTable.$inferSelect | null> {
  if (isNaN(refereeId)) {
    res.status(400).json({ error: "Invalid referee id" });
    return null;
  }
  const [referee] = await db
    .select()
    .from(refereesTable)
    .where(eq(refereesTable.id, refereeId))
    .limit(1);
  if (!referee) {
    res.status(404).json({ error: "Referee not found" });
    return null;
  }
  const caseRecord = await authorizeCase(req, res, referee.caseId);
  if (!caseRecord) return null;
  return referee;
}

function isStaff(req: AugmentedRequest): boolean {
  return !!req.staffUser && !req.clientUser;
}

// Drive file ids already tracked by other modules (CVs, reference letters, project
// docs) — excluded from the evidence registry so they are never double-registered.
async function trackedElsewhereDriveIds(caseId: number): Promise<Set<string>> {
  const ids = new Set<string>();

  const cvRows = await db
    .select({ cv: refereesTable.cvDriveFileId })
    .from(refereesTable)
    .where(eq(refereesTable.caseId, caseId));
  for (const r of cvRows) if (r.cv) ids.add(r.cv);

  const letterRows = await db
    .select({ fid: referenceLettersTable.driveFileId })
    .from(referenceLettersTable)
    .innerJoin(refereesTable, eq(refereesTable.id, referenceLettersTable.refereeId))
    .where(eq(refereesTable.caseId, caseId));
  for (const r of letterRows) if (r.fid) ids.add(r.fid);

  const docRows = await db
    .select({ fid: projectDocumentsTable.driveFileId })
    .from(projectDocumentsTable)
    .innerJoin(caseProjectsTable, eq(caseProjectsTable.id, projectDocumentsTable.projectId))
    .where(eq(caseProjectsTable.caseId, caseId));
  for (const r of docRows) if (r.fid) ids.add(r.fid);

  return ids;
}

// ─── Evidence listing ────────────────────────────────────────────────────────────

router.get(
  "/cases/:caseId/evidence-files",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const force = req.query.refresh === "1" || req.query.refresh === "true";
    const syncResult = await syncCaseEvidence(caseId, { force });

    const subtree = await getEvidenceSubtreeFolders(caseId);
    const folderMeta = new Map(
      subtree.map((f) => [f.id, { staffOnly: f.staffOnly, criterion: criterionKeyForFolderName(f.name) }]),
    );
    const folderIds = subtree.map((f) => f.id);

    const staff = isStaff(aug);
    const skip = await trackedElsewhereDriveIds(caseId);

    const items =
      folderIds.length === 0
        ? []
        : await db
            .select()
            .from(caseFolderItemsTable)
            .where(
              and(
                inArray(caseFolderItemsTable.caseFolderId, folderIds),
                eq(caseFolderItemsTable.isDeletedInDrive, false),
              ),
            );

    // Build criterion groups (only non-empty), excluding tracked-elsewhere files
    // and (for clients) staff-only files.
    const groups = new Map<string, { criterion: string; label: string; staffOnly: boolean; files: unknown[] }>();
    for (const it of items) {
      if (skip.has(it.driveId)) continue;
      const meta = folderMeta.get(it.caseFolderId);
      const staffOnly = meta?.staffOnly ?? false;
      if (staffOnly && !staff) continue; // clients never see staff-only
      const criterion = it.criterionFolder ?? meta?.criterion ?? "unclassified";
      if (!groups.has(criterion)) {
        groups.set(criterion, {
          criterion,
          label: criterionDisplayName(criterion),
          staffOnly: false,
          files: [],
        });
      }
      groups.get(criterion)!.files.push({
        id: it.id,
        fileName: it.name,
        mimeType: it.mimeType,
        driveUrl: it.driveUrl,
        criterion,
        isStaffOnly: staffOnly,
        addedBySource: it.addedBySource,
      });
    }

    // Stable order: known criteria first (unclassified last), then by label.
    const ordered = [...groups.values()].sort((a, b) => {
      if (a.criterion === "unclassified") return 1;
      if (b.criterion === "unclassified") return -1;
      return a.label.localeCompare(b.label);
    });

    res.json({
      groups: ordered,
      syncedAt: syncResult.syncedAt,
      synced: syncResult.synced,
    });
  },
);

// ─── Evidence download (proxy; 403 on staff-only for clients) ────────────────────

router.get(
  "/evidence-files/:id/download",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid file id" });
      return;
    }
    const [row] = await db
      .select({
        item: caseFolderItemsTable,
        folderStaffOnly: caseFoldersTable.staffOnly,
        caseId: caseFoldersTable.caseId,
      })
      .from(caseFolderItemsTable)
      .innerJoin(caseFoldersTable, eq(caseFoldersTable.id, caseFolderItemsTable.caseFolderId))
      .where(eq(caseFolderItemsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const caseRecord = await authorizeCase(aug, res, row.caseId);
    if (!caseRecord) return;

    if (row.folderStaffOnly && !isStaff(aug)) {
      res.status(403).json({ error: "This file is staff-only" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await downloadDriveFile(row.item.driveId);
    } catch (err) {
      logger.error({ err, id }, "[evidence] download failed");
      res.status(502).json({ error: "Could not retrieve the file from storage" });
      return;
    }
    res.setHeader("Content-Type", row.item.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", attachmentDisposition(row.item.name));
    res.end(buffer);
  },
);

// ─── Referee mappings — serialization ────────────────────────────────────────────

async function mappingsFor(referee: typeof refereesTable.$inferSelect) {
  const projects = await db
    .select({
      projectId: refereeProjectsTable.projectId,
      attestationNotes: refereeProjectsTable.attestationNotes,
      title: caseProjectsTable.title,
      organization: caseProjectsTable.organization,
    })
    .from(refereeProjectsTable)
    .innerJoin(caseProjectsTable, eq(caseProjectsTable.id, refereeProjectsTable.projectId))
    .where(eq(refereeProjectsTable.refereeId, referee.id));

  const groups = await db
    .select({
      evidenceGroupId: refereeEvidenceGroupsTable.evidenceGroupId,
      attestationNotes: refereeEvidenceGroupsTable.attestationNotes,
      name: evidenceGroupsTable.name,
      description: evidenceGroupsTable.description,
      criterion: evidenceGroupsTable.criterionFolder,
    })
    .from(refereeEvidenceGroupsTable)
    .innerJoin(evidenceGroupsTable, eq(evidenceGroupsTable.id, refereeEvidenceGroupsTable.evidenceGroupId))
    .where(eq(refereeEvidenceGroupsTable.refereeId, referee.id));

  // Member counts for the mapped groups.
  const countByGroup = new Map<number, number>();
  if (groups.length > 0) {
    const rows = await db
      .select({ groupId: caseFolderItemsTable.groupId, n: sql<number>`count(*)::int` })
      .from(caseFolderItemsTable)
      .where(inArray(caseFolderItemsTable.groupId, groups.map((g) => g.evidenceGroupId)))
      .groupBy(caseFolderItemsTable.groupId);
    for (const r of rows) if (r.groupId != null) countByGroup.set(r.groupId, r.n);
  }

  return {
    sharedOrganization: referee.sharedOrganization,
    sharedPeriod: referee.sharedPeriod,
    projects,
    groups: groups.map((g) => ({ ...g, memberCount: countByGroup.get(g.evidenceGroupId) ?? 0 })),
  };
}

router.get(
  "/referees/:id/mappings",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;
    res.json({ mappings: await mappingsFor(referee) });
  },
);

// Per-referee mapping counts for a case (summary indicators) — one request.
router.get(
  "/cases/:caseId/referee-mapping-counts",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;

    const projCounts = await db
      .select({ refereeId: refereeProjectsTable.refereeId, n: sql<number>`count(*)::int` })
      .from(refereeProjectsTable)
      .innerJoin(refereesTable, eq(refereesTable.id, refereeProjectsTable.refereeId))
      .where(eq(refereesTable.caseId, caseId))
      .groupBy(refereeProjectsTable.refereeId);

    const evCounts = await db
      .select({ refereeId: refereeEvidenceGroupsTable.refereeId, n: sql<number>`count(*)::int` })
      .from(refereeEvidenceGroupsTable)
      .innerJoin(refereesTable, eq(refereesTable.id, refereeEvidenceGroupsTable.refereeId))
      .where(eq(refereesTable.caseId, caseId))
      .groupBy(refereeEvidenceGroupsTable.refereeId);

    const map = new Map<number, { refereeId: number; projects: number; evidence: number }>();
    for (const r of projCounts) map.set(r.refereeId, { refereeId: r.refereeId, projects: r.n, evidence: 0 });
    for (const r of evCounts) {
      const cur = map.get(r.refereeId) ?? { refereeId: r.refereeId, projects: 0, evidence: 0 };
      cur.evidence = r.n;
      map.set(r.refereeId, cur);
    }
    res.json({ counts: [...map.values()] });
  },
);

// ─── Referee mappings — full replace ─────────────────────────────────────────────

const MappingInput = z.object({
  sharedOrganization: z.string().trim().nullish(),
  sharedPeriod: z.string().trim().nullish(),
  projects: z
    .array(
      z.object({
        projectId: z.number().int().positive(),
        attestationNotes: z.string().trim().nullish(),
      }),
    )
    .default([]),
  // Confirmed evidence groups the referee can attest to.
  groups: z
    .array(
      z.object({
        evidenceGroupId: z.number().int().positive(),
        attestationNotes: z.string().trim().nullish(),
      }),
    )
    .default([]),
  // Individually selected UNGROUPED files — each auto-wrapped into a confirmed
  // singleton group named from the label (one mapping model downstream).
  individualFiles: z
    .array(
      z.object({
        fileId: z.number().int().positive(),
        label: z.string().trim().min(1, "A label is required for each selected file"),
        attestationNotes: z.string().trim().nullish(),
      }),
    )
    .default([]),
});

router.put(
  "/referees/:id/mappings",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    // Reuse the Step 2 lock guard — staff must unlock first, no silent bypass.
    if (referee.isLocked) {
      res.status(403).json({
        error: "This referee is locked because the reference letter was confirmed. Unlock it first to make changes.",
        locked: true,
      });
      return;
    }

    const parsed = MappingInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }
    const data = parsed.data;
    const createdBy = isStaff(aug) ? "staff" : "client";

    // Dedupe.
    const projectMap = new Map(data.projects.map((p) => [p.projectId, p]));
    const groupMap = new Map(data.groups.map((g) => [g.evidenceGroupId, g]));
    const fileMap = new Map(data.individualFiles.map((f) => [f.fileId, f]));
    const projectIds = [...projectMap.keys()];
    const groupIds = [...groupMap.keys()];
    const fileIds = [...fileMap.keys()];

    // Validate projects belong to the case.
    if (projectIds.length > 0) {
      const valid = await db
        .select({ id: caseProjectsTable.id })
        .from(caseProjectsTable)
        .where(and(eq(caseProjectsTable.caseId, referee.caseId), inArray(caseProjectsTable.id, projectIds)));
      if (valid.length !== projectIds.length) {
        res.status(400).json({ error: "One or more projects do not belong to this case" });
        return;
      }
    }

    // Validate groups: confirmed + in this case.
    if (groupIds.length > 0) {
      const valid = await db
        .select({ id: evidenceGroupsTable.id })
        .from(evidenceGroupsTable)
        .where(and(
          eq(evidenceGroupsTable.caseId, referee.caseId),
          eq(evidenceGroupsTable.status, "confirmed"),
          inArray(evidenceGroupsTable.id, groupIds),
        ));
      if (valid.length !== groupIds.length) {
        res.status(400).json({ error: "One or more evidence groups are invalid or not confirmed for this case" });
        return;
      }
    }

    // Validate individual files: ungrouped, in case, not staff-only, not deleted.
    const fileMeta = new Map<number, { criterion: string | null }>();
    if (fileIds.length > 0) {
      const valid = await db
        .select({
          id: caseFolderItemsTable.id,
          caseId: caseFoldersTable.caseId,
          staffOnly: caseFoldersTable.staffOnly,
          deleted: caseFolderItemsTable.isDeletedInDrive,
          groupId: caseFolderItemsTable.groupId,
          criterion: caseFolderItemsTable.criterionFolder,
        })
        .from(caseFolderItemsTable)
        .innerJoin(caseFoldersTable, eq(caseFoldersTable.id, caseFolderItemsTable.caseFolderId))
        .where(inArray(caseFolderItemsTable.id, fileIds));
      const ok = valid.filter((v) => v.caseId === referee.caseId && !v.staffOnly && !v.deleted && v.groupId == null);
      if (ok.length !== fileIds.length) {
        res.status(400).json({ error: "One or more files are invalid, staff-only, already grouped, or not in this case" });
        return;
      }
      for (const v of ok) fileMeta.set(v.id, { criterion: v.criterion });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(refereesTable)
        .set({
          sharedOrganization: data.sharedOrganization?.trim() || null,
          sharedPeriod: data.sharedPeriod?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(refereesTable.id, refereeId));

      await tx.delete(refereeProjectsTable).where(eq(refereeProjectsTable.refereeId, refereeId));
      if (projectMap.size > 0) {
        await tx.insert(refereeProjectsTable).values(
          [...projectMap.values()].map((p) => ({
            refereeId,
            projectId: p.projectId,
            attestationNotes: p.attestationNotes?.trim() || null,
          })),
        );
      }

      // Auto-wrap each individually selected file into a confirmed singleton group.
      const singletonMappings: { groupId: number; notes: string | null }[] = [];
      for (const f of fileMap.values()) {
        const [group] = await tx
          .insert(evidenceGroupsTable)
          .values({
            caseId: referee.caseId,
            name: f.label.trim().slice(0, 200),
            criterionFolder: fileMeta.get(f.fileId)?.criterion ?? null,
            createdBy,
            status: "confirmed",
          })
          .returning();
        await tx.update(caseFolderItemsTable).set({ groupId: group.id }).where(eq(caseFolderItemsTable.id, f.fileId));
        singletonMappings.push({ groupId: group.id, notes: f.attestationNotes?.trim() || null });
      }

      // Replace the referee's group mappings with groups[] + the new singletons.
      await tx.delete(refereeEvidenceGroupsTable).where(eq(refereeEvidenceGroupsTable.refereeId, refereeId));
      const rows = [
        ...[...groupMap.values()].map((g) => ({ refereeId, evidenceGroupId: g.evidenceGroupId, attestationNotes: g.attestationNotes?.trim() || null })),
        ...singletonMappings.map((s) => ({ refereeId, evidenceGroupId: s.groupId, attestationNotes: s.notes })),
      ];
      if (rows.length > 0) await tx.insert(refereeEvidenceGroupsTable).values(rows);
    });

    const [fresh] = await db
      .select()
      .from(refereesTable)
      .where(eq(refereesTable.id, refereeId))
      .limit(1);
    logger.info(
      { refereeId, projects: projectMap.size, groups: groupMap.size, individualFiles: fileMap.size, by: createdBy },
      "[evidence] referee mappings saved",
    );
    res.json({ mappings: await mappingsFor(fresh) });
  },
);

export default router;
