# Phase 3 visual gate — view-three-phase-sections (S-04)

Captured on 2026-10-07 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`) by a **Playwright script, not a human** (temporary Playwright 1.63 + Chromium from the shared user cache, outside repository dependencies). Element screenshots of the production `DrillTimerView` inside the `PhaseSectionsFixtures` cards, 1280×800 and 390×844, light and dark. Displays come from the real `DrillRun` / `initialDrillDisplay` on a deterministic clock (random = 0.5), so nothing depends on real time.

| File prefix | Fixture / state |
| --- | --- |
| `preparation-exercise-*` | Preparation → Exercise (default) |
| `preparation-standby-*` | Preparation → Standby ("Next: Standby", no time) |
| `exercise-rest-*` | Exercise → Rest |
| `exercise-complete-*` | last Exercise, rest 0:00 → Drill complete |
| `standby-exercise-*` | Standby main = the word, no time |
| `rest-exercise-*`, `rest-standby-*`, `rest-complete-*` | Rest → Exercise / Standby / Drill complete |
| `resume-preparation-*` | resume preparation (next = resumed repetition) |
| `paused-*` | paused, Resume control |
| `initializing-*` | loading: no main countdown, disabled loading slot |
| `audio-unavailable-*` | warning alert above the sections |
| `hover-*` | hover on Restart (background change asserted) |
| `focus-visible-*` | keyboard focus-visible ring on Cancel |

Empty: N/A — `buildPhaseSections` returns `null` only for `phase: null`, which `DrillTimer` treats as completion, so the view never renders an empty timer (the existing completion/empty card is unchanged). Disabled: the disabled loading slot in `initializing-*`.

`gate-results.json` holds the 424 scripted checks (106 per theme × viewport): theme class, current/detail/next text per fixture, main `m:ss` with `role="timer"` or the plain word "Standby" (no timer role), no `m:ss` in Standby main/current or "Next: Standby", vertical order main < current < next < controls, font size main > current > next, warning text, Resume control when paused, Cancel/Restart named and enabled, hover colour change, focus-visible ring, disabled loading slot, no overflow in the new section, no page errors.

Limits: the "resumed repetition" is not visible in the text ("Next: Exercise — 0:04" has no repetition number); that is proven by the `npm test` drive-the-run tests. Pre-existing, not part of this change: at 390 px the existing held-mounted restart fixture makes the whole preview page 414 px wide (same as in S-03); the new section does not overflow. Step 3.3 (human review of these images) is still open.
