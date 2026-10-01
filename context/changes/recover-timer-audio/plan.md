# Recover timer audio implementation plan

## Overview

Restore audible cues when Resume follows a phone lock. The user authorized planning and implementation together on 2026-10-01.

## Current State Analysis

The frame investigation establishes a permanent silent latch, missing audio recovery in Resume, and a clock anchor that becomes stale if an interrupted context is reused. Countdown resumes correctly; reloading restores audio. Existing tests cover permanent audio failure and visibility pause separately.

## Desired End State

Resume acquires fresh audio from the user gesture before rebuilding the paused timeline. Successful recovery restores subsequent cues and removes the unavailable flag. Failed recovery resumes silently. Repeated locks preserve phase/repetition semantics.

## What We're NOT Doing

Background playback, Bluetooth latency compensation, visual restyling, and changes to pause/repetition semantics are outside this fix.

## Implementation Approach

Use a fresh audio port on Resume rather than reusing an interrupted context. Its existing creation anchor synchronizes performance and audio clocks. Keep async lifecycle ownership in DrillRun, reject duplicate attempts, and discard late results after hide/stop. Use a bounded audio initialization wait so an unresolved browser resume cannot leave the timer stuck.

## Critical Implementation Details

Audio creation must execute synchronously in the click call stack before awaiting its result. Hide must invalidate a pending recovery even if the timer is already paused. Notifications from a replaced audio port must not silence its successor. Scheduling evidence must include earlier ports across recovery.

## Phase 1: Recover audio safely

### Changes Required

**File**: `src/lib/drill-run.ts`

**Intent**: Own replacement audio and asynchronous resume lifecycle.

**Contract**: Add `resumeWithAudio(factory): Promise<void>` while retaining synchronous `resume()` semantics for timeline tests. Accept only the current recovery attempt; close stale ports. Expose accumulated schedule evidence. Continue silently on failure, and ignore old port notifications.

**File**: `src/components/timer/DrillTimer.tsx`

**Intent**: Connect Resume to fresh audio acquisition.

**Contract**: Call `resumeWithAudio(createDrillAudio)` during the visible user action. Read scheduling evidence from the run rather than its original port.

**File**: `src/lib/drill-audio.ts`

**Intent**: Bound initialization and safely dispose failed contexts.

**Contract**: Start `context.resume()` in the user gesture, return null after a bounded initialization timeout or failure, clear timeout handles and catch close rejections.

**Files**: `src/lib/drill-run.test.ts`, `src/lib/drill-audio.test.ts`

**Intent**: Verify recovery, clock mapping, and lifecycle races.

**Contract**: Test restored cues, both interruption/hide orderings, repeated cycles, duplicate actions, failed/late recovery, stop, remaining rest duration, and fresh audio anchor after elapsed wall time.

### Success Criteria

#### Automated Verification

- Unit regression suite passes: `npm test`.
- Lint passes: `npm run lint`.
- Types pass: `npx astro check`.
- Production build passes: `npm run build`.

#### Manual Verification

- iPhone Chrome: start a workout, lock during exercise, unlock and Resume; subsequent Standby/exercise/rest cues are audible. Repeat lock/resume twice; verify preparation and rest preserve their existing semantics. No reload required.

## Testing Strategy

Use deterministic clock/audio fakes for timeline and deferred recovery races; mocked Web Audio for context initialization and anchors. Physical output remains an iPhone acceptance check. No markup/style change is planned.

## References

- `context/changes/recover-timer-audio/frame.md`
- `src/lib/drill-run.ts`, `src/lib/drill-audio.ts`, `src/components/timer/DrillTimer.tsx`

## Progress

### Phase 1: Recover audio safely

#### Automated

- [x] 1.1 Unit regression suite passes — 75e12c7
- [x] 1.2 Lint passes — 75e12c7
- [x] 1.3 Types pass — 75e12c7
- [x] 1.4 Production build passes — 75e12c7

#### Manual

- [ ] 1.5 iPhone Chrome repeated lock/resume restores audible cues
