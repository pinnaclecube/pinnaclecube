import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, criteriaTable, evidenceTable } from "@workspace/db";
import {
  ListCriteriaQueryParams,
  GetCriterionParams,
  GetCriterionResponse,
  ListCriteriaResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/criteria", async (req, res): Promise<void> => {
  const parsed = ListCriteriaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(criteriaTable).$dynamic();
  if (parsed.data.visaType) {
    query = query.where(eq(criteriaTable.visaType, parsed.data.visaType));
  }

  const criteria = await query;
  const allEvidence = await db.select().from(evidenceTable);

  const result = criteria.map((c) => {
    const evidenceCount = allEvidence.filter((e) => e.criterionId === c.id).length;
    const strengthLevel = getStrengthLevel(evidenceCount, c.requiredMinimum);
    return { ...c, evidenceCount, strengthLevel };
  });

  res.json(ListCriteriaResponse.parse(result));
});

router.get("/criteria/:criterionId", async (req, res): Promise<void> => {
  const params = GetCriterionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, params.data.criterionId));
  if (!criterion) {
    res.status(404).json({ error: "Criterion not found" });
    return;
  }

  const evidence = await db.select().from(evidenceTable).where(eq(evidenceTable.criterionId, params.data.criterionId));
  const evidenceCount = evidence.length;
  const strengthLevel = getStrengthLevel(evidenceCount, criterion.requiredMinimum);

  const tips = getTips(criterion.name);

  const result = {
    ...criterion,
    evidenceCount,
    strengthLevel,
    evidence: evidence.map((e) => ({
      ...e,
      description: e.description ?? null,
      sourceUrl: e.sourceUrl ?? null,
      dateAchieved: e.dateAchieved ? e.dateAchieved.toString() : null,
    })),
    tips,
  };

  res.json(GetCriterionResponse.parse(result));
});

function getStrengthLevel(count: number, required: number): string {
  if (count === 0) return "none";
  const ratio = count / required;
  if (ratio < 0.3) return "weak";
  if (ratio < 0.6) return "developing";
  if (ratio < 1.0) return "strong";
  return "excellent";
}

function getTips(criterionName: string): string {
  const tips: Record<string, string> = {
    "Awards": "Include any prizes, fellowships, or recognitions from professional organizations, universities, or government bodies. Patents can strengthen this category.",
    "Membership": "Document membership in associations that require outstanding achievement for admission. IEEE, ACM, NeurIPS Program Committee membership are strong examples.",
    "Published Material": "Gather all press, media features, podcast appearances, and published interviews about your work. Technical blog posts in major outlets count.",
    "Judging": "List any peer review work for journals, conferences (NeurIPS, ICML, ICLR, CVPR), or grant panels. Even single reviews count — document them.",
    "Original Contributions": "Articulate the impact of your work — citations, downstream adoption, products built on your research, or metrics showing scale.",
    "Scholarly Articles": "Compile all peer-reviewed publications. Google Scholar citation counts strengthen this. Even preprints with significant citations can be documented.",
    "Critical Role": "Demonstrate your position relative to others in your organization. Evidence includes org charts, promotion letters, and headcount you influenced.",
    "High Salary": "Compare your compensation to the field median using BLS data, H-1B salary databases, or Levels.fyi. A 90th percentile salary is typically needed.",
    "Commercial Success": "Revenue, user counts, downloads, or other metrics that demonstrate the commercial impact of your work or creations.",
  };
  return tips[criterionName] ?? "Document all relevant evidence for this criterion. Quality and specificity of evidence matters more than quantity alone.";
}

export default router;
