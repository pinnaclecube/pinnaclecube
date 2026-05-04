# Pinnacle³ — EB-1A Immigration Consulting Platform

## Overview

Pinnacle³ is a premium immigration advisory coaching platform for high-achieving tech professionals. It focuses on guiding clients through the EB-1A, EB-2 NIW, and O-1A visa processes. The platform provides advisory coaching services, distinguishing itself from a traditional law firm.

**Key capabilities include:**
- **Excellence Lab:** Learning courses for visa preparation.
- **Evidence Engine:** A system for tracking and managing supporting documentation.
- **Elite Blueprint:** Personalized strategy and guidance services.
- **AI Readiness Analysis:** An AI-powered tool to assess a client's visa readiness.
- **Google Drive Auto-Ingest:** Automated evidence ingestion from client Google Drive folders.

The project's vision is to provide clarity and structured support for extraordinary talent navigating complex immigration pathways.

## User Preferences

- The agent should use `pnpm` for all package management commands.
- The agent should prioritize the use of TypeScript version 5.9.
- For frontend development, the agent should use React with Vite.
- For API development, the agent should use Express 5.
- The agent should use PostgreSQL with Drizzle ORM for database interactions.
- The agent should use Zod (`zod/v4`) and `drizzle-zod` for validation.
- The agent should use Orval for API codegen from an OpenAPI spec.
- The agent should use esbuild for CJS bundle builds.
- The agent should use Plus Jakarta Sans as the primary font.
- The agent should ensure all internal staff pages are complete at the `/internal/` path prefix.
- The agent should gate staff access by the `X-Staff-Token` header and the `StaffProtectedRoute` component.
- The agent should ensure all staff fetch calls use the `staffFetch(path, opts)` helper.
- The agent should ensure all protected routes enforce the disclaimer version using the `requireClientAuth` middleware.
- The agent should ensure the non-negotiable, non-dismissable legal footer bar is included on every page.
- The agent should ensure all AI output blocks display variant-specific disclaimers.

## System Architecture

The application is built as a monorepo using `pnpm` workspaces.

**Technology Stack:**
- **Node.js:** v24
- **TypeScript:** v5.9
- **Frontend:** React + Vite (located in `artifacts/pinnacle`, preview path `/`)
- **Backend API:** Express 5 (located in `artifacts/api-server`, preview path `/api`)
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI specification)
- **Build Tool:** esbuild (for CJS bundling)

**UI/UX and Branding:**
- **Brand Colors:** Primary indigo (`#1E2D6B`), accent indigo (`#3D4FA8`), superscript indigo (`#5B6BAE`). Text primary is a near-black with blue undertone (`#1A1A2E`). Background is pure white (`#FFFFFF`) for a light theme.
- **Font:** Plus Jakarta Sans.
- **Product Access Gating:** `ProductProtectedRoute` (`artifacts/pinnacle/src/components/auth/ProductProtectedRoute.tsx`) enforces access levels for product-specific routes, redirecting unpurchased users to checkout pages.

**Technical Implementations & Features:**
- **Google Drive Auto-Ingest:** A poller service (`driveIngestService.ts`) automatically detects, downloads, extracts text, and inserts files from client Google Drive criterion folders as evidence records. Processing includes AI summary generation.
- **Stripe Integration:** Handles `Excellence Lab` and `Evidence Engine` purchases via `POST /api/stripe/checkout` and manages access granting via webhook (`POST /api/stripe/webhook`). When a prospect pays via a staff-sent invoice link, the webhook auto-creates a portal account with a temp password, links `prospectsTable.linkedProfileId`, and emails credentials — skipping the generic purchase-confirmation email. Staff invoice `success_url` is `/payment-success`.
- **AI Readiness Analysis:** The `GET /api/intake/analysis` endpoint uses Claude to analyze intake data, providing `overallReadiness`, `strongAreas`, `recommendedAreas`, and a `roadmap`. Results are cached.
- **Readiness Intake:** A 6-step wizard, including resume upload to Google Drive via `POST /api/intake/resume`.
- **Internal Staff Portal:** Located at `/internal/`, it provides comprehensive tools for managing cases, prospects, Elite Blueprint applications, evidence, and petition generation. Access is gated by `X-Staff-Token`. The Prospects list defaults to hiding converted prospects (toggle on page header); converted prospects with a `linkedProfileId` show a "View Case" deep-link in their detail view.
- **Authentication System:** JWT-based authentication stored in `localStorage['pinnacle_token']` for clients. Staff authentication uses `X-Staff-Token` in `sessionStorage`. Includes registration, login, profile management, password reset, disclaimer acceptance flow, and a first-login forced password-change flow (`mustChangePassword` column + `POST /api/auth/set-password` light-auth endpoint + `/set-password` page).
- **Legal/Disclaimer System:** Features `LegalFooterBar`, `AIOutputBanner`, `LessonDisclaimer`, `DocumentDisclaimer`, `AIBadge`, and `ReconsentModal` to manage legal compliance and AI disclaimers. A `DisclaimerContext` handles reconsent flow when disclaimer versions change.

**Core Components:**
- **Auth Components:** `AuthContext.tsx`, `useProductAccess.ts`, `ProtectedRoute.tsx`, `StaffProtectedRoute.tsx`.
- **Notification Components:** `NotificationBell.tsx` (polls for unread notifications), `NotificationPanel.tsx`.
- **Navigation:** `Navbar.tsx` (auth-aware), `StaffNav.tsx`.

**Database Schema:** Key tables include `profiles`, `criteria`, `evidence`, `blueprints`, `milestones`, `courses`, `lessons`, `course_progress`, `activity`, `notifications`, `readiness_intake`, `client_action_items`, `client_drive_folders`, `visa_criteria`, and `blueprints_applications`.

## External Dependencies

- **Stripe:** Used for processing payments for `Excellence Lab` and `Evidence Engine` products (checkout sessions and webhooks).
- **Google Cloud Platform (Google Drive API):** Integrated for automatic ingestion of client documents into the Evidence Engine and resume uploads.
- **Anthropic Claude:** Utilized for AI readiness analysis (`/api/intake/analysis`) and generating AI summaries for evidence processing.
- **Google Fonts:** Used to serve the "Plus Jakarta Sans" font.