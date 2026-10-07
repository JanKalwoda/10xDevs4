# Handoff — edit-saved-drill (S-12)

Worktree `D:\Dev\10xDevs4-edit-saved-drill`, branch `feature/edit-saved-drill`. Plan reviewed (F1–F5 accepted and applied, `reviews/plan-review.md`). No migration, no `db push`, no `db reset`.

## Phase 1 — implemented: update service, API, pgTAP

Delivered:

- `src/types.ts`: `SaveDrillErrorCode` gains `not_found`.
- `src/lib/services/drill-configurations.ts`
  - `SAVE_DRILL_MESSAGES.not_found` (same text as `OPEN_DRILL_MESSAGES.notFound`, which now reuses it), `STATUS_BY_CODE.not_found = 404`.
  - `DrillConfigurationStore.update(id, userId, fields)` + Supabase adapter: `.update(fields).eq("id").eq("user_id").select(SAVED_DRILL_COLUMNS).maybeSingle()` (RLS plus an explicit user filter; only the six user-owned columns). `DrillConfigurationUpdate` type.
  - `updateDrillConfiguration` (id guard first, then `validateSaveDrillRequest`, store call, `null` → `not_found`, 23505 + index → 409 `duplicate_name` with `fieldErrors.name`, a limit error is mapped to `unexpected` because the trigger is INSERT-only, only the error code is logged) and `handleUpdateDrillRequest` (401 → 503 → 404 bad id → 415 → 413 → 400 → service). POST and PUT share `readJsonRequest` (extracted from `handleSaveDrillRequest`, behavior unchanged).
- `src/pages/api/drills/[id].ts`: `PUT` only (`prerender = false`).
- Tests: `src/lib/services/drill-update.test.ts` (new, 13 tests incl. CSRF content types and byte-identical 404 for foreign/missing/non-UUID); existing store fakes got `update`. `npm test` 169/169.
- pgTAP `plan(90)`: B updating A's row by id → zero rows and A's row unchanged by id; rename colliding with another own row (any case) → 23505 naming `drill_configurations_user_name_key`; the same name as another user's row allowed; update of one row moves only that row's `updated_at`; B's row untouched by A; a user at the 50-row limit can update and the count stays 50.

Gates (local): `npm test` 169/169; `npm run lint` clean; `npx astro sync && npx astro check` 0 errors (1 pre-existing hint); `npm run build` OK; `npx supabase test db` 90/90 PASS on the shared stack (no reset); `git diff --name-only main -- supabase/migrations` empty.

Break-check: removing the `isDrillId` guard in `updateDrillConfiguration` turned "a non-UUID id is the same 404 and never reaches the store" red; reverted, green again.

Manual 1.7 was executed **by a script, not a human** (production preview on port 4399, two throw-away users via GoTrue admin + password grant, session cookie built by hand, users deleted afterwards): own PUT 200 + `no-store`; case-only rename 200; duplicate 409 with the name field error; 200 characters 200 and 201 → 400; foreign id, random UUID and `not-a-uuid` → byte-identical 404 (status, body, `cache-control`, `content-type`), foreign id absent from the body; B's and A's sibling timers unchanged; guest 401; `text/plain` and form-urlencoded (same origin, signed in) 415; bad JSON 400. Row 1.7 is therefore left unchecked for a human.

Observation (CSRF, review F4): a cross-origin `text/plain`/form PUT is already stopped earlier by Astro's `checkOrigin` with 403 (before the handler); the handler's 415 is the second layer and is what unit tests pin. Cross-origin JSON PUT cannot be sent without a CORS preflight.

Local files copied into the worktree for the preview (gitignored): `.env`, `.dev.vars`; `npm ci` was run here.

## Phase 2 — implemented (cdb5c70): edit page, protection, Edit action

Delivered:

- `src/lib/protected-routes.ts`: `SAVED_DRILL_PATH` accepts an optional `/edit`; `/{uuid}/edit` (any case, `/`, `//`, `%2F`, `%65dit`) needs a session; `/{uuid}/edits`, `/{uuid}/edit/x`, `/not-a-uuid/edit` stay public (same 404). Tests in `protected-routes.test.ts`.
- `src/lib/drill-create-controller.ts`: options `{ initialName, keepAfterSave }`, `markEdited()` (saved/error → idle, drops `savedName`/`failure`, keeps typed name and a name error, no-op while saving or idle, no notification then), shared `requestSaveDrill`; `postSaveDrill` unchanged (409 → `limit_reached`), new `putSaveDrill(id)` (409 → `duplicate_name`, 404 → `not_found`; a readable server body always wins). `not_found` was already an alert-level failure in `failureFrom` (no change needed). 24 controller tests; the 14 existing ones were not edited (only the import line).
- `useDrillCreate(saveDrill, options)` passes options through and exposes `markEdited`.
- `DrillCreateForm`: optional `submitLabel` (default `Save timer`) and `signInHref` (default `SIGN_IN_FOR_CREATE_HREF`); `not_found` alert shows a `Back to dashboard` link.
- `DrillEditApp` (h1 `Edit timer`, `Save changes`, sign-in link `next=/{id}/edit`, `onValuesChange` → `setValues` + `markEdited`, links `Back to timer` and `Back to dashboard` are always visible) and `src/pages/[id]/edit.astro` (mirror of `[id].astro`: guest → 302 with `next=/{id}/edit`, 404 via `NotFoundView`, 503 view, `noindex`, `private, no-store`).
- `configInputFromSavedDrill` in `saved-drill-summary.ts` (new `saved-drill-summary.test.ts`: round-trip with `parseDrillConfig` for 0:00, 10:00, random start, 1:01).
- `SavedDrillDetails`: `Edit timer` outline link in `data-slot="saved-drill-actions"`; the container and its comment keep the room for S-13 Delete (no Delete code).
- `eslint.config.js`: globs `src/pages/[[]id[]].astro` and `src/pages/[[]id[]]/edit.astro`. **The existing `[id].astro` had no contract violations** once it was really linted (nothing to fix). Persistent proof: `timer-ui-contract.test.mjs` asserts the rule is enabled for both files and reports a literal color in each.

Gates (local, worktree): `npm test` 183/183; `npm run lint` clean; rule tests 5/5; `npx astro sync && npx astro check` 0 errors (1 pre-existing hint); `npm run build` OK; `npx supabase test db` 90/90 PASS (shared stack, no reset); no migration.

Break-checks (all went red, restored with `git checkout`): regex without `(?:/edit)?` → the "edit path protected" test; `markEdited` made a no-op → 2 controller tests; old glob `src/pages/[id].astro` → the coverage test.

Extra evidence (scripted, not a human): production preview on port 4323, two throw-away users via GoTrue admin (deleted afterwards): owner `/{id}` shows the Edit link; owner `/{id}/edit` 200, `noindex`, `no-store`, SSR markup has the stored name, `0:05/0:04/0:02`, `Save changes` and the back links; foreign id, random UUID and `not-a-uuid` at `/{x}/edit` → identical 404 (bodies and headers), id not echoed; guest `/{uuid}/edit` → 302 `next=/{uuid}/edit`, guest `/not-a-uuid/edit` → 404 identical to `/not-a-uuid`; case-only rename PUT → 200 and the edit page shows the new values; `/dev/timer-ui` 404 in the preview. Manual rows 2.7–2.10 stay **unchecked** for a human.

Notes for Phase 3:

- The full local smoke (`npm run smoke`, local mode) cannot run here: it needs Mailpit on `localhost:55324` (the shared stack runs without it) and only accepts `http://localhost:4321` / `4323` as app origin. New smoke steps for edit have to be written against that script, then verified where Mailpit exists (CI starts it) or with a session-cookie shortcut like the script used above.
- `/dev/timer-ui` fixtures for the edit form (default prefilled, saving, saved, duplicate name error, validation error, not-found alert, unauthorized, unavailable) and the details view with the `Edit` action are still to do (`CreateDrillFixtures.tsx`, `SavedDrillFixtures.tsx`); `DrillCreateForm` now takes `submitLabel` and `signInHref`.
- PUT validation errors reach the form through the same `failureFrom` path as POST.

## Phase 3 — implemented (5eeb36d): fixtures, smoke, screenshots, docs

Delivered:

