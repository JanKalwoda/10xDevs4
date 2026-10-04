# Pause and safely resume a drill — Plan Brief

> Full plan: context/changes/pause-and-resume-drill/plan.md
> Research: context/changes/pause-and-resume-drill/research.md

## What & Why

Add manual Pause/Resume to the guest drill timer and preserve the current safe recovery behavior when users leave the page. Try to keep the screen awake when supported; explain a limitation without blocking the timer.

## Starting Point

The timer already implements and tests FR-006 phase recovery and stale audio protection. Its visible view has Resume for a hidden-page pause, but no manual Pause, pending recovery feedback, or Wake Lock notice. Existing tokens, shared controls, lint rule, and deterministic preview cover the needed UI contract.

## Desired End State

Users can pause and explicitly resume. A visible page return never restarts the timer. Wake Lock is attempted on visible Start or explicit visible Resume, released when the run pauses or ends, and best-effort when the browser refuses it.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Complexity and phases | MEDIUM; three sequential phases, each tested and separately committed | Keeps lifecycle, controls, and integration reviewable | Coordinator |
| Pause behavior | Reuse DrillRun.hide()/resumeWithAudio() and FR-006 recovery rules | Existing run logic already preserves phase/repetition semantics | PRD / Research |
| Wake Lock | Best-effort, calm English notice, no visibility auto-retry | Lock support must not gate the guest timer | Coordinator |
| Wake Lock controller | Typed idle/requesting/held/unavailable status, request/release, subscriptions, and generation-safe late-grant handling | Makes ownership and races explicit while keeping provider injectable | Plan review |
| UI | Existing tokens, Button, Alert, and /dev/timer-ui | Reuse the current design system and preview | Repository rules |
| Scope | S06 only; no cancel/restart or new dependencies | Keep this change bounded | Coordinator |

## Scope

**In scope:** Wake Lock lifecycle/tests, pause recovery regression tests, Pause/Resume controls, loading/disabled/notice states, run integration, final visual gate.

**Out of scope:** S07 cancel, S08 restart, auth/persistence, migrations, redesign, global CSS or shared UI edits, dependencies, unverified device claims.

## Architecture / Approach

Keep DrillRun authoritative for phase timing. Add a small injectable Wake Lock controller, expose controls and states in the existing timer view, and guard asynchronous Resume pending state with an attempt generation invalidated on hidden visibility. Then connect the real run lifecycle. Reuse the deterministic development preview.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Pause and Wake Lock lifecycle primitives | Tested lock boundary and pause invariants | Late async results must be released/ignored |
| 2. Pause controls and view states | Accessible controls, recovery feedback, fixtures | Pending state must be clear |
| 3. Run integration and final gates | Lifecycle wiring, checks, screenshots | Visibility must never auto-resume |

**Prerequisites:** Plan review and acceptance; existing feature branch.
**Estimated effort:** Three implementation/checkpoint sessions plus final review; no dependency installation.

## Open Risks & Assumptions

Wake Lock varies by browser/device and has not been physically verified. The build uses the repository's configured environment.

## Success Criteria (Summary)

- FR-006 recovery is preserved and pause is never treated as completion.
- Wake Lock denial leaves the timer usable with a calm English notice.
- Each phase passes its own checks and has its own commit; final states are reviewed in both themes at desktop and mobile widths.
