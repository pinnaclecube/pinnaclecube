/**
 * evidenceGroups.ts — Pinnacle³
 *
 * Step 5 — evidence group curation (staff) + confirmed-group read (client).
 *
 * Dual-auth: GET is requireAnyAuth (client sees confirmed, non-staff-only groups +
 * ungrouped non-staff-only files); all curation (create/confirm/reject/edit/members/
 * dissolve/suggest + suggestion accept/reject) is requireStaffAuth.
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, and, inArray, isNull, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  casePetitionSetupTable,
  caseFoldersTable,
  caseFolderItemsTable,
  evidenceGroupsTable,
  evidenceGroupSuggestionsTable,
  refereeEvidenceGroupsTable,
  refereesTable,
  evidenceGroupingJobsTable,
} from "@workspace/db";
import {
  getEvidenceSubtreeFolders,
  criterionKeyForFolderName,
} from "../services/evidenceSyncService";
import { resetGroupingReview, reclassifyUnclassifiedGroups } from "../services/evidenceGroupingService";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) requireStaffAuth(req, res, next);
  else void requireClientAuth(req, res, next);
}
function isStaff(req: AugmentedRequest): boolean {
  return !!req.staffUser && !req.clientUser;
}

async function authorizeCase(req: AugmentedRequest, res: Response, caseId: number) {
  if (isNaN(caseId)) { res.status(400).json({ error: "Invalid caseId" }); return null; }
  const [c] = await db.select().from(casePetitionSetupTable).where(eq(casePetitionSetupTable.id, caseId)).limit(1);
  if (!c) { res.status(404).json({ error: "Case not found" }); return null; }
  if (req.clientUser && c.profileId !== req.clientUser.id) { res.status(403).json({ error: "Access denied" }); return null; }
  return c;
}

// Loads a group and authorizes the caller against its case (staff routes).
async function loadAuthorizedGroup(req: AugmentedRequest, res: Response, groupId: number) {
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group id" }); return null; }
  const [g] = await db.select().from(evidenceGroupsTable).where(eq(evidenceGroupsTable.id, groupId)).limit(1);
  if (!g) { res.status(404).json({ error: "Group not found" }); return null; }
  const c = await authorizeCase(req, res, g.caseId);
  if (!c) return null;
  return g;
}

// All non-deleted evidence files in the case's Evidence subtree, with staff-only.
async function loadCaseFiles(caseId: number) {
  const subtree = await getEvidenceSubtreeFolders(caseId);
  const meta = new Map(subtree.map((f) => [f.id, { staffOnly: f.staffOnly, criterion: criterionKeyForFolderName(f.name) }]));
  const folderIds = subtree.map((f) => f.id);
  const items = folderIds.length === 0 ? [] : await db
    .select()
    .from(caseFolderItemsTable)
    .where(and(inArray(caseFolderItemsTable.caseFolderId, folderIds), eq(caseFolderItemsTable.isDeletedInDrive, false)));
  return items.map((it) => {
    const m = meta.get(it.caseFolderId);
    return {
      id: it.id, fileName: it.name, mimeType: it.mimeType, driveUrl: it.driveUrl,
      groupId: it.groupId,
      criterion: it.criterionFolder ?? m?.criterion ?? "unclassified",
      isStaffOnly: m?.staffOnly ?? false,
    };
  });
}

// ─── GET — groups + ungrouped files ───────────────────────────────────────────────

router.get(
  "/cases/:caseId/evidence-groups",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    const caseRecord = await authorizeCase(aug, res, caseId);
    if (!caseRecord) return;
    const staff = isStaff(aug);

    const files = await loadCaseFiles(caseId);
    const fileById = new Map(files.map((f) => [f.id, f]));
    const groups = await db.select().from(evidenceGroupsTable).where(eq(evidenceGroupsTable.caseId, caseId));
    const groupIds = groups.map((g) => g.id);
    const suggestions = groupIds.length === 0 ? [] : await db
      .select()
      .from(evidenceGroupSuggestionsTable)
      .where(inArray(evidenceGroupSuggestionsTable.groupId, groupIds));

    const membersByGroup = new Map<number, typeof files>();
    for (const f of files) if (f.groupId != null) {
      const arr = membersByGroup.get(f.groupId) ?? []; arr.push(f); membersByGroup.set(f.groupId, arr);
    }
    const proposedByGroup = new Map<number, typeof files>();
    const addSuggestions: { id: number; groupId: number; file: typeof files[number] }[] = [];
    for (const s of suggestions) {
      const f = fileById.get(s.fileId);
      if (!f) continue;
      if (s.isAddToConfirmed) addSuggestions.push({ id: s.id, groupId: s.groupId, file: f });
      else { const arr = proposedByGroup.get(s.groupId) ?? []; arr.push(f); proposedByGroup.set(s.groupId, arr); }
    }

    const serializeMembers = (ms: typeof files) =>
      (staff ? ms : ms.filter((m) => !m.isStaffOnly)).map((m) => ({
        id: m.id, fileName: m.fileName, mimeType: m.mimeType, driveUrl: m.driveUrl, criterion: m.criterion, isStaffOnly: m.isStaffOnly,
      }));

    const confirmed = groups
      .filter((g) => g.status === "confirmed")
      .map((g) => ({
        id: g.id, name: g.name, description: g.description, criterion: g.criterionFolder, status: g.status,
        createdBy: g.createdBy, members: serializeMembers(membersByGroup.get(g.id) ?? []),
      }))
      .filter((g) => staff || g.members.length > 0); // client hides all-staff-only groups

    const ungrouped = serializeMembers(files.filter((f) => f.groupId == null));

    if (!staff) {
      res.json({ confirmed, ungrouped });
      return;
    }

    // Staff extras: suggestions + grouping job status.
    const suggested = groups
      .filter((g) => g.status === "suggested")
      .map((g) => ({
        id: g.id, name: g.name, description: g.description, criterion: g.criterionFolder, aiRationale: g.aiRationale,
        createdBy: g.createdBy, proposedMembers: serializeMembers(proposedByGroup.get(g.id) ?? []),
      }));
    const confirmedNameById = new Map(groups.map((g) => [g.id, g.name]));
    const addSuggestionsOut = addSuggestions.map((a) => ({
      id: a.id, groupId: a.groupId, groupName: confirmedNameById.get(a.groupId) ?? "", file: a.file,
    }));
    const [job] = await db
      .select({ id: evidenceGroupingJobsTable.id, status: evidenceGroupingJobsTable.status, newGroups: evidenceGroupingJobsTable.newGroups, addSuggestions: evidenceGroupingJobsTable.addSuggestions, error: evidenceGroupingJobsTable.error, createdAt: evidenceGroupingJobsTable.createdAt })
      .from(evidenceGroupingJobsTable)
      .where(eq(evidenceGroupingJobsTable.caseId, caseId))
      .orderBy(desc(evidenceGroupingJobsTable.createdAt))
      .limit(1);

    res.json({ confirmed, suggested, addSuggestions: addSuggestionsOut, ungrouped, groupingJob: job ?? null });
  },
);

// ─── Validation helper: file ids are ungrouped + in case + not deleted ────────────
async function assertUngroupedInCase(caseId: number, fileIds: number[], res: Response): Promise<boolean> {
  if (fileIds.length === 0) return true;
  const files = await loadCaseFiles(caseId);
  const ok = new Set(files.filter((f) => f.groupId == null).map((f) => f.id));
  const bad = fileIds.filter((id) => !ok.has(id));
  if (bad.length > 0) {
    res.status(400).json({ error: "Some files are not ungrouped files in this case", fileIds: bad });
    return false;
  }
  return true;
}

// ─── Manual create (staff) ─────────────────────────────────────────────────────────

const CreateInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullish(),
  criterionFolder: z.string().trim().nullish(),
  fileIds: z.array(z.number().int().positive()).default([]),
});

router.post(
  "/cases/:caseId/evidence-groups",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    if (!(await authorizeCase(aug, res, caseId))) return;
    const parsed = CreateInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }
    const fileIds = [...new Set(parsed.data.fileIds)];
    if (!(await assertUngroupedInCase(caseId, fileIds, res))) return;

    const group = await db.transaction(async (tx) => {
      const [g] = await tx.insert(evidenceGroupsTable).values({
        caseId, name: parsed.data.name, description: parsed.data.description?.trim() || null,
        criterionFolder: parsed.data.criterionFolder ?? null, createdBy: "staff", status: "confirmed",
      }).returning();
      if (fileIds.length > 0) {
        await tx.update(caseFolderItemsTable).set({ groupId: g.id }).where(inArray(caseFolderItemsTable.id, fileIds));
      }
      return g;
    });
    logger.info({ caseId, groupId: group.id, files: fileIds.length }, "[evidenceGroups] manual group created");
    res.status(201).json({ group });
  },
);

// ─── Confirm a suggested group (apply proposed membership) ─────────────────────────

router.post(
  "/evidence-groups/:id/confirm",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const group = await loadAuthorizedGroup(aug, res, parseInt(req.params.id as string, 10));
    if (!group) return;
    if (group.status !== "suggested") { res.status(409).json({ error: "Only suggested groups can be confirmed" }); return; }

    await db.transaction(async (tx) => {
      const sugg = await tx
        .select({ fileId: evidenceGroupSuggestionsTable.fileId })
        .from(evidenceGroupSuggestionsTable)
        .where(and(eq(evidenceGroupSuggestionsTable.groupId, group.id), eq(evidenceGroupSuggestionsTable.isAddToConfirmed, false)));
      const fileIds = sugg.map((s) => s.fileId);
      if (fileIds.length > 0) {
        // Only set group_id on files still ungrouped (don't steal from other groups).
        await tx.update(caseFolderItemsTable)
          .set({ groupId: group.id })
          .where(and(inArray(caseFolderItemsTable.id, fileIds), isNull(caseFolderItemsTable.groupId)));
      }
      await tx.update(evidenceGroupsTable).set({ status: "confirmed", updatedAt: new Date() }).where(eq(evidenceGroupsTable.id, group.id));
      await tx.delete(evidenceGroupSuggestionsTable).where(eq(evidenceGroupSuggestionsTable.groupId, group.id));
    });
    logger.info({ groupId: group.id }, "[evidenceGroups] group confirmed");
    res.json({ ok: true });
  },
);

// ─── Reject a suggested group ───────────────────────────────────────────────────────

router.post(
  "/evidence-groups/:id/reject",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const group = await loadAuthorizedGroup(aug, res, parseInt(req.params.id as string, 10));
    if (!group) return;
    if (group.status !== "suggested") { res.status(409).json({ error: "Only suggested groups can be rejected" }); return; }
    await db.delete(evidenceGroupsTable).where(eq(evidenceGroupsTable.id, group.id)); // cascade suggestions
    logger.info({ groupId: group.id }, "[evidenceGroups] suggestion rejected");
    res.json({ ok: true });
  },
);

// ─── Edit name/description/criterion ────────────────────────────────────────────────

const EditInput = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullish(),
  criterionFolder: z.string().trim().nullish(),
});

router.put(
  "/evidence-groups/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const group = await loadAuthorizedGroup(aug, res, parseInt(req.params.id as string, 10));
    if (!group) return;
    const parsed = EditInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) set.name = parsed.data.name;
    if (parsed.data.description !== undefined) set.description = parsed.data.description?.trim() || null;
    if (parsed.data.criterionFolder !== undefined) set.criterionFolder = parsed.data.criterionFolder || null;
    const [updated] = await db.update(evidenceGroupsTable).set(set).where(eq(evidenceGroupsTable.id, group.id)).returning();
    res.json({ group: updated });
  },
);

// ─── Add / remove members ───────────────────────────────────────────────────────────

const MembersInput = z.object({
  add: z.array(z.number().int().positive()).default([]),
  remove: z.array(z.number().int().positive()).default([]),
});

router.put(
  "/evidence-groups/:id/members",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const group = await loadAuthorizedGroup(aug, res, parseInt(req.params.id as string, 10));
    if (!group) return;
    const parsed = MembersInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }
    const add = [...new Set(parsed.data.add)];
    const remove = [...new Set(parsed.data.remove)];
    if (!(await assertUngroupedInCase(group.caseId, add, res))) return;

    await db.transaction(async (tx) => {
      if (add.length > 0) {
        await tx.update(caseFolderItemsTable).set({ groupId: group.id }).where(inArray(caseFolderItemsTable.id, add));
      }
      if (remove.length > 0) {
        // Only clear files that are actually in this group.
        await tx.update(caseFolderItemsTable).set({ groupId: null })
          .where(and(inArray(caseFolderItemsTable.id, remove), eq(caseFolderItemsTable.groupId, group.id)));
      }
    });
    logger.info({ groupId: group.id, added: add.length, removed: remove.length }, "[evidenceGroups] members updated");
    res.json({ ok: true });
  },
);

// ─── Dissolve (blocked if a referee maps the group) ────────────────────────────────

router.post(
  "/evidence-groups/:id/dissolve",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const group = await loadAuthorizedGroup(aug, res, parseInt(req.params.id as string, 10));
    if (!group) return;

    const refs = await db
      .select({ fullName: refereesTable.fullName })
      .from(refereeEvidenceGroupsTable)
      .innerJoin(refereesTable, eq(refereesTable.id, refereeEvidenceGroupsTable.refereeId))
      .where(eq(refereeEvidenceGroupsTable.evidenceGroupId, group.id));
    if (refs.length > 0) {
      res.status(409).json({
        error: "This group is mapped to one or more referees. Remove those mappings first.",
        referees: refs.map((r) => r.fullName),
      });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(caseFolderItemsTable).set({ groupId: null }).where(eq(caseFolderItemsTable.groupId, group.id));
      await tx.delete(evidenceGroupsTable).where(eq(evidenceGroupsTable.id, group.id));
    });
    logger.info({ groupId: group.id }, "[evidenceGroups] group dissolved");
    res.json({ ok: true });
  },
);

// ─── Accept / reject an add-to-confirmed suggestion ────────────────────────────────

router.post(
  "/evidence-group-suggestions/:id/accept",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const id = parseInt(req.params.id as string, 10);
    const [s] = await db.select().from(evidenceGroupSuggestionsTable).where(eq(evidenceGroupSuggestionsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ error: "Suggestion not found" }); return; }
    const group = await loadAuthorizedGroup(aug, res, s.groupId);
    if (!group) return;
    await db.transaction(async (tx) => {
      await tx.update(caseFolderItemsTable).set({ groupId: s.groupId })
        .where(and(eq(caseFolderItemsTable.id, s.fileId), isNull(caseFolderItemsTable.groupId)));
      await tx.delete(evidenceGroupSuggestionsTable).where(eq(evidenceGroupSuggestionsTable.id, id));
    });
    res.json({ ok: true });
  },
);

router.post(
  "/evidence-group-suggestions/:id/reject",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const id = parseInt(req.params.id as string, 10);
    const [s] = await db.select().from(evidenceGroupSuggestionsTable).where(eq(evidenceGroupSuggestionsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ error: "Suggestion not found" }); return; }
    if (!(await loadAuthorizedGroup(aug, res, s.groupId))) return;
    await db.delete(evidenceGroupSuggestionsTable).where(eq(evidenceGroupSuggestionsTable.id, id));
    res.json({ ok: true });
  },
);

// ─── Suggest (enqueue the AI grouping job) ─────────────────────────────────────────

router.post(
  "/cases/:caseId/evidence-groups/suggest",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    if (!(await authorizeCase(aug, res, caseId))) return;

    const [existing] = await db
      .select()
      .from(evidenceGroupingJobsTable)
      .where(and(eq(evidenceGroupingJobsTable.caseId, caseId), inArray(evidenceGroupingJobsTable.status, ["queued", "processing"])))
      .limit(1);
    if (existing) { res.status(200).json({ job: existing, alreadyRunning: true }); return; }

    // Manual trigger reconsiders every ungrouped file (clears batch review markers).
    await resetGroupingReview(caseId);

    const [job] = await db
      .insert(evidenceGroupingJobsTable)
      .values({ caseId, status: "queued", requestedBy: "staff" })
      .returning();
    logger.info({ caseId, jobId: job.id }, "[evidenceGroups] grouping job queued");
    res.status(202).json({ job });
  },
);

// ─── Reclassify (staff) — assign criteria to still-unclassified confirmed groups ───

router.post(
  "/cases/:caseId/evidence-groups/reclassify",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    if (!(await authorizeCase(aug, res, caseId))) return;
    try {
      const result = await reclassifyUnclassifiedGroups(caseId);
      logger.info({ caseId, ...result }, "[evidenceGroups] reclassify requested");
      res.json(result);
    } catch (err) {
      logger.error({ err, caseId }, "[evidenceGroups] reclassify failed");
      res.status(502).json({ error: "Reclassification failed. Please try again." });
    }
  },
);

export default router;
