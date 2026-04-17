import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const criteriaTable = pgTable("criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  visaType: text("visa_type").notNull(),
  uscisCode: text("uscis_code").notNull(),
  requiredMinimum: integer("required_minimum").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCriterionSchema = createInsertSchema(criteriaTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCriterion = z.infer<typeof insertCriterionSchema>;
export type Criterion = typeof criteriaTable.$inferSelect;
