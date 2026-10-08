<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sticky top bar with account and theme toggle (S-16)

- **Plan**: context/changes/app-top-bar/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

- Automated (re-run by the reviewer on 701b649): `npx astro sync` OK; `npm run lint` 0 errors / 0 warnings; `npm test` 208/208; `node --test scripts/eslint-rules/*.test.mjs` 6/6; `npx astro check` 0 errors (118 files); `npm run build` OK.
- Production preview (`astro preview`, guest) headers:
  - `/` 200 `text/html` `private, no-store`, one `nav[aria-label="Account"]`, no email (guest).
  - `/abc/def` 404 `private, no-store`, bar present; `/dev/timer-ui` 404 with no bar or fixtures.
  - `/create`, `/dashboard` guest 302 to `/auth/signin?next=…` (redirect untouched, keeps its own `private, no-store`).
  - `/auth/signin` and `/auth/callback` have no bar; callback keeps its own `no-store` (helper does not overwrite existing `Cache-Control`).
  - `POST /api/auth/signout` 302 with no `Cache-Control` added; `DELETE /api/drills/{uuid}` 401 `application/json` keeps its own `no-store` (no JSON regression).
- Code: `withPrivateNoStoreForHtml` only touches `text/html` without `Cache-Control`, try/catch for immutable headers, 4 unit tests. The guest redirect in `middleware.ts` returns before `next()`, so it is untouched.
- Layout: `body` is `flex min-h-dvh flex-col`, `height: 100%` moved to `html` only; all planned mains use `flex-1`; auth pages keep `min-h-screen` and pass `showTopBar={false}`. checks.json 1.8/1.9 confirm no extra scroll and the bar stays at top 0 after scrolling 885 px.
- ThemeToggle: both icons, chosen by `.dark` (`@custom-variant dark (&:is(.dark *))`); checks.json 1.11 shows the Sun visible on first paint with 6x CPU throttle; `ThemeInit` is now injected whenever the bar is shown.
- Lint contract: `AppTopBar.astro`, `Layout.astro` and `src/components/timer/**/*.astro` are in scope and pinned by a new contract test; no palette classes, literal colors or arbitrary values in the bar.
- Cleanup: no references to `Topbar`, `Welcome` or `bg-cosmic` remain in `src/`.
- Screenshots reviewed: `home-signed-in-390-dark`, `fixtures-topbar-390-dark`, `focus-visible-390-light`; no overflow at 390 px, focus ring visible, long email truncates.

## Findings

### F1 — Smoke with the new top-bar helpers has never run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:201-218, plan Progress 1.7 / 3.2
- **Detail**: `hasSignedInTopBar`, `verifyBarredPagesNoStore`, the guest "no email" + `no-store` checks and the remote "no Account nav on /auth/signin" check were never executed (1.7 and 3.2 are `[ ]`, no Mailpit locally). The first run will be the CI `smoke` job; the remote check also runs in the production deploy job. Reviewer verified the headers and nav markup by hand against the preview (guest only).
- **Fix**: Treat the green CI `smoke` job on the PR as the gate for 1.7/3.2 (do not merge before it passes) and tick both with the CI run link; if it fails, fix the helper rather than the assertion.
- **Decision**: ACCEPTED (coordinator): gate - do not merge before a green `smoke` job in CI; after green CI the coordinator ticks 1.7/3.2.

### F2 — Fixture toggle always shows Moon, production shows Sun in dark

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/AppTopBar.astro:197-200
- **Detail**: The static `fixture` button renders only `<Moon />`, while `ThemeToggle` renders Moon in light and Sun in dark. `fixtures-topbar-*-dark.png` therefore shows an icon production never shows in dark, so the visual gate does not cover the dark icon of the real toggle.
- **Fix**: In the fixture branch render both icons like `ThemeToggle` (`<Moon class="dark:hidden" />`, `<Sun class="hidden dark:block" />`) and re-shoot the two dark fixture screenshots.
- **Decision**: FIX: the fixture toggle renders both icons like `ThemeToggle` (`Moon className="dark:hidden"`, `Sun className="hidden dark:block"`; `className`, because `class` is dropped on a React component in `.astro`); fixture screenshots re-shot (light and dark).

### F3 — Smoke checks the sign-out form anywhere in the page, not in the bar

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:205
- **Detail**: `hasSignedInTopBar` matches `<form action="/api/auth/signout">` against the whole markup. On `/` only the bar has it, but if a page body ever gets its own form (e.g. `/dashboard` already does), the check would pass without a bar form.
- **Fix**: Match the form inside the `nav[aria-label="Account"]` block that `accountNavLinks` already extracts (return the nav inner HTML from a shared helper).
- **Decision**: FIX: `hasSignedInTopBar` looks for the sign-out form only inside the `nav[aria-label="Account"]` markup (new shared `accountNavMarkup` helper).

### F4 — `/dashboard` shows two Sign out buttons

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/dashboard.astro
- **Detail**: The bar's `Sign out` plus the card's `Sign out` (kept on purpose for the smoke steps, see "What We're NOT Doing"). Planned, but a visible duplicate until S-17.
- **Fix**: Record it in S-17 scope: remove the card button when `/dashboard` becomes the account page and switch the smoke sign-out step to the bar form.
- **Decision**: ACCEPTED (coordinator): two Sign out buttons on `/dashboard` stay until S-17.

### F5 — Short emails truncate at 390 px

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/AppTopBar.astro:185-191
- **Detail**: At 390 px even `shooter@example.com` becomes `shooter@exa…` (screenshots `home-signed-in-390-*`, `fixtures-topbar-390-*`). Within the plan (`truncate` + `title`), but `title` does not help on touch devices.
- **Fix**: Optional UX follow-up (e.g. tighter gaps or smaller ghost padding on the left group under `sm`); no change needed for S-16.
- **Decision**: ACCEPTED (coordinator): within the plan.

### F6 — Dev toolbar captured in home screenshots

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/app-top-bar/screenshots/home-signed-in-390-dark.png (and other home-* shots)
- **Detail**: The Astro dev toolbar overlays the card ("Play Standby signal" row), so part of the evidence is obscured.
- **Fix**: Re-shoot with the dev toolbar disabled (`devToolbar.enabled: false` via CLI/env or from `astro preview`).
- **Decision**: FIX: `home-*` screenshots re-shot from `astro preview` (production build) with the dev toolbar off.
