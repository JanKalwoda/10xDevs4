# Cancel the current drill — Implementation Plan

## Overview

Add Cancel to the existing guest timer. Cancel returns to configuration with entered values intact, stops the run and its resources through S06 lifecycle code, and blocks late initialization, display/completion, and Resume work at the click boundary.

## Current State Analysis

`/` renders `DrillApp`, which owns editable configuration values and swaps configuration, running, and completed views. `DrillTimer` owns the run effect and its cleanup. The effect cleanup disposes initial audio observation, listeners, interval, run, pending Resume, and Wake Lock, but its `disposed` flag is set only when React executes cleanup. The run subscription, Resume action, and completion path have no synchronous cancel-intent guard in the inspected source. This is an unverified ordering window, not a reproduced browser failure; see [research.md](research.md).

`DrillTimerView` is called from both `DrillTimer` and `TimerUiPreview`. Its new `onCancel` callback must be required and both callers must be updated in Phase 1, so that Phase 1 remains type-checkable and buildable. The preview already renders the production view and is the appropriate location for a development-only held-mounted race fixture. The wider visual matrix and screenshots remain in Phase 2.

### Key Discoveries

- PRD FR-007 and roadmap S-07 require return to configuration with settings preserved: `context/foundation/prd.md:125-126`, `context/foundation/roadmap.md:177-187`.
- `DrillApp` holds form values above the run view and starts a run from a frozen snapshot: `src/components/timer/DrillApp.tsx:51-78,89-99`.
- S06 provides reusable `run.stop()`, initial audio observer disposal, pending Resume invalidation, Wake Lock session disposal, and late grant/audio protection: `src/components/timer/DrillTimer.tsx:88-98`, `src/lib/drill-run.ts:150-175,223-238`, `src/lib/drill-audio-initializer.ts:3-22`, `src/lib/drill-wake-lock-session.ts:14-42`.
- The subscription callback can update display or call `onComplete`, and Resume can start audio and request Wake Lock before effect cleanup; neither has a pre-cleanup cancel guard in the inspected `DrillTimer`: `src/components/timer/DrillTimer.tsx:45-67,114-129`.
- `DrillTimerView` has two call sites, in `DrillTimer.tsx` and `TimerUiPreview.tsx`; both need the new required callback in Phase 1.
- Existing semantic tokens, shared Button, timer lint rule, and `/dev/timer-ui` are sufficient; no shared style, primitive, dependency, CI, or smoke change is needed.

## Desired End State

The `/` timer exposes an accessible Cancel action during initialization, active running, paused, and pending Resume. One stable icon control bar sits below time/count/repetition: Cancel/X left, empty middle, and Pause/Resume in the same right slot. The click synchronously latches cancel intent and invokes one idempotent S06 disposal path before notifying the parent. Late initial audio, display/completion, Resume, and Wake Lock work cannot revive the run or show Completed. The parent returns to configuration and retains form values.

Phase 1 updates both `DrillTimerView` callers, passes `astro check` and `npm run build` independently, and verifies the held-mounted race fixture. Phase 2 expands the visual fixtures, checks the control bar across the required state/theme/viewport matrix with equal right-slot bounds, captures and reviews screenshots, and records the timer contract in agent guidance.

## What We're NOT Doing

- S08 restart or reset behavior.
- A confirmation prompt; FR-007 records no change to that concern.
- Authentication, saved configurations, database work, or changes to the index shell.
- Shared CSS, layout, UI primitives, dependencies, package files, CI, smoke scripts, or Wrangler configuration.
- Changes to S09-owned auth, index-shell, CI/smoke, or Wrangler work.
- Physical-device Wake Lock claims or checks.

## Implementation Approach

Keep `DrillApp` as the owner of form values and view selection. Add a required `onCancel` callback through `DrillTimerView` and `DrillTimer`. Render the stable three-column bar below time/count/repetition and keep Cancel enabled in every requested state. Latch cancel intent synchronously, run the same idempotent disposal path as effect teardown, then notify the parent. Guard initialization, subscription updates/completion, Resume initiation, and Resume settlement. The parent returns to configuration and clears `activeRun` without changing `values`.

Phase 1 includes the minimum `TimerUiPreview` caller update, a meaningful preview Cancel response, and the controlled race gate. Phase 2 broadens visual fixture coverage and completes the screenshot/agent-rule gate. No charge from `research.md` is deferred.

## Critical Implementation Details

