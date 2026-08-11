# Operational Runbook: SCRUM-65 — Case Sensitive Email Duplicate Check

## Summary

This change implements a POST `/api/users` endpoint in `artifacts/api-server/src/routes/userRoutes.ts` that performs case-sensitive email duplicate checking using Drizzle ORM's `eq()` matcher against the `profilesTable`. The implementation treats emails with different casing as distinct values based on database collation settings. This change also introduces full user registration functionality including request validation via Zod and database insertion.

## What changed

- Added POST `/api/users` route handler in `artifacts/api-server/src/routes/userRoutes.ts`
- Implemented `RegisterUserBody` Zod schema to validate `email` (must be valid email format) and `name` (required string) fields
- Added case-sensitive email duplicate check using `db.select().from(profilesTable).where(eq(profilesTable.email, email))`
- Returns HTTP 409 with `{ error: "Email already in use" }` when duplicate email detected
- Inserts new user record via `db.insert(profilesTable).values({ email, name })` when no duplicate found
- Returns HTTP 201 with `{ message: "User created successfully" }` on successful creation
- Returns HTTP 400 with `{ error: "Invalid request data" }` on validation failure
- Exports `userRouter` for integration into Express application

## Deployment steps

**CRITICAL: This code has blocking issues and cannot be deployed as-is.**

1. **BLOCK DEPLOYMENT:** Add missing Zod import statement at the top of `artifacts/api-server/src/routes/userRoutes.ts`:
   ```typescript
   import { z } from "zod";
   ```
2. **BLOCK DEPLOYMENT:** Verify no existing user registration endpoint conflicts with `/api/users` POST route in the codebase
3. **BLOCK DEPLOYMENT:** Add database unique constraint on `profilesTable.email` column to prevent race conditions, or wrap the duplicate check and insert in a database transaction
4. **BLOCK DEPLOYMENT:** Document and confirm intended behavior: should 'User@Example.com' and 'user@example.com' be treated as different users or the same user?
5. Ensure `userRouter` is imported and mounted in the main Express application (typically in `app.ts` or `server.ts`)
6. Verify PostgreSQL database collation settings align with intended case-sensitivity behavior for email matching
7. Deploy via standard CI/CD pipeline after resolving blocking issues
8. Restart `api-server` service to load the new route handler

## Rollback procedure

1. Revert branch `task/93` by merging the parent commit prior to `9bf457dd1802cab747db552b9a12bc9cd2a2bc9b`
2. Alternatively, close PR https://github.com/pinnaclecube/pinnaclecube/pull/10 and deploy the previous stable commit
3. Remove the `userRouter` import and mount statement from the main Express application if added
4. Restart `api-server` service to unload the `/api/users` POST route
5. If any user records were created via this endpoint in production, evaluate whether to retain or remove them based on business requirements (no automated data rollback included)
6. Verify `/api/users` POST endpoint returns 404 after rollback

## Validation

**Expected behavior depends on database collation settings as noted in acceptance criteria.**

1. **Test case 1 - Different case duplicate detection:**
   - Prerequisite: Insert user with email `Test@Example.com` directly into `profilesTable`
   - Execute: `POST /api/users` with body `{ "email": "test@example.com", "name": "Test User" }`
   - Expected result (case-sensitive collation): HTTP 201 Created with `{ "message": "User created successfully" }`
   - Expected result (case-insensitive collation): HTTP 409 Conflict with `{ "error": "Email already in use" }`

2. **Test case 2 - Exact duplicate detection:**
   - Prerequisite: Insert user with email `test@example.com`
   - Execute: `POST /api/users` with body `{ "email": "test@example.com", "name": "Another User" }`
   - Expected result: HTTP 409 Conflict with `{ "error": "Email already in use" }`

3. **Test case 3 - Validation failure:**
   - Execute: `POST /api/users` with body `{ "email": "invalid-email", "name": "Test User" }`
   - Expected result: HTTP 400 Bad Request with `{ "error": "Invalid request data" }`

4. **Test case 4 - Successful creation:**
   - Execute: `POST /api/users` with body `{ "email": "unique@example.com", "name": "Unique User" }`
   - Expected result: HTTP 201 Created with `{ "message": "User created successfully" }`
   - Verify: Query `profilesTable` to confirm record exists with email `unique@example.com`

5. **Database verification:**
   - Query: `SELECT email, name FROM profiles_table WHERE email ILIKE 'test@example.com'` to inspect created records
   - Examine PostgreSQL logs for INSERT statements from the `api-server` service

6. **Monitor application logs** for errors related to missing Zod import or race condition duplicates

## Test cases

No test cases were generated for this change.

## Security notes

Security scan not run for this change.

**Manual security considerations:**

- The endpoint lacks authentication/authorization checks — any unauthenticated client can create user accounts
- No rate limiting implemented — vulnerable to account creation spam
- Race condition allows duplicate email creation under concurrent requests
- Email validation relies solely on Zod's email format check — does not verify email deliverability or ownership

## References

- Work item: SCRUM-65
- Branch: task/93
- Pull request: https://github.com/pinnaclecube/pinnaclecube/pull/10
- Commit: 9bf457dd1802cab747db552b9a12bc9cd2a2bc9b
- Generated by: Narratia (Blue Mantis)