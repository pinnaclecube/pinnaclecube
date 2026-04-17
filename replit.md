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

## Legal

Every page includes: "Pinnacle³ is not a law firm and does not provide legal advice."
Every AI output block includes: "AI-generated content — verify with your attorney."
These are non-negotiable and never dismissable.

## Important Notes

- Single demo profile (ID=1, Dr. Priya Mehta) — no auth yet
- All API routes use DEFAULT_PROFILE_ID = 1
- api-zod/src/index.ts only exports from ./generated/api (codegen script patches this)
- orval config removes schemas: option to avoid duplicate exports
