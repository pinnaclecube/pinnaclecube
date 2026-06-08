import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// On Vercel each serverless instance should hold very few connections and lean
// on Supabase's PgBouncer pooler (the `...pooler.supabase.com:6543` URL) for
// fan-out. Long-lived environments (local dev, a container host) can pool more.
const isServerless = Boolean(process.env.VERCEL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isServerless ? 1 : 10,
  // PgBouncer in transaction mode closes idle connections aggressively; keep our
  // own idle timeout short so we don't reuse a server-closed socket.
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
