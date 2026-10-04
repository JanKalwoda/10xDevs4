---
date: 2026-10-04T11:54:51+02:00
researcher: "Codex coordinator w4:p1"
git_commit: 4160aca007fc38da6cf567a9b443a5f70806dadc
branch: feature/cancel-current-drill
repository: 10xDevs4
topic: "S07 cancel-current-drill: cancel the active drill and return to configuration"
tags: [research, codebase, timer, cancellation, lifecycle, 10x-ui]
status: complete
last_updated: 2026-10-04
last_updated_by: "Codex coordinator w4:p1"
last_updated_note: "Clarified the cancel-click-to-effect-cleanup race window and identified the required caller updates for DrillTimerView."
---

# Research: Cancel the current drill

**Date**: 2026-10-04T11:54:51+02:00 (Europe/Warsaw)
**Researcher**: Codex coordinator w4:p1
**Git Commit**: 4160aca007fc38da6cf567a9b443a5f70806dadc
**Branch**: feature/cancel-current-drill
**Repository**: 10xDevs4

## Research Question

Plan S07 so Cancel returns the user to the configuration form with settings retained, disposes timer/audio/Wake Lock resources, and rejects late initialization or Resume results in the initialization, active, paused, and pending Resume states. Reuse the merged S06 lifecycle; leave S08 restart and S09-owned work out of scope.

## Summary

