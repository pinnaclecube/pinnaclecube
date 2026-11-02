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
import { getCaseDriveFolderId } from "../services/driveUploadService";
import { listDriveFolderFiles, listDriveSubfolders } from "../services/driveService";
import { logger } from "../lib/logger";

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

    // Evidence Package docs (role set) are versioned: keep only the newest
    // published version per exhibitCode (spec §6). Legacy exhibits (role null)
    // pass through unchanged.
    const newestByCode = new Map<string, (typeof docs)[number]>();
    const legacy: typeof docs = [];
    for (const d of docs) {
      if (d.role && d.exhibitCode) {
        const cur = newestByCode.get(d.exhibitCode);
        if (!cur || (d.packageVersion ?? 0) > (cur.packageVersion ?? 0)) newestByCode.set(d.exhibitCode, d);
      } else {
        legacy.push(d);
      }
    }
    const deduped = [...legacy, ...newestByCode.values()];
    const latestVersion = Math.max(0, ...deduped.map((d) => d.packageVersion ?? 0));

    // Return only safe fields — driveFileId, publishedBy, jobId, content stripped
    const exhibits = deduped.map(({ driveFileId: _df, publishedBy: _pb, jobId: _jid, contentJson: _cj, flags: _fl, sourceFileIds: _sf, ...rest }) => {
      const meta = rest.criteriaCode ? criteriaMap.get(rest.criteriaCode) : undefined;
      return {
        ...rest,
        criteriaName: meta?.criteriaName ?? null,
        criteriaExhibitLabel: meta?.exhibitLabel ?? null,
        versionLabel: rest.packageVersion ? `v${rest.packageVersion}` : null,
      };
    });

    // Package summary — expose the merged PDF (download-all) only when fully approved.
    const [pkgRow] = await db.select().from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, setup.id)).limit(1);
    const packageApproved = pkgRow?.packageStatus === "approved";
    res.json({
      exhibits,
      visaPath: setup.visaPath,
      packageVersion: latestVersion || null,
      package: pkgRow ? {
        version: pkgRow.currentVersion,
        status: pkgRow.packageStatus,
        approved: packageApproved,
        mergedPdfUrl: packageApproved ? (pkgRow.mergedPdfDriveUrl ?? null) : null,
      } : null,
    });
  },
);

// ─── GET /petition/my-exhibits/tree ──────────────────────────────────────────
// Read-only mirror of the case's Exhibits Drive folder structure, containing
// ONLY files that staff have sent to the client (publishedToClient = true).
// Folders with no sent files anywhere beneath them are pruned.

interface TreeFile {
  driveFileId: string;
  name: string;
  webViewLink: string;
  exhibitLabel: string | null;
  publishedAt: string | null;
}
interface TreeNode {
  id: string;
  name: string;
  files: TreeFile[];
  folders: TreeNode[];
}

const TREE_MAX_DEPTH = 5;

router.get(
  "/petition/my-exhibits/tree",
  requireClientAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as AuthedRequest).clientUser;

    const setups = await db
      .select()
      .from(casePetitionSetupTable)
      .where(eq(casePetitionSetupTable.profileId, user.id));
    if (!setups.length) { res.json({ tree: null }); return; }
    const setup = setups.sort((a, b) => b.id - a.id)[0];

    // Published exhibit docs → map by driveFileId for the safe metadata overlay.
    const published = await db
      .select()
      .from(exhibitDocumentsTable)
      .where(and(
        eq(exhibitDocumentsTable.caseSetupId, setup.id),
        eq(exhibitDocumentsTable.publishedToClient, true),
      ));
    const metaByDriveId = new Map(
      published.filter((d) => d.driveFileId).map((d) => [d.driveFileId as string, d]),
    );
    if (metaByDriveId.size === 0) { res.json({ tree: null }); return; }

    const rootId = await getCaseDriveFolderId(setup.id, "exhibits");
    if (!rootId) { res.json({ tree: null }); return; }

    async function build(folderId: string, name: string, depth: number): Promise<TreeNode> {
      const [files, subfolders] = await Promise.all([
        listDriveFolderFiles(folderId),
        depth < TREE_MAX_DEPTH ? listDriveSubfolders(folderId) : Promise.resolve([]),
      ]);

      const keptFiles: TreeFile[] = files
        .filter((f) => metaByDriveId.has(f.id))
        .map((f) => {
          const meta = metaByDriveId.get(f.id)!;
          return {
            driveFileId: f.id,
            name: f.name,
            webViewLink: meta.driveUrl || f.webViewLink,
            exhibitLabel: meta.exhibitLabel ?? null,
            publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : null,
          };
        });

      const childNodes = await Promise.all(
        subfolders.map((s) => build(s.id, s.name, depth + 1)),
      );
      const keptFolders = childNodes.filter((n) => n.files.length > 0 || n.folders.length > 0);

      return { id: folderId, name, files: keptFiles, folders: keptFolders };
    }

    try {
      const tree = await build(rootId, "Exhibits", 0);
      // Prune the root itself if nothing is visible (shouldn't happen given the
      // published guard, but keep the contract clean).
      if (tree.files.length === 0 && tree.folders.length === 0) { res.json({ tree: null }); return; }
      res.json({ tree });
    } catch (err) {
      logger.error({ caseSetupId: setup.id, err }, "[petitionClient] exhibits tree build failed");
      res.json({ tree: null });
    }
  },
);

export default router;
