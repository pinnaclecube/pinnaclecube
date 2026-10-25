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
import { caseFolderItemsTable } from "./drive";

// ─── Lookup: degree types ───────────────────────────────────────────────────────

export const degreeTypesTable = pgTable("degree_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Lookup: contribution types ─────────────────────────────────────────────────

export const contributionTypesTable = pgTable("contribution_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Referees (belong to a case = case_petition_setup) ───────────────────────────

export const refereesTable = pgTable("referees", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  title: text("title").notNull(),
  organization: text("organization").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  country: text("country"),
  degreeTypeId: integer("degree_type_id").references(() => degreeTypesTable.id, {
    onDelete: "set null",
  }),
  fieldOfExpertise: text("field_of_expertise"),
  profileUrl: text("profile_url"),
  cvDriveFileId: text("cv_drive_file_id"),
  willingnessConfirmed: boolean("willingness_confirmed").notNull().default(false),
  workedTogether: boolean("worked_together").notNull().default(false),
  createdBy: text("created_by").notNull().default("client"), // 'client' | 'staff'
  // Step 2 — locking: set true when the client confirms the reference letter.
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  // Step 3 — shared context (where referee and applicant worked together).
  sharedOrganization: text("shared_organization"),
  sharedPeriod: text("shared_period"),
  // Step 4 — lifetime count of client-triggered letter generations (for the cap).
  clientGenerationCount: integer("client_generation_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Referee contributions (child of referees) ──────────────────────────────────

export const refereeContributionsTable = pgTable(
  "referee_contributions",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    contributionTypeId: integer("contribution_type_id")
      .notNull()
      .references(() => contributionTypesTable.id, { onDelete: "cascade" }),
    details: text("details").notNull(),
  },
  (t) => ({
    uniqueRefereeContribution: unique("referee_contributions_referee_type_unique").on(
      t.refereeId,
      t.contributionTypeId,
    ),
  }),
);

// ─── Reference letters (Step 2 — one active letter per referee, history kept) ────

export const referenceLettersTable = pgTable(
  "reference_letters",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull(),
    driveUrl: text("drive_url"), // full path / link to the file in Drive
    fileName: text("file_name"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("pending_review"), // 'pending_review' | 'confirmed'
    isActive: boolean("is_active").notNull().default(true),
    uploadedByStaffAt: timestamp("uploaded_by_staff_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Only one ACTIVE letter per referee (partial unique index).
    oneActivePerReferee: uniqueIndex("reference_letters_one_active_per_referee")
      .on(t.refereeId)
      .where(sql`is_active`),
  }),
);

// ─── Insert schemas / types ─────────────────────────────────────────────────────

export const insertDegreeTypeSchema = createInsertSchema(degreeTypesTable).omit({ id: true });
export const insertContributionTypeSchema = createInsertSchema(contributionTypesTable).omit({ id: true });
export const insertRefereeSchema = createInsertSchema(refereesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRefereeContributionSchema = createInsertSchema(refereeContributionsTable).omit({ id: true });

export type DegreeType = typeof degreeTypesTable.$inferSelect;
export type ContributionType = typeof contributionTypesTable.$inferSelect;
export type Referee = typeof refereesTable.$inferSelect;
export type RefereeContribution = typeof refereeContributionsTable.$inferSelect;
export type InsertReferee = z.infer<typeof insertRefereeSchema>;
export type InsertRefereeContribution = z.infer<typeof insertRefereeContributionSchema>;

export const insertReferenceLetterSchema = createInsertSchema(referenceLettersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ReferenceLetter = typeof referenceLettersTable.$inferSelect;
export type InsertReferenceLetter = z.infer<typeof insertReferenceLetterSchema>;

// ─── Referee ↔ Evidence file mapping (Step 3 — mirrors referee_projects) ─────────
// Maps a referee to a specific evidence file (a case_folder_items row in the
// case's Evidence/ subtree) they can attest to. Input for AI letter generation.

export const refereeEvidenceTable = pgTable(
  "referee_evidence",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    evidenceFileId: integer("evidence_file_id")
      .notNull()
      .references(() => caseFolderItemsTable.id, { onDelete: "cascade" }),
    displayLabel: text("display_label").notNull(),
    attestationNotes: text("attestation_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueRefereeEvidence: unique("referee_evidence_referee_file_unique").on(
      t.refereeId,
      t.evidenceFileId,
    ),
  }),
);

export const insertRefereeEvidenceSchema = createInsertSchema(refereeEvidenceTable).omit({
  id: true,
  createdAt: true,
});
export type RefereeEvidence = typeof refereeEvidenceTable.$inferSelect;
export type InsertRefereeEvidence = z.infer<typeof insertRefereeEvidenceSchema>;

// ─── Letter drafts (Step 4 — AI-generated reference letter drafts) ───────────────
// Versioned per referee; prior draft becomes 'superseded' on each new generation.
// Staff finalize renders the current draft to DOCX and splices into the Step 2
// upload flow (pending_review → review email → confirm → lock).

export const letterDraftsTable = pgTable("letter_drafts", {
  id: serial("id").primaryKey(),
  refereeId: integer("referee_id")
    .notNull()
    .references(() => refereesTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(), // letter body in markdown
  generatedBy: text("generated_by").notNull(), // 'client' | 'staff'
  feedbackProvided: text("feedback_provided"), // change-request text that drove this version
  wasManuallyEdited: boolean("was_manually_edited").notNull().default(false),
  status: text("status").notNull().default("draft"), // 'draft' | 'finalized' | 'superseded'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLetterDraftSchema = createInsertSchema(letterDraftsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type LetterDraft = typeof letterDraftsTable.$inferSelect;
export type InsertLetterDraft = z.infer<typeof insertLetterDraftSchema>;

// ─── Letter generation jobs (Step 4 — async queue drained by a cron worker) ──────
// "Generate" enqueues a job; the worker claims it, calls the model, writes a
// letter_drafts row, then notifies staff + client. One active job per referee.

export const letterGenerationJobsTable = pgTable(
  "letter_generation_jobs",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // 'queued'|'processing'|'done'|'failed'
    requestedBy: text("requested_by").notNull(), // 'client' | 'staff'
    feedback: text("feedback"), // change-request text for this generation, if any
    draftId: integer("draft_id"), // the letter_drafts row produced (on success)
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    oneActivePerReferee: uniqueIndex("letter_gen_jobs_one_active_per_referee")
      .on(t.refereeId)
      .where(sql`status in ('queued', 'processing')`),
  }),
);

export const insertLetterGenerationJobSchema = createInsertSchema(letterGenerationJobsTable).omit({
  id: true,
  createdAt: true,
});
export type LetterGenerationJob = typeof letterGenerationJobsTable.$inferSelect;
export type InsertLetterGenerationJob = z.infer<typeof insertLetterGenerationJobSchema>;
