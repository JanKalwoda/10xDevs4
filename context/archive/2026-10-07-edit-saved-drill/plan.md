# Edit Saved Drill (S-12) Implementation Plan

## Overview

A signed-in user changes the name and parameters (no phase colors) of one of their own saved timers. The change reuses the S-10 save pipeline (zod/service validation, store port, DTOs, `DrillCreateForm`) and the S-11 page pipeline (`resolveSavedDrillPage`, `NotFoundView`, protection rules). Per-user case-insensitive name uniqueness and the 200-character name limit hold on edit because the same validator and the same database constraints apply. One edit never touches other rows.

Planning decisions (coordinator Q1–Q5, recommendations applied; see `plan-brief.md`): route `/{id}/edit`; `PUT /api/drills/{id}` with the full body; last-write-wins; stay on the edit page after saving; no migration.

## Current State Analysis

- Table `public.drill_configurations` (migration `20261007120000`) already has policy `drill_configurations_update_own` (USING and WITH CHECK `auth.uid() = user_id`), a column grant `update (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)` to `authenticated`, the `set_updated_at` BEFORE UPDATE trigger, name CHECKs (length 1–200 by code points, trimmed, NFC, no control chars), parameter range CHECKs and the unique index `(user_id, lower(name))` named `drill_configurations_user_name_key`. The limit trigger (50 rows) is BEFORE INSERT only, so editing at the limit works. No migration is needed.
- pgTAP (`supabase/tests/database/drill_configurations.test.sql`, `plan(80)`) already covers: `user_id` change refused (42501), owner update, case-only rename of the same row, `created_at`/`updated_at`/`id` not updatable, out-of-range update, `updated_at` moves, B's update of A's rows as a silent no-op. Missing: a rename colliding with another own row (23505 with the index name), exact zero-row result for B updating A's row **by id** with A's row verified unchanged, sibling rows untouched by an update, update allowed for a user at the 50 limit, same name as another user's row allowed on update.
- `src/lib/services/drill-configurations.ts`: `DrillConfigurationStore` has `insert`, `list`, `findById`; `validateSaveDrillRequest`, `normalizeDrillName`, `classifyStoreError` (maps `23505` + index name to `duplicate_name`), `handleSaveDrillRequest` (401 → 503 → 415 → 413/invalid → 400 JSON → service), `savedDrillFromRow`, `resolveSavedDrillPage`, `isDrillId`/`normalizeDrillId`, `OPEN_DRILL_MESSAGES`. `SaveDrillErrorCode` in `src/types.ts` has no `not_found`.
- `src/pages/api/drills/index.ts` exports only `POST`. `src/pages/[id].astro` renders `DrillApp savedDrill`; `SavedDrillDetails` has an intentionally empty `data-slot="saved-drill-actions"` div reserved for S-12/S-13.
- `src/lib/protected-routes.ts`: `/dashboard`, `/create` (+ subpaths) and `/{uuid}` (`SAVED_DRILL_PATH`) are protected; every other single segment is public and 404.
- `DrillCreateForm` (presentational, props-driven, `Save timer`/`Saving…` hard-coded, `Saved "<name>".` status) + `createDrillCreateController` (clears name on success) + `useDrillCreate` + `postSaveDrill` are the save path of `/create`; `DrillConfigForm` takes `values`/`onValuesChange`/`onStart`/`submitLabel`/`leading`/`beforeSubmit`/`pending`/`onSubmitAttempt`.
- CSRF assumption (review F4): `PUT` with `Content-Type: application/json` forces a CORS preflight (the app sends no CORS headers), the handler rejects any non-JSON content type with 415 before reading the body or touching the store, and the `@supabase/ssr` cookies are SameSite=Lax. Accepting other content types or adding CORS later would open CSRF; tests below pin it.
- Existing contracts that must not regress: timer UI lint scope (`eslint.config.js` lists `create.astro`, `dashboard.astro`, `[id].astro`, `404.astro`), `/dev/timer-ui` fixtures and the screenshot gate, smoke script (`scripts/smoke.mjs`), CI.

## Desired End State

On `/{id}` the owner sees an `Edit` action (the reserved actions slot, leaving room for `Delete` in S-13). It opens `/{id}/edit`: the same form as `/create` prefilled with the stored name and parameters, button `Save changes`. Saving calls `PUT /api/drills/{id}`. Success shows `Saved "<name>".`, keeps the form on screen with the saved values, and offers `Back to timer` (`/{id}`) and `Back to dashboard`. Failure cases:

