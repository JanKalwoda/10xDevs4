# Timer UI verification

## Phase 4 — fixtures, contract guard and final evidence

Date: 2026-10-01. No manual Progress checkbox is marked by automation; final human acceptance is reserved for the user.

### Seven-state matrix

| State         | Production component / evidence                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default       | Real DrillConfigForm with valid values; four matrix captures below.                                                                                                           |
| Hover         | Real mouse hover over Start changes its computed background; separate hover captures.                                                                                         |
| Focus-visible | Real Tab navigation shows the Input focus ring; subsequent Tab/Space checks and captures show checked Checkbox focus.                                                         |
| Disabled      | Real Input, Checkbox and Button are disabled in the shared-controls fixture; browser confirms all three disabled controls. No artificial production business state was added. |
| Error         | Start on the real empty form triggers all four parser errors and aria-invalid; phase 3 confirms each error clears when that field is edited.                                  |
| Empty         | Saved-configuration list is N/A: this view has no list. Empty field validation is shown through the actual form, not a fabricated list.                                       |
| Loading       | Real DrillTimerView displays accessible Starting timer status, no countdown and a reserved countdown area. Reduced motion disables the spinner animation.                     |

Additional fixtures cover preparation, exercise, final rest, Standby (no time), pause/Resume, unavailable audio and completion. They are static displays with no clock or audio. The preview uses the production form, presentation and shared DrillCompleted component. Preview action callbacks cannot start a real drill. Extracting DrillCompleted is an intentional phase 4 adaptation needed to reuse the real completion view.

### Screenshots and assessment

| Theme | Width | Matrix                                         | Hover                                        | Input focus                                  | Checkbox focus                                           |
| ----- | ----- | ---------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Light | 1280  | [Matrix](screenshots/p4-light-1280-matrix.png) | [Hover](screenshots/p4-light-1280-hover.png) | [Focus](screenshots/p4-light-1280-focus.png) | [Checkbox](screenshots/p4-light-1280-checkbox-focus.png) |
| Dark  | 1280  | [Matrix](screenshots/p4-dark-1280-matrix.png)  | [Hover](screenshots/p4-dark-1280-hover.png)  | [Focus](screenshots/p4-dark-1280-focus.png)  | [Checkbox](screenshots/p4-dark-1280-checkbox-focus.png)  |
| Light | 390   | [Matrix](screenshots/p4-light-390-matrix.png)  | [Hover](screenshots/p4-light-390-hover.png)  | [Focus](screenshots/p4-light-390-focus.png)  | [Checkbox](screenshots/p4-light-390-checkbox-focus.png)  |
| Dark  | 390   | [Matrix](screenshots/p4-dark-390-matrix.png)   | [Hover](screenshots/p4-dark-390-hover.png)   | [Focus](screenshots/p4-dark-390-focus.png)   | [Checkbox](screenshots/p4-dark-390-checkbox-focus.png)   |

Agent inspected all matrix and interaction captures. The form remains one column; mobile hints/errors wrap without clipping. Paused/audio surfaces are neutral and the standalone fixtures preserve the real countdown area. Focus remains visible; disabled controls have appropriately reduced emphasis. Rendered enabled labels, inputs, descriptions, messages and buttons meet 4.5:1 normal / 3:1 large text thresholds in all four combinations. No horizontal overflow (desktop vertical scrollbar correctly reduces client width by 15 px). Disabled text is excluded from the contrast threshold. Measurements: [Phase 4 results](p4-browser-results.json).

Intentional registry adaptations: CardHeader uses standard grid utilities; Alert uses system spacing with an optional positioned icon instead of arbitrary grid dimensions. Current production Alert has no icon. Existing Button and account palettes were not restyled.

### Automated gates and entry checks

