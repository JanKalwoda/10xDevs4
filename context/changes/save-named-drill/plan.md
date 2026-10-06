# Save a Named Drill Configuration (S-10) Implementation Plan

## Overview

A signed-in user opens `/create`, names a timer, enters the same parameters as the default timer (preparation, exercise, rest, repetitions, random start) and saves it as a private row in a new Supabase table. Ownership is enforced by the database itself (RLS per operation, FK to `auth.users`, unique name per user, name length 1–200, at most 50 rows per user, CHECKs mirroring the timer's validation). Guests and signed-in users keep the unchanged default timer at `/`. Listing, opening, editing and deleting (S-11..S-13) are out of scope, but the data model and DTOs are shaped for them. Phase colors are deferred with S-05: no color column.

## Current State Analysis

- No migrations and no tables exist: `supabase/` holds only `config.toml` and email templates; `supabase/migrations/` does not exist. Project id `10x-astro-starter`, DB port 55322, `db.seed` points to a missing `./seed.sql` (harmless today).
- Auth is cookie-based SSR (`src/lib/supabase.ts:7`); `src/middleware.ts:6` protects routes by `startsWith` over `PROTECTED_ROUTES = ["/dashboard"]` and redirects guests with `signInUrlForProtectedPath` (`src/lib/email-auth.ts:136`). `context.locals.user` is set from `supabase.auth.getUser()` (verified, not just decoded).
- Timer validation lives in `src/lib/drill-timer.ts:28` (`parseDrillConfig`: m:ss strings; preparation 0–600 s, exercise 1–600 s, rest 0–600 s, repetitions 1–100; the numbers 600 and 100 are inline literals). `DrillConfiguration` is in `src/types.ts:1`.
- API convention: `src/pages/api/auth/*.ts` export `prerender = false` and uppercase handlers; zod is used in `src/lib/email-auth.ts`. There is no `src/lib/services/` directory yet and the `npm test` glob (`node --test src/lib/*.test.ts`, `package.json`) would NOT pick up tests in a subdirectory. `lib` tests import with relative paths and `.ts` extensions (no `@/` alias under `node --test`).
- UI: `DrillConfigForm.tsx` already renders all parameter fields, validation and signal preview, with a hard-coded `Start` button; `src/components/ui` has `alert`, `button`, `card`, `checkbox`, `input`, `label`. The timer UI contract (`scripts/eslint-rules/timer-ui-contract.mjs`) is enforced on `src/components/timer/**`, `index.astro`, `dev/timer-ui.astro`. `/dev/timer-ui` (`TimerUiPreview.tsx`, 1278 lines) is the visual gate.
- `/dashboard` is still the starter stub with hard-coded palette classes (outside the contract); S-11 will rebuild it.
- CI `smoke` job starts a local Supabase (migrations auto-applied by `supabase start`) and runs `scripts/smoke.mjs` (form-encoded requests only, cookie jar, Mailpit sign-in). A local Supabase stack for `10x-astro-starter` is already running on this machine and is **shared by every worktree** (same project id and ports).
- The PRD text of FR-010 still mentions phase colors; the roadmap (2026-10-07) overrides it for S-10. `prd.md` is not edited here.

## Desired End State

- `supabase/migrations/20261007120000_create_drill_configurations.sql` creates `public.drill_configurations` with RLS and the guarantees below; a pgTAP suite proves them and runs in CI.
- `POST /api/drills` (JSON) saves a drill for the signed-in user and returns a `SavedDrill` DTO; every failure returns an English message with a stable `code`.
- `/create` is protected (guest → `/auth/signin?next=%2Fcreate`), shows the form, saves, confirms, and handles duplicate name, limit, validation, session loss and "saving unavailable".
- `/dashboard` links to `/create`; `/` is untouched.
- If the table does not exist yet (production before `db push`): every page, including `/create`, still renders; only `POST /api/drills` answers `503` with an English message.
- Verify end to end: `npm test`, `npm run lint`, rule tests, `npx astro check`, `npm run build`, `supabase test db`, local smoke (extended), and screenshot review of the `/create` fixtures in `/dev/timer-ui`.

### Key Discoveries:

- `context.locals.user` comes from `getUser()` in the middleware (`src/middleware.ts:14`), so the handler can use `locals.user.id` as `user_id` and the DB default `auth.uid()` plus RLS `WITH CHECK` is a second, independent guard.
- `parseDrillConfig` (`src/lib/drill-timer.ts:28`) already produces the user-facing English field errors; reusing it for the API makes it the single rule source (the form and the server cannot drift).
- Supabase grants `anon`/`authenticated` privileges on new `public` tables by default; "anon has no access" needs an explicit `revoke`, not only the absence of policies.
- A `BEFORE INSERT` row trigger runs before the RLS `WITH CHECK`; a naive count-then-insert trigger is racy for concurrent requests of the same user, so it takes a per-user advisory transaction lock.
- `node --test src/lib/*.test.ts` skips `src/lib/services/`; the script must be extended or service tests silently never run.

## What We're NOT Doing

- `/dashboard` list, `/{id}` details, running a saved drill, edit, delete (S-11, S-12, S-13). No read/update/delete endpoints and no `[id].ts` route; RLS policies for select/update/delete exist and are tested in the database only.
- Phase colors (S-05): no color column, no color UI.
- Any production `supabase db push`, deploy, or secret change (coordinator does `db push` before merge).
- Changing the timer at `/`, its tests, the existing `/dev/timer-ui` fixtures or audio/wake-lock behavior.
- Supabase generated types, a Supabase JS integration test harness, rate limiting, soft delete, name normalisation beyond trim.
- Rewriting the `/dashboard` stub (only one link is added) and editing `prd.md`.

## Implementation Approach

Database first, because it is the security boundary and everything else is a thin client of it. Then a pure, port-based service (testable with `node --test`, no Supabase import) behind one JSON route, then the UI as a hook + presentational view so `/dev/timer-ui` can render every state deterministically from production components. Each phase ends green on its own and is committed separately (migration, API, UI, visual gate are separate commits, per `src/AGENTS.md`).

Resolved decisions (from the planning interview and from repo conventions):

- Name uniqueness is case-insensitive and trim-based: unique index on `(user_id, lower(name))` plus a `name = btrim(name)` check (interview answer; deviates knowingly from the literal `(user_id, name)` in the brief).
- Entry point: a link on the `/dashboard` stub. After a successful save the user stays on `/create`, sees `Saved "<name>".`, the name field clears and parameters stay (interview answers).
- Tests: pgTAP via `supabase test db` (local and CI) plus extended smoke steps for the API (interview answer).
- API wire format (planner decision): JSON body with the same m:ss strings the form uses plus `name`; the server runs `parseDrillConfig` and stores seconds. Alternative (numbers on the wire) rejected because it duplicates the rules; S-12 will convert seconds back with the existing `formatPhaseTime`.
- Route, not an Astro action: matches `src/pages/api/auth/*`; `Content-Type: application/json` is required (`415` otherwise) so a cross-site form post cannot reach the cookie-authenticated handler.
- Table name `drill_configurations` (matches the `DrillConfiguration` type).

## Phase 1: Database migration, RLS and pgTAP tests

### Overview

Create the table and prove every guarantee at the database level, with a CI step. No application code yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261007120000_create_drill_configurations.sql`

**Intent**: Create `public.drill_configurations` with ownership, validation, limit and RLS enforced in the database. Purely additive, no data.

**Contract**:

- Columns: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `name text not null`, `preparation_seconds int not null`, `exercise_seconds int not null`, `rest_seconds int not null`, `repetitions int not null`, `random_start_enabled boolean not null default false`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. No color column.
- Named CHECKs: name `char_length(name) between 1 and 200` (code points, not UTF-16 units), `name = btrim(name)`, `name = normalize(name, NFC)` (so NFC/NFD forms of the same text cannot bypass `lower(name)` uniqueness) and no control characters (`name !~ '[\x01-\x1f\x7f-\x9f]'`, i.e. C0, DEL and C1, spelled as an explicit class so it does not depend on the locale's `[[:cntrl:]]`); the database is the boundary because the session token is readable by browser JS and PostgREST can be called directly. `preparation_seconds between 0 and 600`; `exercise_seconds between 1 and 600`; `rest_seconds between 0 and 600`; `repetitions between 1 and 100`. These mirror `parseDrillConfig` and are guarded against drift by a test in Phase 2.
- `create unique index drill_configurations_user_name_key on (user_id, lower(name))` (also serves per-user lookups for S-11).
- `public.set_updated_at()` generic `BEFORE UPDATE` trigger function (reusable by later tables) and its trigger.
- Limit: `public.enforce_drill_configuration_limit()` `BEFORE INSERT FOR EACH ROW`, `security invoker`, `set search_path = ''`. It takes `pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0))`, counts that user's rows and, at 50 or more, raises `errcode = '54000'` with message `drill_configuration_limit_reached`. The lock is what makes concurrent inserts safe; the limit constant (50) lives only here and in the service constant `MAX_SAVED_DRILLS`.
- RLS: `enable row level security`; `revoke all on public.drill_configurations from anon, authenticated;` then column-level grants to `authenticated`: `grant select, delete` (table level) and `grant insert (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)` and `grant update (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)`. So a client can never set or change `id`, `created_at`, `updated_at`, and can never change `user_id` after insert (it may supply `user_id` only on insert, where `WITH CHECK` pins it to `auth.uid()`; the default `auth.uid()` covers an omitted value). Four separate policies `to authenticated` using `(select auth.uid()) = user_id` (select `USING`, insert `WITH CHECK`, update `USING` + `WITH CHECK`, delete `USING`). No policy for `anon`.
- `revoke execute on function public.set_updated_at(), public.enforce_drill_configuration_limit() from public, anon, authenticated` (Supabase default privileges would otherwise grant them; triggers still fire because `EXECUTE` is checked at trigger creation, not firing).
- Header comment documents the rollback and the production order. Rollback is a NEW forward migration (drop trigger/table/functions), or manual `drop` followed by `npx supabase migration repair --status reverted 20261007120000`; a bare manual `drop table` is not a rollback because it leaves the version recorded in `supabase_migrations.schema_migrations` and the next `db push` would not recreate the table.

#### 2. pgTAP suite

**File**: `supabase/tests/database/drill_configurations.test.sql`

**Intent**: One rolled-back transaction proving the guarantees on a real Postgres, impersonating roles with `set local role` and `request.jwt.claims`.

**Contract** (each a `throws_ok`/`lives_ok`/`is` assertion): RLS enabled and exactly four policies, all `authenticated`; `anon` select and insert fail with `42501`; user A inserts and reads own row; A cannot see, update or delete B's row (0 rows affected) and cannot insert with B's `user_id` (`42501`) or move a row to B; name `''`, 201 chars, `' x'`, `E'Run\n'`, `E'\tRun'`, a C1 control character and a decomposed (NFD) `é` fail `23514`, 200 chars passes (also 200 astral characters pass, 201 fail, proving code-point counting); client-forbidden columns and functions: `authenticated` inserting an explicit `id` or `created_at`, or updating `created_at`, `updated_at`, `id` or `user_id`, fails `42501`, and `authenticated` cannot execute either trigger function (`has_function_privilege` false); `Run` after `run` for the same user fails `23505` on `drill_configurations_user_name_key`, the same name for another user passes; each parameter bound just inside/outside fails or passes (-1/601, exercise 0, repetitions 0/101); the 51st row for a user fails `54000` while another user can still insert and deleting one row frees a slot; a single multi-row `insert ... values (...),(...)` that crosses the boundary (49 existing rows + one statement inserting 2) fails `54000` (guards the `VOLATILE` row-trigger semantics, so nobody marks the function `STABLE`); `has_table('public', 'drill_configurations')` (replaces the earlier drift check); `updated_at` moves forward on update (insert with an old explicit `updated_at`, then update, because `now()` is constant inside one transaction); deleting the `auth.users` row cascades.

#### 3. CI and docs

**File**: `.github/workflows/ci.yml`, `README.md`

**Intent**: Run the suite in the `smoke` job right after "Start local Supabase", and fix the README statement "No database tables or migrations are required".

**Contract**: new step `supabase test db`, retried once with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` like the existing start step (the suite pulls a `pg_prove` image). To keep it minimally flaky (coordinator requirement): the step runs right after "Start local Supabase" and before the build so the registry state is the same as for the start step; the retry fires only when the first run fails, and the suite itself is deterministic (one transaction, fixed UUIDs, no sleeps, no network, no dependence on other tables or on `seed.sql`), so a second failure is a real failure and is not masked. README gets a short "Database" section: migrations folder, `npx supabase migration up` locally, `supabase test db`, and the production order `npx supabase db push` before merging a PR that needs the table.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local stack without resetting it: `npx supabase migration up`
- pgTAP suite passes: `npx supabase test db`
- Migration history is as expected and no other table appeared: `npx supabase migration list --local` shows `20261007120000` applied, and the pgTAP `has_table` assertion passes (replaces `db diff`, which needs a shadow DB and is noisy on the shared stack)
- Workflow YAML stays valid and CI step order is unchanged apart from the new step: `git diff .github/workflows/ci.yml`