React effect cleanup alone does not define a synchronous boundary at the Cancel event: late work may run before cleanup marks the effect disposed. Set cancel intent before calling parent state setters; disposal must synchronously invalidate pending Resume, detach the audio observer, stop the run, and invalidate/release Wake Lock requests. Reuse one idempotent cleanup path for both the click and later unmount, and guard callbacks so no `onDisplay` or `onComplete` effect escapes after the latch. The Phase 1 browser gate must deliberately hold the child mounted after Cancel rather than rely on a timing sleep.

## Phase 1: Cancel boundary, caller contract, and lifecycle gate

### Overview

Implement the usable Cancel path and its synchronous resource boundary. Update every current `DrillTimerView` caller in this phase, add a controlled race fixture in the existing development preview, and pass the type/build gates before committing Phase 1.

### Changes Required

#### 1. Parent transition and synchronous timer cancellation

**Files**: `src/components/timer/DrillApp.tsx`, `src/components/timer/DrillTimer.tsx`

**Intent**: Return to configuration and stop the active run at the user's Cancel action, including work whose React cleanup has not run yet.

**Contract**: Add a dedicated parent cancel handler that selects configuration and clears `activeRun` without changing `values`; keep normal completion separate. `DrillTimer` and `DrillTimerView` both keep required `onCancel` callbacks. `DrillTimer` adds only two optional dependency seams: `clock?: DrillClock`, defaulting to `browserDrillClock`, and `createResumeAudio?: () => Promise<DrillAudioPort | null>`, defaulting to `createDrillAudio`. Keep the existing `audio` Promise prop. Production callers use real defaults; the preview fixture may inject deterministic dependencies. Its Cancel handler latches cancellation synchronously, invokes the same idempotent disposal routine as effect cleanup, then calls `onCancel`. Use existing S06 `run.stop()`, audio observer disposal, Resume invalidation, and Wake Lock session disposal. Check the latch before creating a run from initial audio, applying each subscription update or completion, starting Resume audio/requesting Wake Lock, and applying either Resume settlement. Avoid a generic cancellation manager or second resource owner.

#### 2. Required view callback and all current callers

**Files**: `src/components/timer/DrillTimerView.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Make Cancel visible in every requested run state while keeping the required component contract intact for production and preview callers.

**Contract**: Keep `onCancel` required and render icon-only controls in one stable three-column bar below the time, count, and repetition: Cancel/X in the left slot, layout space only in the middle slot, and Pause or Resume in the right slot. S08 may later put Restart/`RotateCcw` in the middle; S07 must not render a fake or disabled middle action. Pause and Resume use the exact same right-slot button and hitbox. Use the shared `Button` with `size-12` for a 48px target; use existing `lucide-react` icons (`X`, `Pause`, `Play`) marked `aria-hidden`, with accessible `aria-label` and `title`, visible keyboard focus, and semantic tokens. Cancel stays enabled during initialization, active, paused, and pending Resume. Reserve the right slot during initialization and pending Resume with a disabled loader where needed. Put pause/loading status in a reserved equal-height region below the bar so toggling it cannot move the bar vertically. Update `DrillTimer` and every `TimerUiPreview` call site in Phase 1. The preview callback must have a visible, meaningful response, not a missing-prop workaround or production no-op fallback.

#### 3. Focused regression and controlled race fixture

**Files**: `src/lib/drill-run.test.ts`, `src/components/timer/TimerUiPreview.tsx` (development-only fixture in `/dev/timer-ui`)

**Intent**: Verify the synchronous boundary under a deliberately extended click-to-unmount interval using the existing S06 browser fake approach.

**Contract**: Add a narrow `DrillRun.stop()` regression for scheduled work/audio cancellation and no false completion. Add a deterministic development-only fixture that mounts the real `DrillTimer` and holds it mounted after Cancel; its parent records `onCancel` without switching views, and a separate Unmount button releases teardown. Count `onCancel`/`onComplete`, audio schedule/cancel/close, Wake Lock provider requests and sentinel releases, and the visible timer display. Use the existing `audio` Promise prop for deferred initial audio, a real `WakeLockSession` built over the real controller with a fake provider, a fake `DrillClock` implementing `now`/`setWake`/`clearWake`, and a deferred `createResumeAudio` factory. Retain a cleared clock callback separately so scenario B can fire that stale wake once. Do not monkeypatch global timers or `performance`, and add no dependency or test framework.

Cover four separate scenarios:
- A — Pending initial audio: start the same initial visible-gesture Wake Lock request as `DrillApp`, mount `DrillTimer` with unresolved audio, click Cancel, then resolve the audio port and pending Wake Lock grant before unmount. The late port closes and late grant releases.
- B — Active: resolve initial audio and let the real `DrillTimer` start its run and schedule audio. Click Cancel, move fake `now` beyond the run end, then invoke the retained stale clock wake. The production timer display stays unchanged, `onComplete` remains zero, and no further audio schedule occurs.
- C — Paused: pause an active run, Cancel, and check that no new audio schedule, Wake Lock request, display update, or completion occurs.
- D — Resume pending: pause, click Resume with deferred audio and Wake Lock provider grant, click Cancel, then resolve both before unmount. The late port closes and late grant releases without a display update, completion, or post-cancel acquisition.

After each scenario, unmount explicitly and verify disposal is idempotent: counters do not gain extra schedules, completions, acquisitions, or resource releases during teardown. The fake audio port and fake clock establish application call/order behavior only; they do not prove hardware audio output.

### Success Criteria

#### Automated Verification

- `npm test` passes, including the focused stop regression and existing late-initialization, Wake Lock, and pending-Resume tests.
- `npm run lint` passes, including the timer UI contract rule.
- `npx astro sync`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs`, `npx astro check`, and `npm run build` pass after both `DrillTimerView` callers are updated.

