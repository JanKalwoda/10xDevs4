# View three phase sections — Implementation Plan

## Overview

S-04 (US-02, FR-005, FR-013). During a drill the user sees three stacked sections instead of one phase heading: a large **main** countdown (or "Standby"), a **current phase** section with the phase name and its fixed full configured time, and a highlighted **next phase** section ("Next: Rest — 0:02", "Next: Standby", or the end of the drill). Phase colors (FR-014, S-05) are deferred, so the sections are told apart by layout, size and semantic tokens only. All visible text is English.

## Current State Analysis

- `DrillTimerView.tsx:49-60` renders one `h2` phase name, one `role="timer"` countdown (hidden for Standby/initializing) and a "Repetition X of N" line; the control bar (Cancel / Restart / Pause-Resume) and status line follow (`:61-110`). No next-phase information exists in the view.
- `DrillDisplay` (`src/lib/drill-run.ts:21-26`) is `{phase, remainingSeconds, paused, audioAvailable}`. `phase` already carries the full configured `durationSeconds` (not the remaining time) and, for Standby, no duration at all — the random wait lives only in the private `Segment.sampledWait` (`drill-run.ts:28-34`).
- `nextDrillPhase(configuration, phase)` (`src/lib/drill-timer.ts:76-103`) already encodes skipping a 0 s preparation/rest, the Standby toggle and the end of the drill (returns `null`).
- **Resume trap**: after Pause→Resume in Standby/exercise with preparation > 0, `DrillRun` shows a full *preparation* and then jumps to the private `resumeTarget` (same repetition), not to `nextDrillPhase(prep)`, which would say repetition 1 (`drill-run.ts` `tick` ~`:112`, `resume()` ~`:175-187`, `appendLookahead` ~`:290`). A view that derives "next" from `phase` alone would be wrong after every resume.
- `DrillTimer.tsx:43-46` builds the initial display by hand; `TimerUiPreview.tsx` (1208 lines) builds `DrillDisplay` literals (`:29-45`, `:327`) and the held-mounted Cancel/Restart lifecycle fixtures. `npm test` is `node --test src/lib/*.test.ts` — logic must live in `src/lib` to be covered.
- Timer UI contract lint forbids palette/literal/arbitrary values; the controls bar contract (Cancel left, Restart middle, Pause/Resume right, size-12) must stay below the sections.

## Desired End State

