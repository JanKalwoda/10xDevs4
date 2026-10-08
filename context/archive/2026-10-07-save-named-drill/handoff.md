# Handoff — save-named-drill (S-10)

Worktree `D:\Dev\10xDevs4-save-named-drill`, branch `feature/save-named-drill`. Plan reviewed (F1–F7 accepted and applied); no `db push` has been run.

## Phase 1 — DONE (commit 98e14ac): migration, RLS, pgTAP, CI step

Delivered:

- `supabase/migrations/20261007120000_create_drill_configurations.sql`
  - `public.drill_configurations`: `id`, `user_id` (default `auth.uid()`, FK `auth.users` on delete cascade), `name`, `preparation_seconds`, `exercise_seconds`, `rest_seconds`, `repetitions`, `random_start_enabled`, `created_at`, `updated_at`. No color column.
  - Named CHECKs: `drill_configurations_name_length` (1–200 code points), `_name_trimmed`, `_name_nfc`, `_name_no_control_chars` (`[\x01-\x1f\x7f-\x9f]`), `_preparation_range` (0–600), `_exercise_range` (1–600), `_rest_range` (0–600), `_repetitions_range` (1–100).
  - Unique index `drill_configurations_user_name_key` on `(user_id, lower(name))`. The service must map `23505` + this index name to `duplicate_name`.
  - Limit: `BEFORE INSERT` trigger `enforce_drill_configuration_limit()` (advisory lock per user, VOLATILE, `security invoker`); raises `errcode 54000`, message `drill_configuration_limit_reached`. The service must map `54000` to `limit_reached`.
  - `set_updated_at()` `BEFORE UPDATE` trigger.
  - Grants: `anon` has nothing. `authenticated`: table-level `select, delete`; column-level `insert (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)` and `update (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)`. So `id`, `created_at`, `updated_at` are never client-writable and `user_id` is insert-only. EXECUTE on both trigger functions revoked from `public`, `anon`, `authenticated`.
  - Four policies `to authenticated` on `(select auth.uid()) = user_id` (select / insert with check / update using + with check / delete).
- `supabase/tests/database/drill_configurations.test.sql`: 66 pgTAP assertions (structure, RLS, anon, ownership, forbidden columns, name rules incl. astral/NFD/control chars, ranges, `updated_at`, limit incl. multi-row boundary and VOLATILE check, cascade).
- `.github/workflows/ci.yml`: new step "Run database tests (pgTAP)" in the `smoke` job right after "Start local Supabase", with one retry on `docker.io`.
- `README.md`: new "Database" section (migrate, test, production order, shared-stack warning); the old "no migrations required" sentence is gone.

## Gates (all green)

- `supabase migration up` applied `20261007120000`; `migration list --local` shows it local and remote (local DB).
- `supabase test db`: 66/66, PASS (pulled the `pg_prove:3.36` image).
- Break-check (six deliberate breaks, each run in a rolled-back transaction, then DB state re-verified intact): permissive insert policy → 15 and 17 red; `STABLE` limit function → 61, 62, 63, 65 red; no NFC constraint → 39 red; case-sensitive unique index → 41 red; `anon` granted select → 9 red; `created_at` updatable → 26 red.
- Rollback dry-run in a rolled-back transaction (drop table + both functions) leaves no `drill_configurations%` objects.
- `npm run lint` etc. were not part of Phase 1 criteria (no TS changes). `prettier --check` warns on `ci.yml` and `README.md` already on `main` (pre-existing).

## Not done / needs a human or the coordinator

- Progress 1.5 (read the migration against the Contract) and 1.6 (rollback note verified) are manual and left unchecked. Evidence for 1.6 is the dry-run above.
- `db push` to production: coordinator, before merge.
- CI cannot be exercised before a PR head exists; the new `supabase test db` step (and its `pg_prove` image pull / docker.io retry) is verified locally only.

## Shared local Supabase

The local stack `10x-astro-starter` (ports 55321/55322) is shared by all worktrees. `migration up` was applied to it, so its history now has `20261007120000`; worktrees on `main` may see an unknown remote version on `migration up`, and any `db reset` / `supabase stop --no-backup` anywhere removes the table (restore with `npx supabase migration up` from this worktree). I used the main repo's CLI binary (`D:\Dev\10xDevs4\node_modules\.bin\supabase`, v2.117.0); `npm ci` has also been run in this worktree.

## For Phase 2

- Service error mapping: unique index name `drill_configurations_user_name_key` (SQLSTATE `23505`), `54000`, `PGRST205`/`42P01` (table missing), `PGRST301`/`PGRST303`/401 (JWT) per the plan.
- Insert payload may include `user_id` (column grant allows it); do not send `id`, `created_at`, `updated_at`.
- Bounds to export from `src/lib/drill-timer.ts` and check in the drift test: 600, 100, name 200, limit 50; constraint names above.