#### Manual Verification:

- Read the migration once against the Contract above (no `anon` grant, no policy for `anon`, search_path pinned, trigger is `security invoker`).
- The rollback note is correct (forward migration, or manual drop plus `migration repair --status reverted`), checked on a scratch database or by reading.

**Implementation Note**: The local stack is shared by all worktrees. Use `migration up`, never `db reset` or `supabase stop --no-backup`. After `migration up`, the shared DB's history holds a version that worktrees on `main` do not have (their `migration up` may report unknown remote versions), and their `db reset` deletes the table under this worktree; the coordinator tells other worktrees not to reset until merge, and if the table disappears, `migration up` restores it. Pause for confirmation after this phase (the migration is what the coordinator pushes to production).

---

## Phase 2: Validation, service, API route and route protection

### Overview

Pure logic and the single HTTP entry point, fully testable without a browser.

### Changes Required:

#### 1. Shared constants and DTOs

**File**: `src/lib/drill-timer.ts`, `src/types.ts`

**Intent**: Name the limits already hard-coded in `parseDrillConfig` and add the saved-drill types S-11..S-13 will reuse.

**Contract**: export `MAX_DRILL_SECONDS = 600` and `MAX_REPETITIONS = 100` and use them in `parseDrillConfig` with no behavior change (existing tests stay green). In `src/types.ts` add `SavedDrill { id, name, configuration: DrillConfiguration, createdAt, updatedAt }`, `SaveDrillRequest` (= `DrillConfigInput` + `name`), `SaveDrillErrorCode` (`validation | duplicate_name | limit_reached | unauthorized | unsupported_media_type | payload_too_large | unavailable | unexpected`) and `SaveDrillResponse` (`{ ok: true; drill } | { ok: false; code; message; fieldErrors? }`).

