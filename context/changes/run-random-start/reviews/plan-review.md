<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run Random Start

- **Plan**: `context/changes/run-random-start/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-25
- **Verdict**: SOUND after fixes (initial verdict: REVISE)
- **Findings**: 2 critical, 1 warning, 0 observations; F1–F3 FIXED

## Verdicts

| Dimension | Verdict after fixes |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 existing paths verified, 3/3 symbols verified, brief and plan consistent. The plan has one canonical `## Progress` section with three phases and 14 success criteria mapped one-to-one to unchecked rows. New audio/run files are planned additions. The existing S-01 timer reads `durationSeconds` for every phase (`src/components/timer/DrillTimer.tsx:21-22,38-39`); preparation always advances to repetition 1 (`src/lib/drill-timer.ts:70-73`). The form submits synchronously through `onStart` (`src/components/timer/DrillConfigForm.tsx:59-75`), and Node's test script includes `src/lib/*.test.ts` (`package.json:11`).

## Findings

### F1 — Phase 1 Standby type breaks the existing timer

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Plan Completeness
- **Location**: Phase 1 type contract; Phase 2 timer contract; Progress 1.1/2.1.
- **Detail**: The original Phase 1 added a `standby` variant without `durationSeconds`, while the mounted S-01 timer reads that field without narrowing. Its Phase 1 `astro check` criterion could not pass before timer adaptation in Phase 3.
- **Fix**: Keep the S-01 phase union unchanged in Phase 1; add Standby and adapt the timer together in Phase 2, moving sequence checks to that phase.
- **Decision**: FIXED — user selected Fix in plan. Plan and brief now assign the type change and compatible timer to Phase 2; Progress titles match the revised criteria.

### F2 — Resume preparation would return to repetition 1

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it.
- **Dimension**: End-State Alignment
- **Location**: Phase 2 run timeline; Phase 3 hide/resume acceptance.
- **Detail**: The original plan required full preparation before resuming an interrupted repetition but did not specify how to retain its number. Existing `nextDrillPhase` maps every preparation to exercise 1 (`src/lib/drill-timer.ts:70-73`), so a later repetition could lose progress while simpler tests pass.
- **Fix ⭐ Recommended**: Store the interrupted repetition in the run controller and enter its Standby or exercise directly after resume preparation. Test repetition 2 and the final repetition.
  - Strength: Preserves the already required completed-repetition rule without changing the normal first-run preparation transition.
  - Tradeoff: Adds explicit resume-target state and boundary tests.
  - Confidence: HIGH — the current helper's preparation transition is unconditional.
  - Blind spot: Browser hide-event timing still needs real-device acceptance.
- **Decision**: FIXED — user selected Fix in plan. Plan, brief, and automated/manual criteria now cover the explicit resume target.

### F3 — Mid-run audio failure lacks clock handoff rules

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it.
- **Dimension**: Blind Spots
- **Location**: Desired End State; Phase 2 run timeline; fallback criteria.
- **Detail**: The original plan continued silently after mid-run audio failure but did not say how to move from Web Audio time to a silent monotonic clock. It also did not resolve failure before versus after the second Standby sound ends; either gap could shorten or lengthen a phase.
- **Fix ⭐ Recommended**: Rebase the remaining phase duration onto the silent clock; before the second Standby sound ends start the full sampled wait at failure, afterward preserve the sampled wait's remainder. Cover both boundaries and exercise/rest in deterministic checks.
  - Strength: Makes the chosen silent fallback deterministic and preserves phase time.
  - Tradeoff: Requires clock-handoff state and several focused cases.
  - Confidence: HIGH — the plan explicitly switches clocks when audio fails.
  - Blind spot: Software timing checks still cannot measure physical speaker emission.
- **Decision**: FIXED — user selected Fix in plan. Plan, brief, and criteria now state the handoff rules.

## Triage Summary

- Fixed: F1, F2, F3.
- Skipped: none.
- Accepted: none.
- Dismissed: none.
- Pending: none.
- Verdict after triage: REVISE → SOUND.

The separate, previously agreed limitation remains: programmed Web Audio timestamps do not verify the PRD's ≤0.2 s physical speaker-emission tolerance. The plan states this explicitly and does not report that requirement as passed.
