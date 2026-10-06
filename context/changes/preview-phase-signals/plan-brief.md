# Preview phase signals — Plan Brief

> Full plan: `context/changes/preview-phase-signals/plan.md`
> Plan review: `context/changes/preview-phase-signals/reviews/plan-review.md` (F1–F8 accepted)

## What & Why

Let users hear the Exercise, Rest and Standby signals next to their settings and read what each means, before starting (FR-004, US-01). Removes surprise from unlabelled beeps.

## Starting Point

Signals exist only inside a running drill (`DrillRun` → `DrillAudioPort`). The configuration form has no audio.

## Desired End State

Play buttons with meaning text under Exercise, Rest and Random start; Preparation says it has no sound; Rest 0 s/invalid disables the Rest button with a visible reason; Standby is always playable; audio failure shows an alert and the next click retries.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Same signals | One cue-sequence helper, tested against `DrillRun` | Explanation always matches the drill |
| Lifecycle | Pure controller in `src/lib` (idle/initializing/playing/unavailable), thin hook | Testable by `npm test`; handles gesture, dead port, retry |
| Standby | Always enabled; Random start state only as text | FR-004; user must hear it to decide |
| Rest | Disabled for 0 s and for invalid, with distinct texts | Honest messages; `parseDrillTime` exported |
| Buttons | `type="button"` | Must not submit the form |
| Fixtures | Separate module, injected timer/audio | Deterministic loading/playing states |
| End time | From last `ScheduledCue.end` | Accounts for clamped start |

## Scope

**In scope:** lib helpers + controller + tests, hook, control, form integration, fixtures module, screenshots.

**Out of scope:** preparation/0 s rest signals, new sounds, Bluetooth sync, colors, persistence.

## Architecture / Approach

Pure lib (catalogue, availability, controller) → thin hook (`useSyncExternalStore`) → control component → form; fixtures reuse `FixtureAudio` with an injected manual timer.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Library + controller | Cue helper, availability, lifecycle state machine, tests | Drift from `DrillRun` (covered by test) |
| 2. Form UI | Buttons, texts, alerts, tab stops | Audio unlock in gesture; overlap with run |
| 3. Visual gate | Fixtures module + screenshots | Timer UI contract lint |

**Prerequisites:** S-02 done. **Estimated effort:** ~3 sessions.

## Open Risks & Assumptions

- Audible output and Safari/iOS behaviour can only be verified by a human on real devices.

## Success Criteria (Summary)

- The user hears the same cues the drill plays and sees their meaning; all gates and screenshots pass.
