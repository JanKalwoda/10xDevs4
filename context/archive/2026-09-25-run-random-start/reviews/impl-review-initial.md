<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run Random Start

- **Plan**: context/changes/run-random-start/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Review basis

All 14 `## Progress` entries are checked. Reviewed the S-02 implementation commits `2731257`, `74822c3`, and `7d9951a` at the closed-plan snapshot `af7d830`. The changed source files match the planned type, parser, audio, timeline, test, and UI contracts. Additional diff files update the change, plan brief, and roadmap lifecycle rather than extending product scope. No substantive safety, performance, reliability, architecture, or pattern issue was found. The run controller bounds queued cues to a cycle and cancels them on hide or disposal.

The plan expressly excludes measurement of physical speaker emission. The `change.md` note reports audible Bluetooth delay and tracks it in roadmap S-14; this review does not treat the programmed Web Audio timing check as proof of physical output timing.

## Findings

### F1 — Browser edge-case acceptance lacks a recorded outcome

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/run-random-start/change.md:14
- **Detail**: At initial review, phase-3 manual Progress rows 3.7 and 3.8 were checked without recorded browser results for audio failure or hidden-page resume. The user supplied Chrome observations during triage; they are now in `change.md`. Audio unavailable at Start was not separately reported. Automated Progress row 3.2 is also checked, but the user clarified that the acceptance-run comparison of expected and scheduled Web Audio timestamps was intentionally skipped. Deterministic Node tests cover scheduling logic, and runtime instrumentation exists in `DrillTimer.tsx:40-49`; neither supplies the skipped browser-run result.
- **Fix**: Record the observed audio-failure and hide/resume results and one expected/scheduled timestamp sample from a browser acceptance run in the change notes.
  - Strength: Gives the checked browser-specific criteria reviewable evidence while retaining the existing implementation.
  - Tradeoff: Requires repeating or retrieving the browser checks; it does not measure physical speaker output.
  - Confidence: HIGH — the existing note and diff contain no results for these cases or raw timestamp sample.
  - Blind spot: The original human checks may have happened without a saved record.
- **Decision**: FIXED DIFFERENTLY for the recorded mid-run audio failure and visibility checks; ACCEPTED as unverified for the intentionally skipped acceptance-run Web Audio timestamp comparison. The user supplied the Chrome DevTools suspension script and observed results on 2026-09-28. Audio unavailable at Start was not separately reported.

## Verification

The repeated automated commands for phases 1–3 were run once each in a clean detached worktree at `af7d830`, after `npx astro sync`.

| Planned command | Result on 2026-09-28 |
| --- | --- |
| `npm run test` | PASS: 22 tests, 0 failures. Includes switch/range, Standby sequence, audio cue timing, silent fallback, visibility, resume target, delayed callbacks, 100-repetition bound, and programmed-schedule comparisons. |
| `npm run lint` | PASS: standard command exited 0. |
| `npx astro check` | PASS: 39 files, 0 errors, 0 warnings, 0 hints. |
| `npm run build` | PASS: Cloudflare server build completed with local secrets. |
| `npm run smoke` | PASS: all 8 HTTP checks against the S-02 production preview on port 4323 with local Supabase, including `home renders -> 200`. |

The browser schedule instrumentation records expected and scheduled cue starts in `scheduleEvidence`, computes absolute deviation, and writes the evaluated result to a performance mark at completion. Unit checks reject missing cues and deviations over 0.2 s. The user clarified during triage that the acceptance-run comparison was intentionally skipped; the earlier note was corrected to identify the passing result as unit checks. No timestamp sample is retained in the repository. This is software scheduling evidence only.

Manual Progress row 1.3 and rows 3.3–3.9 are all checked. The change note confirms the desktop and iPhone phase flow and audible signals. During triage, the user supplied and recorded Chrome observations for mid-run audio suspension and visibility resume. An unavailable-audio-at-Start browser check was not separately reported. No manual row is pending in Progress.

## Triage summary

The verdict was revised from APPROVED to NEEDS ATTENTION after the user clarified that checked automated criterion 3.2 was intentionally not performed during browser acceptance. Passing unit tests remain valid, but they do not close that criterion.

- Fixed differently: F1's mid-run audio-failure and visibility evidence was added to `change.md`.
- Accepted as unverified: F1's acceptance-run programmed Web Audio timestamp comparison was intentionally skipped.
- Still without a separate browser observation: audio unavailable at Start.
- Pending decisions: none.
