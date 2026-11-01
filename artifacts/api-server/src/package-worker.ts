/**
 * package-worker.ts — Evidence Package module worker (spec phase 11).
 *
 * The package pipeline's heavy stages (extract/generate/assemble) shell out to
 * native binaries — LibreOffice, poppler (pdftoppm), tesseract, python3 — that
 * do NOT exist in Vercel's serverless Node runtime. So the queue drain runs here,
 * in a long-lived container that has the toolchain installed (see
 * Dockerfile.package-worker), instead of on a Vercel cron. The settle-notify
 * (client notification) is toolchain-free and also runs on a light Vercel cron as
 * a backstop.
 *
 * Run: tsx artifacts/api-server/src/package-worker.ts
 * Requires the same env as the API (DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_JSON,
 * ANTHROPIC_API_KEY, …) plus PACKAGE_EXTRACT_SCRIPT=<abs path>/scripts/extract.py.
 */

import { drainPackageQueue } from "./services/package/orchestrator";
import { notifySettledPackages } from "./services/package/approval";
import { logger } from "./lib/logger";

const INTERVAL_MS = Number(process.env.PACKAGE_WORKER_INTERVAL_MS ?? 30_000);
let stopping = false;

async function tick() {
  try {
    const { processed } = await drainPackageQueue({ budgetMs: 150_000 });
    const notified = await notifySettledPackages();
    if (processed || notified) logger.info({ processed, notified }, "[package-worker] tick");
  } catch (err) {
    logger.error({ err }, "[package-worker] tick failed");
  }
}

async function main() {
  logger.info({ intervalMs: INTERVAL_MS }, "[package-worker] starting");
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  logger.info("[package-worker] stopped");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { logger.info({ sig }, "[package-worker] shutting down"); stopping = true; });
}

void main();