#### 2. Service

**File**: `src/lib/services/drill-configurations.ts`

**Intent**: Everything about saving that is not HTTP or Supabase wiring.

**Contract**: exports `MAX_SAVED_DRILLS = 50`, `MAX_DRILL_NAME_LENGTH = 200`; `validateSaveDrillRequest(input: unknown)` (zod shape check: strict object, `name` normalised with `normalize("NFC")` then `trim()`, rejected if it contains a control character (`\p{Cc}`) and counted in code points via `[...name].length`, other fields strings/boolean; then `parseDrillConfig`; returns all field errors at once with English messages, name message `Enter a name of 1 to 200 characters.`); a `DrillConfigurationStore` port with one `insert(row)` returning the supabase-js shape `{ data, error: { code?, message?, details? } | null }`; `saveDrillConfiguration(store, userId, input)` → `SaveDrillResponse` plus HTTP status; `savedDrillFromRow(row)` (snake_case row → `SavedDrill`, exported for S-11). Error mapping: `23505` on `drill_configurations_user_name_key` → `duplicate_name` (`You already have a timer with this name.`, field error on `name`); `54000` → `limit_reached` (`You can save up to 50 timers. Delete one to save another.`); `PGRST301` / `PGRST303` or HTTP 401 from PostgREST (expired or invalid JWT) → `unauthorized` (`Sign in to save a timer.`), never `unexpected`; `PGRST205` / `42P01` (table missing) and a missing Supabase client → `unavailable` (`Saving timers is temporarily unavailable. Please try again later.`); anything else → `unexpected` (`Something went wrong. Please try again.`), logging only the error code, never the payload. A thin `createSupabaseDrillStore(client)` adapter (type-only Supabase import) performs `.from("drill_configurations").insert(row).select().single()`.

