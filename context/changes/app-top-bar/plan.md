# Sticky top bar with account and theme toggle (S-16) Implementation Plan

## Overview

Every page except the sign-in pages gets one sticky top bar: signed-in users see their email (link to `/dashboard`), a `Timers` link (to `/timers`), the light/dark toggle and `Sign out`; guests see `Sign in` and the toggle. The bar replaces the floating account link in `src/pages/index.astro` (it overlaps the timer card on a phone) and the four per-card theme toggles. `Back to the timer` on the callback page becomes a button. No routes, no migrations. Decisions are fixed in `context/foundation/ux-fixes-plan.md` (S-16 and the decision table) and `context/foundation/roadmap.md` (S-16, FR-015).

## Current State Analysis

- `src/layouts/Layout.astro` has no chrome: only `Banner` config warnings and `<slot />`; `enableTimerTheme` injects `ThemeInit` (sets `.dark` before paint). `html, body { height: 100% }`.
- `src/pages/index.astro` renders a `fixed inset-x-0 top-0 z-50` `<nav aria-label="Account">` with one link (`Account` → `/dashboard`, or `Sign in` → `/auth/signin`) above `DrillApp`; this is what overlaps the card on a phone.
- `ThemeToggle` (`src/components/timer/ThemeToggle.tsx`, hook `useTimerTheme`) is rendered inside the card headers of `DrillApp.tsx:127`, `DrillCreateApp.tsx:28`, `DrillEditApp.tsx:38` and `dashboard.astro:32`. `useTimerTheme` starts with `theme = null` and sets it in an effect, so the first render has the generic label "Change color theme".
- Every page main uses `min-h-screen` (`DrillApp.tsx:120`, `DrillCreateApp.tsx:23`, `DrillEditApp.tsx:33`, `NotFoundView.astro:12`, `dashboard.astro:27`, `[id].astro:33`, `[id]/edit.astro:33`, auth pages). A sticky bar above such a main adds a bar-height of extra scroll.
- `src/pages/auth/callback.astro` ends with a text link `Back to the timer` (`confirm-email.astro` already uses `buttonVariants`).
- Cache: `dashboard.astro`, `[id].astro`, `[id]/edit.astro` and `404.astro` set `Cache-Control: private, no-store`; `index.astro` and `create.astro` do not. The email will now be in every barred HTML page.
- Lint: `eslint.config.js` has two blocks, account-entry contract (auth views + `index.astro`) and timer-ui contract (`src/components/timer/**`, entry routes, selected `ui/*`). Contract tests: `scripts/eslint-rules/*.test.mjs`.
- `scripts/smoke.mjs:176-198` finds the account link through `<nav aria-label="Account">` and checks the labels `Account` / `Sign in` (steps at ~L753, 789, 811, 825).
- `src/components/Topbar.astro` is the leftover starter bar (white/purple literals) used only by `Welcome.astro`, which no page renders. It is not reused and not touched.
- `/dev/timer-ui` (`src/pages/dev/timer-ui.astro` → `TimerUiPreview.tsx`) does not use `Layout`; it needs its own top-bar fixtures.

### Key Discoveries:

- `Astro.locals.user` is available in `.astro` layouts (middleware sets it for every request), so the bar needs no new data path.
- Sign out already exists as `POST /api/auth/signout` (form in `dashboard.astro`); reuse it as a form with an outline `Button`.
- Only `ThemeToggle` needs hydration; the rest of the bar is static Astro.
- The cure for the extra scroll is to stop sizing the page main by the viewport: `body` becomes `flex min-h-screen flex-col` and each page main uses `flex-1` instead of `min-h-screen`, so main = viewport minus bar.
- Foreign/unknown ids keep their identical 404; the bar on the 404 must be identical for all requesters of one session (it depends only on the session, never on the path).

## Desired End State

On `/`, `/create`, `/dashboard`, `/{id}`, `/{id}/edit` and the 404 a bar is stuck to the top at all scroll positions, on 390 px it never overlaps the card, and the page has no extra vertical scroll when the card fits. `/auth/signin`, `/auth/confirm-email`, `/auth/callback` have no bar. The only theme toggle is in the bar and works in both themes. `Back to the timer` on the callback page is a button. All barred pages answer `Cache-Control: private, no-store`. Verified by unit/contract tests, lint, build, smoke and screenshots (light/dark, 1280/390) in `context/changes/app-top-bar/screenshots/`.

