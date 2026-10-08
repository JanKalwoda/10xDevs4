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

- No new routes: `/timers` and the default `next=/timers` belong to S-17. The `Timers` link points to `/timers` as decided, so until S-17 merges it leads to the shared 404 (open question for the coordinator in the brief).
- No change to `/dashboard` content other than removing its `ThemeToggle` (S-17 turns it into the account page). Its "Dashboard" heading and `Sign out` button stay for the smoke steps.
- No change to the run view, signal preview, auth flow, API, database, `Topbar.astro`/`Welcome.astro`.
- No account-deletion, no email truncation tooltip beyond `truncate` plus `title`.

## Implementation Approach

Build one `AppTopBar.astro` and mount it from `Layout.astro` behind a `showTopBar` prop (default `true`; the three auth pages pass `false`). Fix the layout contract (body flex column, mains `flex-1`) in the same phase as the bar so no intermediate state has double scroll. Then remove the old nav and card toggles and make the callback button. Last, bring the verification harness (smoke, lint scope, `/dev/timer-ui` fixtures, screenshots, docs) in line. Three small phases, each green on its own.

## Phase 1: AppTopBar in Layout, layout contract and cache headers

### Overview

The bar exists on all barred pages with the toggle. The old floating nav and the card toggles are removed in the same phase, so no intermediate state shows two toggles or two navs.

### Changes Required:

#### 1. Top bar component

**File**: `src/components/AppTopBar.astro` (new)

**Intent**: Render the sticky bar from `Astro.locals.user`. Signed in: `<nav aria-label="Account">` with the email as a link to `/dashboard` (`truncate`, `min-w-0`, `title`), a `Timers` link to `/timers`, `ThemeToggle client:load`, and a `POST /api/auth/signout` form with an outline `Sign out` button. Guest: a `Sign in` link (`/auth/signin`, outline `buttonVariants`) and `ThemeToggle`. Semantic tokens only (`bg-background`, `border-b border-border`, `text-foreground`, `text-muted-foreground`), `sticky top-0 z-50`, Tailwind scale spacing, no arbitrary values or palette classes; `buttonVariants` + `cn` for links.

**Contract**: One `<nav aria-label="Account">` wrapper (smoke and a11y rely on the name); link texts exactly `Timers`, `Sign in`; email text is the link text; the form is `method="POST" action="/api/auth/signout"`. Left group shrinks (`min-w-0`), right group `shrink-0`, so 390 px never overflows.

#### 2. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Add `showTopBar?: boolean` (default `true`). When true render `AppTopBar` before the slot and always include `ThemeInit` (the bar's toggle needs the `.dark` class applied before paint), regardless of `enableTimerTheme`. Make `body` a `flex min-h-screen flex-col` (class on the element, in the page's own CSS-free way: Tailwind classes) while keeping the `html, body` height rule compatible.

**Contract**: `showTopBar` false ⇒ markup byte-identical to today except the body classes. The default `title` remains.

#### 3. Page mains

**Files**: `src/components/timer/DrillApp.tsx`, `DrillCreateApp.tsx`, `DrillEditApp.tsx`, `NotFoundView.astro`, `src/pages/dashboard.astro`, `src/pages/[id].astro`, `src/pages/[id]/edit.astro`

**Intent**: Replace `min-h-screen` with `flex-1` on the page `main` (keep `flex items-center justify-center px-4 py-8`), and remove the `ThemeToggle` import, the element and its balancing spacer from the card headers (`DrillApp`, `DrillCreateApp`, `DrillEditApp`, `dashboard.astro`), centering the headings.

**Contract**: Auth pages (`min-h-screen`, no bar) and `TimerUiPreview` keep `min-h-screen`.

#### 4. Entry routes

**Files**: `src/pages/index.astro`, `src/pages/create.astro`, `src/pages/404.astro` (already no-store), `signin.astro`, `confirm-email.astro`, `callback.astro`

**Intent**: `index.astro`: delete the `fixed` nav and the `accountLink`; set `Cache-Control: private, no-store`. `create.astro`: set the same header. Auth pages pass `showTopBar={false}`.

**Contract**: `Astro.response.headers.set("Cache-Control", "private, no-store")` as in `dashboard.astro`; `index.astro` stays `prerender = false` (check its current mode; SSR is the default).

#### 5. Lint scope

**File**: `eslint.config.js`

**Intent**: Add `src/components/AppTopBar.astro` to the timer-ui contract file list (it is the only new file with classes) and remove nothing; `index.astro` stays in both blocks.

### Success Criteria:

#### Automated Verification:

- Sync passes: `npx astro sync`
- Lint passes (contract covers `AppTopBar.astro`): `npm run lint`
- Unit tests pass: `npm test`
- Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- Type check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- On `/` at 390 px the bar does not overlap the card and the page does not scroll when the card fits.
- Guest bar shows `Sign in` + toggle; signed-in bar shows email, `Timers`, toggle, `Sign out`; the sign-in pages show no bar.
- The toggle switches light/dark everywhere and persists across pages.

**Implementation Note**: After this phase and all automated verification pass, report `[FAZA-1-OK]` to the coordinator and stop.

---

## Phase 2: Callback button and header tests

### Overview

`Back to the timer` becomes a button, and the cache/headers promises of Phase 1 get automated coverage where unit-testable.

### Changes Required:

#### 1. Callback page

**File**: `src/pages/auth/callback.astro`

**Intent**: Render `Back to the timer` as `<a href="/" class:list={[cn(buttonVariants({ variant: "outline" }), "w-full")]}>`, the same pattern as `confirm-email.astro`; import `buttonVariants` and `cn`. The label and `href` do not change.

