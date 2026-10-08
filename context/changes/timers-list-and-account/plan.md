# Timers list screen and account page (S-17) Implementation Plan

## Overview

The saved timers list moves from `/dashboard` to a new protected screen `/timers`, which becomes the signed-in landing page (default `next`, the top bar `Timers` link, `Back to timers` links, redirect after delete). `/dashboard` becomes an account page (email, link to `/timers`) with no database query. After a new timer is saved on `/create` the browser goes to `/{id}` instead of staying on the form with a `Saved` alert. No migrations. Decisions are fixed in `context/foundation/ux-fixes-plan.md` (S-17 and the decision table) and `context/foundation/roadmap.md` (S-17, FR-011, FR-016, FR-017).

## Current State Analysis

- `src/pages/dashboard.astro` renders the account email, `SavedDrillList` (fed by `resolveDashboardPage`), the `Create a timer` link and a second `Sign out` form (the bar already has one). It redirects guests with `signInUrlForProtectedPath("/dashboard")` and sets `private, no-store`.
- `src/lib/protected-routes.ts:3` lists `["/dashboard", "/create"]`; `/{uuid}` and `/{uuid}/edit` are protected through `isSavedDrillPath`. `/timers` is not a UUID, so `[id].astro` never matches it and Astro serves the static page first.
- `src/lib/app-top-bar.ts:2` `TIMERS_HREF = "/dashboard"` (comment already says S-17 changes it). `AppTopBar.astro:25` links the email to `/dashboard` (stays; that is the account page).
- Default login target is `/`: `safeNextPathSchema` `.default("/")` (`src/lib/email-auth.ts:51`), `emailLinkCallbackPageState` fallback (`:81`, `:98`), `signInUrlForProtectedPath` fallback `/dashboard` (`:137`), `signin.astro:8`, `confirm-email.astro:11-12`. The callback button says `Continue to account` (`callback.astro:37`); `Back to the timer` there and on `confirm-email.astro` points to `/`.
- `drill-create-controller.ts`: on `response.ok` it publishes `status: "saved"` + `savedName` (create clears the name, edit keeps it via `keepAfterSave`); `DrillCreateForm.tsx:108` renders the `Saved "…"` alert and focuses the name field; `isSaveDrillResponse` (`:158`) does not check `drill.id`.
- `drill-delete-controller.ts:36` `DASHBOARD_HREF = "/dashboard"` with an injected `navigate` and a `useDrillDelete` hook that resets on bfcache `pageshow` — the model for the create redirect.
- `Back to dashboard` text/links: `SavedDrillDetails.tsx:39`, `DrillEditApp.tsx:19` (`DrillEditLinks`), `DrillCreateForm.tsx:98` (`not_found` alert), `[id].astro:42`, `[id]/edit.astro:42`.
- Lint scope lists `src/pages/dashboard.astro` (`eslint.config.js:109`); there is no `timers.astro` yet. `scripts/eslint-rules/timer-ui-contract.test.mjs` pins that the `[id]` pages are linted.
- Smoke (`scripts/smoke.mjs`) uses `/dashboard` as the list (L318, 391-398, 432, 559-565, 596, 715, 747), as the sign-in `next` (L171, 675, 756) and for `Dashboard` / `Sign out` markers (L276, 785, 846); the bar helper expects `Timers` → `/dashboard` (L210-211).
- `resolveDashboardPage` / `DashboardPage` (`src/lib/services/drill-configurations.ts:571`) and their test (`saved-drills-read.test.ts`) only serve the list.

### Key Discoveries:

- Static `src/pages/timers.astro` wins over `[id].astro`, and the middleware guard is a plain prefix check, so adding `/timers` to `PROTECTED_ROUTES` is enough (`protected-routes.ts:3`).
- The delete flow already is the pattern for "navigate after success with an injected port, stay locked, reset on bfcache" — reuse it for create instead of inventing a new one.
- `middleware.ts` + `html-cache-control.ts` already set `private, no-store` on HTML without its own `Cache-Control`; pages still set it explicitly when they read user data (follow `dashboard.astro`).
- Local Mailpit is missing: the full smoke is confirmed by CI only; visual checks run as a Playwright script and are reported as "script, not human".

## Desired End State