- `npm run lint`, `npm test` (22/22), `npm run astro -- sync`, `npm run astro -- check` (52 files, zero diagnostics), `npm run build`: PASS.
- Mechanical guard tests PASS: reject palettes including accent, directional borders and ring offsets, negative/translated arbitrary dimensions, arbitrary colors, literal CSS colors, named colors/shorthands/gradients and named var fallbacks. Accept semantic classes with opacity, scale utilities and token references. Integration tests exercise the actual React/Astro ESLint scope and confirm account exclusion.
- Deliberately disabling the guard makes both mechanical tests fail. Source is restored unconditionally, and final tests/lint run again. No test dependency or browser runner installed.
- `npm run smoke` against production preview on port 4322 and local Supabase: all eight auth/home steps PASS. `/dev/timer-ui` returns HTTP 404 and no preview markup. CI now runs engine tests, guard tests and the same preview 404 check.
- Isolated local production Worker on port 4323 overrides Supabase bindings to empty values without modifying local secrets. Guest root has no configuration warning; a real short drill with unavailable AudioContext completes silently in light/dark at 1280/390 px. Sign-in retains the missing-Supabase diagnostic. [Guest results](p4-guest-results.json); screenshots use `p4-guest-{light|dark}-{1280|390}-{silent|account}.png`.
- Final UI contract scan: zero violations in timer components, root, development preview and the five new primitives. Existing global token values and Button/account palettes are outside the scoped rule.

### C1–C5 and UI checklist

| Finding / requirement            | Outcome                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 — palettes bypass tokens      | FIXED: semantic tokens; scan reduced from 22 to zero; scoped guard and documented source.                                                                                       |
| C2 — separate controls           | FIXED: shared Input/Label/Checkbox; real validation, names, descriptions and boolean contract retained.                                                                         |
| C3 — separate Resume             | FIXED: shared Button, hidden-page guard preserved.                                                                                                                              |
| C4 — ambiguous audio startup     | FIXED: explicit accessible loading, no fake countdown, silent fallback and late-unmount cleanup verified.                                                                       |
| C5 — account warning on timer    | FIXED: root opt-out; actual missing-Supabase preview proves root exercise and account warning.                                                                                  |
| Tokens and components            | PASS: existing Tailwind/shadcn contract; no duplicate primitive or second system.                                                                                               |
| Entry routes / no data           | PASS: guest root, real empty-field validation; list empty N/A justified.                                                                                                        |
| Seven states / responsive / dark | PASS: documented matrix, four combinations, real hover/focus captures and contrast measurements.                                                                                |
| Guard / agent rules              | PASS: scoped ESLint uses existing lint/CI; rule outside CLI block names source, primitives, shadcn path and visual gate.                                                        |
| Visual gate / review / scope     | PASS in agent verification: preview is development-only; phase reviews recorded, guard defects fixed; one view, no engine/auth redesign. Human/device acceptance remains below. |

No C1–C5 implementation charge is deferred. Physical device, speaker output and final visual acceptance are verification deferrals authorized by the user.

## Phase 3 — timer view

Date: 2026-10-01. Implemented and reviewed using 10x-implement / 10x-impl-review. Manual Progress remains pending for the user's final verification, as requested.

- Gates passed: lint, 22 engine/audio tests, Astro check (zero diagnostics), production build. Static scan now finds zero palette classes, literal colors or arbitrary dimensions in timer components and both entry routes, including accent.
- Native headless Edge exercised the actual root page in light/dark at 1280/390 px: empty-field validation, clearing edited errors, Start, positive preparation/exercise/final rest, completion, return retaining all values, zero preparation/rest, Random start with no Standby countdown, pause on visibility handler and manual Resume. No horizontal overflow. Rendered heading/message/button text meets 4.5:1 normal / 3:1 large thresholds; final form/fixture controls are measured in phase 4.
- Browser-only interception of the development audio module exercised pending, null, rejected and post-unmount resolution, without adding production test controls. Pending exposes status and no timer; the countdown area keeps the same height when initialization resolves. Null/rejection starts silently. The late port closes after unmount and no countdown starts.
- Inspected all 27 phase 3 captures. Neutral surfaces and one-column form remain readable, with no clipping; mobile hints and error text wrap. Intentional differences: Card provides the shared radius/border/spacing; inputs now use theme surfaces, audio uses neutral Alert, and Standby retains the countdown area without displaying a value.
- A stale development dependency cache caused HTTP 500 after build; restarting the existing project development process restored HTTP 200 without code/config changes.

Measurements: [Phase 3 browser results](p3-browser-results.json). Captures use `screenshots/p3-{light|dark}-{1280|390}-{config|error|running|paused|standby|completed}.png`; controlled audio captures use `screenshots/p3-audio-{pending|silent|unmount}.png`.

## Final human checklist — remaining verification

The browser checks use desktop Edge with a 390 px viewport, not a physical phone. Visibility is simulated through the actual visibility handler. These checks remain for the user after implementation:

