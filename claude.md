# Pinnacle³ — Claude Code Reference

Premium EB-1A / EB-2 NIW / O-1A immigration advisory coaching platform for high-achieving tech professionals. **Not a law firm** — advisory coaching only.

---

## Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/          # Express 5 API — preview path /api
│   └── pinnacle/            # React + Vite SPA — preview path /
├── lib/
│   ├── db/                  # Drizzle ORM schema + db client (@workspace/db)
│   ├── api-spec/            # OpenAPI spec
│   ├── api-client-react/    # Orval-generated React Query hooks
│   ├── api-zod/             # Orval-generated Zod schemas
│   ├── shared/              # Shared utilities
│   └── integrations*/       # AI integration libs
├── scripts/                 # One-off utility scripts
├── pnpm-workspace.yaml      # Workspace + catalog
└── tsconfig.base.json       # Shared strict TS config
```

Package manager: **pnpm**. Never `npm install`. Never `pnpm dev` at root — use workflows.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node 24 |
| Language | TypeScript 5.9 (strict) |
| Backend | Express 5 |
| Frontend | React + Vite |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod (`zod/v4`) + `drizzle-zod` |
| API codegen | Orval (from OpenAPI spec) |
| ORM build | esbuild (CJS bundle) |
| Router (FE) | wouter |
| Server state | TanStack React Query |
| Email | Resend (Replit integration) |
| Payments | Stripe |
| Storage | Google Drive API |
| AI | Anthropic Claude (via `ANTHROPIC_API_KEY`) |
| Logging | pino + pino-http (`req.log` in routes, `logger` singleton elsewhere) |
| Font | Plus Jakarta Sans |

---

## Environment Variables (Secrets)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing key |
| `STAFF_SECRET` | Primary admin staff token |
| `STAFF_SECRET_CHRIS` | Chris Coleman staff token |
| `ANTHROPIC_API_KEY` | Claude API |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Drive service account (full JSON) |
| `ROOT_FOLDER_ID` | Root Google Drive folder for all cases |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret |
| `CURRENT_DISCLAIMER_VERSION` | Disclaimer version string (default `"1.0"`) |
| `PORT` | Assigned by workflow — never hardcode |

---

## Database Schema

All tables defined in `lib/db/src/schema/`. Exported from `lib/db/src/index.ts` as `@workspace/db`.

### `profiles` — client accounts
```
id, name, first_name, last_name, email (unique), phone
password_hash, must_change_password
disclaimer_accepted, disclaimer_accepted_at, disclaimer_version
visa_target (eb1a/niw/o1), profession, years_experience, current_status
case_status (active/inactive), bio, country, city, date_of_birth, gender, nationality, marital_status
linkedin_url
password_reset_token, password_reset_expires_at
newsletter_opt_in, newsletter_unsubscribe_token
access_level (free/excellence_lab/evidence_engine/elite_blueprint)
created_at, updated_at
```

### `evidence` — Evidence Engine items
```
id, criterion_id (legacy int), primary_criteria_id (text, e.g. "EB1A-01")
profile_id, title, description, evidence_type, status (draft/review/approved)
source_url, date_achieved, file_name
extraction_status (pending/completed/failed), extracted_text, extraction_json, ai_summary, ai_summary_ignored
additional_criteria_ids (jsonb array of text IDs)
created_at, updated_at
```

### `case_petition_setup` — the "case" for each client
```
id, profile_id, visa_path (eb1a/niw/o1)
selected_criteria (jsonb), exhibit_numbering_style
status (setup/active/complete), created_by_staff
drive_sync_status (pending/synced/failed), drive_sync_error
product (evidence_engine|elite_blueprint|both)
case_activation_email_sent_at, case_activation_email_status
created_at, updated_at
```
`case_petition_setup.id` is the `case_id` / `case_setup_id` used everywhere. There is no separate `cases` table.

### `criteria_assessments` — AI evaluation per criterion
```
id, case_setup_id, profile_id, criteria_code, criteria_name, visa_category
recommendation (STRONG/MODERATE/INSUFFICIENT)
confidence_score (0-100), summary, rfe_risk (LOW/MEDIUM/HIGH)
strengths, weaknesses, missing_evidence, adjudicator_concerns (jsonb arrays)
proceed_recommendation (bool), documents_analyzed (int)
assessment_json (full Claude output), assessed_at
staff_override, staff_override_by, staff_override_at, staff_override_note
final_decision, created_at
```

### `case_folders` — Google Drive folder registry
```
id, case_id (→ case_petition_setup.id), name
folder_type: root|resume|evidence|demographics|exhibits|criteria|custom
parent_folder_id (self-ref, for custom subfolders)
drive_id (Google Drive folder ID), drive_url
visa_category (EB1A/NIW/O1A)
criteria_index (int, for criteria folders)
staff_only (bool)
created_at, updated_at
```

### `case_folder_items` — files inside Drive folders
```
id, case_folder_id, drive_id (unique), name, mime_type, drive_url
added_by_source (app|drive|staff)
added_by_profile_id, added_by_label
created_at
```

### `drive_watch_channels` — Google Drive push notification channels
```
id, case_id, channel_id (unique), resource_id, drive_folder_id
channel_token, expires_at, created_at
```

### `channel_renewal_failures` — failed channel renewals for auditing
```
id, case_id, old_channel_id, drive_folder_id, error_message, failed_at
```

### `petition_criteria_exhibits` — AI-generated legal exhibits
```
id, case_setup_id, profile_id, criteria_id, criteria_code, criteria_name
exhibit_number, evidence_item_ids (jsonb), status (not_started/in_progress/completed/approved)
generation_job_id, published_to_client, staff_approved_by, staff_approved_at
regeneration_count, drive_file_id, drive_url, drive_uploaded_at
document_type (criteria_exhibit), created_at
```

### `petition_reco_letters` — recommendation letter drafts
```
id, case_setup_id, profile_id
recommender_name, recommender_title, recommender_org, recommender_relationship, recommender_credentials
criteria_supported (jsonb), status, generation_job_id
published_to_client, staff_approved_by, staff_approved_at, created_at
```

### `petition_package` — full petition package tracking
```
id, case_setup_id (unique), profile_id
exhibit_index_job_id, exhibit_index_status
cover_letter_job_id, cover_letter_status, cover_letter_drive_file_id, cover_letter_drive_url
o1_itinerary_job_id, o1_itinerary_status
personal_declaration_job_id, personal_declaration_status, ...drive fields
field_brief_job_id, field_brief_status, ...drive fields
reco_templates_job_id, reco_templates_status
petition_readiness (0-100), package_published_at, package_published_by
created_at
```

### `document_generation_jobs` — async AI doc generation tracking
```
id, profile_id, triggered_by_staff_id, case_setup_id, criteria_code, doc_subtype
status (pending/running/completed/failed)
input_payload, staff_context_input (jsonb), published_to_client, published_at
error_message, created_at, completed_at
```

### `exhibit_documents` — generated PDFs
```
id, case_setup_id, profile_id, job_id, document_type, exhibit_label, criteria_code
file_name, drive_file_id, drive_url
published_to_client, published_at, published_by, generated_at
```

### `visa_criteria` — seeded reference table
```
id (text PK, e.g. "EB1A-01"), visa_path, criteria_code, criteria_name
legal_standard, folder_name, display_order, is_common, upload_guidance
```
26 rows — seeded at server startup via `seedReferenceData`.

### `client_user_products` — product access grants
```
id, profile_id, client_email, product
stripe_session_id, amount_paid, status (active), access_until
offline_payment, granted_by_staff_id, grant_notes, created_at
```

### `purchases` — raw payment records
```
id, user_email, product, amount, currency, status, stripe_session_id, created_at
```

### `pending_access_grants` — pre-register product grants
```
id, email, product, access_level, stripe_session_id (unique), created_at
```

### `blueprints` — Elite Blueprint strategy
```
id, user_id, visa_target, strategy_summary, target_filing_date
assigned_consultant, status, created_at, updated_at
```

### `milestones` — blueprint milestones
```
id, blueprint_id, title, description, due_date, completed, completed_at, sort_order, created_at
```

### `courses` — Excellence Lab courses
```
id, title, description, visa_type, estimated_minutes, category, created_at
```

### `lessons` — lessons within a course
```
id, course_id, title, content, sort_order, estimated_minutes, created_at
```

### `lesson_definitions` — AI lesson seed data (separate from lessons)
```
id, course_id, lesson_key, title, sort_order, prompt_context, created_at
```

### `course_progress` — per-user lesson completion
```
id, profile_id, course_id, lesson_id, completed, completed_at, created_at
```

### `personalized_learning_plans` — AI study plan per profile
```
id, profile_id (unique), plan_type, status, generation_version
plan_payload (jsonb), completed_lesson_ids (jsonb), context_hash
last_invalidated_at, generated_at, updated_at
```

### `readiness_intake` — 6-step readiness wizard data
```
id, profile_id (unique), full_name, email, current_role, company, country
education, field_of_work, years_experience, summary, describe_work, key_achievements
publications, awards, media, judging_reviewing, leadership_roles, memberships
salary_indicators, documentation_available, evidence_organization, evidence_storage
visa_path, timeline, current_goal, resume_upload_id
readiness_completed, readiness_completed_at, status (draft/submitted), created_at, updated_at
```

### `resume_uploads` — resume file records
```
id, profile_id, file_name, upload_date, extraction_status, extracted_text, created_at
```

### `prospects` — sales CRM
```
id, full_name, email, phone, current_role, linkedin_url, source_type
internal_notes, owner_staff_user, years_of_experience, field_of_work, summary
publications_signal, awards_signal, leadership_signal (booleans)
status (new/contacted/qualified/converted/lost)
registration_status (not_invited/invited/registered)
linked_profile_id (→ profiles.id when converted)
resume_text, resume_file_name
roadmap_content, roadmap_visa_category, roadmap_generated_at
roadmap_uploaded_at, roadmap_uploaded_file_name, roadmap_uploaded_data
invoice_sent_at, invoice_product, invoice_checkout_url, invoice_stripe_session_id
payment_received_at, newsletter_opt_in, newsletter_unsubscribe_token
created_at
```

### `applications` — Elite Blueprint applications (public form)
```
id, profile_id, full_name, email, current_role, country, visa_path, field
years_experience, top_achievements, publications, awards
evidence_organization, documentation_available, linkedin_url
resume_file, resume_upload_id, extracted_data (jsonb)
why_applying, timeline, status (submitted/under_review/accepted/rejected)
payment_status, payment_notes, payment_received_at, payment_received_by
include_excellence_lab, admin_confidence_score
admin_strengthening_roadmap, admin_estimated_timeline
admin_ai_analysis, admin_review_notes, admin_reviewed_at, admin_reviewed_by
created_at
```

### `client_action_items` — staff-assigned client tasks
```
id, profile_id, generated_by_admin_id, title, description
priority (low/medium/high), status (draft/sent/completed)
admin_notes, sent_at, client_completed_at, admin_completed_at, created_at
```

### `notifications` — in-app notifications
```
id, profile_id, user_type (client/staff), staff_id, case_setup_id
notification_type, title, message, link
status (unread/read), priority, email_sent, created_at
```

### `activity` — client activity log (legacy)
```
id, profile_id, type, description, metadata (jsonb), created_at
```

### `client_activity_log` — richer activity log
```
id, profile_id, event_type, event_data (jsonb), actor, actor_name
category, case_setup_id, created_at
```

### `internal_case_notes` — staff notes on cases
```
id, profile_id, staff_user_id, note_type, content (jsonb), created_at
```

### `internal_evidence_notes` — staff notes on evidence items
```
id, evidence_item_id, staff_user_id, note, created_at
```

### `quiz_leads` — quiz form submissions
```
id, first_name, last_name, email, phone, quiz_answers (jsonb), result_type, status, created_at
```

### `instant_profile_insight_submissions` — public AI insight tool
```
id, email, role, field, years_experience
publications_count, awards_count, leadership_indicator, resume_text
generated_summary, current_position, suggested_next_steps, recommended_product
quiz_answers (jsonb), created_at
```

### `newsletters` / `newsletter_unsubscribes`
```
newsletters: id, subject, body, sent_at, recipient_count, status
newsletter_unsubscribes: id, email, token, created_at
```

### `booth_events` — conference lead capture
```
id, name, slug (unique), created_by, active, created_at
```

---

## Authentication

### Client (JWT)
- Token stored in `localStorage['pinnacle_token']`
- Header: `Authorization: Bearer <JWT>`
- Signed with `SESSION_SECRET` env var
- **Middleware:** `requireClientAuth` (`artifacts/api-server/src/middlewares/clientAuth.ts`)
  - Verifies JWT → fetches profile → checks `disclaimerVersion === CURRENT_DISCLAIMER_VERSION`
  - Returns `403 { requiresReconsent: true }` on version mismatch
  - Attaches `req.clientUser` (full profile row)
- **Forced password change:** If `profile.mustChangePassword === true`, client is redirected to `/set-password` from `AuthContext.tsx` on every navigation
- **Light-auth endpoint:** `POST /api/auth/set-password` accepts the raw token from the welcome email to set a new password without full auth

### Staff (Static Token)
- Token stored in `sessionStorage` on the frontend
- Header: `X-Staff-Token: <token>`
- Tokens registered in `buildTokenRegistry()` from env vars:
  - `STAFF_SECRET` → `{ id: "primary", name: "Admin" }`
  - `STAFF_SECRET_CHRIS` → `{ id: "chris", name: "Chris Coleman" }`
- **Middleware:** `requireStaffAuth` (`artifacts/api-server/src/middlewares/staffAuth.ts`)
  - Attaches `req.staffUser = { id, role: "admin", name }`
- To add a new staff member: add `STAFF_SECRET_<NAME>` env var and register in `buildTokenRegistry()`

### Dual-auth
Some endpoints accept both — check for staff token first, fall back to client JWT.

### Frontend Route Guards
```
ProtectedRoute          — requires client login (any access level)
ActiveClientRoute       — requires at least one paid product
ProductProtectedRoute   — requires specific product (excellence_lab/evidence_vault/elite_blueprint)
StaffProtectedRoute     — reads token from sessionStorage['staff_token']
PaywallRoute            — upsell gate
```

### Frontend Auth helpers
```typescript
// All protected client fetch calls must use the generated hooks from @workspace/api-client-react
// or manually include the auth header:
const token = localStorage.getItem('pinnacle_token');
fetch('/api/...', { headers: { Authorization: `Bearer ${token}` } });

