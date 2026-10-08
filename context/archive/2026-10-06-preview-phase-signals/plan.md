# Preview phase signals — Implementation Plan

## Overview

S-03 (FR-004, US-01). On the configuration form at `/`, the user can play the Exercise, Rest and Standby signals next to the matching settings and reads what each sound means. The preview plays exactly the same cues the real drill schedules. Preparation and a 0 s rest have no signal. All visible text is English. Plan revised after plan review (`reviews/plan-review.md`, F1–F8 accepted).

## Current State Analysis

- The drill schedules cues through `DrillAudioPort.schedule(cue, at)` (`src/lib/drill-audio.ts:35-41`) and gets back a `ScheduledCue {start, end}`. Cue durations/pitches: `CUE_DURATION`, `STANDBY_SECOND_OFFSET`, `CUE_PITCH` (`drill-audio.ts:47-61`). Standby = two sounds (450 Hz/0.3 s then 750 Hz/0.15 s, second scheduled at `firstSound.start + STANDBY_SECOND_OFFSET`); exercise 2640 Hz/1 s; rest 980 Hz/0.35 s.
- `schedule` clamps start to `context.currentTime` and works in the `performance.now()/1000` time domain (anchor, `drill-audio.ts:80`).
- `DrillRun` is the only caller of `schedule` (`src/lib/drill-run.ts:259-260, 267, 308-309, 316`); no cue for preparation or a 0 s rest.
- `createDrillAudio()` is async (up to 1.5 s resume) and must be called inside a user gesture (`drill-audio.ts:64`); it returns `null` when Web Audio is missing/not running. A port can become unavailable later via `statechange` (`available === false`, `onUnavailable`).
- `observeDrillAudioInitialization` (`src/lib/drill-audio-initializer.ts`) closes a late grant after disposal.
- `parseTime` in `src/lib/drill-timer.ts` is private. `src/components/ui/button.tsx` renders `<button>` without default `type`, so inside the `<form>` it would submit.
- `DrillConfigForm.tsx`: `ConfigField` has no slot for extra content. `TimerUiPreview.tsx` is already ~1200 lines and renders the production form with a `FixtureAudio` port (`:90-125`).
- `npm test` = `node --test src/lib/*.test.ts` (React hooks cannot run there). Timer UI contract lint forbids palette/literal/arbitrary values.

## Desired End State

- Under Exercise: "Play exercise signal" + "One long high beep marks the start of each exercise."
- Under Rest: "Play rest signal" + "One short beep marks the start of each rest." Rest = 0 s: button disabled, visible text "Rest is 0:00, so there is no rest signal." Rest invalid: disabled, "Enter a valid Rest time to hear its signal."
- Under Random start: "Play Standby signal", ALWAYS enabled, text "Two short beeps (lower, then higher) mean Standby: the exercise starts after a hidden random wait of 1–5 s that begins once both beeps end." plus, when the box is unchecked, "Random start is off, so Standby does not play during the drill."
- Under Preparation: "Preparation has no sound."
- Click flow: audio is created inside the click gesture; while it initializes the button shows `aria-busy` and further clicks are ignored; then the cue plays and "Playing … signal" shows until the last cue's real end; a second play cancels the previous sound. If audio cannot start: `ui/alert` with "Sound is unavailable in this browser."; every next click retries.
- Preview buttons are `type="button"` and never start the drill. Start (and unmount) releases the preview audio first.
- The preview starts no run, wake lock or random delay and stores nothing. Existing fields keep their order; the new buttons add tab stops. Disabled reasons are visible text (a disabled button is not focusable).

### Key Discoveries

- Same-signal guarantee: one pure `previewCueSequence(signal)` built from `STANDBY_SECOND_OFFSET`/`CUE_DURATION`, with a test asserting equality with the cues `DrillRun` schedules (`drill-run.test.ts` has a fake clock/audio harness).
- Putting the lifecycle in a pure controller in `src/lib` makes the riskiest logic testable by `npm test`.

## What We're NOT Doing

- No preview for preparation or 0 s rest, no volume/pitch settings, no new sounds.
- No change to cue pitches/durations or `DrillRun` scheduling, no Bluetooth work (S-14), no phase colors (S-05).
- No persistence and no claims of physical audio/device testing.

