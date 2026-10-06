# Preview phase signals — Plan Brief

> Full plan: `context/changes/preview-phase-signals/plan.md`

## What & Why

Let users hear the Exercise, Rest and Standby signals next to their settings and read what each means, before starting (FR-004, US-01). Removes surprise from unlabelled beeps.

## Starting Point

Signals exist only inside a running drill (`DrillRun` → `DrillAudioPort`). The configuration form has no audio.

## Desired End State

Play buttons with meaning text under Exercise, Rest and Random start; Preparation says it has no sound; Rest 0 s and Standby-off are disabled with a reason; audio failure shows an inline message.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Same signals | One cue-sequence helper, tested against `DrillRun` | Explanation always matches the drill |
| Unavailable signal | Disabled with reason text, not hidden | Stable layout, explains why |
| Standby with toggle off | Disabled | FR-004 ties it to the option being set |
| Audio lifetime | One lazy context per form, released on Start/unmount | No overlap with the drill's own audio |
| Fixtures | Inject audio factory into production form | Visual gate uses real components |

## Scope

**In scope:** helper + tests, hook, control, form integration, `/dev/timer-ui` fixtures, screenshots.

**Out of scope:** preparation/0 s rest signals, new sounds, Bluetooth sync, colors, persistence.

## Architecture / Approach

Pure lib → hook (gesture-time audio) → control component → form; fixtures reuse `FixtureAudio`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Library | Cue helper, availability, tests | Drift from `DrillRun` (covered by test) |
| 2. Form UI | Buttons, meaning text, audio lifecycle | Audio unlock in gesture; overlap with run |
| 3. Visual gate | Fixtures + screenshots | Timer UI contract lint; large preview file |

**Prerequisites:** S-02 done. **Estimated effort:** ~3 sessions.

## Open Risks & Assumptions

- Audible output can only be verified by a human on real devices.
- Assumes Standby button is disabled (not hidden) when Random start is off.

## Success Criteria (Summary)

- The user hears the same cues the drill plays and sees their meaning; all gates and screenshots pass.
