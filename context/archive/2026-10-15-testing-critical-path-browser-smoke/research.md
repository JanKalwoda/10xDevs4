---
date: 2026-10-15T19:40:45+02:00
researcher: Claude (Opus 5.5) for Jan Kalwoda
git_commit: 4b98ae097f0a4aa2ea48a8970e970ebf269bf39d
branch: feature/m3l4
repository: JanKalwoda/10xDevs4
topic: "Rollout Phase 3 (critical-path browser smoke): verify the existing E2E specs against the phase goal, name the remaining gaps and the §4/§6.4/§6.6 bookkeeping"
tags: [research, e2e, playwright, test-plan, risk-3, risk-4, risk-5, auth, next-param]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (Opus 5.5)
---

# Research: Phase 3 — critical-path browser smoke

**Date**: 2026-10-15T19:40:45+02:00
**Researcher**: Claude (Opus 5.5) for Jan Kalwoda
**Git Commit**: 4b98ae097f0a4aa2ea48a8970e970ebf269bf39d (plus the uncommitted §3 status edit in `context/foundation/test-plan.md`)
**Branch**: feature/m3l4 (PR #64)
**Repository**: JanKalwoda/10xDevs4

## Research Question

Phase 3 of `context/foundation/test-plan.md` §3: "Minimalny smoke w przeglądarce: formularz, pełny przebieg z dźwiękiem, pauza i wznowienie, logowanie, zapis, edycja, usunięcie" (risks #3, #4, #5, e2e). Most of the specs were written before this change was opened, in standalone `/10x-e2e` runs on `feature/m3l4`. Check them against the phase goal and the §2 Risk Response Guidance, name the remaining gaps, and list the bookkeeping needed in §4, §5, §6.4 and §6.6.

## Summary

1. **The suite exists and is green in CI.** CI run 38641885740 on HEAD `4b98ae0` reports `5 passed (50.5s)` in the "Run E2E suite (Playwright)" step of the `smoke` job: one setup test plus four specs, with no flaky and no failed tests in that log. PR #64 checks: `ci` and `smoke` succeeded, `deploy` skipped.
2. **#3 (audio) is covered at the browser boundary for all three entry paths** (Start, Resume after a pause, Resume after a hidden page): `tests/e2e/run-audio-signals.spec.ts:64-100`. The spy passes calls through to the real Web Audio API (`tests/e2e/support/audio-spy.ts:45-78`), so the oracle (FR-004, FR-006, §NFR 0.2 s) is not a mock copied from the implementation. This closes the React wiring that Phase 2 explicitly deferred to Phase 3 (Resume → `resumeWithAudio`, hidden → `hide()`, audio created in the Start gesture).
3. **#4 (phase sequence) is covered** by `tests/e2e/run-phase-sequence.spec.ts:66-128`: 1/3/1 s, 2 repetitions, random start, one pause in repetition 2. Phases, Current, Next and the repetition are PRD literals (`:28-41`). Standby has no countdown and is checked for leaks (`:109-117`). Countdowns start at the full configured time and never go up (`:118-125`).
4. **#5 is covered for save → `/{id}`, delete → `/timers`** (`tests/e2e/seed.spec.ts:11-34`), **for the list, edit and back links** (`tests/e2e/saved-timer-navigation.spec.ts:25-76`) **and for the default sign-in landing on `/timers`**, but only inside the setup project (`tests/e2e/auth.setup.ts:31-59`).
5. **Main gap: no layer completes a sign-in with a non-default return address.** `callbackFromMessage` in the HTTP client accepts only `next` ∈ {`/`, `/dashboard`, `/timers`} (`scripts/lib/app-client.mjs:261`). The positive control in `tests/integration/redirects.test.mjs:135-150` checks only that the mail was sent. The browser-only hops are the `SignInForm` redirect (`src/components/auth/SignInForm.tsx:33`) and the callback page script (`src/pages/auth/callback.astro:54-85`, which checks the origin and calls `window.location.assign`). No test exercises the round trip "guest opens `/create` → sign-in → lands on `/create`". The foreign-`next` rejection is well covered on HTTP by 6 tests × 5 foreign values (`tests/integration/redirects.test.mjs:15,29-133`). A browser test of foreign `next` would check the final target, which §2 #5 demands. It costs one extra magic-link mail.
6. **Gap for the "formularz" part of the goal: the stepper and keyboard wiring.** Phase 2 deferred the `ConfigStepper` pointer handlers and the ↑/↓ keyboard in `DrillConfigForm` to Phase 3 (or to Phase 4 for touch geometry). Sources: `context/archive/2026-10-12-testing-run-flow-form-behaviour/plan.md:10,41` and `research.md:112`. No e2e spec clicks an arrow or presses ↑/↓. The specs on `/` only `fill` the text boxes. This guards risk #6, which is not in the Phase 3 risk list, so the plan has to decide whether it is in scope (Open Question 1).
7. **Smaller gaps:** Start from a saved timer `/{id}` is not run in a browser (FR-011 "uruchomić wybraną konfigurację"). The edit spec renames the timer but changes no parameters. Restart is outside the phase goal.
8. **Bookkeeping is stale in four places:** §4 still says "e2e: none yet" and "przepływy w przeglądarce nie mają testów automatycznych" (`context/foundation/test-plan.md:84,93`). §5 says "full Phase 3 pending" (`:124`). §6.4 is TBD (`:180-182`). §6.6 has no Phase 3 notes (`:188-196`). `context/foundation/test-stack.md:16` names only the seed as #5 coverage.

## Detailed Findings

### Configuration and CI wiring

- `playwright.config.ts:14-43`: a `setup` project (`/.*\.setup\.ts/`) and a `chromium` project with `storageState: playwright/.auth/user.json` and `dependencies: ["setup"]`. In CI: `retries: 2`, `workers: 1`. The `webServer` runs `npm run build && npm run preview -- --port ${PORT}` with `ASTRO_PREVIEW_BACKGROUND=1`.
- `.github/workflows/ci.yml`: the smoke preview on 4321 is stopped before Playwright, and the E2E step runs with `E2E_PORT: 4323`, `E2E_USERNAME: e2e@example.com` and the Mailpit URL. On failure the report is uploaded (`playwright-report/`, `test-results/`).
- Result on HEAD: `5 passed (50.5s)` in run 38641885740 (headSha `4b98ae0…`, same as local HEAD).
- Auth budget: one setup sign-in sends one mail per suite run (`tests/e2e/auth.setup.ts:35`). Integration plus smoke already use about 7 of the 30 sends allowed per 5 min (`context/foundation/test-plan.md:155`). In CI each run starts from a fresh stack, so a new e2e sign-in adds one send per run.

### Risk #3 — signals at Start, after Resume, after a hidden page

- Spec: `tests/e2e/run-audio-signals.spec.ts:64-100`. Config 0:01 / 1:00 / 0:00, 1 repetition, random start (`:71-75`). Three gestures: Start (`:81-83`), Pause + Resume (`:86-90`), hidden → visible + Resume (`:93-99`).
- Assertions per gesture (`:28-61`):
    - gesture N opened the N-th `AudioContext`, which is `running`, and every earlier one is `closed`;
    - exactly 3 tones (no preparation sound);
    - the first Standby tone starts ≤ 0.2 s after preparation (page clock vs gesture time);
    - the two Standby tones run back to back and both differ in pitch from the exercise tone;
    - the exercise tone is longer than either Standby tone;
    - the wait is 1–5 s from the end of the second Standby tone;
    - the output clock really reached the exercise tone (`reached`).
- Boundary: `tests/e2e/support/audio-spy.ts:45-78` subclasses the native `AudioContext` and only records what it sees, so sound still plays. Visibility is emulated at the document boundary, because headless Chromium always reports the page as visible (`tests/e2e/support/page-visibility.ts:3-13`).
- Versus §2 #3 "Must challenge: unit test of scheduling ⇒ sound plays": answered, because the real context state and `currentTime` are observed. Physical sound, Bluetooth latency and iOS lock stay manual (§7).
- Not asserted (inspected file only): the positive-rest short sound (FR-004 "początek dodatniego odpoczynku po jednym krótkim dźwięku"), because rest is 0:00 in this spec. Phase 2 covers it in `src/lib/drill-run-signals.test.ts` (per `context/foundation/test-plan.md:172-176`), but the browser wiring for rest is identical to exercise, so this is low value.

### Risk #4 — phase sequence, times, repetitions, Next, Standby

- Spec: `tests/e2e/run-phase-sequence.spec.ts:66-128`. It reads the run view only through `ariaSnapshot` (`tests/e2e/support/run-view.ts:25-62`), with no sleeps.
- `EXPECTED_PHASES` holds 11 literal phase occurrences, including the pause and the resume through full preparation into the same repetition (`:28-41`). The run ends on the `Completed` heading (`:105`).
- Standby: exactly one distinct view during the wait, `countdown === null`, headline `Standby`, and no `\d:\d\d|remaining|\d s` outside the Next line (`:109-117`). This meets the Guardrail "Standby nigdzie nie pokazuje czasu".
- The real browser clock and `setTimeout` wake (Phase 2 mutation review marked "do e2e": `context/archive/2026-10-12-testing-run-flow-form-behaviour/mutation-review.md:8,10`) are exercised implicitly. A ×1000 scale error would miss the 90 s deadline (`:95`). A /1000 error would skip phases, and the sequence assertion would fail. No pace assertion exists beyond that.

### Risk #5 — addresses after transitions

| Transition (PRD/roadmap)                                                                                                 | Covered by                                                                                                            | Notes                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in without `next` → `/timers` (FR-011, FR-017)                                                                      | `tests/e2e/auth.setup.ts:36,56-57` (`confirm-email?next=%2Ftimers`, then `/timers`); HTTP `scripts/smoke.mjs:243-249` | Lives in the setup project, not in a named spec. A failure shows up as "setup failed".                                                                                                        |
| Save new timer → `/{id}` (FR-017)                                                                                        | `tests/e2e/seed.spec.ts:15-22`                                                                                        | Saves the default parameters, name only.                                                                                                                                                      |
| Delete → `/timers` (S-17)                                                                                                | `tests/e2e/seed.spec.ts:27-33`                                                                                        |                                                                                                                                                                                               |
| List → `/{id}` → Edit → Save stays on edit → Back to timer → Back to timers → Create → Back to timers (S-17, S-12, S-21) | `tests/e2e/saved-timer-navigation.spec.ts:40-75`                                                                      | Cleanup through `DELETE` with the app `Origin` (`:16-23`).                                                                                                                                    |
| Guest on protected page → `/auth/signin?next=<path>` (PRD §Access Control)                                               | HTTP: `tests/integration/guest-access.test.mjs:14,32`                                                                 | Server redirect only, which is the right layer.                                                                                                                                               |
| **Sign-in with `next=/create` (or `/{id}/edit`) → lands on that path**                                                   | **none**                                                                                                              | `scripts/lib/app-client.mjs:261` rejects other `next` values. `redirects.test.mjs:135-150` checks only that the mail is sent. Browser-only hops: `SignInForm.tsx:33`, `callback.astro:65-74`. |
| **Foreign `next` → final page is in the app (`/timers`)**                                                                | HTTP per consumer: `tests/integration/redirects.test.mjs:29-133` (5 foreign values × 6 tests)                         | Server output is pinned: `signin.astro:8` replaces it with `/timers`, and `callback.astro` shows the retry state. No browser test follows the final target.                                   |

- Return-address mechanics, as inspected: `src/lib/email-auth.ts:25-51` (`isSafeNextPath`), `:80-101` (callback page state), `:136-156` (`signInUrlForProtectedPath`, `buildEmailRedirectTo`), `:247-266` (POST callback, 303 to `next`). `src/middleware.ts:21-25` redirects guests on protected paths with `pathname + search`.
- In-app links that carry `next`: `src/components/timer/DrillCreateForm.tsx:12` (`/auth/signin?next=%2Fcreate`), `src/components/timer/DrillEditApp.tsx:55`, `src/components/timer/DeleteDrillDialog.tsx:76`.

### "Formularz" — stepper and keyboard (Phase 2 deferral)

- No e2e spec clicks an arrow or presses ↑/↓. The specs on `/` call `fill` only (`run-audio-signals.spec.ts:71-75`, `run-phase-sequence.spec.ts:72-76`).
- Wiring that only a browser proves: `src/components/timer/ConfigStepper.tsx:79-98` (`tabIndex={-1}`, `aria-label` "`<name> <label> by 1<unit>`", `onPointerDown` arms the repeat, `onClick` takes the step), `src/components/hooks/useStepRepeat.ts`, the keyboard in `src/components/timer/DrillConfigForm.tsx:85-89` (↑/↓, Shift = 10) and the `sr-only` status at `:107`.
- A manual gate already exists outside CI: `context/archive/2026-10-11-ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs` ("one click/tap = one step", fine and coarse pointers, per CLAUDE.md).
- The cheapest browser check: on `/`, one click on the Repetitions ▲ arrow changes `1` → `2` once, and ↑ in the field changes it once more. Use role locators: the button by its accessible name, the textbox by its label. It belongs to #6 (test-plan `:49`). Coarse/touch geometry stays in Phase 4.

### Saved timer Start and edit parameters

- `src/components/timer/SavedDrillDetails.tsx:15-30`: the Start button calls `onStart(drill.configuration)`. No e2e spec runs a saved timer, so FR-011 "uruchomić wybraną konfigurację" has no browser check that the saved parameters reach the run view.
- `saved-timer-navigation.spec.ts:54-62` renames the timer. A parameter edit (PUT body) is covered on HTTP by Phase 1 (`tests/integration/api-validation`, `ownership`) but is not visible in the browser.

## Code References

- `playwright.config.ts:14-43`: projects, storageState, webServer
- `tests/e2e/auth.setup.ts:13-62`: magic-link sign-in through Mailpit, lands on `/timers`
- `tests/e2e/seed.spec.ts:11-34`: save → `/{id}`, delete → `/timers`
- `tests/e2e/saved-timer-navigation.spec.ts:25-76`: list, edit and back links
- `tests/e2e/run-audio-signals.spec.ts:28-100`: #3, three gestures
- `tests/e2e/run-phase-sequence.spec.ts:28-128`: #4, PRD literal sequence and Standby leak check
- `tests/e2e/support/{audio-spy,hydration,page-visibility,run-view}.ts`: shared helpers (the only DOM query is in `hydration.ts:8`)
- `scripts/lib/app-client.mjs:243-263`: HTTP callback parser restricted to default `next` values
- `tests/integration/redirects.test.mjs:15,29-150`: foreign `next` per consumer and positive controls
- `src/lib/email-auth.ts:25-51,80-101,136-156,247-266`: `next` validation and redirects
- `src/components/auth/SignInForm.tsx:33`, `src/pages/auth/callback.astro:54-85`: browser-only hops of the return address
- `src/components/timer/ConfigStepper.tsx:79-98`, `src/components/timer/DrillConfigForm.tsx:85-89,107`: stepper and keyboard wiring
- `src/components/timer/SavedDrillDetails.tsx:15-30`: Start of a saved timer

## Architecture Insights

- Suite pattern, already consistent across 4 specs: a risk header comment with the PRD oracle; role locators; `waitForHydration` only before non-idempotent submits; unique names with `Date.now()`; data created by API and deleted in an asserted `afterEach`, or created and deleted by the flow itself; run specs as guests with an empty `storageState`, because they create no data.
- Separation of layers holds: server redirects and `Location` on HTTP (Phase 1), timing logic with a fake clock (Phase 2), wiring, real clock and real gestures in e2e (Phase 3). The return-address round trip is the one place where the server half is tested and the client half is not.
- A test that needs a second sign-in has to start from an empty `storageState` and send its own mail. It costs one auth send, and it must wait for the new message the way `auth.setup.ts:28-48` does, because the inbox is shared.

## Historical Context (from prior changes)

- `context/archive/2026-10-12-testing-run-flow-form-behaviour/plan.md:10,41` and `research.md:31,112,156`: deferred the React wiring (Resume, visibility, Start gesture) and the `ConfigStepper`/keyboard handlers to Phase 3. Current verdict: the first three are **supported/closed** by `run-audio-signals.spec.ts`. The stepper/keyboard part is **open**.
- `context/archive/2026-10-12-testing-run-flow-form-behaviour/mutation-review.md:8,10`: browser clock and `setTimeout` wake marked "do e2e". Current verdict: **partial**. Exercised implicitly by the #4 spec deadline and sequence; no explicit pace assertion.
- `context/archive/2026-10-11-testing-access-boundaries/research.md:89`: "przejścia klienckie … klik w przeglądarce należy do Fazy 3". Current verdict: **partial**. List, edit, save, delete and back links are covered. The sign-in round trip with `next` is not.
- `context/archive/2026-10-08-timers-list-and-account/plan.md:5`: "signed-in landing page" means the default `next`, the top-bar link, back links and the redirect after delete. It does not redirect `/` for a signed-in user (`src/pages/index.astro:1-8`, `src/middleware.ts:21-26` has no such branch).

## Related Research

- `context/archive/2026-10-11-testing-access-boundaries/research.md` (Phase 1)
- `context/archive/2026-10-12-testing-run-flow-form-behaviour/research.md` (Phase 2)

## Open Questions

1. **(Plan/user) Scope of "formularz".** Option A: include one stepper click and one ↑ key check in Phase 3 (risk #6 wiring deferred by Phase 2, cheap, no data, no auth). Option B: leave it to Phase 4 together with touch geometry. Recommendation: A for the fine pointer and keyboard (it closes an explicit deferral); the coarse pointer stays in Phase 4.
2. **(Plan) Return-address e2e.** Recommendation: one spec with an empty `storageState`. A guest opens `/create`, lands on `/auth/signin?next=%2Fcreate`, signs in through Mailpit and ends on `/create` with the form. Optionally a second case: `/auth/signin?next=https://evil.example/x` ends on `/timers` (same origin). Cost: 1–2 mails per run. Use a unique address per run (`e2e-next-<timestamp>@example.com`, a new account is created by `shouldCreateUser: true`, `src/lib/email-auth.ts`) or the shared `E2E_USERNAME` with the "new message only" filter. Decide whether the foreign case adds enough over the 30 HTTP sub-tests.
3. **(Plan) Sign-in landing as a named spec.** The default landing is asserted only in `auth.setup.ts`. Either accept that (setup failure fails the suite) or let the return-address spec also cover the no-`next` path. Recommendation: accept it and document it in §6.4.
4. **(Plan, optional) Saved timer Start.** One short saved timer (e.g. 0:01 / 0:01 / 0:00 × 1) → `/{id}` → Start → Current shows the saved Exercise time. Cheap, covers FR-011 "uruchomić". Decide whether it is in the minimal smoke.
5. **(Product, not a test gap) FR-011 "wejściu i odświeżeniu".** Read literally, a signed-in user who enters `/` should land on `/timers`. Today `/` renders the guest timer form for everyone. The S-17 archive interprets "landing" as the default `next` only. Do not assert either reading until the user decides. Per CLAUDE.md, a test that encodes one reading and turns red is a signal, not something to fix by editing the assertion.
6. **Bookkeeping (for the plan's final sub-phase):**
    - §3 row 3 → `complete` when done;
    - §4 profile line and the `e2e` row: Playwright 1.64.1, `tests/e2e/`, `npx playwright test`, `checked: 2026-10-15`;
    - §5 e2e gate: drop "full Phase 3 pending";
    - §6.4: location, naming (`<area>-<behaviour>.spec.ts` + risk header), seed and helpers, rules (guest `storageState` for runs, API setup + asserted cleanup, hydration before non-idempotent submits, audio spy and visibility emulation, `ariaSnapshot` run reader, mail budget), reference specs, run commands from `test-stack.md`;
    - §6.6: 2–3 lines for Phase 3;
    - `test-stack.md:16`: lists only the seed as #5 coverage, so add the other specs or leave the file to `/10x-e2e-setup`, as its header says (`test-stack.md:5`).
