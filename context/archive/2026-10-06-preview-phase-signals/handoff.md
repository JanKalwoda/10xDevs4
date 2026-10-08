# Handoff — preview-phase-signals (S-03)

Worktree `D:\Dev\10xDevs4-preview-phase-signals`, branch `feature/preview-phase-signals`.

## Phase 1 — DONE (library + controller + tests)

Commit: see `git log` (subject `feat(preview-phase-signals): Signal preview library and controller (p1)`); SHA also in plan Progress 1.1/1.2.

Delivered:

- `src/lib/drill-timer.ts` — `parseTime` exported as `parseDrillTime` (behaviour unchanged).
- `src/lib/drill-signal-preview.ts` — `PreviewSignal`, `SIGNAL_MEANINGS`, note texts (`PREPARATION_NO_SOUND`, `REST_ZERO_NOTE`, `REST_INVALID_NOTE`, `STANDBY_OFF_NOTE`), `previewCueSequence`, `playSignalPreview` (returns the real end of the last `ScheduledCue`), `signalAvailability`.
- `src/lib/drill-signal-preview-controller.ts` — `createSignalPreviewController({ createAudio, now, setTimer, clearTimer })` → `{ play, release, subscribe, getSnapshot }`; snapshot `{ status: idle | initializing | playing | unavailable, signal }`. `createAudio()` is invoked synchronously inside `play`.
- Tests: `drill-signal-preview.test.ts` (sequences equal what `DrillRun` schedules, shifted-start end time, availability) and `drill-signal-preview-controller.test.ts` (initializing click ignored, late grant closed, dead port replaced, null/rejection retry, overlap cancels, onUnavailable, idempotent release, playing clears at end).

Gates (all green): `npm test` (87 pass), `npx astro sync`, `npm run lint`, contract rule tests (4 pass), `npx astro check` (0 errors), `npm run build`. Break-check: reverting the second-Standby-cue offset / Standby availability and the initializing guard / `available` reuse made the tests go red; files restored.

Also: roadmap S-03 set to `in-progress` (kept `updated: 2026-10-07`); `change.md` → `implementing`.

## Phase 2 — DONE (UI), step 2.1 only

Delivered:

- `src/components/hooks/useSignalPreview.ts` — one controller per form (`useState` lazy init), `useSyncExternalStore`, real `performance.now()/1000` and `setTimeout`, `release()` on unmount. `createAudio` is read once at mount (no ref reads during render, react-hooks/refs).
- `src/components/timer/SignalPreviewControl.tsx` — `type="button"` outline `Button` with `Play` icon, `aria-busy` while initializing, meaning text from `SIGNAL_MEANINGS`, visible note, `role="status"` "Playing … signal", `ui/alert` "Sound is unavailable in this browser." only under the control that was last clicked.
- `DrillConfigForm.tsx` — `ConfigField` `children` slot; controls under Exercise, Rest, Random start; "Preparation has no sound." under Preparation; `createAudio` optional prop; `preview.release()` before `onStart`.

Gates green: `npm test` (87), `astro sync`, `npm run lint`, contract rule tests (4), `astro check` (0 errors), `npm run build`.

Open for Phase 3: step 2.2 (click never invokes Start) stays unchecked until the fixture assertion exists; fixtures must inject `createAudio` (the existing `/dev/timer-ui` form fixture still uses the real `createDrillAudio`).

## Phase 3 — DONE (visual gate)

Delivered:

- `src/components/timer/SignalPreviewFixtures.tsx` — production `DrillConfigForm` in seven cards (default / Random start on / Rest 0:00 / Rest invalid / error / loading / playing) with injected `createAudio`, an evidence list (Start calls, audio created/closed, cues scheduled) and "Grant held audio" / "Reset fixture" buttons. `TimerUiPreview.tsx` only mounts it (2 lines); the seven timer states and held-mounted lifecycle scenarios are untouched.
- `screenshots/` — 36 PNG (9 states × light/dark × 1280/390), `README.md`, `gate-results.json`.

## Verified by script (not by a human)

- `npm test` 87/87, `astro sync`, `npm run lint`, contract rule tests 4/4, `astro check` 0 errors, `npm run build` — all green.
- Playwright against `/dev/timer-ui` (light/dark × 1280/390): 116/116 checks (list in `screenshots/README.md`), including step 2.2 (preview click never calls Start), audio created inside the click, Standby = two cues, retry after unavailable, initializing ignores extra clicks, Start closes preview audio before `onStart`.
- I viewed representative screenshots (error light 1280, playing dark 390, focus-visible dark 1280); the others were only checked by the script's assertions.
- Not run in this phase: `/dev/timer-ui` returning 404 on the production preview (CI smoke covers it; the route logic is unchanged).

## Needs a human (not claimed)

- 2.3 / 3.2: audible output on real devices (speakers, headphones, Bluetooth), Safari/iOS autoplay behaviour, and whether the meaning texts are clear to a listener. The fixtures use a fake audio port, so the real `AudioContext` path through the preview button was only exercised by unit tests, never in a browser.
- Human review of all 36 screenshots.
- Pre-existing: the "held-mounted restart" fixture overflows the viewport by 24 px at 390 px; not touched here.

## Review fixes (impl-review F1–F3) — DONE

- F1: `src/lib/drill-config-submit.ts` + `drill-config-submit.test.ts` — release-before-`onStart` ordering is now tested in `npm test`. "Click never calls Start" remains structural + Playwright only (no DOM test runner).
- F2: "Starting sound…" in the live region while initializing.
- F3: Standby meaning uses the new `RANDOM_START_*_CENTISECONDS` constants; test added.
- F4: accepted as planned.
- Gates re-run: `npm test` 90/90, `npm run lint` clean, contract rule tests, `astro check` 0 errors, `npm run build` green.
- Still needs a human: audio on real devices, review of the 36 screenshots. The screenshots were not regenerated; the only visible change is the "Starting sound…" text in the loading state.

## Weryfikacja ręczna przez użytkownika (2026-10-08)

Użytkownik ręcznie sprawdził wszystkie kroki z listy testów ręcznych dla tej zmiany (na produkcji i na urządzeniach, w tym dźwięk tam, gdzie dotyczy) i potwierdził, że wszystko działa poprawnie. To zastępuje wcześniejsze zastrzeżenia, że kroki manualne zweryfikował wyłącznie skrypt Playwright lub agent.
