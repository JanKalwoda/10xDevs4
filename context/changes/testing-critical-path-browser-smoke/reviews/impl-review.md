<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Phase 3 — Critical-path browser smoke: closing the gaps

- **Plan**: context/changes/testing-critical-path-browser-smoke/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-15
- **Verdict**: APPROVED (after the fixes below)
- **Findings**: 0 critical, 2 warnings, 3 observations
- **Reviewer model**: Opus 5.5
- **Commits reviewed**: a9e51c5..7308c21

## Verdicts

| Dimension           | Verdict                                            |
| ------------------- | -------------------------------------------------- |
| Plan Adherence      | WARNING (F1, fixed)                                |
| Scope Discipline    | PASS                                               |
| Safety & Quality    | WARNING (F2, fixed)                                |
| Architecture        | PASS                                               |
| Pattern Consistency | PASS                                               |
| Success Criteria    | PASS (4.2 and 4.3 pending for the coordinator, F4) |

Scope: the diff touches only `tests/e2e/**`, the change folder and `context/foundation/test-plan.md`; `src/` is untouched, `test-stack.md` is untouched, no new dependencies. Phases 1 and 2 match the plan (MATCH): the Mailpit helper extraction keeps `auth.setup.ts` behaviour, the return-address spec asserts the URL and visible content, the stepper spec uses literal values and accessible names.

## Gates (after the fixes)

- `npm run lint`: pass (0 problems)
- `npm test`: 306/306 pass
- `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`: 6/6 pass
- `npx astro check`: 0 errors, 0 warnings, 3 hints
- `npm run build`: pass
- `npx prettier --check context/foundation/test-plan.md tests/e2e/saved-timer-start.spec.ts`: pass
- `npx playwright test` (E2E_PORT=4323): 8 passed (setup + 7 specs)
- Deliberate breakage for F1: `buildPhaseSections` countdown started 1 s short (`src/lib/drill-phase-sections.ts`) → `saved-timer-start.spec.ts` red at `expect(exercise.countdown).toBe("0:07")` (received `0:06`); reverted, `git diff -- src/` empty. The pre-fix spec would have stayed green under this breakage.

## Findings

### F1 — Saved-timer Start never asserted the countdown

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/e2e/saved-timer-start.spec.ts:50-53 (before the fix)
- **Detail**: The plan (Phase 3) says "once Exercise is current, its countdown starts at `0:07`", and the spec comment claimed "The exercise starts at its full saved time", but the spec only checked `current === "Exercise · 0:07"`. Current shows the fixed configured time (`buildPhaseSections` → `phaseTime`), not the countdown (`role="timer"`), so a wrong starting countdown passed.
- **Fix**: Assert `exercise.countdown` is `"0:07"` on the first Exercise view (as `run-phase-sequence.spec.ts` does).
- **Decision**: FIXED (proven by deliberate breakage, see Gates)

### F2 — Poll then re-read races the 1 s preparation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/e2e/saved-timer-start.spec.ts:45-48 (before the fix)
- **Detail**: `expect.poll` with default intervals (100, 250, 500, 1000 ms) waited for Preparation and the spec then took a second snapshot for `repetition`/`next`. With a 1 s preparation the poll can sample past the phase, and the second read can already be in Exercise; a latent flake.
- **Fix**: Poll every 100 ms and assert on the same view that matched (`viewOf` helper inside the spec).
- **Decision**: FIXED

### F3 — §6.4 not fully self-sufficient

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/test-plan.md §6.4
- **Detail**: Manual check 4.3 ("§6.4 alone is enough") was weakened: the rules named `Origin` only for the POST setup, not for the `DELETE` cleanup (403 without it), did not state the "snapshot the inbox before submit" rule, and the "wszystkie siedem" list had eight entries (seven specs + the setup project).
- **Fix**: Add `Origin` + `afterEach` to the cleanup rule, a `snapshotInbox` rule, and relabel the list.
- **Decision**: FIXED

### F4 — 4.2 and 4.3 still pending

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md ## Progress 4.2, 4.3
- **Detail**: 4.2 needs the coordinator's push and a green `smoke` job on PR #64 with `8 passed`; 4.3 is a human check. Locally the suite reports `8 passed`. §3 row 3 is already `complete` (kept as instructed).
- **Fix**: Coordinator: push, confirm `gh pr checks 64`, tick 4.2; human confirms 4.3.
- **Decision**: PENDING (coordinator)

### F5 — change.md status did not follow the implementation

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/changes/testing-critical-path-browser-smoke/change.md
- **Detail**: `status` stayed `plan_reviewed` through all four sub-phases instead of `implementing`/`implemented`. Manual 3.5 is ticked with the p4 SHA; its evidence is the asserted `DELETE` cleanup in `afterEach`, which is acceptable.
- **Fix**: Set `status: impl_reviewed` (this review).
- **Decision**: FIXED
