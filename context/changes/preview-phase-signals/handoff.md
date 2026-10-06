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

## Not verified / needs a human

- Audible output, Safari/iOS behaviour (2.3, 3.2); no browser run or screenshots yet.
