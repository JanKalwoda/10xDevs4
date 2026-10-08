<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Moduł 2, Lekcja 5 (10xDevs 4.0 UI)

**Do pracy nad interfejsem użytkownika w widoku, który już się renderuje, użyj `/10x-ui`.** Uruchamia ono wizualną
zmianę przez ten sam łańcuch co każdą inną zmianę (`/10x-new` → `/10x-research` →
`/10x-plan` → `/10x-implement` → `/10x-impl-review`) i uwzględnia zasady:
kiedy rozpocząć pracę i który widok wybrać, audyt obciążeń, kontrakt systemu projektowego w formie
zaimplementowanej w tym repozytorium, stany komponentów, bramkę zrzutów ekranu oraz zasadę, która
utrzymuje kolejnego agenta przy kontrakcie. W jego `references/` znajduje się lista kontrolna jakości.

Tworzenie widoku po raz pierwszy nie jest zadaniem dla `/10x-ui` — zbuduj go za pomocą
zwykłego łańcucha, a następnie wróć do niego z `/10x-ui`.

<!-- END @przeprogramowani/10x-cli -->

# Rules for AI

## Security & Configuration

Never commit `.env` or `.dev.vars`. `SUPABASE_URL` and `SUPABASE_KEY` are server-only Astro environment fields; provide them locally and as CI/Cloudflare secrets. New Supabase tables require timestamped migrations in `supabase/migrations/` with RLS and granular policies.

## Git Workflow

For each change:

1. If you are on other branch than 'main' continue on it.
2. If you are on 'main' branch than create a dedicated branch from `main`.
3. Implement and verify the change.
4. Commit the changes on that branch.
5. Open a pull request targeting `main`.
6. Merge the pull request after review and passing CI.

Do not commit changes directly to `main`.

## UI

- Design tokens: `src/styles/global.css` (`:root`, `.dark`, `@theme inline`). Every new color must have its own token. Never use hardcoded color values.
- Theme: Ocean Breeze from `https://tweakcn.com/r/themes/ocean-breeze.json`; original values and contrast adaptations are documented in `context/changes/ocean-breeze-theme/`. Preserve the readable primary text, validation red and dark muted text when updating the preset.
- Components: `src/components/ui`. Before creating a new component, check this directory. If a component is missing, add it from the shadcn registry.
- Top bar: `src/components/AppTopBar.astro` (mounted by `src/layouts/Layout.astro` unless `showTopBar={false}`, which the three auth pages pass) is the only place with the light/dark `ThemeToggle`; never add a toggle to a card header. It is sticky, `Layout.astro` and `AppTopBar.astro` are in the timer-ui lint scope, and page mains use `flex-1` (not `min-h-screen`) under the `flex min-h-dvh flex-col` body. `src/middleware.ts` sets `Cache-Control: private, no-store` on every HTML response without its own `Cache-Control` (`src/lib/html-cache-control.ts`), because the bar puts the email in the HTML. `/dev/timer-ui` renders the bar with `fixture` (static toggle) for guest, signed in and long email; extend those fixtures when the bar changes. Screenshots: `context/changes/app-top-bar/screenshots/`.
- Timer UI contract: use semantic tokens from `src/styles/global.css` and the Tailwind spacing/type/radius scale. No palette classes, inline literal colors or arbitrary colors/dimensions in timer components or their entry routes. Add missing primitives with `npx shadcn@latest add [name]`. `npm run lint` enforces this through `scripts/eslint-rules/timer-ui-contract.mjs`.
- Visual gate: `/dev/timer-ui` is development-only and reuses production components with deterministic fixtures. Inspect default, hover, focus-visible, disabled, error, empty (or justified N/A), and loading in light/dark at 1280/390 px; save and review screenshots in the change folder before accepting UI changes.

### Timer controls (Cancel, Restart, Pause/Resume)

