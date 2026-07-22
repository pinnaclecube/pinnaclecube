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
