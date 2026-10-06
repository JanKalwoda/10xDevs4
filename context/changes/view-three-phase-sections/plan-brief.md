# View three phase sections — Plan Brief

> Full plan: `context/changes/view-three-phase-sections/plan.md`

## What & Why

During a drill the user sees three sections — main countdown (or "Standby"), the current phase with its fixed full time, and a highlighted preview of the next phase — instead of a single phase heading (US-02, FR-005, FR-013). The user can prepare for what comes next without the hidden random Standby wait being revealed.

## Starting Point

`DrillTimerView` shows one phase name, one countdown and a repetition line. `DrillRun` knows the phase sequence (`nextDrillPhase`) and a private resume target but exposes no "next". Phase colors (S-05) are deferred.

## Desired End State

Stacked main / current / next sections on phone and desktop, correct for skipped 0 s phases, Standby on/off, last repetition and resume after pause; Standby leaks no timing; the controls bar is unchanged below.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where "next" is computed | `DrillRun` adds `DrillDisplay.next` | Only it knows the resume target; deriving from `phase` is wrong after resume | Plan |
| View logic location | pure `src/lib/drill-phase-sections.ts` | Testable with `npm test` (S-03 lesson) | Plan |
| Colors | none; layout/size/tokens only | S-05 deferred | Roadmap |
| Time format | `m:ss` as elsewhere ("Next: Rest — 0:02") | Consistent with the app | Plan (confirmed) |
| End wording | "Next: Drill complete" | Clear English | Plan (confirmed) |
| Fixtures | new `PhaseSectionsFixtures.tsx` | Do not grow `TimerUiPreview.tsx` | S-03 lesson |
| Proof | repo tests drive the real `DrillRun`; Playwright only for screenshots/layout | Behavior evidence must live in repo tests | S-03 lesson |

## Scope

**In scope:** `DrillDisplay.next`, view model, `PhaseSections` UI in `DrillTimerView`, fixtures, screenshots.

**Out of scope:** colors/tiles, timing/audio/pause/restart changes, config form, persistence, real-device claims.

## Architecture / Approach

`DrillRun` → `display.next` (resume-aware) → `buildPhaseSections` (names, `m:ss`, texts) → `PhaseSections` (presentational) inside `DrillTimerView`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Display model + view model | `next`, `initialDrillDisplay`, `buildPhaseSections`, tests | Wrong "next" after resume; wait leak |
| 2. Three-section UI | `PhaseSections` in `DrillTimerView` | Lint contract; 390 px layout |
| 3. Visual gate | fixtures + screenshots | Fixture size; heavy `TimerUiPreview` |

**Prerequisites:** none (S-02/S-03 merged). **Estimated effort:** ~2–3 sessions.

## Open Risks & Assumptions

- Current section for Standby: name + the word "Standby" in place of the time (FR-013, confirmed by coordinator).
- Desktop keeps the same vertical stack (PRD defines only the phone layout).
- Without colors, distinction relies on size/border/background tokens; it may look plain until S-05.

## Success Criteria (Summary)

- PRD US-02 examples render exactly ("Next: Rest — 0:02", "Next: Standby", drill complete).
- Tests in `npm test` fail if `next` is wrong or the Standby wait leaks.
- Screenshots reviewed in light/dark at 1280/390.
