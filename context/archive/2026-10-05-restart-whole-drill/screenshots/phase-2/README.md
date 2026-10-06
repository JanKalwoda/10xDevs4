# Phase 2 visual gate — `/dev/timer-ui`

Screenshots were captured by a Playwright script (headless Chromium, dev server on port 4322), **not by a human**. They are named `<state>-<1280|390>-<light|dark>.png`.

| State | Fixture | Notes |
| --- | --- | --- |
| default | `timer-default-state` (production configuration form) | |
| hover | `timer-exercise-fixture`, pointer over Restart | |
| focus-visible | `timer-exercise-fixture`, Tab from Cancel lands on Restart (`:focus-visible` asserted) | |
| disabled | `timer-recovery-pending-fixture` | Pause/Resume slot shows the disabled "Resume is loading" control; Restart and Cancel stay enabled (asserted). |
| error | `timer-error-state` after pressing Start with empty fields | Real validation errors. |
| empty-na | `timer-empty-state` | **N/A**: the running timer never renders a phase-less empty view; `phase: null` is routed to the Completed view, which is shown here. |
| loading | `timer-loading-fixture` | "Starting timer…" with disabled Pause/Resume slot and enabled Restart. |
| lifecycle-restart | `held-mounted-restart-fixture` | Run 1 paused → Restart → run 2 initializing; per-run counters visible. |

Control bar geometry (asserted at both viewports, both themes): Cancel / Restart / Pause-Resume are 48×48 px at fixed x positions (1280 px: 868 / 997 / 1127 in the exercise fixture; 390 px: 41 / 171 / 301) and do not move between the exercise, paused, loading and recovery-pending fixtures.

The Astro dev toolbar visible in some captures is a dev-server overlay, not part of the UI.
