/**
 * petitionAdmin.ts — Pinnacle³
 *
 * Staff-only petition document generation and management routes.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  casePetitionSetupTable,
  caseFoldersTable,
  petitionCriteriaExhibitsTable,
  petitionRecoLettersTable,
  petitionPackageTable,
  documentGenerationJobsTable,
  activityTable,
  clientActivityLogTable,
  visaCriteriaTable,
  profilesTable,
  clientUserProductsTable,
  channelRenewalFailuresTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { createCaseFolders } from "../services/createCaseFolders";
import { sendEmail, caseActivationEmail } from "../services/emailService";
import { logger } from "../lib/logger";
import {
  generateCriteriaExhibit,
  generateRecoLetter,
  generateExhibitIndex,
  generateCoverLetter,
} from "../services/petitionDocumentGenerator";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExhibitNumber(index: number, style: string): string {
  if (style === "alpha") return String.fromCharCode(65 + index);
  if (style === "roman") {
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romans[index] ?? String(index + 1);
  }
  return String(index + 1);
}

async function notifyClient(
  profileId: number,
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(clientActivityLogTable).values({
      profileId,
      eventType,
      eventData: { message, ...metadata },
    });
    await db.insert(activityTable).values({
      profileId,
      type: eventType,
      description: message,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("[petitionAdmin] notification error:", err);
  }
}

// ─── GET /internal/visa-criteria ──────────────────────────────────────────────
// Returns all criteria rows for a given visaPath (e.g. "eb1a", "niw", "o1").
// Used by the frontend Convert-to-Case modal to render the criteria checklist.

router.get(
  "/internal/visa-criteria",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const visaPath = typeof req.query.visaPath === "string" ? req.query.visaPath.trim() : "";
    if (!visaPath) {
      res.status(400).json({ error: "visaPath query param is required" });
      return;
    }
    const criteria = await db
      .select({
        id: visaCriteriaTable.id,
        criteriaCode: visaCriteriaTable.criteriaCode,
        criteriaName: visaCriteriaTable.criteriaName,
        displayOrder: visaCriteriaTable.displayOrder,
        isCommon: visaCriteriaTable.isCommon,
      })
      .from(visaCriteriaTable)
      .where(eq(visaCriteriaTable.visaPath, visaPath))
      .orderBy(visaCriteriaTable.displayOrder);
    res.json({ criteria });
  },
);

// ─── POST /internal/petition/setup ────────────────────────────────────────────

const SetupBody = z.object({
  userId: z.number().int(),
  visaPath: z.string(),
  selectedCriteria: z.array(z.string()),
  exhibitNumberingStyle: z.enum(["numeric", "alpha", "roman"]).default("numeric"),
  product: z.enum(["evidence_engine", "elite_blueprint", "both"]).optional(),
});

const PRODUCT_LABELS: Record<string, string> = {
  evidence_engine: "Evidence Engine",
  elite_blueprint: "Elite Blueprint",
  both: "Evidence Engine + Elite Blueprint",
};

const VISA_PATH_LABELS: Record<string, string> = {
  eb1a: "EB-1A",
  niw: "EB-2 NIW",
  o1: "O-1A",
};

router.post(
  "/internal/petition/setup",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SetupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const { userId, visaPath, selectedCriteria, exhibitNumberingStyle, product } = parsed.data;

    // Fetch visa criteria details for selected IDs
    const criteriaDetails = await db
      .select()
      .from(visaCriteriaTable)
      .where(eq(visaCriteriaTable.visaPath, visaPath));

    const selectedDetails = criteriaDetails.filter((c) => selectedCriteria.includes(c.id));

    // Create petition setup
    const [setup] = await db
      .insert(casePetitionSetupTable)
      .values({
        profileId: userId,
        visaPath,
        selectedCriteria: selectedCriteria,
        exhibitNumberingStyle,
        status: "setup",
        createdByStaff: "staff",
        driveSyncStatus: "pending",
        ...(product ? { product } : {}),
      })
      .returning();

    // Create criteria exhibit rows
    const exhibitRows = selectedDetails.map((criterion, idx) => ({
      caseSetupId: setup.id,
      profileId: userId,
      criteriaId: criterion.id,
      criteriaCode: criterion.criteriaCode,
      criteriaName: criterion.criteriaName,
      exhibitNumber: getExhibitNumber(idx, exhibitNumberingStyle),
      status: "not_started",
    }));

    const exhibits = exhibitRows.length
      ? await db.insert(petitionCriteriaExhibitsTable).values(exhibitRows).returning()
      : [];

    // Create petition package row
    const [pkg] = await db
      .insert(petitionPackageTable)
      .values({
        caseSetupId: setup.id,
        profileId: userId,
        exhibitIndexStatus: "not_started",
        coverLetterStatus: "not_started",
      })
      .returning();

    // ── Grant product access to the client profile ──────────────────────────────
    // Maps the staff-selected product to the profile accessLevel and inserts
    // clientUserProducts rows so the client can access their products on login.
    const PRODUCT_ACCESS_MAP: Record<string, { level: string; products: string[] }> = {
      evidence_engine: { level: "evidence_vault", products: ["evidence_engine"] },
      elite_blueprint: { level: "elite_blueprint", products: ["elite_blueprint"] },
      both: { level: "elite_blueprint", products: ["evidence_engine", "elite_blueprint"] },
    };
    if (product) {
      const grant = PRODUCT_ACCESS_MAP[product];
      if (grant) {
        const [clientProfile] = await db
          .select({ email: profilesTable.email })
          .from(profilesTable)
          .where(eq(profilesTable.id, userId))
          .limit(1);
        if (clientProfile) {
          await db
            .update(profilesTable)
            .set({ accessLevel: grant.level })
            .where(eq(profilesTable.id, userId));
          for (const prod of grant.products) {
            await db
              .insert(clientUserProductsTable)
              .values({
                profileId: userId,
                clientEmail: clientProfile.email,
                product: prod,
                status: "active",
                offlinePayment: true,
                grantedByStaffId: (req as any).staffUser?.id ?? "staff",
                grantNotes: `Granted via staff case setup #${setup.id}`,
              })
              .onConflictDoNothing();
          }
        }
      }
    }

    // Write case-setup audit entry (synchronous — always recorded)
    const staffUser = (req as any).staffUser as { id?: string; name?: string } | undefined;
    await notifyClient(userId, "case_setup_audit", `Case #${setup.id} provisioned by staff (${staffUser?.name ?? "unknown"})`, {
      caseId: setup.id,
      profileId: userId,
      product: product ?? null,
      visaPath,
      criteriaCount: selectedCriteria.length,
      staffUserId: staffUser?.id ?? "unknown",
      staffUserName: staffUser?.name ?? "unknown",
      driveSyncStatus: "pending",
      caseActivationEmailStatus: "pending",
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ setup, exhibits, package: pkg });

    // ── Async post-response work — does not block the 201 ─────────────────────

    // Fire Drive folder creation
    createCaseFolders(setup.id).catch((err) =>
      logger.error({ caseId: setup.id, err }, "[petitionAdmin] createCaseFolders background error"),
    );

    // Send case activation email to the client
    void (async () => {
      try {
        const [clientProfile] = await db
          .select({ name: profilesTable.name, firstName: profilesTable.firstName, email: profilesTable.email })
          .from(profilesTable)
          .where(eq(profilesTable.id, userId))
          .limit(1);

        if (!clientProfile) {
          logger.warn({ caseId: setup.id, userId }, "[petitionAdmin] activation email: profile not found");
          return;
        }

        const firstName = clientProfile.firstName ?? clientProfile.name.split(" ")[0] ?? clientProfile.name;
        const productLabel = PRODUCT_LABELS[product ?? ""] ?? "Pinnacle³";
        const visaLabel = VISA_PATH_LABELS[visaPath.toLowerCase()] ?? visaPath.toUpperCase();

        await sendEmail(clientProfile.email, caseActivationEmail(firstName, productLabel, visaLabel));

        await db
          .update(casePetitionSetupTable)
          .set({ caseActivationEmailSentAt: new Date(), caseActivationEmailStatus: "sent" })
          .where(eq(casePetitionSetupTable.id, setup.id));

        logger.info({ caseId: setup.id, to: clientProfile.email }, "[petitionAdmin] case activation email sent");
      } catch (emailErr) {
        logger.error({ caseId: setup.id, err: emailErr }, "[petitionAdmin] case activation email failed");
        await db
          .update(casePetitionSetupTable)
          .set({ caseActivationEmailStatus: "failed" })
          .where(eq(casePetitionSetupTable.id, setup.id))
          .catch(() => {});
      }
    })();
  },
);

// ─── GET /internal/petition/setup/:userId ─────────────────────────────────────

router.get(
  "/internal/petition/setup/:userId",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const setups = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.profileId, userId));

    const result = await Promise.all(
      setups.map(async (setup) => {
        const exhibits = await db
          .select()
          .from(petitionCriteriaExhibitsTable)
          .where(eq(petitionCriteriaExhibitsTable.caseSetupId, setup.id));
        const recos = await db
          .select()
          .from(petitionRecoLettersTable)
          .where(eq(petitionRecoLettersTable.caseSetupId, setup.id));
        const [pkg] = await db
          .select()
          .from(petitionPackageTable)
          .where(eq(petitionPackageTable.caseSetupId, setup.id))
          .limit(1);
        return { setup, exhibits, recoLetters: recos, package: pkg ?? null };
      }),
    );

    res.json({ cases: result });
  },
);

// ─── PATCH /internal/petition/setup/:caseSetupId/evidence-mapping ─────────────

const EvidenceMappingBody = z.object({
  criteriaExhibitId: z.number().int(),
  evidenceItemIds: z.array(z.number().int()),
});

router.patch(
  "/internal/petition/setup/:caseSetupId/evidence-mapping",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) {
      res.status(400).json({ error: "Invalid caseSetupId" });
      return;
    }

    const parsed = EvidenceMappingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const [updated] = await db
      .update(petitionCriteriaExhibitsTable)
      .set({ evidenceItemIds: parsed.data.evidenceItemIds })
      .where(
        and(
          eq(petitionCriteriaExhibitsTable.id, parsed.data.criteriaExhibitId),
          eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Criteria exhibit not found in this case setup" });
      return;
    }

    res.json({ success: true, criteriaExhibit: updated });
  },
);

// ─── POST /internal/petition/criteria/:criteriaExhibitId/generate ─────────────

router.post(
  "/internal/petition/criteria/:criteriaExhibitId/generate",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const criteriaExhibitId = parseInt(req.params.criteriaExhibitId, 10);
    if (isNaN(criteriaExhibitId)) {
      res.status(400).json({ error: "Invalid criteriaExhibitId" });
      return;
    }

    const [exhibit] = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.id, criteriaExhibitId))
      .limit(1);

    if (!exhibit) {
      res.status(404).json({ error: "Criteria exhibit not found" });
      return;
    }

    if (exhibit.status === "generating") {
      res.status(409).json({ error: "Generation already in progress" });
      return;
    }

    // Create generation job
    const [job] = await db
      .insert(documentGenerationJobsTable)
      .values({
        profileId: exhibit.profileId,
        triggeredByStaffId: "staff",
        caseSetupId: exhibit.caseSetupId,
        criteriaCode: exhibit.criteriaCode,
        docSubtype: "criteria_exhibit",
        status: "pending",
        inputPayload: { criteriaExhibitId, criteriaCode: exhibit.criteriaCode },
      })
      .returning();

    // Set status to generating
    await db
      .update(petitionCriteriaExhibitsTable)
      .set({ status: "generating", generationJobId: job.id })
      .where(eq(petitionCriteriaExhibitsTable.id, criteriaExhibitId));

    // Fire async generation
    setImmediate(() => {
      // Fetch prior approved exhibit IDs for context
      db.select({ id: petitionCriteriaExhibitsTable.id })
        .from(petitionCriteriaExhibitsTable)
        .where(
          and(
            eq(petitionCriteriaExhibitsTable.caseSetupId, exhibit.caseSetupId),
            eq(petitionCriteriaExhibitsTable.status, "approved"),
          ),
        )
        .then((priorRows) => {
          const priorIds = priorRows.map((r) => r.id);
          return generateCriteriaExhibit(criteriaExhibitId, priorIds);
        })
        .then(() => {
          // Update job status
          return db
            .update(documentGenerationJobsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(documentGenerationJobsTable.id, job.id));
        })
        .then(() => {
          console.info(
            `[staff-notify] ${exhibit.criteriaName} exhibit draft ready (exhibit ${criteriaExhibitId})`,
          );
        })
        .catch(async (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[petitionAdmin] Criteria exhibit generation failed:`, err);
          await db
            .update(documentGenerationJobsTable)
            .set({ status: "failed", errorMessage: msg })
            .where(eq(documentGenerationJobsTable.id, job.id))
            .catch(() => {});
          await db
            .update(petitionCriteriaExhibitsTable)
            .set({ status: "not_started" })
            .where(eq(petitionCriteriaExhibitsTable.id, criteriaExhibitId))
            .catch(() => {});
        });
    });

    res.status(202).json({ jobId: job.id, status: "generating" });
  },
);

// ─── POST /internal/petition/criteria/:criteriaExhibitId/approve ──────────────

router.post(
  "/internal/petition/criteria/:criteriaExhibitId/approve",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.criteriaExhibitId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [exhibit] = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.id, id))
      .limit(1);

    if (!exhibit) { res.status(404).json({ error: "Not found" }); return; }
    if (exhibit.status !== "draft") {
      res.status(400).json({ error: `Cannot approve — status is '${exhibit.status}'. Must be 'draft'.` });
      return;
    }

    const [updated] = await db
      .update(petitionCriteriaExhibitsTable)
      .set({ status: "approved", staffApprovedBy: "staff", staffApprovedAt: new Date() })
      .where(eq(petitionCriteriaExhibitsTable.id, id))
      .returning();

    res.json({ success: true, criteriaExhibit: updated });
  },
);

// ─── POST /internal/petition/criteria/:criteriaExhibitId/regenerate ───────────

router.post(
  "/internal/petition/criteria/:criteriaExhibitId/regenerate",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.criteriaExhibitId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [exhibit] = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.id, id))
      .limit(1);

    if (!exhibit) { res.status(404).json({ error: "Not found" }); return; }

    await db
      .update(petitionCriteriaExhibitsTable)
      .set({
        status: "not_started",
        regenerationCount: (exhibit.regenerationCount ?? 0) + 1,
        staffApprovedBy: null,
        staffApprovedAt: null,
      })
      .where(eq(petitionCriteriaExhibitsTable.id, id));

    // Re-trigger generation via same generate endpoint logic
    const [job] = await db
      .insert(documentGenerationJobsTable)
      .values({
        profileId: exhibit.profileId,
        triggeredByStaffId: "staff",
        caseSetupId: exhibit.caseSetupId,
        criteriaCode: exhibit.criteriaCode,
        docSubtype: "criteria_exhibit",
        status: "pending",
        inputPayload: { criteriaExhibitId: id, criteriaCode: exhibit.criteriaCode, regeneration: true },
      })
      .returning();

    await db
      .update(petitionCriteriaExhibitsTable)
      .set({ status: "generating", generationJobId: job.id })
      .where(eq(petitionCriteriaExhibitsTable.id, id));

    setImmediate(() => {
      generateCriteriaExhibit(id, [])
        .then(() =>
          db
            .update(documentGenerationJobsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(documentGenerationJobsTable.id, job.id)),
        )
        .catch(async (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          await db
            .update(documentGenerationJobsTable)
            .set({ status: "failed", errorMessage: msg })
            .where(eq(documentGenerationJobsTable.id, job.id))
            .catch(() => {});
          await db
            .update(petitionCriteriaExhibitsTable)
            .set({ status: "not_started" })
            .where(eq(petitionCriteriaExhibitsTable.id, id))
            .catch(() => {});
        });
    });

    res.status(202).json({ jobId: job.id, status: "generating", regenerationCount: (exhibit.regenerationCount ?? 0) + 1 });
  },
);

// ─── POST /internal/petition/criteria/:id/publish-individual ──────────────────

router.post(
  "/internal/petition/criteria/:id/publish-individual",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [exhibit] = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.id, id))
      .limit(1);

    if (!exhibit) { res.status(404).json({ error: "Not found" }); return; }
    if (exhibit.status !== "approved") {
      res.status(400).json({ error: "Can only publish approved exhibits" });
      return;
    }

    await db
      .update(petitionCriteriaExhibitsTable)
      .set({ publishedToClient: true })
      .where(eq(petitionCriteriaExhibitsTable.id, id));

    await notifyClient(
      exhibit.profileId,
      "petition_exhibit_published",
      `Exhibit Tab ${exhibit.exhibitNumber} — ${exhibit.criteriaName} has been shared with you.`,
      { exhibitId: id },
    );

    res.json({ success: true });
  },
);

// ─── POST /internal/petition/reco-letters ────────────────────────────────────

const CreateRecoBody = z.object({
  caseSetupId: z.number().int(),
  userId: z.number().int(),
  recommenderName: z.string().min(1),
  recommenderTitle: z.string().min(1),
  recommenderOrg: z.string().min(1),
  recommenderRelationship: z.string().min(1),
  recommenderCredentials: z.string().optional(),
  criteriaSupported: z.array(z.string()).optional(),
});

router.post(
  "/internal/petition/reco-letters",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateRecoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const [reco] = await db
      .insert(petitionRecoLettersTable)
      .values({
        caseSetupId: parsed.data.caseSetupId,
        profileId: parsed.data.userId,
        recommenderName: parsed.data.recommenderName,
        recommenderTitle: parsed.data.recommenderTitle,
        recommenderOrg: parsed.data.recommenderOrg,
        recommenderRelationship: parsed.data.recommenderRelationship,
        recommenderCredentials: parsed.data.recommenderCredentials ?? null,
        criteriaSupported: parsed.data.criteriaSupported ?? [],
        status: "not_started",
      })
      .returning();

    res.status(201).json({ recoLetter: reco });
  },
);

// ─── POST /internal/petition/reco-letters/:id/generate ───────────────────────

router.post(
  "/internal/petition/reco-letters/:id/generate",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [reco] = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(eq(petitionRecoLettersTable.id, id))
      .limit(1);

    if (!reco) { res.status(404).json({ error: "Not found" }); return; }
    if (reco.status === "generating") {
      res.status(409).json({ error: "Generation already in progress" });
      return;
    }

    const [job] = await db
      .insert(documentGenerationJobsTable)
      .values({
        profileId: reco.profileId,
        triggeredByStaffId: "staff",
        caseSetupId: reco.caseSetupId,
        docSubtype: "recommendation_letter",
        status: "pending",
        inputPayload: { recoLetterId: id, recommenderName: reco.recommenderName },
      })
      .returning();

    await db
      .update(petitionRecoLettersTable)
      .set({ status: "generating", generationJobId: job.id })
      .where(eq(petitionRecoLettersTable.id, id));

    setImmediate(() => {
      generateRecoLetter(id)
        .then(() =>
          db
            .update(documentGenerationJobsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(documentGenerationJobsTable.id, job.id)),
        )
        .catch(async (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          await db
            .update(documentGenerationJobsTable)
            .set({ status: "failed", errorMessage: msg })
            .where(eq(documentGenerationJobsTable.id, job.id))
            .catch(() => {});
          await db
            .update(petitionRecoLettersTable)
            .set({ status: "not_started" })
            .where(eq(petitionRecoLettersTable.id, id))
            .catch(() => {});
        });
    });

    res.status(202).json({ jobId: job.id, status: "generating" });
  },
);

// ─── POST /internal/petition/reco-letters/:id/approve ────────────────────────

router.post(
  "/internal/petition/reco-letters/:id/approve",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [reco] = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(eq(petitionRecoLettersTable.id, id))
      .limit(1);

    if (!reco) { res.status(404).json({ error: "Not found" }); return; }
    if (reco.status !== "draft") {
      res.status(400).json({ error: `Cannot approve — status is '${reco.status}'. Must be 'draft'.` });
      return;
    }

    const [updated] = await db
      .update(petitionRecoLettersTable)
      .set({ status: "approved", staffApprovedBy: "staff", staffApprovedAt: new Date() })
      .where(eq(petitionRecoLettersTable.id, id))
      .returning();

    res.json({ success: true, recoLetter: updated });
  },
);

// ─── POST /internal/petition/reco-letters/:id/publish ────────────────────────

router.post(
  "/internal/petition/reco-letters/:id/publish",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [reco] = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(eq(petitionRecoLettersTable.id, id))
      .limit(1);

    if (!reco) { res.status(404).json({ error: "Not found" }); return; }
    if (reco.status !== "approved") {
      res.status(400).json({ error: "Can only publish approved reco letters" });
      return;
    }

    await db
      .update(petitionRecoLettersTable)
      .set({ publishedToClient: true })
      .where(eq(petitionRecoLettersTable.id, id));

    await notifyClient(
      reco.profileId,
      "petition_reco_published",
      `Recommendation letter from ${reco.recommenderName} has been shared with you.`,
      { recoLetterId: id },
    );

    res.json({ success: true });
  },
);

// ─── POST /internal/petition/package/:caseSetupId/generate-index ──────────────

router.post(
  "/internal/petition/package/:caseSetupId/generate-index",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    // Gate: all selected criteria must be approved
    const exhibits = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId));

    const unapproved = exhibits.filter((e) => e.status !== "approved");
    if (unapproved.length > 0) {
      res.status(400).json({
        error: "Cannot generate exhibit index — unapproved criteria exhibits remain",
        unapprovedCriteria: unapproved.map((e) => `Tab ${e.exhibitNumber}: ${e.criteriaName} (${e.status})`),
      });
      return;
    }

    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .limit(1);

    if (!pkg) { res.status(404).json({ error: "Petition package not found" }); return; }

    const [job] = await db
      .insert(documentGenerationJobsTable)
      .values({
        profileId: pkg.profileId,
        triggeredByStaffId: "staff",
        caseSetupId,
        docSubtype: "exhibit_index",
        status: "pending",
        inputPayload: { caseSetupId },
      })
      .returning();

    await db
      .update(petitionPackageTable)
      .set({ exhibitIndexStatus: "generating", exhibitIndexJobId: job.id })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    setImmediate(() => {
      generateExhibitIndex(caseSetupId)
        .then(() =>
          db
            .update(documentGenerationJobsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(documentGenerationJobsTable.id, job.id)),
        )
        .catch(async (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          await db
            .update(documentGenerationJobsTable)
            .set({ status: "failed", errorMessage: msg })
            .where(eq(documentGenerationJobsTable.id, job.id))
            .catch(() => {});
          await db
            .update(petitionPackageTable)
            .set({ exhibitIndexStatus: "not_started" })
            .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
            .catch(() => {});
        });
    });

    res.status(202).json({ jobId: job.id, status: "generating" });
  },
);

// ─── POST /internal/petition/package/:caseSetupId/approve-index ──────────────

router.post(
  "/internal/petition/package/:caseSetupId/approve-index",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .limit(1);

    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    if (pkg.exhibitIndexStatus !== "draft") {
      res.status(400).json({ error: `Cannot approve — exhibitIndexStatus is '${pkg.exhibitIndexStatus}'` });
      return;
    }

    const [updated] = await db
      .update(petitionPackageTable)
      .set({ exhibitIndexStatus: "approved" })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .returning();

    res.json({ success: true, package: updated });
  },
);

// ─── POST /internal/petition/package/:caseSetupId/generate-cover ──────────────

router.post(
  "/internal/petition/package/:caseSetupId/generate-cover",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .limit(1);

    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

    // Gate: exhibit index must be approved
    if (pkg.exhibitIndexStatus !== "approved") {
      res.status(400).json({
        error: "Cannot generate cover letter — exhibit index must be approved first",
        exhibitIndexStatus: pkg.exhibitIndexStatus,
      });
      return;
    }

    // Additional gate: all criteria must be approved, all reco letters must be approved
    const exhibits = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId));

    const unapprovedExhibits = exhibits.filter((e) => e.status !== "approved");
    if (unapprovedExhibits.length > 0) {
      res.status(400).json({
        error: "All criteria exhibits must be approved before generating cover letter",
        unapprovedCriteria: unapprovedExhibits.map((e) => e.criteriaName),
      });
      return;
    }

    const recos = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(eq(petitionRecoLettersTable.caseSetupId, caseSetupId));

    const unapprovedRecos = recos.filter((r) => r.status !== "approved");
    if (unapprovedRecos.length > 0) {
      res.status(400).json({
        error: "All recommendation letters must be approved before generating cover letter",
        unapprovedRecos: unapprovedRecos.map((r) => r.recommenderName),
      });
      return;
    }

    const [job] = await db
      .insert(documentGenerationJobsTable)
      .values({
        profileId: pkg.profileId,
        triggeredByStaffId: "staff",
        caseSetupId,
        docSubtype: "cover_letter",
        status: "pending",
        inputPayload: { caseSetupId },
      })
      .returning();

    await db
      .update(petitionPackageTable)
      .set({ coverLetterStatus: "generating", coverLetterJobId: job.id })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    setImmediate(() => {
      generateCoverLetter(caseSetupId)
        .then(() =>
          db
            .update(documentGenerationJobsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(documentGenerationJobsTable.id, job.id)),
        )
        .catch(async (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          await db
            .update(documentGenerationJobsTable)
            .set({ status: "failed", errorMessage: msg })
            .where(eq(documentGenerationJobsTable.id, job.id))
            .catch(() => {});
          await db
            .update(petitionPackageTable)
            .set({ coverLetterStatus: "not_started" })
            .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
            .catch(() => {});
        });
    });

    res.status(202).json({ jobId: job.id, status: "generating" });
  },
);

// ─── POST /internal/petition/package/:caseSetupId/approve-cover ──────────────

router.post(
  "/internal/petition/package/:caseSetupId/approve-cover",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .limit(1);

    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    if (pkg.coverLetterStatus !== "draft") {
      res.status(400).json({ error: `Cannot approve — coverLetterStatus is '${pkg.coverLetterStatus}'` });
      return;
    }

    const [updated] = await db
      .update(petitionPackageTable)
      .set({ coverLetterStatus: "approved" })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .returning();

    res.json({ success: true, package: updated });
  },
);

// ─── POST /internal/petition/package/:caseSetupId/publish-full ───────────────

router.post(
  "/internal/petition/package/:caseSetupId/publish-full",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) { res.status(400).json({ error: "Invalid caseSetupId" }); return; }

    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId))
      .limit(1);

    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

    // Gate: cover letter must be approved
    if (pkg.coverLetterStatus !== "approved") {
      res.status(400).json({
        error: "Cannot publish package — cover letter must be approved first",
        coverLetterStatus: pkg.coverLetterStatus,
      });
      return;
    }

    // Publish all approved exhibits
    const exhibits = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(
        and(
          eq(petitionCriteriaExhibitsTable.caseSetupId, caseSetupId),
          eq(petitionCriteriaExhibitsTable.status, "approved"),
        ),
      );

    const recos = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(
        and(
          eq(petitionRecoLettersTable.caseSetupId, caseSetupId),
          eq(petitionRecoLettersTable.status, "approved"),
        ),
      );

    let publishedCount = 0;

    // Publish exhibits
    for (const exhibit of exhibits) {
      if (exhibit.publishedToClient) { publishedCount++; continue; }
      await db
        .update(petitionCriteriaExhibitsTable)
        .set({ publishedToClient: true })
        .where(eq(petitionCriteriaExhibitsTable.id, exhibit.id));
      publishedCount++;
    }

    // Publish reco letters
    for (const reco of recos) {
      if (reco.publishedToClient) { publishedCount++; continue; }
      await db
        .update(petitionRecoLettersTable)
        .set({ publishedToClient: true })
        .where(eq(petitionRecoLettersTable.id, reco.id));
      publishedCount++;
    }

    // Mark package as published
    await db
      .update(petitionPackageTable)
      .set({ packagePublishedAt: new Date(), packagePublishedBy: "staff" })
      .where(eq(petitionPackageTable.caseSetupId, caseSetupId));

    // Notify client
    await notifyClient(
      pkg.profileId,
      "petition_package_published",
      `Your petition package is ready — ${publishedCount} document${publishedCount !== 1 ? "s" : ""} shared with you.`,
      { caseSetupId, publishedCount },
    );

    console.info(`[staff] Full package published for caseSetup ${caseSetupId}: ${publishedCount} docs`);
    res.json({ success: true, publishedCount });
  },
);

// ─── GET /internal/drive/channel-renewal-failures ────────────────────────────

router.get(
  "/internal/drive/channel-renewal-failures",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const failures = await db
      .select({
        id: channelRenewalFailuresTable.id,
        caseId: channelRenewalFailuresTable.caseId,
        clientName: profilesTable.name,
        clientEmail: profilesTable.email,
        oldChannelId: channelRenewalFailuresTable.oldChannelId,
        driveFolderId: channelRenewalFailuresTable.driveFolderId,
        errorMessage: channelRenewalFailuresTable.errorMessage,
        failedAt: channelRenewalFailuresTable.failedAt,
      })
      .from(channelRenewalFailuresTable)
      .innerJoin(
        casePetitionSetupTable,
        eq(casePetitionSetupTable.id, channelRenewalFailuresTable.caseId),
      )
      .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
      .orderBy(channelRenewalFailuresTable.failedAt);

    res.json({ failures });
  },
);

// ─── GET /internal/petition/failed-drive-syncs ───────────────────────────────

router.get(
  "/internal/petition/failed-drive-syncs",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const failed = await db
      .select({
        caseId: casePetitionSetupTable.id,
        profileId: casePetitionSetupTable.profileId,
        visaPath: casePetitionSetupTable.visaPath,
        driveSyncStatus: casePetitionSetupTable.driveSyncStatus,
        driveSyncError: casePetitionSetupTable.driveSyncError,
        clientName: profilesTable.name,
        clientEmail: profilesTable.email,
        createdAt: casePetitionSetupTable.createdAt,
      })
      .from(casePetitionSetupTable)
      .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
      .where(eq(casePetitionSetupTable.driveSyncStatus, "failed"));

    res.json({ cases: failed });
  },
);

// ─── POST /internal/petition/setup/:caseId/retry-drive ───────────────────────

router.post(
  "/internal/petition/setup/:caseId/retry-drive",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseId = parseInt(req.params.caseId as string, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ error: "Invalid caseId" });
      return;
    }

    const [caseSetup] = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.id, caseId))
      .limit(1);

    if (!caseSetup) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    // Clear any partial folder records from the previous attempt
    await db.delete(caseFoldersTable).where(eq(caseFoldersTable.caseId, caseId));

    // Run synchronously so the caller gets a definitive result
    await createCaseFolders(caseId);

    const [updated] = await db
      .select({
        driveSyncStatus: casePetitionSetupTable.driveSyncStatus,
        driveSyncError: casePetitionSetupTable.driveSyncError,
      })
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.id, caseId))
      .limit(1);

    res.json({
      success: updated?.driveSyncStatus === "synced",
      driveSyncStatus: updated?.driveSyncStatus,
      driveSyncError: updated?.driveSyncError ?? null,
    });
  },
);

export default router;