- PRD FR-007 requires cancel to return to configuration with settings retained; its recorded decision leaves the accidental-cancel concern unchanged, so this plan does not add a confirmation prompt ([context/foundation/prd.md:125-126](context/foundation/prd.md#L125)).
- At inspected HEAD `4160aca`, `DrillApp` owns editable `values` separately from the view and run snapshot, so the cancel handler can return to configuration and clear `activeRun` without changing the submitted values ([src/components/timer/DrillApp.tsx:51-78,89-99](src/components/timer/DrillApp.tsx#L51)).
- `DrillTimer` effect teardown performs the reusable S06 disposal work, but the inspected code sets its `disposed` flag only when React runs that teardown ([src/components/timer/DrillTimer.tsx:88-98](src/components/timer/DrillTimer.tsx#L88)). The inspected handlers have no synchronous Cancel-intent guard because Cancel does not yet exist; effect cleanup alone therefore does not establish the requested click-to-cleanup ordering guarantee. Whether a browser callback actually settles in that interval remains unverified and needs a controlled gate.
- The one-view UI audit found existing token and component coverage: `DrillTimerView.tsx` has 7 semantic-token class occurrences and 2 direct shared UI imports; the prescribed scan returned 0 hits across the inspected entry/view/preview set of five files. No new color token, button primitive, dependency, or route architecture is indicated ([AGENTS.md:38-42](AGENTS.md#L38), [src/components/timer/DrillTimerView.tsx:2-3](src/components/timer/DrillTimerView.tsx#L2), [src/styles/global.css:8-10,67-69,123-142](src/styles/global.css#L8)).

## Detailed Findings

### Product behavior and configuration state

- The root route renders the guest `DrillApp`; its `values` state is held by the app while the run is shown as a separate child view. Start submits a frozen configuration snapshot, and the form receives the existing `values` when rendered again ([src/pages/index.astro:1-8](src/pages/index.astro#L1), [src/components/timer/DrillApp.tsx:51-54,59-78,89-92](src/components/timer/DrillApp.tsx#L51), [src/components/timer/DrillConfigForm.tsx:56-75](src/components/timer/DrillConfigForm.tsx#L56)).
- Completion is a distinct `completed` view, and `onComplete` switches to it; cancellation should use its own parent handler instead of `onComplete` ([src/components/timer/DrillApp.tsx:54-57,89-99](src/components/timer/DrillApp.tsx#L54), [src/components/timer/DrillTimer.tsx:45-62](src/components/timer/DrillTimer.tsx#L45)). Clearing `activeRun` on cancel drops the completed run/session references while leaving the app-owned form values untouched.
- FR-007 and S-07 already determine the outcome. No product question remains about a confirmation step: PRD records “bez zmian” for that concern, and the current task requires direct return to the form ([context/foundation/prd.md:125-126](context/foundation/prd.md#L125), user task scope).

### Existing lifecycle and late-result handling

- When the timer child unmounts, its effect first marks the owner disposed and invalidates pending Resume, then disposes the initial audio observer, removes browser listeners, clears the interval, stops the run, disposes Wake Lock, and clears the run ref ([src/components/timer/DrillTimer.tsx:88-98](src/components/timer/DrillTimer.tsx#L88)).
- If initial audio resolves after timer unmount, `observeDrillAudioInitialization` closes the returned port and does not call `onReady`; the timer's `begin` guard also closes a port received after disposal ([src/lib/drill-audio-initializer.ts:3-22](src/lib/drill-audio-initializer.ts#L3), [src/components/timer/DrillTimer.tsx:37-43,73](src/components/timer/DrillTimer.tsx#L37)).
- `DrillRun.stop()` advances the recovery generation, invalidates scheduled wakes, cancels and closes audio, clears segments and paused state, and marks the run finished without publishing a completion display ([src/lib/drill-run.ts:223-238](src/lib/drill-run.ts#L223)). For pending Resume, a late replacement audio port is closed when its generation is stale ([src/lib/drill-run.ts:150-175](src/lib/drill-run.ts#L150)); the UI pending token independently prevents an old result from clearing a newer attempt ([src/lib/drill-resume-pending.ts:7-25](src/lib/drill-resume-pending.ts#L7)).
- Wake Lock disposal unsubscribes the session's visibility listener and releases through a controller that invalidates a pending request before awaiting release; a late grant is released by the controller ([src/lib/drill-wake-lock-session.ts:14-42](src/lib/drill-wake-lock-session.ts#L14), [src/lib/drill-wake-lock.ts:78-99,125-132](src/lib/drill-wake-lock.ts#L78)).
- These code paths support Cancel during initialization, active running, paused, and pending Resume. The one missing behavior is a visible Cancel action in those states; `DrillTimerView` currently renders the loading status, Pause, or Resume branches without a Cancel callback ([src/components/timer/DrillTimerView.tsx:37-69](src/components/timer/DrillTimerView.tsx#L37)).

### Cancel click versus deferred effect cleanup

- In the inspected `DrillTimer`, `disposed` is local to the effect and becomes true in its cleanup at lines 88-98. `begin` checks that flag before creating a run and closes an arriving audio port when it is true ([src/components/timer/DrillTimer.tsx:30-43,88-98](src/components/timer/DrillTimer.tsx#L30)).
- The subscription callback at lines 45-67 can call `setDisplay`, clear initialization, and invoke `onComplete`; that callback does not check `disposed` or a cancel intent in the inspected source ([src/components/timer/DrillTimer.tsx:45-67](src/components/timer/DrillTimer.tsx#L45)). `DrillApp`'s completion handler directly selects the completed view ([src/components/timer/DrillApp.tsx:55-57](src/components/timer/DrillApp.tsx#L55)).
- The Resume handler starts `resumeWithAudio` and requests Wake Lock before its promise handlers; pending-token invalidation currently occurs in the effect cleanup, so the handler and settlement callbacks have no pre-cleanup Cancel check in the inspected implementation ([src/components/timer/DrillTimer.tsx:88-91,114-129](src/components/timer/DrillTimer.tsx#L88)). Existing `DrillRun.stop()` and the Wake Lock controller handle late results once invoked/disposed, but they do not set the React effect's `disposed` flag at click time ([src/lib/drill-run.ts:223-238](src/lib/drill-run.ts#L223), [src/lib/drill-wake-lock.ts:78-99,125-132](src/lib/drill-wake-lock.ts#L78)).
- This is a source-level guard gap, not a reproduced browser failure: the exact scheduling window between the Cancel event and React effect cleanup has not been controlled or observed. The implementation plan should synchronously latch Cancel before notifying the parent, use one idempotent disposal path at that boundary and from unmount, and guard `begin`, run subscription updates/completion, Resume initiation, and Resume settlements. A controlled browser fixture should deliberately keep the timer child mounted after the click, settle queued/late work, and assert that no completed view, new audio scheduling, or post-cancel Wake Lock request appears.

### 10x-ui design-system audit

- `src/styles/global.css` is the existing token source (`:root`, `.dark`, and `@theme inline`); the repository UI rules name the same source, shared component directory, timer contract, development preview, and lint guard ([src/styles/global.css:8-10,67-69,123-142](src/styles/global.css#L8), [AGENTS.md:38-42](AGENTS.md#L38)).
- In the inspected set `{src/pages/index.astro, src/components/timer/DrillApp.tsx, src/components/timer/DrillTimer.tsx, src/components/timer/DrillTimerView.tsx, src/components/timer/TimerUiPreview.tsx}`, the prescribed hard-coded color/palette/arbitrary-dimension scan produced 0 matching lines. The scan expression and use guidance are in the UI skill ([10x-ui/SKILL.md:116-127](D:/Dev/10xDevs4/.agents/skills/10x-ui/SKILL.md#L116)).
- `DrillTimerView.tsx` imports the existing `Alert` and `Button` components (2 direct imports) and uses 7 semantic token classes; `DrillApp.tsx` has 2 such imports and 2 semantic-token class occurrences; `TimerUiPreview.tsx` has 6 shared UI imports and 12 semantic-token class occurrences ([src/components/timer/DrillTimerView.tsx:2-3,26-68](src/components/timer/DrillTimerView.tsx#L2), [src/components/timer/DrillApp.tsx:2-3,81-86](src/components/timer/DrillApp.tsx#L2), [src/components/timer/TimerUiPreview.tsx:2-7,78-81](src/components/timer/TimerUiPreview.tsx#L2)).
- The existing preview is development-only, uses the production timer view, and already has loading, active, paused, pending Resume, error/notice, configuration, and completion fixtures ([src/pages/dev/timer-ui.astro:5-25](src/pages/dev/timer-ui.astro#L5), [src/components/timer/TimerUiPreview.tsx:14-38,94-120,122-191](src/components/timer/TimerUiPreview.tsx#L14)). Reuse it to show Cancel across the requested states and retain the existing seven-state visual gate; `phase: null` remains represented by the completion view.
- Read the coordinator-supplied visual references without modifying them: `C:/Users/Jasiek/Pictures/Screenshots/DrillMe_Pause_button_down.png` shows Pause below repetition; `C:/Users/Jasiek/Pictures/Screenshots/DrillMe_Resume_button_up.png` shows the Resume panel above the timer; `D:/Dev/10xDevs4/context/foundation/resources/start_screen_before_start.PNG` shows the source composition's bottom icon row. Follow the approved Cancel/X-left, empty-middle, Pause/Resume-right layout only. Do not copy its yellow/cyan colors, lock icon, or elapsed/remaining statistics.

## Charges

1. **Cancel is missing across run states** — `src/components/timer/DrillTimerView.tsx:37-69` renders only Pause while active, Resume while paused, a disabled Resume while pending, and a loading status during initialization; users cannot leave an unwanted drill and recover their retained configuration from any of the four states. Address in Phase 1.
2. **Late callbacks can cross the Cancel-to-cleanup boundary** — in `src/components/timer/DrillTimer.tsx:30-36,45-67,88-99,114-129`, effect cleanup owns the `disposed` flag, subscription effects, pending Resume invalidation, and resource disposal; no synchronous cancel-intent guard exists yet. The browser interleaving is unverified. Add the local latch, reuse one idempotent S06 disposal path, guard callbacks, and exercise the click-to-cleanup interval with the held-mounted Phase 1 fixture. ([src/components/timer/DrillApp.tsx:55-57](src/components/timer/DrillApp.tsx#L55))
3. **The primary control jumps between locations** — `src/components/timer/DrillTimerView.tsx:37-49,51-64,65-69` places Resume in a panel above the phase/time but Pause after the repetition; the supplied active and paused screenshots confirm the action moves when state changes, so a user cannot keep the pointer on one target. Put Cancel/X left and Pause/Resume right in the same stable bar below time/count/repetition in Phase 1; verify equal bounds in Phase 2.
4. **Pause/Resume use wide text-only actions** — `src/components/timer/DrillTimerView.tsx:46-48,66-68` puts visible labels in full-width buttons although the existing `Button` and `lucide-react` are available; the large changing target takes over the view and cannot match the requested compact, consistent icon affordance. Use accessible icon-only Pause/Play buttons in the shared fixed right slot in Phase 1; inspect name and focus in Phase 2.
5. **Paused/loading status causes layout shift** — `src/components/timer/DrillTimerView.tsx:37-49,40-45,52-63` conditionally inserts the paused/Resume panel above the timer and adds recovery/loading content as state changes; the user-provided Resume screenshot shows the timer and action region displaced vertically. Reserve an equal-height status region below the control bar and hold the right slot during initialization/resume in Phase 1; assert stable button bounds through ACTIVE→PAUSED→RESUMING in Phase 2.

Charges 1–2 cover behavior/lifecycle; Charges 3–5 cover control placement, affordance, and layout stability. Phase 1 implements all five; Phase 2 verifies charges 3–5 with the state/theme/viewport visual gate and bounding-box assertion. No charge is deferred.

## Code References

- `context/foundation/prd.md:52-53,125-126` — separate configuration/run views, retained values on return, and FR-007's accepted cancellation behavior.
- `context/foundation/roadmap.md:51-53,177-187` — S06 done and S07 outcome, prerequisite, risk and ready status at the starting revision.
- `src/components/timer/DrillApp.tsx:51-78,89-99` — app-owned settings, Start snapshot, view selection and completion handling.
- `src/components/timer/DrillTimer.tsx:30-98,101-130` — initial audio, run and pending Resume lifecycle, UI handlers and effect teardown.
- `src/components/timer/DrillTimerView.tsx:20-69` — initialization, paused/pending Resume and active Pause UI branches.
- `src/lib/drill-run.ts:150-175,223-238` — stale recovery audio handling and the reusable stop operation.
- `src/lib/drill-audio-initializer.ts:3-22` — late initial audio disposal.
- `src/lib/drill-wake-lock-session.ts:14-42` and `src/lib/drill-wake-lock.ts:78-99,125-132` — session disposal and stale Wake Lock grant release.
- `src/lib/drill-resume-pending.ts:7-25` — generation-owned Resume pending state.
- `src/components/timer/TimerUiPreview.tsx:14-38,94-120` — production component fixtures and the empty/completion N/A treatment.

## Architecture Insights

Keep `DrillApp` as the owner of form values and view selection. Add a required cancel callback from `DrillTimerView` through `DrillTimer` to the app; update both callers in Phase 1. Latch Cancel synchronously, reuse the idempotent S06 disposal path, guard initialization/display/completion/Resume work, and return to configuration without changing `values`. Render one bar below time/count/repetition: Cancel/X left, a noninteractive empty center slot reserved for S08 Restart/`RotateCcw`, and Pause/Resume in the exact same right slot. Use the existing shadcn `Button`, `size-12`, existing lucide icons with `aria-hidden`, accessible `aria-label`/`title`, visible focus, and semantic tokens. Keep status in a reserved equal-height region below the bar; do not add a lock control or the reference's extra timer statistics.

The existing design contract is sufficient: semantic colors and Tailwind scales come from `AGENTS.md`/`src/styles/global.css`; shared `Button`, `lucide-react`, and `/dev/timer-ui` already exist. Phase 1 establishes the stable three-column bar and reserves the status region. Phase 2 adds visual fixtures, the seven-state matrix, four theme/viewport combinations, and equal bounding-box assertions. Do not add shared primitives, global styles, libraries, CI work, or a fake S08 action.

## Historical Context (from prior changes)

- **Supported:** the S06 implementation review reports APPROVED with zero findings for its local three-phase implementation ([context/changes/pause-and-resume-drill/reviews/impl-review.md:4-10,23-33](context/changes/pause-and-resume-drill/reviews/impl-review.md#L4)). The reviewed cleanup and generation protections are present at this S07 base in the cited source files.
- **Current coordinator status supersedes the old handoff checkpoint:** the user reports PR #30 merged after full APPROVED review and green CI on final head `033001d`; merge commit and this S07 base are `4160aca007fc38da6cf567a9b443a5f70806dadc`. The checked-in S06 handoff's earlier “no PR/merge” text was accurate at its checkpoint but is stale now. S06's post-Phase-3 race fixes and test/preview evidence remain relevant ([context/changes/pause-and-resume-drill/handoff.md:49-56](context/changes/pause-and-resume-drill/handoff.md#L49)).
- **Still valid:** S06 says physical-device Wake Lock behavior was not checked ([context/changes/pause-and-resume-drill/handoff.md:12,20](context/changes/pause-and-resume-drill/handoff.md#L12)). S07 can verify disposal using controlled browser fakes; it should not claim a physical-device check.
- **Separate scope:** S06 explicitly excluded cancellation and whole-drill restart; the current request opens S07 after the merge. S08 remains its own roadmap slice ([context/changes/pause-and-resume-drill/change.md:9](context/changes/pause-and-resume-drill/change.md#L9), [context/foundation/roadmap.md:177-199](context/foundation/roadmap.md#L177)).

## Related Research

- `context/changes/pause-and-resume-drill/research.md` — S06 recovery, UI and resource research.
- `context/changes/pause-and-resume-drill/reviews/impl-review.md` — S06 implementation review.

## Open Questions

No product decision remains open: the desired return view, retained settings, four cancellation states, scope exclusions, and coordination boundaries are specified by FR-007 and the current coordinator task. The exact browser ordering between Cancel and effect cleanup is an implementation verification uncertainty, not a product question; Phase 1 must settle it with the controlled held-mounted gate before the change is accepted.
