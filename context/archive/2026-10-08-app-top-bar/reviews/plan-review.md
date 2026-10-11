<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Sticky top bar with account and theme toggle (S-16)

- **Plan**: context/changes/app-top-bar/plan.md
- **Mode**: Deep
- **Date**: 2026-10-08
- **Verdict**: REVISE
- **Findings**: 1 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (`Layout.astro`, `index.astro`, `create.astro`, `404.astro`, `callback.astro`, `DrillApp.tsx`, `eslint.config.js`, `scripts/smoke.mjs`, `TimerUiPreview.tsx`), 6/6 symbols ✓ (`accountNavLinks`, `hasHomeAccountLink`, `useTimerTheme`, `ThemeInit`, `POST /api/auth/signout`, `Cache-Control` pattern in `dashboard.astro`), brief↔plan ✓. Progress↔Phase ✓ (3 phases, 9+6+4 criteria mirrored). Code verification was done inline (no sub-agent): `src/layouts/Layout.astro`, `src/styles/global.css`, `src/middleware.ts`, `scripts/eslint-rules/timer-ui-contract.mjs`, `src/pages/dev/timer-ui.astro`, `src/components/hooks/useTimerTheme.ts`.

## Findings

### F1 — `html, body { height: 100% }` unsticks the bar after one viewport of scroll

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 2 (Layout)
- **Detail**: The plan keeps the scoped rule `html, body { height: 100% }` in `src/layouts/Layout.astro:44-50` ("keeping the html, body height rule compatible") and adds `flex min-h-screen flex-col` to `body`. `height: 100%` wins over `min-height`, so `body` is exactly one viewport tall and taller content (`/create` at 390 px, the dashboard list) overflows it. A `position: sticky` element can never leave its containing block, here `body`, so after scrolling ≈ one viewport the bar scrolls away. This breaks the Desired End State ("stuck to the top at all scroll positions") and Manual Testing step 3; nothing in the plan says to change the rule.
- **Fix**: In Phase 1 change 2, state explicitly: remove `height: 100%` from `body` (keep `margin: 0; width: 100%`; `html` may keep `height: 100%`) and let `body` grow with `min-h-screen` (or `min-h-dvh`, see F9); add a manual check "scroll `/create` at 390 px to the bottom, the bar stays at the top".
- **Decision**: FIXED — body `height: 100%` removed, `min-h-dvh`, scroll check added (Phase 1 change 3, step 1.9)

### F2 — `no-store` set page by page; every future page with the bar can leak the email

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, change 4 (Entry routes); Phase 3 smoke
- **Detail**: The bar is on by default for every page using `Layout` (`showTopBar` defaults to `true`), so the email lands in the HTML of any page that renders it, but the cache guard is a per-page `Astro.response.headers.set(...)` that each page must remember. S-17 already adds `/timers` and rewrites `/dashboard`; any page that forgets the header (or a future page) silently becomes cacheable HTML with the email. Today the guard is correct for the listed pages (`dashboard`, `[id]`, `[id]/edit`, `404` already set it; plan adds `/` and `/create`), and the plan's smoke check covers only those four URLs. The header cannot be set from `AppTopBar`/`Layout` reliably (component frontmatter runs after the page and may be streamed), but `src/middleware.ts` already runs for every request and knows `locals.user`.
- **Fix A ⭐ Recommended**: In `src/middleware.ts`, after `const response = await next()`, set `Cache-Control: private, no-store` on every `text/html` response that has no `Cache-Control` yet (or at least whenever `locals.user` is set); keep the explicit headers in pages as documentation; smoke keeps its per-route checks.
  - Strength: One guard for all present and future barred pages (including S-17 `/timers`); the bar default (`true`) and the cache default become consistent.
  - Tradeoff: Also disables caching of guest HTML (no measurable cost: SSR Worker responses are not edge-cached today); touches the middleware, which is outside the plan's file list.
  - Confidence: HIGH — Astro middleware may mutate `response.headers` of the `next()` response; the middleware already resolves the user per request.
  - Blind spot: Responses built with immutable headers (e.g. a raw `Response.redirect`) would throw on `set`; guard with the content-type check or `try`.
- **Fix B**: Keep the per-page headers as planned, but add a smoke step that walks every barred route as a signed-in user and asserts `no-store`, plus an `AGENTS.md` rule "every page with the bar sets `private, no-store`".
  - Strength: No middleware change; matches the existing pattern in `dashboard.astro`.
  - Tradeoff: Relies on the next agent remembering a rule; a missed page is caught only by smoke (CI `smoke` job), never by lint.
  - Confidence: MED — works today, regression-prone with S-17.
  - Blind spot: Pages added later are not in the smoke list unless someone adds them.
