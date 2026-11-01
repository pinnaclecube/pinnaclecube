/**
 * approval.ts — Evidence Package module, approval + client reflection (spec §6).
 *
 * Per-document approve sets approvedBy/At + publishedToClient. Package status is
 * derived from its documents (ready_for_review | partially_approved | approved);
 * an approved package is locked. One client notification per package, sent 15 min
 * after the last approval (settle) or immediately via Notify client now. Every
 * action is written to the audit log.
 */

import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
  db, exhibitDocumentsTable, petitionPackageTable, casePetitionSetupTable, profilesTable, notificationsTable, packageGenerationJobsTable,
} from "@workspace/db";
import { uploadFileToDrive } from "../driveUploadService";
import { sendEmail } from "../emailService";
import { logActivity } from "../activityLogger";
import { ensurePackageFolder } from "./assembly";
import { logger } from "../../lib/logger";

const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const APPROVABLE_ROLES = ["sub_exhibit", "criterion", "final_merits"];
const SETTLE_MS = 15 * 60 * 1000;

type Doc = typeof exhibitDocumentsTable.$inferSelect;

function hasErrorFlag(d: Doc): boolean {
  return ((d.flags as { severity?: string }[] | null) ?? []).some((f) => f.severity === "error");
}
function isApprovable(d: Doc): boolean {
  return APPROVABLE_ROLES.includes(d.role ?? "") && d.renderStatus === "rendered" && !hasErrorFlag(d);
}

async function caseProfile(caseSetupId: number) {
  const [row] = await db
    .select({ profileId: casePetitionSetupTable.profileId, email: profilesTable.email, name: profilesTable.name, firstName: profilesTable.firstName })
    .from(casePetitionSetupTable)
    .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
    .where(eq(casePetitionSetupTable.id, caseSetupId)).limit(1);
  return row ?? null;
}

/** Recompute and persist the package status from its documents. Returns it. */
export async function derivePackageStatus(caseSetupId: number, version: number): Promise<string> {
  const docs = await db.select().from(exhibitDocumentsTable)
    .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.packageVersion, version)));
  const approvable = docs.filter(isApprovable);
  const approved = approvable.filter((d) => d.approvedAt != null);
  let status = "ready_for_review";
  if (approvable.length > 0 && approved.length === approvable.length) status = "approved";
  else if (approved.length > 0) status = "partially_approved";
  await db.update(petitionPackageTable).set({ packageStatus: status }).where(eq(petitionPackageTable.caseSetupId, caseSetupId));
  return status;
}

function audit(caseSetupId: number, profileId: number, eventType: string, metadata: Record<string, unknown>, staffId: string) {
  logActivity({ profileId, caseSetupId, eventType, actor: "staff", actorName: staffId, category: "petition" as never, metadata });
}

async function assertUnlocked(caseSetupId: number): Promise<boolean> {
  const [pkg] = await db.select({ s: petitionPackageTable.packageStatus }).from(petitionPackageTable).where(eq(petitionPackageTable.caseSetupId, caseSetupId)).limit(1);
  return pkg?.s !== "approved";
}

// ─── Per-document actions ────────────────────────────────────────────────────

export async function approveDocument(docId: number, staffId: string): Promise<Doc | null> {
  const [doc] = await db.select().from(exhibitDocumentsTable).where(eq(exhibitDocumentsTable.id, docId)).limit(1);
  if (!doc) return null;
  const now = new Date();
  await db.update(exhibitDocumentsTable).set({
    approvedBy: staffId, approvedAt: now, publishedToClient: true, publishedAt: now, publishedBy: staffId,
  }).where(eq(exhibitDocumentsTable.id, docId));
  audit(doc.caseSetupId, doc.profileId, "package_document_approved", { docId, exhibitCode: doc.exhibitCode, version: doc.packageVersion }, staffId);
  if (doc.packageVersion != null) await derivePackageStatus(doc.caseSetupId, doc.packageVersion);
  return doc;
}

export async function approveUnflagged(caseSetupId: number, version: number, staffId: string): Promise<number> {
  const docs = await db.select().from(exhibitDocumentsTable)
    .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.packageVersion, version)));
  const targets = docs.filter((d) => isApprovable(d) && ((d.flags as unknown[] | null) ?? []).length === 0 && d.approvedAt == null);
  if (targets.length === 0) return 0;
  const now = new Date();
  await db.update(exhibitDocumentsTable).set({ approvedBy: staffId, approvedAt: now, publishedToClient: true, publishedAt: now, publishedBy: staffId })
    .where(inArray(exhibitDocumentsTable.id, targets.map((d) => d.id)));
  audit(caseSetupId, targets[0].profileId, "package_approve_unflagged", { version, count: targets.length }, staffId);
  await derivePackageStatus(caseSetupId, version);
  return targets.length;
}

export async function rejectPackage(caseSetupId: number, version: number, staffId: string): Promise<void> {
  await db.update(exhibitDocumentsTable).set({ publishedToClient: false, approvedBy: null, approvedAt: null })
    .where(and(eq(exhibitDocumentsTable.caseSetupId, caseSetupId), eq(exhibitDocumentsTable.packageVersion, version)));
  await db.update(petitionPackageTable).set({ packageStatus: "rejected" }).where(eq(petitionPackageTable.caseSetupId, caseSetupId));
  const prof = await caseProfile(caseSetupId);
  if (prof) audit(caseSetupId, prof.profileId, "package_rejected", { version }, staffId);
}

