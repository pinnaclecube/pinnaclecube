# Evidence Package Generation Module — Specification

**Status:** Draft v1 · **Scope:** EB-1A only · **Mode:** Extends the existing exhibit system (no parallel system)

This document is the source of truth for the Evidence Package Generation module. Where an
implementation prompt and this spec disagree, this spec wins. Section and stage numbers here are
the ones referenced by the phased build plan (e.g. "section 5", "section 4 stage 3", "section 2
layer 4").

---

## 1. Purpose and scope

Staff point the module at a client's case. It scans the case's Google Drive evidence tree, reuses
the already-confirmed evidence **groups**, turns each group into a Word (`.docx`) **sub-exhibit**
with the underlying documents embedded as **screenshots/figures**, writes the per-criterion and
final-merits narrative, assembles an exhibit index and a single merged PDF, and leaves everything
in a **staff-review** state. Staff approve per document; only approved documents become visible to
the client.

Hard scope rules:

- **EB-1A only.** Every new route, the new staff tab, and all client reflection are gated on
  `casePetitionSetup.visaPath === 'EB1A'` (`visaCategory === 'EB1A'`).
- **Extend, don't fork.** Build on `exhibit_documents`, `petition_package`, `publishedToClient`,
  the client `/petition/my-exhibits` surface, and the staff Exhibits tab. Do **not** create a
  second exhibit table or a second client surface. Do **not** modify the old PDF exhibit generator
  (`exhibitGeneratorService.ts`, `legalPdfTemplate.ts`, `petitionDocumentGenerator.ts`) except to
  hide its "Generate Exhibits" button on EB-1A cases (build phase 9).
- **Reuse utilities.** Drive (`driveService`), grouping (`evidence_groups`), Anthropic (`getAI()` +
  `claude-sonnet-4-5`), notifications/SSE (`staffNotificationService` + `sseService`), email
  (`emailService`/`resend`), the durable job pattern (`letterGenerationWorker`), and the case's
  existing `Exhibits` Drive folder. No parallel implementations.
- **Dev only for schema.** Schema changes go through `drizzle-kit push` against the dev database.
  No migration files. Never touch production.

Fixed facts:

- Shared Drive template folder `_Templates`, id `12PZ33TFh81wCSk06ni2XFdK0c8Cy2Z0j`.
- Dev case id comes from the `DEV_CASE_ID` environment variable. If unset when a stage needs it,
  stop and ask.
- Model: `claude-sonnet-4-5` via the existing lazy `getAI()` pattern.

---

## 2. Document model and house style

### Layer 1 — Document roles

Every generated artifact is a row in `exhibit_documents` with a `role`:

| role | meaning | one per | generated |
|---|---|---|---|
| `sub_exhibit` | one evidence group rendered with its figures + caption + source list | confirmed evidence group | stage 6 |
| `criterion` | per-criterion narrative tying its sub-exhibits to the regulatory standard | EB-1A criterion with ≥1 confirmed group | stage 6 |
| `index` | the master exhibit index (codes, titles, page spans) | package version | stage 7 |
| `final_merits` | the Kazarian step-two final-merits argument across all criteria | package version | stage 6, **last** |

The old `documentType` values (`cover_letter`, `personal_declaration`, etc.) are untouched and out
of scope. `role` is the new discriminator for this module.

### Layer 2 — Exhibit codes

`exhibitCode` is a stable string the planner assigns; it never changes once assigned for a version.

- Criterion letter: EB-1A criteria map to letters by their folder order — `A` Extraordinary Ability
  Awards, `B` Membership in Associations, `C` Published Material About the Alien, `D` Judge of
  Others' Work, `E` Original Contributions, `F` Scholarly Articles, `G` Artistic Exhibitions,
  `H` Leading or Critical Role, `I` High Salary, `J` Commercial Success.
- `sub_exhibit`: `<letter><n>` in planner order within the criterion, e.g. `E1`, `E2`, `E3`.
- `criterion`: the bare letter, e.g. `E`.
- `index`: `INDEX`. `final_merits`: `FM`.

**Document headers always derive from the exhibit code**, never from sample or model text. The
renderer resolves `exhibitCode → { criterionName, role, title }` and builds the running header /
title block from that lookup. Sequential USCIS "Exhibit N" display numbers are assigned at assembly
(stage 7) in index order; `exhibitCode` is the internal stable key.

### Layer 3 — Section order per role

Section order is declared in the template config (section 8), not hard-coded in the generator. The
seeded EB-1A order is:

- `sub_exhibit`: `title_block` → `source_summary` → `figures` (one per source document, each with a
  caption) → `relevance_note`.
- `criterion`: `title_block` → `regulatory_standard` (with the 8 CFR citation) → `evidence_summary`
  (lists the criterion's sub-exhibits) → `argument` → `conclusion`.
- `final_merits`: `title_block` → `introduction` → `criteria_met` → `totality_argument`
  (Kazarian step two) → `exhibit_index` (embedded) → `conclusion`.
- `index`: `title_block` → `exhibit_table`.

### Layer 4 — House style (authoritative)

All generated `.docx` use exactly this style. These constants live in `packageTemplateConfig`
(section 8), not scattered in the renderer.

- Body font: **Times New Roman, 12pt** (matches `letterDocxService`).
- Headings: Times New Roman — H1 16pt bold, H2 13pt bold, H3 12pt bold. Brand accent color
  `#1E2D6B` for the title block only; body headings are black.
- Margins: **1 inch** all sides.
- Line spacing: 1.15; paragraph spacing 8pt after.
- Title block: document title (from exhibit code), criterion name, applicant name, "DRAFT — FOR
  STAFF REVIEW" watermark line until approved, generated date.
- Figures: each embedded screenshot is centered, max width 6.0in, with a caption below in
  **10pt italic**: `Figure <exhibitCode>.<k>: <source file name> — <one-line description>`.
- Footer: `Exhibit <displayNumber> · <exhibitCode> · page X of Y`.
- Citations in narrative use the exhibit code in brackets, e.g. `[Exhibit E2]`.
- No emoji, no markdown artifacts, no model preamble ("Here is…") in output.

---

## 3. Data sources and reuse

| Input | Source |
|---|---|
| Case + visa path | `case_petition_setup` (`visaPath`, `profileId`) |
| Evidence files | `case_folder_items` (name, mimeType, driveId, driveUrl, criterionFolder, groupId) |
| Folder tree | `case_folders` (folderType, parentFolderId); the case's `Exhibits` top-level folder is the output root |
| Confirmed groups | `evidence_groups` (status `confirmed`, criterionFolder, name, description) + membership via `case_folder_items.groupId` |
| Criterion definitions | `config/driveFolderConfig.ts` (`EB1A_CRITERIA`) and `visa_criteria` (legal standard, code) |

The module **consumes** confirmed groups; it never re-groups. If a case has no confirmed groups for
a requested criterion, see the `confirmGroupsFirst` flow (stage 4).

---

## 4. Pipeline (stages)

The orchestrator (stage 1) runs stages 2–7 as a single durable job (`package_generation_jobs`),
following the `letterGenerationWorker` claim/retry pattern, drained by a new
`/cron/package-generation` cron. Each stage records its status and timing into the job's
`stageStatus` jsonb so the UI can poll it.

### Stage 1 — Intake and orchestration

`POST /internal/cases/:caseId/packages` (staff, EB-1A only) creates a new package **version**
(increment `petition_package.currentVersion`) and enqueues one `package_generation_jobs` row
(`status='queued'`). Body: `{ criteriaCodes?: string[], confirmGroupsFirst: boolean }`. Default
`criteriaCodes` = criteria that have ≥1 confirmed group. The partial unique index allows one active
job per case. The worker claims it, sets `status='processing'`, and runs the stages in order.

**Retry rule:** a stage that throws is retried up to **3 attempts** with the stale-reclaim guard
(a job stuck in `processing` past 10 minutes is reclaimed). After 3 failed attempts the job is set
`status='failed'` with the stage and error recorded. `POST /internal/packages/:jobId/retry`
re-queues a failed job from the **first incomplete stage** (completed stages are not redone; their
outputs persist by package version).

### Stage 2 — Scan

`services/package/scanner.ts`. Walk the case's Evidence subtree (`getEvidenceSubtreeFolders`), list
non-deleted `case_folder_items`. **Skip any folder tagged as package output or template.** The tag
is the Drive folder **description** field: a folder whose description contains the marker
`[pinnacle:package-output]` or `[pinnacle:template]` is skipped. Tag `_Templates` with
`[pinnacle:template]` and every `Exhibits/Package v<N>` output folder with
`[pinnacle:package-output]` at creation. Output: the candidate file set by mime type.

### Stage 3 — Extract

`services/package/extractor.ts` + `scripts/extract.py`. For each candidate file:

- Download via `downloadDriveFile`.
- Office/PDF → text + **page images**: convert office docs to PDF with LibreOffice (`soffice
  --headless --convert-to pdf`), rasterize pages with poppler `pdftoppm` (150 dpi PNG). Text via
  `pdfplumber`; if a page yields < 20 chars of text, OCR it with `pytesseract` and record the OCR
  confidence.
- Images → used directly as figures; OCR for text.
- Page images are written to a **`_cache/package-v<N>/` folder under the case Drive folder** (no
  object-storage backend exists in this repo; the Drive `_cache` folder is the store, tagged
  `[pinnacle:package-output]` so the scanner skips it). Record each page image's Drive id.
- Persist one extract per file: text, per-page image ids, OCR confidence distribution, and any
  extraction error keyed by file name. Never fail the whole stage on one file — log and continue.

### Stage 4 — Classify and group

`services/package/classifier.ts`. Two passes, both `claude-sonnet-4-5` via `getAI()`.

- **Pass 1 — classify.** Batch the short extracts **ten files per call**. The model returns JSON
  matching the `evidence_classifications` shape: `{ fileId, evidenceType, criterion, confidence,
  sortDate, summary }[]`. `evidenceType` is a controlled vocabulary (award certificate, membership
  letter, press article, review assignment, citation report, employment letter, salary record,
  etc.). Validate against the schema; reject and retry a batch whose JSON doesn't parse. Persist to
  the `evidence_classifications` table.
- **Pass 2 — group.** Reuse the Step 5 grouping job (`evidence_grouping_jobs` /
  `evidenceGroupingService`), fed the classifications, writing each group's `missingTypes` (expected
  document types for the criterion that are absent from the group) and `sortDate` (the group's
  representative date, min of member `sortDate`s). Groups are auto-confirmed per the existing Step 5
  behavior; staff curate.

**`awaiting_group_review` pause.** If `confirmGroupsFirst` is true, after pass 2 the job sets
`status='awaiting_group_review'` and stops. Staff confirm/edit/merge/split groups through the
**existing Step 5 review endpoints** (`/cases/:caseId/evidence-groups/*` — confirm, edit, members,
dissolve, reclassify, suggest). Any endpoint the review screen needs that is missing is added under
`/internal`. When staff resume (`POST /internal/packages/:jobId/retry` or a dedicated resume), the
job continues to stage 5. If `confirmGroupsFirst` is false, the job proceeds straight through on the
already-confirmed groups.

### Stage 5 — Plan

`services/package/planner.ts`. **Deterministic, no AI.** From the confirmed groups it produces the
document plan:

- One `sub_exhibit` per confirmed group; one `criterion` document per criterion with ≥1 group; one
  `index`; one `final_merits`.
- Assign `exhibitCode`s (section 2 layer 2), ordered within each criterion by group `sortDate`.
- For each planned document: `role`, `exhibitCode`, `title`, feeding file count, and `satisfiable`
  (a criterion is satisfiable when it has the minimum evidence its template requires; a
  `sub_exhibit` is satisfiable when its group has ≥1 renderable figure).
- `incomplete_group` flag on any group whose `missingTypes` is non-empty.
- **Temporal-spread computation per criterion:** the span between earliest and latest group
  `sortDate` and a flag when all evidence clusters within a single year (weakens "sustained"
  arguments). Recorded per criterion on the plan.

Output: the plan table (persisted as planned `exhibit_documents` rows in `renderStatus='pending'`).

### Stage 6 — Generate and render

`services/package/generator.ts` (content) + `services/package/renderer.ts` (docx).

- Generator builds, per document, a structured JSON following the role's section order (layer 3),
  using only the extracts and classifications as grounding. The **section 7 guardrail table is
  placed verbatim in the system prompt.** `final_merits` is generated **last** (it depends on all
  criterion documents).
- Renderer converts the JSON to `.docx` in house style (layer 4), embedding the stage-3 page images
  as figures with captions, and enforces the two renderer checks (section 7). Headers come from the
  exhibit code.
- Each rendered `.docx` is uploaded to `Exhibits/Package v<N>/` (generalized Drive upload, see
  section 9), a thumbnail of page 1 is generated and uploaded, and the `exhibit_documents` row is
  updated with `wordDriveId/Url`, `thumbnailDriveId/Url`, `contentJson`, `flags`, and
  `renderStatus='rendered'`.

### Stage 7 — Assemble and notify

`services/package/orchestrator.ts` (assembly portion).

- Build the exhibit index (display Exhibit numbers in index order) and write it both **into the
  `final_merits` document** (its `exhibit_index` section) and as a standalone **`Exhibit_Index.docx`**.
- Upload all documents to `Exhibits/Package v<N>/` (tagged `[pinnacle:package-output]`).
- Merge every rendered document (each `.docx` → PDF via LibreOffice) into **one merged PDF** in
  exhibit order; upload it.
- Set the job `status='ready_for_review'` and `petition_package.packageStatus='ready_for_review'`.
- Send the staff notification (`insertStaffNotification`, SSE) and a Resend email with the fields in
  section 6. **No client notification here** — client visibility is gated on approval (section 6).

---

## 5. Schema (dev push, no migration files)

Extend existing tables; add new ones. Follow existing conventions (serial id, `withTimezone`
timestamps, snake_case columns, drizzle-zod insert schemas in the same file).

### 5.1 Extend `exhibit_documents` (`lib/db/src/schema/petition.ts`)

Add columns:

- `package_version integer` — which package version this row belongs to.
- `role text` — `sub_exhibit | criterion | index | final_merits` (new discriminator; old rows null).
- `exhibit_code text` — stable code (section 2 layer 2).
- `evidence_group_id integer` — FK `evidence_groups(id)`, nullable (set for `sub_exhibit`).
- `source_file_ids jsonb` — array of `case_folder_items.id` feeding the document.
- `sort_date timestamptz` — representative date (for ordering / temporal spread).
- `missing_types jsonb` — expected-but-absent evidence types for the group.
- `content_json jsonb` — the structured content produced in stage 6.
- `flags jsonb` — array of `{ kind, message, severity }` from render checks.
- `word_drive_id text`, `word_drive_url text` — the `.docx`.
- `thumbnail_drive_id text`, `thumbnail_drive_url text` — page-1 preview.
- `render_status text default 'pending'` — `pending | rendered | failed`.
- `regeneration_instruction text` — last staff "regenerate with instruction".
- `approved_by text`, `approved_at timestamptz` — per-document approval (sets `published_to_client`
  simultaneously; see section 6). Existing `published_to_client/_at/_by` and `drive_file_id/url`
  (the merged/primary artifact) are reused.

Indexes: `(case_setup_id, package_version)`, `(case_setup_id, exhibit_code)`, `(evidence_group_id)`.

### 5.2 Extend `petition_package`

Add: `current_version integer default 0`, `package_status text default 'none'`
(`none | generating | awaiting_group_review | ready_for_review | partially_approved | approved`),
`ready_for_review_at timestamptz`, `exhibit_index_drive_id text`, `merged_pdf_drive_id text`,
`merged_pdf_drive_url text`, `client_notified_at timestamptz`.

### 5.3 New `package_generation_jobs`

Mirror `letter_generation_jobs`:

- `id serial pk`, `case_setup_id integer not null`, `package_version integer not null`.
- `status text not null default 'queued'` — `queued | processing | awaiting_group_review |
  ready_for_review | failed | done`.
- `stage text` — current stage name.
- `stage_status jsonb default '{}'` — `{ [stageName]: { status, startedAt, finishedAt, metrics } }`.
- `criteria_codes jsonb`, `confirm_groups_first boolean default false`.
- `requested_by text not null`, `attempts integer not null default 0`, `error text`.
- `created_at`, `started_at`, `completed_at` timestamptz.
- Partial unique index `package_jobs_one_active_per_case` on `(case_setup_id)` where
  `status in ('queued','processing','awaiting_group_review')`.

### 5.4 New `evidence_classifications`

- `id serial pk`, `case_setup_id integer not null`, `package_version integer not null`,
  `file_id integer not null` (FK `case_folder_items(id)`), `evidence_type text`, `criterion text`,
  `confidence integer` (0–100), `sort_date timestamptz`, `summary text`, `raw_json jsonb`,
  `created_at timestamptz default now()`.
- Index `(case_setup_id, package_version)`, `(file_id)`.

Report at the end of build phase 1: schema diff, push output, `SELECT count(*)` from each new table.

---

## 6. Approval and client reflection

- **Per-document approval.** Staff approve a document → set `approved_by`, `approved_at`, and
  `published_to_client = true`, `published_at`, `published_by` in one update. Regenerate or Replace
  clears approval.
- **Package status is derived** from its documents: `generating` while the job runs,
  `ready_for_review` when rendered and unapproved, `partially_approved` when some are approved,
  `approved` when every `satisfiable` document is approved.
- **Locking.** Once a package version is fully `approved` it is locked (no regenerate/replace on
  that version). A new run increments `current_version`; prior versions remain for history.
- **Client query returns only the newest approved version per `exhibit_code`.** Extend
  `/petition/my-exhibits`: for the case, select `exhibit_documents` where `published_to_client` and
  group by `exhibit_code` taking max `package_version`. Return exhibit code, title, criterion name,
  version label, and a per-document download; expose download-all only once the package is fully
  approved. Strip internal fields (`content_json`, `flags`, `drive_file_id`, `source_file_ids`,
  staff notes).
- **Client notification.** One client notification per package, sent either **15 minutes after the
  last approval action** (debounced) or immediately on **"Notify client now"**, through the existing
  notification/email utilities. Record `client_notified_at`.
- **Audit log.** Every staff action (generate, confirm groups, approve, regenerate, replace, reject,
  notify) is written to the audit log (`logActivity` / `activity`) with actor, case, exhibit code,
  and action.

---

## 7. Generation guardrails

### 7.1 Guardrail table (placed verbatim in the generator system prompt)

| # | Rule |
|---|---|
| G1 | Use only facts present in the provided extracts and classifications. Never invent names, dates, employers, metrics, or citations. |
| G2 | Every quantitative claim (number, %, rank, count, salary, citation count) must be traceable to a specific source file in the group. If it is not in an extract, do not state it. |
| G3 | Cite the supporting exhibit in brackets by code, e.g. `[Exhibit E2]`. Do not cite exhibits not in this package. |
| G4 | Use the applicant's name exactly as given. Do not introduce titles or honorifics not in the record. |
| G5 | Do not copy staff review notes or internal commentary into output prose. Those are guidance, not content. |
| G6 | Do not assert that a legal criterion is "met" in a `sub_exhibit`; sub-exhibits describe evidence. Legal conclusions belong only in `criterion` and `final_merits` documents. |
| G7 | No preamble, no meta-commentary, no markdown fences. Output only the requested JSON. |
| G8 | When evidence is thin or a required type is missing, say so plainly in the relevance note rather than overstating. |

### 7.2 Renderer-enforced checks (not model-trusted)

- **Unsourced-metric check:** scan rendered body text for numeric/percentage/rank tokens; any that
  are not accompanied by an exhibit citation `[Exhibit …]` within the same sentence raise an
  `unsourced_metric` flag on the document (severity warning).
- **Review-notes-overlap check:** compare generated prose against the staff review notes / internal
  group notes for verbatim overlap above a shingle threshold; any hit raises a
  `review_notes_overlap` flag (severity error; the document is marked for staff attention and not
  auto-approvable).

Flags are written to `exhibit_documents.flags` and surfaced in the review UI.

---

## 8. Template config and importer

### 8.1 `lib/packageTemplateConfig.ts`

A typed, versioned config — the single home for roles, section orders, regulation citations, the
exhibit-code scheme, and the layer-4 house-style constants. Shape:

```
export const PACKAGE_TEMPLATE_VERSION = 1;
export interface SectionDef { key: string; heading: string; regulation?: string; }
export interface RoleTemplate { role: DocRole; sections: SectionDef[]; }
export interface VisaPackageTemplate {
  visaCategory: 'EB1A';
  houseStyle: HouseStyle;        // fonts, sizes, margins, caption format (section 2 layer 4)
  criteria: { code: string; letter: string; name: string; regulation: string }[];
  roles: Record<DocRole, RoleTemplate>;
}
export const PACKAGE_TEMPLATES: Record<'EB1A', VisaPackageTemplate>;
```

Seeded for EB-1A with the roles and section orders of section 2 (layer 3) and the ten criteria with
their 8 CFR 204.5(h)(3) citations. House-style constants exactly as layer 4.

### 8.2 `scripts/importTemplateFromDrive.ts`

Reads each `.docx` in `_Templates` (id `12PZ33TFh81wCSk06ni2XFdK0c8Cy2Z0j`) with `python-docx`,
extracts the **heading hierarchy only**, infers the document **role from the exhibit code in the
file name**, and writes `lib/packageTemplateConfig.draft.json`. **Stores no sample prose** — only
headings, order, and regulation citations. The draft is never auto-merged; staff pick which
differences to take, then `templateVersion` is bumped.

---

## 9. Shared-utility extensions (minimal)

- **Drive upload:** generalize `driveUploadService` to upload any mime type (add
  `uploadFileToDrive(folderId, name, mimeType, buffer)`); keep `uploadPdfToDrive` as a thin wrapper.
  All calls set `supportsAllDrives: true`.
- **Folder tagging:** set the Drive folder `description` on create for output/template folders
  (scanner skip tag).
- **docx-with-figures:** new `renderer.ts` using the `docx` library with `ImageRun`; the existing
  `letterDocxService` stays text-only and untouched.
- Everything else (Anthropic, grouping, SSE/notifications, email, job/cron pattern, audit log) is
  reused without modification.

---

## 10. Routes (all `/internal`, staff auth, EB-1A gated)

- `POST /internal/cases/:caseId/packages` — create version + enqueue job. Body
  `{ criteriaCodes?, confirmGroupsFirst }`.
- `GET /internal/packages/:jobId` — job status, `stageStatus`, and the planned/rendered documents.
- `POST /internal/packages/:jobId/retry` — re-queue a failed job from the first incomplete stage,
  or resume from `awaiting_group_review`.
- Per-document actions reuse/extend existing exhibit routes: approve, regenerate (with instruction),
  replace (docx upload), reject; package-level approve-all-unflagged, reject-package, notify-client,
  download-merged-PDF.
- Group review during the pause reuses the Step 5 `/cases/:caseId/evidence-groups/*` endpoints.

---

## 11. Tooling prerequisites

Required on the host (install only with explicit approval): `python3` with `pdfplumber`,
`python-docx`, `openpyxl`, `Pillow`, `pytesseract`; system `tesseract-ocr`, `poppler-utils`
(`pdftoppm`), `libreoffice` (`soffice`); node `playwright` (Chromium already present at
`/opt/pw-browsers`). LibreOffice and Chromium are present today; the rest are missing and must be
installed before stages 3 and 6 can run.

---

## 11a. Deployment — package worker (phase 11)

The pipeline's extract / generate / assemble stages shell out to **LibreOffice,
poppler (`pdftoppm`), tesseract, and python3**, which are not present in Vercel's
serverless Node runtime. Therefore:

- The **UI, routes, approval, and client reflection run on Vercel** as normal (no
  native deps).
- The **queue drain runs in a dedicated container worker** —
  `Dockerfile.package-worker` (LibreOffice + poppler + tesseract + python deps) →
  `artifacts/api-server/src/package-worker.ts`, a long-lived loop calling
  `drainPackageQueue()` + `notifySettledPackages()`. Deploy it to any container
  host (Render / Railway / Fly / Cloud Run / a VM) with the same env as the API
  plus `PACKAGE_EXTRACT_SCRIPT=/app/scripts/extract.py`.
- `/api/cron/package-generation` is **no longer scheduled on Vercel** (it would
  fail at the extract stage); it remains callable for manual/toolchain-equipped
  use. A light, toolchain-free `/api/cron/package-notify` cron stays on Vercel as
  a backstop for the 15-minute client-notification settle check.

## 12. Build phases (summary)

0 audit · 1 schema · 2 scanner+extractor · 3 classification+grouping · 4 template config+importer ·
5 planner · 6 generator+renderer · 7 orchestrator+assembly+notification · 8 staff UI · 9
approval+client reflection (hide old Generate Exhibits button on EB-1A) · 10 verification run · 11
fixes+merge. Each phase ends with a report and waits for GO. Branch `feature/evidence-package` off
`main`; phase 7 on sub-branch `feature/evidence-package-orchestrator`.
