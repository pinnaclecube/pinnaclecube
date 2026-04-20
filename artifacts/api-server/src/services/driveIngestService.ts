/**
 * driveIngestService.ts — Pinnacle³
 *
 * Scheduled poller that scans each client's Google Drive criterion folders,
 * detects new files, extracts text, generates Claude summaries, and inserts
 * evidence records automatically.
 *
 * Runs every DRIVE_INGEST_INTERVAL_MS (default: 5 minutes).
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  clientDriveFoldersTable,
  evidenceTable,
  visaCriteriaTable,
  profilesTable,
} from "@workspace/db";
import { getDriveClient, listFolderFiles, downloadDriveFile } from "./googleDrive";
import { extractText, generateAISummary } from "./evidenceProcessing";
import { logger } from "../lib/logger";

const INTERVAL_MS = parseInt(process.env.DRIVE_INGEST_INTERVAL_MS ?? "300000", 10);
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.document",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// ─── Ingest a single folder ───────────────────────────────────────────────────

export interface IngestFolderResult {
  folderId: string;
  criteriaId: string;
  profileId: number;
  discovered: number;
  ingested: number;
  skipped: number;
  errors: number;
}

export async function ingestFolder(
  folderRecord: {
    id: number;
    profileId: number;
    criteriaId: string;
    driveFolderId: string;
    folderName: string;
    visaPath: string;
  },
): Promise<IngestFolderResult> {
  const result: IngestFolderResult = {
    folderId: folderRecord.driveFolderId,
    criteriaId: folderRecord.criteriaId,
    profileId: folderRecord.profileId,
    discovered: 0,
    ingested: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const drive = getDriveClient();
    const files = await listFolderFiles(drive, folderRecord.driveFolderId);
    result.discovered = files.length;

    if (files.length === 0) {
      await db
        .update(clientDriveFoldersTable)
        .set({ lastDriveSyncAt: new Date() })
        .where(eq(clientDriveFoldersTable.id, folderRecord.id));
      return result;
    }

    // Collect already-ingested driveFileIds for this profile + criterion
    const existingRows = await db
      .select({ driveFileId: evidenceTable.driveFileId })
      .from(evidenceTable)
      .where(
        and(
          eq(evidenceTable.profileId, folderRecord.profileId),
          eq(evidenceTable.primaryCriteriaId, folderRecord.criteriaId),
        ),
      );

    const existingFileIds = new Set(
      existingRows.map((r) => r.driveFileId).filter(Boolean) as string[],
    );

    // Fetch criterion metadata for AI prompts
    const [criterionRow] = await db
      .select({ legalStandard: visaCriteriaTable.legalStandard, displayName: visaCriteriaTable.displayName })
      .from(visaCriteriaTable)
      .where(eq(visaCriteriaTable.id, folderRecord.criteriaId))
      .limit(1);

    // Fetch client profession for AI context
    const [profileRow] = await db
      .select({ profession: profilesTable.profession })
      .from(profilesTable)
      .where(eq(profilesTable.id, folderRecord.profileId))
      .limit(1);

    const legalStandard = criterionRow?.legalStandard ?? folderRecord.folderName;
    const clientField = profileRow?.profession ?? "professional";

    // Process new files
    for (const file of files) {
      if (existingFileIds.has(file.id)) {
        result.skipped++;
        continue;
      }

      const isSupportedType = SUPPORTED_MIME_TYPES.has(file.mimeType);

      try {
        let extractedText = "";
        let aiSummary: string | null = null;

        if (isSupportedType) {
          const buffer = await downloadDriveFile(drive, file.id, file.mimeType);

          // Map Google Docs export MIME type back to docx for extraction
          const effectiveMime = file.mimeType === "application/vnd.google-apps.document"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : file.mimeType;

          extractedText = await extractText(buffer, effectiveMime, file.name);

          if (extractedText.trim()) {
            aiSummary = await generateAISummary(extractedText, legalStandard, clientField);
          }
        }

        const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        await db.insert(evidenceTable).values({
          profileId: folderRecord.profileId,
          primaryCriteriaId: folderRecord.criteriaId,
          criterionId: 0,
          title: file.name,
          description: null,
          evidenceType: "other",
          status: "draft",
          driveFileId: file.id,
          driveFileUrl: file.webViewLink ?? driveDownloadUrl,
          fileName: file.name,
          extractionStatus: isSupportedType ? (extractedText ? "completed" : "failed") : "skipped",
          extractedText: extractedText || null,
          aiSummary,
          source: "drive_ingest",
        });

        result.ingested++;
      } catch (err) {
        logger.error(
          { err, fileId: file.id, fileName: file.name, profileId: folderRecord.profileId },
          "[driveIngest] Failed to process file",
        );
        result.errors++;
      }
    }

    // Update last sync timestamp
    await db
      .update(clientDriveFoldersTable)
      .set({ lastDriveSyncAt: new Date() })
      .where(eq(clientDriveFoldersTable.id, folderRecord.id));
  } catch (err) {
    logger.error(
      { err, folderId: folderRecord.driveFolderId, profileId: folderRecord.profileId },
      "[driveIngest] Failed to scan folder",
    );
    result.errors++;
  }

  return result;
}

// ─── Ingest all folders for a single client ───────────────────────────────────

export async function ingestClientFolders(profileId: number): Promise<IngestFolderResult[]> {
  const folders = await db
    .select()
    .from(clientDriveFoldersTable)
    .where(eq(clientDriveFoldersTable.profileId, profileId));

  const results: IngestFolderResult[] = [];
  for (const folder of folders) {
    const r = await ingestFolder(folder);
    results.push(r);
  }
  return results;
}

// ─── Full sweep: ingest all clients ──────────────────────────────────────────

async function runFullSweep(): Promise<void> {
  logger.info("[driveIngest] Starting full Drive sweep");

  const allFolders = await db.select().from(clientDriveFoldersTable);

  if (allFolders.length === 0) {
    logger.info("[driveIngest] No client folders configured — skipping sweep");
    return;
  }

  let totalIngested = 0;
  let totalErrors = 0;

  for (const folder of allFolders) {
    const r = await ingestFolder(folder);
    totalIngested += r.ingested;
    totalErrors += r.errors;

    if (r.ingested > 0) {
      logger.info(
        { profileId: r.profileId, criteriaId: r.criteriaId, ingested: r.ingested },
        "[driveIngest] Ingested new files",
      );
    }
  }

  logger.info(
    { totalFolders: allFolders.length, totalIngested, totalErrors },
    "[driveIngest] Sweep complete",
  );
}

// ─── Poller lifecycle ─────────────────────────────────────────────────────────

let pollerTimer: ReturnType<typeof setInterval> | null = null;

export function startDriveIngestPoller(): void {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.ROOT_FOLDER_ID) {
    logger.warn("[driveIngest] GOOGLE_SERVICE_ACCOUNT_JSON or ROOT_FOLDER_ID not set — poller disabled");
    return;
  }

  logger.info({ intervalMs: INTERVAL_MS }, "[driveIngest] Starting Drive ingest poller");

  // Kick off immediately, then on interval
  runFullSweep().catch((err) => logger.error({ err }, "[driveIngest] Initial sweep error"));

  pollerTimer = setInterval(() => {
    runFullSweep().catch((err) => logger.error({ err }, "[driveIngest] Sweep error"));
  }, INTERVAL_MS);
}

export function stopDriveIngestPoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    logger.info("[driveIngest] Poller stopped");
  }
}
