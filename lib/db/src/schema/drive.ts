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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientDriveRootSchema = createInsertSchema(clientDriveRootsTable).omit({ id: true });
export const insertClientDriveFolderSchema = createInsertSchema(clientDriveFoldersTable).omit({ id: true, createdAt: true });
export type InsertClientDriveRoot = z.infer<typeof insertClientDriveRootSchema>;
export type ClientDriveRoot = typeof clientDriveRootsTable.$inferSelect;
export type InsertClientDriveFolder = z.infer<typeof insertClientDriveFolderSchema>;
export type ClientDriveFolder = typeof clientDriveFoldersTable.$inferSelect;