- duplicate name (another own timer, case-insensitive) → field error on the name, 409;
- invalid name or parameters → field errors, 400;
- the row is gone, foreign or the id is not a UUID → 404 (identical for all three); on the page the shared 404 view, in the form a destructive alert with a link to the dashboard;
- not signed in → 401 (API) or redirect to sign-in (page); outage → 503 / unavailable view.

Changing only the letter case of the own name is allowed. No other row (own or foreign) changes; `user_id`, `created_at`, `id` are never sent.

Verify: `npm test`, `npm run lint`, rule tests, `astro check`, `npm run build`, `npx supabase test db`, extended smoke, the `/dev/timer-ui` gate with screenshots in `context/changes/edit-saved-drill/screenshots/`.

### Key Discoveries:

- Update policy, column grant, trigger and unique index already exist (`supabase/migrations/20261007120000_create_drill_configurations.sql`, policies and grants at the end of the file) — no migration.
- A zero-row UPDATE under RLS returns no error; the app must treat `maybeSingle()` returning `null` as `not_found` (same technique as `findById`).
- The unique index checks other tuples only, so a case-only rename of the same row passes with no special handling (already asserted in pgTAP).
- `classifyStoreError` already maps the duplicate index and unauthorized codes; only `not_found` is new, and `limit_reached` cannot occur on update.
- ESLint globs (review F1): in minimatch `[id]` is a character class, so the existing S-11 entry `src/pages/[id].astro` does not match the file and `/{id}` has not been under the timer UI contract since S-11; the literal-file form is `src/pages/[[]id[]].astro`.
- `[id].astro` and `[id]/edit.astro` coexist in Astro; `/{x}/edit` for a non-UUID `x` must give the same 404 as `/{x}` and must not redirect a guest (no oracle).

## What We're NOT Doing

- No migration, no `db push`, no `db reset`; shared local Supabase untouched beyond `migration up` (not needed).
- No Delete (S-13): only the empty slot stays reusable; no confirmation UI.
- No phase colors (S-05 deferred).
- No optimistic concurrency / version check (last write wins; two tabs editing one timer overwrite each other). Recorded as an assumption.
- No partial `PATCH`; no editing from `/dashboard` cards; no rename of the route family (`/{id}` stays).
- No change to run behavior (`DrillApp` run lifecycle, Restart/Cancel contracts).
- No new dependencies and no new UI primitives unless the shadcn registry lacks one (none expected).

## Implementation Approach

Three phases, each independently green: (1) server side — store `update`, service/handler, `PUT /api/drills/[id]`, types/messages, tests, pgTAP; (2) UI — route, protection, edit controller/hook/form wiring, `Edit` action; (3) evidence — `/dev/timer-ui` fixtures, smoke, screenshots, docs. The edit form is `DrillCreateForm` + `createDrillCreateController` generalized by options (prefilled name, keep values on success, submit label, saved-message source) instead of a copy.

## Phase 1: Update service, API and database tests

### Overview

`PUT /api/drills/{id}` that validates exactly like save, updates only the caller's row and answers a uniform 404 for foreign, missing and non-UUID ids.

### Changes Required:

#### 1. Types and messages

**File**: `src/types.ts`, `src/lib/services/drill-configurations.ts`

**Intent**: Add the not-found outcome to the shared error vocabulary so save and update share one response type.

**Contract**: `SaveDrillErrorCode` gains `"not_found"`; `STATUS_BY_CODE.not_found = 404`; `SAVE_DRILL_MESSAGES.not_found` = `OPEN_DRILL_MESSAGES.notFound` text (“This timer does not exist or is not yours.”, no id echoed); `SAVE_DRILL_MESSAGES.unauthorized` is generic enough for edit or gets a sibling message “Sign in to save changes.” (implementer decides, keep one message per code).

#### 2. Store port

**File**: `src/lib/services/drill-configurations.ts`

**Intent**: Add an `update` method to `DrillConfigurationStore` and its Supabase adapter; the adapter restricts by `id` and `user_id` (defense in depth over RLS), sends only the six user-owned columns and returns the row without `user_id`.

**Contract**: `update(id: string, userId: string, fields: DrillConfigurationUpdate): PromiseLike<FindResult>` where `DrillConfigurationUpdate` is `Omit<DrillConfigurationInsert, "user_id">`; Supabase: `.from("drill_configurations").update(fields).eq("id", id).eq("user_id", userId).select(SAVED_DRILL_COLUMNS).maybeSingle<SavedDrillRow>()`. Existing fakes in `src/lib/services/*.test.ts` get an `update`.

