# Pinnacle³ — EB-1A Immigration Consulting Platform

## Overview

Premium immigration advisory coaching platform for high-achieving tech professionals targeting EB-1A, EB-2 NIW, and O-1A visas. Not a law firm — advisory coaching only.

**Domain:** pinnaclecube.com | **Tagline:** Clarity for Extraordinary Talent

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/pinnacle) — at previewPath `/`
- **API framework**: Express 5 (artifacts/api-server) — at previewPath `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Font**: Plus Jakarta Sans (Google Fonts)

## Brand Colors

- Brand indigo 700 `#1E2D6B` — primary, logo, buttons
- Brand indigo 500 `#3D4FA8` — accent, active states
- Brand indigo 400 `#5B6BAE` — superscript ³
- Text primary `#1A1A2E` — near-black with blue undertone
- Background: pure white `#FFFFFF`, light theme only

## Products

- **Excellence Lab** — Learning courses (Stripe checkout, self-serve, $297 one-time)
- **Evidence Vault** — Document/evidence tracking (Stripe checkout, self-serve, $497 one-time)
- **Elite Blueprint** — Personalized strategy (application-only, offline payment)

## Product Access Gating

Product pages are locked behind purchase. `ProductProtectedRoute` (`artifacts/pinnacle/src/components/auth/ProductProtectedRoute.tsx`) wraps product routes and redirects unpurchased users to checkout:
- `/courses`, `/courses/:id` → `/excellence-lab/checkout` (requires `excellence_lab` accessLevel)
- `/evidence`, `/evidence/:id` → `/evidence-vault/checkout` (requires `evidence_vault` accessLevel)
- `/blueprint` → `/elite-blueprint` (requires `elite_blueprint` accessLevel)

Free pages (no purchase needed): `/dashboard`, `/where-you-stand`, `/criteria`, `/criteria/:id`

## Google Drive Auto-Ingest (Drive → Evidence Vault Pipeline)

Files dropped into a client's Google Drive criterion folders are automatically detected, downloaded, text-extracted, and inserted as evidence records.

**Architecture:**
- `artifacts/api-server/src/services/driveIngestService.ts` — Core poller + `ingestFolder()` / `ingestClientFolders()` functions
- `artifacts/api-server/src/services/evidenceProcessing.ts` — Shared `extractText()` + `generateAISummary()` (used by upload route and poller)
- `artifacts/api-server/src/services/googleDrive.ts` — Added `listFolderFiles()` and `downloadDriveFile()` (handles Google Docs export)
- **Poller cadence:** every 5 min (configurable via `DRIVE_INGEST_INTERVAL_MS` env var); starts immediately on server boot
- **Dedup key:** `evidence.driveFileId` — never re-ingests an already-seen file
- **Source flag:** `evidence.source = 'drive_ingest'` vs `'web_upload'` (default) — shown as blue "Drive" badge in admin Evidence tab and client vault
- **Extraction status:** `completed` | `failed` | `skipped` (binary/image files not extractable get `skipped`)
- **Admin sync:** `POST /api/admin/profiles/:id/sync-drive` — triggers immediate scan for one client; shown as "Sync Drive Now" button in InternalCaseDetail Evidence tab
- **DB columns added:** `evidence.source` (text, default `web_upload`; drive-ingested items use `drive_ingest`), `client_drive_folders.last_drive_sync_at` (timestamp)

## Stripe Integration

- **Route:** `POST /api/stripe/checkout` creates Stripe Checkout sessions for `excellence_lab` ($297) and `evidence_vault` ($497)
- **Webhook:** `POST /api/stripe/webhook` handles `checkout.session.completed` to grant `accessLevel` on `profiles` and insert into `client_user_products`
- **Raw body:** `app.ts` applies `express.raw()` for `/api/stripe/webhook` BEFORE `express.json()` to preserve signature verification

## AI Readiness Analysis (Where You Stand)

`GET /api/intake/analysis` — Claude analyzes intake data and returns:
- `sufficientData` flag (false if intake is too sparse, with message for UI)
- `overallReadiness`: "strong" | "moderate" | "developing"
- `strongAreas`: array of criteria where the client is well-positioned
- `recommendedAreas`: prioritized gaps with specific action recommendations
- `roadmap`: 4-phase plan from evidence audit to filing
- 30-minute in-process cache (invalidated on intake save)

## Readiness Intake

6-step wizard (now includes Step 6: Resume Upload). Resume is uploaded to the client's `Resume/` folder in Google Drive via `POST /api/intake/resume`. Stored in `resume_uploads` table, linked to intake via `resumeUploadId`.

## Internal Staff Portal (Prompt 13)

All internal staff pages are complete at `/internal/` path prefix. Staff access is gated by `X-Staff-Token` header and the `StaffProtectedRoute` component.

