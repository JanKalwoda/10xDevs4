---
change_id: cancel-current-drill
title: Cancel the current drill
status: implementing
created: 2026-10-04
updated: 2026-10-05
archived_at: null
---

## Notes

Target one rendered view: the guest drill timer at `/`, built with semantic tokens from `src/styles/global.css` and shared controls from `src/components/ui`. The deterministic visual preview is `/dev/timer-ui`. S07 cancellation returns an active drill to the configuration form with settings preserved, stops run resources, audio and Wake Lock, and rejects late results. Account for initialization, active, paused and pending Resume states, including the gap between the Cancel click and deferred React effect cleanup. Reuse S06 `run.stop()`, wake session disposal and React teardown behind a synchronous cancel-intent guard and one idempotent disposal path; do not implement S08 restart. Phase 1 must update both `DrillTimerView` callers and independently pass Astro check/build; its controlled held-mounted race gate is reviewed before implementation. Keep implementation within timer files and the timer development preview; coordinate before touching auth, shared CSS/layout/primitives or dependencies. S09 owns auth, index shell, CI, smoke checks and Wrangler; the timer owns timer files and its preview. Coordinate dev ports: timer 4322, auth 4321/4323, S09 isolated API 55421/Mailpit 55424; preserve the existing 55321 Supabase instance.
