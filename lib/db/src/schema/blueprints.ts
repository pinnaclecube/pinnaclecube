import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blueprintsTable = pgTable("blueprints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  visaTarget: text("visa_target").notNull(),
  strategySummary: text("strategy_summary").notNull(),
  targetFilingDate: date("target_filing_date"),
  assignedConsultant: text("assigned_consultant"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  blueprintId: integer("blueprint_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  completed: text("completed").notNull().default("false"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBlueprintSchema = createInsertSchema(blueprintsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBlueprint = z.infer<typeof insertBlueprintSchema>;
export type Blueprint = typeof blueprintsTable.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;