- Signed in, `/timers` shows `SavedDrillList` and `Create a timer`; a guest is redirected to `/auth/signin?next=%2Ftimers`. `/dashboard` shows the account email, a link to `/timers`, with no database access; a guest is redirected as before.
- Signing in without an explicit `next` lands on `/timers`; the callback button reads `Continue to your timers`; the `Timers` link in the bar goes to `/timers`.
- Saving a new timer on `/create` ends on `/{id}` (details + Start); editing still stays on `/{id}/edit` with `Saved`. `Back to timers` links and the post-delete redirect go to `/timers`.
- Verify: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`, screenshots in `context/changes/timers-list-and-account/screenshots/`, smoke green in CI.

## What We're NOT Doing

- No redirect from `/dashboard` to `/timers`, no change to `/`, `/create` or `/api/drills` behavior, no migrations, no new API.
- No account editing, password/email change or account deletion (S-20).
- No change to the run view (S-18) or signal preview (S-19).
- No archiving and no manual test list (done after the whole queue).
- `Back to the timer` (→ `/`) on `/create`, `callback.astro` and `confirm-email.astro` keeps pointing to the drill runner.

## Implementation Approach

Four small phases, each leaving `main`-quality state: (1) the new screen and the account page with routing and lint; (2) the default login target and every `Back to timers` link; (3) the create-to-`/{id}` redirect in the controller, hook, form and fixtures; (4) smoke, docs, visual gate. Names that mention "dashboard" for the list (`resolveDashboardPage`, `DASHBOARD_HREF`) are renamed to the timers meaning in the phase that touches them.

## Phase 1: `/timers` list page, `/dashboard` as account page

### Overview

Introduce the protected list route and turn `/dashboard` into an account page; wire the bar link and lint scope.

### Changes Required:

#### 1. Timers page

**File**: `src/pages/timers.astro` (new)

**Intent**: Move the list, `Create a timer` link, `no-store` header and guest redirect out of `dashboard.astro`. The redirect uses `signInUrlForProtectedPath("/timers")`. Title and `h1` `Timers`; list heading `Saved timers`; no `Sign out` (the bar has it).

**Contract**: Route `/timers`, `prerender = false`, `Cache-Control: private, no-store`, guest → 302 to `/auth/signin?next=%2Ftimers`, same `SavedDrillList` states as today.

#### 2. Service rename

**File**: `src/lib/services/drill-configurations.ts`, `src/lib/services/saved-drills-read.test.ts`

**Intent**: Rename `resolveDashboardPage` / `DashboardPage` to `resolveTimersPage` / `TimersPage` (behavior unchanged) so the name matches the page; update the test title and comment in `SavedDrillFixtures.tsx:44`.

**Contract**: Same union `ok | unavailable | sign_in`.

#### 3. Account page

**File**: `src/pages/dashboard.astro`, `src/components/AccountDetails.astro` (new)

**Intent**: `dashboard.astro` reads `Astro.locals.user` only: a signed-out request redirects to sign-in with `next=/dashboard`; otherwise it renders `Layout` + `AccountDetails` (`h1` `Account`, `Signed in as <email>` with `break-all`, a `Timers` link as `buttonVariants`, and the existing `Sign out` form, kept per the ux-fixes-plan decision "email, link to `/timers`, Sign out"). `AccountDetails` takes `email` so `/dev/timer-ui` can render it with fixtures.

**Contract**: `AccountDetails` props `{ email: string }`; no database access; `private, no-store`.

#### 4. Routing, bar link, lint

**File**: `src/lib/protected-routes.ts`, `src/lib/protected-routes.test.ts`, `src/lib/app-top-bar.ts`, `eslint.config.js`

**Intent**: Add `/timers` to `PROTECTED_ROUTES`; `TIMERS_HREF = "/timers"` (drop the S-17 comment). Add `src/pages/timers.astro` and `src/components/AccountDetails.astro` to the timer-ui lint block. Tests: `/timers`, `/timers/`, `/%74imers`, `//timers` protected; `/timersx`, `/x/timers` not; `/timers` is not a saved-drill path. If the contract test enumerates linted files, extend it.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/create", "/timers"]`.

### Success Criteria:

#### Automated Verification:

- Types and routes sync: `npx astro sync`
- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- Type check passes: `npx astro check`

#### Manual Verification:

- Local server: signed in, `/timers` lists timers and `/dashboard` shows only account info (script, not human, if no browser session is available).

**Implementation Note**: pause after the automated checks; the coordinator sends `[FAZA-1-OK]` handling.

---

## Phase 2: Default login target and `Back to timers` links

### Overview

Make `/timers` the default destination after sign-in and repoint every list link.

### Changes Required:

#### 1. Default `next`

**File**: `src/lib/email-auth.ts`, `src/pages/auth/signin.astro`, `src/pages/auth/confirm-email.astro`, `src/lib/email-auth.test.ts`

**Intent**: One exported constant `DEFAULT_NEXT_PATH = "/timers"` used by `safeNextPathSchema`, the callback-state fallbacks, `signInUrlForProtectedPath` (replacing `/dashboard`) and both pages (`confirm-email` builds the sign-in link without `next` when it equals the default). An explicit `next=/` is still honored. Update tests that assert the old default.

