<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Timers list screen and account page (S-17)

- **Plan**: context/changes/timers-list-and-account/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Checked (no finding)

- `/timers` protected (`PROTECTED_ROUTES` + page-level `signInUrlForProtectedPath("/timers")`), `private, no-store`; unit tests cover `/timers`, `/timers/`, `/%74imers`, `//timers`, `/timers%2Fx` protected and `/timersx`, `/x/timers` public; `isSavedDrillPath("/timers") === false`. Smoke: guest `/timers` → 302 `/auth/signin?next=/timers` in local and remote modes, and again after sign-out.
- `next` validation: `isSafeNextPath` unchanged; every fallback (`safeNextPathSchema`, callback page state ×2, `verifyEmailLink`, `handleEmailLinkCallback` form error, `signInUrlForProtectedPath`, `signin.astro`, `confirm-email.astro`) uses the constant `DEFAULT_NEXT_PATH = "/timers"`; `//evil.example` → `/timers`; explicit `next=/` still honored (test). No open-redirect surface added.
- `/dashboard`: reads only `Astro.locals.user`, no store/DB import; renders `AccountDetails` (email `break-all`, `Timers` → `TIMERS_HREF`, `Sign out`); smoke asserts no `savedDrill.id`, name, `Saved timers`, empty-list text with timers present.
- Identical 404 for foreign/unknown/non-UUID ids: `[id].astro`, `[id]/edit.astro` and API untouched apart from the `Back to timers` link in the 503 branch; smoke `verifyForeignSavedDrillPages` unchanged and now reads the list from `/timers`.
- Create → `/{id}`: `isSaveDrillResponse` requires a non-empty string `drill.id` (PUT also returns `savedDrillFromRow`, so edit is unaffected); id passed through `encodeURIComponent` (test with `//evil.example/?x#y` → `/%2F%2Fevil...`); double submit = 1 request + 1 navigation; edit during request still navigates; failure never navigates; edit mode never navigates and `reset()` is a no-op; `pageshow` bfcache handler registered only in create mode (`!keepAfterSave`). Scripted check: Back shows a usable form.
- Delete → `/timers` via imported `TIMERS_HREF` (no duplicate constant). `Back to timers` in `SavedDrillDetails`, `DrillEditLinks`, `DrillCreateForm` (`not_found`), `[id].astro`, `[id]/edit.astro`; only `AppTopBar.astro` email link still points at `/dashboard` (intended).
- Lint glob: `timers.astro` and `AccountDetails.astro` added to the timer-ui block; contract test pins `AccountDetails.astro`, `timers.astro`, `dashboard.astro`.
- `/dev/timer-ui`: `AccountDetails` fixtures (normal and long email, `h2`), create `saved` fixture removed and `saving` documented as the redirect state.
- Screenshots viewed: `timers-390-dark`, `dashboard-1280-light`, `fixtures-account-390-light`, `after-create-id-390-dark` — tokens only, long email wraps, no clipping.
- Overflow 414 px at 390 in `TimerUiPreview` fixtures: not a regression of this change. The diff does not touch `TimerUiPreview`; the only new block on `/dev/timer-ui` is the account section (`flex-col items-center p-4`, cards `w-full max-w-md`), which cannot exceed the viewport; the other fixture edits are text and one removed scenario.

## Findings

### F1 — Smoke markers for the account page are satisfied by the top bar

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:276, scripts/smoke.mjs:834, scripts/smoke.mjs:896, scripts/smoke.mjs:304
- **Detail**: The old marker `Dashboard` occurred only in the page itself. The new marker `markup.includes("Account")` also matches `<nav aria-label="Account">` in `AppTopBar.astro:22` (on every signed-in page), and `Sign out`, `href="/timers"` and the email are also in the bar. In `verifyAccountPageHasNoList` `visibleText` keeps `<title>Account</title>`, so `text.includes("Account")` is proven by the title, not by the `h1`. None of the steps proves that `AccountDetails` rendered (e.g. a `/dashboard` 200 with an empty `main` passes). The negative assertions (no list, no id/name) remain valid.
- **Fix**: Assert on the page body: `/<h1[^>]*>\s*Account\s*<\/h1>/` and `Signed in as` (in `verifyAccountPageHasNoList` and the three `Account` markers).
- **Decision**: PENDING

### F2 — Pending gates: CI smoke, default-next E2E, post-deploy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/timers-list-and-account/plan.md (Progress 2.5, 4.7, 4.9)
- **Detail**: Locally re-run: `npx astro sync`, `npm run lint`, `npm test` (215/215), contract tests, `astro check`, `node --check scripts/smoke.mjs`. The smoke can only run in CI (no local Mailpit); 2.5 (callback `next=/timers` without explicit `next`) is covered by the new smoke step `ensure(link.next === "/timers")` and by the Playwright check in `checks.json` (`default next lands on /timers`), but stays unchecked until CI. Manual items 1.6, 3.4, 4.8 are honestly labeled "script, not human".
- **Fix**: Tick 2.5 and 4.7 after the PR's `ci` and `smoke` jobs are green; 4.9 after deploy.
- **Decision**: PENDING

### F3 — Stale `dashboard` local names in the smoke

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/smoke.mjs:342, scripts/smoke.mjs:421, scripts/smoke.mjs:589, scripts/smoke.mjs:463, scripts/smoke.mjs:627
- **Detail**: Helpers were renamed (`timersText`, `timersMarkup`), but local variables `dashboard` / `dashboardMarkup` in `verifyCreatePage`, `verifyOwnSavedDrillPages`, `verifyForeignSavedDrillPages`, `timersText`, `timersMarkup` now hold the `/timers` response. Behaviour is correct; the names mislead the next reader of the smoke.
- **Fix**: Rename to `timers` / `timersMarkup` (text only).
- **Decision**: PENDING

### F4 — Create controller without `navigate` stays in `saving` forever

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/drill-create-controller.ts:110
- **Detail**: In create mode `navigate` is optional; `options.navigate?.(...)` without a port leaves the form locked in `saving` with no exit (pinned by the test "create without a navigate option never publishes saved"). Production always passes one through `useDrillCreate` (default `window.location.assign`), so today it is unreachable; it is a trap for a future caller of `createDrillCreateController`.
- **Fix**: Leave as is, or make `navigate` required when `keepAfterSave` is not set (type overload) — not needed for this PR.
- **Decision**: PENDING
