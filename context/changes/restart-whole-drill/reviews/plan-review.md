<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Restart the whole drill

- Plan: context/changes/restart-whole-drill/plan.md
- Mode: Deep
- Date: 2026-10-05
- Planning checkpoint: 11e79da864ca9892e7dc8ac8b74255c7902840f9
- Source baseline: 34e8b7d1b942dbb40185727a17e4ee534be3c396; synchronized main 45951a61e599215684e28d403665ce9824db8daa
- Initial verdict: REVISE
- **Verdict**: SOUND
- Findings: 0 critical, 4 warnings, 0 observations

## Verdicts

| Dimension             | Initial verdict |
| --------------------- | --------------- |
| End-State Alignment   | PASS            |
| Lean Execution        | PASS            |
| Architectural Fitness | WARNING         |
| Blind Spots           | WARNING         |
| Plan Completeness     | WARNING         |

## Grounding

Grounding: 5/5 existing paths verified (DrillApp, DrillTimer, DrillTimerView, TimerUiPreview, drill-run); firstDrillPhase, stop, resumeWithAudio and required callers verified; brief and plan agree on the two-phase scope. The newly specified helper/test paths are explicit planned additions.

The coordinator read the full plan, brief, research and lessons and inspected the affected sources. One independent GPT-6-Luna xHigh reviewer verified the risky claims read-only in D:/Dev/10xDevs4-restart-whole-drill-plan-review on feature/restart-whole-drill-plan-review. Its report is plan-code-verification.md. No code or tests were changed by review.

## Findings and triage

### F1 — Phase 1 omits required Preview callback consumers

- Severity: WARNING
- Impact: LOW — quick decision; fix is obvious and narrowly scoped
- Dimension: Plan Completeness
- Location: Phase 1 changes and local gates
- Detail: Two DrillTimer callers and three DrillTimerView render sites must type-check together. Three Preview sites are omitted from Phase 1 and deferred to Phase 2. A required Restart prop therefore breaks the independently accepted first phase.
- Fix: Specify onRestart as required, update all callers with meaningful preview responses in Phase 1, and require sync/check/build in that phase.
- Decision: FIXED by coordinator; Phase 1 section 5 and expanded gate.

### F2 — Parent ownership criterion has no concrete production test seam

- Severity: WARNING
- Impact: MEDIUM — real tradeoff; pause to reason through it
- Dimension: Architectural Fitness
- Location: Run identity and test seam; Phase 1 ownership tests
- Detail: Production completion is currently unconditional (DrillApp.tsx:55-57); changing resource props retains old refs/state. Existing Node tests cannot execute the React parent, and an independently cloned preview guard would test only the clone.
- Fix: Add one production-used drill-run-identity state with begin/isCurrent/retire/complete, test it through the existing Node runner, and reuse the same guard in production and the real-DrillTimer fixture. Keep resources and React state in their current owners.
- Strength: Tests the actual guard used by production with a small domain helper.
- Tradeoff: Browser checks and source review still establish parent wiring; Node tests alone do not render React.
- Confidence: HIGH — mirrors the existing narrow Resume-generation state pattern.
- Blind spot: Physical audio/Wake Lock behavior is outside deterministic fixtures.
- Decision: FIXED by coordinator; named files/API, stable per-run callbacks and fresh key specified.

### F3 — Replacement fixture cannot select old resources or the captured wake

- Severity: WARNING
- Impact: HIGH — architectural stakes; think carefully before deciding
- Dimension: Blind Spots
- Location: Phase 2 lifecycle fixture
- Detail: The current harness owns one resource bundle, pops an unspecified cleared wake and hardcodes Wake Lock visibility, while DrillTimer reads document.hidden. It cannot resolve old grants after replacement or deterministically exercise hidden pending setup as promised.
- Fix: Keep per-run bundles/resolvers/counters and a held retired child; capture the exact old wake handle before Restart and invoke it afterward. Add a narrow optional visibility port with a stable browser default used by all Timer reads/subscriptions; the fixture session shares its fake source.
- Strength: Every adversarial event is attributable to its original owner and can actually be driven.
- Tradeoff: A small Timer visibility seam and per-identity fixture bookkeeping are required.
- Confidence: HIGH — all production resource controllers and clock seams already exist.
- Blind spot: Browser-native visibility is additionally checked through actual production interactions.
- Decision: FIXED by coordinator; Phase 2 fixture contract expanded with non-vacuous wake and visibility assertions.

### F4 — CI smoke is incorrectly required before the Phase 2 commit

- Severity: WARNING
- Impact: MEDIUM — real tradeoff; pause to reason through it
- Dimension: Plan Completeness
- Location: Phase 2 automated criteria and phase gate
- Detail: The unchanged workflow runs only for main pushes or PRs targeting main. Its CI-owned Supabase/Mailpit smoke cannot run on a nonexistent pre-commit PR head.
- Fix: Run local gates and commit Phase 2 separately; then coordinator review, PR push and CI/smoke on the actual final head are required before merge. Preserve the pending integration Progress item until CI passes.
- Strength: Each local phase remains reviewable while CI verifies the real pushed head.
- Tradeoff: Final integration acceptance remains a coordinator step after the code checkpoint.
- Confidence: HIGH — workflow triggers are explicit in ci.yml:3-7.
- Blind spot: No significant one.
- Decision: FIXED by coordinator; phase commit and post-push integration gate separated.

## Coordinator decisions

- Restart is confined to the mounted timer bar; Completed keeps its existing Return to configuration flow.
- Two phases, each independently tested and committed, are approved in principle.
- Existing auth, CI, global tokens, shared primitives and dependencies are outside this change.
- Focused verification confirms F1–F3 resolved and F4 phase ordering feasible. The coordinator also corrected the residual overview sentence: only local/manual gates precede the code commit; PR CI follows push. All four findings are FIXED; the plan is SOUND for Phase 1.

## Final verdicts after fixes

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | PASS    |

Progress remains entirely pending; this review approves the plan, not implementation. Native implementation will run one phase at a time, test and commit it separately, then checkpoint, successfully compact and clear before the next phase.
