# Pinnacle³ — Deployment Guide

Premium EB-1A / EB-2 NIW / O-1A immigration advisory platform.
Architecture: React + Vite frontend (Vercel) + Express API (Railway) + PostgreSQL.

---

## Environment Variables

### API Server (Railway)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway provides this automatically) |
| `SESSION_SECRET` | Random secret for session signing (min 32 chars) |
| `STAFF_SECRET` | Secret token for the internal staff portal |
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON key for your GCP service account (single-line string) |
| `ROOT_FOLDER_ID` | Google Drive folder ID to create client folders inside |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

### Frontend (Vercel)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Full URL of your Railway backend (e.g. `https://pinnacle-api.railway.app`) |

---

## Step 1 — Anthropic API

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create a new key
3. Set `ANTHROPIC_API_KEY` in Railway

> AI features (lesson generation, evidence analysis, petition drafts) all use Claude claude-sonnet-4-5. Without this key, AI features degrade gracefully — evidence upload still works, lessons won't generate.

---

## Step 2 — PostgreSQL (Railway)

1. Create a Railway project → **Add a PostgreSQL plugin**
2. Railway automatically sets `DATABASE_URL`
3. After first deploy, run the schema push from your local machine:

```bash
DATABASE_URL="<your-railway-postgres-url>" pnpm --filter @workspace/db run push
```

> This uses Drizzle's push (not migrations) — it syncs the schema to the live DB safely.

After seeding reference data (visa criteria, courses):

```bash
DATABASE_URL="<your-railway-postgres-url>" pnpm --filter @workspace/db run seed-reference
```

---

## Step 3 — Google Drive + Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Drive API**
3. **IAM & Admin** → **Service Accounts** → Create a service account
4. Create a JSON key → Download it
5. Minify to single line (remove newlines): `jq -c . < key.json`
6. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to that single-line string in Railway
7. In **Google Drive**: create a folder for client files, share it with the service account email (Editor)
8. Copy the folder ID from the Drive URL → set `ROOT_FOLDER_ID`

---

## Step 4 — Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys
2. Copy the **Secret key** → set `STRIPE_SECRET_KEY`
3. **Webhooks** → Add endpoint:
   - URL: `https://your-api.railway.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`
4. Copy the **Signing secret** → set `STRIPE_WEBHOOK_SECRET`
5. Set `STRIPE_PUBLISHABLE_KEY` in Vercel env (prefixed `VITE_STRIPE_PK` if used client-side)

---

## Step 5 — Railway Deployment (API Server)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy (uses Dockerfile at repo root)
railway up
```

Or connect your GitHub repo in the Railway dashboard for auto-deploy on push.

Set all environment variables in Railway → **Variables** before first deploy.

---

## Step 6 — Vercel Deployment (Frontend)

1. Push repo to GitHub
2. Import into [Vercel](https://vercel.com/new)
3. Vercel auto-detects the `vercel.json` config
4. In Vercel **Settings → Environment Variables**, set `VITE_API_URL` to your Railway URL
5. **Important**: update the rewrite rule in `vercel.json`:
   ```json
   { "source": "/api/(.*)", "destination": "https://YOUR-RAILWAY-URL.railway.app/api/$1" }
   ```
6. Deploy

---

## Post-Deployment Verification

- [ ] Register a new account → confirm drive folders are created
- [ ] Upload evidence → confirm file lands in correct Drive folder
- [ ] Complete readiness intake → confirm AI summary generates
- [ ] Purchase Excellence Lab (Stripe test mode) → confirm access granted
- [ ] Load a lesson → confirm AI generates content (first load ~10s)
- [ ] Submit an Elite Blueprint application → confirm AI analysis runs
- [ ] Log in to staff portal (`/internal/cases`) with your `STAFF_SECRET`
- [ ] Test petition workspace: create setup → generate exhibit → approve
- [ ] Confirm all screens show legal disclaimer footer
- [ ] Confirm all AI output blocks display the AI disclaimer banner

---

## Local Development

```bash
# Install deps
pnpm install

# Start all services
pnpm --filter @workspace/api-server run dev   # API on :8080
pnpm --filter @workspace/pinnacle run dev      # Frontend (PORT and BASE_PATH auto-set)

# Sync database schema
pnpm --filter @workspace/db run push
```

Required local env vars (`.env` or shell exports):
```
DATABASE_URL=
SESSION_SECRET=
STAFF_SECRET=
ANTHROPIC_API_KEY=        # OR use Replit's AI integration
GOOGLE_SERVICE_ACCOUNT_JSON=
ROOT_FOLDER_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=
```
