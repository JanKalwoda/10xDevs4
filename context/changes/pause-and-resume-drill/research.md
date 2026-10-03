---
topic: Pause and safely resume a drill
researcher: timer-controls
date: 2026-10-03
complexity: MEDIUM
---

# Research: Pause and safely resume a drill

## Findings

- PRD FR-006 defines the recovery contract: hidden pages require explicit resume; Standby/Exercise restart the same repetition after full Preparation; Preparation/Rest continue their remaining time without replaying the phase cue. Source: context/foundation/prd.md:123-124.
- DrillRun.hide() and resumeWithAudio() already implement pause, phase recovery, and stale audio-result protection. Keep phase: null reserved for completion. Sources: src/lib/drill-run.ts:127-197; src/components/timer/DrillTimer.tsx:34-55.
- The view has no manual Pause, recovery-pending state, or Wake Lock notice. The app already uses shared Button/Alert components, semantic theme tokens, and a deterministic development preview. Sources: src/components/timer/DrillTimerView.tsx:6-50; src/components/ui/button.tsx; src/components/ui/alert.tsx; src/styles/global.css; src/pages/dev/timer-ui.astro; src/components/timer/TimerUiPreview.tsx.
- The coordinator approved MEDIUM complexity, best-effort Wake Lock with a calm English notice, release on pause/hidden/completion/unmount, and retry only on visible Start or explicit visible Resume. Never auto-resume or auto-retry on visibility return. Question budget 1/1 is used; no product decision remains open.

## 10x-ui charges

1. **Missing Pause control —** src/components/timer/DrillTimerView.tsx:37-50 renders no control during an active run. Users cannot intentionally pause a drill. Address in Phase 2.
2. **Misleading paused copy —** src/components/timer/DrillTimerView.tsx:29-35 always says the page was hidden. Users who manually paused would get the wrong explanation. Replace with neutral copy in Phase 2.
3. **Missing recovery/lock feedback —** src/components/timer/DrillTimerView.tsx:6-10 exposes no recovery state, and :24-27 reports only audio availability. Users cannot tell Resume is working or that the screen may lock. Add pending/disabled and calm notice states in Phase 2.

Existing semantic tokens, Button, Alert, timer lint rule, and /dev/timer-ui are sufficient. The prior five-file scan recorded in handoff found no hardcoded colors or arbitrary dimensions. The guest route / is intentional and needs no authenticated or saved data; there is no architecture charge. No charge is deferred.

## Verification limits

Planning only: no code, tests, lint/build, preview, screenshots, or device checks were performed. Wake Lock support varies by browser/device; do not claim physical-device verification.
