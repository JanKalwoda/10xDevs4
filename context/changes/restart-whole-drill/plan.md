# Restart the Whole Drill Implementation Plan

## Overview

Add a Restart action to the existing `/` timer so a user can restart the entire current drill without confirmation. Each restart begins at the configured first phase, retains the saved settings, takes a fresh random wait when random start is enabled, and owns fresh run resources and lifecycle state.

## Current State Analysis

`/` renders `DrillApp`, which owns the configuration values and active run resources. `DrillTimer` owns the `DrillRun`, initialization and Resume state, visibility listener, interval and idempotent disposal. The timer bar already follows the time and repetition text; it has Cancel at left, an empty middle `size-12` slot, and Pause/Resume at right. The parent currently supplies neither a run key nor an identity-guarded completion callback.

### Key Discoveries:

- A changed resource prop can rerun `DrillTimer`'s effect while leaving component state and the one-way intent ref in place (`src/components/timer/DrillTimer.tsx:22-33,94-120`).
- `DrillRun.stop()` closes resources and clears its timeline, but its object also owns Resume target and schedule evidence that stop does not clear (`src/lib/drill-run.ts:44-59,223-232`). Restart needs a new run object.
- `firstDrillPhase` already selects Preparation when configured and selects Standby or Exercise when preparation is zero (`src/lib/drill-timer.ts:68-74`).
- Start creates audio and Wake Lock resources inside the user gesture (`src/components/timer/DrillApp.tsx:63-81`). Restart must retain that direct gesture boundary.
- The seven-file `/` audit found no candidate hard-coded values; it found 10 semantic token class uses and 10 shared UI component imports. Existing `Button`, Ocean Breeze tokens and timer lint rule cover the new control (`src/components/ui/button.tsx:7-46`, `src/styles/global.css:8-145`, `AGENTS.md:41-48`).
- `TimerUiPreview` has a held-mounted production `DrillTimer` fixture and deferred resource fakes, but its current parent records Cancel without starting a replacement run (`src/components/timer/TimerUiPreview.tsx:293-525`). The package declares no React DOM/browser test runner (`package.json:5-14`).

## Desired End State

During a mounted timer run, Restart appears in the middle of the fixed control bar below the time, count and repetition. It uses the existing shared Button with a 48 px hitbox and an accessible name; Cancel and Pause/Resume retain their current positions and behavior.

Activating Restart synchronously ends the old run's authority and uses the existing idempotent disposal path. The new run has a fresh identity/key, `DrillRun`, initial audio promise and Wake Lock session, so progress, paused state, pending Resume, `resumeTarget`, sampled wait, old visibility subscription, timer wakes or delayed completion cannot affect it. Restart begins through `firstDrillPhase` with the current settings; Cancel on the replacement still returns to configuration.

## What We're NOT Doing

- Restart from the Completed view; the scope assumes Restart belongs to the mounted timer bar and leaves the current Completed → Return to configuration flow intact. The coordinator should confirm this interpretation during plan review.
- Changes to auth, account pages, data storage, migrations, infrastructure, deployment or CI configuration.
- Changes to `src/styles/global.css`, shared UI primitives, dependencies or a general cancellation framework.
- Edits to S-07 documents/status or `context/foundation/roadmap.md` during this planning checkpoint.

## Implementation Approach

Use two implementation phases. Phase 1 wires the center control to a fresh, gesture-owned run and protects parent state with run identity. Phase 2 adds held-mounted race regressions, extends the production-backed preview, updates the timer-specific agent rule and completes the visual gate. Each phase lands as its own code/test commit after its automated and manual criteria pass.

## Critical Implementation Details

### Timing & lifecycle

Restart and Cancel must cross a synchronous intent boundary before the parent schedules a replacement or navigation. Use the existing S-07 idempotent disposer to retire the old timer. Accept completion and other delayed results only from the current parent run identity. A Restart on the replacement during initialization must act on that replacement; it must not reopen the retired run.

