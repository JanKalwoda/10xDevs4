# Phase 3 visual gate — open-saved-drill (S-11)

Captured on 2026-10-07 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`) by a **Playwright script, not a human** (temporary Playwright 1.63 + Chromium from the shared cache, outside repository dependencies). Element screenshots of the production `SavedDrillList` / `SavedDrillDetails` inside the `SavedDrillFixtures` cards, 1280×800 and 390×844, light and dark. `not-found-*` are the real `/abc` page from `npm run preview` (workerd).

| File prefix                            | State                                            | Visual-gate state      |
| -------------------------------------- | ------------------------------------------------ | ---------------------- |
| `list-*`                               | 3 timers (link cards)                            | default                |
| `hover-*`                              | hover on first card (background change asserted) | hover                  |
| `focus-visible-*`                      | keyboard Tab onto first card (ring asserted)     | focus-visible          |
| `empty-*`                              | `You have no saved timers yet.`                  | empty                  |
| `unavailable-*`                        | destructive alert, never the empty text          | error                  |
| `stress-50-*`                          | 50 timers, long and unbroken names               | default (stress)       |
| `details-*`, `details-focus-visible-*` | saved timer details, Start focus ring            | default, focus-visible |
| `not-found-*`                          | shared 404                                       | error                  |

Disabled: justified N/A (no disabled control). Loading: justified N/A (pages are server-rendered, no client fetch).

`gate-results.json`: 49 scripted checks (theme class, no section overflow, card counts, hover colour change, focus ring, empty/unavailable texts, 50 cards without overflow, details structure incl. empty actions slot, no page errors); 0 failed. The first run found two issues, fixed before the final run: fixture grid items needed `min-w-0` (long unbroken names widened the card at 390 px) and the card's `hover:text-accent-foreground` dimmed the name in dark mode (removed; card foreground kept).

## Browser run of Phase 2 manual steps 2.3 / 2.5 (by script, not a human)

`e2e-results.json` and `e2e-*.png`: Playwright against `npm run preview` (production build, workerd), real middleware and local Supabase, throw-away user via GoTrue admin `generate_link` (deleted at the end). 23 checks, 0 failed: dashboard list, keyboard Tab/Enter to a card, details, Start runs the real timer (phases advance), Cancel and completion (`Return to timer`) return to the details, refresh during a run shows the details, `/`, `/create`, `/auth/signin`, `GET /api/drills` unchanged, no page/console errors.

Not covered by the script (still open for a human): bfcache Back/Forward, real devices, sound, screen reader. Focus after "Return to timer" lands on `body` (the button unmounts), as on `/`.
