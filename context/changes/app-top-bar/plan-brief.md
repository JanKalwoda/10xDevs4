# Sticky top bar with account and theme toggle — Plan Brief

> Full plan: `context/changes/app-top-bar/plan.md`

## What & Why

Add one sticky top bar to every page except the sign-in pages: email, `Timers`, theme toggle and `Sign out` for signed-in users; `Sign in` and the toggle for guests. Today a floating `fixed` link on `/` overlaps the timer card on a phone, and the theme toggle is copied into four card headers. FR-015 / roadmap S-16.

## Starting Point

`Layout.astro` has no chrome. `index.astro` renders the floating account nav; `ThemeToggle` sits in `DrillApp`, `DrillCreateApp`, `DrillEditApp` and `dashboard.astro`. Page mains use `min-h-screen`. `/` and `/create` have no `no-store` header. `callback.astro` ends with a text link.

## Desired End State

The bar is stuck to the top on `/`, `/create`, `/dashboard`, `/{id}`, `/{id}/edit` and the 404, never overlaps a card at 390 px and adds no extra scroll. The bar holds the only theme toggle. Barred pages are `private, no-store` (the email is in the HTML). `Back to the timer` on the callback page is a button.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the bar lives | `AppTopBar.astro` mounted by `Layout.astro`, `showTopBar` default true | One place, auth pages opt out | Plan (ux-fixes-plan) |
| Toggle | Reuse `ThemeToggle` island (`client:load`); `ThemeInit` always with the bar | Existing hook and storage key | Plan |
| Extra scroll | `body` flex column, page mains `flex-1` instead of `min-h-screen` | No arbitrary `calc` heights | Plan |
| Email leakage | `private, no-store` on `/`, `/create`, 404 and the other barred pages | Email lands in HTML | ux-fixes-plan |
| `Timers` link | Points to `/timers` now (route comes in S-17) | Fixed decision | ux-fixes-plan |
| Old `Topbar.astro` | Left alone (unused starter leftover) | Out of scope | Plan |

## Scope

**In scope:** bar, layout contract, removal of floating nav and card toggles, callback button, no-store headers, lint scope, smoke, `/dev/timer-ui` fixtures, screenshots, AGENTS.md.

**Out of scope:** `/timers`, account page content, run view, signal preview, API, database.

## Architecture / Approach

Static Astro bar with one React island (toggle), driven by `Astro.locals.user`; sign-out is the existing `POST /api/auth/signout` form.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bar + layout + headers | Bar on all barred pages, old nav/toggles gone, `flex-1` mains | Double scroll, toggle hydration (`theme` null at first render) |
| 2. Callback button | `Back to the timer` as button, contract test pin | Low |
| 3. Smoke, fixtures, docs | Smoke for new bar, preview fixtures, screenshots, AGENTS.md | Fixtures must match production classes |

**Prerequisites:** S-09 done. **Estimated effort:** ~3 sessions, 3 phases.

## Open Risks & Assumptions

- The `Timers` link leads to the 404 until S-17 merges (proposal: merge S-16 and S-17 back to back, or accept the interim 404).
- Long emails: handled with `truncate` and `title`; verified at 390 px.
- Assumes `index.astro` is SSR (it already reads `Astro.locals`).

## Success Criteria (Summary)

- No overlap or extra scroll at 390 px, both themes.
- Guests never get an email in HTML; barred pages are `no-store`.
- Lint, tests, build and smoke are green; screenshots reviewed.
