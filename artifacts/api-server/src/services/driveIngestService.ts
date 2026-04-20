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
  driveIngestLogsTable,
} from "@workspace/db";
import { getDriveClient, listFolderFiles, downloadDriveFile, type DownloadedFile } from "./googleDrive";
import { extractText, generateAISummary } from "./evidenceProcessing";
import { logger } from "../lib/logger";

const INTERVAL_MS = parseInt(process.env.DRIVE_INGEST_INTERVAL_MS ?? "300000", 10);
// All Google Workspace types are supported via PDF export.
// Binary image types are listed but produce empty extracted text (handled gracefully).
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  // Google Workspace types — all exported as PDF by downloadDriveFile
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
]);

function isGoogleWorkspaceType(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

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

    // Collect ALL already-ingested driveFileIds for this profile (profile-wide dedup,
    // not per-criterion — prevents re-ingestion if a file is moved across folders)
    const existingRows = await db
      .select({ driveFileId: evidenceTable.driveFileId })
      .from(evidenceTable)
      .where(eq(evidenceTable.profileId, folderRecord.profileId));

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

      // Treat any Google Workspace type as supported (all exported as PDF)
      const isSupportedType = SUPPORTED_MIME_TYPES.has(file.mimeType) || isGoogleWorkspaceType(file.mimeType);

      try {
        let extractedText = "";
        let aiSummary: string | null = null;

        let effectiveFileName = file.name;
        if (isSupportedType) {
          const downloaded: DownloadedFile = await downloadDriveFile(
            drive,
            file.id,
            file.mimeType,
            file.name,
          );
          effectiveFileName = downloaded.fileName;
          extractedText = await extractText(downloaded.buffer, downloaded.mimeType, downloaded.fileName);

          if (extractedText.trim()) {
            aiSummary = await generateAISummary(extractedText, legalStandard, clientField);
          }
        }

        const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        const finalExtractionStatus = isSupportedType ? (extractedText ? "completed" : "failed") : "skipped";

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
          fileName: effectiveFileName,
          extractionStatus: finalExtractionStatus,
          extractedText: extractedText || null,
          aiSummary,
          source: "drive_ingest",
        });

        await db.insert(driveIngestLogsTable).values({
          profileId: folderRecord.profileId,
          criteriaId: folderRecord.criteriaId,
          driveFileId: file.id,
          fileName: effectiveFileName,
          extractionStatus: finalExtractionStatus,
        });

        result.ingested++;
      } catch (err) {
        logger.error(
          { err, fileId: file.id, fileName: file.name, profileId: folderRecord.profileId },
          "[driveIngest] Failed to process file",
        );
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        await db.insert(driveIngestLogsTable).values({
          profileId: folderRecord.profileId,
          criteriaId: folderRecord.criteriaId,
          driveFileId: file.id,
          fileName: file.name,
          extractionStatus: "error",
          errorMessage,
        }).catch((logErr) => {
          logger.error({ logErr }, "[driveIngest] Failed to write error log row");
        });
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
  if (pollerTimer !== null) {
    logger.warn("[driveIngest] Poller already running — ignoring duplicate start");
    return;
  }

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