## What We're NOT Doing

- No new routes: `/timers` and the default `next=/timers` belong to S-17. In S-16 the `Timers` link uses a constant `TIMERS_HREF = "/dashboard"` (today `/dashboard` is the saved-timers list); S-17 changes the constant to `/timers`.
- No change to `/dashboard` content other than removing its `ThemeToggle` (S-17 turns it into the account page). Its "Dashboard" heading and `Sign out` button stay for the smoke steps.
- No change to the run view, signal preview, auth flow, API or database.
- No account-deletion, no email tooltip beyond `truncate` plus `title`.

## Implementation Approach

Build one `AppTopBar.astro` (takes `user` as a prop) and mount it from `Layout.astro` behind `showTopBar` (default `true`; the three auth pages pass `false`). In the same phase fix the layout contract (`body` grows with `min-h-dvh`, `height: 100%` removed from `body`, page mains `flex-1`), remove the floating nav and the card toggles, add the middleware `no-store` guard and adapt the smoke, so every phase is green on its own. Phase 2 is the callback button. Phase 3 adds preview fixtures, screenshots, docs and the cleanup of the unused starter bar.

## Phase 1: AppTopBar in Layout, layout contract, no-store guard, smoke

### Overview

The bar exists on all barred pages with the toggle. The old floating nav and the card toggles are removed in the same phase, so no intermediate state shows two toggles or two navs, and the smoke is adapted here so it stays green.

### Changes Required:

#### 1. Top bar component

**File**: `src/components/AppTopBar.astro` (new), `src/lib/app-top-bar.ts` (new, exports `TIMERS_HREF = "/dashboard"`)

**Intent**: Render the sticky bar from a `user?: { email?: string | null } | null` prop. Signed in: `<nav aria-label="Account">` with the email as a link to `/dashboard` (`truncate`, `min-w-0`, `title`), a `Timers` link to `TIMERS_HREF`, `ThemeToggle client:load`, and a `POST /api/auth/signout` form with an outline `Sign out` button. Guest: a `Sign in` link (`/auth/signin`) and `ThemeToggle`. Optional `fixture` boolean prop: renders a static outline icon `Button` instead of the live island (used by `/dev/timer-ui` in Phase 3). Semantic tokens only, `sticky top-0 z-50`, `border-b border-border bg-background`, Tailwind scale spacing, no arbitrary values or palette classes.

**Contract**: One `<nav aria-label="Account">` (smoke and a11y rely on the name); link texts exactly `Timers`, `Sign in`; the form is `method="POST" action="/api/auth/signout"`. Left group `min-w-0`, right group `shrink-0`, so 390 px never overflows.

#### 2. ThemeToggle first paint

**File**: `src/components/timer/ThemeToggle.tsx`

**Intent**: Render both icons and choose with the `.dark` class (`Moon` with `dark:hidden`, `Sun` with `hidden dark:block`) so the server HTML matches `ThemeInit` without JS; keep the state-based `aria-label` after hydration.

**Contract**: Server and client markup identical (no hydration mismatch); token-only classes.

#### 3. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Add `showTopBar?: boolean` (default `true`); when true render `AppTopBar user={Astro.locals.user}` before the slot and always include `ThemeInit`. `body` gets `flex min-h-dvh flex-col`. In the scoped CSS remove `height: 100%` from `body` (keep `margin: 0; width: 100%`; `html` may keep `height: 100%`), otherwise `height: 100%` wins over `min-height` and the sticky bar leaves after one viewport.

**Contract**: `showTopBar` false gives markup equal to today's except the body classes.

#### 4. Page mains

**Files**: `src/components/timer/DrillApp.tsx`, `DrillCreateApp.tsx`, `DrillEditApp.tsx`, `NotFoundView.astro`, `src/pages/dashboard.astro`, `src/pages/[id].astro`, `src/pages/[id]/edit.astro`

**Intent**: Replace `min-h-screen` with `flex-1` on the page `main`, and remove the `ThemeToggle` import, element and balancing spacer from the card headers (`DrillApp`, `DrillCreateApp`, `DrillEditApp`, `dashboard.astro`), centering the headings. Auth pages and `TimerUiPreview` keep `min-h-screen`.

#### 5. Entry routes

