# Open Saved Drill (S-11) Implementation Plan

## Overview

A signed-in user lands on `/dashboard`, sees their own saved timers (name + parameters) or a clear "no saved timers yet" text, opens one at `/{id}` and runs it with the existing timer. Ownership is enforced by the same RLS as S-10; a foreign, nonexistent or non-UUID id is an indistinguishable 404. No new table, no migration, no `db push`.

## Current State Analysis

- `public.drill_configurations` exists on production (S-10) with a `select own` policy and `grant select` to `authenticated` only; `anon` has nothing (`supabase/migrations/20261007120000_create_drill_configurations.sql`). The unique index `(user_id, lower(name))` leads with `user_id`, so a per-user list needs no new index; the limit is 50 rows per user, so no pagination.
- `src/lib/services/drill-configurations.ts` already has `DrillConfigurationRow`, `savedDrillFromRow`, `classifyStoreError` (maps `PGRST205`/`42P01` to unavailable, `PGRST301/303`/401 to unauthorized), a port-based store (`DrillConfigurationStore` with only `insert`) and `createSupabaseDrillStore(client)`; `SavedDrill` is in `src/types.ts`. The service has no runtime Supabase import and is tested with `node --test`.
- `src/middleware.ts` creates one SSR client per request into `locals.supabase` and `locals.user`; `src/lib/protected-routes.ts` guards `/dashboard` and `/create` (segment boundary, decoded path, collapsed slashes).
- `src/pages/dashboard.astro` is the starter stub (hard-coded `white/10`, gradient) with the `Create a timer` link that `scripts/smoke.mjs:278` asserts by regex, and a sign-out form. There is no `404.astro` and no root-level dynamic route.
- `DrillApp.tsx` owns the run lifecycle (`identityState`, `createActiveRun`, cancel/restart/complete via `drill-run-identity`) with in-memory state only; its `configuration` view renders `DrillConfigForm` and its `completed` view `DrillCompleted`. `formatPhaseTime` (`src/lib/drill-phase-sections.ts:22`) formats m:ss.
- UI contract: semantic tokens only, lint-enforced for `src/components/timer/**`, `index.astro`, `create.astro`, `dev/timer-ui.astro` (`eslint.config.js:103-111`); visual gate through `/dev/timer-ui` fixtures (`CreateDrillFixtures.tsx` is the precedent).

### Key Discoveries:

- Astro gives static routes priority over dynamic ones, so `src/pages/[id].astro` cannot shadow `/dashboard`, `/create`, `/auth/*`, `/api/*`, `/dev/*`; it only sees single-segment paths nobody else owns, so it must itself reject everything that is not a UUID.
- RLS makes "foreign" and "nonexistent" the same query result (zero rows), so returning 404 for zero rows gives non-disclosure without extra logic, provided the page never reveals the difference (same markup, status and headers).
- "Do not resume after refresh" is satisfied by design: run state lives only in React memory; the page is re-rendered from the database into the read-only detail view. It is documented as a design property and verified manually plus by the SSR HTML check in smoke (`Start`, not a run view); `node --test` cannot render React. Back/Forward (bfcache) may restore in-memory state exactly as on `/` today and is noted in the handoff as an explicit manual check.
- An unavailable store (missing table, no client, JWT error) must not render the empty-state text, otherwise an outage looks like "you have no timers".

## Desired End State

