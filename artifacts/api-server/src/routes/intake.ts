import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, readinessIntakeTable, profilesTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { createClientRootFolders } from "../services/googleDrive";

const router = Router();

router.get("/intake", requireClientAuth, async (req: any, res): Promise<void> => {
  const [intake] = await db.select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, req.clientUser.id))
    .limit(1);

  res.json({ intake: intake ?? null });
});

router.post("/intake", requireClientAuth, async (req: any, res): Promise<void> => {
  const profileId = req.clientUser.id;
  const data = req.body as Record<string, unknown>;

  const allowed = [
    "fullName", "email", "currentRole", "company", "country", "education",
    "fieldOfWork", "yearsExperience", "summary", "describeWork", "keyAchievements",
    "publications", "awards", "media", "judgingReviewing", "leadershipRoles",
    "memberships", "salaryIndicators", "documentationAvailable", "evidenceOrganization",
    "evidenceStorage", "visaPath", "timeline", "currentGoal",
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data) updateData[key] = data[key];
  }

  const [existing] = await db.select({ id: readinessIntakeTable.id })
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, profileId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(readinessIntakeTable)
      .set(updateData)
      .where(eq(readinessIntakeTable.profileId, profileId))
      .returning();
    res.json({ intake: updated });
  } else {
    const [created] = await db
      .insert(readinessIntakeTable)
      .values({ profileId, ...updateData })
      .returning();
    res.status(201).json({ intake: created });
  }
});

router.post("/intake/complete", requireClientAuth, async (req: any, res): Promise<void> => {
  const profileId = req.clientUser.id;
  const profile = req.clientUser;

  const [intake] = await db.select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, profileId))
    .limit(1);

  if (!intake) {
    res.status(400).json({ error: "No intake record found. Please save your intake data first." });
    return;
  }

  await db
    .update(readinessIntakeTable)
    .set({ readinessCompleted: true, readinessCompletedAt: new Date(), status: "completed" })
    .where(eq(readinessIntakeTable.profileId, profileId));

  if (!intake.driveFoldersCreated) {
    setImmediate(async () => {
      try {
        await createClientRootFolders(profileId, profile.email);
        await db
          .update(readinessIntakeTable)
          .set({ driveFoldersCreated: true, driveFoldersCreatedAt: new Date() })
          .where(eq(readinessIntakeTable.profileId, profileId));
      } catch (err) {
        console.error(`[intake/complete] Drive folder creation failed for profile ${profileId}:`, err);
      }
    });
  }

  if (intake.visaPath) {
    await db
      .update(profilesTable)
      .set({ visaTarget: intake.visaPath as string })
      .where(eq(profilesTable.id, profileId));
  }

  res.json({ success: true, message: "Intake completed. Your workspace is being prepared." });
});

export default router;
