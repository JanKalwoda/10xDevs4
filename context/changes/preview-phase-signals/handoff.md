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

## For Phase 2 (next)

- Hook `useSignalPreview(createAudio = createDrillAudio)` over the controller with `useSyncExternalStore`; real `now = performance.now()/1000`, `setTimeout`/`clearTimeout`; `release()` on unmount.
- `SignalPreviewControl` must render `type="button"` (Button has no default type; form would submit).
- Form must call `release()` before `onStart`.
- Texts are exported from `drill-signal-preview.ts`; use them instead of duplicating strings.
- Note: `npm ci` was run in the worktree (no `node_modules` before).

## Not verified / needs a human

- Audible output, Safari/iOS behaviour (Phase 2.3, 3.2).