- `/dashboard` (protected) renders server-side from the database: cards-as-links for each saved timer (newest first, `id` tie-break) with name and `Prep 0:05 · Exercise 0:04 · Rest 0:02 · 3 reps · Random start`, or `You have no saved timers yet.` when empty; a destructive alert (no empty text) when the store is unavailable; `Create a timer` link and sign-out kept.
- `/{uuid}` (guest goes to sign-in with `next`) shows the timer name and read-only parameters with a `Start` button; Start runs the real `DrillTimer` with the stored configuration (same audio/Wake Lock/cancel/restart contract as `/`); Cancel/Completed return to the detail view; `Back to dashboard` link. The detail layout leaves a spare actions area (layout only) where S-12/S-13 can later place Edit/Delete.
- Foreign, nonexistent, non-UUID id gives a 404 page (identical for the first two); unavailable store gives 503 with a message; all responses `Cache-Control: private, no-store`.
- Verified by `npm test`, pgTAP (reading other users' rows by list and by id, anon), smoke with two users, and the seven-state visual gate.

## What We're NOT Doing

- Edit and delete (S-12, S-13); no Edit/Delete control, handler or API is rendered or stubbed. Only the layout leaves room for them.
- Migrations, `db push`, `db reset`, generated Supabase types, new indexes.
- Phase colors (S-05), search/sort controls, pagination (limit is 50).
- Resuming an in-progress run after refresh, sharing/public timer links, a prefix route such as `/t/{id}` (decision: root `/{id}`).
- Changing `/` (default timer for guests and signed-in users) or its fixtures.
- A client-side fetch API for reading timers (`GET /api/drills` is not added; pages read server-side).

## Implementation Approach

Extend the existing service with a read port (`list`, `findById`) next to `insert` rather than a second module; pure functions map rows through `savedDrillFromRow` and errors through `classifyStoreError`, returning a discriminated result (`ok` / `not_found` / `unavailable` / `unauthorized`). Pages call them with `locals.supabase`. The detail view reuses `DrillApp`'s run machinery through an optional `savedDrill` prop instead of forking the lifecycle. UI is a presentational React list component reused by `/dev/timer-ui` fixtures.

## Phase 1: Read service, id guard and protection rule

### Overview

Pure, tested logic with no UI: how timers are read, how ids are validated and which paths need a session.

### Changes Required:

#### 1. Read port and functions

**File**: `src/lib/services/drill-configurations.ts` (+ `src/types.ts` if a result type is shared)

**Intent**: Add reading to the existing service so list and detail pages share ownership/error semantics with save, and nothing is duplicated.

**Contract**: `DrillConfigurationStore` gains `list()` and `findById(id)` (supabase-js shapes: rows array / `maybeSingle` row, `error`, `status`); `createSupabaseDrillStore` implements them with an explicit column list (no `user_id` selected), ordered `created_at desc, id desc`, `limit MAX_SAVED_DRILLS`. New exported `isDrillId(value)` (case-insensitive `8-4-4-4-12` hex, nothing else) and `normalizeDrillId` (lower-case). New `listSavedDrills(store, log?)` returning `{ kind: "ok", drills } | { kind: "unavailable" | "unauthorized" }` and `getSavedDrill(store, id, log?)` returning `{ kind: "ok", drill } | { kind: "not_found" } | { kind: "unavailable" | "unauthorized" }`. Non-UUID id gives `not_found` without touching the store; zero rows gives `not_found`; exceptions, unknown errors (incl. `42501`/403) and `data: null` with no `error` give `unavailable`, logging only the error code (as in save); an empty list (`kind: "ok"`, `drills: []`) is returned only for `error === null` and an array `data`. `OPEN_DRILL_MESSAGES` (unavailable, empty, not found) sits next to `SAVE_DRILL_MESSAGES`. Existing store fakes in tests gain the new methods; save behavior is unchanged.

#### 2. Display formatting

**File**: `src/lib/saved-drill-summary.ts` (new, pure)

**Intent**: One function turning `DrillConfiguration` into the parameter line segments, so list, detail and fixtures agree.

**Contract**: `describeDrillConfiguration(configuration): string[]` giving `["Prep 0:05","Exercise 0:04","Rest 0:02","3 reps","Random start"]` (`1 rep` singular; `Random start` only when enabled), using `formatPhaseTime`.

#### 3. Route protection for saved-drill paths

**File**: `src/lib/protected-routes.ts` (`src/middleware.ts` already calls `isProtectedPath`)

**Intent**: Guests opening a timer link go to sign-in (and return to it), while arbitrary unknown paths are not turned into redirects.

**Contract**: `isProtectedPath` additionally returns true for a single-segment path whose decoded, slash-collapsed, trailing-slash-ignored form is a UUID (`/%36...`, `//{uuid}`, `/{uuid}/` included); `/{non-uuid}` stays unprotected (renders 404 for everyone). Test that `/{uuid}` is accepted by `isSafeNextPath` and round-trips through `signInUrlForProtectedPath`.

#### 4. pgTAP: reading other users' rows

**File**: `supabase/tests/database/drill_configurations.test.sql`

**Intent**: Prove the data boundary the pages rely on, as the `authenticated` role, with the query shapes the store uses.

**Contract**: Add assertions and set `plan(N)` to the exact new total (currently 70): user A selecting all rows sees only A's (ordered `created_at desc, id desc`, limited to 50 like the store query); A selecting B's row by id gets zero rows (same result as a random id); `anon` select by id is denied; the selected column list works for `authenticated`. No migration file is added.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (new: `isDrillId` accept/reject incl. braces, uppercase (accepted and normalized), `{uuid}%2F`, 35/37 chars, non-hex, whitespace; read errors `42501`, `data: null` without error and thrown exceptions from `list` and `findById` all give `unavailable`, never an empty list; the page decision function (no user, non-UUID, not_found, unavailable, unauthorized, ok); list mapping; `getSavedDrill` ok / zero rows not_found / non-UUID never calls the store / `PGRST205` unavailable / `PGRST301` unauthorized / exception logged by code only; summary incl. `1 rep` and random start on/off; protected-routes UUID cases incl. upper-case, `/{uuid}%2F` and non-UUID unprotected; `//{uuid}` falls back to `next=/dashboard` by design)
- Database tests pass: `npx supabase test db`
- No migration added: `git diff --name-only main -- supabase/migrations` is empty
- Lint and types pass: `npm run lint`, `npx astro sync && npx astro check`

#### Manual Verification:

- Break-check recorded: removing the `isDrillId` guard, ignoring the zero-row case and loosening `isProtectedPath` each turn a test red (restored afterwards)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; the `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Pages, saved-drill view and 404

### Overview

User-visible routes: dashboard list, `/{id}` detail and run, 404/503 handling, contract-compliant UI.

### Changes Required:

#### 1. 404 page and `[id]` route

**File**: `src/pages/404.astro` (new), `src/components/timer/NotFoundView.astro` (new, shared), `src/pages/[id].astro` (new)

**Intent**: One neutral not-found experience; `/{id}` never reveals whether an id exists.

**Contract**: both pages export `prerender = false`. A shared `NotFoundView.astro` (`Layout enableTimerTheme showConfigWarnings={false}`, semantic tokens, link to `/`) is the only 404 content; it never prints `Astro.url` or `params.id`, so the body for a foreign and a random UUID is byte-identical by construction. `[id].astro` decides through a pure function in `src/lib` (tested): no `locals.user` redirects to sign-in with `next` before the store is touched (defense in depth behind the middleware); non-UUID or `not_found` sets `Astro.response.status = 404` and renders `NotFoundView` directly (no `Astro.rewrite`, so no second middleware run or second Supabase client); `unavailable` sets 503 with `OPEN_DRILL_MESSAGES.unavailable` and a link back; `unauthorized` redirects to sign-in with `next`; `ok` renders `DrillApp` in saved mode (`client:load`). Every branch sets `Cache-Control: private, no-store` on `Astro.response.headers`, and `/{id}` adds a `noindex` robots meta. `404.astro` renders the same `NotFoundView` and sets the same headers itself (it serves unmatched paths such as `/abc/def`). The implementer records on `npm run preview` (workerd) that `/abc` and `/abc/def` return the same 404 with `no-store`, and that `/dashboard`, `/create`, `/auth/signin`, `/api/drills` still resolve to their own routes.

#### 2. Saved mode in the existing timer app

**File**: `src/components/timer/DrillApp.tsx` (+ new `SavedDrillDetails.tsx`)

**Intent**: Run a stored timer with the same lifecycle, without forking it.

**Contract**: `DrillApp` gets an optional `savedDrill?: SavedDrill` prop. Without it, behavior and markup are unchanged (`/` is regression-checked by existing fixtures). With it, the `configuration` view is `SavedDrillDetails`: `h1` = timer name, parameter list from `describeDrillConfiguration`, `Start` calling `start(savedDrill.configuration)` inside the click gesture (audio/Wake Lock unlock as today), `Back to dashboard` link, and a reserved empty actions row in the layout for S-12/S-13 (no controls). `completed` and cancel return to these details. No editable inputs and no persisted run state, so a refresh always shows the details (bfcache restore is out of scope, same as `/`).

#### 3. Dashboard

**File**: `src/pages/dashboard.astro`, `src/components/timer/SavedDrillList.tsx` (new, presentational)

**Intent**: Replace the starter stub with the signed-in home using tokens and `src/components/ui`.

**Contract**: `dashboard.astro` loads `listSavedDrills(createSupabaseDrillStore(locals.supabase))` (no client means unavailable; no `locals.user` or `unauthorized` redirects to `/auth/signin?next=%2Fdashboard`) and renders a shell (`Layout enableTimerTheme showConfigWarnings={false}`) with the user email, `SavedDrillList` (list / empty / unavailable), the `Create a timer` link (keeps `<a href="/create" ...>Create a timer</a>` for the smoke regex) and the sign-out form as a `Button`. Each timer is one link to `/{id}` with a `break-words` name and the parameter line; empty text `You have no saved timers yet.`; unavailable shows a destructive `Alert` with `OPEN_DRILL_MESSAGES.unavailable` and never the empty text. User names are rendered as text only. `Cache-Control: private, no-store`.

#### 4. Lint scope

**File**: `eslint.config.js`

**Intent**: Put the new entry routes under the timer UI contract.

**Contract**: add `src/pages/dashboard.astro`, `src/pages/[id].astro`, `src/pages/404.astro` to the timer-ui `files` list (`.tsx` components are already covered); account-entry rule scope unchanged.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean (timer-ui rule on the new files) and rule tests: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`
- `npm test`, `npx astro check`, `npm run build` pass; any saved-mode lifecycle decision logic extracted into `src/lib` has unit tests (React cannot be rendered under `node --test`: known `@/` alias limit, so DOM behavior is covered by smoke and fixtures)

#### Manual Verification:

- Signed in: `/dashboard` lists own timers (a `<ul>` of link cards); open one, `Start` runs it with correct phases and signals; Cancel and completion return to the details; refresh during a run shows the details, not a running timer
- Another user's id, a random UUID and `/abc` look identical (404); `/{uuid}` as a guest redirects to sign-in and returns to the timer after sign-in
- `/`, `/create`, `/auth/signin`, `/api/drills` unchanged; focus-visible and accessible names OK on list links and Start

**Implementation Note**: Pause after this phase for manual confirmation before Phase 3.

---

## Phase 3: Smoke, visual gate and docs

### Overview

End-to-end evidence with real cookies, plus the screenshot gate and a rule for the next agent.

### Changes Required:

#### 1. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Prove ownership and routing through the real stack.

**Contract**: Local mode, first user: save a named timer; `GET /dashboard` contains its name, parameter line and a link to `/{id}`; `GET /{id}` is 200 with name and `Start` in the server-rendered HTML (not a running-timer view) and a `noindex` robots meta; `Cache-Control` includes `no-store`. The id is taken from the 201 response of `POST /api/drills` and stored before the first user signs out. A genuinely separate second account (a new, distinct e-mail address, not the existing-account session of the first user) then requests `GET /{first user's id}` and `GET /{random-uuid}` both give 404 with identical status, raw body and headers (`cache-control`, `content-type`, `referrer-policy`), the body does not contain the requested id, and `GET /not-a-uuid` and `GET /abc/def` give the same 404; second user's dashboard lacks the first user's name and shows the empty text. Guest `GET /{uuid}` redirects to `/auth/signin?next=%2F{uuid}`; guest `GET /not-a-uuid` is 404 with no redirect. Remote mode: anonymous checks only. The existing `Create a timer` regex stays valid.

#### 2. `/dev/timer-ui` fixtures

**File**: `src/components/timer/SavedDrillFixtures.tsx` (new), `src/components/timer/TimerUiPreview.tsx`

**Intent**: Production-backed states for the new views, per the Visual gate rule.

**Contract**: fixtures feed `SavedDrillList` and `SavedDrillDetails` (and shared 404/unavailable blocks) with deterministic data: list (3 timers), empty, unavailable (error), 50 timers with long wrapped names (stress), details default; hover and focus-visible reachable on cards and Start; disabled is a justified N/A (no disabled control) and loading is a justified N/A (server-rendered). Screenshots at 1280 and 390 px, light and dark, reviewed and saved in `context/changes/open-saved-drill/screenshots/`.

#### 3. Docs and rule

**File**: `AGENTS.md`, `README.md`

**Intent**: Keep the next agent on the contract and document routing.

**Contract**: AGENTS.md UI section notes that dashboard, `[id]` and 404 follow the timer UI contract and that `SavedDrillFixtures` in `/dev/timer-ui` must be extended with the views; README routes table adds `/dashboard` (list) and `/{id}` (saved timer, UUID only, otherwise 404). No `db push` instruction (no migration).

### Success Criteria:

#### Automated Verification:

- Smoke passes against the production preview: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` (shared stack, same Mailpit caveat as S-10; record how it was run)
- `npm run lint`, `npm test`, `npx astro check`, `npm run build` pass; `/dev/timer-ui` is still 404 in the production preview

#### Manual Verification:

- Screenshots of all states (light/dark, 1280/390) reviewed and accepted
- Existing `/dev/timer-ui` seven-state timer gate and held-mounted Restart scenarios unaffected

---

## Testing Strategy

### Unit Tests:

- `isDrillId`/`normalizeDrillId`, `getSavedDrill`, `listSavedDrills`, error mapping and log content, summary text, `isProtectedPath` for UUID paths.

### Integration Tests:

- pgTAP read isolation; smoke with two users, guests, non-UUID and nonexistent ids.

### Manual Testing Steps:

1. Save two timers, open each from `/dashboard`, run one to completion and cancel the other.
2. Refresh during a run; confirm the details are shown, not a running timer.
3. As another user open the first user's URL; compare with a random UUID.

## Performance Considerations

One indexed query per page, at most 50 rows, explicit columns; no N+1.

## Migration Notes

None: no schema change, so no `db push` and nothing to coordinate before merge. Pages degrade to the 503/alert state if the table were ever missing.

## References

- S-10 handoff: `context/changes/save-named-drill/handoff.md`; plan-review lessons F1 (reuse `locals.supabase`), F3, F4.
- Service and DTO: `src/lib/services/drill-configurations.ts` (`savedDrillFromRow`, `classifyStoreError`), `src/types.ts` (`SavedDrill`).
- Run lifecycle: `src/components/timer/DrillApp.tsx`; fixture precedent: `src/components/timer/CreateDrillFixtures.tsx`.
- Roadmap: `context/foundation/roadmap.md` S-11 (parallel with S-12, S-13).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Read service, id guard and protection rule

#### Automated

- [x] 1.1 Unit tests pass (`npm test`) for ids, read service, summary and protected routes — 4cb812f
- [x] 1.2 Database tests pass (`npx supabase test db`) — 4cb812f
- [x] 1.3 No migration file added under `supabase/migrations` — 4cb812f
- [x] 1.4 Lint and `astro check` pass — 4cb812f

#### Manual

- [x] 1.5 Break-check of id guard, zero-row case and protection rule recorded — 4cb812f

### Phase 2: Pages, saved-drill view and 404

#### Automated

- [x] 2.1 `npm run lint` and the lint rule tests pass — 17eb73c
- [x] 2.2 `npm test`, `astro check` and `npm run build` pass — 17eb73c

#### Manual

- [x] 2.3 Dashboard list, open, run, cancel/complete and refresh behavior verified signed in (by Playwright script, not a human; bfcache Back/Forward not covered) — a6a59c6
- [x] 2.4 Foreign, random and non-UUID ids look identical (404); guest `/{uuid}` redirects and returns after sign-in — 17eb73c (HTTP-level, see handoff; return-after-sign-in covered by unit tests)
- [x] 2.5 `/`, `/create`, `/auth/signin`, `/api/drills` unchanged; keyboard and accessible names checked (by Playwright script, not a human; no screen reader/real device) — a6a59c6

### Phase 3: Smoke, visual gate and docs

#### Automated

- [x] 3.1 Local smoke passes against the production preview (two users, guests, non-UUID) — a6a59c6
- [x] 3.2 Lint, tests, `astro check`, build pass and `/dev/timer-ui` is 404 in the production preview — a6a59c6

#### Manual

- [ ] 3.3 Screenshots of all states (light/dark, 1280/390) reviewed and accepted
- [ ] 3.4 Existing seven-state timer gate and Restart lifecycle scenarios unaffected