// All staff fetch calls must use the staffFetch helper (artifacts/pinnacle/src):
staffFetch('/api/admin/...', opts);  // injects X-Staff-Token from sessionStorage
```

---

## API Routes

All routes served under `/api`. Server base path is `/api`.

### Public
```
GET  /healthz                         Health check
POST /auth/register                   Client signup (requires disclaimer_accepted, disclaimer_version)
POST /auth/login                      Returns { token, user, requiresReconsent, requiresPasswordChange }
GET  /auth/me                         Returns current user (requires Bearer token)
POST /auth/accept-disclaimer          Update disclaimer acceptance
POST /auth/forgot-password            Send password reset email
POST /auth/reset-password             Consume reset token and set new password
POST /auth/set-password               Light-auth: set password with welcome token (mustChangePassword flow)
POST /auth/payment-provision-and-login  Post-Stripe account provision + auto-login
POST /contact                         Contact form submission
POST /booth/capture                   Conference booth lead capture
POST /intake/instant-profile          Public Instant Profile Insight submission
GET  /email/unsubscribe/:token        Newsletter unsubscribe
```

### Client (JWT Required)
```
GET    /auth/me                       Profile
PATCH  /profile                       Update profile fields
GET    /dashboard                     Dashboard summary data
GET    /criteria                      List criteria for user's visa type
GET    /evidence                      List evidence items
POST   /evidence/upload               Upload evidence file (multer, triggers AI extraction)
GET    /evidence/:id                  Single evidence item
PATCH  /evidence/:id                  Update evidence item
DELETE /evidence/:id                  Delete evidence item
GET    /evidence/gap-analysis         AI evidence gap analysis
GET    /blueprint                     Elite Blueprint data
GET    /blueprint/milestones          Milestones list
POST   /blueprint/milestones          Create milestone
PATCH  /blueprint/milestones/:id      Update milestone
DELETE /blueprint/milestones/:id      Delete milestone
GET    /courses                       List Excellence Lab courses
GET    /courses/:id                   Course details + lessons
PATCH  /courses/:id/progress          Track lesson progress
GET    /lessons/:id                   Single lesson
GET    /notifications                 List notifications (polls for unread)
PATCH  /notifications/:id/read        Mark read
GET    /action-items                  Client action items list
PATCH  /action-items/:id/complete     Mark action item complete
POST   /intake                        Save readiness intake data (auto-upsert)
GET    /intake                        Get current intake data
POST   /intake/resume                 Upload resume (multer → Google Drive)
GET    /intake/analysis               AI readiness analysis (cached)
GET    /petition/my-documents         Published exhibits + reco letters
GET    /cases/:id/exhibits            Case exhibit documents (client view)
GET    /cases/:id/folders             Case folder structure
GET    /cases/:id/folders/:fid/items  Files in a specific folder
GET    /stripe/checkout               Initiate Stripe checkout session
```

### Staff (X-Staff-Token Required)
```
GET    /admin/profiles                    List all client profiles
GET    /admin/profiles/:id                Full case detail
POST   /admin/profiles/:id/action-items   Create action item for client
PATCH  /admin/profiles/:id/action-items/:aid  Update action item
DELETE /admin/profiles/:id/action-items/:aid  Delete action item
GET    /admin/notifications               Staff notification list
GET    /admin/readiness                   Readiness intake dashboard
GET    /admin/roadmap/:prospectId         AI roadmap for prospect
POST   /admin/roadmap/:prospectId         Generate AI roadmap
GET    /admin/prospects                   Prospects list
POST   /admin/prospects                   Create prospect
GET    /admin/prospects/:id               Prospect detail
PATCH  /admin/prospects/:id               Update prospect
DELETE /admin/prospects/:id               Delete prospect
POST   /admin/prospects/:id/invite        Send registration invite email
POST   /admin/invoice/send               Send Stripe invoice checkout link to prospect
GET    /admin/blueprint/applications      Elite Blueprint applications list
GET    /admin/blueprint/applications/:id  Application detail
PATCH  /admin/blueprint/applications/:id  Update application (review, score)
POST   /admin/blueprint/applications/:id/accept  Accept application
POST   /admin/seed/fix-orphaned-access    Fix profiles with access but no product rows
POST   /admin/notifications/broadcast     Broadcast notification to all clients
GET    /admin/booth-events                Booth events list
POST   /admin/booth-events                Create booth event
PATCH  /admin/booth-events/:id            Update booth event

