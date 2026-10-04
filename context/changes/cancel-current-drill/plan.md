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

The `/` timer exposes an accessible Cancel action during initialization, active running, paused, and pending Resume. The click synchronously latches cancel intent and invokes one idempotent S06 disposal path before notifying the parent. Late initial audio, run display/completion callbacks, Resume actions/results, and pending Wake Lock grants cannot revive the cancelled run or show Completed. The parent returns to configuration and clears the active run while retaining the current form values.

Phase 1 updates both `DrillTimerView` callers and passes `astro check` and `npm run build` on its own. A deterministic dev-only race fixture holds the timer child mounted after Cancel so the test can settle queued callbacks and deferred resources before allowing teardown. Phase 2 expands the visual fixtures, captures and reviews the required matrix, and records the timer contract in agent guidance.

## What We're NOT Doing

- S08 restart or reset behavior.
- A confirmation prompt; FR-007 records no change to that concern.
- Authentication, saved configurations, database work, or changes to the index shell.
- Shared CSS, layout, UI primitives, dependencies, package files, CI, smoke scripts, or Wrangler configuration.
- Changes to S09-owned auth, index-shell, CI/smoke, or Wrangler work.
- Physical-device Wake Lock claims or checks.

## Implementation Approach

Keep `DrillApp` as the owner of form values and view selection. Add a required `onCancel` callback from `DrillTimerView` through `DrillTimer`; render the shared Button outside the state-specific Pause/Resume controls so Cancel remains available while Resume is pending. The timer click handler must set a local synchronous cancel-intent latch, run the same idempotent disposal function used by effect teardown, then invoke the parent callback. Guard initialization, subscription updates/completion, Resume initiation, and Resume promise settlement with that latch. The parent clears `activeRun` and returns to configuration without touching `values`.

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

**Contract**: Add a dedicated parent cancel handler that selects configuration and clears `activeRun` without changing `values`; keep normal completion separate. `DrillTimer` accepts the required `onCancel` callback. Its Cancel handler first latches cancellation synchronously, then invokes the same idempotent disposal routine as effect cleanup, then calls `onCancel`. Use the existing S06 `run.stop()`, audio observer disposal, Resume invalidation, and Wake Lock session disposal. Check the latch before creating a run from initial audio, before applying each run subscription update or calling completion, before starting Resume audio/requesting Wake Lock, and before applying either Resume settlement. Avoid a new generic cancellation manager or a second resource owner.

#### 2. Required view callback and all current callers

**Files**: `src/components/timer/DrillTimerView.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Make Cancel visible in every requested run state while keeping the required component contract intact for production and preview callers.

**Contract**: Add a non-optional `onCancel` prop and render the existing shared `Button` outside the Pause/Resume branches. It stays enabled during pending Resume; use the repository's semantic tokens and accessible name. Update `DrillTimer` and every `TimerUiPreview` call site in Phase 1. The preview callback must have a visible, meaningful response (for example, a fixture-local Cancelled status), not a missing-prop workaround, optional prop, or production no-op fallback.

#### 3. Focused regression and controlled race fixture

**Files**: `src/lib/drill-run.test.ts`, `src/components/timer/TimerUiPreview.tsx` (development-only fixture in `/dev/timer-ui`)

**Intent**: Verify the synchronous boundary under a deliberately extended click-to-unmount interval using the existing S06 browser fake approach.

**Contract**: Add a narrow `DrillRun.stop()` regression for scheduled work/audio cancellation and no false completion. Add a development-only lifecycle fixture whose parent records Cancel but deliberately keeps the production `DrillTimer` mounted until the test releases teardown. Reuse the existing controllable browser AudioContext, Wake Lock, and clock approach; add no dependency or production route. In that held-mounted interval, settle late initial audio/`onReady`, force already-queued display and completion work, settle a pending Resume result, and resolve a pending Wake Lock grant. Assert that no late display or Completed view appears, no post-cancel audio creation/scheduling or Wake Lock request starts, late audio is closed, a late Wake Lock grant is released, and later unmount does not repeat disposal side effects. The gate must control event order directly rather than wait an arbitrary duration.

### Success Criteria

#### Automated Verification

- `npm test` passes, including the focused stop regression and existing late-initialization, Wake Lock, and pending-Resume tests.
- `npm run lint` passes, including the timer UI contract rule.
- `npx astro sync`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs`, `npx astro check`, and `npm run build` pass after both `DrillTimerView` callers are updated.

#### Manual Verification

