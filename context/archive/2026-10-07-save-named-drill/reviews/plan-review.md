<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Save a Named Drill Configuration (S-10)

- **Plan**: context/changes/save-named-drill/plan.md
- **Mode**: Deep
- **Date**: 2026-10-07
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (`src/middleware.ts`, `src/lib/supabase.ts`, `src/lib/drill-timer.ts`, `src/types.ts`, `src/components/timer/DrillConfigForm.tsx`, `src/layouts` props, `eslint.config.js:103`, `src/pages/dashboard.astro`, `supabase/` with no migrations), 5/5 symbols ✓ (`parseDrillConfig`, `signInUrlForProtectedPath`, `enableTimerTheme`/`showConfigWarnings`, `appRequest` form-only, `PROTECTED_ROUTES` + `startsWith`), brief↔plan ✓, Progress↔Phase ✓ (4 phases, every criterion has an N.M entry).

## Checked and sound (no finding)

- RLS: `revoke all` from `anon`/`authenticated`, then explicit grants to `authenticated` only; four per-operation policies with `(select auth.uid()) = user_id`; insert `WITH CHECK` blocks spoofed `user_id`, update `USING` + `WITH CHECK` blocks moving a row to another user. pgTAP covers each case including `42501`.
- Limit of 50: `BEFORE INSERT` row trigger + `pg_advisory_xact_lock(hashtextextended(user_id))`. Under READ COMMITTED each plpgsql statement takes a new snapshot after the lock, so the count sees rows committed by the previous lock holder. A spoofed `user_id` is still rejected by `WITH CHECK`, which runs after the trigger. `security invoker` + RLS counts only the caller's own rows, which is correct.
- Uniqueness on `(user_id, lower(name))` + `name = btrim(name)` + `char_length` 1–200 (code points); `23505` is mapped by index name.
- CHECK bounds match `parseDrillTime`/`parseDrillConfig` (0–600, exercise ≥ 1, repetitions 1–100), and a drift test guards them.
- API: zod + `parseDrillConfig`, statuses 201/400/401/409/415/503/500, generic `unexpected` message, only the code is logged. Requiring JSON (no CORS, SameSite=Lax cookie) closes cross-site form posts.
- Missing table: `PGRST205`/`42P01` → 503 and no render-time queries. Order: coordinator `db push`, then merge. Additive migration.
- S-11..S-13: uuid pk + SELECT/UPDATE/DELETE policies, `updated_at` trigger, `savedDrillFromRow` — the schema supports reading by id, editing (a case-only rename of the same row does not violate the index) and deleting.
- UI: additive props on `DrillConfigForm`, `create.astro` added to the timer-ui contract, `/dev/timer-ui` fixtures with every state.

## Findings

### F1 — Unspecified Supabase client in the route (double token refresh)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — §2 Service (`createSupabaseDrillStore(client)`) and §3 Route
- **Detail**: The plan does not say where the route gets the Supabase client from. `createClient` (`src/lib/supabase.ts:7`) reads `getAll()` from the request's `Cookie` header, not from the cookies the middleware set. When the access token has expired, the middleware's `getUser()` refreshes the session (refresh-token rotation) and writes new cookies to the response. A second `createClient(...)` in the route sees the old token and refreshes again with the already-used refresh token. That only works inside `refresh_token_reuse_interval = 10` (`supabase/config.toml:171`); otherwise PostgREST returns a JWT error (`PGRST301`/401), which the planned mapping turns into `500 unexpected` instead of `401 unauthorized`. `App.Locals` (`src/env.d.ts`) currently has only `user`.
- **Fix A ⭐ Recommended**: The middleware stores its client in `context.locals.supabase` (extend `App.Locals`), and the route passes it to `createSupabaseDrillStore`; additionally map `PGRST301`/`PGRST303`/HTTP 401 to `unauthorized`.
  - Strength: One client per request, no second refresh; consistent with the middleware being the single session source.
  - Tradeoff: Touches `middleware.ts` and `env.d.ts` (small diff, but in the auth path).
  - Confidence: HIGH — follows directly from `getAll()` reading the request header.
  - Blind spot: I did not check whether `forwardAuthCookies` handles a double `setAll` within one response without duplicate `Set-Cookie`.
- **Fix B**: Leave a second client in the route, but only map JWT errors to `401 unauthorized`.
  - Strength: Minimal diff, does not touch the middleware.
  - Tradeoff: After a refresh a user with a valid session sometimes gets "Sign in to save a timer." (a needless sign-in).
  - Confidence: MED — the effect depends on the reuse interval and the timing.
  - Blind spot: Behaviour of the refresh race in hosted Supabase.
- **Decision**: ACCEPTED

### F2 — Route contract: error code for 415 and Content-Type parsing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — §1 DTOs (`SaveDrillErrorCode`) and §3 Route
- **Detail**: The status table includes `415`, but `SaveDrillErrorCode` has no code for it, so the `SaveDrillResponse` body for 415 is undefined. The plan also does not say how to compare the type: `application/json; charset=utf-8` must pass, and `text/plain` (a CORS "simple request") must fail. Strict equality or `includes("json")` would be a mistake. There is also no body size cap before `request.json()`.
- **Fix**: Add a code (e.g. `unsupported_media_type`) or state that 415 returns `validation`; compare the media type after `split(";")[0].trim().toLowerCase() === "application/json"`; optionally reject bodies > ~4 KB with 400/413.
- **Decision**: ACCEPTED

