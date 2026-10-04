# Account Entry by Email Link Implementation Plan

## Overview

Replace password sign-in and separate password registration with one email-only magic-link flow for new and existing accounts. Keep `/` available to guests, preserve Supabase SSR cookies and the protected dashboard, and require an explicit user POST before consuming a link token.

## Current State Analysis

The app already has a Supabase SSR client, middleware-loaded users, a protected `/dashboard`, sign-out, and server-rendered auth pages. Sign-in and signup currently use passwords. The home route renders the timer without account navigation. The callback flow does not exist; current smoke scripts authenticate with passwords, and CI explicitly excludes the local email testing service.

The existing client in `src/lib/supabase.ts:5-20` is the required session boundary. `src/middleware.ts:4-23` protects the dashboard but drops the original route on redirect. The current auth form and endpoints are in `src/components/auth/SignInForm.tsx`, `src/pages/api/auth/{signin,signup}.ts`, and `src/pages/auth/{signin,signup,confirm-email}.astro`. The test stack is Node’s built-in runner (`package.json`); no new test framework is needed.

## Desired End State

Any visitor can keep using the timer at `/` and follow one account-entry path by entering an email. New and existing accounts receive the same neutral response and a link that returns only to a validated local destination. Opening the link displays a confirmation page; GET never verifies it, and a deliberate POST verifies it through the SSR client and stores cookies before redirecting. Bad, expired, or reused links produce a neutral retry state.

Local CI exercises real email delivery and exchange via Supabase’s local email inbox with email confirmations enabled. Both new-account confirmation and returning-account magic-link templates use the same `type=email` callback contract. Production automation checks public pages and the anonymous dashboard redirect only, without sending mail or using a password. Before merge, the coordinator confirms the hosted auth/template settings and callback allowlist; the user manually verifies a real production link after deployment.

### Key Discoveries:

- SSR cookie persistence already exists in `src/lib/supabase.ts:5-20`; the new verification route must use it.
- `src/middleware.ts:18-20` redirects anonymous dashboard visitors to sign-in without preserving their destination.
- `src/pages/index.astro:6-8` is the only root shell around the guest timer; use it for the approved navigation entry and do not modify timer components.
- `supabase/config.toml:99-102` exposes the local email testing UI/API on port `55324`; CI currently disables the service in `.github/workflows/ci.yml:38-42`.
- Supabase’s documented `TokenHash`/`RedirectTo` email template contract and redirect wildcard syntax are linked in `research.md`.

## What We're NOT Doing

- No password registration, OAuth, database tables, or migrations.
- No timer engine or timer component changes; guest use of `/` remains intact.
- No production Supabase mutation by the implementation agent and no production email in automated smoke.
- No automated claim that production email delivery or token exchange is verified; that remains a user-owned manual gate.
- No secret inspection or removal. In particular, this plan does not require reading or changing `SMOKE_PASSWORD` or Supabase/Cloudflare secret values.

## Implementation Approach

Implement the server contracts first and test their security-sensitive behavior with the existing Node runner. Add the confirmation and email-entry UI, local template/configuration, and shell navigation in a separate phase with reviewed screenshots. Finish with real local Mailpit end-to-end coverage and credential-free production route smoke. Each phase gets its own commit; after its checks, update `Progress` and this change’s handoff, report `CHECKPOINT READY`, and stop for a fresh thread before the next phase.

## Production Configuration to Apply Before Merge

The implementation must add `supabase/templates/magic_link.html`, set `[auth.email] enable_confirmations = true`, and point both `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]` in `supabase/config.toml` to that template. Preserve the hosted email-confirmation policy; the coordinator confirms its exact setting before merge. The production setup is a coordinator action in the Supabase Dashboard, not a remote edit by this agent:

1. In **Authentication → URL Configuration**, confirm **Site URL** is `https://drill-me.twincoder.workers.dev`.
2. Add this exact **Redirect URL** allowlist entry: `https://drill-me.twincoder.workers.dev/auth/callback*`. The app always passes a validated `next` query on `emailRedirectTo`; the wildcard permits that callback query on the fixed production origin and route.
3. In **Authentication → Email Templates**, set both **Confirm signup** and **Magic Link** to the same subject, `Your Drill Me sign-in link`, and callback body:

   ```html
   <p>Use this one-time link to sign in to Drill Me:</p>
   <p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Continue to Drill Me</a></p>
   <p>If you didn't request this email, you can ignore it.</p>
   ```

4. Before merge, the coordinator confirms the hosted confirmation policy, both templates, and deployed callback URL allowlist. Do not paste a token, email address, API key, or other secret into logs or this change folder.

