import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const internalCaseNotesTable = pgTable("internal_case_notes", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  staffUserId: text("staff_user_id").notNull(),
  noteType: text("note_type").default("general"),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const internalEvidenceNotesTable = pgTable("internal_evidence_notes", {
  id: serial("id").primaryKey(),
  evidenceItemId: integer("evidence_item_id").notNull(),
  staffUserId: text("staff_user_id").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientActivityLogTable = pgTable("client_activity_log", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInternalCaseNoteSchema = createInsertSchema(internalCaseNotesTable).omit({ id: true, createdAt: true });
export const insertInternalEvidenceNoteSchema = createInsertSchema(internalEvidenceNotesTable).omit({ id: true, createdAt: true });
export const insertClientActivityLogSchema = createInsertSchema(clientActivityLogTable).omit({ id: true, createdAt: true });
export type InsertInternalCaseNote = z.infer<typeof insertInternalCaseNoteSchema>;
export type InternalCaseNote = typeof internalCaseNotesTable.$inferSelect;
export type InsertInternalEvidenceNote = z.infer<typeof insertInternalEvidenceNoteSchema>;
export type InternalEvidenceNote = typeof internalEvidenceNotesTable.$inferSelect;
export type InsertClientActivityLog = z.infer<typeof insertClientActivityLogSchema>;
export type ClientActivityLog = typeof clientActivityLogTable.$inferSelect;
