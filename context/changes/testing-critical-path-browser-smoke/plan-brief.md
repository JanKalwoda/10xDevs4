# Phase 3 — Critical-path browser smoke: closing the gaps — Plan Brief

> Full plan: `context/changes/testing-critical-path-browser-smoke/plan.md`
> Research: `context/changes/testing-critical-path-browser-smoke/research.md`

## What & Why

Rollout Phase 3 of `context/foundation/test-plan.md` calls for a minimal browser smoke: the form, a full run with sound, pause and resume, sign-in, save, edit and delete (risks #3, #4, #5). Most of it already exists, but three browser-only paths still have no test. This change closes them and records the e2e layer in the test plan, so the phase can be marked `complete`.

## Starting Point

The Playwright suite (one setup and four specs) is green in the CI `smoke` job. It covers #3 audio at Start, Resume and after a hidden page, the #4 PRD phase sequence, and #5 save, delete, edit and the back links. Untested: sign-in that returns to a non-default page, the arrow and keyboard wiring that Phase 2 deferred, and Start of a saved timer. §4, §5, §6.4 and §6.6 of the test plan are stale or TBD.

## Desired End State

`npx playwright test` runs the setup plus seven specs, green locally and in CI. Each new spec goes red when its wiring is deliberately broken. The test plan marks Phase 3 `complete`, and §6.4 explains how to add an e2e test in this project.

## Key Decisions Made

| Decision                              | Choice                                               | Why (1 sentence)                                                                      | Source             |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------ |
| Return address in the browser         | Only guest `/create` → sign-in → `/create`           | Closes the one gap between layers (SignInForm + callback script) for one mail per run | Plan (research Q2) |
| Foreign `next` in the browser         | Not tested                                           | 30 HTTP sub-tests already pin the server output; a second mail adds little signal     | Plan               |
| "Formularz" (arrow + keyboard)        | In scope, fine pointer and keyboard only             | Closes the explicit Phase 2 deferral; coarse/touch stays in Phase 4                   | Plan (research Q1) |
| Start of a saved timer                | In scope, one short case                             | The only proof that the saved parameters reach the run (FR-011)                       | Plan (research Q4) |
| Default landing on `/timers`          | Stays in `auth.setup.ts`, documented in §6.4         | A setup failure already fails the whole suite                                         | Research Q3        |
| FR-011 "wejściu i odświeżeniu" on `/` | Not asserted                                         | An open product question, not a test gap                                              | Research Q5        |
| Mail helper                           | Extract from `auth.setup.ts` to `support/mailpit.ts` | Two sign-ins share one "new message only" implementation                              | Plan               |
| `test-stack.md`                       | Not edited                                           | Only `/10x-e2e-setup` writes it                                                       | Research           |

## Scope

**In scope:**

- `tests/e2e/auth-return-address.spec.ts`, `config-form-stepper.spec.ts`, `saved-timer-start.spec.ts`
- `tests/e2e/support/mailpit.ts` and the refactored `auth.setup.ts`
- `context/foundation/test-plan.md` §3, §4, §5, §6.3, §6.4, §6.6, §8

**Out of scope:**

- Production code (a red test that reveals a bug is reported, not fixed here)
- Foreign `next` in the browser, coarse/touch stepper and geometry (Phase 4), Restart, parameter edit through the UI, and the product question about `/`

## Architecture / Approach

Each spec phase is one `/10x-e2e` loop: risk → explore with `playwright-cli` → generate → review against the anti-patterns → verify by deliberate breakage. The specs reuse the suite's conventions: a PRD oracle in the risk header, role/label locators, no sleeps, guest `storageState` for runs without data, API setup with asserted `DELETE` cleanup, `waitForHydration` before inert or non-idempotent clicks, and the `ariaSnapshot` run reader. The bookkeeping comes last, so §6.4 describes what actually landed.

## Phases at a Glance

| Phase                           | What it delivers                                            | Key risk                                                        |
| ------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Return address after sign-in | Guest `/create` → sign-in → `/create` spec + Mailpit helper | Auth limit and the shared inbox (count only a new message)      |
| 2. Form arrow and keyboard      | One click = one step; ↑ / Shift+↑ / ▼ literals              | A click before hydration does nothing (wait first)              |
| 3. Start a saved timer          | `/{id}` Start runs the saved configuration                  | Expected strings must come from the PRD literals, not the model |
| 4. Bookkeeping + CI             | §3–§8 updated, CI green with 7 specs                        | —                                                               |

**Prerequisites:** local Supabase (`npx supabase start`), `.env.e2e` with `E2E_USERNAME`, Playwright Chromium installed; branch `feature/m3l4` (PR #64).
**Estimated effort:** about 1–2 sessions across 4 small phases.

## Open Risks & Assumptions

- A second magic-link session for the same user is assumed not to invalidate the saved `storageState` session. If it does, stop and report it.
- Auth budget in CI rises to about 9 of 30 sends per 5 min. Locally, rapid reruns can hit the limit (wait 5 minutes).

## Success Criteria (Summary)

- A guest who signs in from `/create` comes back to `/create`, and a saved timer starts with its own parameters, both proven in a real browser.
- One arrow click changes a field by exactly one step, and ↑/Shift+↑ step by 1/10.
- The test plan shows Phase 3 `complete`, and §6.4 is a working recipe.