**Files**: `src/pages/index.astro`, `signin.astro`, `confirm-email.astro`, `callback.astro`

**Intent**: `index.astro`: delete the `fixed` nav, `accountLink` and now-unused imports. Auth pages pass `showTopBar={false}`.

#### 6. Cache guard

**Files**: `src/middleware.ts`, `src/lib/html-cache-control.ts` (new) + `src/lib/html-cache-control.test.ts` (new)

**Intent**: The email is in the HTML of every barred page, so the middleware sets `Cache-Control: private, no-store` on every `text/html` response that has no `Cache-Control` yet. The logic lives in a helper `withPrivateNoStoreForHtml(response)` that tolerates immutable headers (try/catch, returns the response unchanged). Page-level headers stay as documentation.

**Contract**: `middleware.ts` does `const response = await next(); return withPrivateNoStoreForHtml(response)`; the guest redirect response is untouched. Tests: html without header gets it; html with `Cache-Control` keeps its own; JSON/other types untouched; immutable headers do not throw.

#### 7. Lint scope

**File**: `eslint.config.js`, `scripts/eslint-rules/timer-ui-contract.test.mjs`

**Intent**: Add `src/layouts/Layout.astro` and `src/components/AppTopBar.astro` to the timer-ui list, widen `src/components/timer/**/*.{ts,tsx}` to `{ts,tsx,astro}` (so `NotFoundView.astro` is linted) and pin all three with `calculateConfigForFile`, next to the existing `[id]` pin. `Layout.astro` and `AppTopBar.astro` must pass (fix any literal class found).

#### 8. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Adapt `accountNavLinks`/`hasHomeAccountLink` and the four steps (~L753, 789, 811, 825): signed in means the `Account` nav has the email link to `/dashboard`, `Timers` → `/dashboard`, and a `Sign out` form posting to `/api/auth/signout`; guest means `Sign in` → `/auth/signin`. Add: `/`, `/create`, the 404 and `/dashboard` answer `Cache-Control` with `no-store`; a guest `/` has no email; `/auth/signin` has no `nav[aria-label="Account"]`.

### Success Criteria:

#### Automated Verification:

- Sync passes: `npx astro sync`
- Lint passes: `npm run lint`
- Unit tests pass (incl. the cache helper): `npm test`
- Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- Smoke passes against local Supabase preview: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- On `/` at 390 px the bar does not overlap the card and the page does not scroll when the card fits.
- Scroll `/create` at 390 px to the bottom: the bar stays at the top.
- Guest and signed-in bars show the right items; sign-in pages show no bar.
- The toggle switches light/dark everywhere and persists across pages; in dark mode after a hard reload with CPU throttling the icon is correct on first paint.

**Implementation Note**: Report `[FAZA-1-OK]` to the coordinator and stop.

---

## Phase 2: Callback button

### Overview

`Back to the timer` becomes a button.

### Changes Required:

#### 1. Callback page

**File**: `src/pages/auth/callback.astro`

**Intent**: Render `Back to the timer` as `<a href="/" class:list={[cn(buttonVariants({ variant: "outline" }), "w-full")]}>`, the pattern of `confirm-email.astro`; import `buttonVariants` and `cn`. Label and `href` do not change.

**Contract**: Stays inside the account-entry contract (tokens only).

### Success Criteria:

#### Automated Verification:

- Lint, unit tests, contract tests, `npx astro check` and `npm run build` pass (commands as in Phase 1).

#### Manual Verification:

- `/auth/callback` (confirm and unavailable state) shows `Back to the timer` as an outline button, no top bar.

**Implementation Note**: Report `[FAZA-2-OK]` and stop.

---

## Phase 3: Preview fixtures, screenshots, docs, cleanup

### Overview

Bring the visual gate and the documentation in line with the bar and remove the unused starter bar.

### Changes Required:

#### 1. Preview fixtures

**File**: `src/pages/dev/timer-ui.astro`

**Intent**: In the dev branch, above `<TimerUiPreview client:load />`, render the production `AppTopBar` with fixture users: guest, signed in, long email (truncation at 390 px), with `fixture` set (static toggle, so `?theme=dark` stays deterministic). A wrapper makes the sticky bars non-sticky in the preview. The `!isDevelopment` 404 branch keeps rendering nothing.

#### 2. Screenshots and docs

**Files**: `context/changes/app-top-bar/screenshots/`, `AGENTS.md`, `README.md`