**Contract**: Missing or unsafe `next` → `/timers`; an explicit safe `next` is unchanged.

#### 2. Callback label

**File**: `src/pages/auth/callback.astro`

**Intent**: Button text `Continue to your timers`; the script that swaps the label on submit is unchanged. `Back to the timer` stays.

**Contract**: Visible text only; the smoke markers are updated in phase 4.

#### 3. Links back to the list

**File**: `src/components/timer/SavedDrillDetails.tsx`, `DrillEditApp.tsx`, `DrillCreateForm.tsx`, `src/pages/[id].astro`, `src/pages/[id]/edit.astro`, `src/components/timer/EditDrillFixtures.tsx`

**Intent**: Text `Back to timers`, `href="/timers"`; fixture descriptions that say "dashboard" follow.

**Contract**: Same markup and variants, only text and href change.

#### 4. Delete redirect

**File**: `src/lib/drill-delete-controller.ts`, `src/lib/drill-delete-controller.test.ts`

**Intent**: `DASHBOARD_HREF` → `TIMERS_HREF` (`/timers`); tests assert `["/timers"]`. Avoid a name clash with `src/lib/app-top-bar.ts` by importing that constant instead of redefining it if the module has no browser-only code.

**Contract**: Successful and 404 delete navigate to `/timers`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- No stale list links: `grep -rn "Back to dashboard\|\"/dashboard\"" src` returns only the bar email link and the account page route

#### Manual Verification:

- Sign-in page with no `next` produces a callback link whose `next` is `/timers` (checked in CI smoke, locally by script).

---

## Phase 3: Create redirects to `/{id}`

### Overview

After `response.ok` in create mode the controller asks an injected `navigate` to go to the new timer; the `saved` state and alert exist only for edit.

### Changes Required:

#### 1. Controller

**File**: `src/lib/drill-create-controller.ts`, `src/lib/drill-create-controller.test.ts`

**Intent**: New option `navigate?: (href: string) => void`. In create mode (no `keepAfterSave`) a successful save keeps `status: "saving"` (form stays locked, like delete) and calls `navigate("/" + encodeURIComponent(drill.id))` once, even if the parameters were edited during the request (what was saved is what `/{id}` shows). Edit mode behavior is untouched. `isSaveDrillResponse` additionally requires a non-empty string `drill.id`. Add a `reset()` for bfcache.

**Contract**: `DrillCreateOptions { initialName?; keepAfterSave?; navigate? }`; create mode never publishes `saved`.

#### 2. Hook, form, apps

**File**: `src/components/hooks/useDrillCreate.ts`, `src/components/timer/DrillCreateApp.tsx`, `DrillCreateForm.tsx`

**Intent**: The hook passes `navigate` (default `window.location.assign`) and, like `useDrillDelete`, resets and reloads on a persisted `pageshow`. The form keeps the `Saved` alert and focus effect for edit; create no longer reaches it.

**Contract**: No new props on `DrillCreateForm`.

#### 3. Fixtures

**File**: `src/components/timer/CreateDrillFixtures.tsx`

**Intent**: Replace the `saved` scenario with `redirecting` (saving state, inert navigate) and keep the other states; the preview must never navigate.

**Contract**: Scenarios still cover default, hover, focus-visible, disabled/saving, error, empty and loading as before.

### Success Criteria:

#### Automated Verification:

- Controller tests pass: `npm test` (create: navigates once to `/{id}`, double submit sends one request and one navigation, edited-during-save still navigates, failure never navigates, edit never navigates, response without `drill.id` is `unexpected`)
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Creating a timer in a real browser lands on `/{id}` and Back does not show a stuck `Saving…` form (script, not human).

---

## Phase 4: Smoke, docs, visual gate

### Overview

Bring the CI smoke, documentation and `/dev/timer-ui` evidence in line, then run every gate.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: List checks move to `/timers`; sign-in `next` defaults to `/timers`; the account step asserts `/dashboard` (`Account` heading, email, `Timers` link, `Sign out`, no list); bar helper expects email → `/dashboard` and `Timers` → `/timers`; `Continue to your timers`; guest `/timers` → 302 to `/auth/signin?next=%2Ftimers` in local and remote modes; `/timers` added to the no-store set; after create the API `drill.id` is opened at `/{id}` (200, details). Local Mailpit is missing, so CI is the confirmation.

**Contract**: Step names stay recognizable; no new dependencies.

#### 2. Fixtures and screenshots

**File**: `src/pages/dev/timer-ui.astro`, `src/components/timer/SavedDrillFixtures.tsx`, `context/changes/timers-list-and-account/screenshots/`