### Staff Nav
`artifacts/pinnacle/src/components/layout/StaffNav.tsx` — shared indigo header with links to Cases, Prospects, Blueprint Apps.

### Internal Pages
- **InternalCases** `/internal/cases` — case list with search + filter
- **InternalCaseDetail** `/internal/case/:user_id` — 5-tab master view:
  - Overview: profile card, intake, resume, action items (CRUD + status), activity log link, reset password, delete case
  - Evidence: grouped by criteria, AI summary display, reclassify, internal notes, force regenerate
  - Excellence Lab: course progress bars, learning plan status, invalidate & regenerate
  - Petition Workspace: create setup → criteria exhibit board (generate/approve/regen per exhibit) → recommendation letters (add/generate/approve/publish) → final package (gated checklist, publish full package)
  - Documents: list all docs, generate modal, publish/unpublish
- **InternalCaseActivityLog** `/internal/case/:user_id/activity-log` — timeline view with color-coded event types
- **InternalEvidenceDetail** `/internal/case/:user_id/evidence/:evidence_id` — detailed evidence review with AI summary, reclassify, staff notes, force regenerate
- **InternalProspects** `/internal/prospects` — list with add modal, signal badges (publications/awards/leadership), status badges
- **InternalProspectDetail** `/internal/prospect/:id` — inline edit form, invite button, linked case link
- **InternalEliteBlueprintApplications** `/internal/elite-blueprint-applications` — list with search, confidence scores, payment status
- **InternalEliteBlueprintApplicationDetail** `/internal/elite-blueprint-applications/:id` — review status/score/timeline, payment mark received/waived, grant access with optional Excellence Lab

### Backend Routes
- `adminCases.ts` → `/api/admin/*` (17+ endpoints for profile CRUD, evidence notes/reclassify/regen, action items, course progress, lesson invalidation, documents publish/unpublish, activity log, password reset, delete)
- `adminProspects.ts` → `/api/admin/prospects` (CRUD + invite)
- `adminBlueprint.ts` → `/api/internal/blueprint-applications/*` (status/payment/grant-access workflow)
- `petitionAdmin.ts` → `/api/internal/petition/*` (full petition gen workflow)

### Key Pattern
All staff fetch calls use `staffFetch(path, opts)` helper that wraps `/api${path}` with `X-Staff-Token` header (from `getStaffToken()`).

## Authentication System (Prompt 12)

JWT-based auth stored in `localStorage['pinnacle_token']`.

- `POST /api/auth/register` — Create account, requires dual disclaimer checkboxes, returns JWT
- `POST /api/auth/login` — Login, returns JWT; 403 if disclaimerVersion mismatch
- `GET /api/auth/me` — Get current user from JWT
- `POST /api/auth/accept-disclaimer` — Accept new disclaimer version
- `POST /api/auth/update-profile` — Update profile fields
- `POST /api/auth/reset-password` — Change password (requires JWT)

Frontend: `AuthContext.tsx` stores JWT, calls `setAuthTokenGetter` to wire custom-fetch.
`requireClientAuth` middleware attaches `req.clientUser` (full profile object).

Staff auth: `X-Staff-Token` header, sessionStorage key `pinnacle_staff_token`.

## Key Pages

### Public (no auth required)
- `/` — Landing page (marketing)
- `/how-it-works` — Process explanation
- `/products` — Three products detail
- `/excellence-lab` — Excellence Lab marketing + pricing
- `/evidence-vault` — Evidence Vault marketing + pricing
- `/elite-blueprint` — Elite Blueprint marketing
- `/elite-blueprint/apply` — Application form
- `/elite-blueprint/submitted` — Post-application confirmation
- `/quiz` — 6-question visa readiness quiz
- `/instant-profile-insight/start` — AI profile insight form
- `/instant-profile-insight/results` — AI profile insight results
- `/login` — JWT login
- `/register` — Account creation with dual disclaimer checkboxes
- `/excellence-lab/checkout|success|cancel` — Stripe checkout flow
- `/evidence-vault/checkout|success|cancel` — Stripe checkout flow

### Protected (requires JWT)
- `/dashboard` — Overview with readiness score, evidence, milestones
- `/dashboard/readiness-intake` — Multi-step onboarding form (5 steps)
- `/where-you-stand` — Readiness score and criterion breakdown
- `/evidence` — Evidence Vault list
- `/evidence/:id` — Evidence item detail
- `/criteria` — Criteria Exhibit
- `/criteria/:id` — Criterion detail
- `/blueprint` — Elite Blueprint strategy and milestones
- `/courses` — Excellence Lab course list
- `/courses/:id` — Course detail with lesson progress
- `/profile` — User profile