**Intent**: Save and review screenshots (guest, signed in, long email; `/`, `/dashboard`, 404) light/dark at 1280/390. `AGENTS.md`: the bar is the only theme toggle, Account-entry UI paragraph updated, `Layout.astro`/`AppTopBar.astro`/middleware cache guard noted; README only if it mentions the floating link.

#### 3. Cleanup commit

**Files**: `src/components/Topbar.astro`, `src/components/Welcome.astro`, `.bg-cosmic` in `src/styles/global.css`

**Intent**: A separate `chore` commit deletes the unused starter bar, its only consumer `Welcome.astro` and the `.bg-cosmic` utility, after a grep proves nothing imports them.

### Success Criteria:

#### Automated Verification:

- Sync, lint, tests, contract tests, `npx astro check` and `npm run build` pass; grep finds no import of `Topbar`/`Welcome`/`bg-cosmic`.
- Smoke passes against local Supabase preview.

#### Manual Verification:

- Screenshots reviewed: contrast, focus-visible, no overflow at 390 px in both themes.
- `/dev/timer-ui` shows the bar fixtures; production `/dev/timer-ui` stays 404.

**Implementation Note**: Report `[FAZA-3-OK]` and stop.

---

## Testing Strategy

### Unit Tests:

- `html-cache-control.test.ts` (helper cases listed in Phase 1).
- Contract test pins: `Layout.astro`, `AppTopBar.astro`, `NotFoundView.astro` are under the timer-ui contract.

### Integration Tests:

- `scripts/smoke.mjs`: bar links per session state, no email for guests, `no-store` on barred pages, no bar on `/auth/signin`.

### Manual Testing Steps:

1. Guest at 390 px on `/`: no overlap, toggle works.
2. Signed in: email link, `Timers`, `Sign out` (ends the session), long email truncates.
3. Scroll `/create` at 390 px to the bottom: bar stays on top.

## Performance Considerations

One extra island (`ThemeToggle`) per page, already hydrated on most pages; the bar adds no data fetch.

## Migration Notes

None (no database or API change). Rollback is a revert of the three commits.

## References

- Decisions: `context/foundation/ux-fixes-plan.md` (S-16), `context/foundation/roadmap.md` (S-16)
- Floating nav to replace: `src/pages/index.astro`
- Button-link pattern: `src/pages/auth/confirm-email.astro`
- Cache header pattern: `src/pages/dashboard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: AppTopBar in Layout, layout contract, no-store guard, smoke

#### Automated

- [x] 1.1 Sync passes: `npx astro sync` — da06029
- [x] 1.2 Lint passes: `npm run lint` — da06029
- [x] 1.3 Unit tests pass (incl. the cache helper): `npm test` — da06029
- [x] 1.4 Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs` — da06029
- [x] 1.5 Type check passes: `npx astro check` — da06029
- [x] 1.6 Build passes: `npm run build` — da06029
- [ ] 1.7 Smoke passes against local Supabase preview: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` (NOT RUN: no Mailpit locally; helpers and headers verified by hand against the preview with an admin-generated session)

#### Manual

- [ ] 1.8 On `/` at 390 px the bar does not overlap the card and the page does not scroll when the card fits
- [ ] 1.9 Scroll `/create` at 390 px to the bottom: the bar stays at the top
- [ ] 1.10 Guest and signed-in bars show the right items; sign-in pages show no bar
- [ ] 1.11 The toggle switches light/dark everywhere and persists; the icon is correct on first paint in dark mode

### Phase 2: Callback button

#### Automated

- [x] 2.1 Lint, unit tests, contract tests, `npx astro check` and `npm run build` pass — edcedae

#### Manual

- [ ] 2.2 `/auth/callback` shows `Back to the timer` as an outline button, no top bar

### Phase 3: Preview fixtures, screenshots, docs, cleanup

#### Automated

- [ ] 3.1 Sync, lint, tests, contract tests, `npx astro check` and `npm run build` pass; no import of `Topbar`/`Welcome`/`bg-cosmic`
- [ ] 3.2 Smoke passes against local Supabase preview

#### Manual

- [ ] 3.3 Screenshots reviewed: contrast, focus-visible, no overflow at 390 px in both themes
- [ ] 3.4 `/dev/timer-ui` shows the bar fixtures; production `/dev/timer-ui` stays 404
