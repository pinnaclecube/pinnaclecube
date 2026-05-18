/**
 * petitionClient.ts — Pinnacle³
 *
 * Client-facing read-only petition document endpoint.
 * Returns only published documents; no draft URLs, no staff info.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  casePetitionSetupTable,
  petitionCriteriaExhibitsTable,
  petitionRecoLettersTable,
  petitionPackageTable,
  exhibitDocumentsTable,
} from "@workspace/db";
import { requireClientAuth } from "../middlewares/clientAuth";

const router: IRouter = Router();

type AuthedRequest = Request & { clientUser: { id: number; email: string } };

router.get(
  "/petition/my-documents",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as AuthedRequest).clientUser;

    // Find the most recent case setup for this user
    const setups = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.profileId, user.id));

    if (!setups.length) {
      res.json({ criteriaExhibits: [], recoLetters: [], package: null });
      return;
    }

    // Use the most recent setup
    const setup = setups.sort((a, b) => b.id - a.id)[0];

    // Published criteria exhibits — return only safe fields
    const allExhibits = await db
      .select()
      .from(petitionCriteriaExhibitsTable)
      .where(
        and(
          eq(petitionCriteriaExhibitsTable.caseSetupId, setup.id),
          eq(petitionCriteriaExhibitsTable.publishedToClient, true),
        ),
      );

    const criteriaExhibits = allExhibits.map((e) => ({
      id: e.id,
      criteriaName: e.criteriaName,
      criteriaCode: e.criteriaCode,
      exhibitNumber: e.exhibitNumber,
      publishedToClient: e.publishedToClient,
    }));

    // Published reco letters — return only safe fields
    const allRecos = await db
      .select()
      .from(petitionRecoLettersTable)
      .where(
        and(
          eq(petitionRecoLettersTable.caseSetupId, setup.id),
          eq(petitionRecoLettersTable.publishedToClient, true),
        ),
      );

    const recoLetters = allRecos.map((r) => ({
      id: r.id,
      recommenderName: r.recommenderName,
      recommenderTitle: r.recommenderTitle,
      recommenderOrg: r.recommenderOrg,
      publishedToClient: r.publishedToClient,
    }));

    // Package-level documents
    const [pkg] = await db
      .select()
      .from(petitionPackageTable)
      .where(eq(petitionPackageTable.caseSetupId, setup.id))
      .limit(1);

    const packageDocs = pkg
      ? {
          exhibitIndex: pkg.exhibitIndexStatus === "approved" ? {} : null,
          coverLetter: pkg.coverLetterStatus === "approved" ? {} : null,
          publishedAt: pkg.packagePublishedAt ?? null,
        }
      : null;

    res.json({
      visaPath: setup.visaPath,
      criteriaExhibits,
      recoLetters,
      package: packageDocs,
      totalDocuments: criteriaExhibits.length + recoLetters.length,
    });
  },
);

// ─── GET /petition/my-exhibits ───────────────────────────────────────────────
// Returns published exhibit_documents enriched with criteriaName + exhibit
// letter from petition_criteria_exhibits. Strips all internal fields.

router.get(
  "/petition/my-exhibits",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as AuthedRequest).clientUser;

    const setups = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.profileId, user.id));

    if (!setups.length) {
      res.json({ exhibits: [], visaPath: null });
      return;
    }

    const setup = setups.sort((a, b) => b.id - a.id)[0];

    // Published exhibit documents
    const docs = await db
      .select()
      .from(exhibitDocumentsTable)
      .where(
        and(
          eq(exhibitDocumentsTable.caseSetupId, setup.id),
          eq(exhibitDocumentsTable.publishedToClient, true),
        ),
      );

    if (!docs.length) {
      res.json({ exhibits: [], visaPath: setup.visaPath });
      return;
    }

    // Criteria exhibits for enrichment (criteriaName + exhibitNumber/letter)
    const criteriaRows = await db
      .select({
        criteriaCode: petitionCriteriaExhibitsTable.criteriaCode,
        criteriaName: petitionCriteriaExhibitsTable.criteriaName,
        exhibitNumber: petitionCriteriaExhibitsTable.exhibitNumber,
      })
      .from(petitionCriteriaExhibitsTable)
      .where(eq(petitionCriteriaExhibitsTable.caseSetupId, setup.id));

    const criteriaMap = new Map(
      criteriaRows.map((c) => [c.criteriaCode, { criteriaName: c.criteriaName, exhibitLabel: c.exhibitNumber }]),
    );

    // Return only safe fields — driveFileId, publishedBy, jobId stripped
    const exhibits = docs.map(({ driveFileId: _df, publishedBy: _pb, jobId: _jid, ...rest }) => {
      const meta = rest.criteriaCode ? criteriaMap.get(rest.criteriaCode) : undefined;
      return {
        ...rest,
        criteriaName: meta?.criteriaName ?? null,
        criteriaExhibitLabel: meta?.exhibitLabel ?? null,
      };
    });

    res.json({ exhibits, visaPath: setup.visaPath });
  },
);

export default router;
