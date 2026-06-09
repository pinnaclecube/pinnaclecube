[200~#!/usr/bin/env bash
# Pinnacle3 Vercel fix #3: build the API as a CommonJS bundle and require() it.
set -e
cd "$(git rev-parse --show-toplevel)"
echo "Applying CJS-bundle fix..."

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

  const common = {
    platform: "node",
    bundle: true,
    outdir: distDir,
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
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
  };

  // ── Local dev server (src/index.ts → dist/index.mjs, ESM) ──────────────────
  await esbuild({
    ...common,
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    format: "esm",
    outExtension: { ".js": ".mjs" },
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

  // ── Vercel serverless function (src/serverless.ts → dist/serverless.cjs) ────
  // Built as CommonJS so api/index.js can `require()` it directly. A static
  // `import`/`require` of an ESM `.mjs` throws ERR_REQUIRE_ESM on Vercel, which
  // compiles the function as CJS. CJS needs no ESM banner — require/__dirname
  // are already available.
  await esbuild({
    ...common,
    entryPoints: [path.resolve(artifactDir, "src/serverless.ts")],
    format: "cjs",
    outExtension: { ".js": ".cjs" },
    // Some bundled deps call `createRequire(import.meta.url)`. In CJS,
    // `import.meta.url` is unavailable, so shim it to the file URL of this module.
    banner: {
      js: `const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;`,
    },
    define: { "import.meta.url": "__importMetaUrl" },
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
// The Express app is pre-bundled by esbuild as CommonJS (no type-checking) into
// artifacts/api-server/dist/serverless.cjs during the Vercel build step. This
// file is plain CommonJS so Vercel (which compiles functions as CJS) can
// require() the bundle directly — a static import/require of an ESM .mjs throws
// ERR_REQUIRE_ESM. vercel.json rewrites every /api/* request to this function.
const mod = require("../artifacts/api-server/dist/serverless.cjs");

module.exports = mod.default || mod;
PINNACLE_EOF

echo "Done. Review: git status && git diff --stat"
~