#### 3. Route

**File**: `src/pages/api/drills/index.ts`

**Intent**: `POST` only, `prerender = false`, JSON in/out, `Cache-Control: no-store`.

**Contract**: the route uses the single client the middleware already created and stored in `context.locals.supabase` (never a second `createClient`, which would read the stale request `Cookie` header and refresh the token a second time, racing the refresh-token reuse interval). No `locals.user` → `401 unauthorized` (`Sign in to save a timer.`); no `locals.supabase` → `503 unavailable`; media type compared as `contentType.split(";")[0].trim().toLowerCase() === "application/json"` (so `application/json; charset=utf-8` passes and `text/plain`, a CORS simple request, fails) else `415 unsupported_media_type` (`Send the request as JSON.`); body cap 4 KB, checked from `Content-Length` when present and from the actual text length before `JSON.parse`, else `413 payload_too_large`; unparsable JSON → `400 validation`; otherwise `saveDrillConfiguration` with `locals.user.id` and the store built from `locals.supabase`; success `201 { ok: true, drill }`. The status table is: 201, 400 validation, 401, 409 (`duplicate_name` or `limit_reached`), 413, 415, 503 unavailable, 500 unexpected.

#### 4. Route protection and shared client

**File**: `src/lib/protected-routes.ts`, `src/middleware.ts`, `src/env.d.ts`

