import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const staffSessionsTable = pgTable("staff_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  staffRole: text("staff_role").notNull().default("admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  lastRotatedAt: timestamp("last_rotated_at").notNull().defaultNow(),
});