#### Manual Verification

- On `/`, separately from the preview fixture, Cancel is visible and enabled during initialization, active running, paused, and pending Resume. Each activation returns to configuration with all entered values intact.
- The bar sits below time/count/repetition with Cancel/X left, a noninteractive empty middle slot, and the 48px Pause/Resume target on the right; paused/loading content does not shift its vertical position. Before the Phase 1 commit, capture and review screenshots of initialization, active, paused, and pending Resume at desktop 1280 px and mobile 390 px in light and dark themes; save them under `context/changes/cancel-current-drill/screenshots/phase-1/`. This is covered by existing Progress item 1.4.
- The held-mounted fixture passes for late initial audio/grant, active stale clock wake, paused Cancel, and pending Resume/audio/grant. It proves no display revival or completion, no post-cancel audio scheduling or Wake Lock request, and no duplicate disposal after the held child is explicitly unmounted.
- Commit Phase 1 separately after its gates; record its SHA in Progress and handoff.

## Phase 2: Visual fixtures, durable rule, and final UI gate

### Overview

Expand the existing preview to make Cancel's states and interaction easy to inspect, record the timer behavior rule, and complete the visual gate for the existing timer view.

### Changes Required

#### 1. Broader timer preview and visual evidence

**File**: `src/components/timer/TimerUiPreview.tsx`

**Intent**: Show the production Cancel behavior across the state matrix and preserve existing default, hover, focus, disabled, error, empty/N/A, and loading examples.

**Contract**: Extend the Phase 1 preview with initialization, active, paused, and pending Resume examples using the stable three-column bar: Cancel/X left, empty middle layout slot, Pause/Resume in the same right slot. Retain completed as empty/N/A because `phase: null` routes to completion. Keep the route development-only and reuse the theme query mechanism. Do not add Restart, copy the reference's yellow/cyan palette or lock icon, or add elapsed/remaining statistics. Use the existing Ocean Breeze semantic tokens, shared `Button`, 48px icon hitboxes, `aria-label`, `title`, and visible focus.

#### 2. Timer behavior guidance

**File**: `AGENTS.md`

**Intent**: Keep later timer changes aligned with the reviewed Cancel state and lifecycle contract.

**Contract**: Add one timer-specific rule outside the generated CLI block: Cancel remains available during initialization, active, paused, and pending Resume, latches synchronously, and uses the existing idempotent S06 teardown path. Keep Cancel/X left, an empty noninteractive middle slot for future S08 Restart, and Pause/Resume in the same right slot of the bar below time/count/repetition; keep Pause/Resume icon-only, size-12, accessibly named, and in a fixed hitbox. Preserve existing token, component, preview, and lint guidance; do not edit unrelated auth guidance.

### Success Criteria

#### Automated Verification