The Phase 3 Worker config adds `observability.redact_query_string = true` alongside the existing `observability.enabled = true`. Cloudflare documents this setting as removing query strings from request URLs in logs and traces. Keep application diagnostics free of tokens and callback URLs, including error paths. This setting does not remove the callback URL from browser history; record that as a residual limitation. Before merge, inspect the generated deployment configuration for the redaction setting. Do not inspect live logs or secrets.

## Phase 1: Server Flow and Contracts

### Overview

Replace password operations with a shared email-link request contract, preserve and validate `next`, and add an explicit POST verification endpoint. Keep the SSR client as the sole session/cookie path.

### Changes Required:

#### 1. Shared email-link contracts and direct dependency

**File**: `package.json`, `package-lock.json`, `src/lib/email-auth.ts`, `src/lib/email-auth.test.ts`

**Intent**: Add the approved direct Zod dependency and centralize validation so route handlers share one tested contract. Keep helpers independent enough to exercise with fake Supabase clients under Node’s existing test runner.

**Contract**: Validate email input, `token_hash`, fixed `type=email`, and a same-origin local-path `next`; reject scheme-relative, absolute, backslash, and malformed destinations. The request flow calls `signInWithOtp` with user creation enabled and an `emailRedirectTo` callback containing encoded validated `next`. Existing/new accounts receive the same response shape and message; errors must not reveal account existence. Node tests exercise a pure injected service/adapter boundary and must not claim to import Astro routes or prove Astro cookie serialization. Application logs and error handling must not serialize tokens or full callback URLs.

#### 2. Request, callback verification, and session routes

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/callback.ts`, `src/middleware.ts`

**Intent**: Replace password sign-in and password signup with the shared email request operation, and add the explicit token verification POST. Preserve `POST /api/auth/signup` as a legacy alias to the same email-only request handler and result; it must no longer create password accounts.

**Contract**: `POST /api/auth/signin` accepts the email form and returns a neutral result for both account states. `POST /api/auth/signup` is a legacy alias to the same request handler and result; it does not retain password behavior or redirect a POST. `POST /api/auth/callback` validates form input, calls `verifyOtp({ token_hash, type: "email" })` through `createClient(request.headers, context.cookies)`, and redirects only after success to safe `next`; invalid/expired/reused values return the same neutral retry outcome. Middleware includes the originally requested protected local path in the sign-in redirect. API routes remain SSR (`prerender = false`). GET never calls `verifyOtp`.

### Success Criteria:

#### Automated Verification:

- `npm test` covers email/token validation, unsafe `next` rejection, same neutral request result for new/existing accounts, explicit POST delegation at the injected boundary, cookie-writer adapter contract calls, and invalid/reused-token handling. It does not claim to prove the actual Astro SSR cookie roundtrip.
- `npm run lint` passes for the server-flow changes.
- `npx astro check` passes for route and middleware contracts.

#### Manual Verification:

No external email or production check is required in this phase; real delivery is tested in Phase 3.

**Implementation Note**: After these checks, commit Phase 1 separately, update its Progress/handoff evidence with the SHA, report `CHECKPOINT READY`, and stop. Phase 2 starts in a fresh thread.

## Phase 2: UI, Routing, and Email Template

### Overview

Present one email-only account entry, a neutral sent screen, and a deliberate confirmation screen. Add only account navigation in the Astro root shell; preserve the guest timer and leave timer components unchanged.

### Changes Required:

#### 1. Email entry, neutral result, and legacy route behavior

**File**: `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`, `src/pages/auth/confirm-email.astro`, `src/pages/auth/signup.astro`

**Intent**: Remove the password field and separate registration choice from the user-facing flow. Show the same “check your email” result whether a new or existing account was entered, and keep old signup links pointing to the canonical entry.

**Contract**: The single form posts an email and validated `next` to `/api/auth/signin`; success/error copy does not disclose whether an account exists. `/auth/signup` redirects to `/auth/signin` while preserving only a valid safe `next`; `/auth/confirm-email` is account-neutral. Controls use the repository’s semantic tokens and existing UI primitives where suitable.

#### 2. Confirmation page, callback response headers, and local template

**File**: `src/pages/auth/callback.astro`, `src/pages/api/auth/callback.ts`, `supabase/templates/magic_link.html`, `supabase/config.toml`

**Intent**: Make token consumption an explicit user action and configure both local Supabase email paths to open that page. Keep the token on a same-origin form POST and out of referrers, caches, third-party requests, and application logs.

**Contract**: `GET /auth/callback` validates/display-prepares `token_hash`, `type=email`, and safe `next`, but never consumes the token. It responds with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, with no third-party assets. A same-origin form submits to `POST /api/auth/callback`; only that POST calls `verifyOtp`. Local Supabase sets `enable_confirmations = true`; both `confirmation` and `magic_link` templates use `{{ .RedirectTo }}`, `{{ .TokenHash }}`, and `type=email` to reach the same callback. Allowlist `http://localhost:4321/auth/callback*` for CI and `http://localhost:4323/auth/callback*` for auth dev. Add a `127.0.0.1` variant only if the actual app `BASE_URL` uses that host, and keep the smoke `BASE_URL` aligned with an allowlisted origin.

