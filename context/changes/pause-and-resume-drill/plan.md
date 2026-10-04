# Pause and safely resume a drill — Implementation Plan

## Overview

Add manual Pause/Resume to the guest timer at /. Preserve the existing FR-006 recovery behavior and add best-effort screen Wake Lock with a calm English notice when unavailable. Keep the change within the existing timer view and design system.

## Current State Analysis

DrillRun.hide()/resumeWithAudio() already implement the phase recovery and stale-audio protections. DrillTimer pauses on hidden visibility and treats phase: null as completion. DrillTimerView has Resume only, with no manual Pause or visible recovery state. The app already has semantic tokens, shared Button/Alert, a timer UI lint rule, and /dev/timer-ui fixtures. See research.md for source references and the three UI charges.

### Key Discoveries:

- FR-006 contract: context/foundation/prd.md:123-124.
- Existing run recovery: src/lib/drill-run.ts:127-197.
- Completion consumer: src/components/timer/DrillTimer.tsx:34-55.

## Desired End State

Users can pause and explicitly resume the guest timer. Hiding the page pauses; returning to it only presents Resume. Resume preserves the correct phase/repetition rules and is initiated by the user. Wake Lock failure never blocks the timer and is explained calmly.

## What We're NOT Doing

- S07 cancellation or S08 restart.
- Auth, persistence, migrations, global CSS/Layout, shared UI primitives, redesign, or new dependencies.
- Claims about unverified physical-device Wake Lock behavior.

## Implementation Approach

Keep DrillRun as the authority for timing and recovery. Add a small injectable Wake Lock controller with unit tests, then expose Pause/Resume and explicit loading/notice states through the existing view. Integrate Start, Pause, hidden visibility, Resume, completion, and unmount in the final phase. Reuse the current preview and existing UI rules.

## Critical Implementation Details

Request Wake Lock from a visible Start gesture and retry only from an explicit visible Resume gesture. Release on manual Pause, hidden visibility, completion, and unmount; release must invalidate a pending request and dispose of a late grant. Visibility return must never resume the timer or reacquire the lock. Audio recovery remains in the Resume gesture. A lock failure only updates the notice. Pause/invalidation must not publish phase: null as false completion.

## Phase 1: Pause and Wake Lock lifecycle primitives

### Overview

Add a testable Wake Lock boundary and explicit regression coverage for the existing pause/recovery contract. This phase has its own checks and commit.

### Changes Required:

#### 1. Wake Lock controller

**File**: src/lib/drill-wake-lock.ts (new)

**Intent**: Isolate best-effort screen-lock acquisition and release, including unsupported/rejected requests and late asynchronous results.

**Contract**: Use these typed interfaces:

- WakeLockStatus is idle | requesting | held | unavailable.
- WakeLockSentinelPort exposes release(): Promise<void>, addEventListener(type: "release", listener: () => void): void, and removeEventListener(type: "release", listener: () => void): void.
- WakeLockProvider exposes request(): Promise<WakeLockSentinelPort>; the injected provider type is WakeLockProvider | null, with null meaning unsupported.
- DrillWakeLockController exposes getStatus(): WakeLockStatus, subscribe(listener: (status: WakeLockStatus) => void): () => void, request(): Promise<void>, and release(): Promise<void>.

subscribe immediately reports the current status and returns an idempotent unsubscribe. request is idempotent while requesting or held; only an explicit visible Start or Resume calls it. A later explicit visible Start/Resume may retry after unavailable. Unsupported or rejected requests set unavailable and resolve without throwing into timer logic. release invalidates the request generation before awaiting a best-effort sentinel release, sets idle for an intentional release, and is idempotent. A stale late grant is released immediately and never published as held. A release event from the current sentinel sets unavailable; an intentional release event does not. Neither browser loss nor visibility return causes an automatic retry.

#### 2. Wake Lock tests

**File**: src/lib/drill-wake-lock.test.ts (new)

**Intent**: Verify lock behavior without browser globals or a physical device.

**Contract**: Cover unsupported and rejected requests, status/subscription transitions and unsubscribe, idempotent requests while pending/held, intentional release versus browser-triggered release, release invalidation, a grant arriving after release, and non-throwing best-effort release. Lock failure must not throw into or block timer logic.

#### 3. Pause recovery regression tests

**File**: src/lib/drill-run.test.ts

**Intent**: Pin the existing FR-006 behavior used by manual Pause and hidden-page recovery.

**Contract**: Cover same-repetition recovery and preserved completed repetitions after Standby/Exercise, remaining-time recovery in Preparation/Rest, and no false phase:null completion on pause. Reuse the existing hide/resumeWithAudio behavior.

### Success Criteria:

#### Automated Verification:

