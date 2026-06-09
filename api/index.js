// Vercel serverless function for the Pinnacle³ API.
//
// The Express app is pre-bundled by esbuild as CommonJS (no type-checking) into
// artifacts/api-server/dist/serverless.cjs during the Vercel build step. This
// file is plain CommonJS so Vercel (which compiles functions as CJS) can
// require() the bundle directly — a static import/require of an ESM .mjs throws
// ERR_REQUIRE_ESM. vercel.json rewrites every /api/* request to this function.
const mod = require("../artifacts/api-server/dist/serverless.cjs");

module.exports = mod.default || mod;
