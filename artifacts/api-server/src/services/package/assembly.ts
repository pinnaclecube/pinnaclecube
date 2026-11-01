/**
 * assembly.ts — Evidence Package module, stage 7 assembly (spec §4 stage 7).
 *
 * Drive layout + final assembly: assigns display Exhibit numbers in index order,
 * renders the standalone Exhibit_Index.docx, writes the index into the final-merits
 * document, uploads everything to Exhibits/Package v<N> (tagged so the scanner
 * skips it), merges every document to one PDF (LibreOffice + poppler pdfunite),
 * sets the package ready_for_review, and notifies staff. No client notification
 * here — client visibility is approval-gated (§6).
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { and, asc, eq } from "drizzle-orm";
import {
  db, exhibitDocumentsTable, petitionPackageTable, casePetitionSetupTable, profilesTable,
} from "@workspace/db";
import { describeExhibitCode, PACKAGE_TEMPLATES } from "@workspace/shared";
import {
  createDriveFolder, listDriveSubfolders, setDriveFileDescription, downloadDriveFile,
} from "../driveService";
import { uploadFileToDrive, getCaseDriveFolderId } from "../driveUploadService";
import { renderExhibitDocx } from "./renderer";
import { insertStaffNotification } from "../staffNotificationService";
import { sendEmail } from "../emailService";
import { PACKAGE_OUTPUT_TAG } from "./scanner";
import { logger } from "../../lib/logger";

const execFileAsync = promisify(execFile);
const SUPPORT_EMAIL = "support@pinnaclecube.com";
const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Stable package document order: criteria A..J (sub_exhibits then the criterion
// doc), then index, then final_merits.
function docSortKey(d: { role: string | null; exhibitCode: string | null; criteriaCode: string | null }): string {
  const order = PACKAGE_TEMPLATES.EB1A.criteria.map((c) => c.key);
  const roleRank = d.role === "final_merits" ? "9" : d.role === "index" ? "8" : "1";
  const critRank = String(order.indexOf(d.criteriaCode ?? "")).padStart(2, "0");
  const sub = d.role === "criterion" ? "zz" : (d.exhibitCode ?? "").replace(/^[A-Z]/, "").padStart(4, "0");
  return `${roleRank}:${critRank}:${sub}`;
}

/** Ensure the Exhibits/Package v<N> output folder exists (tagged for the scanner to skip). */
export async function ensurePackageFolder(caseSetupId: number, version: number): Promise<{ folderId: string; name: string }> {
  const exhibitsId = await getCaseDriveFolderId(caseSetupId, "exhibits");
  if (!exhibitsId) throw new Error(`case ${caseSetupId} has no Exhibits folder`);
  const name = `Package v${version}`;
  const existing = (await listDriveSubfolders(exhibitsId)).find((f) => f.name === name);
  if (existing) return { folderId: existing.id, name };
  const folder = await createDriveFolder(name, exhibitsId);
  await setDriveFileDescription(folder.driveId, PACKAGE_OUTPUT_TAG).catch(() => undefined);
  return { folderId: folder.driveId, name };
}

/** Ensure the _cache/package-v<N> folder for page images (tagged skip). */
export async function ensureCacheFolder(caseSetupId: number, version: number): Promise<string> {
  const exhibitsId = await getCaseDriveFolderId(caseSetupId, "exhibits");
  if (!exhibitsId) throw new Error(`case ${caseSetupId} has no Exhibits folder`);
  const name = `_cache package-v${version}`;
  const existing = (await listDriveSubfolders(exhibitsId)).find((f) => f.name === name);
  if (existing) return existing.id;
  const folder = await createDriveFolder(name, exhibitsId);
  await setDriveFileDescription(folder.driveId, PACKAGE_OUTPUT_TAG).catch(() => undefined);
  return folder.driveId;
}

async function docxBufferToPdf(buf: Buffer, workDir: string, idx: number): Promise<string> {
  const src = path.join(workDir, `doc_${idx}.docx`);
  await fs.writeFile(src, buf);
  const profile = path.join(workDir, "_lo_profile");
  await execFileAsync(
    "soffice",
    ["--headless", "--norestore", `-env:UserInstallation=file://${profile}`, "--convert-to", "pdf", "--outdir", workDir, src],
    { timeout: 120_000 },
  );
  const pdf = path.join(workDir, `doc_${idx}.pdf`);
  await fs.access(pdf);
  return pdf;
}

export interface AssemblyResult {
  folderId: string;
  mergedPdfDriveId: string;
  mergedPdfUrl: string;
  mergedPdfBytes: number;
  exhibitIndexDriveId: string;
  documentCount: number;
}

