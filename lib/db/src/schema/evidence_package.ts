import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casePetitionSetupTable } from "./petition";
import { caseFolderItemsTable } from "./drive";

// ─── Evidence Package module (spec section 5.3 / 5.4) ────────────────────────────
// Durable generation queue + per-file AI classifications. Mirrors the Step 4
// letter-generation job pattern. One active job per case is enforced by the
// partial unique index. See docs/evidence-package-module.md.

export const packageGenerationJobsTable = pgTable(
  "package_generation_jobs",
  {
    id: serial("id").primaryKey(),
    caseSetupId: integer("case_setup_id")
      .notNull()
      .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
    packageVersion: integer("package_version").notNull(),
    // queued | processing | awaiting_group_review | ready_for_review | failed | done
    status: text("status").notNull().default("queued"),
    stage: text("stage"), // current pipeline stage name (scan|extract|classify|plan|generate|assemble)
    stageStatus: jsonb("stage_status").notNull().default({}), // { [stage]: { status, startedAt, finishedAt, metrics } }
    criteriaCodes: jsonb("criteria_codes"), // null = all criteria with confirmed groups
    confirmGroupsFirst: boolean("confirm_groups_first").notNull().default(false),
    requestedBy: text("requested_by").notNull(),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    oneActivePerCase: uniqueIndex("package_jobs_one_active_per_case")
      .on(t.caseSetupId)
      .where(sql`status in ('queued', 'processing', 'awaiting_group_review')`),
    caseIdx: index("package_jobs_case_idx").on(t.caseSetupId),
  }),
);

export const evidenceClassificationsTable = pgTable(
  "evidence_classifications",
  {
    id: serial("id").primaryKey(),
    caseSetupId: integer("case_setup_id")
      .notNull()
      .references(() => casePetitionSetupTable.id, { onDelete: "cascade" }),
    packageVersion: integer("package_version").notNull(),
    fileId: integer("file_id")
      .notNull()
      .references(() => caseFolderItemsTable.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type"), // controlled vocabulary (award certificate, press article, …)
    criterion: text("criterion"), // criterion key the file best supports
    confidence: integer("confidence"), // 0–100
    sortDate: timestamp("sort_date", { withTimezone: true }), // representative date of the document
    summary: text("summary"),
    rawJson: jsonb("raw_json"), // full model classification payload
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseVersionIdx: index("evidence_classifications_case_version_idx").on(t.caseSetupId, t.packageVersion),
    fileIdx: index("evidence_classifications_file_idx").on(t.fileId),
  }),
);

// ─── Insert schemas / types ──────────────────────────────────────────────────────

export const insertPackageGenerationJobSchema = createInsertSchema(packageGenerationJobsTable).omit({
  id: true,
  createdAt: true,
});
export const insertEvidenceClassificationSchema = createInsertSchema(evidenceClassificationsTable).omit({
  id: true,
  createdAt: true,
});

export type PackageGenerationJob = typeof packageGenerationJobsTable.$inferSelect;
export type InsertPackageGenerationJob = z.infer<typeof insertPackageGenerationJobSchema>;
export type EvidenceClassification = typeof evidenceClassificationsTable.$inferSelect;
export type InsertEvidenceClassification = z.infer<typeof insertEvidenceClassificationSchema>;