#### 3. Service and handler

**File**: `src/lib/services/drill-configurations.ts`

**Intent**: `updateDrillConfiguration` mirrors `saveDrillConfiguration` (validate with `validateSaveDrillRequest`, call the store, classify errors, never log payload/message); `handleUpdateDrillRequest` mirrors `handleSaveDrillRequest` and shares its body-reading steps (extract a small `readJsonRequest` helper rather than duplicating).

**Contract**: Order of checks: no user → 401; no store → 503; `!isDrillId(id)` → 404 (never touches the store); not JSON → 415; body too large → 413; invalid encoding/JSON → 400; validation → 400 with `fieldErrors`; store: `data: null` → 404, error `23505` + index → 409 `duplicate_name` with `fieldErrors.name`, unauthorized codes → 401, `PGRST205`/`42P01` → 503, else 500 (log code only); success → 200 `{ ok: true, drill }` via `savedDrillFromRow`, `Cache-Control: no-store`. The id is lower-cased with `normalizeDrillId` before the query. A non-object `data` is `unexpected`, not success.

#### 4. API route

**File**: `src/pages/api/drills/[id].ts` (new)

**Intent**: Thin Astro adapter exporting `prerender = false` and `PUT`, reusing `locals.user` / `locals.supabase` exactly like `index.ts`.

**Contract**: `PUT` → `handleUpdateDrillRequest(request, { id: params.id ?? "", userId, store })`. Other methods get Astro's default 405 (verify it carries no body detail about ownership).

#### 5. Unit tests

**File**: `src/lib/services/drill-configurations.test.ts` (extend) or new `src/lib/services/drill-update.test.ts`

**Intent**: Cover the update matrix with fake stores.

**Contract**: success 200 maps row and sends only the six columns (no `user_id`, no `id`, no timestamps); same validation table as save for update (name 1/200/201 code points, NFC/NFD, control chars, ranges, unknown fields); `null` → 404 identical body for any id; non-UUID/odd-case/trailing-space ids (404 without store call; upper-case UUID is lower-cased); duplicate → 409 with `fieldErrors.name`; 401/503/415/413/400 order; thrown store → 500, empty/odd data → 500; log content is only the code; `PUT` with `text/plain` and `application/x-www-form-urlencoded` → 415 without a store call (CSRF assumption); a handler test that the foreign-row case (store returns null) and the missing-row case are byte-identical.

#### 6. pgTAP

**File**: `supabase/tests/database/drill_configurations.test.sql`

**Intent**: Lock the database contract the edit relies on, in the existing transaction style.

**Contract**: add (and bump `plan`): B `update ... where id = <A row>` returns zero rows (`returning` count) and A's row verified unchanged by id as A; renaming one own row to another own row's name in a different case → 23505 naming `drill_configurations_user_name_key`; the same rename to a name another user owns succeeds; updating one row leaves siblings' columns and `updated_at` unchanged; the user at the 50-row limit (`L`) can update a row; user B cannot move a row to A with `user_id` (already covered — keep, reference only).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Types pass: `npx astro sync && npx astro check`
- pgTAP passes against the shared local stack (no reset): `npx supabase test db`
- No migration added: `git diff --name-only main -- supabase/migrations` is empty
- Build passes: `npm run build`

#### Manual Verification:

- `curl`/script against `npm run preview` with a signed-in user: `PUT` own id → 200 and new values; `PUT` foreign id, random UUID and `not-a-uuid` → identical 404 body and headers; duplicate name → 409; case-only rename → 200; guest → 401.

**Implementation Note**: After this phase and its automated checks, pause for manual confirmation before Phase 2.

---

## Phase 2: Edit page, protection and the Edit action

### Overview

`/{id}/edit` renders the prefilled form for the owner; `/{id}` gets an `Edit` action; protection rules know the new path.

### Changes Required:

#### 1. Protection

**File**: `src/lib/protected-routes.ts` (+ `protected-routes.test.ts`)

**Intent**: `/{uuid}/edit` needs a session exactly like `/{uuid}`, with the same normalization (case, trailing/doubled slash, encoding); nothing else becomes protected.

**Contract**: `SAVED_DRILL_PATH` accepts an optional `/edit` segment; `isSavedDrillPath` covers both. Tests: `/{uuid}/edit`, `/{UUID}/edit/`, `//{uuid}/edit`, `%2F` forms protected; `/{uuid}/edits`, `/{uuid}/edit/x`, `/not-a-uuid/edit` public (404 for all).