- Phone (390 px) and desktop (1280 px) show, top to bottom: main section, current-phase section, next-phase section, then the unchanged control bar and status line.
- Main: remaining time `m:ss` (or "Standby" without countdown), clearly the largest type. Current: phase name + fixed full time (never counts down; for Standby the time slot shows the word "Standby") + "Repetition X of N" / "Preparing". Next: "Next: <Name> — <m:ss>", "Next: Standby" (no time), or "Next: Drill complete" when no phase follows.
- Correct for: preparation 0 s (skipped), rest 0 s (skipped; last exercise → drill complete), Standby on/off, last repetition, Pause→Resume (next after the resume preparation is the resumed repetition's Standby/exercise), paused and initializing states.
- Standby never reveals the random wait: neither `DrillDisplay`, the view model nor the DOM contains any value derived from it.
- **Decision (explicit deviation from PRD wording)**: times are formatted `m:ss` ("Next: Rest — 0:02") for consistency with the main countdown and form fields, whereas PRD US-02 writes "2 s". Approved by the coordinator; tests use the `m:ss` format.
- Evidence for every behavior is in repo tests (`npm test`); the `/dev/timer-ui` gate adds screenshots, not proofs.

### Key Discoveries

- `phase.durationSeconds` is already the fixed full time, so the "current section" needs no new data; only "next" does.
- The resume target is private to `DrillRun`, so `next` must be computed by `DrillRun` and exposed on `DrillDisplay` (a plain `DrillPhase`; Standby has no duration, so it cannot leak the wait).
- Fixture precedent: production component + deterministic fixtures; `SignalPreviewFixtures.tsx` shows how to keep fixtures out of the big `TimerUiPreview.tsx`.

## What We're NOT Doing

- No phase colors, color tiles, palette or per-phase backgrounds (S-05 deferred); no new color tokens.
- No change to timing, audio cues, random wait, pause/resume/cancel/restart behavior or the control bar contract.
- No new route, persistence, auth or database work; no change to the configuration form.
- No countdown in the current or next sections; no claim of device compatibility beyond what optional manual step 3.4 records if a human actually performs it.

## Implementation Approach

1. **Phase 1 (src/lib)**: add `next` to `DrillDisplay` computed by `DrillRun` (honoring `resumeTarget`), an `initialDrillDisplay(configuration)` helper, and a pure `buildPhaseSections(display, repetitions)` view model with all text/format decisions. Table-driven tests plus drive-the-real-`DrillRun` tests prove `next` equals the phase that actually follows, including resume and no-leak.
2. **Phase 2 (UI)**: presentational `PhaseSections.tsx` in `src/components/timer/` consuming the view model; `DrillTimerView` renders it above the unchanged control bar; semantic tokens and Tailwind scale only.
3. **Phase 3 (visual gate)**: new `PhaseSectionsFixtures.tsx` mounted from `TimerUiPreview.tsx` with a couple of lines; existing seven states and held-mounted lifecycle scenarios keep working (only `next` added to their literals); screenshots light/dark × 1280/390 saved in the change folder.

## Critical Implementation Details

- **State sequencing** — `DrillRun.display` is built in two places (paused branch and live branch, `drill-run.ts:87-103`); both must set `next` from one private helper: `phase.kind === "preparation" && this.resumeTarget ? this.resumeTarget : nextDrillPhase(configuration, phase)`. When no segment is current (`phase: null`), `next` is `null`.
- **No leak** — `next` and the view model are built only from `DrillPhase` values; never pass `Segment`, `sampledWait` or remaining wait to the view. A test asserts the exact key set of `display` and that Standby main/current carry no number (the word "Standby" replaces the time).

---

## Phase 1: Display model and view model (src/lib)

### Overview

Pure, UI-free logic with tests proving what the sections will show.

### Changes Required:

#### 1. `DrillDisplay.next` in `DrillRun`

**File**: `src/lib/drill-run.ts`, `src/lib/drill-run.test.ts`

**Intent**: Expose the phase that will actually follow the displayed one, including the resume-preparation case.

**Contract**: `DrillDisplay` gains `next: DrillPhase | null` (required). Private helper as in Critical Implementation Details, used by both `display` branches. Existing tests keep passing; new tests are listed in Testing Strategy.

#### 2. Initial display helper and phase-sections view model

**File**: `src/lib/drill-phase-sections.ts`, `src/lib/drill-phase-sections.test.ts`

**Intent**: Single place for names, time formatting and the three sections' content; also replaces the hand-built initial display in `DrillTimer.tsx`.

**Contract**:
- `initialDrillDisplay(configuration): DrillDisplay` — first phase, its remaining time (`null` for Standby), `next = nextDrillPhase(...)`, `paused: false`, `audioAvailable: true`.
- `buildPhaseSections(display, repetitions): PhaseSections | null` with `PhaseSections = { main: {kind:"time", text} | {kind:"standby"}; current: {name, time: string | null, detail: string}; next: {kind:"phase", name, time: string | null} | {kind:"end"} }`. `formatPhaseTime` moves here from `DrillTimerView.tsx` (`m:ss`). Returns `null` when `display.phase` is null.

#### 3. Callers of `DrillDisplay`

**File**: `src/components/timer/DrillTimer.tsx` (initial state via `initialDrillDisplay`), `src/components/timer/TimerUiPreview.tsx` (add `next` to existing display literals `:29-45`, `:327`; nothing else).

**Intent**: Keep the type-checked build green with the new required field.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including table-driven, drive-the-run, resume and no-leak tests: `npm test`
- Types pass: `npx astro check`
- Lint passes: `npm run lint`

**Implementation Note**: nothing user-visible changes in this phase, so no human gate; continue to Phase 2 after automated checks pass.

---

## Phase 2: Three-section UI

### Overview

Render the sections in the production timer view.

### Changes Required:

#### 1. `PhaseSections` component

**File**: `src/components/timer/PhaseSections.tsx`

**Intent**: Presentational component rendering the view model as three stacked sections: main (very large; `role="timer"` only for a countdown, "Standby" as plain text), current (name, fixed time, repetition/Preparing line), next (visibly distinct block using existing semantic tokens such as `bg-muted`/`border`, text clearly smaller than main).

**Contract**: props `{ sections: PhaseSections; initializing: boolean }`. While initializing the main time is not shown (as today) but current/next are. Accessible names never contain the Standby wait; the next section is a labelled group. Uses `cn()`, semantic tokens and the Tailwind scale only.

#### 2. Integrate in `DrillTimerView`

**File**: `src/components/timer/DrillTimerView.tsx`

**Intent**: Replace the `h2`/countdown/repetition block with `PhaseSections`; keep the warnings area, control bar order/size/names, status line and props unchanged.

**Contract**: `aria-label="Current drill phase"` section preserved; Cancel/Restart/Pause-Resume markup untouched.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` (timer UI contract), `npx astro check`, `npm run build` pass
- Contract rule tests pass: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual Verification:

- A real drill at `/` shows the three sections at 390 px and 1280 px, light and dark, without horizontal scroll, with controls reachable.

---

## Phase 3: Visual gate and fixtures

### Overview

Deterministic states for review, with evidence in the change folder.

### Changes Required:

#### 1. Fixtures module

**File**: `src/components/timer/PhaseSectionsFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx` (mount only)

**Intent**: Render production `DrillTimerView` with displays produced by the real `DrillRun`/`initialDrillDisplay` for: preparation → exercise; preparation → Standby; exercise → Rest; last exercise with rest 0 → Drill complete; Standby → Exercise; Rest → Standby/Exercise; last Rest → Drill complete; resume preparation → resumed repetition; paused; initializing; audio-unavailable warning.

**Contract**: no logic duplicated in fixtures; existing seven timer states and held-mounted Cancel/Restart lifecycle fixtures unchanged; nothing on the page derived from the random wait.

#### 2. Screenshots and gate notes

**File**: `context/changes/view-three-phase-sections/screenshots/` (PNG + `README.md`)

**Intent**: Screenshots of each fixture state (default, hover/focus-visible of controls, disabled/loading, warning, justified N/A for empty) in light/dark at 1280 and 390 px; README lists the checks. "Empty" is N/A with justification: `buildPhaseSections` returns `null` only for `phase: null`, which `DrillTimer` treats as completion (`onComplete`), so the view never renders an empty timer.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npx astro check`, `npm run build` pass
- Playwright against `/dev/timer-ui` (dev server): section order, "Next: …" text per fixture, no `m:ss` pattern (`/\d+:\d\d/`) in Standby main/current or "Next: Standby", no horizontal overflow at 390 px

#### Manual Verification:

- Human review of the screenshots (hierarchy of font sizes, readability, dark mode)
- Optional: a real drill on a phone and a desktop browser shows the correct next phase across a full run including a pause and resume (recorded only if a human performs it)

---

## Testing Strategy

### Unit Tests (`npm test`):

- `buildPhaseSections` table: preparation 0 / >0; rest 0 / >0; Standby on/off; first, middle and last repetition; each (current → next) pair including "Next: Standby" (no time) and "Drill complete"; current time stays fixed while `remainingSeconds` changes; PRD example (exercise 4 s, rest 2 s → "Next: Rest — 0:02").
- Drive the real `DrillRun` with the fake clock/audio harness of `drill-run.test.ts` through full drills for several configurations: at every phase change `display.next` equals the next distinct phase `display` actually shows, and is `null` exactly at the last phase.
- Pause/Resume: pause in exercise and in Standby (preparation > 0 and = 0), resume → during the resume preparation `next` is the same repetition's Standby/exercise; paused display keeps correct `next`; pausing again during the resume preparation keeps it.
- Differential no-leak: two runs with injected `random` giving a 1 s and a 5 s wait produce identical `display` + `buildPhaseSections` sequences throughout Standby (deterministic clock) until the wait ends.
- Resume extras: pause in rest and in preparation (no `resumeTarget`) leaves `next` unchanged; random Standby with injected `random` in the resume path.
- No leak: Standby main/current carry no time — `main.kind === "standby"`, `current.time === null`, and no `m:ss` pattern (`/\d+:\d\d/`) in main/current text or in "Next: Standby" (the "Repetition X of N" line legitimately contains digits); `next` for Standby has no duration; `Object.keys(display)` equals the allowed set (guards against adding wait fields).

### Integration Tests:

- None beyond the above; the repo has no DOM test runner, so rendering is covered by the Phase 3 Playwright checks (one-off evidence, not a repo regression test; stated as such).

### Manual Testing Steps:

1. Run a 0:05 / 0:04 / 0:02 × 3 drill with Random start on and off; watch the next-phase text on each transition.
2. Set preparation 0:00 and rest 0:00; confirm skipped phases never appear as "next".
3. Pause during exercise, resume; confirm the resume preparation announces the same repetition next.
4. Check dark mode and 390 px width.

## Performance Considerations

`display` is rebuilt on each tick already; computing `next` is O(1).

## Migration Notes

None (no data, no routes).

## References

- PRD: `context/foundation/prd.md` US-02, FR-005, FR-013; roadmap S-04.
- Phase logic: `src/lib/drill-timer.ts:76`, `src/lib/drill-run.ts:87`, `:175`.
- Fixture precedent: `src/components/timer/SignalPreviewFixtures.tsx`, `context/changes/preview-phase-signals/handoff.md`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Display model and view model (src/lib)

#### Automated

- [x] 1.1 Unit tests pass, including table-driven, drive-the-run, resume and no-leak tests: `npm test`
- [x] 1.2 Types pass: `npx astro check`
- [x] 1.3 Lint passes: `npm run lint`

### Phase 2: Three-section UI

#### Automated

- [ ] 2.1 `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 2.2 Contract rule tests pass: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual

- [ ] 2.3 A real drill at `/` shows three sections at 390 px and 1280 px, light and dark, without horizontal scroll

### Phase 3: Visual gate and fixtures

#### Automated

- [ ] 3.1 `npm test`, `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 3.2 Playwright against `/dev/timer-ui`: section order, "Next: …" per fixture, no `m:ss` pattern in Standby main/current or "Next: Standby", no overflow at 390 px

#### Manual

- [ ] 3.3 Human review of the screenshots in the change folder
- [ ] 3.4 Optional manual: real-device drill with pause and resume shows the correct next phase (recorded only if performed)
