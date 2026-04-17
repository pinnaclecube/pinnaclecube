import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, criteriaTable, evidenceTable } from "@workspace/db";
import {
  GetProfileResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  GetReadinessResponse,
} from "@workspace/api-zod";
import { requireClientAuth } from "../middlewares/clientAuth";

const router: IRouter = Router();

router.get("/profile", requireClientAuth, async (req: any, res): Promise<void> => {
  const profile = req.clientUser;
  res.json(GetProfileResponse.parse(profile));
});

router.patch("/profile", requireClientAuth, async (req: any, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [profile] = await db
    .update(profilesTable)
    .set(parsed.data)
    .where(eq(profilesTable.id, req.clientUser.id))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(UpdateProfileResponse.parse(profile));
});

router.get("/profile/readiness", requireClientAuth, async (req: any, res): Promise<void> => {
  const profile = req.clientUser;
  const allCriteria = await db.select().from(criteriaTable).where(eq(criteriaTable.visaType, profile.visaTarget));
  const allEvidence = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, profile.id));

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
    : `Your ${profile.visaTarget.toUpperCase()} case needs additional evidence. Focus on criteria with fewer than 3 items. A strong case typically requires 5+ items per qualifying criterion.`;

  res.json(GetReadinessResponse.parse({
    overallScore,
    visaTarget: profile.visaTarget,
    criteriaScores,
    recommendation,
    readyToFile,
  }));
});

export default router;
