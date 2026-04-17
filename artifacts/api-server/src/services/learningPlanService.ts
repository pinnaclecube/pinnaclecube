/**
 * learningPlanService.ts — Pinnacle³
 *
 * Manages personalized learning plans:
 *   - Per-lesson caching with context-hash invalidation
 *   - Module ordering by evidence gap priority
 *   - Invalidation on evidence/intake/blueprint changes
 */

import crypto from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  personalizedLearningPlansTable,
  lessonDefinitionsTable,
  readinessIntakeTable,
  evidenceTable,
  resumeUploadsTable,
  blueprintsTable,
  activityTable,
  profilesTable,
  type LessonDefinition,
  type PersonalizedLearningPlan,
} from "@workspace/db";
import { generateLessonContent, type LessonContent, type ClientContext } from "./lessonGenerator";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CachedLesson {
  content: LessonContent;
  context_hash: string;
  generated_at: string;
}

type PlanPayload = Record<string, CachedLesson>;

// ─── Visa-path lesson filter ──────────────────────────────────────────────────

function lessonMatchesVisaPath(lesson: LessonDefinition, visaPath: string): boolean {
  if (!lesson.criteriaFocus) return true; // generic lessons apply to all
  const prefix = visaPath === "eb1a" ? "EB1A-"
    : visaPath === "niw" ? "NIW-"
    : visaPath === "o1" ? "O1A-"
    : null;
  if (!prefix) return true;
  return lesson.criteriaFocus.startsWith(prefix);
}

// ─── buildContextHash ─────────────────────────────────────────────────────────

