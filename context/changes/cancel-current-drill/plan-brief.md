# Cancel the current drill — Plan Brief

> Full plan: `context/changes/cancel-current-drill/plan.md`
> Research: `context/changes/cancel-current-drill/research.md`

## What & Why

Let users abandon a drill and return to configuration with entered values retained. Cancel must stop current work at the click boundary so delayed initialization, display/completion callbacks, or Resume cannot revive the run.

## Starting Point

`DrillApp` owns form values. `DrillTimer` owns run/audio/Wake Lock lifecycle. S06 cleanup and stale-resource protections are reusable, but the inspected `disposed` flag, listener/interval cleanup, pending Resume invalidation, `run.stop()`, and Wake Lock disposal happen in effect cleanup. The subscription callback and Resume handler have no synchronous Cancel-intent guard. This ordering gap is source-level and has not yet been reproduced in a browser.

`DrillTimerView` has two callers: production `DrillTimer` and `TimerUiPreview`. Its new callback must be required, with both callers updated in Phase 1. The preview is also the location for a development-only fixture that deliberately holds the timer child mounted after Cancel.

## Desired End State

Cancel remains enabled in initialization, active, paused, and pending Resume. Its handler synchronously latches intent and runs the same idempotent S06 disposal path used by unmount before notifying the parent. No late callback can update display, show Completed, start new audio, or request Wake Lock. The parent returns to configuration and clears `activeRun` without changing form values.

## Key Decisions

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Cancel behavior | Return directly; no confirmation | FR-007 is settled and the recorded accidental-cancel concern was left unchanged | PRD / coordinator task |
| Cancel ordering | Synchronous local latch plus reused idempotent cleanup before parent callback | Effect cleanup timing alone does not guarantee the click-to-cleanup boundary | Research: `DrillTimer.tsx:30-67,88-129` |
| State coverage | Keep Cancel available during initialization, active, paused, and pending Resume | All four states currently lack an independent exit action | Research / S07 |
| Ownership | Parent switches view and clears active run; timer owns one shared dispose path | Reuses S06 and avoids duplicate resource ownership | Research / S06 source |
| Settings | Keep app-owned `values` untouched | The run receives a separate configuration snapshot | `DrillApp.tsx:51-78` |
| Component contract | `onCancel` is required; update production and preview callers in Phase 1 | Phase 1 must independently pass Astro check/build without optional or no-op production fallbacks | `DrillTimerView.tsx`, both caller paths |
| Race verification | Hold the timer child mounted after Cancel and settle deferred resources/callbacks before teardown | Makes the click-to-cleanup interval deterministic and inspectable | S06 browser fake approach; detailed gate in plan |
| Design system | Reuse semantic tokens, shared Button, lint rule, and `/dev/timer-ui` | Existing audit found no reason to add a token, primitive, or dependency | Research / `AGENTS.md` |
| Phase structure | Phase 1 behavior, required caller updates, race gate, and independent checks; Phase 2 broader visual fixtures, agent rule, and screenshots | Each phase remains separately buildable, testable, and committable | Plan |

## Scope

**In scope:** one rendered view at `/`; Cancel callback/control; preserved form state; synchronous cancellation latch; reuse of run/audio/Wake Lock disposal; required callback updates at both call sites; stop regression; controlled held-mounted browser gate; wider timer preview, agent rule, and visual checks.

**Out of scope:** S08 restart, authentication, saved configurations, shared CSS/layout/primitives, dependencies, package changes, CI/smoke/Wrangler edits, and physical-device Wake Lock claims.

## Phases at a Glance

| Phase | What it delivers | Independent gate |
| --- | --- | --- |
| 1. Cancel boundary, caller contract, and lifecycle gate | Production Cancel, required prop wired to both callers, controlled race gate | Tests/lint plus Astro sync/check and build |
| 2. Visual fixtures, durable rule, and final UI gate | Broader preview, timer guidance, screenshots and final verification | Tests/lint plus Astro sync/check and build |

**Prerequisites:** S06 is merged in `origin/main` at `4160aca`; separate plan review before implementation. S09 remains an independent stream.
**Estimated effort:** Two implementation checkpoints, then the separate plan review and coordinator PR/CI gate.

## Open Risks & Assumptions

- The source shows missing pre-cleanup guards, but actual event scheduling in the window is unverified. Phase 1's deliberately held-mounted browser gate must force deferred results/callbacks and establish the guarantee.
- The separate plan review should inspect whether the controlled fixture can exercise late `onReady`, display/completion, Resume, and Wake Lock outcomes without a dependency or generic cancellation subsystem.
- Physical-device Wake Lock is not part of this slice; cancellation disposal is checked with controlled browser fakes.
- S09 owns auth/index-shell/CI/smoke/Wrangler. Timer files and timer preview belong to S07; coordinate the ports and isolated Supabase instance in handoff.

## Success Criteria (Summary)

- Cancel returns from all four requested states with values preserved and no false completion or late restart.
- Cancel intent is latched and S06 resources are disposed before deferred effect cleanup; no post-click audio or Wake Lock start can occur.
- Phase 1 updates both `DrillTimerView` callers and independently passes Astro check/build.
- Phase 1's controlled held-mounted gate covers deferred initial audio, display/completion, Resume, and Wake Lock outcomes.
- Phase 2 visual gate passes in light/dark at desktop/mobile widths with reviewed screenshots and no hard-coded-value scan hits.
