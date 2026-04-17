import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientActionItemsTable = pgTable("client_action_items", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  generatedByAdminId: text("generated_by_admin_id"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("draft"),
  adminNotes: text("admin_notes"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  clientCompletedAt: timestamp("client_completed_at", { withTimezone: true }),
  adminCompletedAt: timestamp("admin_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  userType: text("user_type").notNull().default("client"),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  status: text("status").notNull().default("unread"),
  priority: text("priority").default("medium"),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientActionItemSchema = createInsertSchema(clientActionItemsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertClientActionItem = z.infer<typeof insertClientActionItemSchema>;
export type ClientActionItem = typeof clientActionItemsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
