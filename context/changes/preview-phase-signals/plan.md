# Preview phase signals — Implementation Plan

## Overview

S-03 (FR-004, US-01). On the configuration form at `/`, the user can play the Exercise, Rest and Standby signals next to the matching settings and reads what each sound means. The preview plays exactly the same cues the real drill schedules. Preparation and a 0 s rest have no signal and no play button. All visible text is English.

## Current State Analysis

- The drill schedules cues through `DrillAudioPort.schedule(cue, at)` (`src/lib/drill-audio.ts:35-41`). Cue durations/pitches: `CUE_DURATION`, `STANDBY_SECOND_OFFSET`, `CUE_PITCH` (`drill-audio.ts:47-61`). Standby = two sounds (450 Hz/0.3 s then 750 Hz/0.15 s, second scheduled at `firstSound.start + STANDBY_SECOND_OFFSET`); exercise 2640 Hz/1 s; rest 980 Hz/0.35 s.
- `DrillRun` is the only caller of `schedule` (`src/lib/drill-run.ts:259-260, 267, 308-309, 316`); it emits no cue for preparation and none for a 0 s rest.
- `createDrillAudio()` must be called inside a user gesture (`drill-audio.ts:64`); it returns `null` when Web Audio is missing or not running within 1.5 s.
- `DrillConfigForm` (`src/components/timer/DrillConfigForm.tsx`) owns the fields; `DrillApp` swaps it for the run on Start. `/dev/timer-ui` (`TimerUiPreview.tsx`) renders the production `DrillConfigForm` with fixtures and a `FixtureAudio` port (`TimerUiPreview.tsx:90-125`).
- Timer UI contract lint (`scripts/eslint-rules/timer-ui-contract.mjs`) forbids palette/literal/arbitrary values in timer components.

## Desired End State

- Under Exercise: a "Play exercise signal" button and the text "One long high beep marks the start of each exercise."
- Under Rest: a "Play rest signal" button and "One short beep marks the start of each rest." When Rest parses to 0 s (or is invalid) the button is disabled and the text reads "Rest is 0:00, so there is no rest signal."
- Under Random start: a "Play Standby signal" button and "Two short beeps (lower, then higher) mean Standby: the exercise starts after a hidden random wait of 1–5 s that begins once both beeps end." Enabled only when Random start is checked; otherwise disabled with "Turn on Random start to hear the Standby signal."
- Under Preparation: the text "Preparation has no sound."
- Pressing a play button unlocks audio in that gesture, plays the cue sequence and shows a status ("Playing exercise signal…", cleared at cue end). Pressing another button or Start cancels any preview sound first. If audio is unavailable: inline `role="alert"` "Sound is unavailable in this browser." Preview audio is released on unmount and on Start (the drill creates its own audio).
- The preview never starts a run, wake lock or random delay, and stores nothing.

### Key Discoveries

- Same-signal guarantee comes from one source of truth: a pure helper `previewCueSequence(signal)` uses `STANDBY_SECOND_OFFSET`, and a unit test asserts it equals the cues `DrillRun` schedules for the same phase (`drill-run.test.ts` already has a fake audio/clock harness).
- `observeDrillAudioInitialization` (`src/lib/drill-audio-initializer.ts`) already handles late audio grants after unmount; reuse it.
- `/dev/timer-ui` fixture injection pattern exists (`FixtureAudio`), so the form can take an optional audio factory prop without changing production behaviour.

## What We're NOT Doing

- No preview for preparation or 0 s rest (no signal exists), no volume/pitch settings, no new sounds.
- No change to cue pitches/durations or `DrillRun` scheduling, no Bluetooth latency work (S-14).
- No persistence and no claims about physical audio/device testing (programmatic scheduling only).
- No phase colors (S-05 deferred).

## Implementation Approach

1. Pure library layer (`src/lib/drill-signal-preview.ts`): signal catalogue (kind, button name, meaning text), `previewCueSequence`, `playSignalPreview(audio, signal, startAt)` scheduling via `DrillAudioPort`, and availability rules. Tested with node:test against a fake port and against `DrillRun`.
2. UI: hook `src/components/hooks/useSignalPreview.ts` (gesture-time `createDrillAudio`, lazy single port per form, cancel/close on unmount and on Start, status/error state, end-of-cue timer) and a `SignalPreviewControl` component under `src/components/timer/` using the shared outline `Button` and semantic tokens. `DrillConfigForm` places the controls beside the matching fields and takes an optional `createAudio` prop (default `createDrillAudio`) so fixtures can inject `FixtureAudio`.
3. Visual gate: extend `/dev/timer-ui` with preview-state fixtures (default, rest 0 disabled, Standby disabled, playing, audio unavailable); capture screenshots light/dark at 1280/390 px into `context/changes/preview-phase-signals/screenshots/`.

## Critical Implementation Details

- **Timing & lifecycle** — `createDrillAudio()` must run synchronously inside the click handler (before any `await`). Start must call the hook's `release()` before `onStart`, so the preview context is closed and cannot sound over the run.

---

## Phase 1: Signal preview library and tests

### Overview

Pure, UI-free module guaranteeing the preview uses the drill's own cues.

### Changes Required:

#### 1. Preview module

**File**: `src/lib/drill-signal-preview.ts`

**Intent**: Define the three previewable signals, their English meaning copy, availability rules (rest > 0, random start on), and a function scheduling the same cues the drill schedules.