## Phase 2 — DONE (commit e8f40d1): validation, service, API route, route protection

Delivered:

- `src/lib/drill-timer.ts`: exported `MAX_DRILL_SECONDS = 600`, `MAX_REPETITIONS = 100`, used in `parseDrillConfig` (no behavior change). `src/types.ts`: `SavedDrill`, `SaveDrillRequest`, `SaveDrillErrorCode`, `SaveDrillFieldErrors`, `SaveDrillResponse`.
- `src/lib/services/drill-configurations.ts` (no runtime Supabase import): `validateSaveDrillRequest` (zod strict shape + `parseDrillConfig`, all field errors at once; name NFC, control characters/lone surrogates rejected BEFORE trim, then trim, length in code points), `DrillConfigurationStore` port + `createSupabaseDrillStore(client)`, `saveDrillConfiguration`, `classifyStoreError`, `savedDrillFromRow` (for S-11), `isJsonMediaType`, `readLimitedText` (4 KB; Content-Length and streaming cut-off, UTF-8 fatal) and `handleSaveDrillRequest` (whole pipeline: 401 → 503 → 415 → 413 → 400 → save). Messages are exported as `SAVE_DRILL_MESSAGES` (Phase 3 UI can reuse them). Logs carry only the error code.
- `src/pages/api/drills/index.ts`: thin `POST`, `prerender = false`, `Cache-Control: no-store`; uses `locals.user.id` and `locals.supabase` (one client, created by the middleware). Statuses: 201, 400 validation, 401, 409 (`duplicate_name`, `limit_reached`), 413, 415, 503 `unavailable`, 500 `unexpected`. Wire format: JSON `{ name, preparation, exercise, rest, repetitions, randomStartEnabled }` (m:ss strings, repetitions string, boolean), strict: unknown keys (e.g. `user_id`, `id`) are a 400.
- `src/lib/protected-routes.ts`: `PROTECTED_ROUTES = ["/dashboard", "/create"]`, `isProtectedPath` matches at a segment boundary on the decoded path with repeated slashes collapsed (`/%63reate`, `//create`, `/create/` protected; `/created` not). Middleware uses it and sets `context.locals.supabase` (`App.Locals.supabase: SupabaseClient | null` in `src/env.d.ts`).
- `package.json`: `test` also runs `src/lib/services/*.test.ts`.
- `scripts/smoke.mjs`: `appRequest` `json`/`contentType` options; anonymous 401 + `/create` redirect (local and remote); local: save 201, same name other case 409, invalid 400, `text/plain` 415, then fill to 48 and five concurrent names → exactly two 201 and three 409 `limit_reached`, plus a 51st → 409. Steps run in the first signed-in session before sign-out.

Tests (`npm test`: 124 pass, 24 new in `drill-configurations.test.ts` and `protected-routes.test.ts`): every validation branch, bounds vs `parseDrillConfig`, NFC/NFD, control chars, each error mapping (incl. `PGRST205`, `PGRST301/303`, 401), no payload in logs, media type, body cap (declared, streamed, multibyte), handler status order, drift test that reads the migration (CHECK bounds, limit 50, index name, errcode `54000`).

Gates: `npm test` 124/124; `npm run lint` clean; rule tests 4/4; `astro sync && astro check` 0 errors (one pre-existing hint in `SignalPreviewFixtures.tsx`); `npm run build` ok; `supabase test db` was not rerun (no DB change in this phase; 66/66 in Phase 1). Break-check: nine deliberate breaks (duplicate index check, media type, body cap, NFC, limit code, decode, segment boundary, constant drift, 401 status), each turned a test red and was reverted with `git checkout --`.

Local smoke: all 23 steps passed against the production preview on the shared local stack, remote mode (anonymous checks) passed too. Caveats: (1) the shared stack runs without Mailpit and its GoTrue container serves older email templates (subject `Your sign-in link`), so the unchanged `smoke.mjs` cannot pass the email steps here; I ran a scratchpad copy where only email retrieval is replaced by admin `generate_link`, every other step (including the new API ones) is the repo code. CI starts a fresh stack and uses the real Mailpit. (2) I briefly started a Mailpit container named `supabase_inbucket_10x-astro-starter` on the stack network and removed it afterwards; no DB, container or config of the stack was changed. (3) The smoke user left 50 rows in the shared local DB (`drill_configurations`); harmless, cascades with the user.

