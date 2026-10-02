# Recover timer audio — Plan Brief

Full plan: `context/changes/recover-timer-audio/plan.md`
Frame: `context/changes/recover-timer-audio/frame.md`

## What & Why

The timer has no path to recover audio after a temporary browser interruption when the user resumes the workout. Restore cues without requiring a page reload.

## Starting Point

Resume rebuilds only the countdown. Audio interruption permanently sets silent mode, and reusing the original audio clock mapping would risk delayed cues.

## Desired End State

Resume creates fresh audio in the user gesture, restores subsequent cues when available, and preserves silent fallback if recovery fails. Hide/stop invalidate pending recovery.

## Key Decisions Made

| Decision          | Choice                                     | Why                                                            | Source       |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------ |
| Recovery boundary | Resume user gesture                        | Matches current pause flow and browser activation requirements | Frame / Plan |
| Context lifecycle | Fresh port                                 | Avoids stuck context and stale anchor                          | Plan         |
| Failure           | Bounded initialization and silent fallback | Countdown remains usable                                       | Plan         |

## Scope

Recovery, lifecycle races, existing pause semantics, and regression tests. Background playback and visual changes are excluded.

## Architecture / Approach

DrillTimer passes the audio factory to DrillRun, which installs only the latest valid result and rebuilds the paused timeline. The new port supplies fresh clock mapping.

## Phases at a Glance

One phase delivers recovery and automated verification; iPhone physical audio acceptance remains manual.

## Open Risks & Assumptions

Device audio behavior cannot be proven by desktop mocks; verify repeated locks on the affected iPhone.

## Success Criteria

Resume restores audible cues without reload, keeps phase/repetition behavior, and handles failed or stale recovery safely.
