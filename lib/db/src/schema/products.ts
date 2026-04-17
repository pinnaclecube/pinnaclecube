import { pgTable, text, serial, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientUserProductsTable = pgTable("client_user_products", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  clientEmail: text("client_email").notNull(),
  product: text("product").notNull(),
  stripeSessionId: text("stripe_session_id"),
  amountPaid: numeric("amount_paid").default("0"),
  status: text("status").notNull().default("active"),
  accessUntil: timestamp("access_until", { withTimezone: true }),
  offlinePayment: boolean("offline_payment").default(false),
  grantedByStaffId: text("granted_by_staff_id"),
  grantNotes: text("grant_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  product: text("product").notNull(),
  amount: numeric("amount"),
  currency: text("currency").default("usd"),
  status: text("status").default("pending"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientUserProductSchema = createInsertSchema(clientUserProductsTable).omit({ id: true, createdAt: true });
export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertClientUserProduct = z.infer<typeof insertClientUserProductSchema>;
export type ClientUserProduct = typeof clientUserProductsTable.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