GET    /internal/petition/setup/:profileId          Get case petition setup
POST   /internal/petition/setup                     Create case + Drive folders ("Convert to Case")
PATCH  /internal/petition/setup/:id                 Update case setup
POST   /internal/petition/setup/:id/activate-email  Send case activation email
GET    /internal/petition/criteria/:caseSetupId     Get criteria exhibits
POST   /internal/petition/criteria/:id/generate     Generate AI criteria exhibit
PATCH  /internal/petition/criteria/:id/approve      Staff approve exhibit
POST   /internal/petition/criteria/:id/upload-to-drive  Upload approved exhibit PDF
POST   /internal/petition/reco-letters/:caseId      Generate reco letter draft
PATCH  /internal/petition/reco-letters/:id/approve  Approve reco letter
GET    /internal/petition/package/:caseId            Petition package status
POST   /internal/petition/package/:caseId/generate-all  Generate full petition package
GET    /internal/petition/jobs/:caseId               Generation jobs for a case
POST   /cases/:id/assess/:criteriaCode               Run AI assessment for one criterion
POST   /cases/:id/assess/all                         Run AI assessment for all criteria
GET    /cases/:id/assessments                        Get assessment results
PATCH  /cases/:id/assessments/:assessmentId/override  Staff override assessment
GET    /internal/drive/channel-renewal-failures      List channel renewal failures

