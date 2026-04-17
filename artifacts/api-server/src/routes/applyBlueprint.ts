import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import {
  db,
  applicationsTable,
  activityTable,
  clientActivityLogTable,
} from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { verifyToken } from "../services/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

function getAI(): Anthropic | null {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

async function runAiAnalysis(applicationId: number, body: Record<string, unknown>) {
  const ai = getAI();
  if (!ai) {
    console.warn("[blueprint/apply] AI not provisioned — skipping pre-analysis");
    return;
  }

  const prompt = `You are an EB1A case analyst. Analyze this application and return JSON:
{ "confidence_score": 1-10, "key_strengths": [], "key_gaps": [], "strengthening_roadmap": "", "estimated_timeline": "", "ai_analysis": "" }

Application data:
${JSON.stringify(body, null, 2)}`;

  try {
    const response = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown fences, then extract the first {...} block
    const stripped = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : stripped;

    let parsed: {
      confidence_score?: number;
      key_strengths?: string[];
      key_gaps?: string[];
      strengthening_roadmap?: string;
      estimated_timeline?: string;
      ai_analysis?: string;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[blueprint/apply] Failed to parse AI JSON (first 400):", cleaned.slice(0, 400));
      return;
    }

    await db
      .update(applicationsTable)
      .set({
        adminAiAnalysis: parsed.ai_analysis ?? null,
        adminConfidenceScore: parsed.confidence_score ? Math.round(parsed.confidence_score) : null,
        adminEstimatedTimeline: parsed.estimated_timeline ?? null,
        adminStrengtheningRoadmap: parsed.strengthening_roadmap ?? null,
      })
      .where(eq(applicationsTable.id, applicationId));

    console.info(`[blueprint/apply] AI pre-analysis saved for application ${applicationId}`);
  } catch (err) {
    console.error("[blueprint/apply] AI analysis error:", err);
  }
}

const ApplyBody = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  currentRole: z.string().optional(),
  country: z.string().optional(),
  visaPath: z.string().optional(),
  field: z.string().optional(),
  yearsExperience: z.string().optional(),
  topAchievements: z.string().optional(),
  publications: z.string().optional(),
  awards: z.string().optional(),
  evidenceOrganization: z.string().optional(),
  documentationAvailable: z.string().optional(),
  linkedinUrl: z.string().optional(),
  whyApplying: z.string().optional(),
  timeline: z.string().optional(),
});

router.post("/blueprint/apply", async (req: Request, res: Response): Promise<void> => {
  const parsed = ApplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid application data", details: parsed.error.issues });
    return;
  }

  let profileId: number | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      profileId = payload.sub;
    } catch {
      // Not logged in — that's fine, proceed as prospect
    }
  }

  const [application] = await db
    .insert(applicationsTable)
    .values({
      ...parsed.data,
      profileId: profileId ?? undefined,
      status: "submitted",
      paymentStatus: "pending",
    })
    .returning();

  // Fire-and-forget: Claude pre-analysis + staff notification
  setImmediate(() => {
    runAiAnalysis(application.id, parsed.data).catch(() => {});

    if (profileId) {
      db.insert(activityTable).values({
        profileId,
        type: "blueprint_application_submitted",
        description: `Elite Blueprint application submitted (application #${application.id})`,
        metadata: { applicationId: application.id },
      }).catch(() => {});
    }

    console.info(
      `[staff-notify] New Blueprint application #${application.id} from ${parsed.data.email}`
    );
  });

  res.status(201).json({ applicationId: application.id, status: "submitted" });
});

router.get(
  "/blueprint/application-status",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as Request & { clientUser: { id: number; email: string } }).clientUser;

    const [application] = await db
      .select({
        id: applicationsTable.id,
        status: applicationsTable.status,
        paymentStatus: applicationsTable.paymentStatus,
        visaPath: applicationsTable.visaPath,
        createdAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .where(eq(applicationsTable.profileId, user.id))
      .orderBy(applicationsTable.id)
      .limit(1);

    if (!application) {
      res.status(404).json({ error: "No application found for this account" });
      return;
    }

    const statusMessages: Record<string, string> = {
      submitted: "Your application has been received and is under review.",
      under_review: "Our team is reviewing your application.",
      needs_more_info: "We need a bit more information about your application.",
      approved: "Great news — your application has been approved. Next step: payment.",
      declined: "Thank you for applying — we're unable to proceed at this time.",
      access_granted: "Your Elite Blueprint access is ready.",
    };

    res.json({
      applicationId: application.id,
      status: application.status,
      paymentStatus: application.paymentStatus,
      visaPath: application.visaPath,
      submittedAt: application.createdAt,
      message: statusMessages[application.status] ?? "Application is being processed.",
    });
  }
);

export default router;
