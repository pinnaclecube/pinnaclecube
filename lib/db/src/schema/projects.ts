import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casePetitionSetupTable } from "./petition";
import { refereesTable } from "./referees";

// ─── Lookup: employment types ────────────────────────────────────────────────────
// Admin-extendable, follows the degree_types pattern.

export const employmentTypesTable = pgTable("employment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Lookup: criticality levels ──────────────────────────────────────────────────

export const criticalityLevelsTable = pgTable("criticality_levels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Lookup: project document categories ─────────────────────────────────────────

export const projectDocumentCategoriesTable = pgTable("project_document_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Case projects (parent, belongs to a case = case_petition_setup) ─────────────

export const caseProjectsTable = pgTable("case_projects", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  // Future-proofing — consistent with referees. No lock workflow in this build.
  isLocked: boolean("is_locked").notNull().default(false),
  createdBy: text("created_by").notNull().default("client"), // 'client' | 'staff'

  // ── Section 1 — Project Snapshot (structured) ──────────────────────────────────
  title: text("title").notNull(), // only field required to create a project
  organization: text("organization"),
  industryDomain: text("industry_domain"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isOngoing: boolean("is_ongoing").notNull().default(false),
  roleTitle: text("role_title"),
  employmentTypeId: integer("employment_type_id").references(
    () => employmentTypesTable.id,
    { onDelete: "set null" },
  ),
  teamComposition: text("team_composition"),
  summary: text("summary"),
  criticalityId: integer("criticality_id").references(() => criticalityLevelsTable.id, {
    onDelete: "set null",
  }),
  criticalityJustification: text("criticality_justification"),
  regulatoryContext: text("regulatory_context"),

  // ── Section 2 — Problem, Baseline & Stakes ─────────────────────────────────────
  problemBefore: text("problem_before"),
  baselineMetrics: text("baseline_metrics"),
  constraintsRisks: text("constraints_risks"),
  failureConsequences: text("failure_consequences"),

  // ── Section 3 — Leadership & Critical Role ─────────────────────────────────────
  whyChosen: text("why_chosen"),
  decisionAuthority: text("decision_authority"),
  stakeholdersInfluenced: text("stakeholders_influenced"),
  criticalEventsLed: text("critical_events_led"),
  indispensabilityEvidence: text("indispensability_evidence"),
  leadershipOutcomes: text("leadership_outcomes"),

  // ── Section 4 — Original Contribution ──────────────────────────────────────────
  originalIdea: text("original_idea"),
  approachDifference: text("approach_difference"),
  originalityProof: text("originality_proof"),
  contributionReach: text("contribution_reach"),
  downstreamImpact: text("downstream_impact"),

  // ── Section 5 — Quantitative Impact ────────────────────────────────────────────
  beforeAfterMetrics: text("before_after_metrics"),
  revenueCostSavings: text("revenue_cost_savings"),
  adoptionMetrics: text("adoption_metrics"),
  evidenceNotes: text("evidence_notes"),

  // ── Section 6 — Qualitative Impact & Recognition ───────────────────────────────
  testimonials: text("testimonials"),
  pressRecognition: text("press_recognition"),
  awardsCommendations: text("awards_commendations"),
  strategicImportance: text("strategic_importance"),

  // ── Section 7 — Technical Depth ────────────────────────────────────────────────
  architectureMethods: text("architecture_methods"),
  alternativesInferior: text("alternatives_inferior"),
  reproducibility: text("reproducibility"),
  ipStatus: text("ip_status"),

  // ── Section 8 — External Adoption & Citations ──────────────────────────────────
  externalUsers: text("external_users"),
  adoptionEvidence: text("adoption_evidence"),
  academicCitations: text("academic_citations"),
  talksInvitations: text("talks_invitations"),

  // ── Section 9 — Comparative Positioning ────────────────────────────────────────
  uniquenessVsPeers: text("uniqueness_vs_peers"),
  measurableDifferences: text("measurable_differences"),
  expertiseScarcity: text("expertise_scarcity"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Project documents (child — evidence uploads) ────────────────────────────────

export const projectDocumentsTable = pgTable("project_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => caseProjectsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => projectDocumentCategoriesTable.id,
    { onDelete: "set null" },
  ),
  driveFileId: text("drive_file_id").notNull(),
  fileName: text("file_name"),
  description: text("description"),
  uploadedBy: text("uploaded_by").notNull().default("client"), // 'client' | 'staff'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Referee ↔ Project mapping (SCHEMA ONLY in this build — no UI yet) ────────────
// Future AI-generated reference letters map referees to the projects they attest to.

export const refereeProjectsTable = pgTable(
  "referee_projects",
  {
    id: serial("id").primaryKey(),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => refereesTable.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => caseProjectsTable.id, { onDelete: "cascade" }),
    attestationNotes: text("attestation_notes"),
  },
  (t) => ({
    uniqueRefereeProject: unique("referee_projects_referee_project_unique").on(
      t.refereeId,
      t.projectId,
    ),
  }),
);

// ─── Insert schemas / types ──────────────────────────────────────────────────────

export const insertEmploymentTypeSchema = createInsertSchema(employmentTypesTable).omit({ id: true });
export const insertCriticalityLevelSchema = createInsertSchema(criticalityLevelsTable).omit({ id: true });
export const insertProjectDocumentCategorySchema = createInsertSchema(projectDocumentCategoriesTable).omit({ id: true });

export const insertCaseProjectSchema = createInsertSchema(caseProjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProjectDocumentSchema = createInsertSchema(projectDocumentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertRefereeProjectSchema = createInsertSchema(refereeProjectsTable).omit({ id: true });

export type EmploymentType = typeof employmentTypesTable.$inferSelect;
export type CriticalityLevel = typeof criticalityLevelsTable.$inferSelect;
export type ProjectDocumentCategory = typeof projectDocumentCategoriesTable.$inferSelect;
export type CaseProject = typeof caseProjectsTable.$inferSelect;
export type InsertCaseProject = z.infer<typeof insertCaseProjectSchema>;
export type ProjectDocument = typeof projectDocumentsTable.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type RefereeProject = typeof refereeProjectsTable.$inferSelect;
export type InsertRefereeProject = z.infer<typeof insertRefereeProjectSchema>;
