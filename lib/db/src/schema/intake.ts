import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resumeUploadsTable = pgTable("resume_uploads", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  fileName: text("file_name"),
  uploadDate: timestamp("upload_date", { withTimezone: true }).defaultNow(),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readinessIntakeTable = pgTable("readiness_intake", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),
  fullName: text("full_name"),
  email: text("email"),
  currentRole: text("current_role"),
  company: text("company"),
  country: text("country"),
  education: text("education"),
  fieldOfWork: text("field_of_work"),
  yearsExperience: text("years_experience"),
  summary: text("summary"),
  describeWork: text("describe_work"),
  keyAchievements: text("key_achievements"),
  publications: text("publications"),
  awards: text("awards"),
  media: text("media"),
  judgingReviewing: text("judging_reviewing"),
  leadershipRoles: text("leadership_roles"),
  memberships: text("memberships"),
  salaryIndicators: text("salary_indicators"),
  documentationAvailable: text("documentation_available"),
  evidenceOrganization: text("evidence_organization"),
  evidenceStorage: text("evidence_storage"),
  visaPath: text("visa_path"),
  timeline: text("timeline"),
  currentGoal: text("current_goal"),
  resumeUploadId: integer("resume_upload_id"),
  readinessCompleted: boolean("readiness_completed").default(false),
  readinessCompletedAt: timestamp("readiness_completed_at", { withTimezone: true }),
  driveFoldersCreated: boolean("drive_folders_created").default(false),
  driveFoldersCreatedAt: timestamp("drive_folders_created_at", { withTimezone: true }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertResumeUploadSchema = createInsertSchema(resumeUploadsTable).omit({ id: true, createdAt: true });
export const insertReadinessIntakeSchema = createInsertSchema(readinessIntakeTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResumeUpload = z.infer<typeof insertResumeUploadSchema>;
export type ResumeUpload = typeof resumeUploadsTable.$inferSelect;
export type InsertReadinessIntake = z.infer<typeof insertReadinessIntakeSchema>;
export type ReadinessIntake = typeof readinessIntakeTable.$inferSelect;