**Intent**: Render `AccountDetails` with a normal and a long email in `/dev/timer-ui` (like the top bar fixtures); the list fixtures keep their states under the `Timers` wording. Capture default/hover/focus-visible/error/empty (or justified N/A) in light and dark at 1280 and 390 px for the list, account and create redirect state; report as "script, not human".

**Contract**: Preview stays development-only (production `/dev/timer-ui` is 404).

#### 3. Docs

**File**: `README.md` (route table: `/timers`, `/dashboard`, default sign-in landing), `AGENTS.md` (UI section lines naming `/dashboard` and the protected-page example), `src/AGENTS.md`, `CODEX.md`

**Intent**: Describe `/timers` as the list and `/dashboard` as the account page; protected-page example stays valid (`timers.astro`).

**Contract**: Text only.

### Success Criteria:

#### Automated Verification:

- `npx astro sync`
- `npm run lint`
- `npm test`
- `node --test scripts/eslint-rules/*.test.mjs`
- `npx astro check`
- `npm run build`
- CI `ci` and `smoke` jobs green on the PR

#### Manual Verification:

- Screenshots reviewed in `context/changes/timers-list-and-account/screenshots/` for both themes and widths (script, not human).
- After deploy: `/` 200, `/dev/timer-ui` 404, `/timers` and `/dashboard` 302 for a guest.

---

## Testing Strategy

### Unit Tests:

- `protected-routes.test.ts`: `/timers` variants protected, lookalikes public.
- `email-auth.test.ts`: default `next` is `/timers`, explicit `/` and `/dashboard?tab=drill` unchanged, unsafe values fall back to `/timers`, `signInUrlForProtectedPath` fallback.
- `drill-create-controller.test.ts`: redirect cases listed in phase 3, `drill.id` validation.
- `drill-delete-controller.test.ts`: navigates to `/timers`.
- `saved-drills-read.test.ts`: `resolveTimersPage` decisions.

### Integration Tests:

- Smoke (CI): guest and signed-in `/timers`, account page, bar links, create → `/{id}`, delete → list empty state.

### Manual Testing Steps:

1. Sign in without `next` and land on `/timers`.
2. Create a timer and land on `/{id}`; press Back and see a usable form.
3. Edit keeps `Saved`; delete returns to `/timers`.
4. `/dashboard` shows the email, the `Timers` link and `Sign out`, with no list.

## Performance Considerations

None: `/dashboard` loses its database read; `/timers` has the same single query as before.

## Migration Notes

No data changes. Old bookmarks of `/dashboard` now open the account page; the bar `Timers` link and the sign-in default lead to the list.

## References

- Decisions: `context/foundation/ux-fixes-plan.md` (S-17), `context/foundation/roadmap.md` (S-17)
- Redirect pattern: `src/lib/drill-delete-controller.ts`, `src/components/hooks/useDrillDelete.ts`
- Previous change: `context/changes/app-top-bar/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `/timers` list page, `/dashboard` as account page

#### Automated

- [ ] 1.1 Types and routes sync: `npx astro sync`
- [ ] 1.2 Lint passes: `npm run lint`
- [ ] 1.3 Unit tests pass: `npm test`
- [ ] 1.4 Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- [ ] 1.5 Type check passes: `npx astro check`

#### Manual

- [ ] 1.6 Signed in, `/timers` lists timers and `/dashboard` shows only account info

### Phase 2: Default login target and `Back to timers` links

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Unit tests pass: `npm test`
- [ ] 2.3 Type check passes: `npx astro check`
- [ ] 2.4 No stale list links remain in `src`

#### Manual

- [ ] 2.5 Sign-in without `next` produces a callback link whose `next` is `/timers`

### Phase 3: Create redirects to `/{id}`

#### Automated

- [ ] 3.1 Controller tests pass: `npm test`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Type check passes: `npx astro check`

#### Manual

- [ ] 3.4 Creating a timer lands on `/{id}` and Back does not show a stuck `Saving…` form

### Phase 4: Smoke, docs, visual gate

#### Automated

- [ ] 4.1 `npx astro sync`
- [ ] 4.2 `npm run lint`
- [ ] 4.3 `npm test`
- [ ] 4.4 `node --test scripts/eslint-rules/*.test.mjs`
- [ ] 4.5 `npx astro check`
- [ ] 4.6 `npm run build`
- [ ] 4.7 CI `ci` and `smoke` jobs green on the PR

#### Manual

- [ ] 4.8 Screenshots reviewed for both themes and widths
- [ ] 4.9 After deploy: `/` 200, `/dev/timer-ui` 404, `/timers` and `/dashboard` 302 for a guest
