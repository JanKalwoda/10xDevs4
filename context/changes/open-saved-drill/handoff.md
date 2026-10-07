# Handoff — open-saved-drill (S-11)

Worktree `D:\Dev\10xDevs4-open-saved-drill`, branch `feature/open-saved-drill`. Plan reviewed (F1–F8 accepted and applied, `reviews/plan-review.md`). No migration, no `db push`, no `db reset`.

## Phase 1 — DONE (commit 4cb812f): read service, id guard, protection rule, pgTAP

Delivered:

- `src/lib/services/drill-configurations.ts`
  - `DrillConfigurationStore` now also has `list()` and `findById(id)`; `createSupabaseDrillStore` implements them with the explicit column list `SAVED_DRILL_COLUMNS` (no `user_id`), `order created_at desc, id desc`, `limit MAX_SAVED_DRILLS` (50), `maybeSingle` for the id read. `SavedDrillRow` = row without `user_id`; `savedDrillFromRow` takes it.
  - `isDrillId` (strict 8-4-4-4-12 hex, case-insensitive), `normalizeDrillId` (lower-case before the query).
  - `listSavedDrills` / `getSavedDrill`: results `ok` / `not_found` / `unavailable` / `unauthorized`. An empty list is returned only for `error === null` and an array; `data: null` without error, `42501`, `PGRST205`, unknown codes and thrown exceptions are `unavailable` (only the error code is logged). `PGRST301/303`/401 are `unauthorized`. Non-UUID ids return `not_found` without touching the store; `data: null` for `findById` is `not_found` (maybeSingle for zero rows).
  - `resolveSavedDrillPage(userId, id, store, log?)` for `/{id}`: non-UUID first (404 even for a guest, no redirect oracle), then no user → `sign_in` (before any store access), no store → `unavailable`, then the read; `unauthorized` → `sign_in`. `resolveDashboardPage(userId, store, log?)` for `/dashboard` with the same rules (`sign_in` for no user / `unauthorized`).
  - `OPEN_DRILL_MESSAGES` (`unavailable`, `empty` = "You have no saved timers yet.", `notFound`).
- `src/lib/saved-drill-summary.ts`: `describeDrillConfiguration(configuration)` → `["Prep 0:05","Exercise 0:04","Rest 0:02","3 reps","Random start"?]` (`1 rep`).
- `src/lib/protected-routes.ts`: `isSavedDrillPath` and `isProtectedPath` now also protect `/{uuid}` (any case, trailing/doubled slash, encoded, `/{uuid}%2F`); other single segments stay public. `//{uuid}` as `next` falls back to `/dashboard` (`isSafeNextPath` rejects `//`), by design.
- `supabase/tests/database/drill_configurations.test.sql`: `plan(76)` (+6): B opening A's row by id → 0 rows, random id → 0 rows, B's and A's list query shape (explicit columns, order, limit 50), A opens own row, `anon` refused by id.
- Tests: new `src/lib/services/saved-drills-read.test.ts` (ids, mapping, failure matrix, not_found equality, non-UUID never queries, log content, both page decisions, sign-in `next`, summary), protected-routes cases; existing store fakes got `list`/`findById`.

Gates (all green, run locally): `npm test` 156/156; `npx supabase test db` 76/76 PASS (shared local stack, no reset); `npm run lint` clean; `npx astro sync && npx astro check` 0 errors (1 pre-existing hint); `git diff --name-only main -- supabase/migrations` empty.

Break-check (each reverted afterwards, tests green again at 156): `isDrillId` always true → 3 red; zero rows → `unavailable` → 2 red; list accepts a non-array → 2 red; `isSavedDrillPath` removed from `isProtectedPath` → 1 red.

Note for the next phases: `npm ci` was run in this worktree (it had no `node_modules`). On Windows, avoid Python/`sed -i` rewrites that introduce CRLF (prettier then reports `Delete ␍`); the files here are LF.

## For Phase 2

- Pages call `resolveSavedDrillPage(locals.user?.id ?? null, Astro.params.id, locals.supabase ? createSupabaseDrillStore(locals.supabase) : null)` and `resolveDashboardPage(...)`; map `sign_in` to `signInUrlForProtectedPath("/" + id)` / `"/dashboard"`, `not_found` to the shared `NotFoundView` with `Astro.response.status = 404`, `unavailable` to 503 with `OPEN_DRILL_MESSAGES.unavailable`.
- Plan F1/F6: no `Astro.rewrite`; `prerender = false` on `404.astro` and `[id].astro`; `Cache-Control: private, no-store` on `Astro.response.headers` for every branch; `noindex` on `/{id}`; `NotFoundView` must not print the URL or id.
- Explicit manual point (F7): refresh during a run shows the details (state is in memory), and Back/Forward (bfcache) may restore the in-memory view, exactly as on `/` today. Verify and note it.
- Smoke second user must be a distinct e-mail account; the saved id comes from the 201 response.
