# Timers list screen and account page (S-17) — Plan Brief

> Full plan: `context/changes/timers-list-and-account/plan.md`

## What & Why

The saved timers list gets its own protected screen `/timers`, which becomes where a signed-in user lands. `/dashboard` turns into a small account page (email, link to the list). After saving a new timer the user goes straight to that timer's page `/{id}` instead of staying on the form. This follows the UX fixes queue (FR-011, FR-016, FR-017).

## Starting Point

`/dashboard` is both the list and the account card (with a second `Sign out` next to the bar's). The default sign-in target is `/`, list links say `Back to dashboard`, `/create` shows a `Saved "…"` alert after save, and delete redirects to `/dashboard`.

## Desired End State

Sign-in without `next` lands on `/timers`; the bar `Timers` link, `Back to timers` links and the post-delete redirect all go there; the callback button reads `Continue to your timers`. Creating a timer ends on `/{id}`; editing still stays on `/{id}/edit` with `Saved`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| List route | New `src/pages/timers.astro`, protected, `no-store` | Static page wins over `[id].astro`; guard is a prefix check | Plan |
| `/dashboard` | Account page, no DB, page `Sign out` removed | The bar already has `Sign out`; two identical buttons confuse users and smoke (open question 1) | Plan |
| Default `next` | One `DEFAULT_NEXT_PATH = "/timers"`; explicit `next=/` still honored | Single source for schema, fallbacks and pages | ux-fixes-plan |
| Create redirect | Injected `navigate`, form stays locked (`saving`), bfcache reset | Same pattern as delete; no flash of an empty form | Plan |
| Edited during save | Still navigates to `/{id}` | `/{id}` shows what was saved, so nothing misleading | Plan |
| Renames | `resolveDashboardPage` → `resolveTimersPage`, `DASHBOARD_HREF` → `TIMERS_HREF` | Names match meaning | Plan |

## Scope

**In scope:** `/timers`, account page, protected route + lint scope, default `next`, callback label, `Back to timers` links, delete redirect, create redirect, smoke, README/AGENTS docs, screenshots.

**Out of scope:** redirect from `/dashboard`, account deletion (S-20), run view (S-18), signal preview (S-19), migrations, archiving.

## Architecture / Approach

Mostly moving existing pieces: the list code lifts out of `dashboard.astro` into `timers.astro`; `dashboard.astro` shrinks to an `AccountDetails.astro` view that `/dev/timer-ui` can also render. The create controller gains the same injected-navigation seam the delete controller has.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. `/timers` + account page | New route, protection, bar link, lint scope | `/timers` unprotected or not linted |
| 2. Default `next` + links | Landing on `/timers`, `Back to timers`, delete redirect | Old default asserted in many tests |
| 3. Create → `/{id}` | Redirect, `drill.id` validation, fixtures | Stuck `Saving…` after Back (bfcache) |
| 4. Smoke, docs, gate | CI smoke, README/AGENTS, screenshots | Smoke cannot run locally (no Mailpit) |

**Prerequisites:** S-16 merged (done, PR #48).
**Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions

- Local smoke is impossible (no Mailpit); CI is the confirmation, visual checks are scripted.
- Assumes `Account` as the `h1` of `/dashboard`.

## Success Criteria (Summary)

- A guest hitting `/timers` is sent to sign-in and returns to `/timers`.
- Create ends on `/{id}`; delete ends on `/timers`; one `Sign out` per page.
- All gates and CI smoke are green.
