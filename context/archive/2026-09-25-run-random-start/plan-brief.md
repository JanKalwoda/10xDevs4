# Run Random Start — Plan Brief

> Full plan: `context/changes/run-random-start/plan.md`

## What & Why

S-02 makes the timer's exercise start unpredictable. Each repetition gets its own hidden 1–5 s wait after two Standby sounds, followed by a long exercise-start signal; positive rest starts with a short signal. This is the first complete timer flow addressing the project's central problem.

## Starting Point

S-01 already provides a public form, validated phase settings, an uninterrupted preparation/exercise/rest sequence, and a countdown at `/`. It is implemented and merged even though its roadmap status still reads `in-progress`. There is no Standby, random-start option, audio, or hidden-page handling.

## Desired End State

A guest can enable fixed-range random start in the form. Each exercise has a new hidden wait that begins only after both Standby sounds finish; exercise and positive rest have distinct start signals. If audio fails, the run continues silently with a warning. Hiding the page pauses the run and sound until manual Resume. The existing view says `Standby` without a countdown; the next-phase display remains in S-04.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Random range | Inclusive 1.00–5.00 s in 0.01 s steps, separately sampled before every exercise | Keeps the start unpredictable without more settings | PRD FR-002 |
| Wait anchor | End of the second Standby sound; silent fallback starts at Standby entry | Sound time never consumes the sampled wait | PRD; plan interview |
| Signals | Two short Standby sounds, one long exercise sound, one short positive-rest sound; no preparation or skipped-rest sound | Makes actual phase transitions audible | PRD FR-004 |
| Audio failure | Continue silently with an English warning; before the second Standby sound ends start the full sampled wait at failure, afterward preserve its remainder; retain remaining exercise/rest time | Keeps the timer usable without mixing clock timestamps | Plan interview; plan review F3 |
| Hidden page | Stop audio and progression; require manual Resume with completed repetitions retained | Prevents late background cues | Plan interview; PRD FR-006 |
| Resume position | Store the interrupted repetition explicitly; after full positive preparation return to that repetition, including 2 or later; interrupted preparation/rest retains remaining time | Prevents the normal preparation-to-repetition-1 rule from losing progress | PRD FR-006; plan review F2 |
| Preview boundary | Show Standby without a countdown; defer next-phase/three-section display to S-04 | Keeps the roadmap slice focused | Plan interview; roadmap S-04 |
| Timing evidence | Compare programmed Web Audio times to expected times; no physical recording | Gives repeatable schedule evidence | Plan interview |
| Delivery | Three phases: model/form, audio/timeline, integration/acceptance | Separates sequence correctness from browser behavior | Plan interview |

## Scope

**In scope:** Random-start control, per-repetition Standby, phase signals, silent warning, hide/resume behavior needed for S-02, desktop and real-phone acceptance, programmed audio schedule checks.

**Out of scope:** Signal preview (S-03), next-phase panels (S-04), colors (S-05), user pause/cancel/restart controls (S-06–S-08), persistence, customizable wait range, physical speaker-output measurement.

## Architecture / Approach

Phase 1 adds the switch and injected centisecond sampler without changing the current timer's phase type. Phase 2 adds Standby and adapts the timer in the same step; a run controller schedules cues and phase boundaries on a monotonic timeline, anchored after the second Standby cue. Web Audio starts from the Start gesture in Phase 3; a silent clock path handles unavailable audio. The React view displays run state, never determining when cues begin. Page visibility pauses and cancels scheduled sources.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Random-start model and configuration | Switch, exact sampling, S-01 compatibility | Range and parser regression |
| 2. Signal and timeline engine | Standby sequence, compatible timer, Web Audio schedule, silent fallback, hide/resume | Cue timing and stale scheduled sounds |
| 3. Running view integration and acceptance | Standby UI, warnings, desktop/phone flow | Browser-specific audio behavior |

**Prerequisites:** Implemented S-01 code on the current branch; a desktop and real phone browser for manual acceptance.
**Estimated effort:** Three focused implementation sessions plus browser acceptance.

## Open Risks & Assumptions

- Programmed timestamps cannot establish when sound physically leaves the speaker. The PRD's ≤0.2 s physical-emission requirement remains unverified under the chosen acceptance method; do not report it as passed.
- Manual acceptance found noticeable delay relative to the view with Bluetooth headphones on desktop and iPhone 15 Pro Max; device speakers sounded timely. Roadmap S-14 (`align-bluetooth-audio`) owns a separate follow-up for wireless output alignment and physical timing evidence.
- Browser audio can be suspended or interrupted. The plan rebases remaining time onto the silent clock at failure and requires a visible warning and verification in the recorded desktop/phone browsers.
- Hiding the page introduces only the pause behavior needed here; S-06 still owns a user-operated pause control and broader pause UX.

## Success Criteria (Summary)

- Every enabled repetition has its own hidden 1.00–5.00 s Standby wait after two sounds, then a full exercise and any positive rest with their proper signals.
- Zero rest produces no rest phase or sound; random start off preserves the S-01 sequence while exercise and positive rest still signal.
- Audio failure shows a warning and continues silently; a hidden page stops progression/sound and resumes manually at the correct position.