export async function regenerateDocument(docId: number, instruction: string, staffId: string): Promise<boolean> {
  const [doc] = await db.select().from(exhibitDocumentsTable).where(eq(exhibitDocumentsTable.id, docId)).limit(1);
  if (!doc) return false;
  if (!(await assertUnlocked(doc.caseSetupId))) return false;
  await db.update(exhibitDocumentsTable).set({
    renderStatus: "pending", regenerationInstruction: instruction || null,
    approvedBy: null, approvedAt: null, publishedToClient: false, flags: null,
  }).where(eq(exhibitDocumentsTable.id, docId));
  // Enqueue a job to re-render the pending doc (only if none active for the case).
  if (doc.packageVersion != null) {
    const [active] = await db.select({ id: packageGenerationJobsTable.id }).from(packageGenerationJobsTable)
      .where(and(eq(packageGenerationJobsTable.caseSetupId, doc.caseSetupId), inArray(packageGenerationJobsTable.status, ["queued", "processing", "awaiting_group_review"]))).limit(1);
    if (!active) {
      await db.insert(packageGenerationJobsTable).values({ caseSetupId: doc.caseSetupId, packageVersion: doc.packageVersion, status: "queued", requestedBy: staffId });
    }
  }
  audit(doc.caseSetupId, doc.profileId, "package_document_regenerate", { docId, exhibitCode: doc.exhibitCode, instruction }, staffId);
  return true;
}

export async function replaceDocument(docId: number, buffer: Buffer, staffId: string): Promise<boolean> {
  const [doc] = await db.select().from(exhibitDocumentsTable).where(eq(exhibitDocumentsTable.id, docId)).limit(1);
  if (!doc) return false;
  if (!(await assertUnlocked(doc.caseSetupId)) || doc.packageVersion == null) return false;
  const { folderId } = await ensurePackageFolder(doc.caseSetupId, doc.packageVersion);
  const up = await uploadFileToDrive(buffer, doc.fileName, DOCX_MIME, folderId);
  await db.update(exhibitDocumentsTable).set({
    wordDriveId: up.driveFileId, wordDriveUrl: up.driveUrl, renderStatus: "rendered",
    flags: null, approvedBy: null, approvedAt: null, publishedToClient: false, thumbnailDriveId: null, thumbnailDriveUrl: null,
  }).where(eq(exhibitDocumentsTable.id, docId));
  audit(doc.caseSetupId, doc.profileId, "package_document_replaced", { docId, exhibitCode: doc.exhibitCode }, staffId);
  return true;
}

// ─── Client notification ───────────────────────────────────────────────────────

async function sendClientPackageNotice(caseSetupId: number, version: number): Promise<void> {
  const prof = await caseProfile(caseSetupId);
  if (!prof) return;
  await db.insert(notificationsTable).values({
    profileId: prof.profileId, userType: "client", caseSetupId,
    notificationType: "package_ready", title: "Your evidence package is ready",
    message: `Approved evidence exhibits (package v${version}) are now available in your portal.`,
    link: "/evidence", status: "unread", priority: "medium",
  });
  await sendEmail(prof.email, {
    subject: "Your evidence package is ready",
    html: `<p>Hi ${prof.firstName ?? prof.name ?? "there"},</p><p>Approved evidence exhibits are now available in your Pinnacle³ portal.</p><p><a href="${APP_URL}/evidence">View your exhibits</a></p>`,
    text: `Approved evidence exhibits are now available in your portal: ${APP_URL}/evidence`,
  });
  await db.update(petitionPackageTable).set({ clientNotifiedAt: new Date() }).where(eq(petitionPackageTable.caseSetupId, caseSetupId));
}

export async function notifyClientNow(caseSetupId: number, version: number, staffId: string): Promise<void> {
  await sendClientPackageNotice(caseSetupId, version);
  const prof = await caseProfile(caseSetupId);
  if (prof) audit(caseSetupId, prof.profileId, "package_client_notified", { version, trigger: "manual" }, staffId);
}

/** Cron: notify clients for packages whose approvals have settled >15 min and
 * that have not been notified yet. One notification per package. */
export async function notifySettledPackages(): Promise<number> {
  const pkgs = await db.select().from(petitionPackageTable)
    .where(and(inArray(petitionPackageTable.packageStatus, ["partially_approved", "approved"]), sql`${petitionPackageTable.clientNotifiedAt} is null`));
  let sent = 0;
  for (const pkg of pkgs) {
    const [last] = await db.select({ t: sql<string | null>`max(${exhibitDocumentsTable.approvedAt})` })
      .from(exhibitDocumentsTable)
      .where(and(eq(exhibitDocumentsTable.caseSetupId, pkg.caseSetupId), eq(exhibitDocumentsTable.packageVersion, pkg.currentVersion ?? 0), isNotNull(exhibitDocumentsTable.approvedAt)));
    const lastAt = last?.t ? new Date(last.t).getTime() : 0;
    if (lastAt > 0 && Date.now() - lastAt >= SETTLE_MS) {
      try { await sendClientPackageNotice(pkg.caseSetupId, pkg.currentVersion ?? 0); sent += 1; }
      catch (err) { logger.error({ err, caseSetupId: pkg.caseSetupId }, "[package/approval] settle-notify failed"); }
    }
  }
  return sent;
}