Manual items left unchecked (need a human): 2.7 and 2.8.
- 2.8 evidence: the signed-in smoke saved through real cookies → RLS → trigger; `select` on the DB shows the smoke user with 50 rows and exactly one owner.
- 2.7 not exercised end to end: dropping the table on the shared DB is not allowed. Evidence: a real PostgREST call for a missing table returns `PGRST205` / HTTP 404 (the code the service maps to `unavailable` → 503, unit tested through the handler), and no page queries the DB at render time. To check by hand, point a scratch stack without the migration at the app, or ask the coordinator.

For Phase 3:

- `.env` / `.dev.vars` exist in this worktree (gitignored, local stack credentials); stop any preview on 4321 when done.
- Reuse `SAVE_DRILL_MESSAGES` and the `SaveDrillResponse` type; `duplicate_name` carries `fieldErrors.name`; `unauthorized` is 401 (show a sign-in link); `unavailable` covers missing table and missing client.
- `/create` is already protected by the middleware, but the page does not exist yet (guests get the redirect; a signed-in user would see a 404 until Phase 3).
- Smoke Phase 3 step still to add: authenticated `GET /create` → 200 containing `Create a timer`.

## Phase 3 — DONE (commit 758c35b): /create page, form, hook, dashboard link

Delivered:

- `DrillConfigForm.tsx`: only additive optional props `submitLabel` (default `Start`), `leading`, `pending` (disables submit, `aria-busy`) and `onSubmitAttempt` (called at the start of every submit). `onStart` keeps its meaning.
- `src/lib/drill-create-controller.ts` (pure, no React): `createDrillCreateController(saveDrill)` with a synchronous double-submit latch, name validation through `normalizeDrillName` (NFC, control characters, 1–200 code points), error routing (`duplicate_name` / name field error → `nameError`; limit, unavailable, unexpected, unauthorized, validation without name → alert-level `failure`), success clears the name and keeps the parameters; plus `postSaveDrill` (default port: JSON POST to `/api/drills`, network failure → `unavailable`, unreadable reply → status-based code). The hook is thin on purpose, following the `drill-signal-preview-controller` pattern, so the logic is covered by `npm test` (`node --test` cannot resolve the `@/` alias, so React components cannot be rendered there).
- `src/components/hooks/useDrillCreate.ts` (hook over the controller), `src/components/timer/DrillCreateForm.tsx` (presentational; name `Input` with label, hint `1 to 200 characters`, no `maxLength`, `aria-invalid`/`aria-describedby`, `role="alert"` error; `Saved "<name>".` as `role="status"` Alert; destructive Alert for failures; sign-in link to `/auth/signin?next=%2Fcreate` for `unauthorized`; the name is read-only while saving and refocused after a save; submit `Save timer` / `Saving…`), `DrillCreateApp.tsx` (card shell, title `Create a timer`, `ThemeToggle`, link back to `/`).
- `src/pages/create.astro` (`enableTimerTheme`, `showConfigWarnings={false}`, no DB query at render), `src/pages/dashboard.astro` (one `Create a timer` link with `buttonVariants` + `cn`), `eslint.config.js` (`create.astro` in the timer-ui contract list), `scripts/smoke.mjs` (new step: dashboard links to `/create`, authenticated `GET /create` is 200 and contains `Create a timer` and `Save timer`).
- The client bundle of `/create` imports `normalizeDrillName` and `SAVE_DRILL_MESSAGES` from the service module, so zod ships to the browser on this page (accepted; the service has no runtime Supabase import).

Tests: `npm test` 138/138 (14 new in `drill-create-controller.test.ts`: valid save sends trimmed NFC name and clears it, invalid names (empty, whitespace, newline, tab, C1) never reach the port, 200 vs 201 astral code points, `submitAttempt`, double submit sends one request and ignores late keystrokes, duplicate on the name field, alert-level failures, server validation without name, rejecting port releases the latch, editing resets messages, subscribers, `postSaveDrill` happy path / network failure / unreadable replies). Break-check: removing the saving latch turned the double-submit test red; restored.

Gates (all green): `npm run lint`, `npm test`, rule tests 4/4, `astro sync && astro check` 0 errors (one pre-existing hint), `npm run build`, `prettier --check` on the new files. Local smoke against the production preview on the shared stack: all 24 steps passed (including the new `/create` step, save/duplicate/invalid/415, 50 limit with concurrent posts). Same caveat as Phase 2: the shared stack has no Mailpit, so I ran a scratchpad copy of `scripts/smoke.mjs` where only e-mail retrieval is replaced by the GoTrue admin `generate_link`; every other step is repo code (CI uses real Mailpit).

Evidence that `/` is unchanged: SSR HTML of `/` from a build with the Phase 3 `DrillConfigForm.tsx` and from a build with the previous file was byte-identical after normalising `/_astro/` asset names (20118 bytes each). It is a one-off diff, not a repo test.

