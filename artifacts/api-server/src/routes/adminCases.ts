/**
 * adminCases.ts — Pinnacle³
 *
 * Staff-only case management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray, count, ne } from "drizzle-orm";
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
  courseProgressTable,
  coursesTable,
  lessonsTable,
  personalizedLearningPlansTable,
  documentGenerationJobsTable,
  notificationsTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail, actionItemEmail, passwordResetEmail } from "../services/emailService";
import { emitToProfile } from "../services/sseService";
import { z } from "zod/v4";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseId(val: string | string[]): number | null {
  const s = Array.isArray(val) ? val[0] : val;
  const n = parseInt(s ?? "", 10);
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
      .where(ne(profilesTable.accessLevel, "free"))
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

    res.json({
      profile: { ...profile, passwordHash: undefined },
      intake: intake ?? null,
      resume: resume ?? null,
    });
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
    const [updated] = await db.update(profilesTable).set({ passwordHash: hash }).where(eq(profilesTable.id, id)).returning({ id: profilesTable.id, email: profilesTable.email, firstName: profilesTable.firstName, name: profilesTable.name });
    if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }

    // Send password reset notification email
    const firstName = updated.firstName ?? updated.name?.split(" ")[0] ?? "there";
    sendEmail(updated.email, passwordResetEmail(firstName)).catch(() => {});

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

    const [notification] = await db.insert(notificationsTable).values({
      profileId: id,
      userType: "client",
      notificationType: "action_item",
      title: "New action item assigned",
      message: parsed.data.title,
      priority: parsed.data.priority,
    }).returning();

    if (notification) {
      const [row] = await db
        .select({ unreadCount: count() })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.profileId, id),
            eq(notificationsTable.userType, "client"),
            eq(notificationsTable.status, "unread"),
          ),
        );
      emitToProfile(id, "notification", {
        unreadCount: Number(row?.unreadCount ?? 1),
        notification,
      });
    }

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

    // Email the client when the action item is marked as sent
    if (parsed.data.status === "sent") {
      const [profile] = await db
        .select({ email: profilesTable.email, firstName: profilesTable.firstName, name: profilesTable.name })
        .from(profilesTable)
        .where(eq(profilesTable.id, id))
        .limit(1);
      if (profile) {
        const firstName = profile.firstName ?? profile.name?.split(" ")[0] ?? "there";
        sendEmail(profile.email, actionItemEmail(firstName, updated.title, updated.description ?? null, updated.priority ?? "medium")).catch(() => {});
      }
    }

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
  staffContextInput: z.record(z.string(), z.unknown()).optional(),
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
