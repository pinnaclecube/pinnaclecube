/**
 * letterDrafts.ts — Pinnacle³
 *
 * Step 4 — AI reference-letter draft generation + iteration.
 *
 * Dual-auth (X-Staff-Token OR client Bearer JWT), following the referee/projects/
 * evidence precedent. Clients are scoped to their own case and capped at 3 lifetime
 * generations per referee; staff are uncapped and can edit drafts.
 *
 * POST /referees/:id/letter-draft/generate   — generate / regenerate (feedback?)
 * GET  /referees/:id/letter-draft            — current draft (+ history for staff)
 * PUT  /referees/:id/letter-draft            — staff manual edit of the current draft
 * (POST .../finalize is added in Phase 4.)
 */

import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, and, ne, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  refereesTable,
  letterDraftsTable,
  casePetitionSetupTable,
} from "@workspace/db";
import { checkEligibility, generateLetterDraft } from "../services/letterGenerationService";
import { markdownToLetterDocx } from "../services/letterDocxService";
import { ingestReferenceLetter, LetterIngestError } from "./referees";
import { requireClientAuth } from "../middlewares/clientAuth";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CLIENT_GENERATION_CAP = 3;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type AugmentedRequest = Request & {
  clientUser?: { id: number; name: string; email: string };
  staffUser?: { id: string; role: string; name: string };
};

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-staff-token"]) requireStaffAuth(req, res, next);
  else void requireClientAuth(req, res, next);
}

function isStaff(req: AugmentedRequest): boolean {
  return !!req.staffUser && !req.clientUser;
}

async function loadAuthorizedReferee(
  req: AugmentedRequest,
  res: Response,
  refereeId: number,
): Promise<typeof refereesTable.$inferSelect | null> {
  if (isNaN(refereeId)) {
    res.status(400).json({ error: "Invalid referee id" });
    return null;
  }
  const [referee] = await db
    .select()
    .from(refereesTable)
    .where(eq(refereesTable.id, refereeId))
    .limit(1);
  if (!referee) {
    res.status(404).json({ error: "Referee not found" });
    return null;
  }
  const [caseRecord] = await db
    .select()
    .from(casePetitionSetupTable)
    .where(eq(casePetitionSetupTable.id, referee.caseId))
    .limit(1);
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return null;
  }
  if (req.clientUser && caseRecord.profileId !== req.clientUser.id) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return referee;
}

// The current (non-superseded) draft for a referee, if any.
async function currentDraft(refereeId: number) {
  const [row] = await db
    .select()
    .from(letterDraftsTable)
    .where(and(eq(letterDraftsTable.refereeId, refereeId), ne(letterDraftsTable.status, "superseded")))
    .orderBy(desc(letterDraftsTable.version))
    .limit(1);
  return row ?? null;
}

// ─── Generate / regenerate ───────────────────────────────────────────────────────

const GenerateInput = z.object({ feedback: z.string().trim().nullish() });

router.post(
  "/referees/:id/letter-draft/generate",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const staff = isStaff(aug);
    const generatedBy = staff ? "staff" : "client";

    // Client lifetime cap.
    if (!staff && referee.clientGenerationCount >= CLIENT_GENERATION_CAP) {
      res.status(429).json({
        error: "You've reached the limit of 3 letter generations for this referee. Contact us for further changes.",
        capReached: true,
        remainingClientGenerations: 0,
      });
      return;
    }

    // Eligibility gate (every generation).
    const elig = await checkEligibility(referee);
    if (!elig.ok) {
      res.status(400).json({ error: "This referee is not ready for letter generation", reasons: elig.reasons });
      return;
    }

    const parsed = GenerateInput.safeParse(req.body ?? {});
    const feedback = parsed.success ? parsed.data.feedback ?? null : null;

    let draft;
    try {
      draft = await generateLetterDraft(referee, { feedback, generatedBy });
    } catch (err) {
      logger.error({ err, refereeId }, "[letterDrafts] generation failed");
      res.status(502).json({ error: "Letter generation failed. Please try again." });
      return;
    }

    let remainingClientGenerations: number | undefined;
    if (!staff) {
      const [updated] = await db
        .update(refereesTable)
        .set({ clientGenerationCount: referee.clientGenerationCount + 1, updatedAt: new Date() })
        .where(eq(refereesTable.id, refereeId))
        .returning({ count: refereesTable.clientGenerationCount });
      remainingClientGenerations = Math.max(0, CLIENT_GENERATION_CAP - (updated?.count ?? CLIENT_GENERATION_CAP));
    }

    res.status(201).json({ draft, remainingClientGenerations });
  },
);

// ─── Get current draft (+ history for staff) ─────────────────────────────────────

