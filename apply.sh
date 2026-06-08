#!/usr/bin/env bash
# Pinnacle3: apply Vercel serverless + Supabase migration (run from repo root in Replit)
set -e
cd "$(git rev-parse --show-toplevel)"
echo "Writing files..."
mkdir -p api artifacts/api-server/src/routes

cat > vercel.json << 'PINNACLE_EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm install -g pnpm && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @workspace/pinnacle run build",
  "outputDirectory": "artifacts/pinnacle/dist/public",
  "functions": {
    "api/index.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "crons": [
    { "path": "/api/cron/drive-channel-renewal", "schedule": "0 */12 * * *" },
    { "path": "/api/cron/pending-grants-cleanup", "schedule": "0 */6 * * *" }
  ]
}
PINNACLE_EOF

cat > api/index.ts << 'PINNACLE_EOF'
/**
 * Vercel serverless entry for the Pinnacle³ API.
 *
 * The Express app is defined (without `.listen()`) in
 * `artifacts/api-server/src/app.ts`. Vercel treats any file under `/api` as a
 * serverless function; an Express app is itself a `(req, res)` handler, so we
 * just re-export it. `vercel.json` rewrites every `/api/*` request to this
 * function, and Express matches the original `/api/...` path internally.
 *
 * Startup work that used to run after `app.listen()` (seeding + the interval
 * cron jobs) is handled out-of-band: see `artifacts/api-server/src/routes/cron.ts`
 * and the `crons` block in `vercel.json`.
 */
import app from "../artifacts/api-server/src/app";

export default app;
PINNACLE_EOF

cat > artifacts/api-server/src/routes/cron.ts << 'PINNACLE_EOF'
/**
 * cron.ts — Pinnacle³
 *
 * Scheduled-job endpoints invoked by Vercel Cron (see `crons` in vercel.json).
 *
 * On Replit these ran as in-process `setInterval` loops started after
 * `app.listen()`. Serverless functions are stateless and short-lived, so the
 * same work is triggered by Vercel Cron issuing a GET request on a schedule.
 *
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron
 * requests when the `CRON_SECRET` env var is set. We reject anything that does
 * not carry the matching bearer so these endpoints can't be triggered publicly.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { purgeExpiredPendingGrants } from "../services/pendingGrantsCleanup";
import { renewExpiringSoonChannels } from "../services/driveWatchService";
import { seedReferenceData } from "../services/seedReferenceData";

const router: IRouter = Router();

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  return req.get("authorization") === `Bearer ${secret}`;
}

/** Wrap a job so cron endpoints share auth, logging, and error handling. */
function cronHandler(name: string, job: () => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!isAuthorizedCron(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const startedAt = Date.now();
    try {
      await job();
      const durationMs = Date.now() - startedAt;
      logger.info({ job: name, durationMs }, "[cron] job completed");
      res.json({ ok: true, job: name, durationMs });
    } catch (err) {
      logger.error({ err, job: name }, "[cron] job failed");
      res.status(500).json({ ok: false, job: name, error: "job failed" });
    }
  };
}

// Renew Google Drive watch channels expiring within the lookahead window.
// Was: startDriveChannelRenewal() every 24h.
router.get(
  "/cron/drive-channel-renewal",
  cronHandler("drive-channel-renewal", renewExpiringSoonChannels),
);

// Purge pending access grants older than 48h.
// Was: startPendingGrantsCleanup() every 6h.
router.get(
  "/cron/pending-grants-cleanup",
  cronHandler("pending-grants-cleanup", purgeExpiredPendingGrants),
);

// Seed reference data (visa_criteria etc.) + fix orphaned access.
// Was: run once after app.listen(). Idempotent — safe to invoke post-deploy
// and on a schedule. Trigger manually after each deploy if you prefer.
router.get("/cron/seed", cronHandler("seed", seedReferenceData));

export default router;
PINNACLE_EOF