1. On an actual phone and desktop, background the browser or lock the device during preparation, Standby, exercise and final rest. Return and verify it stays paused, then Resume with the same repetition.
2. Listen to physical speaker/Bluetooth output. Confirm cues are audible and acceptable; automated scheduling evidence cannot measure physical playback.
3. Inspect the linked light/dark captures and `/dev/timer-ui` for visual acceptance. Confirm keyboard names, focus, errors and disabled controls with your assistive technology if used.
4. Confirm manual Progress 3.3–3.6 and 4.4–4.6 after the final evidence is available. Automated browser results are supplied as evidence, not substituted for your confirmation.

## Phase 2 — F1 review fix

Date: 2026-10-01. Timer phase/countdown/repetition and pause now use semantic tokens; Resume uses the existing Button. This intentional visual change removes dark text on the dark card and light text on the old light pause surface.

Native headless Edge verified actual running and paused views in light/dark at 1280/390 px. All rendered text passed its 4.5:1 normal / 3:1 large threshold, no horizontal overflow occurred, and Resume removed the paused state in every combination. Visibility was overridden only in the temporary browser harness to dispatch the actual visibility handler; no application test controls were added.

Measurements: [F1 browser results](p2-f1-browser-results.json). Screenshots:

After the fix, `npm run lint`, `npm test` (22 passed), `npm run astro -- check` (0 errors/warnings/hints), and `npm run build` passed.

| Theme | Width | Running                                             | Paused                                            |
| ----- | ----- | --------------------------------------------------- | ------------------------------------------------- |
| Light | 1280  | [Running](screenshots/p2-f1-light-1280-running.png) | [Paused](screenshots/p2-f1-light-1280-paused.png) |
| Dark  | 1280  | [Running](screenshots/p2-f1-dark-1280-running.png)  | [Paused](screenshots/p2-f1-dark-1280-paused.png)  |
| Light | 390   | [Running](screenshots/p2-f1-light-390-running.png)  | [Paused](screenshots/p2-f1-light-390-paused.png)  |
| Dark  | 390   | [Running](screenshots/p2-f1-dark-390-running.png)   | [Paused](screenshots/p2-f1-dark-390-paused.png)   |

Inspected desktop and mobile captures: countdown, phase, repetition and pause notice remain legible; surfaces and controls fit within the viewport. The palette scan decreases by seven occurrences, from 15 to 8. Remaining form/audio palettes belong to phase 3.

## Phase 2 — theme

Date: 2026-10-01. The user confirmed the final visual evidence and all phase 2 manual verification on 2026-10-01.

### Checks

- `npm run lint`, `npm run astro -- check` and `npm run build` passed after the final source edits. A leftover project `astro preview` and its `workerd` child locked `dist`; stopping those processes allowed the normal build to complete.
- Native Edge DevTools automation passed first-frame system theme, dynamic system changes, keyboard toggle, accessible current/target labels, manual preference after reload, visible keyboard focus and no horizontal overflow at 1280/390 px in light/dark.
- Actual rendered text contrast passed WCAG thresholds (4.5:1 normal, 3:1 large) for the configuration heading, labels, hints, inputs and buttons in all four combinations. Measurements are in [browser results](p2-browser-results.json). This does not claim coverage of all future phase 3 run/error states.
- With both storage reads and writes throwing SecurityError, the toggle and in-memory manual preference worked, and an actual click started a one-second exercise that reached Completed.
- All three account pages remained outside the timer theme opt-in. Account source files and global token values were unchanged; the sign-in screenshot retains the existing presentation.
- Palette occurrences decreased from 22 to 15, including `accent-*`. No new literal color was introduced.
- The user already confirmed system/manual behavior, keyboard focus and the accessible current/target theme labels.

### Screenshots and assessment

| Theme | Width   | Default                                     | Theme control focus                                |
| ----- | ------- | ------------------------------------------- | -------------------------------------------------- |
| Light | 1280 px | [Screenshot](screenshots/p2-light-1280.png) | [Focus](screenshots/p2-light-1280-theme-focus.png) |
| Dark  | 1280 px | [Screenshot](screenshots/p2-dark-1280.png)  | [Focus](screenshots/p2-dark-1280-theme-focus.png)  |
| Light | 390 px  | [Screenshot](screenshots/p2-light-390.png)  | [Focus](screenshots/p2-light-390-theme-focus.png)  |
| Dark  | 390 px  | [Screenshot](screenshots/p2-dark-390.png)   | [Focus](screenshots/p2-dark-390-theme-focus.png)   |