#### 3. Root shell account navigation and visual evidence

**File**: `src/pages/index.astro`, `context/changes/enter-account-by-email-link/screenshots/`

**Intent**: Give guests a clear account-entry link and authenticated visitors an account/dashboard link from the Astro shell, without changing timer internals. Save reviewable screenshots of the updated entry flow.

**Contract**: Navigation reads `Astro.locals.user`; the guest route `/` and `DrillApp` remain present. Use the token source `src/styles/global.css` and components from `src/components/ui/`; do not add palette literals or modify timer components. Apply the `/10x-ui` workflow to changed views that already render. At 1280px and 390px in light and dark themes, capture default, hover, focus-visible, disabled, error, empty (or N/A with a per-view reason), and loading states; inspect and save screenshots in the change folder. Coordinate before changing global CSS, `Layout.astro`, or shared UI components.

### Success Criteria:

#### Automated Verification:

- `npm test` passes callback GET/POST contract tests, including no verification on GET, no-store/no-referrer headers, safe hidden-form values, and generic invalid-link state.
- `npm run lint` and `npx astro check` pass for the auth pages, Astro shell, template/config wiring, and route headers.

#### Manual Verification:

- Review and save the `/10x-ui` desktop/mobile, light/dark state matrix for each changed existing view; confirm the email-only form, visible focus, neutral sent/retry copy, account navigation, justified N/A states, and preserved guest timer.

**Implementation Note**: After checks and screenshot review, commit Phase 2 separately, update Progress/handoff with evidence and SHA, report `CHECKPOINT READY`, and stop. Phase 3 starts in a fresh thread.

## Phase 3: Mailpit E2E, CI, and Deployment Smoke

### Overview

Exercise real local delivery and session exchange for new and existing accounts. Keep production smoke credential-free and route-only, and make the boundary of its evidence explicit.

### Changes Required:

#### 1. Local email E2E

**File**: `scripts/smoke.mjs`, `supabase/config.toml`

**Intent**: Replace password-based local smoke with an actual email-link journey using the local Supabase inbox on port `55324`.

**Contract**: With `enable_confirmations = true`, the smoke obtains messages through the local inbox API without printing the email, token, or callback URL. Cover a new account using the confirmation template and a subsequent existing-account sign-in using the magic-link template, both with `type=email`; also cover confirmation-page GET without consumption, explicit POST, the real Astro SSR cookie roundtrip, dashboard access, sign-out, malformed link, and reuse of a consumed link. Keep test addresses unique. Application diagnostics and error paths must not serialize request URLs or token material.

#### 2. CI, remote smoke, and deploy checks

**File**: `.github/workflows/ci.yml`, `.github/workflows/production-smoke.yml`, `scripts/smoke.mjs`, `wrangler.jsonc`

**Intent**: Enable the local inbox in CI and separate local auth proof from read-only production route checks.

**Contract**: CI no longer excludes `mailpit` and runs the complete local email E2E against the production preview. `SMOKE_MODE=remote` requires no email/password secret, sends no email, and checks public home/auth pages plus anonymous dashboard redirection only. Apply that behavior to both the deploy check in `ci.yml` and the manual `production-smoke.yml`; their names/output must state that remote smoke does not prove email delivery or authentication exchange. Set `observability.redact_query_string = true` alongside the existing `observability.enabled = true` in `wrangler.jsonc`; before merge, inspect the configuration generated by the normal Wrangler deployment dry-run/build and confirm both values are present. Do not inspect live logs or stored secrets.

### Success Criteria:

#### Automated Verification:

- `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` passes the real Mailpit journey for new/existing accounts through both configured templates, the actual Astro SSR cookie roundtrip, dashboard, sign-out, malformed link, and link reuse without logging token material.
- CI starts local Supabase with Mailpit enabled and passes lint, unit tests, Astro checks, build, and production-preview local smoke.
- Credential-free `SMOKE_MODE=remote` passes home/auth availability and anonymous dashboard redirect checks; both GitHub workflows run it without `SMOKE_EMAIL` or `SMOKE_PASSWORD` and report the evidence limitation.

#### Manual Verification:

- Before merge, the coordinator confirms the hosted confirmation policy, Site URL, callback allowlist, and both production email templates from “Production Configuration to Apply Before Merge”; inspect the generated Wrangler deployment configuration for `observability.redact_query_string = true` and `observability.enabled = true`. Do not inspect live logs or secrets; browser history remains an explicit residual limitation. No automated job mutates Supabase settings.
- After deployment, the user opens a real production email link, explicitly confirms it, and confirms the expected authenticated dashboard/session. Leave this row unchecked until the user reports completion; route-only remote smoke is not a substitute.

