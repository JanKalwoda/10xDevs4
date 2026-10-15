<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Phase 3 — Critical-path browser smoke: closing the gaps

- **Plan**: context/changes/testing-critical-path-browser-smoke/plan.md
- **Mode**: Deep
- **Date**: 2026-10-15
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 7/7 paths ✓ (`auth.setup.ts`, `SignInForm.tsx`, `callback.astro`, `ConfigStepper.tsx`, `DrillConfigForm.tsx`, `SavedDrillDetails.tsx`, `test-plan.md` anchors), 6/6 symbols ✓ (stepper `aria-label`, ↑/↓ + Shift handler, `onStart(drill.configuration)`, `isSafeNextPath("/create")`, `/auth/callback*` redirect allow-list for 4321/4323, form defaults 0:05/0:04/3 distinct from the saved 0:01/0:07/2), brief↔plan ✓. Progress↔Phase ✓.

Also checked: `max_frequency = "1s"` and `email_sent` (SMTP only) do not block a second magic link right after the setup; `MAX_REPETITIONS = 100` leaves room for Shift+↑ to 13; without random start the phase after Preparation is Exercise, so "Next: Exercise · 0:07" holds.

## Findings

### F1 — Phase 1 breakage hits an intermediate hop, not the return

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Success Criteria 1.4
- **Detail**: `SignInForm.tsx:33` only builds the `/auth/confirm-email?next=…` URL. The real return comes from the hidden `next` input → `emailRedirectTo` → the callback page script (`callback.astro:54-85`), which research named as the untested browser-only hop. Breaking line 33 turns the spec red at an intermediate `waitForURL`, so the final `/create` assertion is never proven able to fail.
- **Fix**: Break the callback page script (`window.location.assign("/timers")`) so the spec goes red at its final `/create` assertion.
- **Decision**: FIXED

### F2 — CI criterion needs a push the agent may not do; count is ambiguous

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Success Criteria 4.2
- **Detail**: The brief forbids push; only the coordinator pushes, so 4.2 cannot be verified inside the phase as worded. Playwright reports tests, not specs: today `5 passed` = setup + 4 tests, so the target is `8 passed`.
- **Fix**: "After the coordinator pushes, `gh pr checks 64` green and the E2E step reports `8 passed` (the setup plus 7 spec tests)".
- **Decision**: FIXED

### F3 — Phase 2 promises ↓ but never presses it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Stepper spec Intent
- **Detail**: The overview says ↑/Shift+↑/↓ step in the field, but the sequence only presses ↑ and Shift+↑; the ArrowDown branch of the handler stays unexercised.
- **Fix**: End the sequence with ↓ in the field giving `11`.
- **Decision**: FIXED