### Gesture-created resources

The accepted Restart click must synchronously create/request the replacement audio and visible Wake Lock resources from the same gesture, following the Start path. A hide during pending setup must leave the replacement paused and release any late Wake Lock grant. A late old audio grant or Resume audio must close under its originating disposer/recovery generation.

### Run identity and test seam

Do not reuse `DrillRun` or infer a new run from prop changes alone. The parent and child need a fresh run identity/key, and stale completion must not change the new parent's view. There is no declared React DOM test runner; keep automated owner checks in the existing Node test setup and use the production-backed held-mounted preview for the component lifecycle. Do not add a test dependency without coordinator approval.

## Phase 1: Restart Control and Fresh Run Ownership

### Overview

Deliver the user-visible Restart flow and the fresh-run boundary. Preserve S-07 controls while ensuring the accepted Restart gesture starts the full configured drill with new state and resources.

### Changes Required:

#### 1. Add Restart to the fixed timer bar

**File**: `src/components/timer/DrillTimerView.tsx`

**Intent**: Fill the reserved center slot with Restart so users can restart the current drill without moving Cancel or Pause/Resume. Keep the control available while initial audio or Resume is pending so those states can be restarted too.

**Contract**: Use the existing shared outline icon `Button`, `size="icon"`, and `size-12`; use a decorative `RotateCcw` icon and an accessible name such as “Restart drill.” Keep Cancel/X left and Pause/Resume right, each with the existing 48 px hitbox and accessible name. Use no literal colors or arbitrary dimensions.

#### 2. Retire the old run synchronously and start a fresh owner

**File**: `src/components/timer/DrillTimer.tsx`

**Intent**: Latch the accepted Restart intent synchronously, invoke the existing idempotent disposer for the current owner, and ignore any late state changes from it. Preserve the current Cancel and pending-Resume guards.

**Contract**: Add only the Restart callback required by the view and owner. Restart and Cancel share the existing per-run disposal boundary; do not add a general cancellation abstraction. A replacement receives a new keyed timer lifecycle rather than retaining the old instance's refs or hook state.

**File**: `src/components/timer/DrillApp.tsx`

**Intent**: Give each active run a fresh identity and new gesture-created audio/Wake Lock resources while reusing the current configuration snapshot. Prevent completion from a retired run from replacing a newer running view.

**Contract**: The `/` owner is the authority for current run identity and configuration. Pass a fresh key/identity to `DrillTimer`; guard parent completion against that identity. Use the existing Start resource path from the Restart gesture. A fresh child constructs a fresh `DrillRun`, which starts through `firstDrillPhase(configuration)`.

#### 3. Verify fresh phase and random selection

**File**: `src/lib/drill-timer.test.ts`, `src/lib/drill-run.test.ts` (and a narrowly scoped owner test in `src/lib/` only if needed)

**Intent**: Prove that a restart begins from the configured first phase, preserves settings, and samples a new random wait without relying on coincidental `Math.random()` values.

**Contract**: Use the existing deterministic random and clock seams. Cover positive preparation, Preparation `0` with random start disabled, and Preparation `0` with random start enabled. Verify stale owner completion cannot complete the current run. Do not install a React/browser test dependency.

### Success Criteria:

#### Automated Verification:

- Fresh-phase, deterministic-random and stale-owner unit tests pass with `npm test`.
- Phase 1 lint and Astro checks pass with `npm run lint` and `npx astro check`.

#### Manual Verification:

- Production `/` restart scenarios preserve settings and return to the configured first phase for positive/zero Preparation and random/non-random modes.
- Phase 1 control-bar screenshots at 1280/390 px in light/dark are reviewed for 48 px hitboxes, accessible names, focus and stable positions.
**Phase gate**: Run this phase's checks, record the four screenshots and make a separate Phase 1 commit before starting Phase 2.

## Phase 2: Held-Mounted Lifecycle Regressions and Visual Contract

### Overview

