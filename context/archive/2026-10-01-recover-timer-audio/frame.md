# Frame Brief: Recover timer audio after phone lock

## Reported Observation

„Po implementacji wszystkich faz, ręczne testy wykazały, że na telefonie w momencie, gdy timer działa i zablokuje telefon, po powrocie przestaje działać dźwięk. Normalnie mogę... widzę guzik resume, mogę wznowić działanie timera, ale już bez działania dźwięków. Testuję na iPhonie w przeglądarce Chrome”.

## Initial Framing (preserved)

- **User's stated cause or approach**: None; this is an observation, not a proposed diagnosis.
- **User's proposed direction**: Investigate the reported regression; no implementation approach specified.
- **Pre-dispatch narrowing**: “Tak, odlicza poprawnie bez dźwięków”; “Tak” to whether reload and a new workout restore audio.

## Dimension Map

1. **Audio lifecycle** — a temporary context interruption may be classified as permanent unavailability.
2. **Resume integration** — the user action may resume the timer without recovering audio.
3. **Clock mapping** — a suspended audio clock may diverge from the timer's performance clock.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Temporary interruption permanently disables scheduling | `src/lib/drill-audio.ts:91` reports every non-running state as unavailable; `src/lib/drill-run.ts:164` latches `silent = true`; no recovery clears it | STRONG |
| Resume restores timer without unlocking audio | `src/components/timer/DrillTimer.tsx:83` only calls `run.resume()`; `src/lib/drill-run.ts:141` rebuilds the timeline without audio recovery; audio port at `src/lib/drill-audio.ts:31` has no recovery method | STRONG |
| Existing clock mapping would delay recovered cues | `src/lib/drill-audio.ts:77` fixes the performance/audio anchor at creation; scheduling at line 104 reuses it. A frozen audio clock would require a fresh mapping | STRONG structural risk; not measured on the device |
| Countdown itself fails to resume | User explicitly confirms correct countdown after Resume; existing pause/resume tests exercise timeline preservation | NONE for the reported symptom |

## Narrowing Signals

- Countdown works after Resume, isolating the visible failure to audio.
- Reload and a new workout restore sounds, consistent with new audio context and run state.
- Both independent read-only investigations identified the permanent silent latch and missing audio recovery.
- The exact device AudioContext state and event order have not been captured.

## Cross-System Convention

[MDN: BaseAudioContext state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state) documents interruption after leaving an iOS Safari page or turning off the screen and the need to resume audio. This supports the interruption hypothesis; it is not a direct trace from the user's Chrome session.

Archived acceptance notes in `context/archive/2026-09-25-run-random-start/change.md` tested forced audio suspension and visibility-based pause/resume separately. They do not record combined phone-lock/audio-recovery acceptance. This explains why previous checks could pass with this gap.

## Reframed Problem Statement

> The timer has no path to recover audio after a temporary browser interruption when the user resumes the workout.

The interruption is treated as an irreversible audio failure. Resuming the countdown leaves that state intact. Audio clock synchronization is also part of recovery correctness: restoring a context alone may leave newly scheduled signals delayed.

## Confidence

**HIGH** for the missing recovery path and permanent silent latch, based on code and user confirmation. **MEDIUM** for the precise iPhone runtime sequence until device reproduction or instrumentation records it.

## What Changes for /10x-plan

Plan around user-triggered audio recovery and synchronized scheduling after an interruption, preserving existing pause/resume phase semantics and graceful behavior if recovery fails. Acceptance must combine phone lock, Resume, audible subsequent cues, and repeated lock cycles on the affected iPhone; desktop tests cannot establish physical speaker output.

## References

- `src/lib/drill-audio.ts:31`, `:63`, `:77`, `:91`, `:104`
- `src/lib/drill-run.ts:71`, `:141`, `:161`, `:164`
- `src/components/timer/DrillTimer.tsx:83`
- `src/lib/drill-run.test.ts:197`, `:247`
- `context/archive/2026-09-25-run-random-start/change.md`
- Investigation tasks: `/root/audio_interruption`, `/root/resume_timeline` (read-only)
