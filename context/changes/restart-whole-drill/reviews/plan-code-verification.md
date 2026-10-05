# S08 Plan Code Verification

Read-only review of `context/changes/restart-whole-drill/plan.md` as present in `D:\Dev\10xDevs4-restart-whole-drill`, against source at commit `34e8b7d1b942dbb40185727a17e4ee534be3c396` in the requested worktree `D:\Dev\10xDevs4-restart-whole-drill-plan-review` (`feature/restart-whole-drill-plan-review`). No source, plan, tests, servers, or root worktree were changed. The plan file was read from the supplied planning worktree because it is not present at the source commit.

## Findings

### F1 — Required Restart callbacks reach Preview callers in Phase 1

**Severity:** WARNING · **Impact:** LOW · **Dimension:** Plan Completeness

The Phase 1 contract adds the Restart callback through `DrillTimer` and `DrillTimerView` (plan Phase 1, Changes Required), and Phase 1 requires `npx astro check` (plan line 94). If those props are required as the task assumes, all call sites must type-check in Phase 1. The exhaustive caller scan found:

- `DrillApp.tsx:95` renders `DrillTimer`.
- `DrillTimer.tsx:151` renders `DrillTimerView`.
- `TimerUiPreview.tsx:267-282` and `:653-668` render `DrillTimerView` directly.
- `TimerUiPreview.tsx:432-440` renders `DrillTimer`.

The plan schedules the preview work in Phase 2 (`plan.md:112-116`), so the Phase 1 Astro check would fail unless the required props are made optional or the three Preview callers receive callbacks in Phase 1. **Recommendation:** list the required-prop and caller updates in Phase 1; keep the Preview's replacement/lifecycle behavior in Phase 2.

### F2 — Keyed remount and same-gesture resources are required; parent guard needs a shared test seam

**Severity:** WARNING · **Impact:** MEDIUM · **Dimension:** Architectural Fitness

The plan's fresh key and synchronous gesture requirements are confirmed by the current component lifecycle. `DrillTimer` owns a one-way `cancelIntentRef` (`DrillTimer.tsx:23-33,115-120`); `begin`, the tick interval, Pause and Resume all consult it (`:42-48,91-93,122-146`). Changing `audio`/`wakeLock` props reruns the effect (`:35-41,113`) but does not reset hook state or refs, so reusing the mounted instance can leave the new run cancelled or retain old UI state. A new key gives the replacement fresh refs and state. The existing parent `start` path creates audio, a fresh Wake Lock session, and calls `requestForVisibleGesture()` before setting React state (`DrillApp.tsx:63-81`); Restart can preserve that boundary by synchronously latching/disposing in the child and invoking the parent's replacement callback in the same click handler, with no await before resource creation.

The production App currently has no run identity or stale completion guard: `complete` unconditionally sets `view` (`DrillApp.tsx:55-57`), and its timer is rendered without a key (`:94-96`). Existing automated seams cover `DrillRun` clocks/random (`drill-run.ts:7-19,61-80`), disposal/generation (`:223-238,329-345`), and direct stale-wake behavior (`drill-run.test.ts:81-103`). They do not cover the React parent's completion callback. `npm test` runs only `src/lib/*.test.ts` (`package.json:5-14`), and no React DOM/browser runner is declared. Thus the stale completion criterion is implementable without a new dependency, but not through the current seams alone. **Recommendation:** add one narrow production-used drill run identity/completion predicate or guard in `src/lib/`, have `DrillApp` use it, and test that same helper in Node. Keep the helper specific to DrillApp; a parallel identity implementation in the preview parent would only test the clone.

### F3 — Held-mounted replacement needs per-run fake ownership and an exact retained-wake handle

**Severity:** WARNING · **Impact:** HIGH · **Dimension:** Plan Completeness

The plan now requires replacement, late old-resource resolution, and an old wake captured before Restart to fire after the new run mounts (`plan.md:112-124,149-164`), but the current Preview fixture is single-run. `createHeldTimerHarness` returns one audio promise, one clock, one Wake Lock session, and one set of deferred resolvers (`TimerUiPreview.tsx:174-245`); `mountScenario` creates it once (`:341-347`). `onCancel` only records text/counters and keeps the same timer mounted (`:328-339`); `<DrillTimer>` has no replacement key or changing resource bundle (`:430-440`). The late initial-audio, Resume-audio, and Wake Lock resolvers close over only that one bundle (`:232-244`), so after replacing the current harness they cannot resolve the retired run's grants while independently operating the replacement's resources.

