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
| Race verification | Hold the real `DrillTimer` mounted after Cancel; control audio Promise, fake clock, deferred Resume audio, and real WakeLockSession/controller over a fake provider | Explicit initial-audio, stale active wake, paused, and pending-Resume cases; separate unmount verifies idempotence | Approved F1 harness; listeners are synchronous |
| Control bar | One stable three-column bar below time/count/repetition: Cancel/X left, empty middle, Pause/Resume right in the exact same `size-12` hitbox | Keeps the primary action under the pointer across ACTIVE→PAUSED→RESUMING; center is layout space for future S08 Restart | User screenshots and coordinator final guidance |
| Icon and status contract | Use shared Button, lucide icons, `aria-hidden`, accessible `aria-label`/`title`, visible focus, and semantic tokens; reserve initialization/resume slot and equal-height status below the bar | Preserves accessible actions without vertical layout shifts | Existing timer UI contract plus screenshot audit |
| Design system | Reuse semantic tokens, shared Button, lint rule, and `/dev/timer-ui` | Existing audit found no reason to add a token, primitive, or dependency | Research / `AGENTS.md` |
| Phase structure | Phase 1 behavior, required caller updates, race gate, and independent checks; Phase 2 broader visual fixtures, agent rule, and screenshots | Each phase remains separately buildable, testable, and committable | Plan |

## Scope

**In scope:** one rendered view at `/`; Cancel callback/control; preserved form state; synchronous cancellation latch; reused run/audio/Wake Lock disposal; required callbacks at both call sites; stable icon control bar; stop regression; controlled held-mounted gate; wider timer preview, agent rule, and visual checks.

**Out of scope:** S08 restart, authentication, saved configurations, shared CSS/layout/primitives, dependencies, package changes, CI/smoke/Wrangler edits, and physical-device Wake Lock claims.

## Phases at a Glance

| Phase | What it delivers | Independent gate |
| --- | --- | --- |
| 1. Cancel boundary, caller contract, and lifecycle gate | Production Cancel, required prop wired to both callers, stable icon control bar, controlled race gate | Tests/lint plus Astro sync/check and build |
| 2. Visual fixtures, durable rule, and final UI gate | Broader preview, timer guidance, state/theme/viewport screenshots, and same-instance right-slot bounding-box assertion in all four light/dark × 1280/390 combinations | Tests/lint plus Astro sync/check and build |

**Prerequisites:** S06 is in `origin/main` at `4160aca`; S09 is complete, deployed, and manually verified in `main`/`origin/main` at `4725299`, merged into this feature branch before S07 implementation.
**Estimated effort:** Two implementation checkpoints, then the coordinator PR/CI gate.

## Open Risks & Assumptions

- The source shows missing pre-cleanup guards, but actual browser scheduling in the window remains unverified until the Phase 1 held-mounted gate runs.
- F1 is fixed in the plan with the approved deterministic real-DrillTimer harness. User screenshots also ground three UI charges: jumping action location, text-only controls, and paused/loading layout shift; Phase 1 implements the bar/status contract and Phase 2 verifies it visually and by bounding boxes.
- Physical-device Wake Lock is not part of this slice; cancellation disposal is checked with controlled browser fakes.
- S09 owns auth/index-shell/CI/smoke/Wrangler and is complete, deployed, and manually verified; main/origin/main is 4725299 and merged into this feature branch. Earlier checkpoint notes about S09 deferral are historical. Timer owns its files and preview; preserve the existing Supabase stack at 55321.

## Success Criteria (Summary)

- Cancel returns from all four requested states with values preserved and no false completion or late restart.
- Cancel intent is latched and S06 resources are disposed before deferred effect cleanup; no post-click audio or Wake Lock start can occur.
- Phase 1 updates both `DrillTimerView` callers, passes Astro check/build, and uses the stable Cancel/X-left, empty-middle, Pause/Resume-right icon bar.
- Phase 1's held-mounted gate covers deferred initial audio/grant, retained stale active clock wake, paused Cancel, pending Resume, and late resources; the fixture checks the production timer display and resource counters before separate unmount.
- Phase 2 verifies the unchanged right-slot bounding box across ACTIVE→PAUSED→RESUMING at 1280/390 in light/dark and completes the seven-state visual gate.
- Phase 2 visual gate passes in light/dark at desktop/mobile widths with reviewed screenshots and no hard-coded-value scan hits.
