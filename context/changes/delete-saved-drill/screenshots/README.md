# Phase 3 visual gate — delete-saved-drill (S-13)

Captured on 2026-10-07 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`, a dialog state through `&delete=<state>`) by a **Playwright script, not a human** (temporary Playwright 1.63 + Chromium from the shared cache, outside repository dependencies). Viewport screenshots of the production `DeleteDrillDialog` with injected ports (`DeleteDrillFixtures.tsx`), one open modal per capture (a Radix modal hides and traps the rest of the page), 1280×800 and 390×844, light and dark. Element screenshots of the production `SavedDrillDetails` with the closed `Delete timer` trigger (`SavedDrillFixtures.tsx`). The round Astro dev toolbar visible at the bottom of some captures is the dev server overlay, not part of the app.

| File prefix                      | State                                                                                                | Visual-gate state         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| `details-delete-*`               | saved timer details: `Start`, `Edit timer`, `Delete timer` in the actions slot                       | default                   |
| `details-delete-hover-*`         | hover on the `Delete timer` trigger (background change asserted)                                     | hover                     |
| `details-delete-focus-visible-*` | keyboard Tab from `Edit timer` onto the trigger (ring asserted)                                      | focus-visible             |
| `dialog-default-*`               | open dialog, name quoted, focus on `Cancel`                                                          | default                   |
| `dialog-hover-delete-*`          | hover on the confirm `Delete` (background change asserted)                                           | hover                     |
| `dialog-focus-visible-cancel-*`  | initial focus on `Cancel` (ring asserted)                                                            | focus-visible             |
| `dialog-focus-visible-delete-*`  | Tab from `Cancel` onto `Delete` (ring asserted)                                                      | focus-visible             |
| `dialog-long-name-*`             | 200 characters without a space wrap inside the dialog                                                | default (stress)          |
| `dialog-emoji-name-*`            | emoji, ZWJ sequence and a decomposed (NFD) letter                                                    | default (stress)          |
| `dialog-deleting-*`              | after `Delete`: `Deleting…`, `aria-disabled`, dimmed, Esc does not dismiss                           | disabled and loading      |
| `dialog-error-*`                 | forced "unavailable": alert, dialog stays open, focus on `Cancel`                                    | error                     |
| `dialog-unauthorized-*`          | forced 401: alert with a `Sign in` link back to the timer                                            | error                     |
| `page-long-name-*`               | header of the saved timer page (same `SAVED_DRILL_HEADING_CLASS`) with 200 characters without spaces | default (S-11 regression) |

Empty: justified N/A (a dialog always has a name). Cancel hover is asserted (background change) but not captured separately.

`gate-results.json`: 240 scripted checks (theme class, dialog named and described, initial focus on `Cancel`, `Delete` and `Cancel` hover colour change, keyboard reach and focus ring, the `Deleting…` state with `aria-disabled` and no `disabled` attribute, Esc ignored while deleting, alert texts, the sign-in `next` link, dialog fully inside the viewport without inner overflow, overlay uses the `--overlay` token, Esc returns focus to the trigger, no API request from any preview, no page errors); 0 failed.

## Contrast (measured from computed colours through a canvas pixel, composited over the dialog)

| Element                                 | Light  | Dark   |
| --------------------------------------- | ------ | ------ |
| `Delete timer` trigger text on the card | 5.49:1 | 5.67:1 |
| `Delete timer` trigger on hover         | 5.19:1 | 4.78:1 |
| Confirm `Delete`                        | 5.89:1 | 7.04:1 |
| Confirm `Delete` on hover               | 5.32:1 | 6.03:1 |

All above the 4.5:1 minimum for normal text.

## S-11 fix verified over HTTP on the production preview (by script, not a human)

`e2e-long-heading.json` and `e2e-long-heading-page-390.png`: Playwright against `npm run preview` (production build, workerd), one throw-away user (deleted afterwards), a timer named with 200 `z` characters. At 390 and 1280 px the page has no horizontal scroll (`documentElement.scrollWidth` ≤ viewport) and the whole name is rendered inside the viewport; before the fix `scrollWidth` was 3432 at 390 px (Phase 2 finding). Deleting that timer through the dialog sends one `DELETE`, lands on `/dashboard` without it and the sibling timer stays. 10 checks, 0 failed.

Not covered by the script (still open for a human): bfcache Back after delete, real devices, screen reader naming.
