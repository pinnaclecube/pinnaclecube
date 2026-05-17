/**
 * driveDocumentFetcher.ts — Pinnacle³
 *
 * Fetches all documents from a case's Google Drive folders and extracts
 * their text content for use in criteria assessment and AI analysis.
 *
 * Processing order: criteria folders first (priority for the 150k char cap),
 * then resume, demographics, and all other folder types.
 * Never throws on a single-file failure — errors are caught per file.
 */

import { eq } from "drizzle-orm";
import { db, caseFoldersTable } from "@workspace/db";
import { getDriveClient, listDriveFolderFiles } from "./driveService";
import { extractText } from "./evidenceProcessing";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FetchedDocument {
  fileName: string;
  driveFileId: string;
  driveUrl: string;
  mimeType: string;
  folderType: string;
  folderName: string;
  criteriaIndex: number | null;
  criteriaName: string | null;
  criteriaCode: string | null;
  textContent: string;
  isImage: boolean;
  charCount: number;
}

export interface FetchedDocumentsResult {
  allDocuments: FetchedDocument[];
  grouped: {
    resume: FetchedDocument[];
    demographics: FetchedDocument[];
    byCriteria: Record<string, FetchedDocument[]>;
    emptyCriteriaFolders: string[];
  };
  totalCharCount: number;
  excludedFiles: string[];
}

// ─── MIME helpers ─────────────────────────────────────────────────────────────

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isSupportedMime(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === PDF_MIME ||
    mimeType === GOOGLE_DOC_MIME ||
    mimeType === DOCX_MIME ||
    mimeType === "text/plain" ||
    mimeType === "text/csv"
  );
}

// ─── Drive download helpers ───────────────────────────────────────────────────

async function downloadAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer);
}

async function exportGoogleDocAsText(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const response = await drive.files.export(
    { fileId, mimeType: "text/plain" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer).toString("utf8");
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────

const CHAR_CAP = 150_000;

export async function fetchCaseDocuments(
  caseSetupId: number,
): Promise<FetchedDocumentsResult> {
  // 1. Load all folders for this case
  const folders = await db
    .select()
    .from(caseFoldersTable)
    .where(eq(caseFoldersTable.caseId, caseSetupId));

  // Process criteria folders first so they consume the char cap preferentially
  const criteriaFolders = folders.filter((f) => f.folderType === "criteria");
  const otherFolders = folders.filter((f) => f.folderType !== "criteria");
  const orderedFolders = [...criteriaFolders, ...otherFolders];

  const allDocuments: FetchedDocument[] = [];
  const excludedFiles: string[] = [];
  let totalCharCount = 0;

  // 2. Walk each folder
  for (const folder of orderedFolders) {
    let files: Awaited<ReturnType<typeof listDriveFolderFiles>>;

    try {
      files = await listDriveFolderFiles(folder.driveId);
    } catch (err) {
      logger.warn(
        { caseSetupId, folderId: folder.id, folderName: folder.name, err },
        "[docFetcher] failed to list folder — skipping",
      );
      continue;
    }

    // 3. Process each file
    for (const file of files) {
      if (!isSupportedMime(file.mimeType)) {
        excludedFiles.push(`${file.name} (${file.mimeType})`);
        logger.debug(
          { caseSetupId, fileName: file.name, mimeType: file.mimeType },
          "[docFetcher] unsupported mime — excluded",
        );
        continue;
      }

      const isImage = file.mimeType.startsWith("image/");
      let textContent = "";

      // Extract text only if we haven't hit the cap and it's not an image
      if (!isImage && totalCharCount < CHAR_CAP) {
        try {
          if (file.mimeType === GOOGLE_DOC_MIME) {
            textContent = await exportGoogleDocAsText(file.id);
          } else {
            const buffer = await downloadAsBuffer(file.id);
            textContent = await extractText(buffer, file.mimeType, file.name);
          }

          // Trim to remaining budget
          const remaining = CHAR_CAP - totalCharCount;
          if (textContent.length > remaining) {
            textContent = textContent.slice(0, remaining);
          }
          totalCharCount += textContent.length;
        } catch (err) {
          logger.warn(
            { caseSetupId, fileId: file.id, fileName: file.name, err },
            "[docFetcher] text extraction failed — continuing",
          );
          textContent = "";
        }
      }

      allDocuments.push({
        fileName: file.name,
        driveFileId: file.id,
        driveUrl: file.webViewLink,
        mimeType: file.mimeType,
        folderType: folder.folderType,
        folderName: folder.name,
        criteriaIndex: folder.criteriaIndex ?? null,
        criteriaName: folder.folderType === "criteria" ? folder.name : null,
        criteriaCode: null, // not stored in case_folders; resolved by callers via exhibit table
        textContent,
        isImage,
        charCount: textContent.length,
      });
    }
  }

  // 4. Build grouped result
  const resume = allDocuments.filter((d) => d.folderType === "resume");
  const demographics = allDocuments.filter(
    (d) => d.folderType === "demographics",
  );

  const byCriteria: Record<string, FetchedDocument[]> = {};
  for (const doc of allDocuments) {
    if (doc.folderType === "criteria" && doc.criteriaName) {
      (byCriteria[doc.criteriaName] ??= []).push(doc);
    }
  }

  const emptyCriteriaFolders = criteriaFolders
    .filter(
      (f) =>
        !byCriteria[f.name] || byCriteria[f.name].length === 0,
    )
    .map((f) => f.name);

  logger.info(
    {
      caseSetupId,
      totalDocs: allDocuments.length,
      totalCharCount,
      excludedCount: excludedFiles.length,
      criteriaFolderCount: criteriaFolders.length,
      emptyCriteriaFolders: emptyCriteriaFolders.length,
    },
    "[docFetcher] fetch complete",
  );

  return {
    allDocuments,
    grouped: {
      resume,
      demographics,
      byCriteria,
      emptyCriteriaFolders,
    },
    totalCharCount,
    excludedFiles,
  };
}
