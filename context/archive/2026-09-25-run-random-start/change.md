---
change_id: run-random-start
title: Run random start
status: archived
created: 2026-09-25
updated: 2026-09-28
archived_at: 2026-09-28T21:34:09Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Desktop Chrome and Chrome on iPhone 15 Pro Max: the user confirmed the phase flow and signals through device speakers; Bluetooth headphones had noticeable output delay relative to the view. Unit checks of programmed Web Audio timing passed but do not measure physical emission. Bluetooth alignment is tracked separately as roadmap slice S-14 (`align-bluetooth-audio`).

- Chrome DevTools audio-failure check: the following console script suspended every newly created `AudioContext` after 3 seconds. Sound stopped and the visible audio-failure message appeared.

  ```js
  const Base = window.AudioContext;
  window.AudioContext = class extends Base {
      constructor(...args) {
          super(...args);
          setTimeout(() => void this.suspend(), 3000);
      }
  };
  ```

- Chrome visibility check: after leaving and returning to the timer tab, the paused message and Resume button appeared. Pressing Resume continued the current repetition as intended.
- Chrome acceptance run on local app with preparation `0:05`, exercise `0:04`, rest `0:02`, three repetitions, and random start on: the `drill-audio-schedule` performance mark reported `allExpectedCuesScheduled: true`, `withinTolerance: true`, `signalCount: 12`, `maxDifferenceMs: 0`, and `physicalSpeakerOutputMeasured: false`. The table below is the user's console output; starts are rounded to 0.001 s and differences to whole milliseconds, so displayed 0 ms does not prove mathematically exact equality.

  | # | Signal | Expected start (s) | Scheduled start (s) | Difference (ms, rounded) |
  | --- | --- | ---: | ---: | ---: |
  | 0 | standby-first | 18.355 | 18.355 | 0 |
  | 1 | standby-second | 18.655 | 18.655 | 0 |
  | 2 | exercise | 23.065 | 23.065 | 0 |
  | 3 | rest | 27.065 | 27.065 | 0 |
  | 4 | standby-first | 29.065 | 29.065 | 0 |
  | 5 | standby-second | 29.365 | 29.365 | 0 |
  | 6 | exercise | 33.585 | 33.585 | 0 |
  | 7 | rest | 37.585 | 37.585 | 0 |
  | 8 | standby-first | 39.585 | 39.585 | 0 |
  | 9 | standby-second | 39.885 | 39.885 | 0 |
  | 10 | exercise | 41.515 | 41.515 | 0 |
  | 11 | rest | 45.515 | 45.515 | 0 |

  This verifies the programmed Web Audio schedule for this one run. It does not measure when sound was physically emitted, including through Bluetooth headphones.
