// Serverless handler entry for Vercel. The Express app (no .listen()) is itself
// a (req, res) handler. esbuild bundles this — WITHOUT type-checking — exactly
// like the Replit build, so the codebase's pre-existing type errors don't block
// deploys. api/index.js (the Vercel function) re-exports the bundled output.
import app from "./app";

export default app;
