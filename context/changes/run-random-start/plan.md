# Run Random Start — Implementation Plan

## Overview

Deliver roadmap slice S-02: a guest can enable a separate, hidden 1–5 second random wait before every exercise and hear distinct Standby, exercise, and positive-rest signals. Preserve the complete S-01 phase sequence and its in-memory configuration flow.

## Current State Analysis

S-01 is implemented and merged, although the roadmap still labels it `in-progress` (`context/changes/run-configured-phases/change.md:4`, `context/foundation/roadmap.md:45`). The public `/` page mounts one React timer island (`src/pages/index.astro:6-7`). Its configuration has four validated fields, its pure phase helper advances preparation/exercise/rest, and its running view uses `performance.now()` deadlines checked by a 100 ms interval (`src/types.ts:1-10`, `src/lib/drill-timer.ts:29-87`, `src/components/timer/DrillTimer.tsx:25-51`). There is no random-start switch, Standby phase, audio engine, or page-visibility handling. Node tests cover parsing and phase order, while CI runs lint, Astro check, build, and HTTP smoke; the CI workflow does not currently run `npm run test` (`package.json:11`, `.github/workflows/ci.yml:12-52`).

## Desired End State

The configuration view has a guest-accessible random-start switch, off by default, with a fixed, non-editable 1–5 s range. With it on, every exercise gets a separately sampled value from the 401 centisecond values from 1.00 through 5.00 s. Standby appears without a countdown while two short, differently pitched signals play. The random wait starts at the end of the second signal; at its end a long exercise-start signal begins and the full exercise time starts. Every positive rest starts with one short signal, including the last rest. Preparation and skipped 0 s rests are silent. With random start off, the S-01 sequence remains, with exercise and positive-rest signals. A completed run still ends after the last actual phase.

If audio cannot run, the timer continues silently with a visible English warning; Standby's random wait begins on entry because no Standby sounds can finish. Hiding the page stops active and queued signals and pauses the run. Returning does not resume it automatically. Manual resume preserves completed repetitions and starts the interrupted repetition again after a full preparation phase when its configured duration is positive; zero preparation is skipped. A currently interrupted preparation or rest keeps its remaining time and resumes without repeating its entry signal. This is the minimum pause behavior needed by the S-02 visibility decision; S-06 remains the full pause-control slice.

### Key Discoveries:

- The roadmap assigns signal previews to S-03 and the next-phase/three-section display to S-04 (`context/foundation/roadmap.md:113-135`). S-02 shows only Standby in the existing running view.
- PRD FR-002/FR-004 require the wait to begin after both Standby sounds, a long exercise signal, a short positive-rest signal, and no preparation or skipped-rest sound (`context/foundation/prd.md:112-118`).
- The accepted S-01 review noted missing delayed-callback drift coverage (`context/changes/run-configured-phases/reviews/plan-review.md:26-34`); audio must not depend on the existing display interval.
- Web Audio schedules source starts on the audio clock, and a context can be suspended by autoplay policy; create or resume it from the Start gesture. Page visibility events expose a transition to a hidden document. See References.

## What We're NOT Doing

- Signal preview buttons or explanations in the form (S-03), next-phase preview or three-section layout (S-04), phase colors (S-05).
- User-operated pause, cancel, or restart controls (S-06–S-08), saved configurations, account changes, API routes, or database changes.
- A customizable random interval or persisted guest settings.
- Claiming that programmatic schedule checks measure physical speaker output. The PRD's ≤0.2 s physical emission tolerance remains unverified by this plan's chosen acceptance method.

## Implementation Approach

Extend the pure sequence and configuration model so Standby is inserted before each exercise only when enabled. Inject a random integer source in model checks and keep the chosen centisecond value private to the run controller. Give the run controller one monotonic timeline shared with audio scheduling: schedule each signal at its phase boundary on the Web Audio clock when available, derive Standby's deadline from the second signal's scheduled end, and start exercise at the scheduled long-signal onset. Rendering reads the current phase but never drives sound onset. Use a silent monotonic-clock fallback and a visible warning when audio is unavailable. On page hide, cancel future sound sources, freeze the current run position, and require an explicit resume action on return. Preserve the existing React island, immutable start snapshot, and completion behavior.

## Critical Implementation Details

### Timing & lifecycle

The second Standby sound's **end**, not the start of Standby or the second sound's onset, anchors the sampled 1–5 s wait. Do not add its duration to exercise time. Scheduled audio sources must be cancelled on hide, unmount, completion, or a switch to silent mode; otherwise a queued cue can fire after the visible run pauses. A callback delayed across multiple boundaries must not replay obsolete cues or shift deadlines to callback time.

