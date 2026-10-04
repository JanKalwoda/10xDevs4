# S07 Coordinator Handoff — Cancel the current drill

## Checkpoint

**Checkpoint: READY — plan_reviewed; F1 fixed; next: Phase 1 in a fresh thread. Stop this coordinator thread before implementation.**

- Worktree: `D:/Dev/10xDevs4-cancel-current-drill`
- Branch: `feature/cancel-current-drill`
- Base / merged main: `47252992f1e15c8426a4200a40b85f3173bf48f2` (S09 complete, deployed, and manually verified); merge into this feature: `55246c0`
- Change: `context/changes/cancel-current-drill/`
- Plan status: `plan_reviewed`; F1 triaged as fixed; implementation has not started.
- No tests/builds were run in this planning checkpoint. No production code was changed. No push, PR, or merge was performed. S08 was not started. Root worktree `D:/Dev/10xDevs4` was not modified.

## Scope and Decisions

- Deliver S07 / FR-007: Cancel from initialization, active running, paused, and pending Resume returns to configuration with settings retained.
- Cancel is direct with no confirmation prompt, matching the settled FR-007 decision.
- The inspected S06 effect cleanup is reusable but is not by itself a synchronous click boundary: its `disposed` flag, pending Resume invalidation, `run.stop()`, and Wake Lock disposal run when effect cleanup executes. The run subscription and Resume path also lack pre-cleanup guards in the inspected base. The exact browser scheduling window is not yet reproduced.
- Plan requires a local synchronous cancel-intent latch before the parent callback; one idempotent disposal path is shared by Cancel and effect teardown. Guard initial audio `onReady`, display/completion subscription work, Resume initiation, and Resume settlement. Existing `run.stop()`, audio observer disposal, Wake Lock session disposal, and React teardown are reused; do not add a generic cancellation subsystem.
- Cancel cannot display Completed, start/schedule new audio, or make a new Wake Lock request after the click. Deferred audio is closed; a late Wake Lock grant is released.
- `DrillTimerView.onCancel` is required, not optional. Its two callers (`DrillTimer` and `TimerUiPreview`) both update in Phase 1. That phase independently passes `npx astro check` and `npm run build`; no optional prop or production no-op fallback is allowed to bypass type checking.
- Phase 1 contains the behavior, both required caller updates, stop regression, approved real-DrillTimer held-mounted fixture, and fixed icon control bar. The fixture uses the existing audio Promise, optional clock/Resume-audio seams with production defaults, real WakeLockSession/controller over a fake provider, deferred Resume factory, explicit unmount, and four initial-audio/active stale-wake/paused/pending-Resume scenarios. Cancel/X is left, the empty middle slot is reserved for future S08 Restart, and Pause/Resume share the right size-12 hitbox; status stays in a reserved region below the bar.
- Phase 2 contains broader visual fixtures, the timer rule in `AGENTS.md`, the seven-state light/dark 1280/390 screenshot matrix, and a same-instance browser bounding-box assertion for Pause/Resume/pending Resume across ACTIVE→PAUSED→RESUMING in all four viewport/theme combinations, with the pointer held over the target. Both phases remain separately buildable, testable, and committable.
- No unresolved product questions. F1 is fixed via the approved coordinator harness and grounded source seams. The final control order is Cancel/X left, empty middle, Pause/Resume right; S08 alone may add Restart/RotateCcw to the center. The screenshots are read-only references.

## Files and Artifacts

- `change.md` — change identity and scope.
- `research.md` — source-backed lifecycle and design audit, including five charges and the unverified click-to-cleanup window.
- `plan.md` — two implementation phases and canonical Progress checks.
- `plan-brief.md` — decisions, phase boundaries, and review risks.
- `handoff.md` — this checkpoint.

## Coordination Boundaries

- Timer S07 owns timer files and the timer preview. Do not edit auth, index shell, shared CSS/layout/primitives, dependencies, CI/smoke, or Wrangler without coordination.
- S09 owns auth, index shell, CI, smoke, and Wrangler and is complete, deployed, and manually verified. `main`/`origin/main` is `4725299`; its merge into this feature branch preserves S07 phase history. Earlier checkpoint notes about S09 deferral are historical.
- Timer development port: `4322`; auth ports: `4321` and `4323`.
- S09 isolated Supabase API: `55421`; Mailpit: `55424`. Preserve the existing Supabase instance at `55321`.
- S06 PR #30 was merged after full APPROVED review and green CI on final head `033001d`; merge commit is `4160aca007fc38da6cf567a9b443a5f70806dadc`. The earlier S06 handoff checkpoint text predates this merge.

## Next

Start Phase 1 in a fresh implementation thread using `plan.md`, this brief, and the fixed F1 report. Preserve the approved race scenarios and UI slot contract; keep all Progress titles unchanged and checkboxes pending. Stop here for coordinator-owned compact/clear.
