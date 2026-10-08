<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Save a Named Drill Configuration (S-10)

- **Plan**: context/changes/save-named-drill/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations (decisions recorded below; fixes in one follow-up commit)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence (re-run by the reviewer on 2026-10-07, commit 6f9cfa5)

- `npm test` 138/138 pass; `npm run lint` clean; rule tests 4/4; `astro sync && astro check` 0 errors (1 pre-existing hint); `npm run build` ok.
- `npx supabase test db` 66/66 PASS on the shared local stack (suite runs in one rolled-back transaction); `migration list --local` shows `20261007120000` local and remote. No `db reset` / `db push` was run.
- Read line by line and found matching the Contract: migration (RLS on; `revoke all` from `anon`/`authenticated`, then column-level grants: `id`/`created_at`/`updated_at` never writable, `user_id` insert-only; four policies `to authenticated` on `(select auth.uid()) = user_id`; both functions `security invoker` + `set search_path = ''`, EXECUTE revoked from `public`/`anon`/`authenticated`; limit trigger with `pg_advisory_xact_lock(hashtextextended(user_id))`, VOLATILE, `54000`; named CHECKs for length in code points, trim, NFC, `[\x01-\x1f\x7f-\x9f]`, parameter ranges; unique `(user_id, lower(name))`; FK on delete cascade).
- API `POST /api/drills`: `prerender = false`; one client from `locals.supabase`; order 401 → 503 → 415 → 413 (Content-Length and streaming cap, 4 KB, fatal UTF-8) → 400 (zod strict, unknown keys rejected, `parseDrillConfig`) → insert; 409 for duplicate/limit; DB errors are mapped to fixed English messages and only the error code is logged; `Cache-Control: no-store`. CSRF: requiring `application/json` forces a CORS preflight that the route never answers (no CORS headers), and `no-cors` fetches cannot send that content type; Astro's default `checkOrigin` covers form content types; Supabase SSR cookies are `SameSite=Lax`. No separate Origin check is needed.
- `/create` is protected by `isProtectedPath` (decoded, collapsed slashes, segment boundary; unit tested). No render-time DB query; the simulated missing-table run (`e2e-results-missing-table.json`) shows 200 on `/`, `/auth/signin`, `/dashboard`, `/create` and 503 on the API.
- `/` timer: the `DrillConfigForm.tsx` diff only adds optional props with defaults that keep the old markup (`disabled={false}` and `aria-busy={undefined}` render no attribute).
- UI: semantic tokens and `ui` primitives only; `create.astro` is in the lint scope; label, hint, `aria-invalid`, `aria-describedby`, `role="alert"` errors and a `role="status"` success message are present.

## Findings

### F1 — Failure alert is below the Save button, not above it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/DrillCreateForm.tsx:98
- **Detail**: The plan (Phase 3, §2) says `limit_reached`, `unavailable` and `unexpected` "use a destructive `Alert` above the submit". `DrillCreateForm` renders the alert after `<DrillConfigForm>`, which ends with the submit button, so the alert appears below Save. The alert has `role="alert"`, so screen readers still announce it; the difference is visual order. The screenshots (`limit-reached-*`, `unavailable-*`, `session-expired-*`) were accepted by the script gate with this layout.
- **Fix**: Either pass the alert into `DrillConfigForm` through a new optional slot rendered just before the submit, or record in the plan that "below the submit" is the accepted layout.
- **Decision**: ACCEPTED — FIXED. `DrillConfigForm` got an optional `beforeSubmit` slot rendered directly above the submit button; `DrillCreateForm` passes the failure `Alert` through it. Note: the existing `limit-reached-*`, `unavailable-*`, `session-expired-*` screenshots predate this layout change and were not recaptured (the gate script lives outside the repo); the human review of F6 should regenerate or check them.

