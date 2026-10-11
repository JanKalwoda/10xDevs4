# Regression of the earlier gate scripts (script, not human), 2026-10-11

- S-18 `run-view-visual-gate.mjs`: 680/680 checks passed, unchanged.
- S-19 `signal-preview-visual-gate.mjs`: 236/236 checks passed, unchanged.
- S-21 `ux-fixes-round-2-visual-gate.mjs`: 1307/1307 checks passed after updating the assertions that S-22 made obsolete: Current unframed and unfilled while Next keeps frame and fill (was "same box style"); arrows inside the InputGroup frame, column 42 px (about 21 px per arrow) with exactly one separator line (was 44 px / 22 px / no border); no step during the 400 ms pause of a hold (the single step now comes from `click`); layout follows the primary pointer.
- Their own screenshots were not re-committed (only the new S-22 ones).

## `/dev/timer-ui` horizontal overflow at 390 px (414 px)

Cause: the "held-mounted Restart lifecycle gate" fixture in `TimerUiPreview.tsx`: four `Start run ...` buttons with long labels were `whitespace-nowrap` (373 px wide), so the page was 414 px wide. A fixture only (production components were not involved); fixed with `h-auto whitespace-normal` on those buttons. The S-22 gate now asserts `scrollWidth <= clientWidth` for the whole fixture page in every setup, and for the production views `/`, `/create`, `/{id}/edit` (also with the longest values), `/{id}`, `/timers` and the run view (Preparation, longest values) at 390 px for a coarse and a fine pointer.
