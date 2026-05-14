/**
 * Google Drive service — Pinnacle³
 *
 * Manages the full Drive folder hierarchy and file uploads for each client.
 * Requires env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON of a GCP service account key
 *   ROOT_FOLDER_ID              — Drive folder ID that the service account can write to
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { db } from "@workspace/db";
import {
  clientDriveRootsTable,
  clientDriveFoldersTable,
  profilesTable,
  readinessIntakeTable,
  notificationsTable,
  clientActivityLogTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getCriteriaForVisaPath,
  sanitizeFileName,
  buildEvidenceFileName,
  type VisaPathKey,
} from "@workspace/shared";
import type { drive_v3 } from "googleapis";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriveFolder {
  id: string;
  webViewLink: string;
}

export interface ClientRootFolders {
  clientRootId: string;
  resumeFolderId: string;
  evidenceRootId: string;
}

export interface PetitionFolderMap {
  petitionRootFolderId: string;
  petitionDraftsCriteriaId: string;
  petitionDraftsRecoId: string;
  petitionDraftsPackageId: string;
  petitionPublishedCriteriaId: string;
  petitionPublishedRecoId: string;
  petitionPublishedPackageId: string;
}

export interface UploadedFile {
  driveFileId: string;
  driveFileUrl: string;
  driveDownloadUrl: string;
  fileName: string;
}

// ─── 1. getDriveClient ────────────────────────────────────────────────────────

export function getDriveClient(): drive_v3.Drive {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// ─── 2. findOrCreateFolder ────────────────────────────────────────────────────

export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<DriveFolder> {
  const safeName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `'${parentId}' in parents AND name = '${safeName}' AND mimeType = 'application/vnd.google-apps.folder' AND trashed = false`;

  const searchDrive = async (): Promise<DriveFolder | null> => {
    const res = await drive.files.list({
      q,
      fields: "files(id, webViewLink)",
      spaces: "drive",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = res.data.files ?? [];
    if (files.length > 0) {
      return { id: files[0].id!, webViewLink: files[0].webViewLink ?? "" };
    }
    return null;
  };

  // First search
  const found = await searchDrive();
  if (found) return found;

  // 500ms retry to handle Drive eventual consistency before creating
  await new Promise<void>((r) => setTimeout(r, 500));

  const retryFound = await searchDrive();
  if (retryFound) return retryFound;

  // Create folder
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return { id: res.data.id!, webViewLink: res.data.webViewLink ?? "" };
}

// ─── 3. createClientRootFolders ───────────────────────────────────────────────

export async function createClientRootFolders(
  userId: number,
  clientEmail: string,
): Promise<ClientRootFolders> {
  const rootFolderId = process.env.ROOT_FOLDER_ID;
  if (!rootFolderId) throw new Error("ROOT_FOLDER_ID env var is not set");

  const drive = getDriveClient();

  // Clients/ → {email}/ → Resume/ + Evidence/
  const clientsFolder = await findOrCreateFolder(drive, "Clients", rootFolderId);
  const clientFolder = await findOrCreateFolder(drive, clientEmail, clientsFolder.id);
  const resumeFolder = await findOrCreateFolder(drive, "Resume", clientFolder.id);
  const evidenceFolder = await findOrCreateFolder(drive, "Evidence", clientFolder.id);

  // Upsert into client_drive_roots
  await db
    .insert(clientDriveRootsTable)
    .values({
      profileId: userId,
      clientRootFolderId: clientFolder.id,
      resumeFolderId: resumeFolder.id,
      evidenceRootFolderId: evidenceFolder.id,
    })
    .onConflictDoUpdate({
      target: clientDriveRootsTable.profileId,
      set: {
        clientRootFolderId: clientFolder.id,
        resumeFolderId: resumeFolder.id,
        evidenceRootFolderId: evidenceFolder.id,
        foldersCreatedAt: new Date(),
      },
    });

  return {
    clientRootId: clientFolder.id,
    resumeFolderId: resumeFolder.id,
    evidenceRootId: evidenceFolder.id,
  };
}

// ─── 4. createCriteriaEvidenceFolders ─────────────────────────────────────────

export async function createCriteriaEvidenceFolders(
  userId: number,
  visaPath: VisaPathKey,
) {
  const [driveRoot] = await db
    .select({ evidenceRootFolderId: clientDriveRootsTable.evidenceRootFolderId })
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    throw new Error(`No Drive root found for user ${userId}. Run createClientRootFolders first.`);
  }

  const drive = getDriveClient();
  const criteria = getCriteriaForVisaPath(visaPath);
  const results = [];

  for (const criterion of criteria) {
    const folder = await findOrCreateFolder(
      drive,
      criterion.folderName,
      driveRoot.evidenceRootFolderId,
    );

    // Check if record already exists for this user + criteria
    const [existing] = await db
      .select({ id: clientDriveFoldersTable.id })
      .from(clientDriveFoldersTable)
      .where(
        and(
          eq(clientDriveFoldersTable.profileId, userId),
          eq(clientDriveFoldersTable.criteriaId, criterion.id),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(clientDriveFoldersTable)
        .set({
          driveFolderId: folder.id,
          driveFolderUrl: folder.webViewLink,
        })
        .where(eq(clientDriveFoldersTable.id, existing.id))
        .returning();
      results.push(updated);
    } else {
      // Insert new record
      const [inserted] = await db
        .insert(clientDriveFoldersTable)
        .values({
          profileId: userId,
          criteriaId: criterion.id,
          visaPath,
          folderName: criterion.folderName,
          driveFolderId: folder.id,
          driveFolderUrl: folder.webViewLink,
        })
        .returning();
      results.push(inserted);
    }
  }

  // Mark drive folders as created in readiness_intake
  await db
    .update(readinessIntakeTable)
    .set({
      driveFoldersCreated: true,
      driveFoldersCreatedAt: new Date(),
    })
    .where(eq(readinessIntakeTable.profileId, userId));

  return results;
}

// ─── 5. createPetitionFolders ─────────────────────────────────────────────────

export async function createPetitionFolders(userId: number): Promise<PetitionFolderMap> {
  const [driveRoot] = await db
    .select({ clientRootFolderId: clientDriveRootsTable.clientRootFolderId })
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    throw new Error(`No Drive root found for user ${userId}. Run createClientRootFolders first.`);
  }

  const drive = getDriveClient();

  // Petition/ at client root
  const petitionRoot = await findOrCreateFolder(drive, "Petition", driveRoot.clientRootFolderId);

  // Drafts/ and Published/ under Petition/
  const draftsFolder = await findOrCreateFolder(drive, "Drafts", petitionRoot.id);
  const publishedFolder = await findOrCreateFolder(drive, "Published", petitionRoot.id);

  // Subfolders under Drafts/
  const [draftsCriteria, draftsReco, draftsPackage] = await Promise.all([
    findOrCreateFolder(drive, "Criteria_Exhibits", draftsFolder.id),
    findOrCreateFolder(drive, "Recommendation_Letters", draftsFolder.id),
    findOrCreateFolder(drive, "Final_Package", draftsFolder.id),
  ]);

  // Subfolders under Published/
  const [publishedCriteria, publishedReco, publishedPackage] = await Promise.all([
    findOrCreateFolder(drive, "Criteria_Exhibits", publishedFolder.id),
    findOrCreateFolder(drive, "Recommendation_Letters", publishedFolder.id),
    findOrCreateFolder(drive, "Final_Package", publishedFolder.id),
  ]);

  const folderMap: PetitionFolderMap = {
    petitionRootFolderId: petitionRoot.id,
    petitionDraftsCriteriaId: draftsCriteria.id,
    petitionDraftsRecoId: draftsReco.id,
    petitionDraftsPackageId: draftsPackage.id,
    petitionPublishedCriteriaId: publishedCriteria.id,
    petitionPublishedRecoId: publishedReco.id,
    petitionPublishedPackageId: publishedPackage.id,
  };

  // Update client_drive_roots with petition folder IDs
  await db
    .update(clientDriveRootsTable)
    .set(folderMap)
    .where(eq(clientDriveRootsTable.profileId, userId));

  return folderMap;
}

// ─── 6. uploadEvidenceFile ────────────────────────────────────────────────────

export async function uploadEvidenceFile(
  userId: number,
  criteriaId: string,
  fileBuffer: Buffer,
  originalFileName: string,
  mimeType: string,
): Promise<UploadedFile> {
  const [driveFolder] = await db
    .select({ driveFolderId: clientDriveFoldersTable.driveFolderId })
    .from(clientDriveFoldersTable)
    .where(
      and(
        eq(clientDriveFoldersTable.profileId, userId),
        eq(clientDriveFoldersTable.criteriaId, criteriaId),
      ),
    )
    .limit(1);

  if (!driveFolder) {
    throw new Error(
      `No Drive folder found for user ${userId} and criteria ${criteriaId}. ` +
        `Run createCriteriaEvidenceFolders(userId, visaPath) first after readiness intake.`,
    );
  }

  const drive = getDriveClient();
  const fileName = buildEvidenceFileName(criteriaId, originalFileName);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [driveFolder.driveFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    driveFileId: res.data.id!,
    driveFileUrl: res.data.webViewLink ?? "",
    driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${res.data.id}`,
    fileName,
  };
}

// ─── 7. uploadResumeFile ──────────────────────────────────────────────────────

export async function uploadResumeFile(
  userId: number,
  fileBuffer: Buffer,
  originalFileName: string,
  mimeType: string,
  clientLastName: string,
): Promise<UploadedFile> {
  const [driveRoot] = await db
    .select({ resumeFolderId: clientDriveRootsTable.resumeFolderId })
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    throw new Error(`No Drive root found for user ${userId}. Run createClientRootFolders first.`);
  }

  const drive = getDriveClient();
  const date = new Date().toISOString().split("T")[0];
  const ext = originalFileName.includes(".")
    ? "." + originalFileName.split(".").pop()
    : "";
  const safeLast = sanitizeFileName(clientLastName);
  const fileName = `Resume_${safeLast}_${date}${ext}`;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [driveRoot.resumeFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    driveFileId: res.data.id!,
    driveFileUrl: res.data.webViewLink ?? "",
    driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${res.data.id}`,
    fileName,
  };
}

// ─── 8. uploadPetitionDraftFile ───────────────────────────────────────────────

type DraftDocSubtype =
  | "criteria_exhibit"
  | "recommendation_letter"
  | "exhibit_index"
  | "cover_letter"
  | "o1_itinerary";

export async function uploadPetitionDraftFile(
  userId: number,
  docSubtype: DraftDocSubtype,
  fileBuffer: Buffer,
  fileName: string,
): Promise<UploadedFile> {
  const [driveRoot] = await db
    .select({
      petitionDraftsCriteriaId: clientDriveRootsTable.petitionDraftsCriteriaId,
      petitionDraftsRecoId: clientDriveRootsTable.petitionDraftsRecoId,
      petitionDraftsPackageId: clientDriveRootsTable.petitionDraftsPackageId,
    })
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    throw new Error(`No Drive root found for user ${userId}.`);
  }

  const targetFolderId =
    docSubtype === "criteria_exhibit"
      ? driveRoot.petitionDraftsCriteriaId
      : docSubtype === "recommendation_letter"
        ? driveRoot.petitionDraftsRecoId
        : driveRoot.petitionDraftsPackageId; // exhibit_index, cover_letter, o1_itinerary

  if (!targetFolderId) {
    throw new Error(
      `Petition draft folders not created for user ${userId}. Run createPetitionFolders first.`,
    );
  }

  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [targetFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(fileBuffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    driveFileId: res.data.id!,
    driveFileUrl: res.data.webViewLink ?? "",
    driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${res.data.id}`,
    fileName,
  };
}

// ─── 9. publishPetitionFile ───────────────────────────────────────────────────

export async function publishPetitionFile(
  draftFileId: string,
  userId: number,
  docSubtype: DraftDocSubtype,
): Promise<DriveFolder> {
  const [driveRoot] = await db
    .select({
      petitionPublishedCriteriaId: clientDriveRootsTable.petitionPublishedCriteriaId,
      petitionPublishedRecoId: clientDriveRootsTable.petitionPublishedRecoId,
      petitionPublishedPackageId: clientDriveRootsTable.petitionPublishedPackageId,
    })
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    throw new Error(`No Drive root found for user ${userId}.`);
  }

  const targetFolderId =
    docSubtype === "criteria_exhibit"
      ? driveRoot.petitionPublishedCriteriaId
      : docSubtype === "recommendation_letter"
        ? driveRoot.petitionPublishedRecoId
        : driveRoot.petitionPublishedPackageId;

  if (!targetFolderId) {
    throw new Error(
      `Petition published folders not created for user ${userId}. Run createPetitionFolders first.`,
    );
  }

  const drive = getDriveClient();

  // Copy the draft file to the published folder
  const res = await drive.files.copy({
    fileId: draftFileId,
    requestBody: { parents: [targetFolderId] },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return { id: res.data.id!, webViewLink: res.data.webViewLink ?? "" };
}

// ─── 10. provisionClientDriveFromProspect ─────────────────────────────────────
// Creates the standard Drive workspace for a newly converted prospect/case and,
// if the prospect already has a resume file in Drive, copies it into the new
// Resume/ folder so staff can find it immediately.
//
// Safe to call from setImmediate — all errors are logged, never thrown.

export async function provisionClientDriveFromProspect(
  profileId: number,
  clientEmail: string,
  prospect: {
    driveFileId?: string | null;
    resumeFileName?: string | null;
    fullName: string;
  },
): Promise<void> {
  // 1. Create (or find) the standard folder hierarchy
  const roots = await createClientRootFolders(profileId, clientEmail);

  // 2. Copy the prospect's resume file into Resume/ if one is stored in Drive
  if (prospect.driveFileId) {
    try {
      const drive = getDriveClient();

      // Build a tidy file name: Resume_<LastName>_<YYYY-MM-DD>.<ext>
      const nameParts = prospect.fullName.trim().split(/\s+/);
      const lastName = (nameParts.slice(1).join("_") || nameParts[0]) ?? "Client";
      const date = new Date().toISOString().split("T")[0];
      const ext =
        prospect.resumeFileName && prospect.resumeFileName.includes(".")
          ? "." + prospect.resumeFileName.split(".").pop()
          : "";
      const fileName = `Resume_${sanitizeFileName(lastName)}_${date}${ext}`;

      await drive.files.copy({
        fileId: prospect.driveFileId,
        requestBody: {
          name: fileName,
          parents: [roots.resumeFolderId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
    } catch (copyErr: unknown) {
      // Non-fatal — workspace was still created; log and continue
      const msg = copyErr instanceof Error ? copyErr.message : String(copyErr);
      console.error(
        `[provisionClientDriveFromProspect] Resume copy failed for profile ${profileId}:`,
        msg,
      );
    }
  }
}

// ─── 11. autoProvisionDrive ───────────────────────────────────────────────────
// Shared trigger for all case creation / product purchase events.
// Marks driveSyncStatus → pending → synced (or failed after one retry).
// Safe to call from setImmediate — all errors are caught internally.

// Strip separators and lowercase before matching intake / profile values to VisaPathKey
function normalizeVisaPath(raw: string | null | undefined): VisaPathKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/[-_ ]/g, "");
  if (s === "eb1a") return "eb1a";
  if (s === "niw" || s === "eb2niw") return "niw";
  if (s === "o1" || s === "o1a") return "o1" as VisaPathKey;
  return null;
}

async function runProvision(
  profileId: number,
  clientEmail: string,
  visaPathRaw: string | null | undefined,
): Promise<void> {
  // Step 1: Root folders — always, idempotent
  await createClientRootFolders(profileId, clientEmail);

  // Step 2: Per-criterion folders — only when visa path is known
  const visaPath = normalizeVisaPath(visaPathRaw);
  if (visaPath) {
    await createCriteriaEvidenceFolders(profileId, visaPath);

    // In-app notification — deduplicated (no unique constraint on this table)
    const [existingNotif] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.profileId, profileId),
          eq(notificationsTable.notificationType, "drive_provisioned"),
        ),
      )
      .limit(1);

    if (!existingNotif) {
      await db.insert(notificationsTable).values({
        profileId,
        userType: "client",
        notificationType: "drive_provisioned",
        title: "Your Drive folders are ready",
        message:
          "Your evidence folders have been set up in Google Drive. You can upload files directly in Drive and they will sync automatically into your Evidence Engine.",
        link: "/evidence",
        status: "unread",
        priority: "high",
      });
    }
  }

  // Activity log
  await db.insert(clientActivityLogTable).values({
    profileId,
    eventType: "drive_auto_provisioned",
    eventData: {
      message: visaPath
        ? `Drive workspace auto-provisioned (${visaPath.toUpperCase()}) — root + criteria folders created.`
        : "Drive root workspace auto-provisioned (no visa path yet — criteria folders pending).",
      visaPath: visaPath ?? null,
    },
  });
}

export async function autoProvisionDrive(
  profileId: number,
  clientEmail: string,
  visaPathRaw: string | null | undefined,
): Promise<void> {
  // Mark pending — best-effort, non-blocking
  await db
    .update(profilesTable)
    .set({ driveSyncStatus: "pending" })
    .where(eq(profilesTable.id, profileId))
    .catch((err) => logger.warn({ err, profileId }, "[autoProvisionDrive] Could not set pending status"));

  // First attempt
  try {
    await runProvision(profileId, clientEmail, visaPathRaw);
    await db
      .update(profilesTable)
      .set({ driveSyncStatus: "synced" })
      .where(eq(profilesTable.id, profileId))
      .catch((err) => logger.warn({ err, profileId }, "[autoProvisionDrive] Could not set synced status"));
    return;
  } catch (err1: unknown) {
    logger.warn({ err: err1, profileId }, "[autoProvisionDrive] First attempt failed — retrying in 5s");
  }

  // Wait 5 s then retry once
  await new Promise<void>((resolve) => setTimeout(resolve, 5000));

  try {
    await runProvision(profileId, clientEmail, visaPathRaw);
    await db
      .update(profilesTable)
      .set({ driveSyncStatus: "synced" })
      .where(eq(profilesTable.id, profileId))
      .catch((err) => logger.warn({ err, profileId }, "[autoProvisionDrive] Could not set synced status after retry"));
  } catch (err2: unknown) {
    logger.error({ err: err2, profileId }, "[autoProvisionDrive] Failed after retry — marking as failed");
    await db
      .update(profilesTable)
      .set({ driveSyncStatus: "failed" })
      .where(eq(profilesTable.id, profileId))
      .catch(() => {});
  }
}

// ─── 12. getClientFolderSummary ───────────────────────────────────────────────

export async function getClientFolderSummary(userId: number) {
  const [driveRoot] = await db
    .select()
    .from(clientDriveRootsTable)
    .where(eq(clientDriveRootsTable.profileId, userId))
    .limit(1);

  if (!driveRoot) {
    return null;
  }

  const criteriaFolders = await db
    .select()
    .from(clientDriveFoldersTable)
    .where(eq(clientDriveFoldersTable.profileId, userId));

  return {
    root: driveRoot,
    criteriaFolders,
  };
}

// ─── 11. listFolderFiles ──────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

export async function listFolderFiles(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<DriveFile[]> {
  const results: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents AND trashed = false AND mimeType != 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
      spaces: "drive",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const f of res.data.files ?? []) {
      results.push({
        id: f.id!,
        name: f.name ?? "untitled",
        mimeType: f.mimeType ?? "application/octet-stream",
        size: f.size ?? null,
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

// ─── 11b. listFolderContents — files + sub-folders in one call ────────────────

export interface DriveFolderItem extends DriveFile {
  isFolder: boolean;
}

export async function listFolderContents(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<DriveFolderItem[]> {
  const results: DriveFolderItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents AND trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
      spaces: "drive",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const f of res.data.files ?? []) {
      results.push({
        id: f.id!,
        name: f.name ?? "untitled",
        mimeType: f.mimeType ?? "application/octet-stream",
        size: f.size ?? null,
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

// ─── 12. downloadDriveFile ────────────────────────────────────────────────────

export interface DownloadedFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export async function downloadDriveFile(
  drive: drive_v3.Drive,
  fileId: string,
  originalMimeType: string,
  originalFileName: string,
): Promise<DownloadedFile> {
  const isGoogleDoc = originalMimeType.startsWith("application/vnd.google-apps.");

  if (isGoogleDoc) {
    // Export Google Workspace files as PDF for consistent text extraction
    const exportMime = "application/pdf";
    const exportExt = ".pdf";

    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: "arraybuffer" },
    );

    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    return {
      buffer: Buffer.from(res.data as ArrayBuffer),
      mimeType: exportMime,
      fileName: baseName + exportExt,
    };
  }

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mimeType: originalMimeType,
    fileName: originalFileName,
  };
}

// ─── File name builders (re-exported for route use) ───────────────────────────

export function buildCriteriaExhibitName(
  num: number,
  criteriaCode: string,
  clientLastName: string,
  version?: number,
): string {
  const date = new Date().toISOString().split("T")[0];
  const safeLast = sanitizeFileName(clientLastName);
  const vSuffix = version && version > 1 ? `_v${version}` : "";
  return `Exhibit_${String(num).padStart(2, "0")}_${criteriaCode}_${safeLast}_${date}${vSuffix}.pdf`;
}

export function buildRecoLetterName(
  recommenderLastName: string,
  clientLastName: string,
): string {
  const date = new Date().toISOString().split("T")[0];
  const safeRec = sanitizeFileName(recommenderLastName);
  const safeClient = sanitizeFileName(clientLastName);
  return `RecoLetter_${safeRec}_${safeClient}_${date}.pdf`;
}

export function buildExhibitIndexName(clientLastName: string): string {
  const date = new Date().toISOString().split("T")[0];
  const safeLast = sanitizeFileName(clientLastName);
  return `ExhibitIndex_${safeLast}_${date}.pdf`;
}

export function buildCoverLetterName(
  clientLastName: string,
  visaPath: string,
): string {
  const date = new Date().toISOString().split("T")[0];
  const safeLast = sanitizeFileName(clientLastName);
  const safeVisa = visaPath.toUpperCase();
  return `PetitionLetter_${safeLast}_${safeVisa}_${date}.pdf`;
}
