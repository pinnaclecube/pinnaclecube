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
