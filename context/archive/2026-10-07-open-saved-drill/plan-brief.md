# Open Saved Drill (S-11) — Plan Brief

> Full plan: `context/changes/open-saved-drill/plan.md`

## What & Why

A signed-in user returns to their saved timers: `/dashboard` lists them (name + parameters) and `/{id}` opens one and runs it. This is the read side of S-10; ownership must hold exactly as for saving, and an outage must never look like "you have no timers".

## Starting Point

S-10 shipped the private `drill_configurations` table (RLS select-own, on production), a port-based service with `SavedDrill`/`savedDrillFromRow`, and the middleware-provided `locals.supabase`. `/dashboard` is a starter stub; `DrillApp` runs a timer from in-memory state; no `404.astro` or root dynamic route exists.

## Desired End State

`/dashboard` shows cards-as-links (newest first), an empty-state text, or an unavailable alert, plus `Create a timer`. `/{uuid}` shows a read-only detail with `Start` that runs the real timer (layout leaves room for later Edit/Delete); refresh returns to the detail. Foreign, nonexistent and non-UUID ids are an identical 404.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Route | `src/pages/[id].astro`, strict UUID, else 404 | Static routes win in Astro, so no collision; non-UUID never hits the DB | Plan (coordinator Q4=A) |
| Not-found | One shared `NotFoundView` for foreign/nonexistent/non-UUID, status and `no-store` set directly (no rewrite) | RLS returns zero rows for both and the body never echoes the id; no second middleware run | User + Plan |
| Guests | Redirect to sign-in only for UUID paths; other paths 404 | Keeps the guard from becoming an oracle or redirecting every typo | Plan (Q5=A) |
| Detail view | Read-only summary + `Start` in `DrillApp` saved mode, spare actions area | Reuses the run lifecycle; Edit/Delete belong to S-12/S-13 (layout room only) | Plan (Q1=A + coordinator note) |
| Service | Extend the existing store port with `list`/`findById` | No duplicate DTO/client; same error mapping as save | User + Plan |
| Errors | Unavailable gives alert (dashboard) / 503 (`/{id}`), never the empty text | Outage must not read as "no timers" | Plan (Q3=A) |
| Order | `created_at desc, id desc`, max 50 rows, no pagination | Deterministic; the per-user limit is 50 | Plan (Q2=A) |
| Migration | None | Policy, grant and index already cover reads | Plan (Q6=A) |
| Refresh | No run resume; state in memory only | Stated requirement; SSR check in smoke plus a manual point (bfcache noted) | User |
| Defense in depth | `[id]` and dashboard redirect when `locals.user` is missing; read errors never become an empty list | Protection must not rely on middleware alone; an outage must not read as empty | Plan review F2, F3 |
| Evidence | Unit + pgTAP + two-user smoke + screenshot gate | Ownership proven at DB, route and UI level | Plan (Q7, Q8=A) |

## Scope

**In scope:** read service, id guard, protection rule, dashboard, `[id]`, 404, saved mode, lint scope, fixtures, smoke, docs.

**Out of scope:** edit/delete (S-12/S-13), migrations/`db push`, pagination, run resume, `/t/{id}` prefix, changes to `/`.

## Architecture / Approach

Pure functions over a store port (`listSavedDrills`, `getSavedDrill`) return `ok`/`not_found`/`unavailable`/`unauthorized`; Astro pages call them with `locals.supabase`. A presentational `SavedDrillList` and `SavedDrillDetails` are shared by pages and `/dev/timer-ui` fixtures.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Read service | Port/functions, UUID guard, protection rule, pgTAP read isolation | Leaking existence through distinct outcomes |
| 2. Pages | Dashboard, `[id]`, 404, saved mode in `DrillApp` | Regressing `/`; `prerender = false` and headers on the 404 path |
| 3. Evidence | Two-account smoke (separate e-mail), fixtures, screenshots, docs | Shared local Supabase and Mailpit differences for smoke |

**Prerequisites:** S-10 merged and migrated (done). **Estimated effort:** ~2–3 sessions.

## Open Risks & Assumptions

- No migration is expected; if the implementation finds one is needed it must stop and report (nothing is pushed or reset on the shared stack).
- `node --test` cannot render React, so DOM behavior is evidenced by smoke and fixtures.
- Smoke on the shared stack may need the same Mailpit workaround as S-10.