**Intent**: Make route protection unit-testable, add `/create` without over-matching, and expose the middleware's Supabase client to routes so a request refreshes the session once.

**Contract**: `App.Locals` gains `supabase: SupabaseClient | null` (type-only import), set in the middleware next to `locals.user` (null when `createClient` returns null). `PROTECTED_ROUTES = ["/dashboard", "/create"]` and `isProtectedPath(pathname)` that matches the path itself or a path under it at a segment boundary (so `/created` is not protected and `/create/` is); the middleware uses it. The guest redirect target stays `signInUrlForProtectedPath` (`/auth/signin?next=%2Fcreate`).

#### 5. Tests, test glob, smoke

**File**: `src/lib/services/drill-configurations.test.ts`, `src/lib/protected-routes.test.ts`, `package.json`, `scripts/smoke.mjs`

**Intent**: Run the new tests in `npm test`/CI and exercise the real stack in smoke.

**Contract**: `package.json` `test` becomes `node --test src/lib/*.test.ts src/lib/services/*.test.ts`. Service tests with a fake store: every validation branch (whole-name edge cases: empty, whitespace-only, 200 vs 201 code points with astral characters, trimming; all four time/repetition bounds agree with `parseDrillConfig`), each error code mapping including `PGRST205`, `PGRST301`/`PGRST303`/401 → `unauthorized`, NFC/NFD names normalised to one value, tab/newline/C1 control characters rejected, the row/DTO mapping, no payload in logged output; the media-type and body-size helpers (`application/json; charset=utf-8` passes, `text/plain` and `application/jsonx` fail, an oversized body is rejected) are pure functions in the service and tested there. A drift test reads the migration file and asserts its CHECK bounds equal `MAX_DRILL_SECONDS`, `MAX_REPETITIONS`, `MAX_DRILL_NAME_LENGTH` and `MAX_SAVED_DRILLS`. Smoke: `appRequest` gains a `json` option; local mode adds anonymous `POST /api/drills` → 401, anonymous `/create` → 302 to sign-in with `next=/create`, authenticated save → 201, same name in another case → 409 `duplicate_name`, invalid body → 400, wrong content type → 415, then up to 48 saved and five concurrent distinct-name posts yield exactly two 201 and three 409 `limit_reached` (a regression signal only: it also passes if the requests happen to serialise; the lock itself is covered by the pgTAP boundary tests). All authenticated API steps run inside the first signed-in session of `runLocalSmoke`, after "SSR cookies authorize the dashboard after new-account confirmation" and before `verifyDashboardAndSignOut`, which signs out (anonymous checks can run before sign-in); remote mode adds only the two anonymous checks (they need no table).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including new service/route-protection tests: `npm test`
- Lint passes: `npm run lint`
- Rule tests pass: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`
- Types: `npx astro sync && npx astro check`
- Build: `npm run build`
- Local smoke (dev or preview, local Supabase with the migration applied): `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- Before applying the migration locally (or on a scratch database without the table), `POST /api/drills` with a valid body as a signed-in user returns `503` with the English message, while `/`, `/auth/signin` and `/dashboard` still return 200.
- After applying it, the same request returns `201` and the row is visible in Studio under that user only.