#### 2. Edit controller, port and hook

**File**: `src/lib/drill-create-controller.ts`, `src/components/hooks/useDrillCreate.ts` (+ tests in `drill-create-controller.test.ts`)

**Intent**: Reuse the controller for edit through options, not a copy: initial name, keep name/values after success, and a `PUT` port.

**Contract**: `createDrillCreateController(saveDrill, options?: { initialName?: string; keepAfterSave?: boolean })` (defaults keep today's create behavior, which is covered by existing tests); with `keepAfterSave` the snapshot after success keeps `name` = saved name and `status: "saved"`, `savedName` set, and the next `setName` returns to `idle`. `putSaveDrill(id)` returns a `SaveDrillPort` built on a shared request helper with `postSaveDrill` (method, URL and a per-port status fallback map; response guard unchanged). POST keeps today's map (`409 → limit_reached`); PUT uses `409 → duplicate_name`, `404 → not_found` (tested with an unreadable body). Add `markEdited()` to the controller (`saved`/`error` → `idle`, clearing `savedName`/`failure`, no-op while `saving`) and call it from `onValuesChange` in `DrillEditApp`, so `Saved "…"` or an alert never outlives a change of parameters (review F2); typed name and values are kept on every failure. `failureFrom` treats `not_found` as an alert-level failure (not a name error). `useDrillCreate(saveDrill, options)` passes options through.

#### 3. Form reuse

**File**: `src/components/timer/DrillCreateForm.tsx`

**Intent**: Parameterize what differs between create and edit with optional props and keep the component presentational.

**Contract**: optional `submitLabel` (default `Save timer`; pending label stays `Saving…`) and failure link slot: for `failure.code === "not_found"` show a `Back to dashboard` link (like the `unauthorized` sign-in link; the sign-in link target becomes a prop `signInHref`, default `SIGN_IN_FOR_CREATE_HREF`, edit passes `/auth/signin?next=%2F{id}%2Fedit`). Uses existing `Alert`, `Input`, `Label`, `buttonVariants`; semantic tokens only.

#### 4. Edit app and page

**File**: `src/components/timer/DrillEditApp.tsx` (new), `src/pages/[id]/edit.astro` (new)

**Intent**: Mirror `DrillCreateApp` (Card shell, `h1` “Edit timer”, `ThemeToggle`) with initial values from the stored configuration; the page mirrors `[id].astro` branch by branch.

**Contract**: `DrillEditApp({ drill: SavedDrill })`: initial values from a new pure `configInputFromSavedDrill(configuration): DrillConfigInput` in `src/lib/saved-drill-summary.ts` built on `formatPhaseTime` (`src/lib/drill-phase-sections.ts`), unit-tested round-trip with `parseDrillConfig` (0:00, 10:00, random start, review F5); `useDrillCreate(putSaveDrill(drill.id), { initialName: drill.name, keepAfterSave: true })`; after save links `Back to timer` → `/{id}`, `Back to dashboard`. Page: `prerender = false`, `Cache-Control: private, no-store`, `resolveSavedDrillPage(user?.id ?? null, id, store)`; `sign_in` → 302 to `signInUrlForProtectedPath("/" + id + "/edit")` (set on the response like `[id].astro`), `not_found` → shared `NotFoundView` with status 404, `unavailable` → 503 view with `OPEN_DRILL_MESSAGES.unavailable`, `ok` → `DrillEditApp client:load` with `noindex`. The unavailable/404 views must not echo the id.

#### 5. Edit action and reserved Delete slot

**File**: `src/components/timer/SavedDrillDetails.tsx`

**Intent**: Put the `Edit` link into the existing `saved-drill-actions` container (outline `buttonVariants` link to `/{drill.id}/edit`, accessible name “Edit timer”), keeping the container as the place where S-13 adds `Delete` (comment updated; no Delete code).

**Contract**: `<a href={`/${drill.id}/edit`}>` styled with `buttonVariants({ variant: "outline" })`; container no longer `empty:hidden`-hidden in practice but the class may stay for S-13 safety. Start remains the primary action.

#### 6. Lint scope

**File**: `eslint.config.js`

**Intent**: Put both dynamic pages under the timer UI contract with globs that really match (review F1), fix any violations this reveals in the existing `[id].astro` within this change (note them in the handoff), and keep a permanent proof.

**Contract**: files list uses `src/pages/[[]id[]].astro` and `src/pages/[[]id[]]/edit.astro`; a persistent test (in `scripts/eslint-rules/timer-ui-contract.test.mjs` or a CI step with `eslint --stdin --stdin-filename`) asserts that a literal color in each of the two files is reported by `timer-ui/contract`.

### Success Criteria:

#### Automated Verification:

- Unit tests (controller options, port, protection; after a 409/400/404 the controller and form keep the typed name and parameter values; a case-only rename of the own name sends the request and succeeds): `npm test`
- Lint incl. contract rule on the new files: `npm run lint`
- Rule tests: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`
- Types: `npx astro sync && npx astro check`
- Build: `npm run build`
- Both `[id].astro` and `[id]/edit.astro` are covered by the timer UI contract (persistent test/CI step from the lint-scope change)
- Create flow unchanged: existing `drill-create-controller` tests green without edits to their expectations

#### Manual Verification:

- Owner: `/{id}` → Edit → prefilled form → change name and a parameter → `Saved "…"` → Back to timer shows the new data; Start runs the new parameters.
- Changing a parameter after `Saved "…"` removes the message (no stale success); duplicate name shows the field error and every typed value (name and parameters) stays in the form; case-only rename of the own name saves (no self-collision); the 201st code point is refused with the name error.
- Foreign id, random UUID and non-UUID at `/{x}/edit` show the identical 404; guest on `/{uuid}/edit` is sent to sign-in with `next=/{uuid}/edit`, guest on `/not-a-uuid/edit` gets 404.
- Keyboard: Tab order Name → fields → Save; focus lands on the name after saving (existing behavior); Edit link has a visible focus ring.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Fixtures, smoke, screenshots and docs

### Overview

Production-backed evidence and the documentation the repo's own rules require.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/CreateDrillFixtures.tsx` (or new `EditDrillFixtures.tsx`), `src/components/timer/SavedDrillFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Extend `/dev/timer-ui` with the edit form states (default prefilled, saving, saved, name error duplicate, validation error, not-found alert, unavailable) and the details view with the `Edit` action, using the production components with deterministic props; disabled/loading justified where N/A (saving covers disabled/loading).

**Contract**: fixtures drive `DrillCreateForm` / `DrillEditApp` pieces through props only; no network.

#### 2. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Local-mode steps with the existing two-account structure: first user edits own timer (200, dashboard shows new name, other timer untouched), duplicate and case-only rename, 200-char boundary (200 ok, 201 → 400), guest `PUT` → 401, second user `PUT` on the first user's id / random UUID / `not-a-uuid` → identical 404 (status, body, headers) and the first user's timer unchanged; page checks `/{id}/edit` guest → 302 with `next`, second user → 404 identical to random UUID, owner → 200 with prefilled name, `noindex`, `no-store`. Remote mode: only guest checks (`PUT` 401, `/{uuid}/edit` redirect).

#### 3. Screenshots and gate

**File**: `context/changes/edit-saved-drill/screenshots/`

**Intent**: Capture the states in light/dark at 1280/390 px per the repo's visual gate, review them, and keep a short README and results file as in `open-saved-drill/screenshots/`.

#### 4. Docs

**File**: `AGENTS.md`, `README.md`

**Intent**: Add `/{id}/edit` and its fixtures to the UI rules/lint scope note and the routes table (Protected: edit one saved timer; foreign/unknown/non-UUID give the same 404); mention `PUT /api/drills/{id}` where the API is described. Update the handoff file `context/changes/edit-saved-drill/handoff.md` at phase ends.

### Success Criteria:

#### Automated Verification:

- All Phase 1–2 gates still green: `npm test`, `npm run lint`, `npx astro check`, `npm run build`, `npx supabase test db`
- Smoke (local mode against `npm run preview`) passes including the new edit steps: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`
- `/dev/timer-ui` is 404 in the production preview

#### Manual Verification:

- Screenshots reviewed (default, hover, focus-visible, disabled/saving, error, empty or justified N/A, loading) light/dark at 1280/390; existing seven-state timer gate unaffected.
- Final human click-through of the edit flow in a real browser (including bfcache Back after saving).

---

## Testing Strategy

### Unit Tests:

- Update service/handler matrix (see Phase 1.5), controller options (`keepAfterSave`, `initialName`, `not_found` mapping, double-submit latch unchanged), `putSaveDrill` request shape and fallback mapping, protection cases, m:ss prefill round-trip (`savedDrillFromRow` → input → `parseDrillConfig` yields the same configuration).

### Integration Tests:

- pgTAP for the database contract; smoke for the HTTP and page contract with two accounts.

### Manual Testing Steps:

1. Edit name only, parameters only, both; reload `/{id}` and `/dashboard` (order is by `created_at`, so an edit does not reorder the list).
2. Duplicate vs case-only rename; 200/201 character names; emoji and NFD input.
3. Delete the row elsewhere (SQL) and press Save → not-found alert with dashboard link.
4. Sign out in another tab and press Save → unauthorized alert with sign-in link back to `/{id}/edit`.

## Performance Considerations

One indexed single-row update by primary key; no extra reads (the update returns the row). The advisory-lock insert trigger is not involved.

## Migration Notes

None. Production already has the table, policy, grant and trigger from S-10; nothing to `db push` for S-12.

## References

- Roadmap: `context/foundation/roadmap.md` (S-12, FR-012)
- Prior changes: `context/changes/save-named-drill/handoff.md`, `context/changes/open-saved-drill/handoff.md`
- Migration: `supabase/migrations/20261007120000_create_drill_configurations.sql`
- Service: `src/lib/services/drill-configurations.ts` (`saveDrillConfiguration`, `handleSaveDrillRequest`, `resolveSavedDrillPage`)
- Form/controller: `src/components/timer/DrillCreateForm.tsx`, `src/lib/drill-create-controller.ts`
- Reserved actions slot: `src/components/timer/SavedDrillDetails.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Update service, API and database tests

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 18ab13b
- [x] 1.2 Lint passes: `npm run lint` — 18ab13b
- [x] 1.3 Types pass: `npx astro sync && npx astro check` — 18ab13b
- [x] 1.4 pgTAP passes against the shared local stack (no reset): `npx supabase test db` — 18ab13b
- [x] 1.5 No migration added: `git diff --name-only main -- supabase/migrations` is empty — 18ab13b
- [x] 1.6 Build passes: `npm run build` — 18ab13b

#### Manual

- [x] 1.7 PUT checks against `npm run preview` (own 200, foreign/random/non-UUID identical 404, duplicate 409, case-only 200, guest 401) — confirmed manually by the user (2026-10-08)

### Phase 2: Edit page, protection and the Edit action

#### Automated

- [x] 2.1 Unit tests (controller options, port, protection): `npm test` — cdb5c70
- [x] 2.2 Lint incl. contract rule on the new files: `npm run lint` — cdb5c70
- [x] 2.3 Rule tests: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs` — cdb5c70
- [x] 2.4 Types: `npx astro sync && npx astro check` — cdb5c70
- [x] 2.5 Build: `npm run build` — cdb5c70
- [x] 2.6 Create flow unchanged: existing `drill-create-controller` tests green without edits to their expectations — cdb5c70
- [x] 2.11 Both `[id].astro` and `[id]/edit.astro` are covered by the timer UI contract (persistent test or CI step) — cdb5c70

#### Manual

- [x] 2.7 Owner edit flow end to end (prefilled form, Saved message, Back to timer shows new data, Start runs new parameters) (by Playwright script, not a human; production preview, real browser) — 5eeb36d
- [x] 2.8 Duplicate name, case-only rename and 200/201 code point boundary in the form (by Playwright script, not a human; emoji/NFD input not covered) — 5eeb36d
- [x] 2.9 Foreign/random/non-UUID `/{x}/edit` identical 404; guest redirects as specified (by Playwright script, not a human) — 5eeb36d
- [x] 2.10 Keyboard order, focus after saving and visible focus on the Edit link (by Playwright script, not a human; no screen reader) — 5eeb36d

### Phase 3: Fixtures, smoke, screenshots and docs

#### Automated

- [x] 3.1 All Phase 1–2 gates still green: `npm test`, `npm run lint`, `npx astro check`, `npm run build`, `npx supabase test db` — 5eeb36d
- [x] 3.2 Smoke (local mode) passes including the new edit steps: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` (scratchpad copy with GoTrue `generate_link` instead of Mailpit; CI runs the repo script with Mailpit) — 5eeb36d
- [x] 3.3 `/dev/timer-ui` is 404 in the production preview — 5eeb36d

#### Manual

- [x] 3.4 Screenshots reviewed (all states, light/dark, 1280/390); existing seven-state gate unaffected — confirmed manually by the user (2026-10-08)
- [x] 3.5 Final human click-through of the edit flow in a real browser (including bfcache Back after saving) — confirmed manually by the user (2026-10-08)
