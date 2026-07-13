import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
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
