import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  // Identity
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  // Auth
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Disclaimer consent
  disclaimerAccepted: boolean("disclaimer_accepted").notNull().default(false),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }),
  disclaimerVersion: text("disclaimer_version"),
  // Profile
  visaTarget: text("visa_target").notNull().default("eb1a"),
  profession: text("profession").notNull(),
  yearsExperience: integer("years_experience").notNull().default(0),
  currentStatus: text("current_status").notNull(),
  caseStatus: text("case_status").default("active"),
  bio: text("bio"),
  country: text("country"),
  city: text("city"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  nationality: text("nationality"),
  maritalStatus: text("marital_status"),
  linkedinUrl: text("linkedin_url"),
  // Password reset
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
  // Newsletter
  newsletterOptIn: boolean("newsletter_opt_in").default(true),
  newsletterUnsubscribeToken: text("newsletter_unsubscribe_token"),
  // Access
  accessLevel: text("access_level").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProfileSchema = insertProfileSchema.partial().pick({
  firstName: true,
  lastName: true,
  name: true,
  phone: true,
  country: true,
  city: true,
  gender: true,
  nationality: true,
  maritalStatus: true,
  linkedinUrl: true,
  bio: true,
  visaTarget: true,
  profession: true,
  yearsExperience: true,
  currentStatus: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
export type SafeProfile = Omit<Profile, "passwordHash">;
