/**
 * driveDocumentFetcher.ts — Pinnacle³
 *
 * Fetches all documents from a case's Google Drive folders and extracts
 * their text content for use in criteria assessment and AI analysis.
 *
 * Processing order: criteria folders first (priority for the 150k char cap),
 * then resume, demographics, and all other folder types.
 * Never throws on a single-file failure — errors are caught per file.
 *
 * Custom subfolder handling (Bug A fix):
 *   Drive-created subfolders have folderType='custom'. Their documents are
 *   attributed to the nearest criteria/resume/demographics ancestor by walking
 *   the parentFolderId chain, so they reach Claude during assessment.
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
  caseFolderId: number;
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
    { supportsAllDrives: true, fileId, alt: "media" },
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

// ─── Parent-chain ancestor resolution ────────────────────────────────────────

type AncestorInfo =
  | { folderType: "criteria"; criteriaName: string }
  | { folderType: "resume" }
  | { folderType: "demographics" };

/**
 * For every custom folder in the set, walk parentFolderId until a
 * criteria/resume/demographics ancestor is found.  Returns a Map keyed
 * by the custom folder's DB id.
 */
function buildCustomAncestorMap(
  folders: Array<typeof caseFoldersTable.$inferSelect>,
): Map<number, AncestorInfo> {
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const result = new Map<number, AncestorInfo>();

  for (const folder of folders) {
    if (folder.folderType !== "custom" || !folder.parentFolderId) continue;

    let current = folderById.get(folder.parentFolderId);
    while (current) {
      if (current.folderType === "criteria") {
        result.set(folder.id, { folderType: "criteria", criteriaName: current.name });
        break;
      }
      if (current.folderType === "resume") {
        result.set(folder.id, { folderType: "resume" });
        break;
      }
      if (current.folderType === "demographics") {
        result.set(folder.id, { folderType: "demographics" });
        break;
      }
      // Current folder is also custom — keep climbing
      current = current.parentFolderId ? folderById.get(current.parentFolderId) : undefined;
    }
    // If we exhausted the chain without hitting a known type, leave unmapped (orphan)
  }

  return result;
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

  // Build ancestor map for custom subfolders before walking files
  const customAncestorMap = buildCustomAncestorMap(folders);

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
        caseFolderId: folder.id,
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
  //    Custom subfolders are attributed to their nearest criteria/resume/demographics
  //    ancestor via the customAncestorMap built above.
  const resume: FetchedDocument[] = [];
  const demographics: FetchedDocument[] = [];
  const byCriteria: Record<string, FetchedDocument[]> = {};

  for (const doc of allDocuments) {
    if (doc.folderType === "criteria" && doc.criteriaName) {
      (byCriteria[doc.criteriaName] ??= []).push(doc);
    } else if (doc.folderType === "custom") {
      const ancestor = customAncestorMap.get(doc.caseFolderId);
      if (!ancestor) {
        // Orphaned custom folder — no criteria ancestor found; skip
        continue;
      }
      if (ancestor.folderType === "criteria") {
        (byCriteria[ancestor.criteriaName] ??= []).push({
          ...doc,
          criteriaName: ancestor.criteriaName,
          // Label the folder name so Claude knows it came from a subfolder
          folderName: `${doc.folderName} (subfolder of ${ancestor.criteriaName})`,
        });
      } else if (ancestor.folderType === "resume") {
        resume.push(doc);
      } else if (ancestor.folderType === "demographics") {
        demographics.push(doc);
      }
    } else if (doc.folderType === "resume") {
      resume.push(doc);
    } else if (doc.folderType === "demographics") {
      demographics.push(doc);
    }
    // root / evidence / exhibits / other types — not passed to assessment
  }

  // A criteria folder is empty only if it has no files AND none of its custom
  // subfolders have files (byCriteria is already populated with both).
  const emptyCriteriaFolders = criteriaFolders
    .filter((f) => !byCriteria[f.name] || byCriteria[f.name].length === 0)
    .map((f) => f.name);

  logger.info(
    {
      caseSetupId,
      totalDocs: allDocuments.length,
      totalCharCount,
      excludedCount: excludedFiles.length,
      criteriaFolderCount: criteriaFolders.length,
      emptyCriteriaFolders: emptyCriteriaFolders.length,
      customFoldersMapped: customAncestorMap.size,
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
