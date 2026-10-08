# Save a Named Drill Configuration (S-10) — Plan Brief

> Full plan: `context/changes/save-named-drill/plan.md`

## What & Why

A signed-in user creates a timer at `/create`, names it and saves its parameters (no phase colors) as a private record. This is the first app data, so ownership and limits must be enforced by the database from the first write, before S-11..S-13 expose lists, edit and delete.

## Starting Point

There are no migrations or tables; auth (email link, cookie SSR, `locals.user`, middleware redirect) works; `parseDrillConfig` already validates timer parameters; `DrillConfigForm` already renders them. `/dashboard` is a starter stub; `/` is the default timer and must not change.

## Desired End State

A migration adds `drill_configurations` with RLS per operation, unique name per user, name 1–200, at most 50 per user, and CHECKs matching the timer rules. `POST /api/drills` saves for the signed-in user; `/create` (protected) shows a form with clear English errors for duplicate name, limit, validation, expired session and "saving unavailable". Before the table exists on production, only saving answers 503; every page still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Table | `public.drill_configurations`, no color column | Matches the `DrillConfiguration` type; colors are deferred with S-05 | Plan |
| Name uniqueness | Unique on `(user_id, lower(name))` + checks: trimmed, NFC, no control characters | "Run" and "run" (or NFC/NFD forms) look like one name on a list; the DB is the boundary even for direct PostgREST calls | Interview + plan review F3 (deviates from brief's literal `(user_id, name)`) |
| Column privileges | Client can set only user-chosen columns; `id`, `created_at`, `updated_at` and `user_id` after insert are not writable; `EXECUTE` revoked on trigger functions | RLS protects ownership, grants protect server-owned fields | Plan review F4 |
| Supabase client in the route | Reuse `locals.supabase` from the middleware; JWT errors map to 401 | A second client would refresh the token twice and could turn a valid session into a 500 | Plan review F1 |
| Request guards | Media type parsed (charset allowed), 415/413 have their own codes, 4 KB body cap | `text/plain` CORS simple requests must fail; unbounded bodies must not be parsed | Plan review F2 |
| Rollback | New forward migration (or manual drop + `migration repair --status reverted`) | A bare `drop table` leaves the version recorded in migration history | Plan review F6 |
| Limit of 50 | `BEFORE INSERT` trigger with per-user advisory lock, errcode `54000` | Race-free enforcement in the database | Plan |
| Anonymous access | `revoke all` from `anon` + no policy | Default Supabase grants would otherwise allow privilege-level access | Plan |
| API | `POST /api/drills`, JSON of m:ss strings + name, server reuses `parseDrillConfig` | One rule source for form and server; matches existing API pattern | Plan |
| CSRF | Require `Content-Type: application/json` (415 otherwise) | Blocks cross-site form posts to a cookie-authenticated route | Plan |
| Missing table | Map `PGRST205`/`42P01` to 503; no render-time queries | Code can deploy before `db push` without breaking routes | Plan |
| Entry point | Link on `/dashboard` stub | Reachable without touching `/` | Interview |
| After save | Stay on `/create`, `Saved "<name>".`, clear name | There is no list yet | Interview |
| DB tests | pgTAP via `supabase test db` in local and CI + extended smoke | RLS/constraints proven on real Postgres, API proven with real cookies | Interview |
| Test glob | `npm test` also runs `src/lib/services/*.test.ts` | The current glob would silently skip service tests | Plan |

## Scope

**In scope:** migration, pgTAP suite, service + DTOs, `POST /api/drills`, `/create` protection and page, dashboard link, smoke steps, `/dev/timer-ui` fixtures and screenshots, README/AGENTS notes.

**Out of scope:** list, details, run, edit, delete (S-11..S-13); phase colors (S-05); production `db push`/deploy; changes to `/` and its fixtures; generated Supabase types; PRD edit.

## Architecture / Approach

Database is the security boundary. A pure, port-based service (no Supabase import, testable with `node --test`) validates with `parseDrillConfig` + zod and maps database error codes to stable English responses; one thin route wires it to Supabase using `locals.user.id`. The UI is a hook plus presentational view built on the existing `DrillConfigForm` (additive optional props), so `/dev/timer-ui` renders every state from production components.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database | Migration, pgTAP suite, CI step, README | Shared local Supabase across worktrees; `pg_prove` image pull in CI |
| 2. API | Constants/DTOs, service, route, route protection, tests, smoke API steps | Advisory lock correctness under concurrency (checked in smoke) |
| 3. `/create` UI | Form, hook, page, dashboard link, lint scope | Not regressing `/` when extending `DrillConfigForm` |
| 4. Visual gate | Fixtures, screenshots, docs | Fixture drift from production components |

**Prerequisites:** local Docker Supabase running (it is); S-09 done. Coordinator runs `db push` before merge.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- PRD FR-010 text still lists colors; the roadmap override (2026-10-07) is assumed authoritative.
- `lower()` is locale-dependent in Postgres; acceptable for names, documented.
- The local Supabase is shared across worktrees: only `migration up`, no `db reset`; other worktrees should not reset until this change merges.
- The 50-limit lock is proven by pgTAP boundary tests (including a multi-row insert); the concurrent smoke step is only a regression signal.
- The pgTAP CI step adds a registry dependency (mitigated by the same retry/fallback the start step uses).
- Merging before `db push` degrades only saving (503), not other routes.

## Success Criteria (Summary)

- A signed-in user saves a named timer at `/create`; duplicate name (any case) and the 51st timer are refused with clear English messages.
- Another user, a guest, or anon access can never read or change the data (proven by pgTAP and smoke).
- `/` behaves exactly as before; all CI checks and the visual gate pass.