## Phase 1: Random-start model and configuration

### Overview

Add an explicit option and an independently sampled Standby before every exercise while retaining the S-01 sequence when disabled.

### Changes Required:

#### 1. Shared configuration and phase contracts

**File**: `src/types.ts`

**Intent**: Represent the selected mode and Standby as first-class run state so the form and runner agree about sequence and repetition ownership.

**Contract**: Extend `DrillConfiguration` with `randomStartEnabled: boolean`; extend `DrillPhase` with a `standby` variant carrying its repetition. Keep the sampled delay in the run controller, outside the display-facing phase value. Preparation, exercise, and rest retain their existing durations and repetition semantics.

#### 2. Parsing, random sampling, and phase progression

**File**: `src/lib/drill-timer.ts`; `src/lib/drill-timer.test.ts`

**Intent**: Keep one pure source of truth for the optional Standby sequence and the exact inclusive random range.

**Contract**: Parse the switch as a boolean without changing existing `m:ss` and repetition validation. Expose a sample operation returning an integer in `[100, 500]` centiseconds from an injectable random source; each entry to Standby samples anew. With the switch on, first phase is preparation when positive, otherwise Standby 1; after preparation and every positive rest, go to the next Standby; after an exercise with rest 0 s, go to the next Standby or completion. Standby advances to exercise of the same repetition. With the switch off, the previous phase sequence is unchanged. Never add Standby after the last actual phase.

#### 3. Guest configuration control

**File**: `src/components/timer/DrillApp.tsx`; `src/components/timer/DrillConfigForm.tsx`

**Intent**: Let users choose random start before running, with the choice retained when returning from completion.

**Contract**: Add an accessible English-labeled switch/checkbox, initially off, explaining the fixed 1–5 s range. Include it in the validated immutable run snapshot and the editable values held by the island. Do not add controls for lower/upper bounds or signal preview.

### Success Criteria:

#### Automated Verification:

- `npm run test` covers both switch states, inclusive 1.00/5.00 s boundaries and 0.01 s steps, one new sample per repetition, zero preparation/rest, final positive rest, and one/100 repetitions.
- `npm run lint` and `npx astro check` pass after the model and form changes.

#### Manual Verification:

- The form exposes a clearly labeled, initially off random-start option with a fixed 1–5 s description.

---

## Phase 2: Signal and timeline engine

### Overview

Add a browser audio scheduler and a run timeline that keeps cues, hidden waiting, and visible phases aligned.

### Changes Required:

#### 1. Browser audio scheduler

**File**: `src/lib/drill-audio.ts`

**Intent**: Give Standby, exercise, and positive rest distinct scheduled sounds without using React renders or 100 ms display ticks to trigger emission.

**Contract**: Own one Web Audio context per active run, initialized or resumed from the user Start action. Define fixed, documented durations, spacing, and pitches: two short Standby sounds in a pitch distinct from exercise, one long exercise sound, and one short rest sound. Expose scheduled start/end times and cancellation of pending sources; report unavailable/suspended/interrupted audio to the run controller. No sound for preparation or a skipped rest.

#### 2. Run timeline and visibility behavior

**File**: `src/lib/drill-run.ts`; `src/lib/drill-run.test.ts`

**Intent**: Separate time-sensitive transitions from display updates, and make paused or silent behavior deterministic.

**Contract**: Coordinate sequence, sampled wait, scheduled audio boundaries, and a monotonic clock behind injectable clock/audio ports for deterministic Node checks. The Standby wait begins at the scheduled end of the second Standby sound when audio works, or at Standby entry in silent mode. Exercise begins with the long signal's scheduled onset and runs for its full configured duration; positive rest begins with its short signal. Skipped rests emit nothing. On hide, cancel future sources and freeze without auto-resume. On manual resume, preserve completed repetitions; interrupted Standby/exercise restarts that repetition after full configured preparation if positive, while interrupted preparation/rest continues its remaining time without repeating an entry cue. Ignore stale callbacks from a prior run generation. Expose only phase, repetition, and permitted display state to the UI; keep sampled Standby delay/deadline private.

#### 3. Programmatic schedule evidence

**File**: `src/lib/drill-run.test.ts` or a focused browser verification helper under `scripts/`

**Intent**: Detect arithmetic drift and scheduling mistakes while recording the accepted limit of software-only timing evidence.

