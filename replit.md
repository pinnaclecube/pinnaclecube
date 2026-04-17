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

- **Excellence Lab** — Learning courses (Stripe checkout, self-serve)
- **Evidence Vault** — Document/evidence tracking (Stripe checkout, self-serve)
- **Elite Blueprint** — Personalized strategy (application-only, offline payment)

## Key Pages

### Public
- `/` — Landing page (marketing)
- `/how-it-works` — Process explanation
- `/products` — Three products detail

### App
- `/dashboard` — Overview with readiness score, evidence, milestones
- `/where-you-stand` — Readiness score and criterion breakdown
- `/evidence` — Evidence Vault list
- `/evidence/:id` — Evidence item detail
- `/criteria` — Criteria Exhibit
- `/criteria/:id` — Criterion detail
- `/blueprint` — Elite Blueprint strategy and milestones
- `/courses` — Excellence Lab course list
- `/courses/:id` — Course detail with lesson progress
- `/profile` — User profile

## DB Schema (lib/db/src/schema/)

- `profiles` — User profile (visa target, profession, access level)
- `criteria` — USCIS criteria (eb1a / niw / o1)
- `evidence` — Evidence items per criterion
- `blueprints` — Elite Blueprint strategy
- `milestones` — Blueprint milestones
- `courses` — Excellence Lab courses
- `lessons` — Course lessons
- `course_progress` — Per-lesson progress tracking
- `activity` — Activity feed

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/pinnacle run dev` — run frontend locally

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

## Important Notes

- Single demo profile (ID=1, Dr. Priya Mehta) — no auth yet
- All API routes use DEFAULT_PROFILE_ID = 1
- api-zod/src/index.ts only exports from ./generated/api (codegen script patches this)
- orval config removes schemas: option to avoid duplicate exports