## Implementation Approach

1. `src/lib` (Phase 1): cue catalogue/helpers + exported time parser + a pure preview controller (state machine with injected `createAudio`, clock and timer), all covered by node:test.
2. UI (Phase 2): thin `useSignalPreview` hook over the controller (`useSyncExternalStore`), `SignalPreviewControl`, `ConfigField` children slot, form integration.
3. Visual gate (Phase 3): fixtures in a new module `SignalPreviewFixtures.tsx` (minimal mounting change in `TimerUiPreview.tsx`), deterministic via injected timer/audio; screenshots.

## Critical Implementation Details

- **Timing & lifecycle** — `controller.play()` must call `createAudio()` synchronously in the click handler (no `await` before it). Reuse the existing port only if `port.available`; otherwise close it and create a new one in this gesture. Start calls `release()` before `onStart`.
- **Time domain** — cue start times use `now()` injected as `performance.now()/1000`; the playing state ends at the last returned `ScheduledCue.end`, not at a computed duration.

---

## Phase 1: Signal preview library and controller

### Overview

Pure, UI-free code guaranteeing the same signals and a tested audio lifecycle.

### Changes Required:

#### 1. Time parser export

**File**: `src/lib/drill-timer.ts`

**Intent**: Let availability logic validate Rest on its own without the other fields.

**Contract**: export `parseDrillTime(value: string, allowZero: boolean): number | undefined` (current private `parseTime`, behaviour unchanged).

#### 2. Preview module

**File**: `src/lib/drill-signal-preview.ts`

**Intent**: Signal catalogue, English meaning texts, availability, and scheduling of the drill's own cues.

**Contract**: `type PreviewSignal = "exercise" | "rest" | "standby"`; `SIGNAL_MEANINGS`; `previewCueSequence(signal): readonly { cue: DrillCue; offset: number }[]`; `playSignalPreview(audio: DrillAudioPort, signal, startAt): ScheduledCue` (end of the last scheduled cue; second Standby cue at `first.start + STANDBY_SECOND_OFFSET`); `signalAvailability(values: DrillConfigInput, signal): { enabled: boolean; note?: string }` — exercise and standby always enabled (Standby note only when Random start is off), rest disabled with "zero" or "invalid" note.

#### 3. Controller

**File**: `src/lib/drill-signal-preview-controller.ts`

**Intent**: Own preview audio lifecycle as an external store.

**Contract**: `createSignalPreviewController({ createAudio, now, setTimer, clearTimer })` → `{ play(signal), release(), subscribe(l), getSnapshot() }`; snapshot `{ status: "idle" | "initializing" | "playing" | "unavailable"; signal: PreviewSignal | null }`; `play` ignored while `initializing`; reuse port only when `available`, else close and recreate; `null`/rejection → `unavailable` (retried by next play); port `onUnavailable` → `unavailable`; new play cancels previous cue; playing ends via timer at last `ScheduledCue.end - now()`; `release()` idempotent, closes port, clears timer and uses `observeDrillAudioInitialization` so a late grant is closed.

#### 4. Tests

**Files**: `src/lib/drill-signal-preview.test.ts`, `src/lib/drill-signal-preview-controller.test.ts`

**Intent**: Prove same signals and lifecycle.

**Contract**: sequences equal cues recorded from `DrillRun` for exercise/rest/standby; end time from a returned cue with shifted start; availability (rest `0:00`, `0:02`, `abc`, `11:00`; Standby with toggle on/off always enabled); controller: click during initializing ignored, late grant after release closed, dead port replaced, `null` then retry, overlapping play cancels, release idempotent, playing clears at end.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- `npx astro sync`, `npm run lint`, contract rule tests (`node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`), `npx astro check`, `npm run build` pass

---

## Phase 2: Preview controls in the configuration form

### Overview

User-facing buttons and texts wired to the controller.

### Changes Required:

#### 1. Hook

**File**: `src/components/hooks/useSignalPreview.ts`

**Intent**: Thin React binding: creates one controller per form, exposes snapshot via `useSyncExternalStore`, releases on unmount.