**Implementation Note**: Gate Phase 3 in this order: local checks and E2E → separate phase commit → push/open PR → CI and review → coordinator merge → production deploy and route-only smoke → user’s manual production magic-link test. Update Progress/handoff with the commit SHA and retain the production manual item as pending until user confirmation. Report `CHECKPOINT READY` after the phase checkpoint; the coordinator merges only after review and green CI. Do not mark S-09 complete on route-only smoke.

## Testing Strategy

### Unit Tests

- Use `node:test` tests beside `src/lib/email-auth.ts` for Zod parsing, safe `next`, identical request outcomes, callback type/hash validation, and error normalization, using a pure injected service/adapter boundary that does not import Astro routes or `astro:env/server`.
- At that boundary, assert GET/POST delegation and the cookie-writer adapter contract only. The Phase 3 local Astro + Supabase E2E is the evidence for actual SSR cookie persistence.

### Integration Tests

- Phase 3 runs the app against local Supabase and reads actual messages from the local inbox. Exercise both the first link for a new account and a later link for that now-existing account, plus bad/reused tokens, session cookies, protected dashboard, and sign-out.
- Remote smoke is deliberately limited to public routes and the unauthenticated dashboard redirect; it does not send an email or establish an authenticated production session.

### Manual Testing Steps

1. Review phase 2 screenshots for the full `/10x-ui` state matrix at 1280px and 390px in light and dark themes; verify any N/A states are justified.
2. Before merge, coordinator confirms the hosted auth policy, both production templates and callback allowlist, and the generated Wrangler config described above.
3. After deployment, the user follows an actual production email link and confirms session/dashboard access.

## Performance Considerations

No data model or client-side polling is added. Each entry sends one Supabase OTP email; respect Supabase’s rate limits and keep the confirmation page free of third-party requests.

## Migration Notes

No database migration is required. Existing password-created accounts continue to use their email identity; new and existing users enter through the same magic-link form. Remove password registration UI/behavior, but retain legacy signup URL behavior as a redirect/alias to avoid a dead entry point.

## References

- Research: `context/changes/enter-account-by-email-link/research.md`
- SSR session boundary: `src/lib/supabase.ts:5-20`
- Auth route protection: `src/middleware.ts:4-23`
- Local Supabase email inbox: `supabase/config.toml:99-102`
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server Flow and Contracts

#### Automated

- [x] 1.1 Node unit tests cover email/token validation, safe `next`, account-neutral request behavior, explicit POST delegation and injected cookie-writer contract calls; actual Astro SSR cookies are verified in Phase 3 E2E. — e75eecd
- [x] 1.2 `npm run lint` passes for the server-flow changes. — e75eecd
- [x] 1.3 `npx astro check` passes for route and middleware contracts. — e75eecd

### Phase 2: UI, Routing, and Email Template

#### Automated

- [x] 2.1 Unit tests prove callback GET does not verify tokens and that callback headers, safe form values, and neutral failure behavior meet the contract. — 42d2bc5
- [x] 2.2 `npm run lint` and `npx astro check` pass for auth pages, shell navigation, callback wiring, both local email templates, confirmation policy, and callback allowlist. — 42d2bc5

#### Manual

- [x] 2.3 `/10x-ui` screenshots cover default, hover, focus-visible, disabled, error, empty or justified N/A, and loading at 1280px/390px in light/dark for each changed existing view; root navigation and guest timer are also reviewed. — 42d2bc5

### Phase 3: Mailpit E2E, CI, and Deployment Smoke

#### Automated

- [x] 3.1 Local Mailpit smoke proves new/existing email sign-in through the confirmation/magic-link templates, actual Astro SSR cookie persistence, dashboard access, sign-out, authenticated `Account` → `/dashboard` and signed-out `Sign in` → `/auth/signin` home-shell links, malformed link, and consumed-link reuse without logging token material. — 07fb169
- [ ] 3.2 CI keeps Mailpit enabled and passes lint, unit tests, Astro checks, build, and local email smoke.
- [ ] 3.3 Both remote smoke workflows pass public-route/dashboard-guard checks without email/password secrets and clearly state that they do not verify full authentication.

#### Manual

- [ ] 3.4 Before merge, coordinator confirms hosted email-confirmation policy, production callback allowlist and both templates, and verifies the generated Wrangler config retains `observability.enabled = true` and `observability.redact_query_string = true`; no live logs or secrets are inspected, and browser history is recorded as a residual limitation.
- [ ] 3.5 User verifies a real production magic link and authenticated dashboard after deployment.
