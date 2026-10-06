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

Tests (`npm test`: 124 pass, 53 new in `drill-configurations.test.ts` and `protected-routes.test.ts`): every validation branch, bounds vs `parseDrillConfig`, NFC/NFD, control chars, each error mapping (incl. `PGRST205`, `PGRST301/303`, 401), no payload in logs, media type, body cap (declared, streamed, multibyte), handler status order, drift test that reads the migration (CHECK bounds, limit 50, index name, errcode `54000`).

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