### Internal Staff (requires X-Staff-Token)
- `/internal/cases` — All client profiles list
- `/internal/case/:id` — Client case detail + stats
- `/internal/case/:id/activity-log` — Client activity feed
- `/internal/case/:id/evidence/:eid` — Evidence review
- `/internal/prospects` — Lead/prospect CRM
- `/internal/prospect/:id` — Prospect detail
- `/internal/elite-blueprint-applications` — Blueprint application review
- `/internal/elite-blueprint-applications/:id` — Application detail + status update

## Components

### Auth Components
- `contexts/AuthContext.tsx` — JWT auth state, login/logout/register
- `hooks/useProductAccess.ts` — Access level gating (excellence_lab/evidence_vault/elite_blueprint)
- `components/auth/ProtectedRoute.tsx` — JWT auth guard
- `components/auth/StaffProtectedRoute.tsx` — Staff token gate
- `components/auth/ClientProfileDialog.tsx` — Profile edit + password change dialog

### Notification Components
- `components/notifications/NotificationBell.tsx` — Bell icon with unread count badge; polls every 60s
- `components/notifications/NotificationPanel.tsx` — Slide-over panel; mark read, dismiss, link out

### Navigation
- `components/layout/Navbar.tsx` — Auth-aware: public (Sign In + Get Started + product links) vs. authenticated (Where You Stand + bell + user menu with profile dialog + logout)
- `components/ui/logo.tsx` — Accepts `href` prop (default `/`)

## DB Schema (lib/db/src/schema/)

- `profiles` — User profile (visa target, profession, access level, password hash)
- `criteria` — USCIS criteria (eb1a / niw / o1)
- `evidence` — Evidence items per criterion
- `blueprints` — Elite Blueprint strategy
- `milestones` — Blueprint milestones
- `courses` — Excellence Lab courses
- `lessons` — Course lessons
- `course_progress` — Per-lesson progress tracking
- `activity` — Activity feed
- `notifications` — Client notifications (unread/read, userType, priority)
- `readiness_intake` — Multi-step intake form (linked to profile, triggers Drive setup)
- `client_action_items` — Staff-assigned tasks
- `client_drive_folders` — Google Drive folder mappings
- `visa_criteria` — Detailed EB-1A/NIW/O-1A criteria (separate from criteria table)
- `blueprints_applications` — Elite Blueprint applications (public apply form)

## API Routes

### Auth
- `POST /api/auth/register|login|me|accept-disclaimer|update-profile|reset-password`

### Client (requires JWT Bearer)
- `GET/PATCH /api/profile` — Profile management
- `GET /api/profile/readiness` — Readiness score
- `GET /api/dashboard/summary` — Dashboard stats
- `GET /api/dashboard/activity` — Recent activity
- `GET /api/courses`, `GET /api/courses/:id`, `PATCH /api/courses/:id/progress`
- `GET /api/blueprint`, `GET/POST /api/blueprint/milestones`, `PATCH /api/blueprint/milestones/:id`
- `GET /api/evidence`, `POST /api/evidence`, `GET/PATCH /api/evidence/:id`, etc.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`, `DELETE /api/notifications/:id`
- `GET/POST /api/intake`, `POST /api/intake/complete`
- `GET /api/lessons/:path` (lessons require Excellence Lab access)

### Public
- `GET /api/criteria` — Reference visa criteria
- `POST /api/blueprint/apply` — Elite Blueprint application (no auth)

### Staff (requires X-Staff-Token)
- `/api/admin/*` — Client management, blueprint application review

## Legal / Disclaimer System (Prompt 11)

Components in `artifacts/pinnacle/src/components/disclaimers/`:
- `LegalFooterBar.tsx` — always-visible footer in both layouts; collapsible on mobile
- `AIOutputBanner.tsx` — purple left-border banner, variants: analysis|lesson|document|summary|strength
- `LessonDisclaimer.tsx` — amber banner at top of every Excellence Lab lesson
- `DocumentDisclaimer.tsx` — stacked red+purple banners; cover_letter gets strongest warning
- `AIBadge.tsx` — inline AI badge with tooltip
- `ReconsentModal.tsx` — full-screen overlay when disclaimer version changes; two required checkboxes

Shared constants in `artifacts/pinnacle/src/lib/disclaimers.ts` (LEGAL_DISCLAIMER + AI_VARIANTS map).

Context in `artifacts/pinnacle/src/contexts/DisclaimerContext.tsx`:
- Global QueryCache error handler catches 403 `{ requiresReconsent: true }` → triggers ReconsentModal
- `POST /api/auth/accept-disclaimer` clears the gate

Backend: `requireClientAuth` middleware (clientAuth.ts) enforces disclaimer version on all protected routes.

Every page includes the non-negotiable, non-dismissable legal footer bar. All AI output blocks show variant-specific disclaimers.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/pinnacle run dev` — run frontend locally
