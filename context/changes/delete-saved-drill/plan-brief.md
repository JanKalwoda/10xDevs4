# Delete a saved timer (S-13) — Plan Brief

> Full plan: `context/changes/delete-saved-drill/plan.md`

## What & Why

The owner can delete one of their saved timers, but only after a confirmation that shows the timer's name, so a misclick never destroys a timer. Last item of the S-10…S-13 queue (FR-012).

## Starting Point

The table already has the DELETE grant and the `delete_own` RLS policy. `/api/drills/{id}` serves only PUT and answers 405 `Allow: PUT` for the rest. `SavedDrillDetails` reserves the `saved-drill-actions` slot for Delete. No dialog primitive exists in `src/components/ui`.

## Desired End State

`/{id}` shows `Delete timer` next to `Edit timer`; it opens an alert dialog with the timer name; confirming deletes and lands on `/dashboard` without the timer. Errors keep the dialog open and retryable. Foreign, missing and non-UUID ids stay one identical 404.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where is Delete | Only `/{id}` slot `saved-drill-actions`; list unchanged | Minimal; one place to confirm with context | Plan (recommended in [Q]) |
| Confirmation | shadcn `alert-dialog`, Cancel focused, name in text | Radix gives focus trap, Esc, aria | Plan |
| API | `DELETE /api/drills/{id}`, 204 empty body, 401 → 503 → 404 → 204 | Mirrors PUT order; same 404 as PUT | Plan |
| CSRF | No body/415; non-simple method needs a preflight, Astro `checkOrigin` as second layer | DELETE has nothing to type | Plan |
| After delete | Redirect to `/dashboard`, no flash message | Minimal; the list is the confirmation | Plan (recommended in [Q]) |
| Race / double delete | Zero rows → 404; UI treats 404 as done | Goal state reached either way | Plan |
| Database | No migration; pgTAP extended | Grant and policy exist | Plan |
| Overlay colour | New semantic token instead of `bg-black/50` | AGENTS.md: no hardcoded colours | Plan |

## Scope

**In scope:** store/service/handler, route DELETE and 405 `Allow`, dialog + controller, fixtures, smoke, pgTAP, screenshots, docs.

**Out of scope:** delete from the list, toast, undo/soft delete, bulk delete, migration, `db reset`/`db push`.

## Architecture / Approach

Same layering as S-12: pure service tested with plain Requests, thin Astro route, React dialog backed by a small pure controller (single in-flight request, 404-as-success). Fixtures render the production dialog with deterministic ports.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service, API, DB tests | `DELETE` endpoint, tests, pgTAP | Leaking ownership through a different 404 |
| 2. Dialog and action | Alert dialog, controller, action in the slot | Overlay colour token, focus handling, double submit |
| 3. Fixtures, smoke, docs | Visual gate, smoke steps, screenshots, docs | Smoke needs Mailpit (CI) or the scratchpad workaround |

**Prerequisites:** S-10…S-12 merged (done, PR #44); local Supabase running.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes no migration is needed (verify in Phase 1; stop and flag otherwise).
- Assumes `npx shadcn@latest add alert-dialog` works here; fallback is a manual copy of the registry component.
- The overlay token needs a contrast check in dark mode.

## Success Criteria (Summary)

- No timer disappears without a confirmation showing its name.
- Foreign/unknown/non-UUID ids give identical 404 on the API; double delete is 404.
- All gates green, no migration, screenshots reviewed.