- `npm test` and `npm run lint` pass after the expanded preview and rule update.
- `npx astro sync`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs`, `npx astro check`, and `npm run build` pass.

#### Manual Verification

- In `/dev/timer-ui`, inspect default, hover, focus-visible, disabled, error, empty/N/A, and loading states in light and dark at 1280 px and 390 px. For each of the four viewport/theme combinations, keep the same fixture instance mounted, hold the pointer over the right target, transition ACTIVE→PAUSED→RESUMING, and use browser `getBoundingClientRect()` to assert identical x/y/width/height and a 48px (`size-12`) hitbox for Pause, Resume, and pending Resume; verify the pointer remains over that hitbox. Record pass/fail for each combination. Confirm Cancel stays enabled and named, focus is visible, and completed has no control bar. Empty is N/A because `phase: null` routes to Completed.
- Save and review screenshots in `context/changes/cancel-current-drill/screenshots/phase-2/`; this includes the bar bounds from the preceding manual check and maps to existing Progress item 2.3. Run the prescribed hard-coded-value scan on the timer entry/view/preview and confirm it remains at zero matches.
- Re-run the controlled held-mounted race gate after visual changes. Physical-device Wake Lock behavior remains outside this change.
- Commit Phase 2 separately after its gates. The coordinator handles PR review, final-head CI/production-preview smoke, and merge; do not change CI/smoke configuration in this slice.

## Testing Strategy

Use `npm test` for timer lifecycle regressions and the repository lint, Astro sync/check, timer UI rule, and build gates listed per phase. The lifecycle gate is the deterministic development-only fixture in `TimerUiPreview`: it uses the production `DrillTimer`, its existing deferred audio Promise, the optional clock and Resume-audio seams, and a real `WakeLockSession`/controller composed with a fake provider. Drive the four initial-audio, active stale-wake, paused, and pending-Resume scenarios in explicit order; hold the timer mounted through all deferred settlements and use the separate Unmount control to check idempotence. Do not infer an independently queued display listener: `DrillRun.subscribe` and `tick` notify synchronously, so the active scenario fires a retained stale clock wake into the production tick path. Use no arbitrary sleeps, global timer/`performance` monkeypatches, new dependencies, or new test framework. These fakes verify app-level calls and lifecycle ordering, not hardware audio output. The separate plan review challenged and resolved the fixture's control requirements before implementation. PR CI and production-preview smoke are coordinator/S09 integration gates.

## Performance Considerations

Cancel adds no timer, polling, or wake loop. The click boundary synchronously stops existing scheduled work, closes/cancels audio, and invalidates/releases Wake Lock; unmount reuses the idempotent path.

## Migration Notes

Not applicable; cancellation is local to the active guest run and does not persist data.

## References

- Research and five 10x-ui charges: `context/changes/cancel-current-drill/research.md`
- S07 requirement: `context/foundation/prd.md:125-126`, `context/foundation/roadmap.md:177-187`
- Parent view and lifecycle: `src/components/timer/DrillApp.tsx:51-99`, `src/components/timer/DrillTimer.tsx:30-130`
- View call sites: `src/components/timer/DrillTimerView.tsx`, `src/components/timer/TimerUiPreview.tsx`
- Resource disposal/stale results: `src/lib/drill-run.ts:150-175,223-238`, `src/lib/drill-audio-initializer.ts:3-22`, `src/lib/drill-wake-lock-session.ts:14-42`, `src/lib/drill-resume-pending.ts:7-25`
- Existing UI contract: `AGENTS.md:38-42`, `src/styles/global.css`, `src/pages/dev/timer-ui.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append — <commit sha> when a step lands. Do not rename step titles.

### Phase 1: Cancel boundary, caller contract, and lifecycle gate

#### Automated

- [x] 1.1 `npm test` passes with the focused stop regression and existing async cleanup coverage. — 9e38abf628765c4400f6c11204b00b544a8aebd0
- [x] 1.2 `npm run lint` passes, including the timer UI contract. — 9e38abf628765c4400f6c11204b00b544a8aebd0
- [x] 1.3 Astro sync, timer UI rule tests, `npx astro check`, and `npm run build` pass with every required `DrillTimerView` caller updated. — 9e38abf628765c4400f6c11204b00b544a8aebd0

#### Manual

- [x] 1.4 Production Cancel works in initialization, active, paused, and pending Resume; it returns with configuration retained. — 9e38abf628765c4400f6c11204b00b544a8aebd0
- [x] 1.5 The held-mounted controlled race gate rejects late initialization/display/completion/Resume work and releases late resources without post-cancel starts or duplicate teardown. — 9e38abf628765c4400f6c11204b00b544a8aebd0
- [x] 1.6 Phase 1 is committed separately after its gates; record its SHA in Progress and handoff. — 9e38abf628765c4400f6c11204b00b544a8aebd0

### Phase 2: Visual fixtures, durable rule, and final UI gate

#### Automated

- [x] 2.1 `npm test` and `npm run lint` pass after preview and agent-rule updates. — fdf649568cc35355488292878aa33907c4b6748f
- [x] 2.2 Astro sync, timer UI rule tests, `npx astro check`, and `npm run build` pass. — fdf649568cc35355488292878aa33907c4b6748f

#### Manual

- [x] 2.3 The seven-state `/dev/timer-ui` gate passes in light/dark at 1280/390 px; screenshots are saved/reviewed and the hard-coded-value scan remains at zero. — fdf649568cc35355488292878aa33907c4b6748f
- [ ] 2.4 The held-mounted lifecycle gate still passes and Phase 2 is committed separately; final-head review and required PR CI/smoke pass before coordinator merge.