- Keep Cancel enabled and accessibly named during initialization, active, paused, and pending Resume. Latch cancel intent synchronously and use the existing idempotent S06 teardown path before returning to configuration.
- Run view layout (`PhaseSections.tsx`, `DrillTimerView.tsx`, model `src/lib/drill-phase-sections.ts`): top to bottom time (or `Standby`), `Repetition X of N` (also in Preparation and Standby), Current (name, then time on its own line), Next (`role="group"`, larger "Next" label, then `Name · time`), the control bar, the status row, and warnings last in a fixed-height slot, so warnings never move the time or the bar. `role="timer"` stays on the number only; the Current time line and the repetition line keep a fixed height. The model derives everything from phase values, so Standby never leaks the wait. Fixtures: `PhaseSectionsFixtures.tsx` (including both warnings and the longest values); gate script and screenshots: `context/changes/run-view-layout/screenshots/` (`run-view-visual-gate.mjs`).
- Keep the timer bar below time, count, and repetition: Cancel/X left, Restart (`RotateCcw`, "Restart drill") in the middle, and Pause/Resume in the same right slot. All three are shared outline icon `Button`s, size-12 (48 px hitbox), accessibly named, with semantic tokens only; Pause/Resume stay in a fixed hitbox.
- Keep Restart enabled during initialization, active, paused, and pending Resume. It shares Cancel's synchronous intent latch and idempotent disposal, then the `/` owner (`DrillApp`) starts a fresh keyed run with new audio and Wake Lock resources created in the same gesture. Accept completion and intents only through the tested `drill-run-identity` guard; never reuse a retired run's refs, `DrillRun`, resume target, sampled wait, visibility subscription or resources.
- Timer visibility reads go through the `DrillVisibilityPort` (`src/lib/drill-visibility.ts`), not `document.hidden`, so the preview can control them.
- Extend the production-backed `/dev/timer-ui` fixtures (including the held-mounted Restart lifecycle gate with per-run resource bundles) whenever timer states or controls change; preserve the seven-state light/dark visual gate and the held-mounted lifecycle scenarios.
- `/create` (save a named timer) follows the timer UI contract (`create.astro` is in the lint scope). Its production-backed fixtures are `src/components/timer/CreateDrillFixtures.tsx` in `/dev/timer-ui`; extend them whenever `DrillCreateForm` states change.
- `/timers` (saved timers list, the signed-in landing page), `/dashboard` (account page: email, `Timers` link, `Sign out`, rendered by `AccountDetails.astro`, no database read), `/{id}` (saved timer, UUID only) and the shared 404 (`NotFoundView.astro`) follow the timer UI contract (`timers.astro`, `dashboard.astro`, `AccountDetails.astro`, `[id].astro`, `404.astro` are in the lint scope). Their production-backed fixtures are `src/components/timer/SavedDrillFixtures.tsx` in `/dev/timer-ui`; extend them whenever `SavedDrillList` or `SavedDrillDetails` states change; `AccountDetails` fixtures (normal and long email) live in `src/pages/dev/timer-ui.astro`. Saving a new timer on `/create` redirects to `/{id}` (the `saving` fixture is also the redirect state). Screenshots: `context/archive/2026-10-07-open-saved-drill/screenshots/` and `context/changes/timers-list-and-account/screenshots/` (`/timers`, `/dashboard`, create to `/{id}`, fixtures).
- `/{id}/edit` (edit one saved timer: the `/create` form prefilled, `PUT /api/drills/{id}`) follows the timer UI contract (`[id]/edit.astro` is in the lint scope; the `[id]` page files are listed as `src/pages/[[]id[]].astro` and `src/pages/[[]id[]]/edit.astro` because `[id]` is a minimatch character class, and `timer-ui-contract.test.mjs` pins that both files are linted). The `Edit timer` link lives in the `saved-drill-actions` slot of `SavedDrillDetails` (next to it the `Delete timer` action, see below). Production-backed fixtures: `src/components/timer/EditDrillFixtures.tsx` in `/dev/timer-ui` (edit form states and the `DrillEditApp` links) plus the details card in `SavedDrillFixtures.tsx`; extend them whenever `DrillCreateForm` edit props, `DrillEditApp` or the `Edit timer` action change. Foreign, unknown and non-UUID ids must stay one identical 404 on the page and in the API. Screenshots: `context/archive/2026-10-07-edit-saved-drill/screenshots/`.
- Delete (`DeleteDrillDialog` in the `saved-drill-actions` slot of `SavedDrillDetails`, `DELETE /api/drills/{id}`) follows the timer UI contract; `src/components/ui/alert-dialog.tsx` is in the lint scope and its overlay uses the `--overlay` token (never `bg-black/50`). The confirm button is the destructive `Button` with `text-destructive-foreground`, `dark:bg-destructive` and `dark:hover:bg-destructive/90` (the variant's `text-white` / `dark:bg-destructive/60` fail contrast in dark); the dialog is not dismissible by an outside click or while the request runs, and 404 counts as done. A Radix modal traps the page, so `/dev/timer-ui` shows one dialog state at a time: `DeleteDrillFixtures.tsx` (pick a state or load `?delete=<state>`; `SavedDrillDetails` takes inert `deletePorts` so the preview never deletes anything). Extend them whenever `DeleteDrillDialog` states change. A long saved-timer name must wrap in the `DrillApp` header (`SAVED_DRILL_HEADING_CLASS`). Screenshots: `context/archive/2026-10-07-delete-saved-drill/screenshots/`.

## Commands

@package.json
 after dependency upgrades; CI runs it against the production preview with a local Supabase.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

All pages are server-rendered by default. API routes must export `const prerender = false`.
@astro.config.mjs

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/timers.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

@.nvmrc
@README.md
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

@.github/workflows/ci.yml

`npx supabase test db` (pgTAP, `supabase/tests/database/`) covers table RLS, grants and constraints and runs in the `smoke` job; add a test there for every new table or policy.

## Account-entry UI

- Account-entry pages and the account links in the top bar use semantic tokens from src/styles/global.css and existing primitives from src/components/ui; avoid palette classes, literal colors, and arbitrary dimensions. npm run lint enforces this on the auth views and root shell. Keep visual evidence in context/archive/2026-10-03-enter-account-by-email-link/screenshots/.
