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

## Phase 2 — DONE (commit 17eb73c): pages, saved mode, 404

Delivered:

- `src/components/timer/NotFoundView.astro` (shared 404, never prints URL/id, noindex), `src/pages/404.astro` (status 404 + `Cache-Control: private, no-store`), `src/pages/[id].astro` (`resolveSavedDrillPage`: sign_in / not_found 404 / unavailable 503 / ok → `DrillApp savedDrill client:load`; no-store and noindex on every branch), `src/pages/dashboard.astro` (shell with `Card`, `SavedDrillList`, `Create a timer` link kept, sign-out as `Button`), `SavedDrillList.tsx` (ul of link cards, empty text, destructive `Alert` for unavailable), `SavedDrillDetails.tsx` (parameters, `Start`, empty reserved actions div `data-slot="saved-drill-actions"`, `Back to dashboard`), `DrillApp` optional `savedDrill` prop, `eslint.config.js` scope (dashboard, [id], 404). `Layout.astro` got an empty `<slot name="head" />` (renders nothing, used for the noindex meta).

Deviations from the plan (small):

- The timer name is the `h1` in the `DrillApp` header in saved mode (kept for the whole run, one h1 per page); `SavedDrillDetails` therefore has no h1.
- Redirects in `dashboard.astro` / `[id].astro` are set on the response (302 + Location) instead of `return Astro.redirect(...)`: a top-level `return` in .astro crashes `@typescript-eslint/no-misused-promises` (lint error). Verified: real 302 with the correct Location.
- `DrillCompleted` got an optional `returnLabel` ("Return to timer" in saved mode); default unchanged.
- `GET /api/drills` (no GET handler) answers 404 as before, but now with the shared 404 body.

Gates (local): `npm test` 156/156; `npm run lint` clean; rule tests 4/4; `astro check` 0 errors; `npm run build` OK; `npx supabase test db` 76/76 PASS; no migration; no db push/reset.

Verification on `npm run preview` (workerd), local Supabase, two users created via GoTrue admin API with hand-built session cookies:

- `/` SSR HTML before (Phase 1 build) vs after: identical except Vite asset file names (`/_astro/button.*.css` → `card.*.css`, island chunk hashes). Not byte-for-byte because bundle hashes change when `DrillApp` changes; with asset names normalized it is identical. A repo test is not possible (React cannot be rendered under `node --test`, `@/` alias).
- `/abc`, `/abc/def`: 404, `cache-control: private, no-store`, same body (same md5 as an unknown id). `/dashboard`, `/create` guest → 302 sign-in; `/auth/signin` 200; `/dev/timer-ui` 404 in production preview.
- Signed in A: empty dashboard shows the empty text; after 2 saves the list has both links, parameter line (`Prep 0:05 · Exercise 0:04 · Rest 0:02 · 3 reps · Random start`, `1 rep`), newest first, HTML in the name escaped, `Create a timer` regex matches; `/{id}` 200, no-store, noindex, `Start` in SSR (no running view); upper-case id 200.
- B: A's id, random UUID and `/not-a-uuid` → 404 with identical body and headers (`cache-control`, `content-type`, `referrer-policy`), id absent from body; B's dashboard has no A timers and shows the empty text. Guest `/{uuid}` → 302 `/auth/signin?next=%2F{uuid}`; guest `/not-a-uuid` → 404, no redirect.
- Test users `p2-a-*@example.test`, `p2-b-*@example.test` and A's two timers remain in the local shared DB (no reset performed).

Not done in this phase (needs a real browser; planned for Phase 3 fixtures/screenshots): running a timer from `/{id}`, Cancel/Completed returning to details, refresh during a run, bfcache check, focus-visible and keyboard check, unavailable branch visually (unit-tested only). Plan items 2.3 and 2.5 are therefore left unchecked.
