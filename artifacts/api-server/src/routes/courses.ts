import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coursesTable, lessonsTable, courseProgressTable, activityTable } from "@workspace/db";
import {
  ListCoursesQueryParams,
  ListCoursesResponse,
  GetCourseParams,
  GetCourseResponse,
  UpdateCourseProgressParams,
  UpdateCourseProgressBody,
  UpdateCourseProgressResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const DEFAULT_PROFILE_ID = 1;

router.get("/courses", async (req, res): Promise<void> => {
  const parsed = ListCoursesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let courses = await db.select().from(coursesTable);
  if (parsed.data.visaType) {
    courses = courses.filter((c) => c.visaType === parsed.data.visaType);
  }

  const lessons = await db.select().from(lessonsTable);
  const progress = await db.select().from(courseProgressTable).where(eq(courseProgressTable.profileId, DEFAULT_PROFILE_ID));

  const result = courses.map((course) => {
    const courseLessons = lessons.filter((l) => l.courseId === course.id);
    const completedLessons = progress.filter((p) => p.courseId === course.id && p.completed === "true").length;
    const progressPercent = courseLessons.length > 0
      ? Math.round((completedLessons / courseLessons.length) * 100)
      : 0;
    return {
      ...course,
      lessonCount: courseLessons.length,
      progressPercent,
    };
  });

  res.json(ListCoursesResponse.parse(result));
});

router.get("/courses/:courseId", async (req, res): Promise<void> => {
  const params = GetCourseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, params.data.courseId));
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const lessons = await db.select().from(lessonsTable)
    .where(eq(lessonsTable.courseId, params.data.courseId))
    .orderBy(lessonsTable.sortOrder);

  const progress = await db.select().from(courseProgressTable)
    .where(and(
      eq(courseProgressTable.profileId, DEFAULT_PROFILE_ID),
      eq(courseProgressTable.courseId, params.data.courseId)
    ));

  const completedLessons = progress.filter((p) => p.completed === "true").length;
  const progressPercent = lessons.length > 0
    ? Math.round((completedLessons / lessons.length) * 100)
    : 0;

  const lessonsWithProgress = lessons.map((lesson) => ({
    ...lesson,
    completed: progress.some((p) => p.lessonId === lesson.id && p.completed === "true"),
  }));

  const result = {
    ...course,
    lessonCount: lessons.length,
    progressPercent,
    lessons: lessonsWithProgress,
  };

  res.json(GetCourseResponse.parse(result));
});

router.patch("/courses/:courseId/progress", async (req, res): Promise<void> => {
  const params = UpdateCourseProgressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCourseProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(courseProgressTable).where(
    and(
      eq(courseProgressTable.profileId, DEFAULT_PROFILE_ID),
      eq(courseProgressTable.courseId, params.data.courseId),
      eq(courseProgressTable.lessonId, parsed.data.lessonId)
    )
  );

  if (existing.length > 0) {
    await db.update(courseProgressTable)
      .set({
        completed: parsed.data.completed ? "true" : "false",
        completedAt: parsed.data.completed ? new Date() : null,
      })
      .where(eq(courseProgressTable.id, existing[0].id));
  } else {
    await db.insert(courseProgressTable).values({
      profileId: DEFAULT_PROFILE_ID,
      courseId: params.data.courseId,
      lessonId: parsed.data.lessonId,
      completed: parsed.data.completed ? "true" : "false",
      completedAt: parsed.data.completed ? new Date() : null,
    });
  }

  if (parsed.data.completed) {
    await db.insert(activityTable).values({
      profileId: DEFAULT_PROFILE_ID,
      type: "course_progress",
      description: `Completed a lesson in Excellence Lab`,
      metadata: { courseId: params.data.courseId, lessonId: parsed.data.lessonId },
    });
  }

  const allLessons = await db.select().from(lessonsTable).where(eq(lessonsTable.courseId, params.data.courseId));
  const allProgress = await db.select().from(courseProgressTable).where(
    and(
      eq(courseProgressTable.profileId, DEFAULT_PROFILE_ID),
      eq(courseProgressTable.courseId, params.data.courseId)
    )
  );
  const completedCount = allProgress.filter((p) => p.completed === "true").length;
  const progressPercent = allLessons.length > 0
    ? Math.round((completedCount / allLessons.length) * 100)
    : 0;

  res.json(UpdateCourseProgressResponse.parse({
    courseId: params.data.courseId,
    lessonId: parsed.data.lessonId,
    completed: parsed.data.completed,
    progressPercent,
  }));
});

export default router;
