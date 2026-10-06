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