- `src/components/timer/EditDrillFixtures.tsx` (new, in `/dev/timer-ui` after the create fixtures): production `DrillCreateForm` with `submitLabel="Save changes"` and the edit `signInHref`, plus `DrillEditLinks` (extracted from `DrillEditApp`, so the fixtures and the page share the back links). Cards: default (prefilled via `configInputFromSavedDrill`, 0:00 rest / 10:00 exercise / random start), saved, saving (disabled and loading), name required, duplicate name, invalid parameters (inline error after pressing Save, scripted), server validation alert, not found (alert + `Back to dashboard`), session expired (sign-in link back to `/{id}/edit`), unavailable. Empty is justified N/A (the form is always prefilled).
- `SavedDrillFixtures.tsx`: the details card now shows the `Edit timer` action (description updated).
- `scripts/smoke.mjs` (local): owner edit (PUT 200, dashboard, `/{id}` Edit link, `/{id}/edit` 200 + noindex + no-store + prefilled values, the other timer untouched), duplicate 409, case-only rename 200, 200/201 characters, invalid 400, text/plain 415, edit at the 50-timer limit, guest PUT 401 / `/{id}/edit` 302 with `next` / `/not-a-uuid/edit` 404 identical to `/not-a-uuid`, second account's PUT and `/{x}/edit` page identical 404s (status, body, headers; id and name absent) for a foreign, a random and a malformed id, first account's timers unchanged afterwards. The limit loop now starts at index 3 (two timers are saved before it). Remote mode: guest PUT 401 + `/{uuid}/edit` redirect.
- `screenshots/` (61 files): 1280/390, light/dark; `gate-results.json` 161 checks 0 failed; `e2e-results.json` 33 checks 0 failed; README with the state table.
- `AGENTS.md` (UI rule and fixtures for `/{id}/edit`, the glob note) and `README.md` (routes table row, API line `POST` / `PUT`).

Gates (local, worktree): `npm test` 183/183; `npm run lint` clean; rule tests 5/5; `npx astro sync && npx astro check` 0 errors (1 pre-existing hint); `npm run build` OK; `npx supabase test db` 90/90 PASS (shared stack, no reset); no migration; no `db push`/`db reset`. `/dev/timer-ui` 404 on the production preview.

Smoke: the shared stack has no Mailpit, so the local smoke was run as a scratchpad copy of `scripts/smoke.mjs` where only `waitForEmail` is replaced by GoTrue admin `generate_link` (and the error is printed); everything else is repo code. All 33 steps passed against `npm run preview` on port 4321 (including both new edit steps and the existing ones); the repo script in remote mode also passed. CI runs the real script with Mailpit.

Break-check (smoke): with the `isDrillId` guards removed from `updateDrillConfiguration` / `handleUpdateDrillRequest` the smoke step "second account's PUT and /edit page give identical 404s…" went red; restored with `git checkout`, working tree clean.

Rows 2.7–2.10 were executed **by a Playwright script, not a human** (production preview, real browser, two throw-away users via GoTrue admin, deleted afterwards) and are checked in the plan with that annotation: owner flow including Start running the new parameters (`Repetition 1 of 1`, exercise from 0:02); duplicate / case-only / 200 / 201; foreign, random and non-UUID `/{x}/edit` identical 404, guest redirects; Tab order, focus after save, focus rings. Extra scripted: a row deleted behind the form (not-found alert) and a cleared session (unauthorized alert with a sign-in link back to the edit page). Visual-gate note: the preview page is 414 px wide at 390 px even without the new section (existing preview content), so the check asserts only that the edit section does not widen it.

Still open for a human: 1.7 (scripted in Phase 1, left unchecked), 3.4 (review of the screenshots; the existing seven-state timer gate was not re-screenshotted, only a section was added to `TimerUiPreview`) and 3.5 (final click-through in a real browser, including bfcache Back after saving; also emoji/NFD names, real devices, sound, screen reader).

## Review fixes — impl-review (APPROVED, 0 critical / 2 warnings / 2 observations)

One follow-up commit; decisions are in `reviews/impl-review.md`.

- **F1** `src/lib/drill-create-controller.ts`: `markEdited` during `saving` sets `editedDuringSave`; the reply then publishes `idle` without `savedName` / alert (name error kept, name per `keepAfterSave`). 3 new controller tests (27 in the file); break-check red without the flag.
- **F2** `screenshots/hover-{light,dark}-1280.png` re-captured with a real `hover()` (not byte-identical to `default-*` any more); README hover row unchanged in meaning.
- **F3** accepted as-is: 1.7, 3.4, 3.5 and human confirmation of 2.7–2.10 stay with the user.
- **F4** `src/pages/api/drills/[id].ts` `ALL` → `methodNotAllowedResponse()` (405, `Allow: PUT`, `no-store`, empty body); unit test plus a check on the production preview (GET/POST/PATCH/DELETE → 405). DELETE is not implemented (S-13).

Gates (local, worktree): `npm test` 187/187; `npm run lint` clean; rule tests 5/5; `npx astro check` 0 errors (1 pre-existing hint); `npm run build` OK; `npx supabase test db` 90/90 PASS (shared stack, no reset); no migration, no `db push`/`db reset`.