**Contract**: Compare requested Web Audio start times with the controller's expected boundaries, including after a delayed callback, more than one crossed phase, and a full random wait anchored to the second sound's end. Assert no schedule deviation greater than 0.2 s in the instrumented clock and that no stale cue remains after hiding. Document that this does not measure physical speaker emission.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes deterministic clock/audio-scheduler checks for cue order, full Standby wait, exact exercise/rest duration, silent fallback, hide/resume, cancellation, delayed callbacks, and the ≤0.2 s programmed-schedule comparison.
- `npm run lint` and `npx astro check` pass with the audio and timeline modules.

---

## Phase 3: Running view integration and acceptance

### Overview

Connect the new engine to the existing run view and verify the user flow on desktop and phone.

### Changes Required:

#### 1. Start gesture and run lifecycle

**File**: `src/components/timer/DrillApp.tsx`; `src/components/timer/DrillConfigForm.tsx`; `src/components/timer/DrillTimer.tsx`

**Intent**: Start audio while the user's Start gesture is active and keep the UI synchronized with the run controller.

**Contract**: Prepare/resume audio as part of the Start action, then pass the immutable configuration and audio result to the runner. Show `Standby` and repetition without displaying elapsed, remaining, sampled, or scheduled Standby time. Continue showing S-01 countdown for other phases and `Completed` at the final actual phase. If audio is unavailable at Start or fails during a run, continue silently and show an English warning. When hidden, stop cues and show a paused state on return with an explicit Resume action; no automatic progression or sound on return. Preserve the completed-repetition and same-repetition resume rules from Phase 2. Dispose subscriptions, timers, and audio resources on unmount/completion.

#### 2. UI and production-flow verification

**File**: `src/components/timer/DrillTimer.tsx`; `src/components/timer/DrillApp.tsx`; `scripts/smoke.mjs` only if an HTTP-level assertion remains useful

**Intent**: Keep the public flow readable and verify it without moving S-03/S-04 features into this slice.

**Contract**: Keep the form and running view mutually exclusive at `/`, with English labels, warning, pause, and resume copy. The existing timer layout remains responsive and has no next-phase preview. The current HTTP smoke check continues to assert the public page response; interactive sound and timing require browser acceptance.

### Success Criteria:

#### Automated Verification:

- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass; the existing production-preview `npm run smoke` passes when its local Supabase prerequisites are available.
- Programmatic instrumentation records expected and scheduled Web Audio timestamps and passes its ≤0.2 s comparison for the acceptance run, explicitly without claiming physical-emission measurement.

#### Manual Verification:

- On desktop and a real phone browser, a run with `0:05` preparation, `0:04` exercise, `0:02` rest, three repetitions, and random start on has one preparation, three separate hidden Standby waits with two sounds each, three full exercises with long start sounds, three rests with short start sounds, then `Completed`.
- With preparation and rest at `0:00`, two repetitions and random start on, the sequence is Standby 1 → Exercise 1 → Standby 2 → Exercise 2 → `Completed`, with no rest view or rest sound.
- With random start off, no Standby appears; exercises and positive rests still signal, and the S-01 countdown/completion behavior remains.
- Returning from `Completed` restores the last value of the random-start switch along with the time and repetition settings until page reload.
- With audio unavailable, the run continues silently with a visible English warning; each Standby wait begins immediately on entering Standby and still lasts a sampled 1–5 s.
- Hiding the page during Standby or exercise stops pending audio and progression; returning requires Resume, preserves completed repetitions, and restarts the interrupted repetition after full preparation if positive. Hiding during preparation/rest resumes its remaining time without repeating a start cue.
- Standby never exposes its sampled duration or remaining time; the running view has no next-phase preview and remains usable without horizontal scrolling on desktop and phone.

**Implementation Note**: Human confirmation of the desktop and real-phone checks is required before closing this phase. Record browser/device versions and the limitation of the software-only timing evidence.

---

## Testing Strategy

### Unit Tests:

- Inject deterministic random values and clocks to cover all 401 centisecond values' bounds, per-repetition sampling, phase order, zero-duration skips, delayed callbacks, hide/resume, and silent fallback.
- Check scheduled source times against expected phase boundaries, including the second Standby cue's end; assert cancellation prevents stale cues.

### Integration Tests:

- Use the existing npm test runner for pure modules; retain lint, Astro check, build, and production-preview smoke gates. The HTTP smoke cannot observe browser audio or client timing.
- Record programmed Web Audio timestamps during a browser run. This verifies scheduling logic only; a physical emission measurement remains outside the accepted S-02 test method.

### Manual Testing Steps:

1. Run the default 5/4/2 second, three-repetition configuration with random start on to completion on desktop and a real phone; note browser and device versions, sound order, hidden wait, and completion after rest 3.
2. Run preparation `0:00`, exercise `0:01`, rest `0:00`, two repetitions to confirm two Standby waits and no rest cue.
3. Turn random start off and confirm the S-01 sequence, exercise/rest sounds, and no Standby.
4. Deny or disable audio, then start a run; confirm a visible warning and a full silent random wait.
5. Hide during Standby, exercise, preparation, and rest in separate short runs; confirm silence while hidden, explicit Resume, preservation of finished repetitions, and the correct restart/remaining-time rule.
6. Confirm Standby does not reveal a countdown, next-phase preview, sampled value, or planned start time and that the view remains readable on desktop and phone.

## Performance Considerations

The longest configuration has 100 repetitions and up to 600 s per exercise/rest. Keep only a bounded lookahead of scheduled audio sources so hiding the page can cancel them and the run does not allocate cues for hours in advance. Use monotonic deadlines; display throttling cannot lengthen phases or replay missed cues. The chosen schedule instrumentation can detect timing arithmetic errors but cannot establish the PRD's physical-emission bound of ≤0.2 s.

## Migration Notes

No database or API migration. Existing S-01 settings stay in memory; the new switch defaults off. Returning from completion retains it until reload. A feature rollback removes S-02's optional Standby/audio path and leaves the prior phase sequence intact.

## References

- `context/foundation/roadmap.md` — S-02 scope and S-03/S-04/S-06 boundaries.
- `context/foundation/prd.md` — US-01, FR-002–FR-005, the audio timing bound, and English UI rule.
- `context/changes/run-configured-phases/plan.md` and `reviews/plan-review.md` — S-01 handoff and accepted delayed-callback risk.
- `src/types.ts:1-10`, `src/lib/drill-timer.ts:29-87`, `src/components/timer/DrillTimer.tsx:25-51` — existing contracts and clock.
- [Web Audio API specification](https://webaudio.github.io/web-audio-api/) — scheduled source start/stop times and context states.
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — user-gesture audio startup.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — hidden/visible lifecycle.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Random-start model and configuration

#### Automated

- [ ] 1.1 `npm run test` covers both switch states, inclusive 1.00/5.00 s boundaries and 0.01 s steps, one new sample per repetition, zero preparation/rest, final positive rest, and one/100 repetitions.
- [ ] 1.2 `npm run lint` and `npx astro check` pass after the model and form changes.

#### Manual

- [ ] 1.3 The form exposes a clearly labeled, initially off random-start option with a fixed 1–5 s description.

### Phase 2: Signal and timeline engine

#### Automated

- [ ] 2.1 `npm run test` passes deterministic clock/audio-scheduler checks for cue order, full Standby wait, exact exercise/rest duration, silent fallback, hide/resume, cancellation, delayed callbacks, and the ≤0.2 s programmed-schedule comparison.
- [ ] 2.2 `npm run lint` and `npx astro check` pass with the audio and timeline modules.

### Phase 3: Running view integration and acceptance

#### Automated

- [ ] 3.1 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass; the existing production-preview `npm run smoke` passes when its local Supabase prerequisites are available.
- [ ] 3.2 Programmatic instrumentation records expected and scheduled Web Audio timestamps and passes its ≤0.2 s comparison for the acceptance run, explicitly without claiming physical-emission measurement.

#### Manual

- [ ] 3.3 On desktop and a real phone browser, a run with `0:05` preparation, `0:04` exercise, `0:02` rest, three repetitions, and random start on has one preparation, three separate hidden Standby waits with two sounds each, three full exercises with long start sounds, three rests with short start sounds, then `Completed`.
- [ ] 3.4 With preparation and rest at `0:00`, two repetitions and random start on, the sequence is Standby 1 → Exercise 1 → Standby 2 → Exercise 2 → `Completed`, with no rest view or rest sound.
- [ ] 3.5 With random start off, no Standby appears; exercises and positive rests still signal, and the S-01 countdown/completion behavior remains.
- [ ] 3.6 Returning from `Completed` restores the last value of the random-start switch along with the time and repetition settings until page reload.
- [ ] 3.7 With audio unavailable, the run continues silently with a visible English warning; each Standby wait begins immediately on entering Standby and still lasts a sampled 1–5 s.
- [ ] 3.8 Hiding the page during Standby or exercise stops pending audio and progression; returning requires Resume, preserves completed repetitions, and restarts the interrupted repetition after full preparation if positive. Hiding during preparation/rest resumes its remaining time without repeating a start cue.
- [ ] 3.9 Standby never exposes its sampled duration or remaining time; the running view has no next-phase preview and remains usable without horizontal scrolling on desktop and phone.