router.get(
  "/referees/:id/letter-draft",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const draft = await currentDraft(refereeId);
    const elig = await checkEligibility(referee);
    const staff = isStaff(aug);

    const body: Record<string, unknown> = {
      draft,
      eligibility: elig,
    };

    if (staff) {
      body.history = await db
        .select()
        .from(letterDraftsTable)
        .where(eq(letterDraftsTable.refereeId, refereeId))
        .orderBy(desc(letterDraftsTable.version));
    } else {
      body.remainingClientGenerations = Math.max(0, CLIENT_GENERATION_CAP - referee.clientGenerationCount);
      body.generationCap = CLIENT_GENERATION_CAP;
    }

    res.json(body);
  },
);

// ─── Staff manual edit of the current draft ──────────────────────────────────────

const EditInput = z.object({ content: z.string().min(1, "Content cannot be empty") });

router.put(
  "/referees/:id/letter-draft",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const draft = await currentDraft(refereeId);
    if (!draft || draft.status !== "draft") {
      res.status(404).json({ error: "No editable draft for this referee" });
      return;
    }

    const parsed = EditInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const [updated] = await db
      .update(letterDraftsTable)
      .set({ content: parsed.data.content, wasManuallyEdited: true, updatedAt: new Date() })
      .where(eq(letterDraftsTable.id, draft.id))
      .returning();

    logger.info({ refereeId, draftId: draft.id }, "[letterDrafts] draft manually edited");
    res.json({ draft: updated });
  },
);

// ─── Staff: finalize (render DOCX → Step 2 upload flow) ──────────────────────────

router.post(
  "/referees/:id/letter-draft/finalize",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const refereeId = parseInt(req.params.id as string, 10);
    const referee = await loadAuthorizedReferee(aug, res, refereeId);
    if (!referee) return;

    const draft = await currentDraft(refereeId);
    if (!draft) {
      res.status(404).json({ error: "No draft to finalize for this referee" });
      return;
    }
    if (draft.status === "finalized") {
      res.status(409).json({ error: "This draft has already been finalized" });
      return;
    }

    // Eligibility gate (also blocks when a letter is already pending/confirmed).
    const elig = await checkEligibility(referee);
    if (!elig.ok) {
      res.status(400).json({ error: "Cannot finalize yet", reasons: elig.reasons });
      return;
    }

    // Render the markdown draft to a professional DOCX.
    let buffer: Buffer;
    try {
      buffer = await markdownToLetterDocx(draft.content);
    } catch (err) {
      logger.error({ err, refereeId }, "[letterDrafts] DOCX render failed");
      res.status(500).json({ error: "Could not render the letter document" });
      return;
    }

    // Splice into the SAME Step 2 upload path (Drive upload + reference_letters
    // row 'pending_review' + client review email).
    let result;
    try {
      result = await ingestReferenceLetter(referee, buffer, DOCX_MIME);
    } catch (err) {
      if (err instanceof LetterIngestError) {
        res.status(err.httpStatus).json({ error: err.message });
        return;
      }
      logger.error({ err, refereeId }, "[letterDrafts] finalize upload failed");
      res.status(502).json({ error: "Could not upload the finalized letter" });
      return;
    }

    const [finalized] = await db
      .update(letterDraftsTable)
      .set({ status: "finalized", updatedAt: new Date() })
      .where(eq(letterDraftsTable.id, draft.id))
      .returning();

    logger.info(
      { refereeId, draftId: draft.id, letterId: result.letter.id, version: result.letter.version },
      "[letterDrafts] draft finalized → reference letter created",
    );
    res.status(201).json({ letter: result.letter, draft: finalized, warning: result.warning });
  },
);

// ─── Per-referee current draft status for a case (row chips) ─────────────────────

router.get(
  "/cases/:caseId/referee-draft-status",
  requireAnyAuth,
  async (req: Request, res: Response): Promise<void> => {
    const aug = req as AugmentedRequest;
    const caseId = parseInt(req.params.caseId as string, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ error: "Invalid caseId" });
      return;
    }
    const [caseRecord] = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.id, caseId))
      .limit(1);
    if (!caseRecord) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    if (aug.clientUser && caseRecord.profileId !== aug.clientUser.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const rows = await db
      .select({
        refereeId: letterDraftsTable.refereeId,
        status: letterDraftsTable.status,
        version: letterDraftsTable.version,
        generatedBy: letterDraftsTable.generatedBy,
        feedbackProvided: letterDraftsTable.feedbackProvided,
      })
      .from(letterDraftsTable)
      .innerJoin(refereesTable, eq(refereesTable.id, letterDraftsTable.refereeId))
      .where(and(eq(refereesTable.caseId, caseId), ne(letterDraftsTable.status, "superseded")))
      .orderBy(desc(letterDraftsTable.version));

    const seen = new Set<number>();
    const statuses = [];
    for (const r of rows) {
      if (seen.has(r.refereeId)) continue;
      seen.add(r.refereeId);
      statuses.push({
        refereeId: r.refereeId,
        status: r.status,
        version: r.version,
        clientRequestedChanges: r.generatedBy === "client" && !!r.feedbackProvided && r.status !== "finalized",
      });
    }
    res.json({ statuses });
  },
);

export default router;