export async function assemblePackage(caseSetupId: number, version: number): Promise<AssemblyResult> {
  const docs = await db
    .select()
    .from(exhibitDocumentsTable)
    .where(and(
      eq(exhibitDocumentsTable.caseSetupId, caseSetupId),
      eq(exhibitDocumentsTable.packageVersion, version),
      eq(exhibitDocumentsTable.renderStatus, "rendered"),
    ))
    .orderBy(asc(exhibitDocumentsTable.id));
  if (docs.length === 0) throw new Error("no rendered documents to assemble");

  const ordered = [...docs].sort((a, b) => docSortKey(a).localeCompare(docSortKey(b)));

  // Display Exhibit numbers in index order, over sub_exhibits only.
  const indexRows: { displayNumber: number; code: string; title: string; criterion?: string }[] = [];
  let n = 0;
  for (const d of ordered) {
    if (d.role === "sub_exhibit") {
      n += 1;
      const crit = describeExhibitCode(d.exhibitCode ?? "").criterion?.name;
      indexRows.push({ displayNumber: n, code: d.exhibitCode ?? "", title: d.exhibitLabel ?? d.fileName, criterion: crit });
    }
  }

  const [caseRow] = await db.select({ profileId: casePetitionSetupTable.profileId }).from(casePetitionSetupTable).where(eq(casePetitionSetupTable.id, caseSetupId)).limit(1);
  const [prof] = caseRow ? await db.select({ name: profilesTable.name }).from(profilesTable).where(eq(profilesTable.id, caseRow.profileId)).limit(1) : [undefined];
  const applicantName = prof?.name ?? "the applicant";

  const { folderId } = await ensurePackageFolder(caseSetupId, version);

  // Standalone Exhibit_Index.docx.
  const indexDoc = await renderExhibitDocx({
    role: "index", exhibitCode: "INDEX",
    meta: { applicantName, generatedAt: new Date() },
    content: { kind: "index", rows: indexRows },
  });
  const indexUpload = await uploadFileToDrive(indexDoc.buffer, "Exhibit_Index.docx", DOCX_MIME, folderId);

  // Merge every rendered document to one PDF (index order), index first.
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-assemble-"));
  const mergedBytes = await (async () => {
    try {
      const pdfPaths: string[] = [];
      const buffers: Buffer[] = [indexDoc.buffer, ...await Promise.all(ordered.map((d) => downloadDriveFile(d.wordDriveId!)))];
      for (let i = 0; i < buffers.length; i++) pdfPaths.push(await docxBufferToPdf(buffers[i], work, i));
      const merged = path.join(work, "merged.pdf");
      await execFileAsync("pdfunite", [...pdfPaths, merged], { timeout: 120_000 });
      return await fs.readFile(merged);
    } finally {
      // keep work dir until read; cleaned below
    }
  })();
  const mergedUpload = await uploadFileToDrive(mergedBytes, `Evidence_Package_v${version}.pdf`, "application/pdf", folderId);
  await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);

  // Persist package state → ready_for_review.
  await db.insert(petitionPackageTable).values({
    caseSetupId, profileId: caseRow!.profileId, currentVersion: version,
    packageStatus: "ready_for_review", readyForReviewAt: new Date(),
    exhibitIndexDriveId: indexUpload.driveFileId, mergedPdfDriveId: mergedUpload.driveFileId, mergedPdfDriveUrl: mergedUpload.driveUrl,
  }).onConflictDoUpdate({
    target: petitionPackageTable.caseSetupId,
    set: {
      currentVersion: version, packageStatus: "ready_for_review", readyForReviewAt: new Date(),
      exhibitIndexDriveId: indexUpload.driveFileId, mergedPdfDriveId: mergedUpload.driveFileId, mergedPdfDriveUrl: mergedUpload.driveUrl,
    },
  });

  logger.info({ caseSetupId, version, documentCount: ordered.length, mergedPdfBytes: mergedBytes.length }, "[package/assembly] assembled");
  return {
    folderId,
    mergedPdfDriveId: mergedUpload.driveFileId,
    mergedPdfUrl: mergedUpload.driveUrl,
    mergedPdfBytes: mergedBytes.length,
    exhibitIndexDriveId: indexUpload.driveFileId,
    documentCount: ordered.length,
  };
}

export async function notifyPackageReady(caseSetupId: number, version: number, result: AssemblyResult): Promise<void> {
  const [caseRow] = await db
    .select({ profileId: casePetitionSetupTable.profileId, name: profilesTable.name })
    .from(casePetitionSetupTable)
    .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
    .where(eq(casePetitionSetupTable.id, caseSetupId))
    .limit(1);
  const clientName = caseRow?.name ?? "the client";
  const link = caseRow?.profileId ? `/internal/case/${caseRow.profileId}?tab=packages` : null;

  await insertStaffNotification(
    `Evidence package v${version} ready for review — ${clientName}`,
    `An EB-1A evidence package (v${version}, ${result.documentCount} documents) has been generated and is ready for staff review.`,
    link,
    caseSetupId,
  );
  await sendEmail(SUPPORT_EMAIL, {
    subject: `Evidence package v${version} ready — ${clientName}`,
    html: `<p>An EB-1A evidence package (<strong>v${version}</strong>, ${result.documentCount} documents) is ready for staff review.</p><p><a href="${APP_URL}${link ?? "/internal/cases"}">Open the package</a></p>`,
    text: `Evidence package v${version} (${result.documentCount} documents) for ${clientName} is ready for staff review.`,
  });
}
