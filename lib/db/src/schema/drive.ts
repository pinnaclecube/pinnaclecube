import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casePetitionSetupTable } from "./petition";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const folderTypeEnum = pgEnum("folder_type", [
  "root",
  "resume",
  "evidence",
  "demographics",
  "exhibits",
  "criteria",
]);

export const visaCategoryEnum = pgEnum("visa_category", [
  "EB1A",
  "NIW",
  "O1A",
]);

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Zod schemas & types ──────────────────────────────────────────────────────

export const insertCaseFolderSchema = createInsertSchema(caseFoldersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCaseFolder = z.infer<typeof insertCaseFolderSchema>;
export type CaseFolder = typeof caseFoldersTable.$inferSelect;
