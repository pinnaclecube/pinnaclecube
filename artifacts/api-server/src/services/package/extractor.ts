/**
 * extractor.ts — Evidence Package module, stage 3 (spec section 4 stage 3).
 *
 * Downloads a scanned evidence file, runs scripts/extract.py to produce text +
 * page images (+ OCR confidence for low-text pages), and — when an upload folder
 * is given — uploads the page images to the case's _cache/package-v<N> Drive
 * folder. Reuses downloadDriveFile + uploadFileToDrive. Never throws per file:
 * a failed extract is returned with ok=false and the error, so the stage can
 * continue (spec: "never fail the whole stage on one file").
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { downloadDriveFile } from "../driveService";
import { uploadFileToDrive } from "../driveUploadService";
import { logger } from "../../lib/logger";
import type { ScannedFile } from "./scanner";

const execFileAsync = promisify(execFile);

// scripts/extract.py at the repo root. Overridable for non-standard layouts.
const EXTRACT_SCRIPT =
  process.env.PACKAGE_EXTRACT_SCRIPT ?? path.join(process.cwd(), "scripts", "extract.py");
const PYTHON_BIN = process.env.PACKAGE_PYTHON_BIN ?? "python3";
const EXTRACT_TIMEOUT_MS = 180_000;

export interface PageImage {
  index: number;
  fileName: string; // local PNG name as produced by extract.py
  driveId: string | null; // set when uploaded to the cache folder
  driveUrl: string | null;
  ocrApplied: boolean;
  ocrConfidence: number | null;
}

export interface FileExtract {
  fileId: number;
  fileName: string;
  ok: boolean;
  method: string;
  text: string;
  charCount: number;
  pageCount: number;
  ocrConfidences: number[];
  pages: PageImage[];
  error?: string;
}

interface RawExtract {
  ok: boolean;
  method?: string;
  text?: string;
  charCount?: number;
  pageCount?: number;
  ocrConfidences?: number[];
  pages?: { index: number; image: string | null; ocr?: { applied?: boolean; confidence?: number | null } }[];
  error?: string;
}

/** Keep the original extension (extract.py dispatches on it); sanitize the stem. */
function safeInputName(name: string): string {
  const ext = path.extname(name);
  const stem = path.basename(name, ext).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "input";
  return stem + ext;
}

/**
 * Extract one file. When opts.uploadFolderId is set, page images are uploaded to
 * that Drive folder (the case _cache folder); otherwise the page images stay
 * local and are reported without Drive ids (used by the dry-run).
 */
export async function extractFile(
  file: Pick<ScannedFile, "fileId" | "name" | "driveId">,
  opts?: { uploadFolderId?: string },
): Promise<FileExtract> {
  const base: FileExtract = {
    fileId: file.fileId,
    fileName: file.name,
    ok: false,
    method: "",
    text: "",
    charCount: 0,
    pageCount: 0,
    ocrConfidences: [],
    pages: [],
  };

  // Input in its OWN dir; output in a separate dir; python cwd = outDir — so the
  // untrusted input's directory is never on sys.path.
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-extract-"));
  const inDir = path.join(work, "in");
  const outDir = path.join(work, "out");
  await fs.mkdir(inDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  try {
    const buffer = await downloadDriveFile(file.driveId);
    const inputPath = path.join(inDir, safeInputName(file.name));
    await fs.writeFile(inputPath, buffer);

    const { stdout } = await execFileAsync(
      PYTHON_BIN,
      [EXTRACT_SCRIPT, inputPath, outDir],
      { cwd: outDir, timeout: EXTRACT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
    );
    const raw = JSON.parse(stdout) as RawExtract;

    if (!raw.ok) {
      return { ...base, method: raw.method ?? "", error: raw.error ?? "extraction failed" };
    }

    const pages: PageImage[] = [];
    for (const p of raw.pages ?? []) {
      let driveId: string | null = null;
      let driveUrl: string | null = null;
      if (opts?.uploadFolderId && p.image) {
        try {
          const png = await fs.readFile(path.join(outDir, p.image));
          const up = await uploadFileToDrive(
            png,
            `${file.fileId}-${p.image}`,
            "image/png",
            opts.uploadFolderId,
          );
          driveId = up.driveFileId;
          driveUrl = up.driveUrl;
        } catch (err) {
          logger.warn({ err, fileId: file.fileId, image: p.image }, "[package/extractor] page image upload failed");
        }
      }
      pages.push({
        index: p.index,
        fileName: p.image ?? "",
        driveId,
        driveUrl,
        ocrApplied: !!p.ocr?.applied,
        ocrConfidence: p.ocr?.confidence ?? null,
      });
    }

    return {
      ...base,
      ok: true,
      method: raw.method ?? "",
      text: raw.text ?? "",
      charCount: raw.charCount ?? (raw.text ? raw.text.length : 0),
      pageCount: raw.pageCount ?? pages.length,
      ocrConfidences: raw.ocrConfidences ?? [],
      pages,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, fileId: file.fileId, fileName: file.name }, "[package/extractor] extract failed");
    return { ...base, error: msg };
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
