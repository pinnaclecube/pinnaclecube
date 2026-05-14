/**
 * Evidence Vault API — Pinnacle³
 *
 * All routes require client auth (JWT Bearer token).
 * Static routes (/criteria, /coverage, /gap-analysis) are declared BEFORE /:id
 * so Express doesn't treat "criteria" as an ID param.
 */

import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import multer from "multer";
import { db } from "@workspace/db";
import {
  evidenceTable,
  readinessIntakeTable,
  profilesTable,
} from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";
import { extractText, generateAISummary, getAI } from "../services/evidenceProcessing";
import { getCriteriaForVisaPath, AI_DISCLAIMER, type VisaPathKey } from "@workspace/shared";

const router = Router();

// ─── Visa path normalizer ─────────────────────────────────────────────────────
// Intake rows store values like "EB-1A" / "EB-2 NIW" / "O-1A".
// getCriteriaForVisaPath expects "eb1a" | "niw" | "o1".

function normalizeVisaPath(raw: string): VisaPathKey | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "eb1a") return "eb1a";
  if (key === "eb2niw" || key === "niw") return "niw";
  if (key === "o1a" || key === "o1") return "o1";
  return null;
}

// ─── Multer (memory storage) ──────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage() });

// ─── GET /api/evidence/criteria ───────────────────────────────────────────────

router.get("/evidence/criteria", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;

  const [intake] = await db
    .select({ visaPath: readinessIntakeTable.visaPath })
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  if (!intake?.visaPath) {
    res.json({ criteria: [], requiresIntake: true });
    return;
  }

  const visaPath = normalizeVisaPath(intake.visaPath);
  if (!visaPath) {
    res.json({ criteria: [], requiresIntake: false });
    return;
  }
  const criteria = getCriteriaForVisaPath(visaPath);

  const counts = await db
    .select({
      primaryCriteriaId: evidenceTable.primaryCriteriaId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId))
    .groupBy(evidenceTable.primaryCriteriaId);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.primaryCriteriaId, c.count]),
  );

  const enriched = criteria.map((c) => ({
    criteria_id: c.id,
    display_name: c.displayName,
    folder_name: c.folderName,
    legal_standard: c.legalStandard,
    visa_path: c.visaPath,
    display_order: c.displayOrder,
    item_count: countMap[c.id] ?? 0,
  }));

  res.json({ criteria: enriched, requiresIntake: false });
});

// ─── GET /api/evidence/coverage ───────────────────────────────────────────────

router.get("/evidence/coverage", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;

  const [intake] = await db
    .select({ visaPath: readinessIntakeTable.visaPath })
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  if (!intake?.visaPath) {
    res.json({ coverage: [], requiresIntake: true });
    return;
  }

  const visaPath = normalizeVisaPath(intake.visaPath);
  if (!visaPath) {
    res.json({ coverage: [], requiresIntake: false });
    return;
  }
  const criteria = getCriteriaForVisaPath(visaPath);

  const counts = await db
    .select({
      primaryCriteriaId: evidenceTable.primaryCriteriaId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId))
    .groupBy(evidenceTable.primaryCriteriaId);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.primaryCriteriaId, c.count]),
  );

  const coverage = criteria.map((c) => {
    const itemCount = countMap[c.id] ?? 0;
    return {
      criteria_id: c.id,
      display_name: c.displayName,
      item_count: itemCount,
      has_evidence: itemCount > 0,
    };
  });

  res.json({ coverage, visa_path: visaPath });
});

// ─── GET /api/evidence/gap-analysis ──────────────────────────────────────────

