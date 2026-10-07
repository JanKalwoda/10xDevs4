# Edit Saved Drill (S-12) — Plan Brief

> Full plan: `context/changes/edit-saved-drill/plan.md`

## What & Why

A signed-in user changes the name and parameters (no phase colors) of one of their own saved timers without touching any other timer. Per-user case-insensitive name uniqueness and the 200-character name limit apply on edit as they do on save.

## Starting Point

S-10 shipped the private `drill_configurations` table with an UPDATE-own policy, a column grant for the six user-owned columns, the `updated_at` trigger and the unique `(user_id, lower(name))` index. S-11 shipped `/dashboard`, `/{id}` with a reserved, empty actions slot, the store port and the shared 404. Only INSERT and SELECT are used by the app today.

## Desired End State

`/{id}` shows `Edit`, which opens `/{id}/edit`: the `/create` form prefilled with the stored values and `Save changes`. Saving updates only that row and shows `Saved "<name>".`; duplicates, invalid input, a vanished row and a signed-out session each give a clear message. Foreign, missing and non-UUID ids are one identical 404.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Edit route | `/{id}/edit` (`src/pages/[id]/edit.astro`), protected like `/{id}`; non-UUID = same public 404 | Keeps the saved-timer URL family and the no-oracle rule from S-11 | Plan (Q1=A) |
| API | `PUT /api/drills/{id}`, full body like POST, same validator | The form always sends every field; no second validation path | Plan (Q2=A) |
| Not found | New `not_found` code, 404 identical for foreign/missing/non-UUID; non-UUID never reaches the DB | RLS gives zero rows for both; no ownership oracle | Plan |
| Name collision | Rely on the existing unique index; 23505 → 409 `duplicate_name`; own case-only rename allowed | The index ignores the row itself; already asserted in pgTAP | Plan |
| Concurrency | Last write wins | Out of scope for FR-012; recorded as an assumption | Plan (Q3=A) |
| After save | Stay on the edit page with `Saved` and links back | Matches `/create`, no redirect state to test | Plan (Q4=A) |
| Migration | None | Policy, grant, trigger and index already exist; limit 50 is INSERT-only, 200 is the name CHECK | Plan (Q5=A) |
| Reuse | Generalize `createDrillCreateController`/`useDrillCreate`/`DrillCreateForm` by options, `savedDrillFromRow`, `resolveSavedDrillPage` | No duplicated form, DTO or store client | User + Plan |
| Lint scope | Globs `src/pages/[[]id[]].astro` and `[[]id[]]/edit.astro` plus a persistent test; existing `[id].astro` violations (if any) fixed here | `[id]` is a minimatch character class, so S-11's entry never matched | Plan review F1 |
| Stale messages | `markEdited()` clears Saved/alert on parameter change; PUT fallback `409 → duplicate_name`, `404 → not_found` | A success note must not outlive an unsaved edit | Plan review F2, F3 |
| CSRF | Documented assumption (JSON-only + preflight, 415 otherwise) with `text/plain` and form tests | Keeps the protection from being removed silently | Plan review F4 |
| Delete room | Existing `saved-drill-actions` slot holds `Edit`; S-13 adds Delete | Layout room without implementing Delete | User |

## Scope

**In scope:** store `update` + service + `PUT` route; `/{id}/edit` page and protection; `Edit` action; controller/form generalization; pgTAP additions; unit tests; `/dev/timer-ui` fixtures, smoke steps, screenshots, AGENTS/README.

**Out of scope:** Delete (S-13), phase colors, optimistic locking, `PATCH`, any migration/`db push`/`db reset`.

## Architecture / Approach

Browser form → `PUT /api/drills/{id}` → `handleUpdateDrillRequest` (auth, id guard, JSON/size checks, `validateSaveDrillRequest`) → store `update(...).eq(id).eq(user_id).maybeSingle()` under RLS → `savedDrillFromRow`. The page `/{id}/edit` reuses `resolveSavedDrillPage` so ownership and not-found behave exactly like `/{id}`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Update service, API, DB tests | `PUT /api/drills/{id}`, uniform 404, pgTAP for update isolation | Zero-row update mistaken for success; ownership oracle via different 404 shapes |
| 2. Edit page, protection, Edit action | `/{id}/edit` prefilled form, protection rules, `Edit` link | Breaking `/create` behavior while generalizing the controller; route/guard edge cases |
| 3. Fixtures, smoke, screenshots, docs | Visual gate evidence, two-account smoke, docs | Lint scope for bracketed paths; screenshot effort |

**Prerequisites:** S-10/S-11 merged (done); local Supabase running (shared, no reset).
**Estimated effort:** ~3 sessions, 3 phases.

## Open Risks & Assumptions

- Last write wins: two tabs editing the same timer overwrite each other.
- `updated_at` changes on edit but list order is by `created_at`, so edited timers do not move.
- Guest on `/{uuid}/edit` is redirected (UUID shape only), same as `/{uuid}`.
- Fixing the eslint globs may reveal contract violations in the existing `[id].astro` (S-11); they are fixed in this change.

## Success Criteria (Summary)

- The owner edits name and parameters and sees them on `/{id}`, the dashboard and when running the timer.
- Another user's or a non-existent id can neither be edited nor distinguished from each other; no other row changes (pgTAP + smoke).
- Duplicate names (case-insensitive) and names over 200 characters are refused, case-only rename of one's own timer works.
