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

- Progress 2.3 (real drill at `/`, 390/1280 px, light/dark) is manual and still open; screenshots and fixtures are Phase 3.
- Initializing with Standby first still shows the word "Standby" in main (not a time); say if it should be hidden.

## For Phase 3

- `PhaseSectionsFixtures.tsx` mounted from `TimerUiPreview.tsx`; fixtures built with the real `DrillRun`/`initialDrillDisplay`; screenshots into `context/changes/view-three-phase-sections/screenshots/`.
