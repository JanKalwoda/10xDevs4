# Ocean Breeze theme research

## Scope

Install the user's explicit preset into the existing shared token system and validate the rendered timer. The registry command has changed only src/styles/global.css; package manifests and component markup are untouched.

## Charges

1. **Missing requested theme values** — src/styles/global.css:7: the previous monochrome light primary/background differ from Ocean Breeze, so the public timer does not display the chosen theme. Address through registry token installation.
2. **Missing requested dark theme values** — src/styles/global.css:43 before installation: the prior neutral dark palette does not provide the requested navy/mint presentation. Address via `.dark` token values, retaining the existing theme toggle.
3. **Theme provenance / architecture** — src/styles/global.css:7: the token block had no named upstream preset; retain its raw JSON locally and link it beside the block so subsequent changes can distinguish intentional adaptations.

## Contract and audit

- Source-to-view: timer components consume semantic classes and src/components/ui primitives; src/layouts/Layout.astro imports global CSS. The existing ESLint timer contract enforces this boundary.
- View-to-source: the hardcoded color/dimension scan of src/components/timer, src/pages/index.astro and src/pages/dev/timer-ui.astro returns zero matches before this change. No component cleanup is required.
- Reuse `/dev/timer-ui` with deterministic configuration, empty validation, loading, paused, disabled and completed fixtures. Empty list is N/A because this view has no collection.
- The preset declares font families but contains no font files or download instructions. Preserve its font stack and available browser fallback rather than adding a font dependency.
- Check text contrast on rendered surfaces; any accessibility adaptation must stay in semantic tokens and be documented against the raw preset.

## References

- Upstream source: https://tweakcn.com/r/themes/ocean-breeze.json (downloaded 2026-10-01, archived as ocean-breeze.json)
- src/styles/global.css
- src/components/timer/TimerUiPreview.tsx
- src/pages/dev/timer-ui.astro
- AGENTS.md UI rules
