import { Router } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { db, readinessIntakeTable, profilesTable, resumeUploadsTable, clientDriveFoldersTable } from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { autoProvisionDrive, uploadResumeFile } from "../services/googleDrive";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Lazy Anthropic client ────────────────────────────────────────────────────
function getAI(): Anthropic | null {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ─── Simple in-process cache for AI analysis (30-min TTL) ────────────────────
const analysisCache = new Map<number, { data: unknown; cachedAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

// ─── GET /api/intake ──────────────────────────────────────────────────────────
router.get("/intake", requireClientAuth, async (req: any, res): Promise<void> => {
  const [intake] = await db.select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, req.clientUser.id))
    .limit(1);

  // Attach latest resume info if linked
  let resume = null;
  if (intake?.resumeUploadId) {
    const [r] = await db.select()
      .from(resumeUploadsTable)
      .where(eq(resumeUploadsTable.id, intake.resumeUploadId))
      .limit(1);
    resume = r ?? null;
  }

  res.json({ intake: intake ?? null, resume });
});

// ─── POST /api/intake ─────────────────────────────────────────────────────────
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

  // Invalidate analysis cache on intake save
  analysisCache.delete(profileId);

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

  // Auto-provision Drive folders for ALL clients who save a visa path (not just Evidence Engine subscribers)
  const newVisaPath = updateData.visaPath as string | undefined;
  if (newVisaPath && newVisaPath !== "unsure") {
    const clientEmail = req.clientUser.email as string;
    setImmediate(async () => {
      try {
        // Skip if criteria folders are already set up
        const [existingFolder] = await db
          .select({ id: clientDriveFoldersTable.id })
          .from(clientDriveFoldersTable)
          .where(eq(clientDriveFoldersTable.profileId, profileId))
          .limit(1);
        if (existingFolder) return;

        await autoProvisionDrive(profileId, clientEmail, newVisaPath);
      } catch (err: unknown) {
        req.log?.error({ err, profileId }, "[intake/POST] Drive auto-provision failed");
      }
    });
  }
});

