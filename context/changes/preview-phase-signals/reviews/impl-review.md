<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Preview phase signals (S-03)

- **Plan**: context/changes/preview-phase-signals/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-06
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Gates run by reviewer: `npm test` 87/87, `npm run lint` clean, contract rule tests 4/4, `npx astro check` 0 errors (1 pre-existing hint in drill-audio.ts). Build not re-run (handoff reports green).

## Findings

### F1 — Lifecycle/Start evidence is only a temporary out-of-repo Playwright run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/preview-phase-signals/plan.md (Progress 2.2), src/components/timer/DrillConfigForm.tsx:101
- **Detail**: Step 2.2 ("preview click never invokes Start") and "Start releases preview audio before onStart" are checked [x] on the basis of a temporary Playwright script (README: "temporary Playwright… outside repository dependencies"); only gate-results.json is committed. No test in `npm test`/CI covers the form wiring (release-before-onStart ordering, type="button"). Controller lifecycle itself is well covered by node:test.
- **Fix**: Commit the gate script (or a small SSR/DOM test of DrillConfigForm with injected createAudio) so 2.2 is reproducible; or note in the plan that 2.2 rests on a one-off script.
  - Strength: Makes the ordering guarantee regress-proof.
  - Tradeoff: Adds a dev dependency or test harness.
  - Confidence: MED — repo has no DOM test runner today.
  - Blind spot: Did not re-run the Playwright checks.
- **Decision**: FIXED — release-then-start ordering extracted to `src/lib/drill-config-submit.ts` (`submitDrillConfig`) and covered by `drill-config-submit.test.ts` (runs in `npm test`/CI): release before onStart, frozen configuration, invalid submit does neither. The "preview click never calls Start" part is structural (the preview path only reaches the controller, which has no access to `onStart`; button is `type="button"`) and still verified by the Playwright gate only; no DOM test runner in the repo.

### F2 — Loading state has no visible or live-announced text

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/timer/SignalPreviewControl.tsx:40,57
- **Detail**: While initializing only `aria-busy` on the button is set; the `role="status"` region announces only "Playing …". Screen-reader users get no feedback during the (up to 1.5 s) init.
- **Fix**: Put e.g. "Starting sound…" in the role="status" paragraph while `initializing`.
- **Decision**: FIXED — `role="status"` paragraph shows "Starting sound…" while initializing.

### F3 — "1–5 s" in the Standby meaning text is a literal

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/drill-signal-preview.ts:9
- **Detail**: Text hard-codes the random-wait range instead of deriving it from the drill's random-start constants; may drift silently (FR-004 consistency applies to description too).
- **Fix**: Build the string from the exported range constants or add a test pinning it.
- **Decision**: FIXED — added `RANDOM_START_MIN/MAX_CENTISECONDS` in `drill-timer.ts` (also used by `sampleRandomStartCentiseconds`); the Standby meaning is built from them; test pins the text to the constants.

### F4 — Preview AudioContext stays open after playback

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-signal-preview-controller.ts:65-72
- **Detail**: By plan, the port is kept after the cue ends and closed only on Start/unmount (reuse keeps clicks in-gesture-safe; dead ports are replaced). No leak: release is idempotent, late grants are closed, StrictMode remount is safe. Idle context holds an audio session until then.
- **Fix**: Accepted by plan; optionally close the port on playing→idle if a mobile audio-session issue shows up.
- **Decision**: ACCEPTED — as planned, no change.

## Notes

- FR-004: preview uses `playSignalPreview` → same `DrillCue`s/`STANDBY_SECOND_OFFSET` as DrillRun; test compares against cues recorded from a real DrillRun. OK.
- Web Audio gesture: `createAudio()` called synchronously in `play`; reuse only if `port.available`. OK.
- Manual steps 2.3 and 3.2 (real-device listening, human screenshot review) remain unchecked, honestly reported in handoff.