router.get("/evidence/gap-analysis", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;

  const [intake] = await db
    .select()
    .from(readinessIntakeTable)
    .where(eq(readinessIntakeTable.profileId, userId))
    .limit(1);

  if (!intake?.visaPath) {
    res.status(400).json({ error: "Complete your readiness intake first", requiresIntake: true });
    return;
  }

  const [profile] = await db
    .select({ name: profilesTable.name, profession: profilesTable.profession })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  const visaPath = normalizeVisaPath(intake.visaPath ?? "");
  if (!visaPath) {
    res.status(400).json({ error: "Unrecognized visa path in your profile. Please contact support." });
    return;
  }
  const criteria = getCriteriaForVisaPath(visaPath);

  const evidence = await db
    .select({
      primaryCriteriaId: evidenceTable.primaryCriteriaId,
      title: evidenceTable.title,
      aiSummary: evidenceTable.aiSummary,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId));

  const grouped: Record<string, typeof evidence> = {};
  for (const item of evidence) {
    const key = item.primaryCriteriaId ?? "unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const criteriaContext = criteria
    .map((c) => {
      const items = grouped[c.id] ?? [];
      const itemList = items.length
        ? items
            .map((i) => `  - ${i.title}${i.aiSummary ? `: ${i.aiSummary}` : ""}`)
            .join("\n")
        : "  (no evidence uploaded)";
      return `${c.displayName} (${c.id}):\n${itemList}`;
    })
    .join("\n\n");

  const ai = getAI();
  if (!ai) {
    res.status(503).json({
      error: "AI analysis not available. AI integration not provisioned.",
    });
    return;
  }

  try {
    const msg = await ai.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are an expert US immigration consultant reviewing evidence for a ${visaPath.toUpperCase()} visa petition.

Client: ${profile?.name ?? "Unknown"} | Field: ${profile?.profession ?? intake.currentRole ?? "Technology"}
Visa target: ${visaPath.toUpperCase()}

Evidence uploaded, organized by criterion:

${criteriaContext}

Provide a practical gap analysis:
1. Which criteria are well-supported (2+ strong items)
2. Which criteria need more evidence
3. Which criteria have nothing yet (gaps)
4. 3-5 specific, actionable suggestions for the weakest areas

Be direct and specific. Format with clear sections. Do not include legal advice.`,
        },
      ],
    });

    const block = msg.content[0];
    const analysis = block.type === "text" ? block.text : "";

    res.json({
      analysis,
      aiGenerated: true,
      disclaimer: AI_DISCLAIMER,
      visa_path: visaPath,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Gap analysis failed", detail: err?.message });
  }
});

// ─── POST /api/evidence/upload ────────────────────────────────────────────────
// Accepts one OR many files (field name "files") plus shared metadata.

router.post(
  "/evidence/upload",
  requireClientAuth,
  upload.array("files", 20),
  async (req: any, res) => {
    const userId: number = req.clientUser.id;

    const [intake] = await db
      .select({ visaPath: readinessIntakeTable.visaPath })
      .from(readinessIntakeTable)
      .where(eq(readinessIntakeTable.profileId, userId))
      .limit(1);

    if (!intake) {
      res.status(400).json({ error: "Complete your readiness intake first", requiresIntake: true });
      return;
    }

    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) {
      res.status(400).json({ error: "At least one file is required" });
      return;
    }

    const { criteria_id, description } = req.body as {
      criteria_id?: string;
      description?: string;
    };

    if (!criteria_id) {
      res.status(400).json({ error: "criteria_id is required" });
      return;
    }

    // Validate criteria_id belongs to client's visa_path
    const visaPath = normalizeVisaPath(intake.visaPath ?? "");
    if (!visaPath) {
      res.status(400).json({ error: "Unrecognized visa path in your profile. Please contact support." });
      return;
    }
    const validCriteria = getCriteriaForVisaPath(visaPath);
    const criteriaEntry = validCriteria.find((c) => c.id === criteria_id);

    if (!criteriaEntry) {
      res.status(400).json({
        error: `criteria_id "${criteria_id}" is not valid for visa path "${visaPath}"`,
      });
      return;
    }

    // Fetch client profession once for AI summaries
    const [profileRow] = await db
      .select({ profession: profilesTable.profession })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    const clientField = profileRow?.profession ?? "technology";

    // Process each file
    const createdItems: typeof evidenceTable.$inferSelect[] = [];

    for (const file of files) {
      // Derive title from filename (strip extension)
      const titleFromFile = file.originalname.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim() || file.originalname;

      const [evidenceItem] = await db
        .insert(evidenceTable)
        .values({
          profileId: userId,
          primaryCriteriaId: criteria_id,
          title: titleFromFile,
          description: description ?? null,
          evidenceType: "document",
          status: "draft",
          extractionStatus: "pending",
          fileName: file.originalname,
          additionalCriteriaIds: [],
        })
        .returning();

      createdItems.push(evidenceItem);

      // Fire-and-forget: extract text + AI summary for this file
      const fileBuffer = file.buffer;
      const fileMime = file.mimetype;
      const fileOrigName = file.originalname;
      const itemId = evidenceItem.id;
      const legalStandard = criteriaEntry.legalStandard;

      setImmediate(async () => {
        try {
          const extracted = await extractText(fileBuffer, fileMime, fileOrigName);
          const aiSummary = await generateAISummary(extracted, legalStandard, clientField);
          await db
            .update(evidenceTable)
            .set({ extractedText: extracted || null, aiSummary, extractionStatus: "completed" })
            .where(eq(evidenceTable.id, itemId));
        } catch {
          await db
            .update(evidenceTable)
            .set({ extractionStatus: "failed" })
            .where(eq(evidenceTable.id, itemId));
        }
      });
    }

    res.status(201).json({ items: createdItems, count: createdItems.length });
  },
);

// ─── GET /api/evidence ────────────────────────────────────────────────────────

router.get("/evidence", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;

  const items = await db
    .select()
    .from(evidenceTable)
    .where(eq(evidenceTable.profileId, userId))
    .orderBy(evidenceTable.primaryCriteriaId, evidenceTable.createdAt);

  res.json(items);
});

// ─── GET /api/evidence/:id ────────────────────────────────────────────────────

router.get("/evidence/:id", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid evidence ID" });
    return;
  }

  const [item] = await db
    .select()
    .from(evidenceTable)
    .where(and(eq(evidenceTable.id, id), eq(evidenceTable.profileId, userId)))
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Evidence item not found" });
    return;
  }

  res.json({ item });
});

// ─── PUT /api/evidence/:id ────────────────────────────────────────────────────

router.put("/evidence/:id", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid evidence ID" });
    return;
  }

  const [existing] = await db
    .select({ id: evidenceTable.id })
    .from(evidenceTable)
    .where(and(eq(evidenceTable.id, id), eq(evidenceTable.profileId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Evidence item not found" });
    return;
  }

  const { title, description, additional_criteria_ids, ai_summary_ignored } = req.body as {
    title?: string;
    description?: string;
    additional_criteria_ids?: string[];
    ai_summary_ignored?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (additional_criteria_ids !== undefined)
    updates.additionalCriteriaIds = additional_criteria_ids;
  if (ai_summary_ignored !== undefined) updates.aiSummaryIgnored = ai_summary_ignored;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const [updated] = await db
    .update(evidenceTable)
    .set(updates)
    .where(eq(evidenceTable.id, id))
    .returning();

  res.json({ item: updated });
});

// ─── DELETE /api/evidence/:id ─────────────────────────────────────────────────

router.delete("/evidence/:id", requireClientAuth, async (req: any, res) => {
  const userId: number = req.clientUser.id;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid evidence ID" });
    return;
  }

  const [existing] = await db
    .select({ id: evidenceTable.id })
    .from(evidenceTable)
    .where(and(eq(evidenceTable.id, id), eq(evidenceTable.profileId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Evidence item not found" });
    return;
  }

  await db.delete(evidenceTable).where(eq(evidenceTable.id, id));
  res.json({ ok: true });
});

export default router;
