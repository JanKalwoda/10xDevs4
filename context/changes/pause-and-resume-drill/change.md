---
change_id: pause-and-resume-drill
title: Pause and safely resume a drill
status: impl_reviewed
created: 2026-10-03
updated: 2026-10-04
archived_at: null
---

## Notes

Extend the existing `/` timer view in `src/components/timer/DrillTimerView.tsx` using the current design tokens in `src/styles/global.css`. For FR-006, expose manual pause and resume through the existing `DrillRun` pause/recovery mechanism, resuming the correct phase or repetition and preserving recovery when the page is hidden. Keep the screen awake during an active run when the browser/device supports Wake Lock, and manually pause when the page becomes hidden. Make loading/display and control states share an explicit contract. Protect asynchronous initialization and resume recovery from stale results; invalidation must not emit `phase: null` as false completion. Create Web Audio directly in a user gesture. S-07 cancellation and S-08 whole-drill restart are out of scope. Do not edit `global.css`, `Layout.astro`, shared UI, or package/lock files without reporting first. Device wake behavior must be reported with its real platform limitations; do not claim unperformed physical-device checks.