**Implementation Note**: Pause for confirmation of the manual checks before Phase 3.

---

## Phase 3: `/create` page and form

### Overview

The signed-in user can name and save a timer from the browser.

### Changes Required:

#### 1. Reuse the parameter form

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: Reuse the existing fields, validation and signal preview instead of forking the form.

**Contract**: add optional props `submitLabel` (default `Start`), `leading` (ReactNode rendered above the fields, for the name field), `pending` (disables submit, `aria-busy`) and `onSubmitAttempt` (called at the start of every submit so the name error can show together with parameter errors). Defaults keep `/` byte-for-byte equivalent; `onStart` keeps its meaning of "called with the validated configuration".

#### 2. Hook and presentational view

**File**: `src/components/hooks/useDrillCreate.ts`, `src/components/timer/DrillCreateForm.tsx`, `src/components/timer/DrillCreateApp.tsx`

**Intent**: Hook owns state and the save call (double-submit latch, status `idle | saving | saved | error`); `DrillCreateForm` is purely presentational so `/dev/timer-ui` can render any state; `DrillCreateApp` wires hook + default `fetch` port and the card shell (title `Create a timer`, `ThemeToggle`, link back to `/`).

**Contract**: the hook takes `saveDrill(request) => Promise<SaveDrillResponse>` (default posts JSON to `/api/drills`; network failure maps to the `unavailable`-style message). Rendering rules: name `Input` with label, hint `1 to 200 characters` and no HTML `maxLength` attribute (it counts UTF-16 units and would cut astral names; the 200 code-point limit is validated by the service), `aria-invalid`/`aria-describedby`, error via `role="alert"`; `duplicate_name` error sits on the name field; `limit_reached`, `unavailable`, `unexpected` use a destructive `Alert` above the submit; `unauthorized` shows an `Alert` with a link to `/auth/signin?next=%2Fcreate`; `saved` shows an `Alert` `Saved "<name>".`, clears and refocuses the name, keeps the parameters; submit label `Save timer`, `Saving…` while pending. Only semantic tokens and existing `ui` primitives (timer UI contract).

#### 3. Page, link, lint scope

**File**: `src/pages/create.astro`, `src/pages/dashboard.astro`, `eslint.config.js`

