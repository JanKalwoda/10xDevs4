# S07 Coordinator Handoff — Cancel the current drill

## Checkpoint

**Checkpoint: READY — planning complete; next: `/10x-plan-review cancel-current-drill`. Stop before implementation.**

- Worktree: `D:/Dev/10xDevs4-cancel-current-drill`
- Branch: `feature/cancel-current-drill`
- Base / HEAD: `4160aca007fc38da6cf567a9b443a5f70806dadc` (`origin/main` at S06 merge)
- Change: `context/changes/cancel-current-drill/`
- Plan status: ready for separate plan review; implementation has not started.
- No tests/builds were run in this planning checkpoint. No production code was changed. No push, PR, or merge was performed. S08 was not started. Root worktree `D:/Dev/10xDevs4` was not modified.

## Scope and Decisions

- Deliver S07 / FR-007: Cancel from initialization, active running, paused, and pending Resume returns to configuration with settings retained.
- Cancel is direct with no confirmation prompt, matching the settled FR-007 decision.
- The inspected S06 effect cleanup is reusable but is not by itself a synchronous click boundary: its `disposed` flag, pending Resume invalidation, `run.stop()`, and Wake Lock disposal run when effect cleanup executes. The run subscription and Resume path also lack pre-cleanup guards in the inspected base. The exact browser scheduling window is not yet reproduced.
- Plan requires a local synchronous cancel-intent latch before the parent callback; one idempotent disposal path is shared by Cancel and effect teardown. Guard initial audio `onReady`, display/completion subscription work, Resume initiation, and Resume settlement. Existing `run.stop()`, audio observer disposal, Wake Lock session disposal, and React teardown are reused; do not add a generic cancellation subsystem.
- Cancel cannot display Completed, start/schedule new audio, or make a new Wake Lock request after the click. Deferred audio is closed; a late Wake Lock grant is released.
- `DrillTimerView.onCancel` is required, not optional. Its two callers (`DrillTimer` and `TimerUiPreview`) both update in Phase 1. That phase independently passes `npx astro check` and `npm run build`; no optional prop or production no-op fallback is allowed to bypass type checking.
- Phase 1 contains the behavior, all caller updates, focused stop regression, and a controlled dev-only held-mounted race gate. The fixture holds the child mounted after Cancel, settles late initial audio, queued display/completion work, pending Resume, and a pending Wake Lock grant, then allows teardown and checks idempotence. It reuses the existing S06 browser fake/Playwright approach with no new dependency.
- Phase 2 contains broader visual fixtures, the timer-specific rule in `AGENTS.md`, screenshots, and the final visual/browser gate. Both phases are separate, buildable, testable, and committable.
- No unresolved product questions. Plan review should specifically challenge race-fixture feasibility/coverage and whether the local guards plus S06 disposal are sufficient without creating a subsystem.

## Files and Artifacts

- `change.md` — change identity and scope.
- `research.md` — source-backed lifecycle and design audit, including five charges and the unverified click-to-cleanup window.
- `plan.md` — two implementation phases and canonical Progress checks.
- `plan-brief.md` — decisions, phase boundaries, and review risks.
- `handoff.md` — this checkpoint.

## Coordination Boundaries

- Timer S07 owns timer files and the timer preview. Do not edit auth, index shell, shared CSS/layout/primitives, dependencies, CI/smoke, or Wrangler without coordination.
- S09 owns auth, index shell, CI, smoke, and Wrangler. Coordinator status (root): `feature/enter-account-by-email-link` incorporated `origin/main` at S06 merge `4160aca` into its own branch; S09 has not merged into `main`, which remains at `4160aca`. Draft PR #31 has CI and smoke passing on `7ae916f`; local integrated gates are running, while hosted configuration and manual production checks remain pending.
- Timer development port: `4322`; auth ports: `4321` and `4323`.
- S09 isolated Supabase API: `55421`; Mailpit: `55424`. Preserve the existing Supabase instance at `55321`.
- S06 PR #30 was merged after full APPROVED review and green CI on final head `033001d`; merge commit is `4160aca007fc38da6cf567a9b443a5f70806dadc`. The earlier S06 handoff checkpoint text predates this merge.

## Next

Run `/10x-plan-review cancel-current-drill` in a separate clean thread before implementation. Expect it to challenge the held-mounted controlled race gate, callback coverage, phase independence (especially required preview caller + Astro/build checks in Phase 1), disposal idempotence, and S09 ownership boundaries. Do not start implementation or S08 until plan review is handled in its own thread.
