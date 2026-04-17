import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personalizedLearningPlansTable = pgTable("personalized_learning_plans", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),
  planType: text("plan_type").default("excellence_lab"),
  status: text("status").default("active"),
  generationVersion: integer("generation_version").default(1),
  planPayload: jsonb("plan_payload").default({}),
  completedLessonIds: jsonb("completed_lesson_ids").default([]),
  contextHash: text("context_hash"),
  lastInvalidatedAt: timestamp("last_invalidated_at", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const instantProfileInsightSubmissionsTable = pgTable("instant_profile_insight_submissions", {
  id: serial("id").primaryKey(),
  email: text("email"),
  role: text("role"),
  field: text("field"),
  yearsExperience: text("years_experience"),
  publicationsCount: integer("publications_count"),
  awardsCount: integer("awards_count"),
  leadershipIndicator: boolean("leadership_indicator"),
  resumeText: text("resume_text"),
  generatedSummary: text("generated_summary"),
  currentPosition: text("current_position"),
  suggestedNextSteps: text("suggested_next_steps"),
  recommendedProduct: text("recommended_product"),
  quizAnswers: jsonb("quiz_answers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonalizedLearningPlanSchema = createInsertSchema(personalizedLearningPlansTable).omit({ id: true, generatedAt: true, updatedAt: true });
export const insertInstantProfileInsightSchema = createInsertSchema(instantProfileInsightSubmissionsTable).omit({ id: true, createdAt: true });
export type InsertPersonalizedLearningPlan = z.infer<typeof insertPersonalizedLearningPlanSchema>;
export type PersonalizedLearningPlan = typeof personalizedLearningPlansTable.$inferSelect;
export type InsertInstantProfileInsight = z.infer<typeof insertInstantProfileInsightSchema>;
export type InstantProfileInsight = typeof instantProfileInsightSubmissionsTable.$inferSelect;
