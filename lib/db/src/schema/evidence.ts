import { pgTable, text, serial, integer, boolean, jsonb, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evidenceTable = pgTable("evidence", {
  id: serial("id").primaryKey(),
  // Legacy integer FK kept for backward compat; new rows use primaryCriteriaId instead
  criterionId: integer("criterion_id").notNull().default(0),
  // Text criteria ID matching visa_criteria.id (e.g. "EB1A-01")
  primaryCriteriaId: text("primary_criteria_id"),
  profileId: integer("profile_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  evidenceType: text("evidence_type").notNull().default("other"),
  status: text("status").notNull().default("draft"),
  sourceUrl: text("source_url"),
  dateAchieved: date("date_achieved"),
  // File info
  fileName: text("file_name"),
  // Extraction and AI
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractedText: text("extracted_text"),
  extractionJson: jsonb("extraction_json"),
  aiSummary: text("ai_summary"),
  aiSummaryIgnored: boolean("ai_summary_ignored").default(false),
  // Additional criteria cross-referencing (array of text criteria IDs)
  additionalCriteriaIds: jsonb("additional_criteria_ids").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEvidenceSchema = createInsertSchema(evidenceTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidenceTable.$inferSelect;
