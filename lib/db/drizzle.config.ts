import { defineConfig } from "drizzle-kit";
import path from "path";

// drizzle-kit issues DDL and uses prepared statements, which don't work through
// Supabase's PgBouncer transaction pooler (port 6543). Prefer the direct
// connection (port 5432) when available; fall back to DATABASE_URL for local dev.
const migrationUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Set DIRECT_DATABASE_URL (Supabase direct, port 5432) or DATABASE_URL.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
