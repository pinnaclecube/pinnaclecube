import { pgTable, pgEnum, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driveSyncStatusEnum = pgEnum("drive_sync_status", [
  "pending",
  "synced",
  "failed",
]);

export const casePetitionSetupTable = pgTable("case_petition_setup", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  visaPath: text("visa_path").notNull(),
  selectedCriteria: jsonb("selected_criteria").notNull().default([]),
  exhibitNumberingStyle: text("exhibit_numbering_style").notNull().default("numeric"),
  status: text("status").notNull().default("setup"),
  createdByStaff: text("created_by_staff").notNull(),
  driveSyncStatus: driveSyncStatusEnum("drive_sync_status"),
  driveSyncError: text("drive_sync_error"),
  product: text("product"), // evidence_engine | elite_blueprint | both
  caseActivationEmailSentAt: timestamp("case_activation_email_sent_at", { withTimezone: true }),
  caseActivationEmailStatus: text("case_activation_email_status"), // sent | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const petitionCriteriaExhibitsTable = pgTable("petition_criteria_exhibits", {
  id: serial("id").primaryKey(),
  caseSetupId: integer("case_setup_id").notNull(),
  profileId: integer("profile_id").notNull(),
  criteriaId: text("criteria_id").notNull(),
  criteriaCode: text("criteria_code").notNull(),
  criteriaName: text("criteria_name").notNull(),
  exhibitNumber: text("exhibit_number").notNull(),
  evidenceItemIds: jsonb("evidence_item_ids").default([]),
  status: text("status").notNull().default("not_started"),
  generationJobId: integer("generation_job_id"),
  publishedToClient: boolean("published_to_client").default(false),
  staffApprovedBy: text("staff_approved_by"),
  staffApprovedAt: timestamp("staff_approved_at", { withTimezone: true }),
  regenerationCount: integer("regeneration_count").default(0),
  driveFileId: text("drive_file_id"),
  driveUrl: text("drive_url"),
  driveUploadedAt: timestamp("drive_uploaded_at", { withTimezone: true }),
  documentType: text("document_type").default("criteria_exhibit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const petitionRecoLettersTable = pgTable("petition_reco_letters", {
  id: serial("id").primaryKey(),
  caseSetupId: integer("case_setup_id").notNull(),
  profileId: integer("profile_id").notNull(),
  recommenderName: text("recommender_name").notNull(),
  recommenderTitle: text("recommender_title").notNull(),
  recommenderOrg: text("recommender_org").notNull(),
  recommenderRelationship: text("recommender_relationship").notNull(),
  recommenderCredentials: text("recommender_credentials"),
  criteriaSupported: jsonb("criteria_supported").default([]),
  status: text("status").notNull().default("not_started"),
  generationJobId: integer("generation_job_id"),
  publishedToClient: boolean("published_to_client").default(false),
  staffApprovedBy: text("staff_approved_by"),
  staffApprovedAt: timestamp("staff_approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const petitionPackageTable = pgTable("petition_package", {
  id: serial("id").primaryKey(),
  caseSetupId: integer("case_setup_id").notNull().unique(),
  profileId: integer("profile_id").notNull(),
  exhibitIndexJobId: integer("exhibit_index_job_id"),
  exhibitIndexStatus: text("exhibit_index_status").default("not_started"),
  coverLetterJobId: integer("cover_letter_job_id"),
  coverLetterStatus: text("cover_letter_status").default("not_started"),
  coverLetterDriveFileId: text("cover_letter_drive_file_id"),
  coverLetterDriveUrl: text("cover_letter_drive_url"),
  o1ItineraryJobId: integer("o1_itinerary_job_id"),
  o1ItineraryStatus: text("o1_itinerary_status").default("not_started"),
  personalDeclarationJobId: integer("personal_declaration_job_id"),
  personalDeclarationStatus: text("personal_declaration_status").default("not_started"),
  personalDeclarationDriveFileId: text("personal_declaration_drive_file_id"),
  personalDeclarationDriveUrl: text("personal_declaration_drive_url"),
  fieldBriefJobId: integer("field_brief_job_id"),
  fieldBriefStatus: text("field_brief_status").default("not_started"),
  fieldBriefDriveFileId: text("field_brief_drive_file_id"),
  fieldBriefDriveUrl: text("field_brief_drive_url"),
  recoTemplatesJobId: integer("reco_templates_job_id"),
  recoTemplatesStatus: text("reco_templates_status").default("not_started"),
  petitionReadiness: integer("petition_readiness").default(0),
  packagePublishedAt: timestamp("package_published_at", { withTimezone: true }),
  packagePublishedBy: text("package_published_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentGenerationJobsTable = pgTable("document_generation_jobs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  triggeredByStaffId: text("triggered_by_staff_id").notNull(),
  caseSetupId: integer("case_setup_id"),
  criteriaCode: text("criteria_code"),
  docSubtype: text("doc_subtype").notNull(),
  status: text("status").notNull().default("pending"),
  inputPayload: jsonb("input_payload").default({}),
  staffContextInput: jsonb("staff_context_input").default({}),
  publishedToClient: boolean("published_to_client").default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const criteriaAssessmentsTable = pgTable("criteria_assessments", {
  id: serial("id").primaryKey(),
  caseSetupId: integer("case_setup_id").notNull(),
  profileId: integer("profile_id").notNull(),
  criteriaCode: text("criteria_code").notNull(),
  criteriaName: text("criteria_name").notNull(),
  visaCategory: text("visa_category").notNull(),
  recommendation: text("recommendation"),
  confidenceScore: integer("confidence_score"),
  summary: text("summary"),
  strengths: jsonb("strengths").default([]),
  weaknesses: jsonb("weaknesses").default([]),
  missingEvidence: jsonb("missing_evidence").default([]),
  adjudicatorConcerns: jsonb("adjudicator_concerns").default([]),
  rfeRisk: text("rfe_risk"),
  proceedRecommendation: boolean("proceed_recommendation"),
  documentsAnalyzed: integer("documents_analyzed").default(0),
  assessmentJson: jsonb("assessment_json"),
  assessedAt: timestamp("assessed_at", { withTimezone: true }),
  staffOverride: boolean("staff_override").default(false),
  staffOverrideBy: text("staff_override_by"),
  staffOverrideAt: timestamp("staff_override_at", { withTimezone: true }),
  staffOverrideNote: text("staff_override_note"),
  finalDecision: text("final_decision"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const exhibitDocumentsTable = pgTable("exhibit_documents", {
  id: serial("id").primaryKey(),
  caseSetupId: integer("case_setup_id").notNull(),
  profileId: integer("profile_id").notNull(),
  jobId: integer("job_id"),
  documentType: text("document_type").notNull(),
  exhibitLabel: text("exhibit_label"),
  criteriaCode: text("criteria_code"),
  fileName: text("file_name").notNull(),
  driveFileId: text("drive_file_id"),
  driveUrl: text("drive_url"),
  publishedToClient: boolean("published_to_client").default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: text("published_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

export const insertCasePetitionSetupSchema = createInsertSchema(casePetitionSetupTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPetitionCriteriaExhibitSchema = createInsertSchema(petitionCriteriaExhibitsTable).omit({ id: true, createdAt: true });
export const insertPetitionRecoLetterSchema = createInsertSchema(petitionRecoLettersTable).omit({ id: true, createdAt: true });
export const insertPetitionPackageSchema = createInsertSchema(petitionPackageTable).omit({ id: true, createdAt: true });
export const insertDocumentGenerationJobSchema = createInsertSchema(documentGenerationJobsTable).omit({ id: true, createdAt: true });
export const insertCriteriaAssessmentSchema = createInsertSchema(criteriaAssessmentsTable).omit({ id: true, createdAt: true });
export const insertExhibitDocumentSchema = createInsertSchema(exhibitDocumentsTable).omit({ id: true });

export type InsertCasePetitionSetup = z.infer<typeof insertCasePetitionSetupSchema>;
export type CasePetitionSetup = typeof casePetitionSetupTable.$inferSelect;
export type InsertPetitionCriteriaExhibit = z.infer<typeof insertPetitionCriteriaExhibitSchema>;
export type PetitionCriteriaExhibit = typeof petitionCriteriaExhibitsTable.$inferSelect;
export type InsertPetitionRecoLetter = z.infer<typeof insertPetitionRecoLetterSchema>;
export type PetitionRecoLetter = typeof petitionRecoLettersTable.$inferSelect;
export type InsertPetitionPackage = z.infer<typeof insertPetitionPackageSchema>;
export type PetitionPackage = typeof petitionPackageTable.$inferSelect;
export type InsertDocumentGenerationJob = z.infer<typeof insertDocumentGenerationJobSchema>;
export type DocumentGenerationJob = typeof documentGenerationJobsTable.$inferSelect;
export type InsertCriteriaAssessment = z.infer<typeof insertCriteriaAssessmentSchema>;
export type CriteriaAssessment = typeof criteriaAssessmentsTable.$inferSelect;
export type InsertExhibitDocument = z.infer<typeof insertExhibitDocumentSchema>;
export type ExhibitDocument = typeof exhibitDocumentsTable.$inferSelect;
