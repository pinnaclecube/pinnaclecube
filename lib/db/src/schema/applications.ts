import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  currentRole: text("current_role"),
  country: text("country"),
  visaPath: text("visa_path"),
  field: text("field"),
  yearsExperience: text("years_experience"),
  topAchievements: text("top_achievements"),
  publications: text("publications"),
  awards: text("awards"),
  evidenceOrganization: text("evidence_organization"),
  documentationAvailable: text("documentation_available"),
  linkedinUrl: text("linkedin_url"),
  resumeFile: text("resume_file"),
  resumeUploadId: integer("resume_upload_id"),
  extractedData: jsonb("extracted_data"),
  whyApplying: text("why_applying"),
  timeline: text("timeline"),
  status: text("status").notNull().default("submitted"),
  paymentStatus: text("payment_status").default("pending"),
  paymentNotes: text("payment_notes"),
  paymentReceivedAt: timestamp("payment_received_at", { withTimezone: true }),
  paymentReceivedBy: text("payment_received_by"),
  includeExcellenceLab: boolean("include_excellence_lab").default(false),
  adminConfidenceScore: integer("admin_confidence_score"),
  adminStrengtheningRoadmap: text("admin_strengthening_roadmap"),
  adminEstimatedTimeline: text("admin_estimated_timeline"),
  adminAiAnalysis: text("admin_ai_analysis"),
  adminReviewNotes: text("admin_review_notes"),
  adminReviewedAt: timestamp("admin_reviewed_at", { withTimezone: true }),
  adminReviewedBy: text("admin_reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