Prove that the new owner remains correct across delayed resources, visibility changes, repeated intents and stale callbacks. Preserve the seven-state UI gate and document the timer-control contract for future changes.

### Changes Required:

#### 1. Extend the held-mounted lifecycle fixture

**File**: `src/components/timer/TimerUiPreview.tsx`, `src/pages/dev/timer-ui.astro`

**Intent**: Exercise Restart and Cancel through the production timer components while a test parent remains mounted across run replacement. Keep deterministic resource fakes and explicit teardown for repeatable review.

**Contract**: Cover initial audio pending, active, paused, pending Resume, late initial/Resume audio, pending/late Wake Lock grants, hide/show transitions, rapid repeated Restart, Restart → Cancel, stale completion and stale timer wake. For stale wake, assert a callback was captured before restart, require its fire operation to return success after the replacement mounts, then assert the new run remains at its first phase and its completion/display/resource counters do not change from the post-mount baseline. A counter increment by the fixture alone is not sufficient evidence.

#### 2. Add focused lifecycle regressions without a new test runner

**File**: `src/lib/drill-audio-initializer.test.ts`, `src/lib/drill-run.test.ts`, `src/lib/drill-resume-pending.test.ts`, `src/lib/drill-wake-lock.test.ts`, `src/lib/drill-wake-lock-session.test.ts`, plus any narrow owner-identity test established in Phase 1

**Intent**: Extend the existing deterministic unit coverage so late resources and old run callbacks are tested at their source, while the held-mounted fixture verifies their interaction with the production UI.

**Contract**: Retain the current injected clock, deferred audio, recovery-generation and Wake Lock provider seams. Assert late old resources are closed/released, old visibility and wake callbacks cannot update the new run, and only the currently owned run can complete. Keep the tests specific to this timer flow.

#### 3. Update the timer rule and capture the visual gate

**File**: `AGENTS.md`

**Intent**: Replace the reserved-middle-slot guidance with the completed Restart contract so later work preserves the fixed bar and lifecycle boundary.

**Contract**: Edit only the existing timer-specific section outside the generated 10x CLI block. State the order below time/count/repetition, Cancel left, Restart middle, Pause/Resume right, 48 px hitboxes, accessible names, shared Button and semantic tokens; require production-backed preview/lifecycle fixtures and the seven-state gate. Keep existing lint enforcement; no token or shared primitive change is warranted.

**File**: `context/changes/restart-whole-drill/screenshots/phase-2/`

**Intent**: Keep reviewable evidence for the complete timer view and required control states.

**Contract**: Save reviewed screenshots from `/dev/timer-ui` for default, hover, focus-visible, disabled, error, empty or justified N/A, and loading in light/dark at 1280/390 px. For this timer, Restart remains enabled during the required setup/Resume-pending cases; show the neighboring disabled Pause/Resume state. Explain Empty as N/A because the running timer renders no phase-less empty view. Also exercise Restart/Cancel and run replacement on production `/`; the preview alone does not verify parent completion ownership.

### Success Criteria:

#### Automated Verification:

- Focused Node lifecycle tests prove late resources, visibility and retired-owner callbacks cannot affect the replacement run.
- Full project command gates pass: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`, `npx astro check`, and `npm run build`. The unchanged CI production-preview `npm run smoke` gate passes and confirms `/dev/timer-ui` returns 404 in production.

#### Manual Verification:

- All seven `/dev/timer-ui` states (default, hover, focus-visible, disabled, error, Empty N/A, and loading) are reviewed at 1280/390 px in light/dark, with screenshots saved and the N/A reason documented.
- Production `/` and held-mounted interactions cover rapid Restart, Restart → Cancel, visibility changes and a retained stale wake that actually fires after replacement without changing its first phase, completion or resources.
**Phase gate**: Run all project and inherited CI gates, review the screenshots and held-mounted scenarios, then make a separate Phase 2 commit. Pause for coordinator review before implementation begins; after PR #34, first synchronize this branch with main `45951a61e599215684e28d403665ce9824db8daa`.

## Testing Strategy

### Unit Tests:

- Fresh first-phase selection and deterministic random wait sampling for new runs.
- Run ownership and stale completion rejection at the narrow parent boundary.
- Late initial audio, late Resume audio, stale Resume result, late Wake Lock grant, session disposal, visibility change and retained wake invalidation.

### Integration Tests:

- Extend the development-only held-mounted preview to keep its parent mounted while the production `DrillTimer` is replaced and to drive the real Restart/Cancel controls.
- Assert the old wake actually fires after replacement and that new-run display, completion and resource counters remain stable.

### Manual Testing Steps:

1. Use `npm run dev -- --host 127.0.0.1 --port 4322` and interact with `/` using short test settings; do not start or stop Supabase on port 55321. If a server is started, stop only the PID created for this worktree.
2. Exercise Preparation enabled, Preparation `0` without random start, and Preparation `0` with random start; restart from later repetitions and verify first-phase behavior, settings retention and the fresh random sample through deterministic tests.
3. Exercise Restart and Cancel while initialization, pause, Resume recovery and visibility changes are pending; confirm each old owner is unable to change the current run.
4. Inspect `/dev/timer-ui` at 1280/390 in light/dark and save the full seven-state evidence in the change folder.

## Performance Considerations

Restart must retire the old interval, timer wake, visibility subscription, audio and Wake Lock session before the replacement becomes authoritative. The replacement should own one timer lifecycle and its own resources; no parallel scheduling or extra polling loop is needed.

## Migration Notes

None. Restart changes the client-side lifecycle of the current in-memory timer configuration.

## References

- Related research: `context/changes/restart-whole-drill/research.md`
- Production route: `src/pages/index.astro:2-16`
- Run owner: `src/components/timer/DrillApp.tsx:21-103`
- Timer lifecycle: `src/components/timer/DrillTimer.tsx:22-147`
- Fixed control bar: `src/components/timer/DrillTimerView.tsx:56-87`
- Run and first-phase rules: `src/lib/drill-run.ts:44-81`, `src/lib/drill-timer.ts:64-74`
- Lifecycle preview: `src/components/timer/TimerUiPreview.tsx:293-525`
- Token and component contract: `src/styles/global.css:8-145`, `src/components/ui/button.tsx:7-46`, `AGENTS.md:41-48`
- CI command gates: `.github/workflows/ci.yml:1-75`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append — <commit sha> when a step lands. Do not rename step titles.

### Phase 1: Restart Control and Fresh Run Ownership

#### Automated

- [ ] 1.1 Fresh-phase, deterministic-random and stale-owner unit tests pass with `npm test`.
- [ ] 1.2 Phase 1 lint and Astro checks pass with `npm run lint` and `npx astro check`.

#### Manual

- [ ] 1.3 Production `/` restart scenarios preserve settings and return to the configured first phase for positive/zero Preparation and random/non-random modes.
- [ ] 1.4 Phase 1 control-bar screenshots at 1280/390 px in light/dark are reviewed for 48 px hitboxes, accessible names, focus and stable positions.

### Phase 2: Held-Mounted Lifecycle Regressions and Visual Contract

#### Automated

- [ ] 2.1 Focused Node lifecycle tests prove late resources, visibility and retired-owner callbacks cannot affect the replacement run.
- [ ] 2.2 Full project command gates pass: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`, `npx astro check`, and `npm run build`. The unchanged CI production-preview `npm run smoke` gate passes and confirms `/dev/timer-ui` returns 404 in production.

#### Manual

- [ ] 2.3 All seven `/dev/timer-ui` states (default, hover, focus-visible, disabled, error, Empty N/A, and loading) are reviewed at 1280/390 px in light/dark, with screenshots saved and the N/A reason documented.
- [ ] 2.4 Production `/` and held-mounted interactions cover rapid Restart, Restart → Cancel, visibility changes and a retained stale wake that actually fires after replacement without changing its first phase, completion or resources.
