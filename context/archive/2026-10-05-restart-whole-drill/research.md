---
date: 2026-10-05T07:53:09.9630634+02:00
researcher: timer-controls
git_commit: 34e8b7d1b942dbb40185727a17e4ee534be3c396
branch: feature/restart-whole-drill
repository: 10xDevs4
topic: "S-08 FR-008: restart the complete drill from the first configured phase"
tags: [research, codebase, timer, restart-whole-drill]
status: complete
last_updated: 2026-10-05
last_updated_by: timer-controls
---

# Research: S-08 FR-008 restart-whole-drill

**Date**: 2026-10-05T07:53:09.9630634+02:00
**Researcher**: timer-controls
**Git Commit**: 34e8b7d1b942dbb40185727a17e4ee534be3c396
**Branch**: feature/restart-whole-drill
**Repository**: 10xDevs4

## Research Question

For the existing `/` timer view, determine how to add an unconfirmed Restart action that starts the entire current drill at its first configured phase, retains configuration, takes a fresh random wait when random start is enabled, and does not carry lifecycle state or resources from the previous run. Preserve the S-07 Cancel/Pause/Resume contract and identify available tests and visual gates.

## Summary

`/` renders `DrillApp`, which owns the saved form values and current run resources. `DrillTimer` owns the run and its lifecycle cleanup. A correct restart therefore needs a fresh parent run identity and fresh audio/Wake Lock resources created from the Restart gesture, while the old timer crosses the existing synchronous intent and idempotent disposal boundary. A new `DrillRun` must start through `firstDrillPhase(configuration)`; reusing a stopped instance would retain state that `stop()` does not clear.

The existing control bar is already below the time, count and repetition. It has Cancel at left, an empty `size-12` middle slot, and Pause/Resume at right. The seven-file `/` view audit found 0 hard-coded-value scan candidates, 10 semantic token class uses, and 10 imports from `src/components/ui`; this view has no token or Button gap that needs a global design-system change.

## Detailed Findings

### Run ownership and resource boundary

- `src/pages/index.astro:2,16` renders the production `DrillApp` island on `/`.
- `DrillApp` stores form values separately from `activeRun` and the current view (`src/components/timer/DrillApp.tsx:51-61`). Its Start handler creates the initial audio promise and Wake Lock session, requests the lock while the Start gesture is active, then switches to the running view (`DrillApp.tsx:63-81`). This is the existing pattern for opening gesture-restricted resources.
- `ActiveRun` currently contains configuration, audio, and Wake Lock resources but no identity (`DrillApp.tsx:21-25`). The sole production `DrillTimer` call has no React `key` (`DrillApp.tsx:93-96`). Replacing props at that position can rerun its effect without resetting its hook state and refs.
- `DrillTimer` owns `DrillRun`, initialization and pending-Resume state, visibility listener, interval, and an effect-local idempotent disposer (`src/components/timer/DrillTimer.tsx:22-33,35-113`). Cancel sets a synchronous one-way `cancelIntentRef` before disposal and parent navigation (`DrillTimer.tsx:115-120`). A run replacement must not reuse that mounted instance's latch or its prior display/pending state.
- The existing disposer invalidates pending Resume, disposes initial-audio observation, removes the visibility listener, clears the interval, stops the run, disposes the Wake Lock session, unsubscribes, and clears `runRef` (`DrillTimer.tsx:94-113`). Restart can reuse this S-07 boundary; it does not need a general cancellation framework.
- `DrillRun.stop()` invalidates its timer wake and recovery generation, cancels/closes audio, clears segments and paused state, and marks the run finished (`src/lib/drill-run.ts:223-232`). The same instance also owns `resumeTarget`, random samples and prior schedule evidence (`drill-run.ts:44-59,83-84`); `stop()` does not reset those fields. A restarted run must use a fresh `DrillRun`.
- The current stable parent completion callback always sets the view to `completed` (`DrillApp.tsx:55-57`). It has no active-run identity check, so a stale callback from an older run could replace a newer running view. Parent completion and other delayed results need to be accepted only for the current run identity.

### First phase, random selection, and retained settings

- `firstDrillPhase` returns Preparation when `preparationSeconds > 0`; with zero preparation it returns Standby when random start is enabled and Exercise otherwise (`src/lib/drill-timer.ts:68-74`). Restarting from that function gives the required Preparation-0 behavior without inventing a second phase rule.
- `DrillRun` receives a random function with `Math.random` as its default and calls `firstDrillPhase` on `start()` (`src/lib/drill-run.ts:61-81`). The timeline samples a wait for Standby while it rebuilds (`drill-run.ts:240-289`). A fresh run supplies a new sample; tests can inject a deterministic sequence to prove the call is fresh without relying on two random values happening to differ by chance.
- The form's input values remain in `DrillApp` state while the running child is rendered (`DrillApp.tsx:51-54,93-96`). A restart should reuse the current run's immutable configuration snapshot and leave those saved input values intact.

