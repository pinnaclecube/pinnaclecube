/**
 * adminCases.ts — Pinnacle³
 *
 * Staff-only case management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  evidenceTable,
  visaCriteriaTable,
  clientActionItemsTable,
  internalEvidenceNotesTable,
  clientActivityLogTable,
  readinessIntakeTable,
  resumeUploadsTable,
  clientDriveRootsTable,
  clientDriveFoldersTable,
  driveIngestLogsTable,
  courseProgressTable,
  coursesTable,
  lessonsTable,
  personalizedLearningPlansTable,
  documentGenerationJobsTable,
  notificationsTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { createClientRootFolders, createCriteriaEvidenceFolders } from "../services/googleDrive";
import { ingestClientFolders } from "../services/driveIngestService";
import { z } from "zod/v4";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseId(val: string): number | null {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

// ─── List all profiles ─────────────────────────────────────────────────────────

router.get(
  "/admin/profiles",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const profiles = await db
      .select({
        id: profilesTable.id,
        name: profilesTable.name,
        email: profilesTable.email,
        visaTarget: profilesTable.visaTarget,
        accessLevel: profilesTable.accessLevel,
        profession: profilesTable.profession,
        createdAt: profilesTable.createdAt,
      })
      .from(profilesTable)
      .orderBy(desc(profilesTable.createdAt));

    res.json({ profiles, total: profiles.length });
  },
);

// ─── Get profile detail ────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const [intake] = await db.select().from(readinessIntakeTable).where(eq(readinessIntakeTable.profileId, id)).limit(1);
    const [resume] = await db.select().from(resumeUploadsTable).where(eq(resumeUploadsTable.profileId, id)).orderBy(desc(resumeUploadsTable.createdAt)).limit(1);
    const [driveRoot] = await db.select().from(clientDriveRootsTable).where(eq(clientDriveRootsTable.profileId, id)).limit(1);

    res.json({
      profile: { ...profile, passwordHash: undefined },
      intake: intake ?? null,
      resume: resume ?? null,
      driveRoot: driveRoot ?? null,
    });
  },
);

// ─── Provision Drive workspace ─────────────────────────────────────────────────

router.post(
  "/admin/profiles/:id/provision-drive",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const [profile] = await db
      .select({ id: profilesTable.id, email: profilesTable.email, visaTarget: profilesTable.visaTarget })
      .from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const [intake] = await db
      .select({ id: readinessIntakeTable.id, visaPath: readinessIntakeTable.visaPath })
      .from(readinessIntakeTable).where(eq(readinessIntakeTable.profileId, id)).limit(1);

    // Resolve visa path: prefer intake value, fall back to profile's visaTarget
    const rawVisaPath = (intake?.visaPath ?? profile.visaTarget ?? "eb1a") as string;
    const visaPathMap: Record<string, string> = {
      eb1a: "eb1a", "EB-1A": "eb1a", "EB1A": "eb1a",
      niw: "niw", "EB-2 NIW": "niw", "NIW": "niw",
      o1a: "o1a", "O-1A": "o1a", "O1A": "o1a",
    };
    const visaPath = (visaPathMap[rawVisaPath] ?? "eb1a") as "eb1a" | "niw" | "o1a";

    const [existingRoot] = await db
      .select({ id: clientDriveRootsTable.id })
      .from(clientDriveRootsTable).where(eq(clientDriveRootsTable.profileId, id)).limit(1);

    try {
      // Step 1: Root folders (idempotent — findOrCreate handles duplicates)
      await createClientRootFolders(id, profile.email);

      // Step 2: Per-criterion evidence subfolders inside Evidence/
      const criteriaFolders = await createCriteriaEvidenceFolders(id, visaPath);

      if (intake) {
        await db.update(readinessIntakeTable)
          .set({ driveFoldersCreated: true, driveFoldersCreatedAt: new Date() })
          .where(eq(readinessIntakeTable.profileId, id));
      }

      await db.insert(clientActivityLogTable).values({
        profileId: id,
        eventType: "drive_provisioned",
        eventData: {
          message: `Staff provisioned Google Drive workspace (${visaPath.toUpperCase()}).`,
          criteriaFoldersCreated: criteriaFolders.length,
          wasNewRoot: !existingRoot,
        },
      });

      res.json({
        success: true,
        message: `Google Drive workspace fully provisioned — root folders + ${criteriaFolders.length} criteria evidence folders created.`,
        criteriaFoldersCreated: criteriaFolders.length,
        visaPath,
      });
    } catch (err: any) {
      console.error(`[provision-drive] Failed for profile ${id}:`, err);
      res.status(500).json({ error: "Drive provisioning failed", detail: err?.message ?? "Unknown error" });
    }
  },
);

// ─── Reset password ────────────────────────────────────────────────────────────

const ResetPasswordBody = z.object({ newPassword: z.string().min(8) });

router.post(
  "/admin/profiles/:id/reset-password",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "newPassword must be at least 8 chars" }); return; }

    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    const [updated] = await db.update(profilesTable).set({ passwordHash: hash }).where(eq(profilesTable.id, id)).returning({ id: profilesTable.id });
    if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }

    await db.insert(clientActivityLogTable).values({
      profileId: id,
      eventType: "admin_password_reset",
      eventData: { message: "Staff reset your password." },
    });

    res.json({ success: true });
  },
);

// ─── Delete case ───────────────────────────────────────────────────────────────

router.delete(
  "/admin/profiles/:id",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    await db.delete(evidenceTable).where(eq(evidenceTable.profileId, id));
    await db.delete(clientActionItemsTable).where(eq(clientActionItemsTable.profileId, id));
    await db.delete(clientActivityLogTable).where(eq(clientActivityLogTable.profileId, id));
    await db.delete(notificationsTable).where(eq(notificationsTable.profileId, id));
    await db.delete(courseProgressTable).where(eq(courseProgressTable.profileId, id));
    await db.delete(profilesTable).where(eq(profilesTable.id, id));

    res.json({ success: true });
  },
);

// ─── Evidence list for a profile ──────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/evidence",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const items = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, id)).orderBy(evidenceTable.primaryCriteriaId);

    // Fetch internal evidence notes per item
    const ids = items.map((i) => i.id);
    const notes = ids.length > 0
      ? await db.select().from(internalEvidenceNotesTable).where(inArray(internalEvidenceNotesTable.evidenceItemId, ids))
      : [];

    const notesByEvidenceId = notes.reduce<Record<number, typeof notes>>((acc, n) => {
      acc[n.evidenceItemId] = acc[n.evidenceItemId] ?? [];
      acc[n.evidenceItemId].push(n);
      return acc;
    }, {});

    // Group by primaryCriteriaId
    const grouped: Record<string, { criteriaId: string; items: unknown[] }> = {};
    for (const item of items) {
      const key = item.primaryCriteriaId ?? "uncategorized";
      if (!grouped[key]) grouped[key] = { criteriaId: key, items: [] };
      grouped[key].items.push({ ...item, internalNotes: notesByEvidenceId[item.id] ?? [] });
    }

    res.json({ evidence: Object.values(grouped), total: items.length });
  },
);

// ─── Update evidence item (reclassify / internal notes) ───────────────────────

const UpdateEvidenceBody = z.object({
  primaryCriteriaId: z.string().optional(),
  note: z.string().optional(),
  aiSummaryIgnored: z.boolean().optional(),
});

router.patch(
  "/admin/profiles/:id/evidence/:eid",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    const eid = parseId(req.params.eid);
    if (!id || !eid) { res.status(400).json({ error: "Invalid ID" }); return; }

    const parsed = UpdateEvidenceBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const { primaryCriteriaId, note, aiSummaryIgnored } = parsed.data;

    const updates: Record<string, unknown> = {};
    if (primaryCriteriaId !== undefined) updates.primaryCriteriaId = primaryCriteriaId;
    if (aiSummaryIgnored !== undefined) updates.aiSummaryIgnored = aiSummaryIgnored;

    if (Object.keys(updates).length > 0) {
      await db.update(evidenceTable).set(updates).where(and(eq(evidenceTable.id, eid), eq(evidenceTable.profileId, id)));
    }

    if (note) {
      await db.insert(internalEvidenceNotesTable).values({
        evidenceItemId: eid,
        staffUserId: "staff",
        note,
      });
    }

    res.json({ success: true });
  },
);

// ─── Force regenerate AI summary ──────────────────────────────────────────────

router.post(
  "/admin/profiles/:id/evidence/:eid/regenerate-ai",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    const eid = parseId(req.params.eid);
    if (!id || !eid) { res.status(400).json({ error: "Invalid ID" }); return; }

    await db.update(evidenceTable).set({
      extractionStatus: "pending",
      aiSummary: null,
    }).where(and(eq(evidenceTable.id, eid), eq(evidenceTable.profileId, id)));

    res.json({ success: true, message: "AI summary regeneration queued" });
  },
);

// ─── Action items ──────────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/action-items",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const items = await db.select().from(clientActionItemsTable).where(eq(clientActionItemsTable.profileId, id)).orderBy(desc(clientActionItemsTable.createdAt));
    res.json({ actionItems: items });
  },
);

const CreateActionItemBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

router.post(
  "/admin/profiles/:id/action-items",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const parsed = CreateActionItemBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

    const [item] = await db.insert(clientActionItemsTable).values({
      profileId: id,
      generatedByAdminId: "staff",
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      status: "draft",
    }).returning();

    await db.insert(notificationsTable).values({
      profileId: id,
      userType: "client",
      notificationType: "action_item",
      title: "New action item assigned",
      message: parsed.data.title,
      priority: parsed.data.priority,
    });

    res.json({ actionItem: item });
  },
);

const UpdateActionItemBody = z.object({
  status: z.enum(["draft", "sent", "completed", "cancelled"]).optional(),
  adminNotes: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

router.patch(
  "/admin/profiles/:id/action-items/:aid",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    const aid = parseId(req.params.aid);
    if (!id || !aid) { res.status(400).json({ error: "Invalid ID" }); return; }

    const parsed = UpdateActionItemBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const updates: Record<string, unknown> = {};
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.adminNotes !== undefined) updates.adminNotes = parsed.data.adminNotes;
    if (parsed.data.priority) updates.priority = parsed.data.priority;
    if (parsed.data.status === "sent") updates.sentAt = new Date();
    if (parsed.data.status === "completed") updates.adminCompletedAt = new Date();

    const [updated] = await db.update(clientActionItemsTable).set(updates)
      .where(and(eq(clientActionItemsTable.id, aid), eq(clientActionItemsTable.profileId, id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Action item not found" }); return; }
    res.json({ actionItem: updated });
  },
);

// ─── Course progress ───────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/course-progress",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const courses = await db.select().from(coursesTable);
    const lessons = await db.select().from(lessonsTable);
    const progress = await db.select().from(courseProgressTable).where(eq(courseProgressTable.profileId, id));

    const [plan] = await db.select().from(personalizedLearningPlansTable).where(eq(personalizedLearningPlansTable.profileId, id)).limit(1);

    const completedSet = new Set(progress.filter((p) => p.completed === "true").map((p) => p.lessonId));

    const result = courses.map((course) => {
      const courseLessons = lessons.filter((l) => l.courseId === course.id);
      const completed = courseLessons.filter((l) => completedSet.has(l.id)).length;
      return {
        ...course,
        totalLessons: courseLessons.length,
        completedLessons: completed,
        percentComplete: courseLessons.length > 0 ? Math.round((completed / courseLessons.length) * 100) : 0,
      };
    });

    res.json({ courses: result, plan: plan ?? null });
  },
);

// ─── Invalidate lessons ────────────────────────────────────────────────────────

router.post(
  "/admin/lessons/invalidate/:profileId",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.profileId);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    await db.update(personalizedLearningPlansTable).set({
      status: "invalidated",
      lastInvalidatedAt: new Date(),
    }).where(eq(personalizedLearningPlansTable.profileId, id));

    await db.insert(clientActivityLogTable).values({
      profileId: id,
      eventType: "lessons_invalidated",
      eventData: { message: "Staff invalidated learning plan for regeneration." },
    });

    res.json({ success: true, message: "Learning plan invalidated — will regenerate on next lesson access" });
  },
);

// ─── Documents ─────────────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/documents",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const docs = await db.select().from(documentGenerationJobsTable)
      .where(eq(documentGenerationJobsTable.profileId, id))
      .orderBy(desc(documentGenerationJobsTable.createdAt));

    res.json({ documents: docs });
  },
);

const GenerateDocBody = z.object({
  docSubtype: z.string().min(1),
  staffContextInput: z.record(z.unknown()).optional(),
  caseSetupId: z.number().optional(),
});

router.post(
  "/admin/profiles/:id/documents",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const parsed = GenerateDocBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const [doc] = await db.insert(documentGenerationJobsTable).values({
      profileId: id,
      triggeredByStaffId: "staff",
      caseSetupId: parsed.data.caseSetupId ?? null,
      docSubtype: parsed.data.docSubtype,
      status: "pending",
      staffContextInput: parsed.data.staffContextInput ?? {},
    }).returning();

    res.json({ document: doc });
  },
);

router.patch(
  "/admin/documents/:docId/publish",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const docId = parseId(req.params.docId);
    if (!docId) { res.status(400).json({ error: "Invalid document ID" }); return; }

    const [updated] = await db.update(documentGenerationJobsTable).set({
      publishedToClient: true,
      publishedAt: new Date(),
    }).where(eq(documentGenerationJobsTable.id, docId)).returning();

    if (!updated) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ success: true, document: updated });
  },
);

router.patch(
  "/admin/documents/:docId/unpublish",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const docId = parseId(req.params.docId);
    if (!docId) { res.status(400).json({ error: "Invalid document ID" }); return; }

    const [updated] = await db.update(documentGenerationJobsTable).set({
      publishedToClient: false,
      publishedAt: null,
    }).where(eq(documentGenerationJobsTable.id, docId)).returning();

    if (!updated) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ success: true, document: updated });
  },
);

// ─── Drive Sync ────────────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/drive-sync-status",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const folders = await db
      .select({
        criteriaId: clientDriveFoldersTable.criteriaId,
        folderName: clientDriveFoldersTable.folderName,
        driveFolderId: clientDriveFoldersTable.driveFolderId,
        driveFolderUrl: clientDriveFoldersTable.driveFolderUrl,
        lastDriveSyncAt: clientDriveFoldersTable.lastDriveSyncAt,
      })
      .from(clientDriveFoldersTable)
      .where(eq(clientDriveFoldersTable.profileId, id));

    const driveIngestedCount = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(evidenceTable)
      .where(
        and(
          eq(evidenceTable.profileId, id),
          eq(evidenceTable.source, "drive_ingest"),
        ),
      );

    const lastSyncAt = folders.reduce<Date | null>((latest, f) => {
      if (!f.lastDriveSyncAt) return latest;
      if (!latest || f.lastDriveSyncAt > latest) return f.lastDriveSyncAt;
      return latest;
    }, null);

    res.json({
      foldersConfigured: folders.length,
      driveIngestedCount: driveIngestedCount[0]?.count ?? 0,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      folders,
    });
  },
);

router.post(
  "/admin/profiles/:id/sync-drive",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, id))
      .limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    try {
      const results = await ingestClientFolders(id);

      const totalIngested = results.reduce((s, r) => s + r.ingested, 0);
      const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
      const totalErrors = results.reduce((s, r) => s + r.errors, 0);

      if (totalIngested > 0) {
        await db.insert(clientActivityLogTable).values({
          profileId: id,
          eventType: "drive_sync",
          eventData: {
            message: `Staff triggered Drive sync — ${totalIngested} new file(s) ingested.`,
            foldersScanned: results.length,
            totalIngested,
            totalSkipped,
            totalErrors,
          },
        });
      }

      const lastSyncAt = new Date().toISOString();
      res.json({
        success: true,
        // Spec-aligned fields
        newItems: totalIngested,
        totalDriveItems: totalIngested + totalSkipped,
        lastSyncAt,
        // Detailed breakdown
        foldersScanned: results.length,
        totalIngested,
        totalSkipped,
        totalErrors,
        results,
      });
    } catch (err: any) {
      console.error(`[sync-drive] Failed for profile ${id}:`, err);
      res.status(500).json({ error: "Drive sync failed", detail: err?.message ?? "Unknown error" });
    }
  },
);

// ─── Drive ingest log ──────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/drive-ingest-log",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const rawLimit = parseInt(req.query.limit as string ?? "100", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;

    const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const entries = await db
      .select()
      .from(driveIngestLogsTable)
      .where(eq(driveIngestLogsTable.profileId, id))
      .orderBy(desc(driveIngestLogsTable.ingestedAt))
      .limit(limit);

    res.json({ entries, total: entries.length });
  },
);

// ─── Activity log ──────────────────────────────────────────────────────────────

router.get(
  "/admin/profiles/:id/activity-log",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid profile ID" }); return; }

    const limit = Math.min(parseInt(req.query.limit as string ?? "50", 10), 200);
    const events = await db.select().from(clientActivityLogTable)
      .where(eq(clientActivityLogTable.profileId, id))
      .orderBy(desc(clientActivityLogTable.createdAt))
      .limit(limit);

    res.json({ events });
  },
);

export default router;