Progress 3.4–3.7 (manual, in a browser) are left unchecked: guest → sign-in → back to `/create`, save/duplicate/limit/missing-table/session-expired flows in the real UI, keyboard-only flow with announcements, and running a drill at `/`. Not run: `db push`, `db reset`, any change to the shared stack. The preview server on 4321 is stopped. For Phase 4: fixtures should render `DrillCreateForm` with the props `status`, `failure`, `nameError`, `savedName`; note the `saved` state focuses the name input on mount (visible focus ring in the screenshot).

## Phase 4 — DONE (commit a91e810): visual gate and docs

Delivered:

- `src/components/timer/CreateDrillFixtures.tsx` (mounted in `TimerUiPreview.tsx` after `PhaseSectionsFixtures`; 2 added lines there): production `DrillCreateForm` in nine cards — default (= empty), filled, name-required, duplicate-name, limit-reached, saving (disabled + loading), unavailable, session-expired, saved. Hover and focus-visible on Save are scripted on the Filled card. Existing seven-state matrix and held-mounted lifecycle fixtures untouched.
- `context/changes/save-named-drill/screenshots/`: 36 PNGs (9 states × light/dark × 1280/390 incl. hover and focus-visible), `gate-results.json` (100 checks, 0 failed), `e2e-*.png` + `e2e-results-main.json` (19 checks) + `e2e-results-missing-table.json` (11 checks), README. All captured by Playwright scripts, **not a human**.
- `AGENTS.md`: one line that `/create` follows the timer UI contract and has fixtures; one line that `supabase test db` covers table RLS.

Gates (all green): `npm test` 138/138; `npm run lint` clean; rule tests 4/4; `astro sync && astro check` 0 errors (the one pre-existing hint); `npm run build`; production preview: `/dev/timer-ui` 404, `/` 200, guest `/create` 302 to `/auth/signin?next=%2Fcreate`. Gate-script break-check: `aria-invalid` forced to `false` in `DrillCreateForm` → 8 failed checks, reverted with `git checkout --`, gate rerun green (0 failed). Phase 4 adds no `npm test` tests (the gate is a script outside the repo dependencies, like earlier changes). No `db push`, no `db reset`, no schema change.

Browser steps from Phase 3, run by script (not human), marked in Progress: 3.4 guest → sign-in → `/create`; 3.5 save, duplicate in other case, limit (49 via API + 51st in UI), expired session (cookies cleared), missing table; 3.6 keyboard order and `role=alert`/`aria-invalid`/`aria-describedby`; 3.7 `/` starts, advances to Rest, Cancel returns. Caveats: sign-in link taken from GoTrue admin `generate_link` (no Mailpit on the shared stack); missing table is **simulated** by a forwarding proxy returning 404 `PGRST205` for `/rest/v1/drill_configurations` (`.dev.vars` temporarily pointed at it and restored; verify `SUPABASE_URL=http://127.0.0.1:55321`); no screen reader, no sound, no real e-mail. The e2e user is deleted by the script (rows cascade); dev servers and proxy are stopped.

Still open for a human: 4.4 (review of the screenshots in light/dark, 1280/390), 4.5 (optional phone check). Not done: `db push` (coordinator, before merge).

## Review fixes (2026-10-07)

Opus impl-review: APPROVED (0 critical / 1 warning / 5 observations); decisions are recorded in `reviews/impl-review.md`. Fixed in one commit: F1 (failure `Alert` above Save through the new `beforeSubmit` slot in `DrillConfigForm`), F2 (`54000` -> `limit_reached` only with the trigger's message/hint, unit tested, drift test reads the message from the migration), F3 (pgTAP asserts `prosecdef = false` and pinned `search_path` for both functions, `plan(70)`), F5 (note 2.7 cites the proxy evidence). F4 accepted as is; F6 left for a human. The migration is unchanged; no `db reset` / `db push` was run.

Gates after the fixes: `npm test` 139/139; `npm run lint` clean; rule tests 4/4; `astro sync && astro check` 0 errors (the one pre-existing hint); `npm run build` ok; `prettier --check` on the touched dirs ok; `npx supabase test db` 70/70 on the shared local stack.

Not done: screenshots of the error states (`limit-reached-*`, `unavailable-*`, `session-expired-*`) were not recaptured after the F1 layout change; 4.4/4.5 (human screenshot review) remain open. Before merge: `db push` of migration `20261007120000` to production (the API returns 503 until the table exists).

## Weryfikacja ręczna przez użytkownika (2026-10-08)

Użytkownik ręcznie sprawdził wszystkie kroki z listy testów ręcznych dla tej zmiany (na produkcji i na urządzeniach, w tym dźwięk tam, gdzie dotyczy) i potwierdził, że wszystko działa poprawnie. To zastępuje wcześniejsze zastrzeżenia, że kroki manualne zweryfikował wyłącznie skrypt Playwright lub agent.
