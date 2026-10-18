<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Key-screen layout and tap-target check (test-plan Phase 4)

- **Plan**: context/changes/testing-key-screen-layout/plan.md
- **Scope**: Full plan (completed work of phases 1-3; steps 3.2-3.5 are owned by the coordinator)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Gates run on review (2026-10-15): `npm run lint`, `npm test`, ESLint rule tests, `npx astro check` (0 errors), `npx prettier --check context/foundation/test-plan.md README.md`, `npm run build`, `npx playwright test` (50 passed, including 2 expected failures per project: double Restart, double Pause); `--project=mobile-coarse --list` lists only `key-screen-*` specs (plus the `setup` dependency).

## Findings

### F1 — test-plan §5 claims the `main` ruleset is enforced, but it is not

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:131
- **Detail**: The new §5 row said `required (wymuszone 2026-10-15)`, while `gh api repos/{owner}/{repo}/rulesets/23709389 --jq '.rules[].type'` returns only `non_fast_forward` and `pull_request` (step 3.3 is pending, done by the coordinator after the green PR). The plan contract allows "nie wymuszone" until step 3 is done.
- **Fix**: Mark the row `required (nie wymuszone: krok 3.3 planu Phase 4, po zielonym PR)`; the coordinator flips it after the ruleset change.
- **Decision**: FIXED

### F2 — §6.5 cookbook does not match the helper and the specs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:231-232
- **Detail**: §6.5 documented `expectTarget(locator, { minSize })`, the real signature is `expectTarget(page, locator, { minSize, coarse })` (`tests/e2e/support/layout.ts:42`); it also said every `key-screen-*` test starts with `expectCoarsePointer`, which holds for `key-screen-layout.spec.ts` only (the single-action spec relies on `tap()` throwing without `hasTouch`). A future test written from the cookbook would not compile.
- **Fix**: Correct the signature and scope the `expectCoarsePointer` rule to the geometry spec.
- **Decision**: FIXED

### F3 — `/timers` geometry test skipped `waitForHydration`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/e2e/key-screen-layout.spec.ts:167
- **Detail**: The plan contract says every screen waits for hydration before measuring; the `/timers` test measured right after `goto` (the top bar has an island). Harmless today, but the layout could shift after hydration.
- **Fix**: Add `await waitForHydration(page);` after `page.goto("/timers")`.
- **Decision**: FIXED

### F4 — a timer saved through the UI leaks when the test fails before the redirect

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/e2e/key-screen-single-action.spec.ts:164-165, 255-256
- **Detail**: The id is registered for cleanup only after `waitForURL`; if the POST succeeds and the test fails before the redirect, the timer stays on the reused local e2e account (limit 50 per user). CI uses a fresh stack, so only repeated local failures are affected; the same pattern exists in `seed.spec.ts`.
- **Fix**: Read the id from the `POST /api/drills` response (`waitForResponse`) and register it before asserting the URL.
- **Decision**: SKIPPED — local-only, consistent with the seed pattern; revisit if the limit is hit.

### F5 — `test.fail()` accepts any failure, not only the confirmed double action

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/e2e/key-screen-single-action.spec.ts:216, 232
- **Detail**: A setup break (e.g. Start not reachable) would also count as the expected failure. Mitigated by the plan's rule of no locator actions after the double action and by the sibling single-action tests covering the same setup, which would go red first.
- **Fix**: None needed now; `fix-double-tap-run-controls` removes `test.fail()`.
- **Decision**: ACCEPTED — sibling tests guard the setup path.
