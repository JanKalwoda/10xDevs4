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
| Confirmation | shadcn `alert-dialog` with `AlertDialogTrigger`, Cancel focused, name in text; `Delete` uses `preventDefault` so the dialog stays open until the result; overlay is inert, Esc/Cancel close | Radix gives focus trap, Esc, aria; its action would otherwise close early | Plan + review F1–F3 |
| API | `DELETE /api/drills/{id}`, 204 via `new Response(null, …)` (not `Response.json`), 401 → 503 → 404 → 204 | Mirrors PUT order; same 404 as PUT | Plan + review F6 |
| CSRF | No body/415; layers: Astro `checkOrigin` (403 without matching `Origin`), no CORS preflight approval, SameSite=Lax; pinned by a scripted 403 check | DELETE has nothing to type | Plan + review F8 |
| After delete | `location.replace("/dashboard")`, no flash message; `pageshow` persisted resets the stuck state | Minimal; no history entry, bfcache-safe | Plan (recommended in [Q]) + review F7 |
| Race / double delete | Zero rows → 404; UI treats 404 as done | Goal state reached either way | Plan |
| Database | No migration; pgTAP extended | Grant and policy exist | Plan |
| Colours and lint | `--overlay` token (light and dark); `alert-dialog.tsx` added to the lint glob; Delete button on tokens, contrast measured | AGENTS.md: no hardcoded colours; otherwise unenforced | Plan + review F5 |
| Fixtures | `DeleteDrillDialog` takes `deleteDrill`/`navigate`/`defaultOpen`; one open modal per scenario | Production component in fixtures, modals do not stack | Plan + review F4 |
| a11y verification | Playwright script on the preview, marked scripted | No DOM tests in the repo | Plan + review F10 |

## Scope

**In scope:** store/service/handler, route DELETE and 405 `Allow`, dialog + controller, fixtures, smoke, pgTAP, screenshots, docs.

**Out of scope:** delete from the list, overlay-click dismissal, toast, undo/soft delete, bulk delete, migration, `db reset`/`db push`.

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