export function buildContextHash(
  userId: number,
  lessonId: string,
  evidenceItems: Array<{ id: number }>,
  intake: { updatedAt?: Date | string | null; visaPath?: string | null },
): string {
  const sortedIds = [...evidenceItems.map((e) => e.id)].sort((a, b) => a - b).join(",");
  const intakeUpdated = intake.updatedAt
    ? new Date(intake.updatedAt).toISOString()
    : "none";
  const raw = `${lessonId}|${sortedIds}|${intakeUpdated}|${intake.visaPath ?? ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─── getOrCreatePlan ─────────────────────────────────────────────────────────

async function getOrCreatePlan(userId: number): Promise<PersonalizedLearningPlan> {
  const [existing] = await db
    .select()
    .from(personalizedLearningPlansTable)
    .where(eq(personalizedLearningPlansTable.profileId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(personalizedLearningPlansTable)
    .values({
      profileId: userId,
      planType: "excellence_lab",
      status: "active",
      planPayload: {},
      completedLessonIds: [],
    })
    .returning();

  return created;
}

// ─── fetchClientContext ───────────────────────────────────────────────────────

async function fetchClientContext(
  userId: number,
  completedLessonIds: string[],
): Promise<ClientContext> {
  const [intake] = await db
    .select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  const [profile] = await db
    .select({ name: profilesTable.name, profession: profilesTable.profession })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  // Resume text via join through intake.resumeUploadId
  let resumeText: string | null = null;
  if (intake?.resumeUploadId) {
    const [resume] = await db
      .select({ extractedText: resumeUploadsTable.extractedText })
      .from(resumeUploadsTable)
      .where(eq(resumeUploadsTable.id, intake.resumeUploadId))
      .limit(1);
    resumeText = resume?.extractedText ?? null;
  }

  const evidenceItems = await db
    .select({
      id: evidenceTable.id,
      primaryCriteriaId: evidenceTable.primaryCriteriaId,
      title: evidenceTable.title,
      aiSummary: evidenceTable.aiSummary,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId));

  // Blueprint notes (latest active blueprint)
  const [blueprint] = await db
    .select({ strategySummary: blueprintsTable.strategySummary })
    .from(blueprintsTable)
    .where(and(eq(blueprintsTable.userId, userId), eq(blueprintsTable.status, "active")))
    .orderBy(blueprintsTable.createdAt)
    .limit(1);

  return {
    intake: {
      visaPath: intake?.visaPath ?? "eb1a",
      currentRole: intake?.currentRole ?? null,
      company: intake?.company ?? null,
      country: intake?.country ?? null,
      currentGoal: intake?.currentGoal ?? null,
      updatedAt: intake?.updatedAt ?? null,
    },
    resumeText,
    evidenceItems,
    completedLessonIds,
    blueprintNotes: blueprint?.strategySummary ?? null,
    visaPath: intake?.visaPath ?? "eb1a",
    clientName: profile?.name ?? null,
    profession: profile?.profession ?? null,
  };
}

// ─── getOrGenerateLesson ──────────────────────────────────────────────────────

export async function getOrGenerateLesson(
  userId: number,
  lessonId: string,
): Promise<LessonContent> {
  // 1. Fetch lesson definition
  const [lessonDef] = await db
    .select()
    .from(lessonDefinitionsTable)
    .where(eq(lessonDefinitionsTable.id, lessonId))
    .limit(1);

  if (!lessonDef) {
    throw new Error(`Lesson "${lessonId}" not found`);
  }

  // 2. Fetch or create plan
  const plan = await getOrCreatePlan(userId);
  const completedLessonIds = (plan.completedLessonIds as string[]) ?? [];
  const planPayload = (plan.planPayload as PlanPayload) ?? {};

  // 3. Get evidence items for hash computation
  const evidenceItems = await db
    .select({ id: evidenceTable.id })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId));

  const [intake] = await db
    .select({ updatedAt: readinessIntakeTable.updatedAt, visaPath: readinessIntakeTable.visaPath })
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  const currentHash = buildContextHash(userId, lessonId, evidenceItems, intake ?? {});

  // 4. Return cached lesson if hash matches
  const cached = planPayload[lessonId];
  if (cached?.context_hash === currentHash) {
    return cached.content;
  }

  // 5. Build full client context and generate
  const clientContext = await fetchClientContext(userId, completedLessonIds);
  const content = await generateLessonContent(lessonDef, clientContext);

  // 6. Update plan payload with new lesson + hash
  const updatedPayload: PlanPayload = {
    ...planPayload,
    [lessonId]: {
      content,
      context_hash: currentHash,
      generated_at: new Date().toISOString(),
    },
  };

  await db
    .update(personalizedLearningPlansTable)
    .set({ planPayload: updatedPayload })
    .where(eq(personalizedLearningPlansTable.profileId, userId));

  return content;
}

// ─── getModuleOrder ───────────────────────────────────────────────────────────

export async function getModuleOrder(userId: number) {
  // Fetch visa path from intake
  const [intake] = await db
    .select({ visaPath: readinessIntakeTable.visaPath })
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  const visaPath = intake?.visaPath ?? "eb1a";

  // Fetch all active lesson definitions
  const allLessons = await db
    .select()
    .from(lessonDefinitionsTable)
    .where(eq(lessonDefinitionsTable.isActive, true))
    .orderBy(lessonDefinitionsTable.displayOrder);

  // Filter for this visa path
  const lessons = allLessons.filter((l) => lessonMatchesVisaPath(l, visaPath));

  // Fetch evidence counts per criteria
  const evidenceCounts = await db
    .select({
      primaryCriteriaId: evidenceTable.primaryCriteriaId,
      count: evidenceTable.id,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId));

  const countMap: Record<string, number> = {};
  for (const row of evidenceCounts) {
    const key = row.primaryCriteriaId ?? "unknown";
    countMap[key] = (countMap[key] ?? 0) + 1;
  }

  // Fetch completed lesson IDs
  const plan = await getOrCreatePlan(userId);
  const completedLessonIds = new Set((plan.completedLessonIds as string[]) ?? []);

  // Enrich and sort
  const enriched = lessons.map((lesson) => {
    const evidenceCount = lesson.criteriaFocus ? (countMap[lesson.criteriaFocus] ?? 0) : 0;
    return {
      ...lesson,
      completed: completedLessonIds.has(lesson.id),
      evidenceCount,
      _sortPriority:
        evidenceCount === 0 ? 0    // highest priority — no evidence yet
        : evidenceCount <= 2 ? 1   // middle
        : 2,                       // lowest priority — well-supported
    };
  });

  // Stable sort: priority ASC, then displayOrder ASC
  enriched.sort((a, b) => {
    if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
    return a.displayOrder - b.displayOrder;
  });

  return enriched.map(({ _sortPriority, ...lesson }) => lesson);
}

// ─── invalidateLessons ────────────────────────────────────────────────────────

export async function invalidateLessons(
  userId: number,
  reason: "evidence_added" | "intake_updated" | "blueprint_updated" | "staff_forced",
): Promise<number> {
  const plan = await getOrCreatePlan(userId);

  const completedLessonIds = new Set((plan.completedLessonIds as string[]) ?? []);
  const planPayload = (plan.planPayload as PlanPayload) ?? {};

  let invalidatedCount = 0;
  const updatedPayload: PlanPayload = { ...planPayload };

  for (const lessonId of Object.keys(updatedPayload)) {
    // Only invalidate incomplete lessons
    if (!completedLessonIds.has(lessonId)) {
      updatedPayload[lessonId] = {
        ...updatedPayload[lessonId],
        context_hash: "", // cleared hash forces regeneration on next fetch
      };
      invalidatedCount++;
    }
  }

  await db
    .update(personalizedLearningPlansTable)
    .set({
      planPayload: updatedPayload,
      lastInvalidatedAt: new Date(),
    })
    .where(eq(personalizedLearningPlansTable.profileId, userId));

  // Log to activity
  await db.insert(activityTable).values({
    profileId: userId,
    type: "lessons_invalidated",
    description: `Lesson cache invalidated: ${reason}. ${invalidatedCount} lessons will be regenerated.`,
    metadata: { reason, invalidatedCount },
  });

  return invalidatedCount;
}