**Intent**: Server-rendered page (no DB query at render, so it works before the table exists), a way to reach it, and contract coverage.

**Contract**: `create.astro` uses `Layout` with `enableTimerTheme` and `showConfigWarnings={false}` and mounts `DrillCreateApp client:load`; `dashboard.astro` gets a `Create a timer` link to `/create` using `buttonVariants` (the stub otherwise stays as is); add `src/pages/create.astro` to the timer-ui contract file list in `eslint.config.js`. Smoke (local) additionally checks that authenticated `GET /create` returns 200 and contains `Create a timer`.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, rule tests, `npx astro check`, `npm run build` all pass.
- Local smoke including the authenticated `/create` check passes.
- `git diff` of `DrillConfigForm.tsx` shows only additive optional props (defaults reproduce the old markup).

#### Manual Verification:

- Guest visiting `/create` lands on sign-in, and after the email link returns to `/create`.
- Saving a valid timer shows the confirmation and the row exists; saving `run` after `Run` shows the name error; the 51st shows the limit alert; with the dev server pointed at a DB without the table the unavailable alert appears and `/` still works.
- Keyboard-only: Tab order name → parameters → preview buttons → Save; Enter submits; errors are announced.
- `/` still starts and runs a drill exactly as before.

**Implementation Note**: Pause for manual confirmation before the visual gate.

---

## Phase 4: Visual gate and docs

### Overview

Meet the repo's UI evidence rule for the new view and record the contract.

### Changes Required:

#### 1. `/dev/timer-ui` fixtures

**File**: `src/components/timer/CreateDrillFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx` (mount only)

**Intent**: Production `DrillCreateForm` with deterministic states, mounted by a small addition to the preview; existing seven-state matrix and held-mounted lifecycle fixtures untouched.

**Contract**: states: default (empty name), filled, hover and focus-visible on Save (scripted), error (duplicate name), limit reached, saving (disabled + `aria-busy`), saved, unavailable, session expired. Empty = default; each is rendered in light/dark and checked at 1280 and 390 px. Screenshots and a README with the checks are saved to `context/changes/save-named-drill/screenshots/` using the same Playwright method as `context/changes/view-three-phase-sections/screenshots/`.

#### 2. Docs

**File**: `AGENTS.md`

**Intent**: Keep the next agent on the contract.

**Contract**: one line in the UI section that `/create` follows the timer UI contract and has fixtures in `/dev/timer-ui`, and one in the Commands/CI area that `supabase test db` covers table RLS.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, rule tests, `npx astro check`, `npm run build` pass.
- Playwright pass over the fixtures reports 0 failed checks (text, aria state, no horizontal overflow at 390 px, focus ring, disabled state); results stored in the change folder.
- `/dev/timer-ui` still returns 404 in the production preview (CI check unchanged).

#### Manual Verification:

- A human reviews the saved screenshots (hierarchy, contrast in dark mode, error visibility).
- Optional real-device check of `/create` on a phone.

---

## Testing Strategy

### Unit Tests (`npm test`, runs in CI `ci` job):

- Service validation, error mapping, DTO mapping, migration-constants drift test, `isProtectedPath` boundaries.

### Database tests (`supabase test db`, runs in CI `smoke` job after this change):

- RLS per operation and role, constraints, uniqueness, limit, cascade, `updated_at`.

### Integration (local smoke, CI `smoke` job):

- Real cookie session → real RLS → real trigger, including the concurrent-insert limit check.

### Manual Testing Steps:

1. Guest → `/create` → sign-in → back to `/create`; `/` unchanged for guest and signed-in user.
2. Save, duplicate (different case), limit, invalid time, missing table.
3. Dark and light, phone width.

## Performance Considerations

At most 50 rows per user; the unique index leads with `user_id`. The advisory lock is per user and per transaction, so it serialises only one user's concurrent inserts.

## Migration Notes

