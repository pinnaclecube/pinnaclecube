/**
 * Lessons API — Pinnacle³ Excellence Lab
 *
 * All lesson routes require:
 *   - Client auth (JWT Bearer token)
 *   - Excellence Lab or Elite Blueprint product access
 *
 * Admin invalidation route requires staff auth (X-Staff-Token header).
 */

import { Router } from "express";
import { eq, and, inArray, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activityTable,
  personalizedLearningPlansTable,
  clientUserProductsTable,
  profilesTable,
} from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import {
  getOrGenerateLesson,
  getModuleOrder,
  invalidateLessons,
} from "../services/learningPlanService";
import { AI_DISCLAIMER } from "@workspace/shared";

const router = Router();

// ─── Product access helper ────────────────────────────────────────────────────

const EXCELLENCE_PRODUCTS = ["excellence_lab", "elite_blueprint", "all"] as const;

async function hasExcellenceAccess(userId: number, userAccessLevel: string): Promise<boolean> {
  // Check profile-level access flag
  if (EXCELLENCE_PRODUCTS.includes(userAccessLevel as (typeof EXCELLENCE_PRODUCTS)[number])) {
    return true;
  }

  // Check purchased products table
  const [product] = await db
    .select({ id: clientUserProductsTable.id })
    .from(clientUserProductsTable)
    .where(
      and(
        eq(clientUserProductsTable.profileId, userId),
        eq(clientUserProductsTable.status, "active"),
        inArray(clientUserProductsTable.product, ["excellence_lab", "elite_blueprint"]),
      ),
    )
    .limit(1);

  return !!product;
}

// ─── Product access middleware ────────────────────────────────────────────────

async function requireExcellenceAccess(req: any, res: any, next: any): Promise<void> {
  const userId: number = req.clientUser.id;
  const accessLevel: string = req.clientUser.accessLevel ?? "free";

  const hasAccess = await hasExcellenceAccess(userId, accessLevel);

  if (!hasAccess) {
    res.status(403).json({
      error: "This feature requires an Excellence Lab or Elite Blueprint subscription.",
      upgradeRequired: true,
      product: "excellence_lab",
    });
    return;
  }

  next();
}

// ─── GET /api/lessons/plan ────────────────────────────────────────────────────

router.get(
  "/lessons/plan",
  requireClientAuth,
  requireExcellenceAccess,
  async (req: any, res) => {
    const userId: number = req.clientUser.id;

    try {
      const orderedLessons = await getModuleOrder(userId);
      res.json({ lessons: orderedLessons });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load lesson plan", detail: err?.message });
    }
  },
);

// ─── GET /api/lessons/:lessonId ───────────────────────────────────────────────

router.get(
  "/lessons/:lessonId",
  requireClientAuth,
  requireExcellenceAccess,
  async (req: any, res) => {
    const userId: number = req.clientUser.id;
    const { lessonId } = req.params as { lessonId: string };

    try {
      const content = await getOrGenerateLesson(userId, lessonId);

      // Log lesson opened
      await db.insert(activityTable).values({
        profileId: userId,
        type: "lesson_opened",
        description: `Opened lesson: ${lessonId}`,
        metadata: { lessonId },
      });

      res.json({
        lessonId,
        content,
        aiGenerated: true,
        disclaimer: AI_DISCLAIMER,
      });
    } catch (err: any) {
      if (err?.message?.includes("not found")) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Failed to generate lesson", detail: err?.message });
    }
  },
);

// ─── POST /api/lessons/:lessonId/complete ─────────────────────────────────────

router.post(
  "/lessons/:lessonId/complete",
  requireClientAuth,
  async (req: any, res) => {
    const userId: number = req.clientUser.id;
    const { lessonId } = req.params as { lessonId: string };

    // Get or create plan
    const [existing] = await db
      .select()
      .from(personalizedLearningPlansTable)
      .where(eq(personalizedLearningPlansTable.profileId, userId))
      .limit(1);

    let plan = existing;

    if (!plan) {
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
      plan = created;
    }

    const currentCompleted = new Set((plan.completedLessonIds as string[]) ?? []);
    const wasAlreadyCompleted = currentCompleted.has(lessonId);

    if (!wasAlreadyCompleted) {
      currentCompleted.add(lessonId);

      await db
        .update(personalizedLearningPlansTable)
        .set({ completedLessonIds: [...currentCompleted] })
        .where(eq(personalizedLearningPlansTable.profileId, userId));

      // Log activity
      await db.insert(activityTable).values({
        profileId: userId,
        type: "lesson_completed",
        description: `Completed lesson: ${lessonId}`,
        metadata: { lessonId },
      });
    }

    res.json({
      success: true,
      lessonId,
      completedAt: wasAlreadyCompleted ? null : new Date().toISOString(),
      totalCompleted: currentCompleted.size,
    });
  },
);

// ─── POST /api/admin/lessons/invalidate (staff only) ─────────────────────────

router.post(
  "/admin/lessons/invalidate",
  requireStaffAuth,
  async (req: any, res) => {
    const { userId, reason } = req.body as {
      userId?: number;
      reason?: string;
    };

    if (!userId || typeof userId !== "number") {
      res.status(400).json({ error: "userId (number) is required" });
      return;
    }

    const validReasons = ["evidence_added", "intake_updated", "blueprint_updated", "staff_forced"] as const;
    const safeReason = validReasons.includes(reason as (typeof validReasons)[number])
      ? (reason as (typeof validReasons)[number])
      : "staff_forced";

    try {
      const lessonsInvalidated = await invalidateLessons(userId, safeReason);
      res.json({ success: true, lessonsInvalidated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to invalidate lessons", detail: err?.message });
    }
  },
);

export default router;