The fake clock retains cleared callbacks in a stack and `fireRetainedWake()` pops whichever callback is last; it returns `true` when one existed (`:120-153`). It exposes no handle to capture before Restart or select the same callback afterward. Therefore the new “captured before restart” requirement is not executable as stated without specifying that seam. Also, `DrillTimer` reads `document.hidden` directly (`DrillTimer.tsx:38,74,80-90,131`), while the fixture Wake Lock session is hard-coded visible and has no hidden subscription (`TimerUiPreview.tsx:202-215`); the plan doesn't state how the held-mounted scenario drives hide/show deterministically.

**Recommendation:** specify a parent fixture that starts a new keyed timer/resource bundle synchronously on Restart, retains old bundle references and per-run deferred resolvers, and fires a captured wake by stable handle after replacement. Share a fixture clock across runs if testing the production singleton clock behavior. State whether visibility is driven with real browser tab visibility during manual preview review or via a small injected visibility seam. Keep completion identity delegated to the same production helper used by `DrillApp` (F2).

### F4 — The inherited PR smoke gate cannot pass before the Phase 2 commit

**Severity:** WARNING · **Impact:** MEDIUM · **Dimension:** Plan Completeness

Plan overview says each phase is committed after its automated/manual criteria (`plan.md:35`), and Phase 2 gate says to run all project and inherited CI gates, then make its separate commit (`:151`). Its automated criteria require the unchanged CI production-preview smoke job to pass (`:145`). The workflow triggers only on pushes to `main` and pull requests targeting `main` (`.github/workflows/ci.yml:3-7`); the smoke job builds the preview and starts CI-owned Supabase/Mailpit (`:26-56`). A Phase 2 PR commit must exist and be pushed before that job can run, so the CI smoke result cannot be a pre-commit gate. Local commands do not run that workflow-owned job. **Recommendation:** make/push the Phase 2 commit to the PR, then require CI to pass before merge/phase acceptance; only local project commands and manual checks can be pre-commit gates.

## Verified call-site inventory

`rg` over the source found two `<DrillTimer>` call sites and three `<DrillTimerView>` render sites (including the production DrillTimer-to-view call). No other direct consumers were found. No tests or servers were run, per task instructions.

## Re-review Addendum — Updated Plan

Reviewed the current plan in `D:\Dev\10xDevs4-restart-whole-drill` and the affected source contracts at `34e8b7d1b942dbb40185727a17e4ee534be3c396`. The affected source files are unchanged at `45951a61e599215684e28d403665ce9824db8daa`; no tests were run and no files were changed in either worktree.

- **F1 — Resolved.** Plan lines 98–108 explicitly require callbacks on both component props and update the two `DrillTimer` callers plus all three `DrillTimerView` render sites in Phase 1. It prohibits optional/no-op fallbacks and requires sync, build, lint, and Astro checks. Source scan confirms those five call sites.
- **F2 — Resolved.** Plan lines 49–53 specify the narrow production-used `drill-run-identity.ts` API (`begin`, `isCurrent`, `retire`, `complete`), require DrillApp to use it, require Node tests against that helper, and require the preview parent to reuse it. It also requires stable callbacks and synchronous same-gesture resource creation. This directly addresses the missing React-parent seam without a React test dependency or cloned guard.
- **F3 — Resolved.** Plan lines 55 and 126–134 now define the visibility port and require it for every timer hidden check, shared with the fixture WakeLockSession. The fixture retains retired keyed children/resources until explicit teardown, keeps deferred resources/resolvers per identity, records per-identity counters, and captures/fires a specific old wake by handle after replacement. This is executable using small new seams and the production `DrillTimer`; current source scan confirms precisely the direct `document.hidden` reads and single-run stack-based fixture that need replacement.
- **F4 — Phase-specific order resolved; one overview ambiguity remains.** The Phase 2 criteria/gate at lines 162 and 168 correctly put the PR smoke check after the Phase 2 commit is pushed and before merge; the workflow only runs on main pushes or PRs targeting main (`ci.yml:3-7`), with smoke in its own CI job (`:26-56`). However, overview line 35 still says each phase's code/test commit lands “after its automated and manual criteria pass,” while the unchanged PR smoke gate is itself a Phase 2 success criterion and can only run after that commit is pushed. The detailed gate is feasible and explicit, but this sentence leaves a contradiction. Clarify that phase commits follow local/manual gates and coordinator CI runs after push, before merge.

**Verdict:** F1–F3 are resolved. F4's execution sequence is now feasible, with the overview wording above the only material remaining ambiguity. No other material infeasibility found in the four reviewed claims.
