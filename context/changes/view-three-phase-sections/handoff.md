# Handoff — view-three-phase-sections (S-04)

Worktree `D:\Dev\10xDevs4-view-three-phase-sections`, branch `feature/view-three-phase-sections`.

## Phase 1 — DONE (display model + view model, `src/lib`)

Delivered:

- `src/lib/drill-run.ts` — `DrillDisplay.next: DrillPhase | null`, built in both `display` branches by private `nextAfter(phase)`: after a resume preparation it returns the private `resumeTarget`, otherwise `nextDrillPhase`. It is a plain phase value, so Standby carries no wait.
- `src/lib/drill-phase-sections.ts` — `initialDrillDisplay(configuration)`, `buildPhaseSections(display, repetitions)` → `{ main, current, next }`, `formatPhaseTime` (m:ss, moved from `DrillTimerView`, which still has its own copy until Phase 2), `phaseName`.
  - `main`: `{kind:"time", text}` or `{kind:"standby"}`.
  - `current`: `{ name, time, detail }`; `time` is the fixed full time, and the word `"Standby"` for Standby (coordinator decision); `detail` is "Preparing" or "Repetition X of N".
  - `next`: `{kind:"phase", name, time|null}` (time null for Standby) or `{kind:"end"}` (render "Next: Drill complete").
  - Note: plan text said `current.time: string | null`; implemented as `string` with "Standby" after the decision.
- `DrillTimer.tsx` uses `initialDrillDisplay`; `TimerUiPreview.tsx` literals got `next` (nothing else changed).
- Tests `src/lib/drill-phase-sections.test.ts` (9): PRD example, all current→next pairs, initial display, **drive the real `DrillRun` for 16 configs** (prep 0/3 × rest 0/2 × random × reps 1/3: `next` equals the phase shown afterwards, last is `null`), resume (rep 1 and rep 2, pause during resume preparation, pause in rest/preparation, resume without preparation into Standby), exact key set, no `m:ss` in Standby main/current/Next: Standby, **differential test** (injected random 1 s vs 5 s gives identical display + sections until the shorter wait ends).

Gates (all green): `npm test` 99/99, `npx astro sync`, `npm run lint`, contract rule tests 4/4, `npx astro check` 0 errors, `npm run build`.

Break-check: (1) `nextAfter` ignoring `resumeTarget` → "resume keeps the repetition after earlier repetitions completed" went red; (2) returning `remainingSeconds` for Standby → the differential test went red. Files restored.

## Phase 2 — DONE (three-section UI, commit 3bdd6bd)

- `src/components/timer/PhaseSections.tsx`: props `{ sections, initializing }`. Main: `role="timer"` only on the numeric countdown (`text-6xl sm:text-7xl`, hidden while initializing); Standby shows the plain word "Standby" (no timer role, no wait). Current: `h2` name + ` · time` (fixed; "Standby" word for Standby) and detail line (`text-xl`/`text-base`). Next: `role="group" aria-label="Next phase"` block with `bg-muted border-border rounded-lg`, text `text-lg`. No phase colors, only semantic tokens.
- `DrillTimerView.tsx`: the old h2/countdown/repetition block and its local `formatTime` are replaced by `<PhaseSections />`; warnings area, control bar (Cancel/Restart/Pause-Resume markup), status line and props untouched; `aria-label="Current drill phase"` preserved.
- `nextPhaseText` added to `src/lib/drill-phase-sections.ts` (+ test) so "Next: Rest — 0:02" / "Next: Standby" / "Next: Drill complete" is covered by `npm test` (100/100). No DOM runner in the repo, so rendering itself is only checked by the Phase 3 Playwright pass.
- Gates green: `npm test` 100/100, `npm run lint`, contract rule tests 4/4, `npx astro check` 0 errors, `npm run build`.

## Not done / needs a human

- Progress 2.3 (real drill at `/`, 390/1280 px, light/dark) — still open; **not** done by the Phase 3 script (it covered `/dev/timer-ui` fixtures only).
- Initializing with Standby first still shows the word "Standby" in main (not a time); say if it should be hidden.

## For Phase 3

- `PhaseSectionsFixtures.tsx` mounted from `TimerUiPreview.tsx`; fixtures built with the real `DrillRun`/`initialDrillDisplay`; screenshots into `context/changes/view-three-phase-sections/screenshots/`.

## Phase 3 — DONE (commit 238f674)

- `src/components/timer/PhaseSectionsFixtures.tsx` (mounted by 2 lines in `TimerUiPreview.tsx`): 12 cards rendering production `DrillTimerView` with displays captured from the real `DrillRun` (deterministic fake clock, injected random 0.5, silent fixture audio) or `initialDrillDisplay`: Preparation→Exercise/Standby, Exercise→Rest/Drill complete, Standby→Exercise, Rest→Exercise/Standby/Drill complete, resume preparation, paused, initializing, audio unavailable. No logic duplicated; the existing seven states and held-mounted lifecycle fixtures are untouched.
- Screenshots + README + `gate-results.json` in `screenshots/` (light/dark × 1280/390).
- Gates green: `npm test` 100/100, `npm run lint`, contract rule tests 4/4, `npx astro check` 0 errors, `npm run build`.

### Checked by script (Playwright, not a human) — Progress 3.1, 3.2

424 checks, 0 failed, on `/dev/timer-ui` in dev: per-fixture current/detail/"Next: …" text; main `m:ss` + `role="timer"`, or the plain word "Standby" without timer role; no `m:ss` in Standby main/current or in "Next: Standby"; order main < current < next < controls; font size main > current > next; warning text; Resume control when paused; Cancel/Restart named and enabled; hover colour change; focus-visible ring; disabled loading slot; no overflow of the new section at 390 px; no page errors.
Pre-existing: whole preview page is 414 px wide at 390 px because of the older held-mounted restart fixture (same as S-03).

### Needs a human

- **2.3** real drill at `/` (390/1280 px, light/dark) — not done.
- **3.3** review of the screenshots (hierarchy, readability, dark mode) — not done. Note "Standby · Standby" in the current heading (the coordinator decision) looks redundant; worth a look.
- **3.4** optional real-device drill with pause/resume — not done.
- The "resumed repetition" is not visible in the Next text; it is proven only by `npm test`.

## After impl-review fixes (F1, F3, F6)

- Standby: `current.time` is now `string | null` (null for Standby). Current heading is just "Standby" with "Repetition X of N" below; main and "Next: Standby" unchanged. `PhaseSections.tsx` renders ` · time` only when present, and the redundant `cn()` is gone. `plan.md` synced (no time suffix for Standby; `m:ss` deviation from PRD "2 s" recorded; `prd.md` untouched).
- Gates re-run: `npm test` 100/100, `npm run lint`, contract rule tests 4/4, `npx astro check` 0 errors, `npm run build`; Playwright gate on `/dev/timer-ui` 424 checks, 0 failed; `standby-exercise-*` screenshots refreshed (by script, not a human).
- F4 / F5: ACCEPTED-AS-IS (see `reviews/impl-review.md`).

### Still needs a human (blocks acceptance, not the PR)

- **2.3** real drill at `/` (390/1280 px, light/dark).
- **3.3** human review of the screenshots; **3.4** optional real-device run with pause/resume.