// ─── POST /api/intake/complete ────────────────────────────────────────────────
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

  // Auto-provision Drive for ALL clients on intake completion — provision root + criteria folders
  // (driveFoldersCreated is set to true by createCriteriaEvidenceFolders)
  if (!intake.driveFoldersCreated) {
    setImmediate(async () => {
      try {
        await autoProvisionDrive(profileId, profile.email, intake.visaPath ?? null);
      } catch (err) {
        req.log?.error({ err, profileId }, "[intake/complete] Drive provision failed");
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

// ─── POST /api/intake/resume ──────────────────────────────────────────────────
router.post(
  "/intake/resume",
  requireClientAuth,
  upload.single("resume"),
  async (req: any, res): Promise<void> => {
    const profileId = req.clientUser.id;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { originalname, buffer, mimetype } = req.file;

    // Get client's last name for file naming
    const lastName = req.clientUser.lastName ?? req.clientUser.name?.split(" ").slice(-1)[0] ?? "Client";

    try {
      // Upload to Google Drive resume folder
      const uploaded = await uploadResumeFile(profileId, buffer, originalname, mimetype, lastName);

      // Insert into resume_uploads table
      const [resumeRow] = await db
        .insert(resumeUploadsTable)
        .values({
          profileId,
          driveFileId: uploaded.driveFileId,
          driveFileUrl: uploaded.driveFileUrl,
          fileName: uploaded.fileName,
          extractionStatus: "pending",
        })
        .returning();

      // Link to intake record
      await db
        .update(readinessIntakeTable)
        .set({ resumeUploadId: resumeRow.id })
        .where(eq(readinessIntakeTable.profileId, profileId));

      res.json({
        success: true,
        resume: {
          id: resumeRow.id,
          fileName: resumeRow.fileName,
          driveFileUrl: resumeRow.driveFileUrl,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("[intake/resume] Upload error:", err);
      res.status(500).json({ error: msg });
    }
  },
);

// ─── GET /api/intake/analysis ─────────────────────────────────────────────────
// Claude-powered readiness analysis based on intake data
router.get("/intake/analysis", requireClientAuth, async (req: any, res): Promise<void> => {
  const profileId = req.clientUser.id;

  // Return cached if fresh
  const cached = analysisCache.get(profileId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  const [intake] = await db.select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, profileId))
    .limit(1);

  if (!intake) {
    res.json({ sufficientData: false, reason: "Please complete your readiness intake first." });
    return;
  }

  // Check minimum viable data
  const coreFields = [intake.currentRole, intake.fieldOfWork, intake.visaPath];
  const achievementFields = [
    intake.keyAchievements, intake.publications, intake.awards,
    intake.media, intake.judgingReviewing, intake.leadershipRoles,
  ];
  const filledCore = coreFields.filter(Boolean).length;
  const filledAchievements = achievementFields.filter(Boolean).length;

  if (filledCore < 2 || filledAchievements < 1) {
    const result = {
      sufficientData: false,
      reason: "We need more details about your role, achievements, and visa goals to generate your analysis. Please complete at least Steps 2, 3, and 5 of the readiness intake.",
    };
    res.json(result);
    return;
  }

  const ai = getAI();
  if (!ai) {
    res.status(503).json({ error: "AI analysis is not currently available. Please try again later." });
    return;
  }

  const visaLabel =
    intake.visaPath === "eb1a" ? "EB-1A (Extraordinary Ability)"
    : intake.visaPath === "eb2niw" ? "EB-2 NIW (National Interest Waiver)"
    : intake.visaPath === "o1a" ? "O-1A (Extraordinary Ability — Nonimmigrant)"
    : intake.visaPath === "unsure" ? "Undecided"
    : (intake.visaPath ?? "Unknown");

  const prompt = `You are an expert US immigration strategist at Pinnacle³, a premium advisory firm for high-achieving tech professionals pursuing EB-1A, EB-2 NIW, and O-1A visas.

Below is a client's readiness intake profile. Analyze their profile and return ONLY valid JSON (no markdown, no explanation, just the JSON object).

CLIENT PROFILE:
- Name: ${intake.fullName ?? "Not provided"}
- Role: ${intake.currentRole ?? "Not provided"}
- Company: ${intake.company ?? "Not provided"}
- Field: ${intake.fieldOfWork ?? "Not provided"}
- Years of Experience: ${intake.yearsExperience ?? "Not provided"}
- Education: ${intake.education ?? "Not provided"}
- Country: ${intake.country ?? "Not provided"}
- Target Visa: ${visaLabel}
- Timeline: ${intake.timeline ?? "Not provided"}
- Current Goal: ${intake.currentGoal ?? "Not provided"}

PROFESSIONAL SUMMARY:
${intake.summary ?? "Not provided"}

ACHIEVEMENTS:
- Key Achievements: ${intake.keyAchievements ?? "Not provided"}
- Publications: ${intake.publications ?? "Not provided"}
- Awards & Prizes: ${intake.awards ?? "Not provided"}
- Media Coverage: ${intake.media ?? "Not provided"}
- Judging/Reviewing: ${intake.judgingReviewing ?? "Not provided"}
- Leadership Roles: ${intake.leadershipRoles ?? "Not provided"}
- Professional Memberships: ${intake.memberships ?? "Not provided"}
- Salary Indicators: ${intake.salaryIndicators ?? "Not provided"}

EVIDENCE STATUS:
- Documentation Available: ${intake.documentationAvailable ?? "Not provided"}
- Organization Level: ${intake.evidenceOrganization ?? "Not provided"}

Return this exact JSON structure:
{
  "sufficientData": true,
  "visaLabel": "${visaLabel}",
  "overallReadiness": "strong" | "moderate" | "developing",
  "summary": "2-3 sentence executive summary of the client's current visa readiness position",
  "strongAreas": [
    {
      "criterion": "Criterion name (e.g. Awards & Prizes, Critical Role, Publications)",
      "description": "Specific explanation of why this is strong based on their data",
      "strength": "strong" | "moderate"
    }
  ],
  "recommendedAreas": [
    {
      "criterion": "Criterion name",
      "gap": "Specific gap or weakness identified",
      "action": "Concrete, specific action to take",
      "priority": "high" | "medium" | "low"
    }
  ],
  "roadmap": [
    {
      "phase": 1,
      "title": "Phase title",
      "duration": "e.g. 1-2 months",
      "focus": "What this phase accomplishes",
      "actions": ["Specific action 1", "Specific action 2", "Specific action 3"]
    }
  ]
}

Rules:
- strongAreas: 2-4 items max, only include genuine strengths from their actual data
- recommendedAreas: 3-5 items, prioritized by impact on visa success
- roadmap: exactly 4 phases covering evidence audit → strengthening → petition prep → filing
- Be specific to their actual profile, not generic
- IMPORTANT: This is advisory analysis only, not legal advice`;

  try {
    const message = await ai.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    analysisCache.set(profileId, { data: parsed, cachedAt: Date.now() });
    res.json(parsed);
  } catch (err) {
    console.error("[intake/analysis] Claude error:", err);
    res.status(500).json({ error: "Analysis generation failed. Please try again." });
  }
});

export default router;
