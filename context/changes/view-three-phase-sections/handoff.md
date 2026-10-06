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

## For Phase 2

- `PhaseSections.tsx` takes `buildPhaseSections` output + `initializing`; render "Next: <name> — <time>" / "Next: Standby" / "Next: Drill complete".
- `DrillTimerView` still renders the old heading/countdown and its own `formatTime`; replace with `PhaseSections` and drop the local formatter (use `formatPhaseTime`).
- Main section font must be clearly larger than current/next (FR-013); no color tokens (S-05 deferred).
- Keep the `role="timer"` only on the numeric countdown; no Standby wait in any accessible name.

## Not done / needs a human

- No visual change yet; Phase 2/3 manual and screenshot steps are pending.
