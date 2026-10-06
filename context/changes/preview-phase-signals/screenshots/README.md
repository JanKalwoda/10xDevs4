# Phase 3 visual gate — preview-phase-signals (S-03)

Captured on 2026-10-06 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`) with temporary Playwright 1.63 and Chromium from the shared user cache (outside repository dependencies). Element screenshots of the production `DrillConfigForm` inside the `SignalPreviewFixtures` cards, at 1280×800 and 390×844, light and dark. Audio is injected (`createAudio` fixtures), so no sound is produced and nothing depends on the real clock.

| File prefix          | State                                                                  | How reached                                     |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `default-*`          | default; Random start off note and "Preparation has no sound." visible | initial render                                  |
| `hover-*`            | hover on "Play exercise signal"                                        | mouse hover (background colour change asserted) |
| `focus-visible-*`    | keyboard focus-visible                                                 | focus Exercise input, press Tab                 |
| `random-on-*`        | Random start on (no off note)                                          | initial render                                  |
| `disabled-zero-*`    | Rest 0:00 — button disabled, visible reason                            | initial render                                  |
| `disabled-invalid-*` | Rest invalid — button disabled, visible reason                         | initial render                                  |
| `error-*`            | "Sound is unavailable in this browser." alert                          | click with `createAudio` resolving `null`       |
| `loading-*`          | `aria-busy`, further clicks ignored                                    | click with held initialization                  |
| `playing-*`          | "Playing Standby signal"                                               | click with playback end held far in the future  |

Empty: N/A for this feature — the configuration form always renders its fields, and the existing Empty-fields card still covers form validation.

`gate-results.json` holds the 116 scripted checks (29 per theme × viewport): theme class, meaning/note texts, `type="button"`, Standby always enabled, hover colour change, Tab order (Exercise → Play exercise → Rest), preview click never calls Start, audio created in the click, Standby = two cues (`standby-first`, `standby-second`), audio reused on the next click, error retry creates audio again, loading ignores extra clicks and clears `aria-busy` after the grant, Start closes the preview audio before `onStart`, and no horizontal overflow inside the signal preview section.

Pre-existing, not part of this change: at 390 px the existing "held-mounted restart" fixture is 24 px wider than the viewport (page scrollWidth 414). The new section does not overflow.