### F2 — Any SQLSTATE 54000 is reported as "limit reached"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/drill-configurations.ts:191
- **Detail**: `classifyStoreError` maps every `54000` (the generic `program_limit_exceeded` class code) to `limit_reached` without checking the message `drill_configuration_limit_reached`. Duplicate-name detection already checks the index name, so this check is weaker than its neighbor. Today the trigger is the only realistic source of `54000` here, so the risk is a misleading 409 in rare cases.
- **Fix**: Also require `error.message` to include `drill_configuration_limit_reached`, and extend the drift test to read that message from the migration.
- **Decision**: ACCEPTED — FIXED. `classifyStoreError` maps `54000` to `limit_reached` only when `message` or `hint` contains `LIMIT_REACHED_MESSAGE` (`drill_configuration_limit_reached`); any other `54000` is `unexpected` (and logged by code). `StoreError` gained an optional `hint`. New unit test covers both sides; the drift test now also asserts the migration raises that exact message. The migration is unchanged.

### F3 — pgTAP does not assert `security invoker` and the pinned `search_path`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/tests/database/drill_configurations.test.sql:407
- **Detail**: The suite asserts the advisory lock and VOLATILE through `pg_proc`, but `prosecdef = false` and `proconfig` containing `search_path=""` for both functions were only checked by reading (Progress 1.5). A later `security definer` change would make the trigger count all users' rows and still pass every test. This is low risk today but these are the properties the review was asked about.
- **Fix**: Add two `is()` assertions per function on `pg_proc.prosecdef` and `pg_proc.proconfig` (raise `plan(66)` to match).
- **Decision**: ACCEPTED — FIXED. `drill_configurations.test.sql` asserts `prosecdef = false` and `proconfig = {search_path=""}` for both `enforce_drill_configuration_limit()` and `set_updated_at()`; `plan(66)` -> `plan(70)`. `supabase test db` 70/70 locally.

### F4 — CI pgTAP retry runs on every failure, and the fixtures depend on the `auth.users` schema

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:44
- **Detail**: The retry fires on any non-zero exit, including real assertion failures. Because the suite is deterministic, it does not hide failures, but a red run takes about 15 s longer and logs "in case the pg_prove image pull failed", which can mislead. Separately, the fixtures insert into `auth.users` with only `id, aud, role, email`. `supabase/setup-cli@v2` installs the latest CLI, so a future GoTrue schema change (a new NOT NULL column without a default) could break the suite without any change in this repo. Flaky risk is low otherwise: one transaction, fixed UUIDs, no sleeps, and migrations applied by `supabase start`.
- **Fix**: Accept as is, or pin the CLI `version:` in `setup-cli` so image and schema changes arrive through deliberate upgrades.
- **Decision**: ACCEPTED-AS-IS. The CI retry on any pgTAP failure is intentional (it covers a failed `pg_prove` image pull) and costs about 15 s on a red run; the deterministic suite cannot hide a real failure. Pinning the `supabase/setup-cli` version (and the `auth.users` fixture dependency on the GoTrue schema) is to be considered separately, not in this change.

### F5 — Progress 2.7 note is out of date

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/save-named-drill/plan.md:348
- **Detail**: 2.7 is ticked with the note "e2e na realnym braku tabeli niewykonane" (no end-to-end run on a missing table). Phase 4 later added end-to-end evidence through a proxy that returns 404 `PGRST205` (`screenshots/e2e-results-missing-table.json`: `/`, `/auth/signin`, `/dashboard`, `/create` 200; API 503). The note does not mention that evidence. A real missing table has still not been exercised, which is first possible on production before `db push`.
- **Fix**: Add the proxy evidence to the 2.7 note and keep "real missing table: not exercised".
- **Decision**: ACCEPTED — FIXED. Progress 2.7 in `plan.md` now cites the proxy `PGRST205` evidence (`screenshots/e2e-results-missing-table.json`) and keeps "real missing table: not exercised".

### F6 — Human screenshot review (4.4) is still open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/save-named-drill/plan.md:376
- **Detail**: AGENTS.md requires screenshots to be reviewed before UI changes are accepted. All screenshots and the 3.4–3.7 browser steps were produced by Playwright scripts, not a person. 4.4 (light/dark, 1280/390) and the optional 4.5 (phone) are unchecked. Screen-reader announcement and sound were not checked.
- **Fix**: A person reviews `screenshots/` (and ideally F1's alert placement at the same time) before merge, then ticks 4.4.
- **Decision**: LEFT FOR A HUMAN. 4.4 (and optional 4.5) stay unchecked; the person should also look at the alert placement from F1, since those screenshots were not recaptured.
