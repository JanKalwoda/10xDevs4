<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Double click or tap on run controls

- **Plan**: context/changes/fix-double-tap-run-controls/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-18
- **Reviewer model**: Claude Opus 5.5
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Evidence

- Diff `main...HEAD` (HEAD 639b532): every file named in the plan changed (`src/lib/drill-control-guard.ts` + test, `DrillApp.tsx`, `DrillTimer.tsx`, `DrillTimerView.tsx`, `TimerUiPreview.tsx`, `key-screen-single-action.spec.ts`, `CLAUDE.md`, `AGENTS.md`, `eslint.config.js`, screenshots). No planned file is missing.
- Contract checks: one flag `locked` read by `isLocked()`/`tryActivate()` (no time computation); `arm()` clears the previous wake and always re-opens 500 ms; `reset()` keeps the guard usable; `DrillTimer.restart` asks the guard after `retiredIntentRef` and before `retireIntent()`; `pause`/`resume` ask it after their existing rejections; Cancel untouched; `useSyncExternalStore` reads the guard on mount, so the run remounted by Restart starts locked; the view uses `aria-disabled` + `aria-disabled:pointer-events-none aria-disabled:opacity-50` through `cn()` and a guarded `onClick`; the loader keeps native `disabled`. Visibility auto-pause does not go through `pause()`, so it neither consumes nor is blocked by the window.
- CLAUDE.md and AGENTS.md carry the same exception sentence (compared byte for byte). `git status -- context/archive` is empty.
- Automated (run by the reviewer on 2026-10-18):
    - `node --test src/lib/drill-control-guard.test.ts` — 10/10 pass
    - `npm test` — 316/316 pass
    - `npm run lint` — 0 errors
    - `npx astro check` — 0 errors, 0 warnings, 5 hints
    - `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs` — 6/6 pass
    - `npx prettier --check CLAUDE.md AGENTS.md context/changes/fix-double-tap-run-controls` — clean
    - `npx playwright test` (includes `npm run build` through `webServer`) — 52/52 pass in `chromium` and `mobile-coarse`, no `test.fail()` left

## Findings

### F1 — Unplanned toBeEnabled wait in the touch double-tap helper

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: tests/e2e/key-screen-single-action.spec.ts:59-60
- **Detail**: `actTwice` (coarse path) gained `await expect(locator).toBeEnabled()` before the two `page.touchscreen.tap` calls. The plan only listed removing the two `test.fail()`, the header comment and the new Cancel test. The addition is necessary and correct: `touchscreen.tap` has no actionability wait, so right after Start both taps would land in the Start window and the test would fail for the wrong reason (it does not weaken the oracle: the second tap still lands inside the window opened by the first). It is undocumented in the plan.
- **Fix**: Add one line to the plan's Phase 2 section (or the change Notes) recording the helper wait and why.
- **Decision**: FIXED (in plan) — plan.md Phase 2 §4 now records the `expect(locator).toBeEnabled()` wait in `actTwice` for touch (`touchscreen.tap` skips actionability; the 500 ms window after Start).

### F2 — "Cancel stays enabled right after Pause" does not prove the window is open

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: tests/e2e/key-screen-single-action.spec.ts:125-140
- **Detail**: The test asserts `Cancel` has no `aria-disabled="true"` and that Cancel works, but nothing shows the 500 ms window was open at that moment. It would also pass if Pause opened no window, or if the guard wrongly covered Cancel only for a shorter time. This is the shape the plan chose (plan-review F3: the assertion is deterministic because Cancel never carries the attribute), so it is not drift; the "Cancel works within the window" half of manual step 2.5 rests on timing, not on an assertion.
- **Fix A ⭐ Recommended**: Before the Cancel check, assert `await expect(page.getByRole("button", { name: "Resume drill" })).toHaveAttribute("aria-disabled", "true")`.
    - Strength: Proves the test runs inside the window it is about; the Resume button carries the attribute immediately after Pause.
    - Tradeoff: Ties the assertion to a 500 ms window; on a very slow CI runner the first poll could come after the window closes (flaky).
    - Confidence: MED — the check normally lands within tens of ms, but CI timing was not measured.
    - Blind spot: Cancel's own click still is not guaranteed to land inside the window.
- **Fix B**: Leave as is; the unit tests and the view code (Cancel has no `aria-disabled` prop at all) cover it.
    - Strength: Zero flake risk; matches the reviewed plan.
    - Tradeoff: The e2e test name promises a little more than it proves.
    - Confidence: HIGH — `DrillTimerView.tsx` never passes `aria-disabled` to Cancel.
    - Blind spot: None significant.
- **Decision**: ACCEPTED (Fix B) — an assertion on Resume would race the 500 ms window on a slow CI runner; the test stays as planned.

### F3 — Manual 2.5 ticked without the physical phone check

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/fix-double-tap-run-controls/plan.md:284
- **Detail**: Progress 2.5 is `[x]` on the basis of the `mobile-coarse` e2e run; the note itself says the physical phone check is left to the coordinator's final report. `lessons.md` ("Oznaczaj potwierdzone kroki weryfikacji jako wykonane") ties ticking manual steps to user confirmation. The e2e evidence is real (both tests green in `mobile-coarse`), but Chromium touch emulation is not iOS Safari, which the research named as the reason `event.detail` fails.
- **Fix**: Run the three Manual Testing Steps on a phone (ideally iOS Safari) before merge and record the result next to 2.5.
- **Decision**: DEFERRED — the physical phone check (iOS Safari) goes to the user's manual verification list; the 2.5 note in plan.md now says it awaits user confirmation.

### F4 — Regression copies duplicate archived gate scripts and output

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/fix-double-tap-run-controls/screenshots/regression/
- **Detail**: As planned (plan-review F5), copies of `run-view-visual-gate.mjs` (146 lines) and `ux-fixes-round-3-visual-gate.mjs` (655 lines) plus their output (about 130 PNGs and 11.4k lines of `*-checks.json`) are committed in the change folder and added to the lint ignores. This kept the archive untouched, but after `/10x-archive` the same scripts live in two archive folders and the three new ignore entries in `eslint.config.js` point at `context/changes/...`, which moves on archive.
- **Fix**: When archiving, update the three `eslint.config.js` ignore paths to the archive folder (or drop the regression copies and their ignores if the output is not needed as evidence).
- **Decision**: DEFERRED — re-point the `eslint.config.js` ignore paths and the gate-script copies during `/10x-archive`.
