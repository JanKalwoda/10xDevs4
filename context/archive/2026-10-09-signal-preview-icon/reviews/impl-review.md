<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Signal preview icon (S-19)

- **Plan**: context/changes/signal-preview-icon/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verified (no finding)

- Tooltip model: `open={radixOpen || hintOpen}`; the close from the trigger's own click does not end the hint (`setRadixOpen` only); Esc and outside press call `hint.hide()` (outside press on the trigger is ignored). F1 of the plan review is implemented.
- Live region `role="status"` is always in the DOM and independent of `pointerType` (`decidePress`: disabled -> announce the note for any pointer). F2 implemented.
- `aria-disabled` without `disabled`; click, Enter and Space go through `onClick` -> `decidePress` -> no play when disabled; hover bg blocked by `aria-disabled:hover:*`; `aria-describedby` points to a constant sr-only span.
- `signal-preview-hint.ts`: stable snapshots, `stopTimer` before each `showFor`, `dispose` clears; `useSignalHint` creates the instance in `useState`, cleanup `hide()` on unmount (StrictMode-safe); announce timer cleared on unmount.
- `tooltip.tsx`: only semantic tokens, `max-w-xs`, `collisionPadding=8`, `text-balance`, no arbitrary values; in the lint glob and in the contract test (plus a regression case for `rounded-[2px]` / `translate-y-[calc()]`). Lint ignore added only for the one gate script.
- Audio error is a visible `Alert` under the row (screenshot error-alert-390-light); Preparation and Repetitions unchanged; `/create` and `/{id}/edit` use the same `DrillConfigForm` (25 forms in the gate, 0 overflow failures).
- Gates re-run: `npm run lint` 0 errors, `npm test` 228/228, `node --test scripts/eslint-rules/*.test.mjs` 6/6, `astro check` 0 errors, `npm run build` OK. Gate JSON: `failed: 0`.
- Screenshots viewed: tap-disabled-390-dark-touch (tooltip inside the viewport, readable), error-alert-390-light (Alert under the row, no overflow).

## Findings

### F1 — Disabled-icon reason stays visible and goes stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/timer/SignalPreviewControl.tsx:46-52,70
- **Detail**: `announcement` is set by `announce()` and never cleared. The live region `<p role="status" className="text-sm empty:sr-only">` is visible text when not empty, so after a click on the disabled Rest icon "Rest is 0:00, so there is no rest signal." stays under the field (visible in tap-disabled-390-dark-touch.png, as a duplicate of the tooltip). If the user then changes Rest to 0:30, the message stays and is wrong, and screen readers can meet the stale text. The plan wanted a live region that announces, not a permanent third copy.
- **Fix**: Make the live region `sr-only` (or clear `announcement` after a few seconds and when `availability.enabled`/`note` changes), and add a gate check that the text disappears once Rest is valid.
- **Decision**: FIX (coordinator). The live region `<p role="status">` is `sr-only` (the tooltip is the visible description) and is cleared together with the hint (8 s, `createSignalAnnouncer` in `src/lib/signal-preview-hint.ts`, hook `useSignalAnnouncer`) and whenever availability changes (`availability.enabled` / `note`, e.g. Rest 0:00 -> 0:30). Module tests added (delay, 8 s clear, clear on change, repeat, dispose); the gate checks no visible duplicate (desktop and tap-disabled-390) and that the message disappears after Rest becomes valid. Affected screenshots refreshed and viewed (tap-disabled-390-dark-touch, disabled-reason-390-light). Gate: 234/234. One earlier gate run failed on a cold dev server (tooltip timeout in the first touch pass); the rerun passed with no code change.

### F2 — Manual steps 2.4, 2.5, 3.3 are ticked from scripts, not a human

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/signal-preview-icon/plan.md (Progress)
- **Detail**: The steps are marked `[x]` with an honest "script, not human" note; real touch (iOS/Android), screen reader and real hover behaviour are not covered by Playwright emulation. Per the lessons file, steps are confirmed by the user.
- **Fix**: Leave as is; real-device touch/tooltip check goes to the manual test list at the end of the queue.
- **Decision**: ACCEPTED (coordinator). Real touch (iOS/Android) and screen-reader checks go to the manual test list at the end of the queue; steps stay ticked as "script, not human".

### F3 — Planned fixture extras not added (tap/long Standby states live only in the script)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/SignalPreviewFixtures.tsx
- **Detail**: Plan listed tooltip-after-tap and long Standby text at 390 px as states; they are forced by the script on existing fixtures (tap-*-touch screenshots exist), which the plan allowed ("hover/focus/tap forces the Playwright script"). Create/Edit fixtures untouched, which is fine because they share the form.
- **Fix**: None needed.
- **Decision**: ACCEPTED (no change needed).
