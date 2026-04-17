import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, criteriaTable, evidenceTable, blueprintsTable, milestonesTable, coursesTable, courseProgressTable } from "@workspace/db";
import {
  GetProfileResponse,
  CreateProfileBody,
  UpdateProfileBody,
  UpdateProfileResponse,
  GetReadinessResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_PROFILE_ID = 1;

router.get("/profile", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, DEFAULT_PROFILE_ID));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.post("/profile", async (req, res): Promise<void> => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [profile] = await db.insert(profilesTable).values(parsed.data).returning();
  res.status(201).json(GetProfileResponse.parse(profile));
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [profile] = await db
    .update(profilesTable)
    .set(parsed.data)
    .where(eq(profilesTable.id, DEFAULT_PROFILE_ID))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(UpdateProfileResponse.parse(profile));
});

router.get("/profile/readiness", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, DEFAULT_PROFILE_ID));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const allCriteria = await db.select().from(criteriaTable).where(eq(criteriaTable.visaType, profile.visaTarget));
  const allEvidence = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, DEFAULT_PROFILE_ID));

  const criteriaScores = allCriteria.map((c) => {
    const evidenceForCriterion = allEvidence.filter((e) => e.criterionId === c.id);
    const evidenceCount = evidenceForCriterion.length;
    const score = Math.min(100, Math.round((evidenceCount / Math.max(c.requiredMinimum, 1)) * 100));
    return {
      criterionId: c.id,
      criterionName: c.name,
      evidenceCount,
      requiredCount: c.requiredMinimum,
      score,
    };
  });

  const overallScore = criteriaScores.length > 0
    ? Math.round(criteriaScores.reduce((sum, c) => sum + c.score, 0) / criteriaScores.length)
    : 0;

  const strongCount = criteriaScores.filter((c) => c.score >= 80).length;
  const readyToFile = strongCount >= 3 && overallScore >= 60;

  const recommendation = readyToFile
    ? `Your profile shows a strong foundation for an ${profile.visaTarget.toUpperCase()} petition. ${strongCount} of ${criteriaScores.length} criteria are well-documented. Consider scheduling a petition review with your attorney.`
    : `Your ${profile.visaTarget.toUpperCase()} case needs additional evidence. Focus on criteria with fewer than ${3} items. A strong case typically requires 5+ items per qualifying criterion.`;

  const report = {
    overallScore,
    visaTarget: profile.visaTarget,
    criteriaScores,
    recommendation,
    readyToFile,
  };

  res.json(GetReadinessResponse.parse(report));
});

export default router;