cat > artifacts/api-server/src/routes/index.ts << 'PINNACLE_EOF'
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import criteriaRouter from "./criteria";
import evidenceRouter from "./evidence";
import blueprintRouter from "./blueprint";
import applyBlueprintRouter from "./applyBlueprint";
import adminBlueprintRouter from "./adminBlueprint";
import adminCasesRouter from "./adminCases";
import adminProspectsRouter from "./adminProspects";
import petitionAdminRouter from "./petitionAdmin";
import petitionClientRouter from "./petitionClient";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";
import lessonsRouter from "./lessons";
import notificationsRouter from "./notifications";
import intakeRouter from "./intake";
import stripeRouter from "./stripe";
import adminSeedRouter from "./adminSeed";
import emailRouter from "./email";
import contactRouter from "./contact";
import boothRouter from "./booth";
import adminBoothEventsRouter from "./adminBoothEvents";
import adminRoadmapRouter from "./adminRoadmap";
import adminInvoiceRouter from "./adminInvoice";
import driveWebhookRouter from "./driveWebhook";
import caseFoldersRouter from "./caseFolders";
import caseExhibitsRouter from "./caseExhibits";
import actionItemsRouter from "./actionItems";
import adminNotificationsRouter from "./adminNotifications";
import adminReadinessRouter from "./adminReadiness";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(criteriaRouter);
router.use(evidenceRouter);
router.use(blueprintRouter);
router.use(applyBlueprintRouter);
router.use(adminBlueprintRouter);
router.use(adminCasesRouter);
router.use(adminProspectsRouter);
router.use(petitionAdminRouter);
router.use(petitionClientRouter);
router.use(coursesRouter);
router.use(dashboardRouter);
router.use(lessonsRouter);
router.use(notificationsRouter);
router.use(intakeRouter);
router.use(stripeRouter);
router.use(adminSeedRouter);
router.use("/email", emailRouter);
router.use(contactRouter);
router.use(boothRouter);
router.use(adminBoothEventsRouter);
router.use(adminRoadmapRouter);
router.use(adminInvoiceRouter);
router.use(driveWebhookRouter);
router.use(caseFoldersRouter);
router.use(caseExhibitsRouter);
router.use(actionItemsRouter);
router.use(adminNotificationsRouter);
router.use(adminReadinessRouter);
router.use(cronRouter);

export default router;
PINNACLE_EOF

cat > lib/integrations-anthropic-ai/src/client.ts << 'PINNACLE_EOF'
import Anthropic from "@anthropic-ai/sdk";

// On Replit the AI_INTEGRATIONS_* vars are injected automatically and point the
// SDK at Replit's Anthropic proxy. Off Replit (Vercel), set a direct
// ANTHROPIC_API_KEY instead and leave the base URL unset so the SDK talks to
// api.anthropic.com. Either configuration works.
const apiKey =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "Anthropic API key missing. Set ANTHROPIC_API_KEY (direct Anthropic API) " +
      "or AI_INTEGRATIONS_ANTHROPIC_API_KEY (Replit AI integration).",
  );
}

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
PINNACLE_EOF

cat > lib/db/src/index.ts << 'PINNACLE_EOF'
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
PINNACLE_EOF

cat > lib/db/drizzle.config.ts << 'PINNACLE_EOF'
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
PINNACLE_EOF

cat > .env.example << 'PINNACLE_EOF'
# ─── Database (Supabase Postgres) ────────────────────────────────────────────
# Runtime (serverless) MUST use the pooled connection (PgBouncer, port 6543):
#   postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
DATABASE_URL=
# Migrations (drizzle-kit) MUST use the DIRECT connection (port 5432):
#   postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
DIRECT_DATABASE_URL=

# ─── Session / JWT ───────────────────────────────────────────────────────────
SESSION_SECRET=
JWT_SECRET=
JWT_EXPIRY=7d

# ─── Staff tokens ────────────────────────────────────────────────────────────
STAFF_SECRET=
STAFF_SECRET_CHRIS=

# ─── Anthropic (Claude AI) ───────────────────────────────────────────────────
# Off Replit: set a direct key from console.anthropic.com. Leave the Replit
# AI_INTEGRATIONS_* vars unset — the client falls back to ANTHROPIC_API_KEY.
ANTHROPIC_API_KEY=
# AI_INTEGRATIONS_ANTHROPIC_BASE_URL=   # Replit only
# AI_INTEGRATIONS_ANTHROPIC_API_KEY=    # Replit only

# ─── Stripe ─────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_EXCELLENCE_LAB_PRICE_ID=
STRIPE_EVIDENCE_VAULT_PRICE_ID=

# ─── Google Drive (service account JSON as single-line string) ───────────────
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# ─── Email (Gmail OAuth via Nodemailer) ──────────────────────────────────────
GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
# Resend (alternative email transport)
RESEND_API_KEY=

# ─── Cron (Vercel Cron auth) ─────────────────────────────────────────────────
# Vercel sends `Authorization: Bearer <CRON_SECRET>` to scheduled endpoints.
CRON_SECRET=

# ─── App ─────────────────────────────────────────────────────────────────────
NODE_ENV=development
# PORT is only used by the local `pnpm dev` server; Vercel ignores it.
PORT=3000
FRONTEND_URL=http://localhost:5173

# ─── Disclaimer ──────────────────────────────────────────────────────────────
CURRENT_DISCLAIMER_VERSION=1.0
PINNACLE_EOF

sed -i 's/^async function purgeExpiredPendingGrants/export async function purgeExpiredPendingGrants/' artifacts/api-server/src/services/pendingGrantsCleanup.ts
sed -i 's/^async function renewExpiringSoonChannels/export async function renewExpiringSoonChannels/' artifacts/api-server/src/services/driveWatchService.ts

# remove Replit-only files
git rm -q --ignore-unmatch .replit .replitignore replit.md >/dev/null 2>&1 || true

echo "Done. Review with: git status && git diff --stat"

