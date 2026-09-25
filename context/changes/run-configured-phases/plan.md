# Run Configured Phases — Implementation Plan

## Overview

Deliver roadmap slice S-01: an anonymous user configures preparation, exercise, rest, and repetitions, then runs every phase without random start. This establishes a dependable phase sequence for later Standby, signals, and pause work.

## Current State Analysis

The public home page is the starter welcome screen (`src/pages/index.astro:2-8`, `src/components/Welcome.astro:7-24`). There is no timer model, configuration form, or running view. React islands already handle interactive forms (`src/pages/auth/signin.astro:2-10`), and only `/dashboard` is protected (`src/middleware.ts:4`). CI runs lint, Astro check, build, and an auth smoke test (`.github/workflows/ci.yml:12-18`, `scripts/smoke.mjs:32-57`).

## Desired End State

At `/`, a guest first sees a configuration view containing editable time and repetition fields and a Start button. Its initial settings are `0:05` preparation, `0:04` exercise, `0:02` rest, and 3 repetitions. Time entry uses strict `m:ss`: a nonnegative minute count without a leading zero and exactly two second digits from `00` to `59`; `10:00` is the maximum. The form accepts preparation and rest 0–600 s, exercise 1–600 s, and integer repetitions 1–100. Invalid entries retain their values, show field-specific errors, and keep the configuration view open. A valid Start replaces the entire form view on the same `/` address with a running view and locks a snapshot of the settings. The run performs preparation once unless it is 0 s, then exactly the configured number of exercise phases; each is followed by rest when rest is positive. Rest `0:00` is skipped in every repetition, including the last. The running view displays the current phase, remaining time, and repetition, without a next-phase preview in S-01. After the final positive rest, or directly after the final exercise when rest is `0:00`, a completed view clearly says “Completed” and offers a return to configuration, which retains the most recently used values until page reload. All user-facing copy is English, including labels, errors, navigation, and the existing configuration warning. Acceptance of S-01 covers an uninterrupted run in a visible browser tab on phone and desktop.

### Key Discoveries:

- The roadmap assigns random Standby and phase signals to S-02, the three-section display to S-04, pause to S-06, cancellation to S-07, and restart to S-08 (`context/foundation/roadmap.md:43-50`, `:98-182`).
- PRD FR-001 and FR-003 fix the numeric bounds, skipped 0 s preparation and rest, single preparation, and the final positive rest (`context/foundation/prd.md:108-113`).
- Existing interactive components use React with `client:load`; no product timer or test runner exists (`src/pages/auth/signin.astro:2-10`, `package.json:5-13`).
- The existing configuration warning contains Polish copy in `src/layouts/Layout.astro:24` and `src/lib/config-status.ts:15-17`; S-01 must align it with the product-wide English UI rule.

## What We're NOT Doing

- Random start, Standby, audio signals, or signal previews (S-02/S-03).
- Next-phase preview and the three-section layout belong to S-04; phase colors belong to S-05.
- Pause/resume, background behavior, cancel, and restart controls (S-06/S-08). S-01 acceptance is limited to a visible active tab; full background behavior is planned for S-06.
- Saving configurations, authentication changes, database tables, API routes, and persistence across reloads.

## Implementation Approach

Keep configuration parsing and phase progression in browser-independent TypeScript helpers. Build separate configuration and running React views inside one island on the existing public Astro page. The island owns editable form values across view changes and gives the run an immutable configuration snapshot. A valid Start replaces the form with the timer without changing the URL; completion shows its own state before returning to the saved form values. Timekeeping should use a monotonic clock and phase deadlines so display updates do not determine phase duration; a delayed render must not add time to a phase. The sequence helper must expose phase kind and repetition explicitly so S-02 can insert Standby before each exercise without changing the meaning of completed cycles.

## Phase 1: Phase model and validation

### Overview

Define the configuration and deterministic phase sequence before wiring a browser view.

