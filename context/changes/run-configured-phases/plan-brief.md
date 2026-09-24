# Run Configured Phases — Plan Brief

> Full plan: `context/changes/run-configured-phases/plan.md`

## What & Why

S-01 supplies the first working DryFire timer: a guest configures phase times and repetitions, then runs preparation once when positive and every exercise; rest follows each exercise only when its duration is positive. This dependable base makes later random Standby and signals easier to add and diagnose.

## Starting Point

The public home page still shows the Astro starter welcome screen. Authentication exists, but no timer settings, phase model, or countdown exists in the codebase.

## Desired End State

At `/`, a guest first sees a configuration view with editable times, repetitions, and Start. It begins with `0:05` preparation, `0:04` exercise, `0:02` rest, and 3 repetitions, using strict `m:ss` for time entry. Valid Start replaces the form with a running view on the same address; that view shows the current phase, countdown, and repetition. The completed view says “Completed” after the final positive rest or directly after the final exercise when rest is `0:00`, and offers a return to configuration with the last-used values. All user-facing text is English.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Numeric limits | Preparation/rest 0–600 s; exercise 1–600 s; repetitions 1–100; whole seconds | Defines the validated inputs | PRD FR-001 |
| Time entry | Strict `m:ss`, e.g. `0:05`, `3:15`, `10:00`; reject `5`, `3:5`, and seconds ≥ 60 | Gives one unambiguous entry format | Plan interview |
| Sequence | Preparation once when positive; each exercise has rest only when rest is positive; skip every rest at `0:00` | Matches the updated full-run outcome | PRD FR-003 / roadmap S-01 |
| Defaults | `0:05`/`0:04`/`0:02`/3 | Runs the short PRD example immediately | Plan interview |
| Invalid fields | Retain the entry, show an error at that field, block start | Makes the correction clear | Plan interview |
| Screen flow | Configuration → running → completed on `/`; the form and timer are never shown together | Matches the requested separate views | Plan clarification |
| Settings during run | Freeze a validated snapshot | Prevents mid-run duration changes | Plan interview |
| Completion | Show “Completed” after final positive rest or final exercise when rest is `0:00`, then allow return to settings | Makes the last actual phase explicit | Plan interview; updated rest rule |
| Return values | Restore the last-used time and repetition values until reload | Makes a later adjustment quick | Plan clarification |
| Next phase | No next-phase preview in S-01; S-04 adds it | Follows the roadmap slice boundary | Roadmap S-04 |
| UI language | English for all user-facing labels, errors, navigation, and warnings | Keeps the app consistent across current and future slices | PRD / Plan correction |
| Hidden tab | S-01 accepted in a visible active tab; S-06 adds full background pause/resume | Keeps the roadmap boundary clear | Plan interview / roadmap S-06 |
| Delivery | Three phases: model, form, running view | Keeps each implementation step focused | Plan interview |

## Scope

**In scope:** Separate configuration and running views at `/`, guest configuration with strict `m:ss` time entry, field-level validation, deterministic phase progression, current phase and remaining time, repetition indicator, completed view with return to last-used values, responsive public page, and English copy for the existing configuration warning.

**Out of scope:** Standby/random delay, audio, next-phase preview and three-section layout, colors, pause/resume, cancel/restart controls, saved configurations, and persistence on reload.

## Architecture / Approach

Pure TypeScript owns validation and the phase sequence. One React island on Astro's public `/` page holds editable values and switches between mutually exclusive configuration, running, and completed views. The running timer reads one immutable settings snapshot and measures phases against monotonic deadlines rather than interval counts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Phase model and validation | Shared types, bounds, sequence, focused model checks | Off-by-one when rest is skipped |
| 2. Configuration form | `m:ss` defaults, field errors, valid settings handoff | Accidental format coercion |
| 3. Public timer and completion flow | Responsive countdown at `/` and completed state | Drift or incorrect transitions |

**Prerequisites:** Existing Astro/React app and roadmap S-01; no data migration or login.
**Estimated effort:** Three focused implementation sessions, one per phase, plus desktop and phone acceptance.

## Open Risks & Assumptions

- A browser may delay callbacks when the tab is hidden; S-01 acceptance uses a visible tab, and S-06 owns the specified background pause behavior.
- Existing HTTP smoke checks cannot observe a client-side countdown; the phase model checks and browser acceptance cover that behavior.

## Success Criteria (Summary)

- 0 s preparation starts at exercise 1; positive preparation occurs once.
- Every repetition includes exercise; a positive rest follows each exercise, including repetition N. Rest `0:00` is skipped throughout, and “Completed” follows exercise N.
- Valid Start replaces the form with the timer on `/`; return from completion restores the last-used values, and the S-01 timer has no next-phase preview.
- All app screens and messages visible in S-01 use English.
- Invalid settings never start a run; the form and timer remain usable on desktop and phone.