**Contract**: Stays inside the account-entry contract (tokens only).

#### 2. Contract tests

**File**: `scripts/eslint-rules/timer-ui-contract.test.mjs`

**Intent**: Pin that `src/components/AppTopBar.astro` is linted by the timer-ui contract (like the existing `[id]` pin) and that a palette class in it fails.

**Contract**: Reuses the file's existing helper for "is file under the contract".

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- `/auth/callback` (confirm state and unavailable state) shows `Back to the timer` as an outline button, no top bar.

**Implementation Note**: Report `[FAZA-2-OK]` and stop.

---

## Phase 3: Smoke, `/dev/timer-ui` fixtures, screenshots, docs

### Overview

Bring the verification harness and the documentation in line with the bar.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Adapt `accountNavLinks`/`hasHomeAccountLink` and the four steps to the new bar: signed in ⇒ the `Account` nav has a link to `/dashboard` (text = the account email), a `Timers` link to `/timers`, and a `Sign out` form posting to `/api/auth/signout`; guest ⇒ `Sign in` → `/auth/signin`. Add checks that `/`, `/create`, the 404 and `/dashboard` answer `Cache-Control` containing `no-store`, that a guest `/` HTML contains no email, and that `/auth/signin` has no `nav[aria-label="Account"]`.

**Contract**: Helper stays dependency-free; the email comparison uses the smoke account's email already in scope.

#### 2. Preview fixtures

**File**: `src/components/timer/AppTopBarFixtures.tsx` (new), `src/components/timer/TimerUiPreview.tsx`

**Intent**: A preview section in `/dev/timer-ui` that renders the bar states: guest, signed in, long email (truncation at 390 px). `AppTopBar` is Astro and cannot be rendered by the React preview, so the fixture rebuilds the same markup from class constants exported by `src/components/timer/app-top-bar-classes.ts`, which `AppTopBar.astro` imports too; the preview cannot drift from production classes. Keep the seven-state gate and the held-mounted lifecycle scenarios untouched.

**Contract**: Class constants file exports `APP_TOP_BAR_CLASS`, `APP_TOP_BAR_LINK_CLASS`; both consumers import them, so the preview cannot drift from production.

#### 3. Screenshots and docs

**Files**: `context/changes/app-top-bar/screenshots/`, `AGENTS.md`, `README.md`

**Intent**: Save and review screenshots of the bar (guest, signed in, long email) in light/dark at 1280/390 plus `/`, `/dashboard` and 404 with the bar. Update `AGENTS.md` (UI section: the bar is the only theme toggle; Account-entry UI paragraph: root account link is now the bar, evidence path) and the README route notes if they mention the floating link.

### Success Criteria:

#### Automated Verification:

- Sync, lint, tests, contract tests, `npx astro check`, `npm run build` all pass (commands as in Phase 1).
- Smoke passes against local Supabase preview when available: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- Screenshots reviewed: bar contrast, focus-visible ring on links/buttons, no overflow at 390 px in both themes.
- `/dev/timer-ui` shows the bar fixtures; production `/dev/timer-ui` stays 404.

**Implementation Note**: Report `[FAZA-3-OK]` and stop.

---

## Testing Strategy

### Unit Tests:

- Contract test: `AppTopBar.astro` is linted and a literal color there is rejected.
- Existing suites unchanged (`npm test`).

### Integration Tests:

- `scripts/smoke.mjs`: bar links per session state, no email for guests, `no-store` on barred pages, no bar on `/auth/signin`.

### Manual Testing Steps:

1. Guest at 390 px on `/`: no overlap, toggle works.
2. Signed in: email link, `Timers`, `Sign out` (ends the session), long email truncates.
3. Scroll a tall page (`/create` at 390 px): bar stays on top.

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

### Phase 1: AppTopBar in Layout, layout contract and cache headers

#### Automated

- [ ] 1.1 Sync passes: `npx astro sync`
- [ ] 1.2 Lint passes (contract covers `AppTopBar.astro`): `npm run lint`
- [ ] 1.3 Unit tests pass: `npm test`
- [ ] 1.4 Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- [ ] 1.5 Type check passes: `npx astro check`
- [ ] 1.6 Build passes: `npm run build`

#### Manual

- [ ] 1.7 On `/` at 390 px the bar does not overlap the card and the page does not scroll when the card fits
- [ ] 1.8 Guest and signed-in bars show the right items; sign-in pages show no bar
- [ ] 1.9 The toggle switches light/dark everywhere and persists across pages

### Phase 2: Callback button and header tests

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Contract tests pass: `node --test scripts/eslint-rules/*.test.mjs`
- [ ] 2.3 Unit tests pass: `npm test`
- [ ] 2.4 Type check passes: `npx astro check`
- [ ] 2.5 Build passes: `npm run build`

#### Manual

- [ ] 2.6 `/auth/callback` shows `Back to the timer` as an outline button, no top bar

### Phase 3: Smoke, `/dev/timer-ui` fixtures, screenshots, docs

#### Automated

- [ ] 3.1 Sync, lint, tests, contract tests, `npx astro check` and `npm run build` pass
- [ ] 3.2 Smoke passes against local Supabase preview: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`

#### Manual

- [ ] 3.3 Screenshots reviewed: contrast, focus-visible, no overflow at 390 px in both themes
- [ ] 3.4 `/dev/timer-ui` shows the bar fixtures; production `/dev/timer-ui` stays 404