- On `/`, Cancel is visible and enabled during initialization, active running, paused, and pending Resume. Each activation returns to configuration with all entered values intact.
- The held-mounted race fixture passes for late initial audio, queued display/completion work, pending Resume, and pending Wake Lock grant. It proves no Completed view, no post-cancel audio start/request, and no duplicate teardown after the held child is finally unmounted.
- Commit Phase 1 separately after its gates; record its SHA in Progress and handoff.

## Phase 2: Visual fixtures, durable rule, and final UI gate

### Overview

Expand the existing preview to make Cancel's states and interaction easy to inspect, record the timer behavior rule, and complete the visual gate for the existing timer view.

### Changes Required

#### 1. Broader timer preview and visual evidence

**File**: `src/components/timer/TimerUiPreview.tsx`

**Intent**: Show the production Cancel behavior across the state matrix and preserve existing default, hover, focus, disabled, error, empty/N/A, and loading examples.

**Contract**: Extend the Phase 1 minimal caller/status fixture with clear initialization, active, paused, and pending Resume examples; retain completed as empty/N/A because `phase: null` routes to completion. Keep the route development-only and reuse the theme query mechanism. Do not start a real timer from static visual fixtures.

#### 2. Timer behavior guidance

**File**: `AGENTS.md`

**Intent**: Keep later timer changes aligned with the reviewed Cancel state and lifecycle contract.

**Contract**: Add one timer-specific rule outside the generated CLI block: Cancel remains available during initialization, active, paused, and pending Resume, latches synchronously, and uses the existing idempotent S06 teardown path. Preserve the existing token, component, preview, and lint guidance; do not edit unrelated auth guidance.

### Success Criteria

#### Automated Verification

- `npm test` and `npm run lint` pass after the expanded preview and rule update.
- `npx astro sync`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs`, `npx astro check`, and `npm run build` pass.

#### Manual Verification

- In `/dev/timer-ui`, inspect default, hover, focus-visible, disabled, error, empty/N/A, and loading states in light and dark at 1280 px and 390 px. Confirm Cancel is named, keyboard focus is visible, it remains enabled while Resume is pending, and it does not appear in the completed view. Empty is N/A for the timer because `phase: null` routes to Completed.
- Save and review screenshots in `context/changes/cancel-current-drill/screenshots/phase-2/`; run the prescribed hard-coded-value scan on the timer entry/view/preview and confirm it remains at zero matches.
- Re-run the controlled held-mounted race gate after visual changes. Physical-device Wake Lock behavior remains outside this change.
- Commit Phase 2 separately after its gates. The coordinator handles PR review, final-head CI/production-preview smoke, and merge; do not change CI/smoke configuration in this slice.

## Testing Strategy

Use `npm test` for timer lifecycle regressions and the repository lint, Astro sync/check, timer UI rule, and build gates listed per phase. Use the existing S06 browser fake/Playwright setup with explicit deferred promises and a held-mounted dev-only fixture for the Cancel race; do not add Playwright or another dependency. The separate plan-review must challenge the feasibility and sufficiency of this controlled gate before implementation begins. PR CI and production-preview smoke are coordinator/S09 integration gates.

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

- [ ] 1.1 `npm test` passes with the focused stop regression and existing async cleanup coverage.
- [ ] 1.2 `npm run lint` passes, including the timer UI contract.
- [ ] 1.3 Astro sync, timer UI rule tests, `npx astro check`, and `npm run build` pass with every required `DrillTimerView` caller updated.

#### Manual

- [ ] 1.4 Production Cancel works in initialization, active, paused, and pending Resume; it returns with configuration retained.
- [ ] 1.5 The held-mounted controlled race gate rejects late initialization/display/completion/Resume work and releases late resources without post-cancel starts or duplicate teardown.
- [ ] 1.6 Phase 1 is committed separately after its gates; record its SHA in Progress and handoff.

### Phase 2: Visual fixtures, durable rule, and final UI gate

#### Automated

- [ ] 2.1 `npm test` and `npm run lint` pass after preview and agent-rule updates.
- [ ] 2.2 Astro sync, timer UI rule tests, `npx astro check`, and `npm run build` pass.

#### Manual

- [ ] 2.3 The seven-state `/dev/timer-ui` gate passes in light/dark at 1280/390 px; screenshots are saved/reviewed and the hard-coded-value scan remains at zero.
- [ ] 2.4 The held-mounted lifecycle gate still passes and Phase 2 is committed separately; final-head review and required PR CI/smoke pass before coordinator merge.