- **Decision**: FIXED (Fix A) — middleware guard + helper + unit test (Phase 1 change 6)

### F3 — `Timers` link ships a dead link to production until S-17 (question a)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1, change 1; What We're NOT Doing; brief Open Risks
- **Detail**: CI deploys on every push to `main` (`.github/workflows/ci.yml`, job `deploy`), so after merging S-16 every signed-in user sees `Timers` → the shared 404 ("This page does not exist or is not yours") in production until S-17 merges. "Merge S-16 and S-17 back to back" cannot prevent that window. The ux-fixes-plan already assigns the bar's `Timers` link to S-17 ("link „Timers" w pasku" in the S-17 scope), so S-17 will touch it anyway. Today `/dashboard` is the saved-timers list, so it is the correct interim target.
- **Fix A ⭐ Recommended**: Render `Timers` with `href="/dashboard"` in S-16 from one constant (e.g. `TIMERS_HREF`), test it in smoke as `/dashboard`, and let S-17 change the constant to `/timers` when it creates the route.
  - Strength: The bar has its final shape and labels now (screenshots, fixtures, smoke stay valid), no 404 in production, S-17 changes one value.
  - Tradeoff: Until S-17, email and `Timers` both lead to `/dashboard`.
  - Confidence: HIGH — `/dashboard` is the protected saved-timers list today.
  - Blind spot: None significant.
- **Fix B**: Omit the `Timers` link in S-16 and let S-17 add it together with the route.
  - Strength: No duplicate link, no dead link.
  - Tradeoff: S-16 screenshots/fixtures/smoke for the signed-in bar must be redone in S-17; departs from the fixed bar contents in the decision table.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — `TIMERS_HREF = /dashboard`, S-17 switches it (Phase 1 change 1, smoke)

### F4 — Theme hydration risk is named but not mitigated; the bar shows the wrong icon in dark mode before hydration

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1 (ThemeToggle in the bar); brief "Key risk"
- **Detail**: The brief and ux-fixes-plan list "hydratacja motywu (`theme` null na pierwszym renderze)" as a key risk, but no phase handles it. `ThemeToggle` derives `nextTheme = theme === "dark" ? "light" : "dark"`, so with `theme = null` the server HTML always renders the `Moon` icon and the generic label "Change color theme". `ThemeInit` paints the page dark before load, so in dark mode every barred page now shows a Moon (= "switch to dark") until `client:load` hydrates and the `queueMicrotask` update lands; on a slow phone this is a visible flicker on every navigation, now on every page instead of four card headers.
- **Fix**: Render both icons in `ThemeToggle` and pick them with the `.dark` class (`Moon` with `dark:hidden`, `Sun` with `hidden dark:block`), so first paint matches `ThemeInit` without JS; keep the state-based `aria-label` after hydration. Add a manual check "dark mode, hard reload with CPU throttling: icon is correct on first paint". If rejected, record the flicker as accepted in the plan.
  - Strength: Fixes the first paint for all pages with token-only classes; no hydration mismatch (server and client markup identical).
  - Tradeoff: Small change to a shared component used by the preview.
  - Confidence: HIGH — `ThemeInit` sets `.dark` on `<html>` before paint.
  - Blind spot: The label stays generic until hydration (acceptable; screen readers rarely act before hydration).
- **Decision**: FIXED — both icons switched by `.dark` (Phase 1 change 2, step 1.11)

### F5 — Preview fixtures rebuild the bar markup by hand and a live `ThemeToggle` breaks the deterministic `?theme=` gate (question c)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3, change 2 (Preview fixtures)
- **Detail**: (1) Shared class constants (`APP_TOP_BAR_CLASS`, `APP_TOP_BAR_LINK_CLASS`) keep only classes in sync; the structure (nav name, order, `min-w-0`/`shrink-0` groups, `title`, form) is duplicated in React and can drift — exactly what the preview is meant to prevent. `src/pages/dev/timer-ui.astro` is itself an Astro page, so it can render the production `AppTopBar.astro` directly if the bar takes the user as a prop (`Layout` passes `Astro.locals.user`). (2) `useTimerTheme` toggles `.dark` on `<html>` in its mount effect from localStorage/system preference; `/dev/timer-ui` has no `ThemeInit` and sets the theme from `?theme=dark` (`timer-ui.astro:9-14`). Mounting a live `ThemeToggle` in the preview (either fixture approach) overrides `?theme=` and makes the light/dark screenshots non-deterministic.
- **Fix**: Give `AppTopBar.astro` a `user?: { email?: string } | null` prop (Layout passes `Astro.locals.user`) and an `inertToggle`/fixture flag; render the guest, signed-in and long-email bars from `timer-ui.astro` (dev branch, above `<TimerUiPreview client:load />`) with fixed fake emails, and in fixture mode render a static outline icon `Button` instead of the live island. Drop `app-top-bar-classes.ts` and `AppTopBarFixtures.tsx`. Verify `?theme=dark` still yields dark screenshots.
  - Strength: The preview is the production component (zero drift, no extra constants module); the existing seven-state gate stays deterministic.
  - Tradeoff: The bar fixtures live in the Astro page, not in the React preview tree; sticky bars inside the preview need a wrapper section (or a non-sticky fixture flag).
  - Confidence: MED — not prototyped; Astro components accept props in dev pages without restrictions.
  - Blind spot: The dev page's `!isDevelopment` 404 branch must keep rendering nothing (CI checks `/dev/timer-ui` → 404).
