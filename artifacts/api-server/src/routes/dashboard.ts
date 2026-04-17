import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, profilesTable, evidenceTable, criteriaTable, milestonesTable, blueprintsTable, coursesTable, lessonsTable, courseProgressTable, activityTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
} from "@workspace/api-zod";
import { requireClientAuth } from "../middlewares/clientAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireClientAuth, async (req: any, res): Promise<void> => {
  const profileId = req.clientUser.id;
  const profile = req.clientUser;

  const allEvidence = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, profileId));
  const allCriteria = await db.select().from(criteriaTable).where(eq(criteriaTable.visaType, profile.visaTarget));

  const criteriaWithCounts = allCriteria.map((c) => {
    const count = allEvidence.filter((e) => e.criterionId === c.id).length;
    const ratio = count / Math.max(c.requiredMinimum, 1);
    const strength = ratio >= 1 ? "excellent" : ratio >= 0.6 ? "strong" : ratio >= 0.3 ? "developing" : "weak";
    return { strength };
  });

  const criteriaStrong = criteriaWithCounts.filter((c) => c.strength === "strong" || c.strength === "excellent").length;
  const criteriaDeveloping = criteriaWithCounts.filter((c) => c.strength === "developing").length;
  const criteriaWeak = criteriaWithCounts.filter((c) => c.strength === "weak").length;

  const readinessScore = allCriteria.length > 0
    ? Math.round(criteriaWithCounts.reduce((sum, c) => {
        const score = c.strength === "excellent" ? 100 : c.strength === "strong" ? 75 : c.strength === "developing" ? 45 : 10;
        return sum + score;
      }, 0) / allCriteria.length)
    : 0;

  const [blueprint] = await db.select().from(blueprintsTable).where(eq(blueprintsTable.userId, profileId));
  const milestones = blueprint
    ? await db.select().from(milestonesTable).where(eq(milestonesTable.blueprintId, blueprint.id))
    : [];

  const allCourses = await db.select().from(coursesTable);
  const allLessons = await db.select().from(lessonsTable);
  const allProgress = await db.select().from(courseProgressTable).where(eq(courseProgressTable.profileId, profileId));

  const coursesCompleted = allCourses.filter((course) => {
    const courseLessons = allLessons.filter((l) => l.courseId === course.id);
    const completedLessons = allProgress.filter((p) => p.courseId === course.id && p.completed === "true").length;
    return courseLessons.length > 0 && completedLessons >= courseLessons.length;
  }).length;

  const coursesEnrolled = new Set(allProgress.map((p) => p.courseId)).size;

  res.json(GetDashboardSummaryResponse.parse({
    readinessScore,
    visaTarget: profile.visaTarget,
    totalEvidence: allEvidence.length,
    approvedEvidence: allEvidence.filter((e) => e.status === "approved").length,
    pendingEvidence: allEvidence.filter((e) => e.status === "pending").length,
    criteriaStrong,
    criteriaDeveloping,
    criteriaWeak,
    milestonesTotal: milestones.length,
    milestonesCompleted: milestones.filter((m) => m.completed === "true").length,
    coursesEnrolled,
    coursesCompleted,
    hasBlueprint: !!blueprint,
    accessLevel: profile.accessLevel,
  }));
});

router.get("/dashboard/activity", requireClientAuth, async (req: any, res): Promise<void> => {
  const activity = await db.select().from(activityTable)
    .where(eq(activityTable.profileId, req.clientUser.id))
    .orderBy(desc(activityTable.createdAt))
    .limit(20);

  res.json(GetRecentActivityResponse.parse(activity.map((a) => ({
    ...a,
    metadata: a.metadata ?? {},
  }))));
});

export default router;
