# Ocean Breeze UI verification

Date: 2026-10-01. Installed with the exact user-supplied registry URL through `npx shadcn@latest add https://tweakcn.com/r/themes/ocean-breeze.json --yes`. No package or lockfile changes.

## Preset adaptations

Raw values are retained in ocean-breeze.json. The following semantic roles were adjusted after browser measurements; component markup/classes remain unchanged.

| Role | Original | Adaptation | Reason |
| --- | --- | --- | --- |
| Light primary-foreground | White | Existing foreground | Original white/green button text measured 2.28:1 |
| Light destructive | oklch(0.6368 0.2078 25.3313) | oklch(0.53 0.2078 25.3313) | Original validation text measured 3.76:1 on white |
| Dark muted-foreground | oklch(0.5510 0.0234 264.3637) | Existing secondary-foreground | Original hints/status text measured 3.03:1 on card |
| Dark destructive | oklch(0.6368 0.2078 25.3313) | oklch(0.74 0.17 25.3313) | Original validation text measured 3.89:1 on card; translucent alert text lower |
| Light ring | Bright primary green | oklch(0.27 0.075 149.5793) | Review found insufficient contrast on white, particularly at the shared controls' 50% opacity |

Font and radius mappings in `@theme inline` reference their source variables rather than duplicate literal values. The preset declares DM Sans/Lora/IBM Plex Mono stacks but ships no fonts; existing browser fallback remains available. No remote font requests or font package was introduced.

## Seven-state matrix

| State | Evidence |
| --- | --- |
| Default | Real production form with valid configuration |
| Hover | Real pointer over Start changes its computed background; hover captures |
| Focus-visible | Real Tab navigation to Input, Checkbox and Start, with settled transitions; focus captures |
| Disabled | Existing fixture shows disabled Input, Checkbox and Start; browser confirms disabled controls |
| Error | Real Start on empty form produces four aria-invalid fields and adjacent validation text |
| Empty | Empty configuration inputs are exercised. Empty collection is N/A: this timer view has no collection |
| Loading | Production presentation shows Starting timer, with a reserved countdown area |

Additional matrix fixtures cover preparation, exercise, rest, Standby, paused Resume, unavailable audio and completion. Screenshots use reduced-motion emulation to stabilize the loading icon.

## Screenshot gate

| Theme | Width | Matrix | Default | Hover | Input focus | Checkbox focus | Button focus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Light | 1280 | [Matrix](screenshots/light-1280-matrix.png) | [Default](screenshots/light-1280-default.png) | [Hover](screenshots/light-1280-hover.png) | [Focus](screenshots/light-1280-focus.png) | [Checkbox](screenshots/light-1280-checkbox-focus.png) | [Button](screenshots/light-1280-button-focus.png) |
| Dark | 1280 | [Matrix](screenshots/dark-1280-matrix.png) | [Default](screenshots/dark-1280-default.png) | [Hover](screenshots/dark-1280-hover.png) | [Focus](screenshots/dark-1280-focus.png) | [Checkbox](screenshots/dark-1280-checkbox-focus.png) | [Button](screenshots/dark-1280-button-focus.png) |
| Light | 390 | [Matrix](screenshots/light-390-matrix.png) | [Default](screenshots/light-390-default.png) | [Hover](screenshots/light-390-hover.png) | [Focus](screenshots/light-390-focus.png) | [Checkbox](screenshots/light-390-checkbox-focus.png) | [Button](screenshots/light-390-button-focus.png) |
| Dark | 390 | [Matrix](screenshots/dark-390-matrix.png) | [Default](screenshots/dark-390-default.png) | [Hover](screenshots/dark-390-hover.png) | [Focus](screenshots/dark-390-focus.png) | [Checkbox](screenshots/dark-390-checkbox-focus.png) | [Button](screenshots/dark-390-button-focus.png) |

Browser results: browser-results.json. Before accessibility adaptations: registry-browser-results.json. The initial harness counted Radix's aria-hidden proxy inputs in its name check; the final harness excludes them. No product change was needed for names. Contrast is measured for rendered active text on composited backgrounds, not unused palette roles or disabled text.

The inspected captures show legible configuration/validation/timer states, the intended green accent and navy dark surfaces, no horizontal overflow, and clear focus. Final user visual acceptance remains pending.

## Guard

Existing timer ESLint contract remains active with zero view literals. AGENTS.md records preset provenance and preserves the contrast adaptations for later updates.