- **Decision**: FIXED — production `AppTopBar` with `user` prop and `fixture` flag in `dev/timer-ui.astro` (Phase 1 change 1, Phase 3 change 1)

### F6 — Phases are not green on their own: smoke breaks between Phase 1 and Phase 3; Phase 2 overview promises header tests it lacks

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach; Phase 1; Phase 2 Overview; Phase 3 change 1
- **Detail**: Phase 1 removes the `Account` link from `index.astro`, but `scripts/smoke.mjs:753,789,811` still require `hasHomeAccountLink(markup, "Account", "/dashboard")` until Phase 3, so the smoke is red after Phases 1–2 (contradicting "Three small phases, each green on its own"). Phase 2 Overview says "the cache/headers promises of Phase 1 get automated coverage", but Phase 2 contains only the callback button and a lint pin; header checks are in Phase 3 smoke. "Implementation Approach" says the nav and toggles are removed after the bar ("Then remove…"), while Phase 1 removes them in the same phase.
- **Fix**: Move the smoke changes (Phase 3 change 1) into Phase 1 and add `SMOKE_MODE=local … npm run smoke` to Phase 1 automated criteria; correct the Phase 2 overview and the Implementation Approach sentence.
- **Decision**: FIXED — smoke moved to Phase 1 with step 1.7; Phase 2 and Approach corrected

### F7 — Lint scope misses files whose classes change

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 5 (Lint scope); Phase 2, change 2
- **Detail**: The plan calls `AppTopBar.astro` "the only new file with classes", but `Layout.astro` gains body classes and is in no contract block, and `NotFoundView.astro` (edited in Phase 1) is not linted at all: the glob `src/components/timer/**/*.{ts,tsx}` skips `.astro`. `app-top-bar-classes.ts` would be covered (the rule checks every string `Literal`).
- **Fix**: Add `src/layouts/Layout.astro` to the timer-ui list and widen the glob to `src/components/timer/**/*.{ts,tsx,astro}`; pin both with `calculateConfigForFile` in `timer-ui-contract.test.mjs` next to the `[id]` pin.
- **Decision**: FIXED — `Layout.astro`, `AppTopBar.astro`, glob `{ts,tsx,astro}` and pins (Phase 1 change 7)

### F8 — Unused `Topbar.astro` beside the new `AppTopBar.astro` (question b)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: What We're NOT Doing; Current State Analysis
- **Detail**: Leaving `src/components/Topbar.astro` untouched is consistent with the scope, but after S-16 two "top bar" components sit side by side, and the unused one (rendered only by the never-used `Welcome.astro`) is full of palette/arbitrary classes (`bg-purple-500/20`, `h-[350px]`) and the hex `.bg-cosmic` utility in `global.css`. A later agent searching for "Topbar" may extend the wrong one, contrary to the AGENTS.md rule "check before creating a new component".
- **Fix**: Acceptable to leave for S-16; preferably delete `Topbar.astro`, `Welcome.astro` and the `.bg-cosmic` utility in a separate commit (or a tiny chore PR) after grepping that nothing imports them.
- **Decision**: FIXED — `Topbar.astro`, `Welcome.astro`, `.bg-cosmic` removed in a separate `chore` commit in Phase 3

### F9 — `min-h-screen` (100vh) on the body still overscrolls on real phones

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 1, change 2; Manual 1.7
- **Detail**: `min-h-screen` is `100vh`, which on mobile browsers equals the largest viewport (URL bar hidden), so on a real phone the page still scrolls by the browser-chrome height even when the card fits; a 390 px desktop emulation will not show it. The `flex-1` mains approach is otherwise sound (Astro islands are `display: contents`, so the `main` inside `DrillApp` is a flex item of `body`).
- **Fix**: Use `min-h-dvh` on `body` (Tailwind scale class, no arbitrary value) and keep the 390 px check; mention it in the plan.
- **Decision**: FIXED — `min-h-dvh` (Phase 1 change 3)
