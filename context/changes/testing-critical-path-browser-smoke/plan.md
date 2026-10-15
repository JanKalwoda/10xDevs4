# Phase 3 — Critical-path browser smoke: closing the gaps — Implementation Plan

## Overview

Rollout Phase 3 of `context/foundation/test-plan.md` ("Minimalny smoke w przeglądarce: formularz, pełny przebieg z dźwiękiem, pauza i wznowienie, logowanie, zapis, edycja, usunięcie"; risks #3, #4, #5, e2e) was mostly delivered before this change was opened (PR #64, branch `feature/m3l4`). This plan closes the three gaps that research found and brings the test plan up to date. It adds three small Playwright specs (the return address after sign-in, one stepper click plus the keyboard, and Start of a saved timer), then updates §3–§6. It changes no production code.

## Current State Analysis

- The suite is green in CI on `4b98ae0` (run 38641885740: `5 passed`). It has the setup project (`tests/e2e/auth.setup.ts`) and four specs: `seed.spec.ts` (#5 save → `/{id}`, delete → `/timers`), `saved-timer-navigation.spec.ts` (#5 list, edit and back links), `run-audio-signals.spec.ts` (#3 at Start, after Resume and after a hidden page, with real Web Audio through a pass-through spy) and `run-phase-sequence.spec.ts` (#4: the PRD literal sequence, Standby with no time).
- **Gap 1 (#5).** No layer completes a sign-in with a non-default `next`. The HTTP client accepts only `/`, `/dashboard` and `/timers` (`scripts/lib/app-client.mjs:261`). The two hops that exist only in the browser are untested: the `SignInForm` redirect to `/auth/confirm-email?next=…` (`src/components/auth/SignInForm.tsx:33`) and the callback page script that POSTs, checks the origin and calls `window.location.assign` (`src/pages/auth/callback.astro:54-85`).
- **Gap 2 ("formularz", wiring for #6).** Phase 2 deferred the `ConfigStepper` click handler and the ↑/↓ keyboard in `DrillConfigForm` to Phase 3 (`context/archive/2026-10-12-testing-run-flow-form-behaviour/plan.md:10,41`). No spec clicks an arrow or presses a key; the specs only `fill`.
- **Gap 3 (#5, FR-011 "uruchomić wybraną konfigurację").** No spec starts a saved timer from `/{id}` (`src/components/timer/SavedDrillDetails.tsx:22-30`).
- Bookkeeping is stale in four places: §4 says "e2e: none yet" (`test-plan.md:84,93`), §5 says "full Phase 3 pending" (`:124`), §6.4 is TBD (`:180-182`) and §6.6 has no Phase 3 notes (`:188-196`).

## Desired End State

`npx playwright test` runs the setup plus seven specs, green locally and in the CI `smoke` job. The three new specs each go red when their wiring is deliberately broken. `test-plan.md` §3 row 3 is `complete`; §4, §5, §6.4 and §6.6 describe the e2e layer as it exists, so `/10x-e2e` and `/10x-tdd` can read §6.4 as the answer to "how do I add an e2e test here?".

### Key Discoveries:

- The middleware sends a guest on a protected path to `/auth/signin?next=<pathname+search>` (`src/middleware.ts:21-25`). The sign-in form posts `next` and redirects to `/auth/confirm-email?next=…` (`SignInForm.tsx:33`). The callback button is always labelled "Continue to your timers", whatever `next` is (`callback.astro:37`).
- `auth.setup.ts:19-48` already holds the Mailpit pattern: a snapshot of earlier message ids, polling for a new one with an "auth limit" message, then extracting the `/auth/callback` link and checking its origin. The second sign-in reuses it.
- Each stepper button is named `` `${name} ${label} by 1${unit}` `` (`src/components/timer/ConfigStepper.tsx:80`) and has `tabIndex={-1}`. The keyboard steps by 1 with ↑/↓ and by 10 with Shift (`DrillConfigForm.tsx:85-90`).
- The run view is read only through `parseRunView`/`ariaSnapshot` (`tests/e2e/support/run-view.ts`). `waitForHydration` (`tests/e2e/support/hydration.ts`) must come before any click that has no visible effect before hydration, or before a non-idempotent submit.
- Timers are created through `POST /api/drills` and removed through `DELETE /api/drills/{id}`. Both need the app `Origin`, and the cleanup is asserted in `afterEach` (`saved-timer-navigation.spec.ts:16-38`).

## What We're NOT Doing

- No browser test for a foreign `next` (`https://evil.example/…`). The HTTP layer pins the server output with 6 tests × 5 values (`tests/integration/redirects.test.mjs:29-133`), and the user chose not to spend a second mail per run on it.
- No named spec for the default sign-in landing on `/timers`. It stays asserted in `auth.setup.ts`, and §6.4 documents that.
- No coarse or touch pointer, hold-to-repeat timing or tap-target geometry for the stepper. These belong to Phase 4 (#7).
- No assertion for FR-011 "wejściu i odświeżeniu" (whether a signed-in user on `/` should land on `/timers`). That is an open product question, not a test gap.
- No parameter edit through the browser (PUT is covered on HTTP in Phase 1), no Restart, and no positive-rest sound (covered in Phase 2, `drill-run-signals.test.ts`).
- No edits to `context/foundation/test-stack.md`. Only `/10x-e2e-setup` writes it (`test-stack.md:5`).
- No production code changes. A red test that reveals a behaviour bug stops the phase and is reported (Lesson 5), never "fixed" by editing the assertion.

## Implementation Approach

Each spec phase runs one `/10x-e2e` loop (risk → explore the running app with `playwright-cli` → generate → review against the five anti-patterns → re-query by name → verify by deliberate breakage). Every spec follows the existing suite pattern: a risk header comment with the PRD oracle, role/label locators, no `waitForTimeout`, unique `Date.now()` names, and data set up through the API with asserted cleanup. The bookkeeping phase comes last, so §6.4 describes the specs as they actually landed.

## Critical Implementation Details

- **Mail budget and shared inbox.** The return-address spec is the second sign-in per run: one more auth send, about 9 of 30 per 5 min in CI. It signs in the shared `E2E_USERNAME` and must count only a message that arrived after its own submit, as `auth.setup.ts` does. A new session does not invalidate the saved `storageState` session of the other specs. If a later run shows that it does, stop and report it.
- **Hydration before clicking an arrow.** Before hydration a click on ▲ does nothing, and Playwright does not retry clicks. The stepper spec therefore waits for hydration once before its first click.

## Phase 1: Return address after sign-in (risk #5)

### Overview

Prove in the browser that a guest sent to sign-in from a protected page comes back to that page, not to the default `/timers`.

### Changes Required:

#### 1. Mailpit helper

**File**: `tests/e2e/support/mailpit.ts` (new), `tests/e2e/auth.setup.ts`

**Intent**: Move the "request a link, wait for a new message, extract the same-origin `/auth/callback` link" logic out of the setup, so two sign-ins share one implementation. The setup behaves exactly as before.

**Contract**: An exported helper that takes `request`, the Mailpit URL, the username and the base URL. It returns a function that snapshots the existing ids and later resolves the new callback link, keeping the existing messages ("auth limit" hint, origin check). `auth.setup.ts` still lands on `/timers` and still writes `playwright/.auth/user.json`.

#### 2. Return-address spec

**File**: `tests/e2e/auth-return-address.spec.ts` (new)

**Intent**: A guest (empty `storageState`) opens `/create`, lands on `/auth/signin?next=%2Fcreate`, requests a link, ends on `/auth/confirm-email?next=%2Fcreate`, opens the link from Mailpit, clicks "Continue to your timers" and ends on `/create`. There the "Create a timer" page is visible and the Account navigation shows the user's email. Oracle: PRD §Access Control and FR-011/FR-017 (after sign-in the user returns to the protected page they asked for), roadmap S-17, test-plan §2 #5 ("check the target, not only the redirect code").

**Contract**: Risk header `// risk: test-plan.md #5 — facet: sign-in returns to the protected page that sent the guest`. `test.use({ storageState: { cookies: [], origins: [] } })`. `waitForHydration` before the single submit. Final assertions are on the URL and on visible content, not on any status code.

### Success Criteria:

#### Automated Verification:

- The new spec passes: `npx playwright test tests/e2e/auth-return-address.spec.ts`
- The full suite passes, setup included: `npx playwright test`
- Lint passes: `npm run lint`
- Deliberate breakage: making the callback page script (`src/pages/auth/callback.astro`) always `window.location.assign("/timers")` turns the spec red at its final `/create` assertion; after the revert `git diff` on `src/` is empty

#### Manual Verification:

- The spec reads as the PRD flow (guest → sign-in → back on `/create`) and has no CSS/XPath locators or sleeps

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual check before Phase 2.

---

## Phase 2: Form — one arrow click is one step, keyboard steps (wiring for risk #6)

### Overview

Close the Phase 2 deferral: in a real browser one click on an arrow changes the value by exactly one step, and ↑/Shift+↑/↓ in the field step by 1 and 10.

### Changes Required:

#### 1. Stepper spec

**File**: `tests/e2e/config-form-stepper.spec.ts` (new)

**Intent**: As a guest on `/`, after hydration, set Repetitions to a known value (`fill("1")`). One click on the "increase" arrow for repetitions gives `2`. ↑ in the field gives `3`, Shift+↑ gives `13`, one click on the "decrease" arrow gives `12`, and ↓ in the field gives `11`. Each value is asserted with `toHaveValue`. Oracle: test-plan §2 #6 ("pojedynczy klik … daje dokładnie jeden krok"), PRD FR-001/FR-020, and the stepper contract in CLAUDE.md (↑/↓ step by 1, Shift by 10).

**Contract**: Risk header `// risk: test-plan.md #6 — facet: arrow click and keyboard wiring (deferred from Phase 2)`. Guest `storageState`. Buttons are found by their accessible name (`getByRole("button", { name: … })`, the exact name confirmed with `playwright-cli`) and the field by `getByRole("textbox", { name: "Repetitions" })`. Fine pointer only. No data, no cleanup.

### Success Criteria:

#### Automated Verification:

- The new spec passes: `npx playwright test tests/e2e/config-form-stepper.spec.ts`
- The full suite passes: `npx playwright test`
- Lint passes: `npm run lint`
- Deliberate breakage: making `onPointerDown` in `ConfigStepper.tsx` also take a step (one press = two steps) turns the spec red; after the revert `git diff` on `src/` is empty

#### Manual Verification:

- The expected values are literals derived from the PRD/contract, not from `stepFieldValue` or `STEPPER_LIMITS`

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual check before Phase 3.

---

## Phase 3: Start a saved timer (risk #5, FR-011)

### Overview

Prove that Start on `/{id}` runs that timer's saved configuration, not the form defaults.

### Changes Required:

#### 1. Saved-timer Start spec

**File**: `tests/e2e/saved-timer-start.spec.ts` (new)

**Intent**: Create a timer through the API with parameters distinguishable from the defaults (e.g. preparation `0:01`, exercise `0:07`, rest `0:00`, repetitions `2`, no random start). Open `/{id}`, wait for hydration, click Start. The run view (read through `parseRunView`) then shows the saved values: repetition "1 of 2" and Next naming Exercise with `0:07`. Once Exercise is current, its countdown starts at `0:07`. Then cancel the run. Oracle: PRD FR-011 ("uruchomić wybraną konfigurację"), FR-003 (the phase order), and the literals as in `run-phase-sequence.spec.ts`.

**Contract**: Risk header `// risk: test-plan.md #5 — facet: Start on a saved timer runs its saved configuration`. Signed-in `storageState`. A unique name `E2E start ${Date.now()}` and a cleanup through `DELETE` with the app `Origin`, asserted in `afterEach`. Run assertions go through `tests/e2e/support/run-view.ts` only, with no sleeps.

### Success Criteria:

#### Automated Verification:

- The new spec passes: `npx playwright test tests/e2e/saved-timer-start.spec.ts`
- The full suite passes: `npx playwright test`
- Lint passes: `npm run lint`
- Deliberate breakage: making the saved-timer Start pass the default configuration instead of `drill.configuration` turns the spec red; after the revert `git diff` on `src/` is empty

#### Manual Verification:

- After the run no `E2E start …` timer is left on `/timers` for the e2e user

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual check before Phase 4.

---

## Phase 4: Test-plan bookkeeping and CI confirmation

### Overview

Record what Phase 3 delivered in `context/foundation/test-plan.md` and confirm the full suite is green in CI.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Bring §3–§6 in line with the e2e layer as it exists.

**Contract**:

- Header `Last updated: <date>`. §3 row 3: Status `complete`, Change folder `context/archive/<date>-testing-critical-path-browser-smoke/` (the path is set by `/10x-archive`; until then keep the `context/changes/…` path). Note "+ #6 wiring (arrow/keyboard)" in Risks covered.
- §4: the profile line counts the e2e specs and drops "przepływy w przeglądarce nie mają testów automatycznych". The e2e row becomes Playwright Test, `@playwright/test 1.64.1`, `tests/e2e/`, `npx playwright test`, job `smoke`, `checked: <date>`. The run-level row drops "należy do e2e (Phase 3)" and points to §6.4.
- §5: the e2e gate becomes `required (wired)` without "full Phase 3 pending"; Catches adds "#6 wiring". The run-level row drops "okablowanie React — e2e (Phase 3)".
- §6.3: the boundary paragraph points to §6.4 instead of "Phase 3".
- §6.4 filled in: **Location/naming** (`tests/e2e/<area>-<behaviour>.spec.ts`, with a risk header that gives the PRD oracle and the seed); **Reference specs** (all seven, one line each); **Helpers** (`support/hydration`, `audio-spy`, `page-visibility`, `run-view`, `mailpit`); **Rules** (role/label locators; no `waitForTimeout`; guest `storageState` for runs that create no data; API setup plus asserted `DELETE` cleanup with the app `Origin`; hydration before non-idempotent or pre-hydration-inert clicks; audio observed through the pass-through spy, visibility emulated at the document; the run view read only through `ariaSnapshot`; mail budget: each sign-in in e2e costs one send, currently 2 per run; the default landing on `/timers` is asserted in `auth.setup.ts`); **Run** (`npx supabase start`, `.env.e2e`, `npx playwright test [file]`, the report on CI failure); **Verify** (break one line, the spec goes red, revert).
- §6.6: 2–3 lines for Phase 3 (what it taught: most of the specs came from standalone `/10x-e2e` runs; the browser-only hops of the return address were the one gap between layers; and the pitfalls hit: headless visibility, hydration before inert clicks, the shared Mailpit inbox).
- §8: "Stack versions last verified" updated.

### Success Criteria:

#### Automated Verification:

- Prettier leaves the test plan unchanged: `npx prettier --check context/foundation/test-plan.md`
- After the coordinator pushes, the CI `smoke` job on PR #64 is green (`gh pr checks 64`), and its E2E step reports `8 passed` (the setup plus 7 spec tests)

#### Manual Verification:

- §6.4 alone is enough to add a new e2e spec without reading the other specs first

---

## Testing Strategy

### E2E (this change):

- #5: the guest round trip to `/create` (Phase 1) and the saved configuration reaching the run (Phase 3).
- #6 wiring: one click = one step; keyboard steps of 1 and 10 (Phase 2).
- Every new spec is proven by deliberate breakage of its production wiring, then reverted.

### Manual Testing Steps:

1. Run `npx playwright test` locally against the local Supabase; all tests pass.
2. Read each new spec top to bottom; it reads as the PRD scenario.
3. Open `/timers` for the e2e user; no leftover `E2E …` timers.

## Performance Considerations

The three specs add roughly 10–20 s to the CI E2E step (one more magic-link round trip; one short run of about 2 s plus Cancel). The auth budget rises by one send per run.

## References

- Research: `context/changes/testing-critical-path-browser-smoke/research.md`
- Test plan: `context/foundation/test-plan.md` §2 #3–#6, §3 row 3, §6.4
- Mail pattern: `tests/e2e/auth.setup.ts:19-48`
- Cleanup pattern: `tests/e2e/saved-timer-navigation.spec.ts:16-38`
- Run reader: `tests/e2e/support/run-view.ts`, `tests/e2e/run-phase-sequence.spec.ts:28-41`
- Phase 2 deferral: `context/archive/2026-10-12-testing-run-flow-form-behaviour/plan.md:10,41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Return address after sign-in (risk #5)

> Model: Sonnet 5.5

#### Automated

- [x] 1.1 The new spec passes: `npx playwright test tests/e2e/auth-return-address.spec.ts` — 6ee0a7c
- [x] 1.2 The full suite passes, setup included: `npx playwright test` — 6ee0a7c
- [x] 1.3 Lint passes: `npm run lint` — 6ee0a7c
- [x] 1.4 Deliberate breakage: making the callback page script (`src/pages/auth/callback.astro`) always `window.location.assign("/timers")` turns the spec red at its final `/create` assertion; after the revert `git diff` on `src/` is empty — 6ee0a7c

#### Manual

- [x] 1.5 The spec reads as the PRD flow (guest → sign-in → back on `/create`) and has no CSS/XPath locators or sleeps — 6ee0a7c

### Phase 2: Form — one arrow click is one step, keyboard steps (wiring for risk #6)

> Model: Sonnet 5.5

#### Automated

- [x] 2.1 The new spec passes: `npx playwright test tests/e2e/config-form-stepper.spec.ts` — c92b797
- [x] 2.2 The full suite passes: `npx playwright test` — c92b797
- [x] 2.3 Lint passes: `npm run lint` — c92b797
- [x] 2.4 Deliberate breakage: making `onPointerDown` in `ConfigStepper.tsx` also take a step (one press = two steps) turns the spec red; after the revert `git diff` on `src/` is empty — c92b797

#### Manual

- [x] 2.5 The expected values are literals derived from the PRD/contract, not from `stepFieldValue` or `STEPPER_LIMITS`

### Phase 3: Start a saved timer (risk #5, FR-011)

> Model: Sonnet 5.5

#### Automated

- [x] 3.1 The new spec passes: `npx playwright test tests/e2e/saved-timer-start.spec.ts` — 7a4be4b
- [x] 3.2 The full suite passes: `npx playwright test` — 7a4be4b
- [x] 3.3 Lint passes: `npm run lint` — 7a4be4b
- [x] 3.4 Deliberate breakage: making the saved-timer Start pass the default configuration instead of `drill.configuration` turns the spec red; after the revert `git diff` on `src/` is empty — 7a4be4b

#### Manual

- [x] 3.5 After the run no `E2E start …` timer is left on `/timers` for the e2e user

### Phase 4: Test-plan bookkeeping and CI confirmation

> Model: Haiku 5.5

#### Automated

- [x] 4.1 Prettier leaves the test plan unchanged: `npx prettier --check context/foundation/test-plan.md`
- [ ] 4.2 After the coordinator pushes, the CI `smoke` job on PR #64 is green (`gh pr checks 64`), and its E2E step reports `8 passed` (the setup plus 7 spec tests)

#### Manual

- [ ] 4.3 §6.4 alone is enough to add a new e2e spec without reading the other specs first