### Async audio, Wake Lock, and visibility

- `observeDrillAudioInitialization` closes an audio port that resolves after its observer was disposed and ignores a late rejection (`src/lib/drill-audio-initializer.ts:3-23`). The replacement run needs its own audio promise and observer.
- `DrillRun.resumeWithAudio` invalidates/ closes a late Resume resource after recovery is stopped or superseded (`src/lib/drill-run.ts:150-175`). A fresh run must not inherit the old run's pending recovery.
- `createDrillWakeLockSession` rejects requests after disposal, tracks hidden state, removes its visibility subscription at disposal, and releases the controller (`src/lib/drill-wake-lock-session.ts:14-42`). The controller uses request generations so a grant that arrives after release is released instead of becoming current (`src/lib/drill-wake-lock.ts:78-131`). A Restart click must create a fresh session and request it synchronously from the visible gesture; old sessions remain governed by their current disposal path.
- On document hide, `DrillTimer` releases Wake Lock, hides the run, invalidates pending Resume and clears its pending UI state (`DrillTimer.tsx:80-90`). The session remembers a hidden event that occurs before the new timer mounts (`drill-wake-lock-session.ts:15-20`). Coverage needs visibility changes while a fresh audio or Wake Lock request is pending, including a late grant after hide.

### Existing tests and UI test seams

- Deterministic unit seams already exist: `DrillRun` accepts an injected clock/random/audio (`src/lib/drill-run.ts:61-67`); `DrillTimer` accepts an injected clock and Resume-audio factory and receives initial audio/Wake Lock as props (`src/components/timer/DrillTimer.tsx:12-20`). Existing tests cover stopped-run wake invalidation and late Resume audio (`src/lib/drill-run.test.ts:81-103,397-440`), late initial audio (`src/lib/drill-audio-initializer.test.ts:30-48`), late Wake Lock grants (`src/lib/drill-wake-lock.test.ts:125-141`), visibility/session disposal (`src/lib/drill-wake-lock-session.test.ts:33-111`), stale Resume attempts (`src/lib/drill-resume-pending.test.ts:6-37`), and zero-preparation/random phase selection (`src/lib/drill-timer.test.ts:37-43,131-145`).
- `/dev/timer-ui` is development-only (`src/pages/dev/timer-ui.astro:5-25`) and reuses production timer components. `TimerUiPreview` has a held-mounted real `DrillTimer` fixture with deferred audio, fake clock, Wake Lock provider, counters and explicit teardown (`src/components/timer/TimerUiPreview.tsx:293-525`). Existing scenarios cover initial-audio pending, active, paused and Resume pending, but the fixture currently records Cancel without replacing its parent run.
- In the inspected preview, the stale-wake action can report that no retained callback existed (`TimerUiPreview.tsx:461-487`). A non-vacuous Restart regression must assert that an old callback was actually captured and that firing it succeeds after the replacement mounts; then it must assert that the new run stays at its first phase and that its display/completion/resource counters do not change.
- The preview can observe a held-mounted production `DrillTimer`, but the inspected `package.json` exposes Node's library test command (`package.json:5-14`) and its manifest/lockfile do not declare a React DOM or browser test runner. The current test seam therefore does not automatically drive the production `DrillApp` parent across a keyed run replacement. Keep any added seam within the timer run-owner boundary and do not add a dependency without coordinator approval.
- Source call-site search over `src` Astro/TSX/TS files found `/` → `DrillApp` (`index.astro:16`), `DrillApp` → `DrillTimer` (`DrillApp.tsx:95`), `DrillTimer` → `DrillTimerView` (`DrillTimer.tsx:151`), and preview uses at `TimerUiPreview.tsx:267,432,653`. The preview's static `DrillTimerView` fixtures are separate from its held-mounted production `DrillTimer` fixture.

### UI audit of `/`

