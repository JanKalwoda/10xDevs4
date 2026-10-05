# Restart the Whole Drill — Plan Brief

> Full plan: `context/changes/restart-whole-drill/plan.md`
> Research: `context/changes/restart-whole-drill/research.md`

## What & Why

Add an unconfirmed Restart action to the existing `/` timer. Restart should start the complete current drill from its configured first phase, preserve the saved form values and take a fresh random wait when random start is enabled. The timer must keep the S-07 Cancel/Pause/Resume behavior while ensuring delayed work from an old run cannot affect the new one.

## Starting Point

`DrillApp` owns the saved settings and creates initial audio/Wake Lock resources from Start; `DrillTimer` owns the current run and its idempotent teardown. The control bar below time/count/repetition already has a reserved middle slot between the 48 px Cancel and Pause/Resume buttons. It has no run key or identity-guarded parent completion yet.

## Desired End State

Restart uses the existing middle slot and shared Button, leaves the other controls in place and is available during initialization, active work, pause and Resume recovery. Each accepted restart synchronously retires the old owner and starts a fresh keyed run, configuration snapshot, audio resource and Wake Lock session from `firstDrillPhase`.

## Key Decisions Made

| Decision                 | Choice                                                                                                        | Why                                                                                                  | Source                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| Restart behavior         | Start from the configured first phase without confirmation                                                    | Existing `firstDrillPhase` already expresses positive and zero-preparation behavior                  | Research                         |
| Settings and random wait | Reuse the current configuration snapshot; create a fresh run and random sample                                | Form state is parent-owned; sample and hidden progress are run-owned                                 | Research                         |
| Run ownership            | Synchronous intent boundary, existing idempotent disposal, fresh run identity/key and parent completion guard | Prop changes alone retain the mounted timer's refs/state, and stop does not clear all per-run fields | Research                         |
| Restart resources        | Create fresh audio and Wake Lock resources from the Restart gesture                                           | Matches the existing Start path and browser gesture requirements                                     | Coordinator brief / Research     |
| Control bar              | Cancel left, Restart middle, Pause/Resume right, each 48 px; preserve semantic tokens and shared Button       | Fills the existing slot and preserves S-07 controls                                                  | Coordinator brief / Research     |
| UI contract              | No new colors, primitives, dependencies or CI changes                                                         | Existing token source, Button and lint rule cover the view                                           | Research                         |
| Completed view           | Leave the current Completed → Return to configuration flow unchanged                                          | Restart is specified in the mounted timer bar                                                        | Coordinator confirmed 2026-10-05 |

## Scope

**In scope:** `DrillApp`, `DrillTimer`, `DrillTimerView`, focused timer unit tests, `/dev/timer-ui` lifecycle fixtures, timer-specific `AGENTS.md` guidance and S-08 screenshots.

**Out of scope:** auth, data storage, global CSS/tokens, shared UI primitives, new dependencies/test runners, CI/infrastructure changes, S-07 documents/status, roadmap edits during planning, and Restart on the Completed view.

## Architecture / Approach

The parent creates a fresh identity and gesture-owned resources for each accepted restart. The old timer synchronously stops accepting work and reuses its existing disposer; a fresh keyed child initializes its own state and `DrillRun`. Completion, visibility, timer-wake and async resource results remain scoped to the owning run. The Restart action occupies the existing center button slot.

## Phases at a Glance

| Phase                                                     | What it delivers                                                                          | Key risk                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Restart Control and Fresh Run Ownership                | Production Restart action, fresh run identity/resources, deterministic phase/random tests | Stale callbacks or retained component state can supersede the new run                            |
| 2. Held-Mounted Lifecycle Regressions and Visual Contract | Production-backed race fixture, lifecycle tests, AGENTS rule and complete screenshot gate | A stale-wake check can pass without firing an old callback unless its preconditions are asserted |

**Prerequisites:** Coordinator deep plan review; before implementation, synchronize with main `45951a61e599215684e28d403665ce9824db8daa` after PR #34.
**Estimated effort:** Two independently gated implementation phases, each with its own code/test commit.

## Open Risks & Assumptions

- The requested timer-bar placement implies Restart is limited to a mounted run and the Completed view stays unchanged. Confirmed by the coordinator on 2026-10-05.
- Use the production-used drill-run-identity helper and Node test for parent completion ownership, plus the held-mounted real DrillTimer fixture with per-run bundles, exact captured wake and controlled visibility. No new dependency. Phase 1 updates every required callback caller and independently syncs/checks/builds; PR CI is a coordinator gate after the Phase 2 commit.
- This planning worktree and both read-only research worktrees were created from `34e8b7d1b942dbb40185727a17e4ee534be3c396`; implementation must synchronize with the coordinator-reported PR #34 main SHA before its first code change.

## Success Criteria (Summary)

- Restart always starts a fresh configured run, preserves settings and does not inherit any old progress, pause/recovery, sampled wait or async resource result.
- Cancel, Pause and Resume retain their fixed positions, names, hitboxes and pending guards; stale completion/wake callbacks cannot affect a replacement.
- Focused tests, all existing project/CI gates, production interactions and the seven-state light/dark 1280/390 screenshot gate pass.