**Contract**: `useSignalPreview(createAudio = createDrillAudio)` → `{ status, signal, play(signal), release() }`; real `now`/timers injected.

#### 2. Control

**File**: `src/components/timer/SignalPreviewControl.tsx`

**Intent**: Outline `Button` (`type="button"`, `Play` icon, `aria-busy` while initializing), meaning text, visible disabled/info note, `role="status"` text, `ui/alert` on unavailable.

**Contract**: props `{ id, signal, availability, status, activeSignal, onPlay }`; semantic tokens and Tailwind scale only.

#### 3. Form integration

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: Put controls under Exercise, Rest, Random start; "Preparation has no sound." under Preparation; release before `onStart`.

**Contract**: `ConfigField` accepts `children` rendered after hint/error; new optional prop `createAudio`; Start path `release()` then `onStart`; existing fields keep order, new buttons add tab stops.

### Success Criteria:

#### Automated Verification:

- All gates pass (same list as Phase 1)
- Click on preview never invokes `onStart` (covered by a fixture assertion and the `type="button"` contract in the control)

#### Manual Verification:

- Buttons play audible cues in a real browser and the meaning text is clear (needs a human with speakers; not claimed by the agent)

---

## Phase 3: Visual gate on `/dev/timer-ui`

### Overview

Production-backed, deterministic fixtures and screenshots.

### Changes Required:

#### 1. Fixtures

**Files**: `src/components/timer/SignalPreviewFixtures.tsx` (new), `src/components/timer/TimerUiPreview.tsx` (mount only)

**Intent**: Render the production `DrillConfigForm` with `FixtureAudio` and an injected manual timer so states are deterministic: default; disabled (Rest 0:00 and invalid); error (audio unavailable); loading (initializing, manually released); playing (end released manually); Random start off note. Existing seven timer states and held-mounted lifecycle scenarios stay untouched.

**Contract**: cards with `data-fixture`/`data-visual-state`; no literal colors; hover and focus-visible captured by interaction.

#### 2. Screenshots and handoff

**Files**: `context/changes/preview-phase-signals/screenshots/*.png`, `handoff.md`

**Intent**: Capture default, hover, focus-visible, disabled, error, loading, playing, empty (justified N/A: the form always renders fields) in light/dark at 1280/390 px and review them; record honestly what was verified automatically vs. what needs a human.

### Success Criteria:

#### Automated Verification:

- All gates pass; screenshots exist for every required state × theme × viewport

#### Manual Verification:

- A human reviews screenshots and listens on real devices (not claimed by the agent)

---

## Testing Strategy

### Unit Tests:

- Cue-sequence equality with `DrillRun`, availability, controller state machine (above).

### Integration Tests:

- Production build and CI smoke unchanged (`/dev/timer-ui` stays 404 in production preview).

## Performance Considerations

One `AudioContext` per form at a time, closed on Start/unmount or when dead; one end-of-cue timer.

## Migration Notes

None (no data or env changes).

## References

- `src/lib/drill-audio.ts:35-100`, `src/lib/drill-run.ts:259-316`, `src/lib/drill-audio-initializer.ts`, `src/components/timer/DrillConfigForm.tsx`, `src/components/timer/TimerUiPreview.tsx:90-125`
- PRD FR-004, US-01; roadmap S-03; `reviews/plan-review.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Signal preview library and controller

#### Automated

- [x] 1.1 Preview and controller unit tests pass — e743851
- [x] 1.2 Lint, contract rule tests, astro sync/check and build pass — e743851

### Phase 2: Preview controls in the configuration form

#### Automated

- [x] 2.1 All gates pass — 41f306c
- [x] 2.2 Preview click never invokes Start — 00a863c

#### Manual

- [x] 2.3 Buttons play audible cues in a real browser and the meaning text is clear — confirmed manually by the user (2026-10-08)

### Phase 3: Visual gate on /dev/timer-ui

#### Automated

- [x] 3.1 All gates pass and screenshots exist for every required state, theme and viewport — 00a863c

#### Manual

- [x] 3.2 A human reviews screenshots and listens on real devices — confirmed manually by the user (2026-10-08)