### Changes Required:

#### 1. Shared configuration and run types

**File**: `src/types.ts`

**Intent**: Give configuration and active phase one shared vocabulary for the form and runner.

**Contract**: Export typed configuration fields `preparationSeconds`, `exerciseSeconds`, `restSeconds`, `repetitions`; phase kinds `preparation | exercise | rest`; and a phase position containing a repetition number for exercise/rest. Do not add Standby to the S-01 runtime.

#### 2. Validation and phase sequence

**File**: `src/lib/drill-timer.ts`

**Intent**: Centralize numeric validation and the exact sequence required by FR-001/FR-003 so UI components cannot diverge.

**Contract**: Parse three raw time strings in strict `m:ss` into whole seconds and repetitions as a base-10 whole number, without coercing blank, bare seconds (`5`), malformed time (`3:5`), seconds of 60 or more, decimal, negative, nonnumeric, or out-of-range input. Canonical entries range from `0:00` to `10:00`; `0:00` is allowed for preparation and rest, never exercise. Return field-specific errors or a valid configuration. Provide a deterministic phase progression contract: preparation once when positive; otherwise exercise 1 immediately; each exercise is followed by rest of the same repetition only when rest is positive; after exercise N with rest 0 s, or rest N with positive rest, report completion. Expose configured duration and repetition for each actual phase.

#### 3. Focused model checks

**File**: `src/lib/drill-timer.test.ts`; `package.json`

**Intent**: Make phase-order and boundary regressions detectable before browser integration.

**Contract**: Use Node's built-in test runner through an npm script. Cover `0:00` versus positive preparation and rest, 1 and 100 repetitions, the final positive rest, completion immediately after exercise N with rest `0:00`, valid `m:ss` bounds including `10:00`, and rejected `5`, `3:5`, `0:60`, and out-of-range inputs. Keep this test independent of Astro, Supabase, and browser APIs.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes the model cases, including skipped preparation/rest at `0:00`, final positive rest, strict `m:ss`, and numeric boundaries.
- `npm run lint` and `npx astro check` pass after the new types and helper are added.

---

## Phase 2: Configuration form

### Overview

Build the accessible form that validates settings and hands one immutable configuration to the runner.

### Changes Required:

#### 1. Timer configuration component

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: Let guests enter all four S-01 values and understand errors beside the affected fields.

**Contract**: Receive editable values initialized to `0:05`/`0:04`/`0:02`/3 by the owning app view; use English labels and field-level error messages, labeled time fields with `type="text"` and `inputMode="text"` so the keyboard supports entering `:`, a labeled whole-number repetition field, and a Start button. State the `m:ss` format and FR-001 ranges. On submission, call the phase-model parser; retain invalid entries and the configuration view, show field-specific errors, and emit only a valid immutable configuration via a typed callback. The form is absent while a run is active.

### Success Criteria:

#### Automated Verification:

- `npm run test` continues to pass the shared parser and phase sequence cases.
- `npm run lint` and `npx astro check` pass with the form component.

---

## Phase 3: Public timer and completion flow

### Overview

Replace the starter home with a complete, responsive S-01 timer flow.

### Changes Required:

#### 1. Running view and clock lifecycle

**File**: `src/components/timer/DrillTimer.tsx`

**Intent**: Show a reliable live countdown and the exact current phase until the last configured phase completes.

**Contract**: Accept a validated configuration snapshot, show English phase names (Preparation, Exercise, Rest), remaining whole seconds, and current repetition, and advance using the Phase 1 sequence. Do not show the next phase or its time in S-01. Timing uses monotonic elapsed time rather than counting interval callbacks. A run with preparation 0 s begins at exercise 1. Rest `0:00` never appears as a displayed phase; after exercise N the run completes directly. With positive rest, completion follows rest N. Cleanup scheduled callbacks when the component unmounts.

#### 2. Public entry point

