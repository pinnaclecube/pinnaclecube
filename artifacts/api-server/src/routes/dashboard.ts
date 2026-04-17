import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, profilesTable, evidenceTable, criteriaTable, milestonesTable, blueprintsTable, coursesTable, lessonsTable, courseProgressTable, activityTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const DEFAULT_PROFILE_ID = 1;

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, DEFAULT_PROFILE_ID));
  if (!profile) {
    res.json(GetDashboardSummaryResponse.parse({
      readinessScore: 0,
      visaTarget: "eb1a",
      totalEvidence: 0,
      approvedEvidence: 0,
      pendingEvidence: 0,
      criteriaStrong: 0,
      criteriaDeveloping: 0,
      criteriaWeak: 0,
      milestonesTotal: 0,
      milestonesCompleted: 0,
      coursesEnrolled: 0,
      coursesCompleted: 0,
      hasBlueprint: false,
      accessLevel: "free",
    }));
    return;
  }

  const allEvidence = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, DEFAULT_PROFILE_ID));
  const allCriteria = await db.select().from(criteriaTable).where(eq(criteriaTable.visaType, profile.visaTarget));

  const criteriaWithCounts = allCriteria.map((c) => {
    const count = allEvidence.filter((e) => e.criterionId === c.id).length;
    const ratio = count / Math.max(c.requiredMinimum, 1);
    const strength = ratio >= 1 ? "excellent" : ratio >= 0.6 ? "strong" : ratio >= 0.3 ? "developing" : "weak";
    return { strength };
  });

  const criteriaStrong = criteriaWithCounts.filter((c) => c.strength === "strong" || c.strength === "excellent").length;
  const criteriaDeveloping = criteriaWithCounts.filter((c) => c.strength === "developing").length;
  const criteriaWeak = criteriaWithCounts.filter((c) => c.strength === "weak" || c.strength === "none").length;

  const readinessScore = allCriteria.length > 0
    ? Math.round(criteriaWithCounts.reduce((sum, c) => {
        const score = c.strength === "excellent" ? 100 : c.strength === "strong" ? 75 : c.strength === "developing" ? 45 : 10;
        return sum + score;
      }, 0) / allCriteria.length)
    : 0;

  const [blueprint] = await db.select().from(blueprintsTable).where(eq(blueprintsTable.userId, DEFAULT_PROFILE_ID));
  const milestones = blueprint
    ? await db.select().from(milestonesTable).where(eq(milestonesTable.blueprintId, blueprint.id))
    : [];

  const allCourses = await db.select().from(coursesTable);
  const allLessons = await db.select().from(lessonsTable);
  const allProgress = await db.select().from(courseProgressTable).where(eq(courseProgressTable.profileId, DEFAULT_PROFILE_ID));

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

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const activity = await db.select().from(activityTable)
    .where(eq(activityTable.profileId, DEFAULT_PROFILE_ID))
    .orderBy(desc(activityTable.createdAt))
    .limit(20);

  res.json(GetRecentActivityResponse.parse(activity.map((a) => ({
    ...a,
    metadata: a.metadata ?? {},
  }))));
});

export default router;