**Contract**: `type PreviewSignal = "exercise" | "rest" | "standby"`; `SIGNAL_MEANINGS: Record<PreviewSignal, string>`; `previewCueSequence(signal): readonly { cue: DrillCue; offset: number }[]` (standby = first at 0, second at `STANDBY_SECOND_OFFSET`); `playSignalPreview(audio: DrillAudioPort, signal, startAt): number` returns the end time (seconds) from `CUE_DURATION`; `signalAvailability(values: DrillConfigInput, signal): { enabled: boolean; reason?: string }` (rest uses the same m:ss parsing as `parseDrillConfig`; 0 or invalid → disabled).

#### 2. Tests

**File**: `src/lib/drill-signal-preview.test.ts`

**Intent**: Prove the same signals as the run and correct availability.

**Contract**: node:test cases: sequences match cues recorded from a `DrillRun` for exercise, rest and Standby (fake clock/audio as in `drill-run.test.ts`); availability for rest `0:00`, `0:02`, invalid; Standby with toggle off/on; returned end time equals last cue end.

### Success Criteria:

#### Automated Verification:

- Preview tests pass: `npm test`
- Lint, contract rule tests, `npx astro sync`, `npx astro check` and `npm run build` pass

---

## Phase 2: Preview controls in the configuration form

### Overview

User-facing buttons and meaning text wired to the library, with audio lifecycle.

### Changes Required:

#### 1. Preview hook

**File**: `src/components/hooks/useSignalPreview.ts`

**Intent**: Own preview audio: create it in the click gesture, play, cancel the previous sound, report status and unavailability, release on unmount/Start.

**Contract**: `useSignalPreview(createAudio = createDrillAudio)` → `{ play(signal), release(), playing: PreviewSignal | null, unavailable: boolean }`; one port per hook instance; reuses `observeDrillAudioInitialization`; clears `playing` when the cue ends or audio becomes unavailable.

#### 2. Control component

**File**: `src/components/timer/SignalPreviewControl.tsx`

**Intent**: Outline `Button` with `Play` icon and accessible name, meaning text via `aria-describedby`, disabled-reason text, `role="status"` text and unavailable alert.

**Contract**: props `{ id, signal, enabled, reason, playing, onPlay }`; semantic tokens and Tailwind scale only; primitives from `src/components/ui`.

#### 3. Form integration

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: Place controls under Exercise, Rest, Random start and the "no sound" note under Preparation; release preview audio before `onStart`.

**Contract**: new optional prop `createAudio?: () => Promise<DrillAudioPort | null>`; Start path: `release()` then `onStart`; existing fields, validation and tab order unchanged.

### Success Criteria:

#### Automated Verification:

- All gates pass: `npx astro sync`, `npm run lint`, `npm test`, contract rule tests, `npx astro check`, `npm run build`
- Preview state transitions covered by unit tests in `npm test`

#### Manual Verification:

- Buttons play audible cues in a real browser and the meaning text is clear (needs a human with speakers; not claimed by the agent)

---

## Phase 3: Visual gate on `/dev/timer-ui`

### Overview

Production-backed fixtures and screenshots for the new states.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/TimerUiPreview.tsx`

**Intent**: Add signal-preview fixtures rendering the production `DrillConfigForm` with `FixtureAudio`: default, rest 0 (disabled), Random start off (Standby disabled), playing, audio unavailable. Existing seven timer states and held-mounted lifecycle scenarios stay untouched.

**Contract**: fixture cards with `data-fixture` / `data-visual-state` attributes like the existing ones; no literal colors.

#### 2. Screenshots and handoff

**Files**: `context/changes/preview-phase-signals/screenshots/*.png`, `handoff.md`

**Intent**: Capture default, hover, focus-visible, disabled, error, empty (justified N/A), loading (justified N/A) in light/dark at 1280/390 px and review them; record honestly what was verified automatically vs. what needs a human.

### Success Criteria:

#### Automated Verification:

- All gates pass; screenshots exist for every required state × theme × viewport

#### Manual Verification:

- A human reviews screenshots and listens on real devices (not claimed by the agent)

---

## Testing Strategy

### Unit Tests:

- Cue sequences equal `DrillRun` output for exercise, rest, Standby; availability rules; end-time calculation; hook state transitions through the initializer.

### Integration Tests:

- Production build and CI smoke unchanged (`/dev/timer-ui` stays 404 in production preview).

## Performance Considerations

One lazily created `AudioContext` per form, closed on Start/unmount; one end-of-cue timeout.

## Migration Notes

None (no data or env changes).

## References

- `src/lib/drill-audio.ts:35-61`, `src/lib/drill-run.ts:259-316`, `src/components/timer/DrillConfigForm.tsx`, `src/components/timer/TimerUiPreview.tsx:90-125`
- PRD FR-004, US-01; roadmap S-03

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Signal preview library and tests

#### Automated

- [ ] 1.1 Preview tests pass
- [ ] 1.2 Lint, contract rule tests, astro sync/check and build pass

### Phase 2: Preview controls in the configuration form

#### Automated

- [ ] 2.1 All gates pass
- [ ] 2.2 Preview state transitions covered by unit tests

#### Manual

- [ ] 2.3 Buttons play audible cues in a real browser and the meaning text is clear

### Phase 3: Visual gate on /dev/timer-ui

#### Automated

- [ ] 3.1 All gates pass and screenshots exist for every required state, theme and viewport

#### Manual

- [ ] 3.2 A human reviews screenshots and listens on real devices
