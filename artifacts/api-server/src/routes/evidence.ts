import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, evidenceTable, activityTable } from "@workspace/db";
import {
  ListEvidenceQueryParams,
  CreateEvidenceBody,
  GetEvidenceParams,
  GetEvidenceResponse,
  UpdateEvidenceParams,
  UpdateEvidenceBody,
  UpdateEvidenceResponse,
  DeleteEvidenceParams,
  ListEvidenceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const DEFAULT_PROFILE_ID = 1;

function formatEvidence(e: typeof evidenceTable.$inferSelect) {
  return {
    ...e,
    description: e.description ?? null,
    sourceUrl: e.sourceUrl ?? null,
    dateAchieved: e.dateAchieved ? e.dateAchieved.toString() : null,
  };
}

router.get("/evidence", async (req, res): Promise<void> => {
  const parsed = ListEvidenceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(evidenceTable).where(eq(evidenceTable.profileId, DEFAULT_PROFILE_ID)).$dynamic();

  if (parsed.data.criterionId) {
    query = query.where(and(
      eq(evidenceTable.profileId, DEFAULT_PROFILE_ID),
      eq(evidenceTable.criterionId, parsed.data.criterionId)
    ));
  }

  if (parsed.data.status) {
    query = query.where(and(
      eq(evidenceTable.profileId, DEFAULT_PROFILE_ID),
      eq(evidenceTable.status, parsed.data.status)
    ));
  }

  const evidence = await db.select().from(evidenceTable).where(eq(evidenceTable.profileId, DEFAULT_PROFILE_ID));
  res.json(ListEvidenceResponse.parse(evidence.map(formatEvidence)));
});

router.post("/evidence", async (req, res): Promise<void> => {
  const parsed = CreateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [evidence] = await db.insert(evidenceTable).values({
    ...parsed.data,
    profileId: DEFAULT_PROFILE_ID,
    description: parsed.data.description ?? null,
    sourceUrl: parsed.data.sourceUrl ?? null,
  }).returning();

  await db.insert(activityTable).values({
    profileId: DEFAULT_PROFILE_ID,
    type: "evidence_added",
    description: `Added evidence: ${evidence.title}`,
    metadata: { evidenceId: evidence.id, criterionId: evidence.criterionId },
  });

  res.status(201).json(GetEvidenceResponse.parse(formatEvidence(evidence)));
});

router.get("/evidence/:evidenceId", async (req, res): Promise<void> => {
  const params = GetEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [evidence] = await db.select().from(evidenceTable).where(eq(evidenceTable.id, params.data.evidenceId));
  if (!evidence) {
    res.status(404).json({ error: "Evidence not found" });
    return;
  }

  res.json(GetEvidenceResponse.parse(formatEvidence(evidence)));
});

router.patch("/evidence/:evidenceId", async (req, res): Promise<void> => {
  const params = UpdateEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [evidence] = await db
    .update(evidenceTable)
    .set(parsed.data)
    .where(eq(evidenceTable.id, params.data.evidenceId))
    .returning();

  if (!evidence) {
    res.status(404).json({ error: "Evidence not found" });
    return;
  }

  if (parsed.data.status === "approved") {
    await db.insert(activityTable).values({
      profileId: DEFAULT_PROFILE_ID,
      type: "evidence_approved",
      description: `Evidence approved: ${evidence.title}`,
      metadata: { evidenceId: evidence.id },
    });
  }

  res.json(UpdateEvidenceResponse.parse(formatEvidence(evidence)));
});

router.delete("/evidence/:evidenceId", async (req, res): Promise<void> => {
  const params = DeleteEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [evidence] = await db.delete(evidenceTable).where(eq(evidenceTable.id, params.data.evidenceId)).returning();
  if (!evidence) {
    res.status(404).json({ error: "Evidence not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