- Audited the seven files `src/pages/index.astro`, `src/layouts/Layout.astro`, `src/components/timer/DrillApp.tsx`, `DrillConfigForm.tsx`, `DrillTimer.tsx`, `DrillTimerView.tsx`, and `ThemeToggle.tsx` at the recorded revision. Running the `/10x-ui` candidate regex across that exact set returned 0 hits; semantic color classes appeared 10 times and imports from `src/components/ui` appeared 10 times across 6 files.
- Token values are defined in `src/styles/global.css` under `:root` and `.dark`, then published via `@theme inline` (`global.css:8-145`). `AGENTS.md:41-48` already requires semantic timer tokens, the existing UI primitives, a fixed Cancel/middle/Pause bar, a development preview and the seven-state gate.
- The shared `Button` provides the outline variant, icon size and token-driven focus styling (`src/components/ui/button.tsx:7-46`). Existing timer controls use the shared Button with `size="icon"` and `size-12` (`DrillTimerView.tsx:59-84`), producing the requested 48 px hitbox. `lucide-react` is already used for the controls (`DrillTimerView.tsx:1`); no shared primitive, dependency, global token or CI change is needed for Restart.
- The bar follows the repetition text: Cancel/X is left, the middle is an empty noninteractive `size-12` slot, and Pause/Resume keeps the right slot (`DrillTimerView.tsx:56-87`). Add Restart in that middle slot and preserve the other controls' positions.

## Charges

1. **The timer has no Restart action.** `src/components/timer/DrillTimerView.tsx:57-64` reserves an empty middle hitbox between Cancel and Pause/Resume; without Restart, users cannot return to the beginning of the current drill while it is running.
2. **A prop replacement does not create fresh timer state.** `src/components/timer/DrillApp.tsx:93-96` renders `DrillTimer` without a run key, while `src/components/timer/DrillTimer.tsx:23-33,115-120` keeps hook state and a one-way intent ref for that mounted instance; restarting in place can leave the new visible run with old pending/paused/cancel state.
3. **A stale completion can change the parent view.** `src/components/timer/DrillApp.tsx:55-57,94-96` passes the same unguarded completion callback to each timer; a completion delivered by an older run can replace the newer run with the Completed view.
4. **A stopped DrillRun is not a restartable run object.** `src/lib/drill-run.ts:44-59,223-232` leaves per-run resume target and accumulated schedule evidence on the stopped object; reusing it risks carrying hidden progress or audio evidence into the restarted drill.
5. **The held-mounted fixture does not exercise a parent run replacement.** `src/components/timer/TimerUiPreview.tsx:293-440,461-487` holds one DrillTimer for Cancel and can fire a retained wake, but does not start a fresh parent-owned timer; a stale-wake count alone could pass without proving the new run is unaffected.

## Architecture Insights

- Keep S-08 within the existing timer ownership chain: `/` → `DrillApp` → `DrillTimer` → `DrillTimerView`. The parent owns the current run identity and gesture-created resources; the timer owns per-run lifecycle state; the view renders the control.
- The synchronous Restart/Cancel intent boundary should deactivate the old owner before React schedules its new state. The idempotent S-07 disposer remains the cleanup path. Delayed audio, Wake Lock, visibility, timer-wake and completion callbacks must remain scoped to their originating identity.
- A new run uses the unchanged settings snapshot, a fresh `DrillRun`, fresh audio, and a fresh Wake Lock session. The first phase and random sampling stay with their current timer-domain functions.
- The visual contract comes from the existing Ocean Breeze tokens and shared Button; no global CSS or UI primitive work is indicated by this audit.

## Historical Context (from prior changes)

- The current source at `34e8b7d1b942dbb40185727a17e4ee534be3c396` contains the S-07 Cancel boundary and the repository rule at `AGENTS.md:44-48`. The coordinator reports S-07 PR #33 merged, PR #34 now merged at main `45951a61e599215684e28d403665ce9824db8daa`, and production browser checks passing; those lifecycle records are checkpoints, not the source of current code behavior.
- Per coordinator instruction, this research does not edit S-07 documents/status or the roadmap. S-08's roadmap item is present as `ready` (`context/foundation/roadmap.md:53,192`); planning leaves it unchanged.

## Related Research

- `context/changes/cancel-current-drill/research.md` and `plan.md` — historical S-07 checkpoints; current behavior was verified against source instead of treating their lifecycle status as current.
- `context/changes/pause-and-resume-drill/research.md` — earlier timer lifecycle context.

## Open Questions

- No FR-008 implementation decision remains unresolved in the supplied requirements. One planning assumption to surface to the coordinator is whether Restart is intentionally limited to mounted timer states; the requested fixed timer-bar placement implies the Completed view remains unchanged.
- Automated React-parent coverage has no declared browser/DOM runner. The plan must preserve a no-new-dependency route to test the production owner identity, held-mounted child lifecycle and stale completion/wake behavior; the exact narrow test seam is described in `handoff.md` for independent plan review.
