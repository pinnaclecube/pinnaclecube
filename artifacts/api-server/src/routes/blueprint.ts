import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, blueprintsTable, milestonesTable, activityTable } from "@workspace/db";
import {
  GetBlueprintResponse,
  ListMilestonesResponse,
  CreateMilestoneBody,
  UpdateMilestoneParams,
  UpdateMilestoneBody,
  UpdateMilestoneResponse,
  ListMilestonesResponseItem,
} from "@workspace/api-zod";
import { requireClientAuth } from "../middlewares/clientAuth";

const router: IRouter = Router();

function formatMilestone(m: typeof milestonesTable.$inferSelect) {
  return {
    ...m,
    completed: m.completed === "true",
    description: m.description ?? null,
    dueDate: m.dueDate ? m.dueDate.toString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
  };
}

router.get("/blueprint", requireClientAuth, async (req: any, res): Promise<void> => {
  const [blueprint] = await db.select().from(blueprintsTable).where(eq(blueprintsTable.userId, req.clientUser.id));
  if (!blueprint) {
    res.status(404).json({ error: "No blueprint found" });
    return;
  }
  res.json(GetBlueprintResponse.parse({
    ...blueprint,
    targetFilingDate: blueprint.targetFilingDate ? blueprint.targetFilingDate.toString() : null,
    assignedConsultant: blueprint.assignedConsultant ?? null,
  }));
});

router.get("/blueprint/milestones", requireClientAuth, async (req: any, res): Promise<void> => {
  const [blueprint] = await db.select().from(blueprintsTable).where(eq(blueprintsTable.userId, req.clientUser.id));
  if (!blueprint) {
    res.json(ListMilestonesResponse.parse([]));
    return;
  }
  const milestones = await db.select().from(milestonesTable)
    .where(eq(milestonesTable.blueprintId, blueprint.id))
    .orderBy(milestonesTable.sortOrder);

  res.json(ListMilestonesResponse.parse(milestones.map(formatMilestone)));
});

router.post("/blueprint/milestones", requireClientAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [blueprint] = await db.select().from(blueprintsTable).where(eq(blueprintsTable.userId, req.clientUser.id));
  if (!blueprint) {
    res.status(404).json({ error: "No blueprint found. Elite Blueprint access required." });
    return;
  }

  const [milestone] = await db.insert(milestonesTable).values({
    blueprintId: blueprint.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    dueDate: parsed.data.dueDate ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
  }).returning();

  res.status(201).json(ListMilestonesResponseItem.parse(formatMilestone(milestone)));
});

router.patch("/blueprint/milestones/:milestoneId", requireClientAuth, async (req: any, res): Promise<void> => {
  const params = UpdateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
  if (parsed.data.completed !== undefined) {
    updateData.completed = parsed.data.completed ? "true" : "false";
    if (parsed.data.completed) updateData.completedAt = new Date();
  }

  const [milestone] = await db
    .update(milestonesTable)
    .set(updateData)
    .where(eq(milestonesTable.id, params.data.milestoneId))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }

  if (parsed.data.completed) {
    await db.insert(activityTable).values({
      profileId: req.clientUser.id,
      type: "milestone_completed",
      description: `Milestone completed: ${milestone.title}`,
      metadata: { milestoneId: milestone.id },
    });
  }

  res.json(UpdateMilestoneResponse.parse(formatMilestone(milestone)));
});

export default router;