[Existing sign-in presentation, 390 px](screenshots/p2-account-signin-390.png).

The card fits both widths. Labels and hints remain legible in both themes; the theme button has visible focus. Form inputs retain their existing light surfaces until phase 3. The initial dark screenshot revealed insufficient hint contrast; semantic text utilities fixed that without changing global tokens. Theme opt-in on the root route was brought forward to verify the first paint on the actual view.

The temporary browser harness used Node's built-in WebSocket and existing headless Edge; no runner or test dependency was installed. Harness corrections included foreground/focus emulation and a real mouse click for Start. The earlier synthetic Enter failed to submit the form; no timer engine change was needed.

## Phase 1 — shared controls

Date: 2026-09-30. The user confirmed manual Progress rows 1.3 and 1.4 and authorized the phase commit.

Development entry: `/dev/timer-ui?theme=light` or `?theme=dark`. The query selects the theme of this preview only. Production preview on port 4322 returned HTTP 404 for `/dev/timer-ui`; it does not render the preview controls.

### Automated checks

- `npm run lint`, `npm run astro -- sync`, `npm run astro -- check`, `npm run build` passed.
- `npm test`: 22 passed. No tests were added or changed in phase 1, so break-check is not applicable.
- Headless Microsoft Edge, controlled through its native DevTools protocol with Node's built-in WebSocket: hydration, accessible control names, no horizontal overflow, Tab navigation skipping disabled controls, visible checkbox focus and Space toggling false to true passed at 1280 px and 390 px in light/dark. No browser runner was installed in the project.
- Static palette scan of `src/components/timer`, `src/pages/index.astro` and `src/pages/dev/timer-ui.astro`: 22 occurrences, including `accent-blue-600`, all in the existing timer components. The new preview adds zero palette classes.

### Screenshots and agent assessment

| Theme | Width   | Default                                     | Keyboard checkbox focus                                    |
| ----- | ------- | ------------------------------------------- | ---------------------------------------------------------- |
| Light | 1280 px | [Screenshot](screenshots/p1-light-1280.png) | [Screenshot](screenshots/p1-light-1280-checkbox-focus.png) |
| Dark  | 1280 px | [Screenshot](screenshots/p1-dark-1280.png)  | [Screenshot](screenshots/p1-dark-1280-checkbox-focus.png)  |
| Light | 390 px  | [Screenshot](screenshots/p1-light-390.png)  | [Screenshot](screenshots/p1-light-390-checkbox-focus.png)  |
| Dark  | 390 px  | [Screenshot](screenshots/p1-dark-390.png)   | [Screenshot](screenshots/p1-dark-390-checkbox-focus.png)   |

All eight screenshots were inspected. The card and alerts fit both widths; mobile descriptions wrap within their containers. Labels, hints and errors remain visible. Disabled fields, checkbox and button have reduced emphasis. The checkbox focus ring is visible in both themes. Theme values are the existing global tokens; contrast refinements belong to phase 2. No timer engine or audio runs in this preview.

### Adaptations

- The prior `feature/m2l5` branch had already been merged. Work started from `main` on `feature/polish-timer-view-p1`, following the current AGENTS.md workflow.
- Registry components were added with the existing new-york configuration. Replaced registry imports from the unnecessary `cn` package with `@/lib/utils`, removed the Next.js directive, and changed arbitrary focus/radius dimensions to `ring-2` and `rounded-sm`. Removed the unused `cn` dependency. Added `radix-ui`; existing locked package versions did not change.
- Astro frontmatter's top-level Response return caused a TypeScript ESLint rule crash. The route instead sets status 404 outside development and conditionally omits all preview markup. No lint rule was disabled.
- Local CRLF endings in ten previously clean source files were normalized to the LF content already stored in Git; this produced no tracked source diff. Phase context documents also use LF.
- Restarted the development server after registry dependency installation and verification to clear stale Vite dependency optimization state.
- Roadmap S-15 was moved to `in-progress` in the working tree. The roadmap had pre-existing edits and remains outside the phase staging set, as approved by the user.

### Human verification confirmed

- The user confirmed names, visible focus, disabled behavior and keyboard checkbox operation in the development preview.
- The user confirmed the four theme/width combinations and saved screenshots. Manual Progress rows 1.3 and 1.4 are complete.
