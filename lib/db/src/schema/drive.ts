import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casePetitionSetupTable } from "./petition";
import { profilesTable } from "./profiles";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const folderTypeEnum = pgEnum("folder_type", [
  "root",
  "resume",
  "evidence",
  "demographics",
  "exhibits",
  "criteria",
  "custom",
]);

export const visaCategoryEnum = pgEnum("visa_category", [
  "EB1A",
  "NIW",
  "O1A",
]);

export const addedBySourceEnum = pgEnum("added_by_source", ["app", "drive"]);

// ─── case_folders ─────────────────────────────────────────────────────────────

export const caseFoldersTable = pgTable("case_folders", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  folderType: folderTypeEnum("folder_type").notNull(),
  parentFolderId: integer("parent_folder_id"),
  driveId: text("drive_id").notNull(),
  driveUrl: text("drive_url").notNull(),
  visaCategory: visaCategoryEnum("visa_category").notNull(),
  criteriaIndex: integer("criteria_index"),
  staffOnly: boolean("staff_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── case_folder_items ────────────────────────────────────────────────────────

export const caseFolderItemsTable = pgTable("case_folder_items", {
  id: serial("id").primaryKey(),
  caseFolderId: integer("case_folder_id")
    .notNull()
    .references(() => caseFoldersTable.id, { onDelete: "cascade" }),
  driveId: text("drive_id").notNull().unique(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  driveUrl: text("drive_url").notNull(),
  addedBySource: addedBySourceEnum("added_by_source").notNull().default("drive"),
  addedByProfileId: integer("added_by_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  addedByLabel: text("added_by_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── drive_watch_channels ─────────────────────────────────────────────────────

export const driveWatchChannelsTable = pgTable("drive_watch_channels", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().unique(),
  resourceId: text("resource_id").notNull(),
  driveFolderId: text("drive_folder_id").notNull(),
  channelToken: text("channel_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── channel_renewal_failures ─────────────────────────────────────────────────

/**
 * Persists every failed Drive watch-channel renewal so staff can audit them.
 * Records are written by driveWatchService and surfaced via
 * GET /internal/drive/channel-renewal-failures.
 */
export const channelRenewalFailuresTable = pgTable("channel_renewal_failures", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  oldChannelId: text("old_channel_id").notNull(),
  driveFolderId: text("drive_folder_id").notNull(),
  errorMessage: text("error_message").notNull(),
  failedAt: timestamp("failed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChannelRenewalFailure = typeof channelRenewalFailuresTable.$inferSelect;

// ─── Zod schemas & types ──────────────────────────────────────────────────────

export const insertCaseFolderSchema = createInsertSchema(caseFoldersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseFolderItemSchema = createInsertSchema(caseFolderItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCaseFolder = z.infer<typeof insertCaseFolderSchema>;
export type CaseFolder = typeof caseFoldersTable.$inferSelect;
export type InsertCaseFolderItem = z.infer<typeof insertCaseFolderItemSchema>;
export type CaseFolderItem = typeof caseFolderItemsTable.$inferSelect;
export type DriveWatchChannel = typeof driveWatchChannelsTable.$inferSelect;