- npm run test passes with Wake Lock edge cases and pause/recovery invariants covered.
- npm run lint passes.
- npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 1.

#### Manual Verification:

- Phase 1 is committed separately after these checks; record its SHA in Progress and handoff, then stop before Phase 2.

## Phase 2: Pause controls and view states

### Overview

Expose the controls and feedback in the existing view, then verify their keyboard and visual states using the deterministic preview. Commit this phase independently.

### Changes Required:

#### 1. Timer view and handlers

**File**: src/components/timer/DrillTimerView.tsx

**Intent**: Let users pause an active run and understand paused, recovering, and Wake Lock-unavailable states.

**Contract**: Show Pause while active and Resume while paused; use neutral English paused copy; expose a pending status and disable duplicate controls during audio recovery; show the calm English Wake Lock notice. Keep accessible control names and existing Button/Alert/token styles.

**File**: src/components/timer/DrillTimer.tsx

**Intent**: Connect Pause/Resume to the existing run and expose asynchronous recovery to the view.

**Contract**: Pause uses DrillRun.hide(); Resume calls resumeWithAudio(createDrillAudio) from the click handler. Visibility return does not resume. Keep phase:null reserved for completion.

The pending Resume state is observable in the view and is owned by a monotonically increasing attempt generation. A hidden-page invalidation increments the generation and clears the pending state immediately. The async handler's finally clears pending only when its token is still current, so an older attempt cannot clear the state of a newer explicit Resume.

**File**: src/lib/drill-resume-pending.ts (new)

**Intent**: Make ownership of the pending Resume state generation-safe and unit-testable without a browser.

**Contract**: begin() marks pending and returns its generation token; invalidate() increments the generation and clears pending; finish(token) clears pending only for the current token and reports whether it did so. DrillTimer updates its React pending state on begin/invalidate and only on a successful current-token finish.

**File**: src/lib/drill-resume-pending.test.ts (new)

**Intent**: Pin the pending-state race used by the Resume button.

**Contract**: Reproduce hide during pending → visible page → new explicit Resume → old result settles first. The hidden invalidation clears pending; the stale attempt's finally cannot clear the newer attempt's pending state; only the newer result clears it.

#### 2. Deterministic fixtures

**File**: src/components/timer/TimerUiPreview.tsx

**Intent**: Make the new production view states inspectable without starting a real run or audio.

**Contract**: Add active, paused, recovery-pending/disabled, and Wake Lock-unavailable fixtures. Reuse production components and keep the route development-only.

### Success Criteria:

#### Automated Verification:

- npm run test passes after the control and fixture changes.
- npm run lint passes, including the existing timer UI contract.
- npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 2.
- npm run test includes and passes the hide-during-pending → visible → new Resume → old-result-first generation regression.

#### Manual Verification:

- In /dev/timer-ui, verify Pause/Resume, recovery-pending, disabled, and notice states with keyboard-visible focus in light/dark at 1280 px and 390 px. Save interim screenshots in the change folder; confirm the timer view/preview scan still has zero hardcoded-value hits.
- Phase 2 is committed separately after these checks; record its SHA in Progress and handoff, then stop before Phase 3.

## Phase 3: Run integration and final gates

### Overview

Connect Wake Lock to the real guest run lifecycle and pass the local automated, browser, and visual gates. Commit this phase independently; only after that commit push/open the PR and wait for coordinator review and required CI before merge.

### Changes Required:

#### 1. Start and teardown integration

**File**: src/components/timer/DrillApp.tsx

**Intent**: Scope a Wake Lock controller to the active run and start the best-effort request during the existing Start gesture.

**Contract**: Store the controller with the active run; request only when the document is visible. Preserve Web Audio creation in the Start gesture.

**File**: src/components/timer/DrillTimer.tsx

**Intent**: Tie lock lifecycle and status to actual timer events.

**Contract**: Release on Pause, hidden visibility, completion, and unmount. Retry only on visible Start or explicit visible Resume. Do not auto-resume or retry when visibility returns. A denied/unsupported/lost lock updates status but does not affect the run.

#### 2. Final preview gate

**File**: src/components/timer/TimerUiPreview.tsx

**Intent**: Verify the integrated view against the repository's required UI state matrix.

**Contract**: Show or justify N/A for default, hover, focus-visible, disabled, error, empty, and loading. Use the non-blocking Wake Lock notice for the limitation/error state. Empty is N/A because phase:null is handed to the completion view. Save and review screenshots; keep the existing agent/lint UI guard.

### Success Criteria:

#### Automated Verification:

- npm run test passes against the integrated lifecycle.
- npm run lint passes.
- npm run build passes in the repository's configured environment.
- npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 3.

#### Manual Verification:

