import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casePetitionSetupTable } from "./petition";
import { refereesTable } from "./referees";
import { caseFolderItemsTable } from "./drive";

// ─── Evidence groups (Step 5 — one group = one logical accomplishment) ───────────
// A group holds N evidence files (case_folder_items). Referees map to GROUPS;
// letter generation expands a mapped group to all member files. Proposed by the
// AI grouping job (status 'suggested') and confirmed by staff.

export const evidenceGroupsTable = pgTable("evidence_groups", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  criterionFolder: text("criterion_folder"), // same key set as case_folder_items
  createdBy: text("created_by").notNull().default("ai"), // 'ai' | 'staff' | 'client'
  status: text("status").notNull().default("suggested"), // 'suggested' | 'confirmed'
  aiRationale: text("ai_rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Proposed group membership (suggestions, applied on confirm) ─────────────────
// For a 'suggested' NEW group: rows link proposed member files to that group;
// files' group_id is set only when staff confirm. For an ADD-to-confirmed
// suggestion: is_add_to_confirmed = true and group_id points at an existing
// confirmed group (no new group row).

export const evidenceGroupSuggestionsTable = pgTable(
  "evidence_group_suggestions",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => evidenceGroupsTable.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => caseFolderItemsTable.id, { onDelete: "cascade" }),
    isAddToConfirmed: boolean("is_add_to_confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueGroupFile: unique("evidence_group_suggestions_group_file_unique").on(t.groupId, t.fileId),
  }),
);

// ─── Referee ↔ evidence group mapping (replaces per-file referee_evidence) ────────

export const refereeEvidenceGroupsTable = pgTable(
  "referee_evidence_groups",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    evidenceGroupId: integer("evidence_group_id")
      .notNull()
      .references(() => evidenceGroupsTable.id, { onDelete: "cascade" }),
    attestationNotes: text("attestation_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueRefereeGroup: unique("referee_evidence_groups_referee_group_unique").on(
      t.refereeId,
      t.evidenceGroupId,
    ),
  }),
);

// ─── AI grouping jobs (async queue — mirrors letter_generation_jobs) ─────────────

export const evidenceGroupingJobsTable = pgTable(
  "evidence_grouping_jobs",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id")
      .notNull()
      .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // 'queued'|'processing'|'done'|'failed'
    requestedBy: text("requested_by").notNull().default("staff"), // 'staff' | 'auto'
    newGroups: integer("new_groups"), // count of proposals produced (on success)
    addSuggestions: integer("add_suggestions"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    oneActivePerCase: uniqueIndex("evidence_grouping_jobs_one_active_per_case")
      .on(t.caseId)
      .where(sql`status in ('queued', 'processing')`),
  }),
);

// ─── Insert schemas / types ──────────────────────────────────────────────────────

export const insertEvidenceGroupSchema = createInsertSchema(evidenceGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEvidenceGroupSuggestionSchema = createInsertSchema(evidenceGroupSuggestionsTable).omit({ id: true, createdAt: true });
export const insertRefereeEvidenceGroupSchema = createInsertSchema(refereeEvidenceGroupsTable).omit({ id: true, createdAt: true });
export const insertEvidenceGroupingJobSchema = createInsertSchema(evidenceGroupingJobsTable).omit({ id: true, createdAt: true });

export type EvidenceGroup = typeof evidenceGroupsTable.$inferSelect;
export type InsertEvidenceGroup = z.infer<typeof insertEvidenceGroupSchema>;
export type EvidenceGroupSuggestion = typeof evidenceGroupSuggestionsTable.$inferSelect;
export type RefereeEvidenceGroup = typeof refereeEvidenceGroupsTable.$inferSelect;
export type EvidenceGroupingJob = typeof evidenceGroupingJobsTable.$inferSelect;
