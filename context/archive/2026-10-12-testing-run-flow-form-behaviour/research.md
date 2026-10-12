---
date: 2026-10-12T19:15:19+02:00
researcher: Claude (Opus 5.5) for Jan Kalwoda
git_commit: bdc3e20
branch: feature/testing-run-flow-form-behaviour
repository: 10xDevs4
topic: "Rollout Phase 2 (test-plan §3): run flow, signals and form behaviour — risks #3, #4, #6"
tags: [research, testing, drill-run, drill-audio, drill-phase-sections, drill-stepper, validation]
status: complete
last_updated: 2026-10-12
last_updated_by: Claude (Opus 5.5)
---

# Research: Rollout Phase 2 — run flow, signals and form behaviour (risks #3, #4, #6)

**Date**: 2026-10-12T19:15:19+02:00
**Researcher**: Claude (Opus 5.5) for Jan Kalwoda
**Git Commit**: bdc3e20
**Branch**: feature/testing-run-flow-form-behaviour
**Repository**: 10xDevs4

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` (risks #3, #4, #6). For each risk: ground the real failure path in code, verify or correct the §2 response guidance, locate existing tests, pick the cheapest useful test layer (component + integration with a fake clock and fake audio, no e2e, no new dependencies without coordinator approval) and flag speculative risks or misleading hot-spot evidence.

Oracle sources used: `context/foundation/prd.md` (Success Criteria, US-01, US-02, FR-001–FR-006, FR-013, FR-018, FR-020, NFR, Business Logic), roadmap S-10 via test-plan §2, archive `2026-10-01-recover-timer-audio` (frame, plan). Implementation was read only to locate seams and failure paths, never as the expected value.

## Summary

1. **All decisive run, signal and stepper logic is pure TypeScript in `src/lib/` and already has injectable seams** (`DrillClock`, `random`, `DrillAudioPort`, `DrillVisibilityPort`, step repeater clock). `node --test` with Node 24 type stripping runs it today (24 `src/lib/*.test.ts` files exist). The cheapest layer with a real signal for risks #3 and #4 is a **"run-level integration" test in `node --test`**: real `DrillRun` + real `buildPhaseSections`/`nextPhaseBody` + real `createDrillAudio` over a fake `AudioContext`, driven by a fake clock and a scripted random. No new dependency is needed for that.
2. **A true React component test is not possible without new dependencies.** Importing a `.tsx` file under `node --test` fails with `ERR_UNKNOWN_FILE_EXTENSION` (probed in a scratch file), there is no `jsdom` / `happy-dom` / `@testing-library` in `package.json` or `node_modules`, and components import through the `@/` alias, which plain Node does not resolve. The untested React wiring is small but is exactly where the 2026-10-01 incident class lives (Resume must call `resumeWithAudio`, hidden page must call `hide()`, Start must create audio inside the gesture). Recommendation: keep it out of Phase 2 and cover it in Phase 3 e2e (real gesture + real `visibilitychange`); adding a DOM + JSX loader is a coordinator decision (Open Question 1).
3. **Risk #6 API/DB side is already covered by Phase 1 and earlier unit/pgTAP tests**; Phase 2 should not duplicate API cases. The remaining form-side gaps are: no test that every stepper output is accepted by the shared parser (the stepper keeps its own copy of minimums and the m:ss pattern), and the `.tsx` pointer wiring of `ConfigStepper` (untestable without a DOM). "One click = one step" is already proven in the pure press/repeat modules by 15 + 12 tests using a fake clock.
4. Existing tests contain specific weaknesses that a mutation or a real regression would pass through: a `< 0.2` tolerance that cannot tell "wait counted from the first beep" from "from the second beep", a constant random that cannot tell "new draw after resume" from "reused draw", a mirror test for the Next preview, cue durations copied from the implementation, and an out-of-range random input (`() => 1` → 5.01 s).

## Detailed Findings

### Risk #4 — phase sequence, time, repetition, Standby

**Where the logic lives (all pure, `.ts`):**

- Phase sequence: `firstDrillPhase` (`src/lib/drill-timer.ts:81-87`) and `nextDrillPhase` (`src/lib/drill-timer.ts:89-118`). Rest is entered only `if (configuration.restSeconds > 0)` (`drill-timer.ts:99`); the last repetition returns `null` (= completed) (`drill-timer.ts:106,108`).
- Random wait: `sampleRandomStartCentiseconds(random)` = `100 + Math.floor(random() * 401)` centiseconds (`drill-timer.ts:74-79`), i.e. 1.00–5.00 s in 0.01 s steps for `random ∈ [0,1)`.
- Run engine: `DrillRun` (`src/lib/drill-run.ts:46`). Constructor `(configuration, clock, audio, random = Math.random, listener)` (`drill-run.ts:63-69`). `display` returns `remainingSeconds = Math.max(0, Math.ceil(current.end - now))` and `null` for Standby (`drill-run.ts:102`). `tick()` (`drill-run.ts:119-134`) advances past ended segments; no next phase sets `finished`.
- Pause/resume (FR-006): `hide()` (`drill-run.ts:136-157`) freezes the phase and remaining time and cancels audio. `resume()` (`drill-run.ts:186-206`):
  - Standby or Exercise with preparation > 0 → full preparation, then a `resumeTarget` of the **same** repetition (`drill-run.ts:193-197`);
  - Standby or Exercise with preparation 0 → restart the same repetition directly (`drill-run.ts:198-202`);
  - Preparation or Rest → continue the remaining time with `entryCue = false` (no replayed cue) (`drill-run.ts:204`).
  - A resumed Standby is rebuilt without `firstRemaining`, so a fresh wait is sampled (`drill-run.ts:265`).
- Display model: `buildPhaseSections` (`src/lib/drill-phase-sections.ts:47-58`) — Standby main is `{kind:"standby"}`, current/next time come from phase values via `phaseTime` (`drill-phase-sections.ts:31-33`), null for Standby; no next phase → `{kind:"end"}` (`:56`); `nextPhaseBody` renders `end` as "Drill complete" and Standby as the bare name (`:66-69`).
- React-only (`.tsx`): 100 ms `setInterval` → `run.tick()` (`src/components/timer/DrillTimer.tsx:101-103`), completion `phase === null` → `onComplete()` (`DrillTimer.tsx:62-77`), "Completed" view and Restart remount by `key={activeRun.identity}` (`src/components/timer/DrillApp.tsx:43-46,108-111,131`). `DrillTimer` builds `new DrillRun(configuration, clock, audioPort)` without a `random` prop (`DrillTimer.tsx:57`).

**Existing tests (literal, PRD-derived unless flagged):**

- `drill-timer.test.ts`: full literal sequence prep 5 / ex 4 / rest 2 / 3 reps (`:25`), prep 0 + rest 0 (`:37`), one repetition (`:45`), 100 repetitions (`:53`), Standby before every exercise (`:131`), sampling bounds 100..500 (`:116`, inputs computed by inverting the production formula — mild mirror; edge inputs literal).
- `drill-run.test.ts` (`FakeClock`, `FakeAudio` at `:16-71`): fresh sample per repetition with literal `[1,3,5]` (`:163`), rest 0 has no rest cue (`:179`), pause in Exercise/Standby resumes through preparation into the same repetition (`:227`, `:258`), Preparation/Rest keep the remaining time and replay no cue (`:277`), restart identity (`:513-683`).
- `drill-phase-sections.test.ts`: literal view models from hand-built displays (`:54`, `:72`, `:227`, `:233`, `:258`), Standby shows no time and 1 s vs 5 s waits look identical (`:188`, `:203`).

**Weak spots in existing tests (verified):**

- `drill-phase-sections.test.ts:103` "next equals the phase a real DrillRun shows afterwards" is a **mirror test**: expected and observed both come from `nextDrillPhase`.
- `drill-phase-sections.test.ts:205` uses `random = () => 1`, outside `[0,1)`, so the "5 s" wait is really 5.01 s (501 cs) — an input outside the PRD range.
- `drill-run.test.ts:227` and `:258` use a constant `() => 0` random, so a resume that **reused** the old wait would still pass. "New draw after resume" (FR-006, Business Logic) is not asserted anywhere.

**Gaps (no test today):**

1. A literal end-to-end timeline for the short configuration from §2 guidance (prep 1 / ex 1 / rest 1, 2 reps, random start, scripted random) through `DrillRun` → `buildPhaseSections`: phase kind, `Repetition X of N`, main time, current and next text at each step, ending in "Drill complete" on the last rest and `phase: null` afterwards.
2. New random draw after resume from Standby and from Exercise (sample count and the resumed Standby length equal the new scripted value).
3. Pause in Exercise with preparation 0 → the same repetition restarts with the **full** exercise time (and a new Standby when random start is on).
4. Resume does not continue the remaining exercise time (literal full duration after the resume preparation).
5. Standby never leaks the wait in any rendered string, including while paused and during the resume preparation (Next shows "Standby" with no time).
6. Rest 0 with the last exercise: preview shows completion during the last exercise (PRD Business Logic: "przy odpoczynku 0 s zapowiada je już podczas ostatniego ćwiczenia").

**Countdown rounding is not specified by the PRD.** The PRD fixes whole-second configuration and "main section counts remaining time", but not ceil vs floor at sub-second boundaries. Tests should assert values the PRD does fix (the first shown value equals the configured duration; values never increase within a phase; the current section always shows the full configured time) and not pin the ceil boundary as an oracle.

### Risk #3 — signals at Start, Resume, return from a hidden tab

**Audio layer (pure, `.ts`):**

- `DrillAudioPort` (`src/lib/drill-audio.ts:31-38`); cue durations `CUE_DURATION` (`:42-47`) and private pitches `CUE_PITCH` (`:50-55`).
- `createDrillAudio()` (`drill-audio.ts:58-147`): creates `AudioContext` and calls `resume()` synchronously before the first await (`:63-65`); returns `null` on missing `AudioContext` (`:59`), timeout 1.5 s, or `state !== "running"` after resume (`:72`); anchor fixed once (`:87`); a late cue is moved to now, not dropped (`:114`); any non-running state fires `onUnavailable` (`:101-103`).
- `evaluateDrillSchedule` (`drill-audio.ts:15-29`): 0.2 s tolerance on Web Audio scheduling, `physicalSpeakerOutputMeasured: false`.
- Cue placement in `DrillRun.rebuild` (`drill-run.ts:249-299`): Standby pair at the boundary and the second at `firstSound.start + STANDBY_SECOND_OFFSET` (`:268-269`); wait counted from the end of the second sound (`:273`); one cue for exercise and rest, none for preparation (`:275`); a boundary already in the past gets no cue (`cursor >= now - 0.001`).
- `silent = !audio?.available` at construction (`drill-run.ts:75`): a run started with no audio stays silent until a Pause/Resume; Start never retries.
- `resumeWithAudio(factory)` (`drill-run.ts:160-184`) — the fix from `2026-10-01-recover-timer-audio`: new port in the Resume gesture, old one closed, `silent` cleared when the new port is available.

**React-only wiring (no tests, needs DOM or browser):** Start/Restart call `createDrillAudio()` synchronously in the gesture (`DrillApp.tsx:74-90,107-116`); hidden page → `run.hide()` + Wake Lock release (`DrillTimer.tsx:90-100`); Resume ignores a hidden page and calls `run.resumeWithAudio(createResumeAudio)` (`DrillTimer.tsx:150-168`).

**Existing tests:** `drill-audio.test.ts` (missing cue fails evidence `:13`, 0.21 s fails the 0.2 s bound `:20`, fresh context after interruption maps to now `:87`, timeout closes `:115`); `drill-run.test.ts` recovery block `:320-479` (both event orders, repeated locks, failed recovery stays silent, duplicate Resume, stale result last); `drill-audio-initializer.test.ts`; `drill-visibility.test.ts`.

**Weak spots (verified):**

- `drill-run.test.ts:115` asserts the exercise starts `< 0.2` s from "second beep end + 1 s". If the wait were counted from the end of the **first** beep the error would be 0.15 s and the test would still pass (PRD US-01 AC: the wait starts only after the second beep ends). `:140` (`< 0.001`) is strict and does catch it, but only for repetition 2.
- `FakeAudio.scheduleEvidence` always reports deviation 0 (`drill-run.test.ts:47`), so `DrillRun` tests cannot exercise the 0.2 s bound.
- Durations 0.3 / 0.45 / 0.35 (`drill-run.test.ts:114,117`) are copied from `CUE_DURATION`. Nothing asserts the PRD relations: Standby pitch ≠ exercise pitch, exercise is long, Standby and rest are short.
- No test starts a `DrillRun` with a `null` or unavailable port and then recovers on Resume. No test covers `createDrillAudio` when `resume()` resolves but the state stays `suspended` (the typical iOS case) or when `AudioContext` is undefined.

**Verdict on §2 guidance for #3:** "cheapest layer: e2e in browser" is only partly right. The timing contract (cue at the PRD moment for every entry path) and the recovery state machine are pure and testable now with a fake clock and fake audio (Phase 2). What genuinely needs a browser is the `.tsx` wiring and real user activation (Phase 3). That sound physically leaves the speaker, iOS lock/interruption and the mute switch are beyond any automated layer and remain manual (consistent with test-plan §7 and the archive).

### Risk #6 — validation and stepper

**Server and client share one parser.** `parseDrillConfig` / `parseDrillTime` (`src/lib/drill-timer.ts:15-34`, `TIME_PATTERN` `:18`) is used by the API service (`src/lib/services/drill-configurations.ts:92-99`) and by the form submit (`src/lib/drill-config-submit.ts:10-16`); the name rule `normalizeDrillName` (`drill-configurations.ts:65-73`) is reused by the client controller (`src/lib/drill-create-controller.ts:2,89,97`). DB CHECKs and the 50-limit trigger: `supabase/migrations/20261007120000_create_drill_configurations.sql:32-42,68-87`.

**Already covered (Phase 2 must not duplicate):** `drill-timer.test.ts:63,86` (literal boundaries and malformed values), `drill-configurations.test.ts:98-156,270,323,364`, `drill-update.test.ts:90,109`, pgTAP `supabase/tests/database/drill_configurations.test.sql:296-405` (names, ranges, limit 50/51), integration `tests/integration/api-validation.test.mjs:23-31,92,103,117,132,164` (each error class on POST and PUT leaves no trace; limit). Stryker already mutates `drill-configurations.ts:53-117`.

**Small findings:**

- `tests/integration/api-validation.test.mjs:2` comment says "rest at most 59:59"; the PRD (FR-001) says 0–600 s. Comment-only defect; the code tests reject `99:99` as a format error. The HTTP suite has no range case like `10:01` (covered by unit and pgTAP).
- **The stepper duplicates the rules:** `STEPPER_LIMITS` (`src/lib/drill-stepper.ts:15-20`) restates the minimums 0/1/0/1 as literals and `TIME_SHAPE` (`drill-stepper.ts:23`) duplicates `TIME_PATTERN`. Nothing checks that every value the stepper can produce is accepted by `parseDrillConfig`, or that the stepper refuses to step past what the parser accepts. This is the real form-side gap (FR-020: "w granicach zakresu pola").

**One click = one step (FR-020):** guaranteed in pure modules — `createStepPress` steps only from `click` (`src/lib/drill-step-press.ts:29-34,75-80`), `pointerDown` only arms the repeat (`:48-59`), the skip flag survives a post-release abort (`:66-70`); `createStepRepeater.arm` fires nothing before 400 ms (`src/lib/drill-step-repeat.ts:64-77`). Covered by 15 tests in `drill-step-press.test.ts:52-213` (fake clock, abstract counter, not mirror) and 12 in `drill-step-repeat.test.ts:61-204`; values by 8 literal tests in `drill-stepper.test.ts`.

**Remaining failure paths live in `.tsx` only** (`src/components/timer/ConfigStepper.tsx:41-44,55-58,84-100`, `src/components/hooks/useStepRepeat.ts:12-41`, keyboard in `DrillConfigForm.tsx:84-89`): `isInside` on an edge release, `event.detail > 0` mapping, event ordering of `lostpointercapture`/`pointerleave` vs `pointerup`, a second stepping handler. These need a DOM at minimum and real pointer events to be meaningful, so they belong to Phase 3 (or Phase 4 for touch geometry). `useStepRepeat.ts` is `.ts` but imports `react` and `@/` and is not importable by plain `node --test`.

### Test infrastructure facts

- `npm test` = `node --test src/lib/*.test.ts src/lib/services/*.test.ts` (`package.json` scripts). New pure tests placed in `src/lib/` run in CI (`ci` job) with no workflow change.
- `node:test` `mock.timers` mocks `setTimeout`, `setInterval`, `setImmediate` and `Date` only (`context/docs/nodejs-test-runner.md`), not `performance.now()` or `AudioContext.currentTime`; the existing `FakeClock` implementing `DrillClock` is the right clock seam.
- `esbuild` 0.28.2 is present only as a transitive dependency.

## Code References

- `src/lib/drill-timer.ts:74-79` — random wait sampling (1.00–5.00 s, 0.01 s step)
- `src/lib/drill-timer.ts:89-118` — next phase, rest 0 skip, completion
- `src/lib/drill-run.ts:7-11` — `DrillClock` port
- `src/lib/drill-run.ts:63-79` — `DrillRun` constructor, `silent` at start
- `src/lib/drill-run.ts:96-112` — display, remaining time, Standby null, preview after resume
- `src/lib/drill-run.ts:136-206` — hide, resumeWithAudio, resume (FR-006 branches)
- `src/lib/drill-run.ts:249-299` — rebuild: cue placement, wait after second beep
- `src/lib/drill-audio.ts:31-147` — audio port, cue durations, `createDrillAudio`
- `src/lib/drill-phase-sections.ts:31-69` — view model, Standby without time, "Drill complete"
- `src/lib/drill-stepper.ts:15-23` — stepper limits and m:ss pattern (duplicated rules)
- `src/lib/drill-step-press.ts:29-80` — click-only stepping
- `src/components/timer/DrillTimer.tsx:57,90-103,150-168` — React wiring (untested)
- `src/components/timer/DrillApp.tsx:74-116` — Start/Restart audio creation (untested)
- `src/components/timer/ConfigStepper.tsx:41-100` — pointer wiring (untested)
- `tests/integration/api-validation.test.mjs:2` — wrong "59:59" comment

## Architecture Insights

- The project already follows "ports + pure core + thin React shell": every time, random, audio and visibility dependency is injectable in `src/lib`. Phase 2 tests should build on this seam rather than add a DOM.
- "Component" in test-plan §3 Phase 2 maps best, without new dependencies, to the **view-model level**: `DrillRun` display → `buildPhaseSections` → `currentPhaseBody` / `nextPhaseBody`, i.e. the exact strings the React view renders, minus React.
- Test oracles must be PRD literals (phase order, durations, "Standby" with no time, "Drill complete", same repetition after resume) and PRD relations (Standby pitch ≠ exercise pitch, exercise cue longer than Standby and rest cues), never `CUE_DURATION` / `CUE_PITCH` / `nextDrillPhase` outputs.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-recover-timer-audio/frame.md`, `plan.md` — iPhone lock → Resume gave a countdown without sound until reload; any non-running audio state latched `silent` for good and Resume had no recovery path. Fix: `resumeWithAudio` with a fresh port in the gesture. Supported: the fix is present at `drill-run.ts:160-184`. Acceptance was manual on iPhone; the archive states desktop mocks cannot establish real-device output.
- `context/archive/2026-10-11-ux-fixes-round-3/` — stepper "one click/tap = one step" redesign (click-only stepping); its gate script is manual, not CI.
- `context/archive/2026-10-11-testing-access-boundaries/` — Phase 1 wired the API validation and limit cases now listed as covered.

## Related Research

- `context/archive/2026-10-11-testing-access-boundaries/research.md` — Phase 1 (risks #1, #2, #5, #6 API side).

## Open Questions

1. **(Coordinator decision) DOM component tests.** Covering the `.tsx` wiring (Resume → `resumeWithAudio`, hidden → `hide()`, Start creates audio in the gesture, `ConfigStepper` pointer handlers) in Phase 2 would need new dev dependencies: a DOM (`happy-dom` or `jsdom`), a JSX/alias loader (e.g. `tsx` or an esbuild register hook) and probably `@testing-library/react`. Recommendation: **no new dependencies in Phase 2**; the wiring is better proven in Phase 3 e2e with real gestures and real `visibilitychange`, where a jsdom test would still fake activation and audio.
2. **(Plan/coordinator) Corrections to test-plan §2 guidance** (§2 is frozen for this agent, so these are reported, not edited): #3 cheapest layer is split — timing contract and recovery in `node --test` now, wiring and activation in Phase 3; #6 API side is already covered by Phase 1, Phase 2 covers only the stepper ↔ parser contract; hot-spot `src/components/timer` raised #3/#4/#6 but the logic that fails lives in `src/lib` (the components are a thin shell).
3. **Countdown rounding** is not fixed by the PRD (see Risk #4); tests will not use the ceil boundary as an oracle unless the user decides otherwise.