**File**: `src/pages/index.astro`; `src/components/timer/DrillApp.tsx`; `src/layouts/Layout.astro` if needed for page title/language

**Intent**: Make the timer the main public experience while preserving the established Astro SSR layout.

**Contract**: Mount the timer React island with `client:load` at `/`. Render mutually exclusive configuration, running, and completed views with English user-facing copy and no URL change. A valid Start replaces the form with the timer; invalid input remains on the form. The completed view shows “Completed” and an action to return to configuration. Keep the last submitted editable values in the island across view changes, but not across page reloads. Keep controls usable on phone and desktop without horizontal scroll. Keep route public and do not send timer settings through server environment fields.

#### 3. Existing configuration warning

**File**: `src/layouts/Layout.astro`; `src/lib/config-status.ts`

**Intent**: Remove the Polish warning encountered when the public app lacks Supabase configuration.

**Contract**: Translate the warning prefix, message, and documentation link label to English without changing configuration detection or server-only secret handling. Keep `<html lang="en">`.

#### 4. Product flow acceptance

**File**: `scripts/smoke.mjs` only if a stable HTTP-level assertion is useful; otherwise no change

**Intent**: Keep the production preview smoke path useful after replacing the starter page.

**Contract**: The existing home 200 check must continue to pass. Browser acceptance covers the interactive timer because HTTP smoke cannot observe client timing.

### Success Criteria:

#### Automated Verification:

- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass.
- The existing `npm run smoke` home check still returns 200 against a running production preview when its local Supabase prerequisites are available.

#### Manual Verification:

- In a visible desktop browser, default `0:05`/`0:04`/`0:02`/3 runs as preparation once, then three exercise/rest pairs, and shows “Completed” only after rest 3; returning to settings works.
- Preparation `0:00` with one repetition starts at exercise 1 and completes after its positive rest; exercise `0:01`–`10:00`, rest `0:00`–`10:00`, and 1–100 repetitions remain enforceable.
- Empty, bare seconds (`5`), malformed `m:ss` (`3:5`, `0:60`), negative, nonnumeric, and out-of-range values show the affected field's error, retain the entry, and do not start the timer.
- On a phone viewport, fields and the active countdown remain readable and usable without horizontal scrolling.
- Configuration, active run, completion, validation errors, and the missing-Supabase warning use English user-facing text.
- At `/`, the configuration form and running timer never appear together: valid Start replaces the form, invalid Start keeps it visible, and return from “Completed” restores the last-used values.
- The S-01 running view shows the current phase, countdown, and repetition without a next-phase preview.
- With preparation `0:00`, exercise `0:01`, rest `0:00`, and two repetitions, the visible sequence is Exercise 1 → Exercise 2 → “Completed”, with no Rest view.
- On a real phone browser, enter a complete `m:ss` value including `:`, correct an invalid entry, and start the timer successfully using the on-screen keyboard.

**Implementation Note**: After automated verification, obtain human confirmation of the browser checks before closing this phase.

---

## Testing Strategy

### Unit Tests:

- Exercise the pure phase progression and parser at their boundaries, especially preparation and rest `0:00`, strict `m:ss` entry, completion after exercise N with no rest, and the final positive rest.
- Use Node's built-in runner to avoid adding a test dependency for the model.

### Integration Tests:

- Existing CI lint, Astro check, build, and local production-preview smoke remain the repository gates. The smoke script checks server responses, not client-side timing.

### Manual Testing Steps:

1. Run the `0:05`/`0:04`/`0:02`/3 configuration to completion in a visible desktop tab; observe every transition, English phase labels, and “Completed” after final rest.
2. Run `0:00`/`0:01`/`0:01`/1 and verify exercise begins immediately, followed by one rest and completion.
3. Run `0:00`/`0:01`/`0:00`/2 and verify Exercise 1 → Exercise 2 → “Completed” with no Rest view.
4. Try `5`, `3:5`, `0:60`, empty, and out-of-range values in the time fields and verify that each field keeps its input while start is prevented.
5. Repeat the short flow in a browser on a real phone and confirm readable layout without horizontal scroll. Using the on-screen keyboard, enter a complete `m:ss` value including `:`, correct an invalid entry, and start the timer successfully. Record the phone/browser used; viewport emulation alone does not satisfy this check.
6. Check English labels and errors throughout the flow; inspect the missing-Supabase warning with credentials absent.
7. Confirm the form disappears after valid Start, no next-phase panel appears during S-01, and return from “Completed” restores the last-used values on `/`.

## Performance Considerations

The maximum configured run lasts up to 120,600 seconds (600 s preparation plus 100 × (600 s exercise + 600 s rest)). Store phase deadlines using a monotonic clock and derive displayed remaining time from them; interval throttling must not extend durations. S-01 acceptance covers an uninterrupted visible tab; S-06 owns background pause/resume behavior.

## Migration Notes

No database or API migration. The public `/` page replaces starter content; existing authentication routes and dashboard remain available. Timer settings are in memory only.

## References

- `context/foundation/roadmap.md` — S-01 and boundaries with S-02–S-08.
- `context/foundation/prd.md` — US-01, FR-001, FR-003, FR-005, and browser quality requirements.
- `context/foundation/shape-notes.md` — updated optional-rest and no-persistence decisions.
- `src/pages/index.astro:2-8`, `src/pages/auth/signin.astro:2-10`, `src/middleware.ts:4`, `.github/workflows/ci.yml:12-18` — implementation entry and checks.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Phase model and validation

#### Automated

- [x] 1.1 `npm run test` passes the model cases, including skipped preparation/rest at `0:00`, final positive rest, strict `m:ss`, and numeric boundaries. — d30e1be
- [x] 1.2 `npm run lint` and `npx astro check` pass after the new types and helper are added. — d30e1be

### Phase 2: Configuration form

#### Automated

- [x] 2.1 `npm run test` continues to pass the shared parser and phase sequence cases. — 39972c5
- [x] 2.2 `npm run lint` and `npx astro check` pass with the form component. — 39972c5

### Phase 3: Public timer and completion flow

#### Automated

- [x] 3.1 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass.
- [x] 3.2 The existing `npm run smoke` home check still returns 200 against a running production preview when its local Supabase prerequisites are available.

#### Manual

- [x] 3.3 In a visible desktop browser, default `0:05`/`0:04`/`0:02`/3 runs as preparation once, then three exercise/rest pairs, and shows “Completed” only after rest 3; returning to settings works.
- [x] 3.4 Preparation `0:00` with one repetition starts at exercise 1 and completes after its positive rest; exercise `0:01`–`10:00`, rest `0:00`–`10:00`, and 1–100 repetitions remain enforceable.
- [x] 3.5 Empty, bare seconds (`5`), malformed `m:ss` (`3:5`, `0:60`), negative, nonnumeric, and out-of-range values show the affected field's error, retain the entry, and do not start the timer.
- [x] 3.6 On a phone viewport, fields and the active countdown remain readable and usable without horizontal scrolling.
- [x] 3.7 Configuration, active run, completion, validation errors, and the missing-Supabase warning use English user-facing text.
- [x] 3.8 At `/`, the configuration form and running timer never appear together: valid Start replaces the form, invalid Start keeps it visible, and return from “Completed” restores the last-used values.
- [x] 3.9 The S-01 running view shows the current phase, countdown, and repetition without a next-phase preview.
- [x] 3.10 With preparation `0:00`, exercise `0:01`, rest `0:00`, and two repetitions, the visible sequence is Exercise 1 → Exercise 2 → “Completed”, with no Rest view.
- [x] 3.11 On a real phone browser, enter a complete `m:ss` value including `:`, correct an invalid entry, and start the timer successfully using the on-screen keyboard.
