<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Pause and safely resume a drill

- **Plan**: context/changes/pause-and-resume-drill/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings (both fixed), 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

5/5 existing paths ✓ (2 new paths explicitly marked), 5/5 symbols ✓, brief↔plan ✓. Wake Lock visibility and release behavior cross-checked against the [W3C Screen Wake Lock API draft](https://www.w3.org/TR/screen-wake-lock/).

## Findings

### F1 — CI validation omits Astro and lint-rule gates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1–3 — Automated Verification
- **Detail**: The plan's phase gates list npm run test and npm run lint in Phases 1–2, then add npm run build in Phase 3 (plan.md:69-73, 108-113, 150-156). CI also runs npx astro sync, node --test scripts/eslint-rules/timer-ui-contract.test.mjs, and npx astro check (.github/workflows/ci.yml:19-24). npm run lint is only eslint ., and npm test only runs src/lib/*.test.ts (package.json:5-14), so neither substitutes for the standalone rule tests or Astro check. The separate smoke job also builds, starts a production preview against local Supabase, runs npm run smoke, and checks that /dev/timer-ui is absent from production (.github/workflows/ci.yml:26-55); the plan's manual preview checklist does not name that CI gate. Without an Astro check in each phase, the separate commits do not verify that the changed phase compiles before the next phase starts.
- **Fixed**: Added astro sync, the timer UI rule test, and astro check to each phase's automated gates; the final gate now names required pull-request CI including production-preview smoke.
- **Decision**: FIXED (coordinator accepted)

### F2 — Resume pending state can outlive a hidden-page invalidation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Timer view and handlers
- **Detail**: DrillRun.hide() invalidates the recovery generation and clears its private recovering flag, but returns immediately when the run is already paused (src/lib/drill-run.ts:127-130). A pending resumeWithAudio() result is then closed when it eventually resolves as stale (src/lib/drill-run.ts:151-163). Phase 2 requires a pending status and disabled Resume control, but does not specify how the view clears/reconciles that pending state when visibility hides and invalidates the attempt. If the view tracks pending locally, it can keep Resume disabled after the page becomes visible again until the old promise settles; DrillTimer currently discards the promise from its Resume callback (src/components/timer/DrillTimer.tsx:78-85). The current audio creator has a 1.5-second timeout (src/lib/drill-audio.ts:58-80), which bounds the delay but does not define the UI transition.
- **Fixed**: Added a generation-owned pending-state helper and regression for hide during pending → visible → new Resume → old result first. Hidden invalidation clears pending immediately, and an old finally cannot clear the newer attempt.
- **Decision**: FIXED (coordinator accepted)
