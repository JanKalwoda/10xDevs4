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
| `Timers` link | `TIMERS_HREF = /dashboard` in S-16, S-17 switches it to `/timers` | No dead link in production | Plan review |
| Cache guard | Middleware sets `private, no-store` on every HTML response without `Cache-Control` | One guard for all present and future barred pages | Plan review |
| Sticky bar | Drop `height: 100%` from `body`, `min-h-dvh`, mains `flex-1` | Otherwise the bar unsticks after one viewport | Plan review |
| Toggle icons | Both icons, switched by `.dark` | Correct first paint without JS | Plan review |
| Preview | Production `AppTopBar` rendered in `dev/timer-ui.astro` with a static toggle | No drift, deterministic `?theme=` | Plan review |
| Old `Topbar.astro` | Deleted with `Welcome.astro` and `.bg-cosmic` in a final `chore` commit | Avoids two top-bar components | Plan review |

## Scope

**In scope:** bar, layout contract, removal of floating nav and card toggles, callback button, no-store headers, lint scope, smoke, `/dev/timer-ui` fixtures, screenshots, AGENTS.md.

**Out of scope:** `/timers`, account page content, run view, signal preview, API, database.

## Architecture / Approach

Static Astro bar with one React island (toggle), driven by `Astro.locals.user`; sign-out is the existing `POST /api/auth/signout` form.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bar + layout + guard + smoke | Bar on all barred pages, old nav/toggles gone, `flex-1` mains, middleware `no-store`, smoke adapted | Sticky/scroll behaviour, toggle first paint |
| 2. Callback button | `Back to the timer` as button, contract test pin | Low |
| 3. Fixtures, docs, cleanup | Preview fixtures, screenshots, AGENTS.md, removal of the unused starter bar | Deterministic preview |

**Prerequisites:** S-09 done. **Estimated effort:** ~3 sessions, 3 phases.

## Open Risks & Assumptions

- Until S-17 both the email and `Timers` lead to `/dashboard`.
- Long emails: handled with `truncate` and `title`; verified at 390 px.
- Assumes `index.astro` is SSR (it already reads `Astro.locals`).

## Success Criteria (Summary)

- No overlap or extra scroll at 390 px, both themes.
- Guests never get an email in HTML; barred pages are `no-store`.
- Lint, tests, build and smoke are green; screenshots reviewed.