- On /, verify visible Start tries Wake Lock; denial/absence leaves the timer running with the English notice. Pause, hidden visibility, completion, and unmount release it. Showing the page does not resume/reacquire; only visible explicit Resume retries and resumes per FR-006.
- The /dev/timer-ui seven-state gate passes in light/dark at 1280 px and 390 px. Save/review screenshots, document empty as N/A, and confirm the view/preview hardcoded-value scan remains at zero.
- Phase 3 is committed separately after its checks; record its SHA in Progress and handoff, then stop for coordinator review.
- After the Phase 3 commit, push the branch and open the PR. Keep 3.8 pending until coordinator review and required PR CI, including the production-preview smoke job, pass; only the coordinator merges.

## Testing Strategy

Each phase runs its own local checks before its separate commit: Node tests, ESLint, Astro sync/check, and the timer UI lint-rule test. Phase 1 covers the Wake Lock boundary and pause invariants. Phase 2 also tests the hidden-invalidation/new-Resume/stale-result pending-state regression and uses manual deterministic preview checks. Phase 3 reruns those gates, builds in the configured environment, and completes its manual browser/visual checks before its commit. After that commit, push/open the PR; 3.8 stays pending until coordinator review and required PR CI, including the production-preview smoke job, pass. Only the coordinator merges. No browser-test dependency is added.

## Performance Considerations

Request once per visible Start or explicit Resume; do not poll or auto-retry.

## Migration Notes

Not applicable.

## References

- Research and charges: context/changes/pause-and-resume-drill/research.md
- FR-006: context/foundation/prd.md:123-124
- Existing recovery and preview contracts: src/lib/drill-run.ts, src/components/timer/DrillTimer.tsx, src/pages/dev/timer-ui.astro, src/components/timer/TimerUiPreview.tsx

## Progress

> Convention: - [ ] pending, - [x] done. Append — <commit sha> when a step lands. Do not rename step titles.

### Phase 1: Pause and Wake Lock lifecycle primitives

#### Automated

- [x] 1.1 npm run test passes with Wake Lock edge cases and pause/recovery invariants covered. — 61ddf1e
- [x] 1.2 npm run lint passes. — 61ddf1e
- [x] 1.4 npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 1. — 61ddf1e

#### Manual

- [x] 1.3 Phase 1 is committed separately after these checks; record its SHA in Progress and handoff, then stop before Phase 2. — 61ddf1e

### Phase 2: Pause controls and view states

#### Automated

- [x] 2.1 npm run test passes after the control and fixture changes. — 9dcd9f2
- [x] 2.2 npm run lint passes, including the existing timer UI contract. — 9dcd9f2
- [x] 2.5 npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 2. — 9dcd9f2
- [x] 2.6 npm run test includes and passes the hide-during-pending → visible → new Resume → old-result-first generation regression. — 9dcd9f2

#### Manual

- [x] 2.3 In /dev/timer-ui, verify Pause/Resume, recovery-pending, disabled, and notice states with keyboard-visible focus in light/dark at 1280 px and 390 px. Save interim screenshots in the change folder; confirm the timer view/preview scan still has zero hardcoded-value hits. — 9dcd9f2
- [x] 2.4 Phase 2 is committed separately after these checks; record its SHA in Progress and handoff, then stop before Phase 3. — 9dcd9f2

### Phase 3: Run integration and final gates

#### Automated

- [x] 3.1 npm run test passes against the integrated lifecycle.
- [x] 3.2 npm run lint passes.
- [x] 3.3 npm run build passes in the repository's configured environment.
- [x] 3.7 npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check pass for Phase 3.

#### Manual

- [x] 3.4 On /, verify visible Start tries Wake Lock; denial/absence leaves the timer running with the English notice. Pause, hidden visibility, completion, and unmount release it. Showing the page does not resume/reacquire; only visible explicit Resume retries and resumes per FR-006. — Browser lifecycle gate with fake Wake Lock/audio; includes pre-effect hide/show, initial-audio and pending-Resume unmount cleanup. Physical hardware not checked.
- [x] 3.5 The /dev/timer-ui seven-state gate passes in light/dark at 1280 px and 390 px. Save/review screenshots, document empty as N/A, and confirm the view/preview hardcoded-value scan remains at zero. — 16 screenshots in screenshots/phase-3/; empty is N/A because phase:null routes to completion. Theme assertion runs after Astro hydration, after validation, and before every capture.
- [ ] 3.6 Phase 3 is committed separately after its checks; record its SHA in Progress and handoff, then stop for coordinator review.
- [ ] 3.8 After the Phase 3 commit, push/open the PR; coordinator review and required PR CI, including production-preview smoke, must pass before coordinator merge.