POST   /drive/webhook                    Google Drive push notification handler
POST   /drive/backfill-subfolders        One-shot: sync all case_folders for custom subfolders
GET    /drive/events                     SSE stream for real-time Drive sync events
```

### Stripe Webhooks
```
POST /stripe/checkout   Initiate checkout session
POST /stripe/webhook    Stripe event handler (must receive raw body)
```
The webhook handler:
- Grants product access on `checkout.session.completed`
- If the Stripe session matches a staff invoice (`success_url = /payment-success`), auto-creates a portal account, links `prospects.linkedProfileId`, emails credentials, skips generic confirmation email

---

## Google Drive Integration

### Folder Structure per Case
```
[Client Name] — Case N  (root)
├── Resume/
├── Evidence/
├── Demographics/
├── Exhibits/
└── [Visa Criteria Folders]/     (one per selected criterion)
    └── [Custom Subfolders]/     (created directly by client in Drive)
```

### Key Services
- **`driveService.ts`** — `getDriveClient()`, `listDriveFolderFiles()`, `listDriveSubfolders()`, `registerDriveWatch()`
- **`driveWatchService.ts`** — `syncFolderContents()`, channel renewal cron (runs every 24h, looks ahead 48h)
- **`driveUploadService.ts`** — Upload generated PDFs to Drive
- **`createCaseFolders.ts`** — Creates the full Drive folder tree when a case is initialized
- **`driveDocumentFetcher.ts`** — `fetchCaseDocuments()` — fetches + extracts text from all Drive files for AI assessment

### `syncFolderContents(driveFolderId)`
1. Lists files in the folder → upserts into `case_folder_items`
2. Lists subfolders → if a subfolder is not in `case_folders`, inserts it as `folderType='custom'`, registers a watch channel, and recurses into it (NEW subfolders only)
3. Already-tracked subfolders are **NOT** recursed into — each has its own watch channel

### `fetchCaseDocuments(caseSetupId)`
- Loads all folders for the case, builds a `customAncestorMap` (walks `parentFolderId` chain for custom folders)
- Processes criteria folders first (priority for 150k char cap)
- Custom subfolder docs are attributed to their nearest criteria/resume/demographics ancestor
- Returns `{ allDocuments, grouped: { resume, demographics, byCriteria }, totalCharCount, excludedFiles }`
- Supported MIME types: `image/*`, `application/pdf`, Google Docs, DOCX, `text/plain`, `text/csv`

### Drive Webhook Flow
`POST /drive/webhook` → verifies `channel_token` → calls `syncFolderContents(driveFolderId)` → emits SSE event

---

## Criteria Assessment (AI)

**Service:** `artifacts/api-server/src/services/criteriaAssessmentService.ts`

### `normalizeCriteriaName(name)`
Strips apostrophe variants (straight, curly, backtick, prime), collapses whitespace, lowercases. Used for fuzzy matching between `case_folders.name` and `visa_criteria.criteria_name`.

### `findCriteriaDocuments(byCriteria, criteriaName)`
Tries exact match first, then normalized fuzzy match. Logs a warning on fuzzy match. Returns `[]` (not an error) on no match.

### Assessment Flow (`POST /cases/:id/assess/:criteriaCode`)
1. `fetchCaseDocuments(caseSetupId)` — get all Drive docs
2. `findCriteriaDocuments()` — get docs for this criterion
3. Build Claude prompt with USCIS legal standard + all documents
4. Call Claude → parse `recommendation`, `confidence_score`, `rfe_risk`, `strengths`, `weaknesses`, etc.
5. Upsert into `criteria_assessments`

### `criteriaAssessments` fields
- `documents_analyzed` — count of docs sent to Claude (0 = only resume was available or nothing found)
- `recommendation` — `STRONG` / `MODERATE` / `INSUFFICIENT`
- `rfe_risk` — `LOW` / `MEDIUM` / `HIGH`

---

## Stripe Integration

### Products
| Product | `product` key |
|---|---|
| Excellence Lab | `excellence_lab` |
| Evidence Engine / Vault | `evidence_engine` or `evidence_vault` |
| Elite Blueprint | `elite_blueprint` |

### Checkout Flow
`POST /stripe/checkout` → creates Stripe Checkout Session → returns `{ url }`

### Webhook (`POST /stripe/webhook`)
Raw body required — Express parses it before JSON middleware via:
```javascript
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
```
On `checkout.session.completed`:
1. Upsert `client_user_products` and `purchases`
2. Update `profile.accessLevel`
3. If session came from a staff invoice link:
   - Auto-create portal account (temp password + `mustChangePassword=true`)
   - Link `prospects.linkedProfileId`
   - Email credentials
   - Skip generic confirmation email
4. Otherwise: send purchase confirmation email

---

## Legal / Disclaimer System

### Constants (`artifacts/pinnacle/src/lib/disclaimers.ts`)
```typescript
LEGAL_DISCLAIMER  // shown in LegalFooterBar on every page
AI_VARIANTS = {
  analysis,   // readiness analysis output
  lesson,     // Excellence Lab lessons
  document,   // generated petition docs
  summary,    // evidence summaries
  strength    // criteria strength scores
}
```

### Components
| Component | Purpose |
|---|---|
| `LegalFooterBar` | **Non-dismissable** bar at bottom of every page |
| `AIOutputBanner` | Banner above AI-generated content blocks |
| `AIBadge` | Small inline badge on AI content |
| `LessonDisclaimer` | Before-lesson legal notice |
| `DocumentDisclaimer` | On petition doc pages |
| `ReconsentModal` | Shown when disclaimer version changes — blocks all interaction |

### `DisclaimerContext`
- Wraps the entire app
- `requiresReconsent` state triggers `ReconsentModal`
- QueryCache `onError` in `App.tsx` checks for `{ status: 403, data: { requiresReconsent: true } }` and sets the flag
- Server checks `profile.disclaimerVersion === CURRENT_DISCLAIMER_VERSION` in `requireClientAuth`

### Adding a New Disclaimer Version
1. Update `CURRENT_DISCLAIMER_VERSION` env var on the server
2. All clients will be forced to re-accept on next API call

---

## Frontend Architecture

**SPA:** React + Vite, served at `/`. Router: `wouter`.

### Context Providers (wrap order in `App.tsx`)
```
DisclaimerProvider
  QueryClientProvider
    TooltipProvider
      WouterRouter (base = BASE_URL)
        AuthProvider
          Router (Switch/Route)
        ReconsentModal
```

### `AuthContext` (`artifacts/pinnacle/src/contexts/AuthContext.tsx`)
```typescript
useAuth() // returns { user, token, isLoading, login, logout, register, updateUser, refreshUser }
// Token stored at localStorage['pinnacle_token']
// login() returns { requiresReconsent, requiresPasswordChange, accessLevel }
// mustChangePassword forces redirect to /set-password on every navigation
```

### `useProductAccess()` hook
Checks `client_user_products` via API to determine which products the user has purchased.

### Client Routes
```
/                     Home (public)
/how-it-works         Product explanation (public)
/products             Products page (public)
/excellence-lab       Marketing (public)
/evidence-vault       Marketing (public)
/elite-blueprint      Marketing + apply (public)
/quiz                 Visa readiness quiz (public)
/resources            Articles (public)
/resources/:id        Article detail (public)
/instant-profile-insight/start    Public AI tool
/instant-profile-insight/results  Public AI tool results
/booth                Conference lead capture (public)
/login                Client login
/register             Client registration
/set-password         Forced password change (mustChangePassword flow)
/forgot-password      Password reset request
/reset-password       Password reset with token
/payment-success      Post-invoice payment landing
/disclaimer           Legal disclaimer page
/terms                Terms of Service
/privacy-policy       Privacy Policy

/choose-plan          Plan selection (auth required, free user)
/dashboard            Main dashboard (auth + ActiveClientRoute)
/dashboard/readiness-intake  6-step wizard (auth + ActiveClientRoute)
/where-you-stand      Readiness analysis results (auth + ActiveClientRoute)
/criteria             Criteria overview (auth + ActiveClientRoute)
/criteria/:id         Criterion detail (auth + ActiveClientRoute)
/evidence             Evidence Vault (auth + ProductProtectedRoute[evidence_vault])
/evidence/:id         Evidence detail (auth + ProductProtectedRoute[evidence_vault])
/blueprint            Elite Blueprint (auth + ProductProtectedRoute[elite_blueprint])
/courses              Excellence Lab (auth + ProductProtectedRoute[excellence_lab])
/courses/:id          Course detail (auth + ProductProtectedRoute[excellence_lab])
/profile              Profile settings (auth required)
/my-files             Drive file browser (auth required)
/tasks                Client tasks (auth + ActiveClientRoute)

/excellence-lab/checkout    Stripe checkout
/excellence-lab/success     Post-purchase success
/excellence-lab/cancel      Checkout cancelled
/evidence-vault/checkout
/evidence-vault/success
/evidence-vault/cancel
```

### Staff Routes (all require `StaffProtectedRoute`)
```
/internal/cases                          Cases list
/internal/case/:user_id                  Case detail (PetitionAssessmentTab, ExhibitsTab, TasksTab, etc.)
/internal/case/:user_id/activity-log     Activity log
/internal/case/:user_id/evidence/:eid    Evidence detail
/internal/prospects                      CRM prospects list (hides converted by default; toggle in header)
/internal/prospect/:id                   Prospect detail (shows "View Case" deep-link if linkedProfileId set)
/internal/elite-blueprint-applications   Blueprint applications list
/internal/elite-blueprint-applications/:id  Application detail
/internal/booth-events                   Booth events management
/internal/readiness                      Readiness intake dashboard
```

---

## Key Coding Patterns

### Never `console.log` in server code
```typescript
// In route handlers:
req.log.info({ key: 'value' }, 'message');
req.log.warn(...);

// In services (outside request scope):
import { logger } from '../lib/logger';
logger.info({ key: 'value' }, 'message');
```

### Drizzle queries
```typescript
import { db, profilesTable, evidenceTable } from '@workspace/db';
import { eq, and, lt } from 'drizzle-orm';

const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
```

### Zod validation
```typescript
import { z } from 'zod/v4';  // always zod/v4, not zod
import { createInsertSchema } from 'drizzle-zod';
```

### API codegen
After changing the OpenAPI spec (`lib/api-spec/`):
```bash
pnpm --filter @workspace/api-spec run codegen
```
This regenerates React Query hooks in `lib/api-client-react/` and Zod schemas in `lib/api-zod/`.

### Typecheck
```bash
pnpm run typecheck          # full workspace check
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/pinnacle run typecheck
pnpm run typecheck:libs     # composite lib packages only
```
**Pre-existing type errors** in `seed-demo.ts`, `activityLogger.ts`, `auth.ts`, `legalPdfTemplate.ts` — do not fix unrelated errors in passing.

### Migrations (dev)
```bash
pnpm --filter @workspace/db run push    # push schema changes to dev DB
```
**Production:** Schema changes deploy automatically via the Replit Publish flow. Never write custom migration scripts.

### Adding a new staff member
1. Add `STAFF_SECRET_<NAME>` to env vars
2. Register in `buildTokenRegistry()` in `staffAuth.ts`

### SSE (Server-Sent Events)
`sseService.ts` manages active connections. Routes use `sseService.emit(profileId, event)` to push real-time updates. Client subscribes via `GET /drive/events?caseId=N`.

---

## Visa Criteria Reference

### EB-1A (10 criteria, need ≥3)
| Code | Name | Folder |
|---|---|---|
| 01 | Awards and prizes | EB1A-01_Awards_and_Prizes |
| 02 | Membership | EB1A-02_Membership |
| 03 | Press and media | EB1A-03_Press_and_Media |
| 04 | Judging others | EB1A-04_Judging_Others |
| 05 | Original contributions | EB1A-05_Original_Contributions |
| 06 | Scholarly articles | EB1A-06_Scholarly_Articles |
| 07 | Critical role | EB1A-07_Critical_Role |
| 08 | High salary | EB1A-08_High_Salary |
| 09 | Commercial success | EB1A-09_Commercial_Success |
| 10 | Artistic exhibitions | EB1A-10_Exhibitions |

### EB-2 NIW (3 Dhanasar prongs)
| Code | Name |
|---|---|
| 01 | Substantial merit and national importance |
| 02 | Well positioned to advance |
| 03 | Balance of factors |

### O-1A (8 criteria)
Similar structure to EB-1A. Codes O1A-01 through O1A-08.

---

## Important Implementation Details

### `full_name` vs `name`
The `profiles` table has both a `name` column (required, legacy) and `first_name` / `last_name`. The `AuthContext.ClientUser` interface surfaces all three.

### `case_id` is always `case_petition_setup.id`
There is no separate `cases` table in production. All foreign keys referencing a "case" point to `case_petition_setup.id`. `case_folders.case_id = case_petition_setup.id`.

### Prospects list — hide converted by default
`InternalProspects.tsx` defaults to filtering out converted prospects. Toggle in the page header to show them. Converted prospects with `linkedProfileId` show a "View Case" deep-link to `/internal/case/:linkedProfileId`.

### Criteria name fuzzy matching in assessments
The folder name in `case_folders` must fuzzy-match the criterion name. `normalizeCriteriaName()` strips apostrophe variants and collapses whitespace before comparing. If the match is fuzzy (not exact), a warning is logged.

### Drive subfolder ancestor resolution
Custom Drive subfolders (`folderType='custom'`) are attributed to their nearest criteria/resume/demographics ancestor by walking the `parentFolderId` chain. This is done in `buildCustomAncestorMap()` in `driveDocumentFetcher.ts`. Orphaned custom folders (no recognized ancestor) are excluded from AI assessment.

### `syncFolderContents` recursion rule
- Recurse into **newly discovered** subfolders only (to pick up existing files)
- **Do NOT** recurse into already-tracked subfolders — they have their own watch channels and are covered separately
- Violating this causes O(depth) × fan-out on every webhook and backfill

### Stripe raw body
The `/api/stripe/webhook` route must receive the raw request body for signature verification. This is handled in `app.ts` before the JSON middleware:
```typescript
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
```

### `mustChangePassword` flow
1. Staff creates account → `mustChangePassword = true`
2. Client receives welcome email with a one-time token
3. Client hits `POST /auth/set-password` with the token (light auth — no full JWT required)
4. Server sets new password + `mustChangePassword = false`
5. `AuthContext` redirects to `/set-password` on every navigation until resolved

### Disclaimer version enforcement
- Server: `requireClientAuth` middleware compares `profile.disclaimerVersion` with `CURRENT_DISCLAIMER_VERSION` env var
- Client: `DisclaimerContext` + `ReconsentModal` blocks all UI when `requiresReconsent === true`
- QueryCache `onError` in `App.tsx` detects `403 { requiresReconsent: true }` and triggers the modal globally

### AI output disclaimers
Every AI-generated content block must display a variant-specific disclaimer using `AIOutputBanner` with the appropriate `AI_VARIANTS` key: `analysis`, `lesson`, `document`, `summary`, or `strength`.

### Non-negotiable legal footer
`LegalFooterBar` must appear on every page. It is non-dismissable and non-negotiable.

---

## Brand / Design System

- **Primary:** `#1E2D6B` (indigo)
- **Accent:** `#3D4FA8` (accent indigo)
- **Superscript:** `#5B6BAE`
- **Text primary:** `#1A1A2E` (near-black with blue undertone)
- **Background:** `#FFFFFF` (light theme)
- **Font:** Plus Jakarta Sans (Google Fonts)
- **UI components:** Shadcn/ui in `artifacts/pinnacle/src/components/ui/`

---

## Production

- **URL:** `https://pinnaclecube.com`
- **Deploy:** Replit Publish flow (click Deploy in UI)
- **Logs:** Use `fetch_deployment_logs` to inspect production logs
- **DB:** Read-only queries via `executeSql({ environment: "production" })`
- **Schema migrations:** Applied automatically by Replit Publish — never write custom migration scripts

### One-shot admin endpoints (production)
```bash
# Backfill custom Drive subfolders into case_folders
curl -X POST https://pinnaclecube.com/api/drive/backfill-subfolders \
  -H "X-Staff-Token: $STAFF_SECRET" -m 150
# Will time out (server runs ~5-10 min for 274+ folders) but continues server-side
# Check deployment logs for [driveBackfill] backfill complete
```