- Additive migration, no data. Production order (coordinator): `npx supabase db push` → verify the table and policies → merge the PR (merge auto-deploys). Do not run `db push` from this change.
- If the code is deployed before the migration: `POST /api/drills` → 503 `Saving timers is temporarily unavailable...`; all other routes work (no render-time queries).
- Rollback: a new forward migration that drops the trigger, table and `enforce_drill_configuration_limit()` (and `set_updated_at()` if no other table uses it); or, for an emergency manual `drop`, follow it with `npx supabase migration repair --status reverted 20261007120000` so the history matches. The app returns to 503 on save, nothing else changes.
- The local Supabase is shared across worktrees: use `migration up`; avoid `db reset` and `supabase stop --no-backup`; other worktrees must not reset until this change merges.
- Known limitation: names are NFC-normalised in the service and enforced in the database (`normalize(name, NFC)` check); `lower()` remains locale-dependent in Postgres.
- Open item for the coordinator: PRD FR-010 still mentions colors; the roadmap override is the current source.

## References

- Roadmap: `context/foundation/roadmap.md` (S-10, S-11..S-13)
- Middleware and redirect: `src/middleware.ts:6`, `src/lib/email-auth.ts:136`
- Validation rules: `src/lib/drill-timer.ts:28`
- API pattern: `src/pages/api/auth/signin.ts`
- Form to reuse: `src/components/timer/DrillConfigForm.tsx`
- Visual gate method: `context/changes/view-three-phase-sections/screenshots/README.md`
- CI: `.github/workflows/ci.yml` (`smoke` job)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database migration, RLS and pgTAP tests

#### Automated

- [x] 1.1 Migration applies to the local stack with `npx supabase migration up` — 98e14ac
- [x] 1.2 pgTAP suite passes with `npx supabase test db` — 98e14ac
- [x] 1.3 `npx supabase migration list --local` shows the migration applied and the pgTAP `has_table` assertion passes — 98e14ac
- [x] 1.4 CI workflow diff contains only the new `supabase test db` step — 98e14ac

#### Manual

- [ ] 1.5 Migration read against the Contract (no anon grant or policy, pinned search_path, security invoker trigger)
- [ ] 1.6 Rollback comment verified on a scratch database

### Phase 2: Validation, service, API route and route protection

#### Automated

- [ ] 2.1 `npm test` passes with the new service and route-protection tests
- [ ] 2.2 `npm run lint` passes
- [ ] 2.3 Contract rule tests pass
- [ ] 2.4 `npx astro sync && npx astro check` passes
- [ ] 2.5 `npm run build` passes
- [ ] 2.6 Local smoke with the new API steps passes

#### Manual

- [ ] 2.7 Without the table, `POST /api/drills` returns 503 while `/`, `/auth/signin` and `/dashboard` return 200
- [ ] 2.8 With the migration, the same request returns 201 and the row belongs only to that user

### Phase 3: `/create` page and form

#### Automated

- [ ] 3.1 `npm test`, `npm run lint`, contract rule tests, `npx astro check` and `npm run build` pass
- [ ] 3.2 Local smoke including authenticated `/create` passes
- [ ] 3.3 `DrillConfigForm.tsx` diff is additive optional props only

#### Manual

- [ ] 3.4 Guest `/create` → sign-in → back to `/create`
- [ ] 3.5 Save, duplicate name, limit, missing-table and session-expired flows behave as specified
- [ ] 3.6 Keyboard-only flow and error announcements verified
- [ ] 3.7 `/` still starts and runs a drill as before

### Phase 4: Visual gate and docs

#### Automated

- [ ] 4.1 `npm test`, `npm run lint`, contract rule tests, `npx astro check` and `npm run build` pass
- [ ] 4.2 Playwright pass over the `/create` fixtures reports 0 failed checks
- [ ] 4.3 `/dev/timer-ui` returns 404 in the production preview

#### Manual

- [ ] 4.4 Screenshots reviewed by a human (light/dark, 1280/390)
- [ ] 4.5 Optional phone check of `/create`
