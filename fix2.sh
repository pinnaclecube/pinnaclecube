[200~#!/usr/bin/env bash
# Pinnacle3 Vercel fix #2: build the API as an esbuild bundle (no tsc) and
# point the Vercel function at it. Run from the repo root in Replit.
set -e
cd "$(git rev-parse --show-toplevel)"
echo "Applying esbuild-bundle fix..."
rm -f api/index.ts

cat > artifacts/api-server/src/serverless.ts << 'PINNACLE_EOF'
// Serverless handler entry for Vercel. The Express app (no .listen()) is itself
// a (req, res) handler. esbuild bundles this — WITHOUT type-checking — exactly
// like the Replit build, so the codebase's pre-existing type errors don't block
// deploys. api/index.js (the Vercel function) re-exports the bundled output.
import app from "./app";

export default app;
PINNACLE_EOF

cat > artifacts/api-server/build.mjs << 'PINNACLE_EOF'
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [
      path.resolve(artifactDir, "src/index.ts"),
      path.resolve(artifactDir, "src/serverless.ts"),
    ],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "pdfkit",
      "fontkit",
      "pdf-parse",
      "mammoth",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
PINNACLE_EOF

cat > api/index.js << 'PINNACLE_EOF'
// Vercel serverless function for the Pinnacle³ API.
//
// The Express app is pre-bundled by esbuild (no type-checking, matching the
// original Replit build) into artifacts/api-server/dist/serverless.mjs during
// the Vercel build step. This file is plain JS so @vercel/node does not run the
// TypeScript compiler over the server source (which has pre-existing type
// errors). vercel.json rewrites every /api/* request to this function.
import app from "../artifacts/api-server/dist/serverless.mjs";

export default app;
PINNACLE_EOF

cat > vercel.json << 'PINNACLE_EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm install -g pnpm && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/pinnacle run build",
  "outputDirectory": "artifacts/pinnacle/dist/public",
  "functions": {
    "api/index.js": {
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

echo "Done. Review with: git status && git diff --stat"
~
