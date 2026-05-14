import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientDriveRootsTable = pgTable("client_drive_roots", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),
  clientRootFolderId: text("client_root_folder_id").notNull(),
  resumeFolderId: text("resume_folder_id").notNull(),
  evidenceRootFolderId: text("evidence_root_folder_id").notNull(),
  petitionRootFolderId: text("petition_root_folder_id"),
  petitionDraftsCriteriaId: text("petition_drafts_criteria_id"),
  petitionDraftsRecoId: text("petition_drafts_reco_id"),
  petitionDraftsPackageId: text("petition_drafts_package_id"),
  petitionPublishedCriteriaId: text("petition_published_criteria_id"),
  petitionPublishedRecoId: text("petition_published_reco_id"),
  petitionPublishedPackageId: text("petition_published_package_id"),
  foldersCreatedAt: timestamp("folders_created_at", { withTimezone: true }).defaultNow(),
});

export const clientDriveFoldersTable = pgTable("client_drive_folders", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  criteriaId: text("criteria_id").notNull(),
  visaPath: text("visa_path").notNull(),
  folderName: text("folder_name").notNull(),
  driveFolderId: text("drive_folder_id").notNull(),
  driveFolderUrl: text("drive_folder_url"),
  lastDriveSyncAt: timestamp("last_drive_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driveIngestLogsTable = pgTable("drive_ingest_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  criteriaId: text("criteria_id").notNull(),
  driveFileId: text("drive_file_id").notNull(),
  fileName: text("file_name").notNull(),
  extractionStatus: text("extraction_status").notNull(),
  errorMessage: text("error_message"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── User-created subfolders ───────────────────────────────────────────────────
// Tracks subfolders created via the app UI under criteria folders or other subfolders.

export const driveSubfoldersTable = pgTable("drive_subfolders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  profileId: integer("profile_id").notNull(),
  parentType: text("parent_type").notNull(), // 'criteria_folder' | 'subfolder'
  parentId: integer("parent_id").notNull(),  // FK to client_drive_folders.id or drive_subfolders.id
  parentDriveId: text("parent_drive_id").notNull(), // cached Drive ID of parent
  driveId: text("drive_id").notNull(),
  driveUrl: text("drive_url"),
  role: text("role").notNull(), // 'client' | 'staff'
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientDriveRootSchema = createInsertSchema(clientDriveRootsTable).omit({ id: true });
export const insertClientDriveFolderSchema = createInsertSchema(clientDriveFoldersTable).omit({ id: true, createdAt: true });
export const insertDriveIngestLogSchema = createInsertSchema(driveIngestLogsTable).omit({ id: true, ingestedAt: true });
export const insertDriveSubfolderSchema = createInsertSchema(driveSubfoldersTable).omit({ id: true, createdAt: true });

export type InsertClientDriveRoot = z.infer<typeof insertClientDriveRootSchema>;
export type ClientDriveRoot = typeof clientDriveRootsTable.$inferSelect;
export type InsertClientDriveFolder = z.infer<typeof insertClientDriveFolderSchema>;
export type ClientDriveFolder = typeof clientDriveFoldersTable.$inferSelect;
export type DriveIngestLog = typeof driveIngestLogsTable.$inferSelect;
export type InsertDriveIngestLog = z.infer<typeof insertDriveIngestLogSchema>;
export type DriveSubfolder = typeof driveSubfoldersTable.$inferSelect;
export type InsertDriveSubfolder = z.infer<typeof insertDriveSubfolderSchema>;