### F3 — Name normalisation: btrim vs trim, NFC, control characters, maxLength

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — §1 CHECKs; Phase 2 — §2 `validateSaveDrillRequest`; Phase 3 — name field
- **Detail**: The DB is meant to be the boundary (the session token sits in a cookie readable by JS, so direct PostgREST is a real path), but `btrim(name)` trims only spaces. A direct insert can save `"\tRun"`, `"Run\n"`, NBSP or control characters, and the NFC/NFD forms of "é" bypass `lower(name)` uniqueness ("look like one name on a list" — the very reason for the decision). In the UI, the HTML `maxLength` attribute counts UTF-16 units, which conflicts with the code-point counting of 200 characters (astral names would be cut off).
- **Fix**: Service: `name.normalize("NFC").trim()` and reject `\p{Cc}`; DB: add the CHECK `name !~ '[[:cntrl:]]'` (and the pgTAP test); in the UI do not use the `maxLength` attribute (validation stays on the service); document NFC as a known limitation of direct inserts or add `name = normalize(name, NFC)` to the CHECK.
- **Decision**: ACCEPTED

### F4 — Grants too broad at column level; EXECUTE on trigger functions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — §1 RLS
- **Detail**: `grant select, insert, update, delete to authenticated` lets the owner set `id`, `created_at` and `updated_at` via direct PostgREST (`updated_at` gets overwritten by the trigger only on UPDATE). RLS protects ownership, but forged `created_at` can affect S-11 sorting and S-12 (if `updated_at` is used for optimistic concurrency). Supabase's default privileges also grant `EXECUTE` on the new functions to `anon`/`authenticated`.
- **Fix**: `grant insert (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled), update (same columns) on ... to authenticated` + `revoke execute on function public.set_updated_at(), public.enforce_drill_configuration_limit() from public, anon, authenticated`; add one pgTAP assertion (`column_privs_are` or `throws_ok` on updating `created_at`).
- **Decision**: ACCEPTED

### F5 — Limit tests: multi-row insert, and smoke does not prove the lock

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — §2 pgTAP; Phase 2 — §5 Smoke
- **Detail**: (a) PostgREST accepts array inserts; the `BEFORE ROW` trigger sees earlier rows of the same statement only because plpgsql is `VOLATILE` — that is worth covering with a test (49 rows + one 2-row insert → `54000`), so that nobody marks the function `STABLE`. (b) "five concurrent posts → 2×201, 3×409" also passes without the lock if the requests happen to serialise, so it is not an "automated check of the advisory lock" — at most a regression signal; reword it in the plan. (c) The new authenticated smoke steps must run before `verifyDashboardAndSignOut` (`scripts/smoke.mjs:233`), which signs out.
- **Fix**: Add the multi-row pgTAP case, reword the smoke step description, and specify where in `runLocalSmoke` the API steps go.
- **Decision**: ACCEPTED

### F6 — Rollback via `drop table` leaves the migration history on production

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — §1 rollback comment; Migration Notes
- **Detail**: A manual `drop table` on production leaves the `20261007120000` row in `supabase_migrations.schema_migrations`; the next `db push` will not recreate the table, and `migration list` will show drift.
- **Fix**: Describe rollback as a new forward migration (`drop ...`) or as `drop` + `npx supabase migration repair --status reverted 20261007120000`.
- **Decision**: ACCEPTED

### F7 — Shared local Supabase: impact on other worktrees and the `db diff` criterion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Implementation Note, criterion 1.3
- **Detail**: After `migration up` the history of the shared DB contains a version that worktrees on `main` do not have — their `supabase migration up`/`db diff` may report "remote migration versions not found", and their `db reset`/`supabase stop --no-backup` deletes the table under this worktree (flaky local smoke/pgTAP). Criterion 1.3 (`db diff`) needs a shadow DB (extra image) and on a shared stack is a weak, noisy signal.
- **Fix**: Tell the coordinator/other worktrees (no `db reset` until merge; if the table disappears, just run `migration up` again); replace 1.3 with `npx supabase migration list --local` + a pgTAP assertion `tables_are('public', ARRAY['drill_configurations'])`.
- **Decision**: ACCEPTED

## Coordinator decisions

- F1–F7 accepted by the coordinator on 2026-10-07 and applied to `plan.md` and `plan-brief.md`:
  - F1: the middleware stores its client in `locals.supabase`; the route reuses it; `PGRST301`/`PGRST303`/401 map to `unauthorized`.
  - F2: new codes `unsupported_media_type` (415) and `payload_too_large` (413); media type parsed with charset allowed; 4 KB body cap.
  - F3: service NFC + trim and control-character rejection; database CHECKs for NFC and `[\x01-\x1f\x7f-\x9f]`; no HTML `maxLength`.
  - F4: column-level grants (`id`, `created_at`, `updated_at` not writable, `user_id` insert-only) and `revoke execute` on both trigger functions, with pgTAP assertions.
  - F5: multi-row pgTAP boundary case; smoke concurrency reworded as a regression signal; API steps placed before `verifyDashboardAndSignOut`.
  - F6: rollback is a forward migration or manual drop plus `migration repair --status reverted`.
  - F7: criterion 1.3 now `migration list --local` + pgTAP `has_table`; shared-stack note (no `db reset`) added to Phase 1 and Migration Notes.
- Plan status after the fixes: SOUND for Phase 1 (applied by the planner; not re-reviewed).
