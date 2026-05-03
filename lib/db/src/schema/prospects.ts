import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  currentRole: text("current_role"),
  linkedinUrl: text("linkedin_url"),
  driveFileId: text("drive_file_id"),
  sourceType: text("source_type"),
  internalNotes: text("internal_notes"),
  ownerStaffUser: text("owner_staff_user"),
  yearsOfExperience: text("years_of_experience"),
  fieldOfWork: text("field_of_work"),
  summary: text("summary"),
  publicationsSignal: boolean("publications_signal").default(false),
  awardsSignal: boolean("awards_signal").default(false),
  leadershipSignal: boolean("leadership_signal").default(false),
  status: text("status").default("new"),
  registrationStatus: text("registration_status").default("not_invited"),
  linkedProfileId: integer("linked_profile_id"),
  resumeText: text("resume_text"),
  resumeFileName: text("resume_file_name"),
  roadmapContent: text("roadmap_content"),
  roadmapVisaCategory: text("roadmap_visa_category"),
  roadmapGeneratedAt: timestamp("roadmap_generated_at", { withTimezone: true }),
  invoiceSentAt: timestamp("invoice_sent_at", { withTimezone: true }),
  invoiceProduct: text("invoice_product"),
  invoiceCheckoutUrl: text("invoice_checkout_url"),
  invoiceStripeSessionId: text("invoice_stripe_session_id"),
  paymentReceivedAt: timestamp("payment_received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quizLeadsTable = pgTable("quiz_leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  quizAnswers: jsonb("quiz_answers"),
  resultType: text("result_type"),
  status: text("status").default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({ id: true, createdAt: true });
export const insertQuizLeadSchema = createInsertSchema(quizLeadsTable).omit({ id: true, createdAt: true });
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
export type InsertQuizLead = z.infer<typeof insertQuizLeadSchema>;
export type QuizLead = typeof quizLeadsTable.$inferSelect;
