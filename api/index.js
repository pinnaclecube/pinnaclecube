// Vercel serverless function for the Pinnacle³ API.
//
// The Express app is pre-bundled by esbuild (no type-checking, matching the
// original Replit build) into artifacts/api-server/dist/serverless.mjs during
// the Vercel build step. This file is plain JS so @vercel/node does not run the
// TypeScript compiler over the server source (which has pre-existing type
// errors). vercel.json rewrites every /api/* request to this function.
import app from "../artifacts/api-server/dist/serverless.mjs";

export default app;
