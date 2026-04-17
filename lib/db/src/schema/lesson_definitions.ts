import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lessonDefinitionsTable = pgTable("lesson_definitions", {
  id: text("id").primaryKey(),
  moduleId: integer("module_id").notNull(),
  moduleName: text("module_name").notNull(),
  lessonTitle: text("lesson_title").notNull(),
  learningObjective: text("learning_objective").notNull(),
  displayOrder: integer("display_order").notNull(),
  criteriaFocus: text("criteria_focus"),
  isActive: boolean("is_active").default(true),
});

export const insertLessonDefinitionSchema = createInsertSchema(lessonDefinitionsTable);
export type InsertLessonDefinition = z.infer<typeof insertLessonDefinitionSchema>;
export type LessonDefinition = typeof lessonDefinitionsTable.$inferSelect;

export const LESSON_DEFINITIONS_SEED: InsertLessonDefinition[] = [
  { id: "mod1-les1", moduleId: 1, moduleName: "Understanding Extraordinary Ability", lessonTitle: "What USCIS is actually looking for", learningObjective: "Understand how USCIS adjudicators evaluate extraordinary ability and what standard of evidence is required.", displayOrder: 1, criteriaFocus: null, isActive: true },
  { id: "mod1-les2", moduleId: 1, moduleName: "Understanding Extraordinary Ability", lessonTitle: "The criteria explained for your visa type", learningObjective: "Learn what each criterion means in plain language and how it applies to tech professionals.", displayOrder: 2, criteriaFocus: null, isActive: true },
  { id: "mod1-les3", moduleId: 1, moduleName: "Understanding Extraordinary Ability", lessonTitle: "Reading your profile against the criteria", learningObjective: "Map your existing achievements to the criteria and identify your strongest starting points.", displayOrder: 3, criteriaFocus: null, isActive: true },
  { id: "mod2-les1", moduleId: 2, moduleName: "Publications and Scholarly Contributions", lessonTitle: "What counts as a qualifying publication", learningObjective: "Understand the spectrum of publications USCIS accepts and how to frame yours.", displayOrder: 4, criteriaFocus: "EB1A-06", isActive: true },
  { id: "mod2-les2", moduleId: 2, moduleName: "Publications and Scholarly Contributions", lessonTitle: "Citation counts and impact factors", learningObjective: "Learn how to document citation counts and why they matter for your case.", displayOrder: 5, criteriaFocus: "EB1A-06", isActive: true },
  { id: "mod2-les3", moduleId: 2, moduleName: "Publications and Scholarly Contributions", lessonTitle: "Non-traditional publications", learningObjective: "Patents, technical blog posts, whitepapers, and open source — how to qualify these.", displayOrder: 6, criteriaFocus: "EB1A-06", isActive: true },
  { id: "mod3-les1", moduleId: 3, moduleName: "Awards and Recognition", lessonTitle: "What makes an award qualifying", learningObjective: "Distinguish qualifying awards from participation trophies using USCIS standards.", displayOrder: 7, criteriaFocus: "EB1A-01", isActive: true },
  { id: "mod3-les2", moduleId: 3, moduleName: "Awards and Recognition", lessonTitle: "Building your awards narrative", learningObjective: "Frame existing recognition and identify new award opportunities to pursue.", displayOrder: 8, criteriaFocus: "EB1A-01", isActive: true },
  { id: "mod4-les1", moduleId: 4, moduleName: "Press and Media Coverage", lessonTitle: "What qualifies as press coverage", learningObjective: "Understand what major media means to USCIS and how to document it.", displayOrder: 9, criteriaFocus: "EB1A-03", isActive: true },
  { id: "mod4-les2", moduleId: 4, moduleName: "Press and Media Coverage", lessonTitle: "Getting coverage if you have none", learningObjective: "Proactive strategies to earn qualifying press coverage in your field.", displayOrder: 10, criteriaFocus: "EB1A-03", isActive: true },
  { id: "mod5-les1", moduleId: 5, moduleName: "Judging and Peer Review", lessonTitle: "Conference reviewer and journal peer reviewer", learningObjective: "Understand how judging roles qualify and how to document them properly.", displayOrder: 11, criteriaFocus: "EB1A-04", isActive: true },
  { id: "mod5-les2", moduleId: 5, moduleName: "Judging and Peer Review", lessonTitle: "Getting judging roles proactively", learningObjective: "Step-by-step strategy to obtain qualifying reviewer and panel positions.", displayOrder: 12, criteriaFocus: "EB1A-04", isActive: true },
  { id: "mod6-les1", moduleId: 6, moduleName: "Critical Role Evidence", lessonTitle: "Defining critical role for USCIS", learningObjective: "Learn what distinguished organization means and how to document a leading or critical role.", displayOrder: 13, criteriaFocus: "EB1A-07", isActive: true },
  { id: "mod6-les2", moduleId: 6, moduleName: "Critical Role Evidence", lessonTitle: "Field-specific critical role examples", learningObjective: "Real examples of qualifying critical roles for tech, science, and business professionals.", displayOrder: 14, criteriaFocus: "EB1A-07", isActive: true },
  { id: "mod7-les1", moduleId: 7, moduleName: "High Salary Documentation", lessonTitle: "Salary surveys and benchmarking", learningObjective: "Which salary surveys USCIS accepts and how to frame your compensation.", displayOrder: 15, criteriaFocus: "EB1A-08", isActive: true },
  { id: "mod7-les2", moduleId: 7, moduleName: "High Salary Documentation", lessonTitle: "Total compensation and equity", learningObjective: "How to document total compensation including equity, bonuses, and perks.", displayOrder: 16, criteriaFocus: "EB1A-08", isActive: true },
  { id: "mod8-les1", moduleId: 8, moduleName: "Original Contributions", lessonTitle: "Defining original contributions", learningObjective: "What counts as an original contribution of major significance and how to document it.", displayOrder: 17, criteriaFocus: "EB1A-05", isActive: true },
  { id: "mod8-les2", moduleId: 8, moduleName: "Original Contributions", lessonTitle: "Expert letters for contributions", learningObjective: "How expert witness letters validate and amplify original contribution claims.", displayOrder: 18, criteriaFocus: "EB1A-05", isActive: true },
  { id: "mod9-les1", moduleId: 9, moduleName: "Recommendation Letter Strategy", lessonTitle: "Who to ask and why", learningObjective: "Dependent vs independent recommenders — who counts more and why.", displayOrder: 19, criteriaFocus: null, isActive: true },
  { id: "mod9-les2", moduleId: 9, moduleName: "Recommendation Letter Strategy", lessonTitle: "What each letter must say", learningObjective: "The specific content USCIS expects from recommendation letters and how to brief recommenders.", displayOrder: 20, criteriaFocus: null, isActive: true },
  { id: "mod10-les1", moduleId: 10, moduleName: "NIW: Substantial Merit and National Importance", lessonTitle: "Framing your proposed endeavor", learningObjective: "How to define and articulate your proposed endeavor for the Dhillon test.", displayOrder: 21, criteriaFocus: "NIW-01", isActive: true },
  { id: "mod10-les2", moduleId: 10, moduleName: "NIW: Well-Positioned Prong", lessonTitle: "Proving you are well-positioned", learningObjective: "Evidence that demonstrates your unique ability to advance your proposed endeavor.", displayOrder: 22, criteriaFocus: "NIW-03", isActive: true },
  { id: "mod11-les1", moduleId: 11, moduleName: "Case Readiness and Filing", lessonTitle: "Assessing your 3-criteria minimum", learningObjective: "How to objectively evaluate whether your case meets the filing threshold.", displayOrder: 23, criteriaFocus: null, isActive: true },
  { id: "mod11-les2", moduleId: 11, moduleName: "Case Readiness and Filing", lessonTitle: "Working with an immigration attorney", learningObjective: "How to select and brief an attorney and what Pinnacle³ prepares you to bring them.", displayOrder: 24, criteriaFocus: null, isActive: true },
];
