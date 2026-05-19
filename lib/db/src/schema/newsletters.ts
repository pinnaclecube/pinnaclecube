import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newslettersTable = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  topic: text("topic").notNull(),
  visaCategory: text("visa_category").notNull(),
  ideaIndex: integer("idea_index"),
  ideaTitle: text("idea_title"),
  ideaSummary: text("idea_summary"),
  contentHtml: text("content_html"),
  contentText: text("content_text"),
  heroImageUrl: text("hero_image_url"),
  heroImageCredit: text("hero_image_credit"),
  heroImageCreditUrl: text("hero_image_credit_url"),
  status: text("status").default("draft"),
  generatedIdeasJson: jsonb("generated_ideas_json").default([]),
  externalReferences: jsonb("external_references").default([]),
  wordCount: integer("word_count"),
  createdByStaffId: text("created_by_staff_id"),
  approvedByStaffId: text("approved_by_staff_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientCount: integer("recipient_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  resendBroadcastId: text("resend_broadcast_id"),
  webViewPath: text("web_view_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const newsletterUnsubscribesTable = pgTable("newsletter_unsubscribes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  token: text("token").notNull().unique(),
  source: text("source"),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }).defaultNow(),
});

export const insertNewsletterSchema = createInsertSchema(newslettersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNewsletterUnsubscribeSchema = createInsertSchema(newsletterUnsubscribesTable).omit({ id: true, unsubscribedAt: true });

export type Newsletter = typeof newslettersTable.$inferSelect;
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type NewsletterUnsubscribe = typeof newsletterUnsubscribesTable.$inferSelect;
export type InsertNewsletterUnsubscribe = z.infer<typeof insertNewsletterUnsubscribeSchema>;
