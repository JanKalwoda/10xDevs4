# Phase 4 visual gate — save-named-drill (S-10)

Captured on 2026-10-07 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`) by a **Playwright script, not a human** (temporary Playwright 1.63 + Chromium from the shared user cache, outside repository dependencies). Element screenshots of the production `DrillCreateForm` inside the `CreateDrillFixtures` cards (`src/components/timer/CreateDrillFixtures.tsx`), 1280×800 and 390×844, light and dark. The fixtures feed the production form the exact props `useDrillCreate` produces for each state; nothing is mocked inside the form.

| File prefix         | Fixture / state                                                            | Visual-gate state                                                             |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `default-*`         | empty name, default parameters                                             | default, **empty** (= default: there is no list, the empty form is the state) |
| `filled-*`          | name entered                                                               | default                                                                       |
| `hover-*`           | hover on Save (background change asserted)                                 | hover                                                                         |
| `focus-visible-*`   | keyboard Tab onto Save (focus-visible ring asserted)                       | focus-visible                                                                 |
| `name-required-*`   | submit with empty name, `role="alert"` under the field                     | error                                                                         |
| `duplicate-name-*`  | server `duplicate_name` on the name field                                  | error                                                                         |
| `limit-reached-*`   | destructive alert above Save                                               | error                                                                         |
| `unavailable-*`     | table missing / no client                                                  | error                                                                         |
| `session-expired-*` | alert with a `Sign in` link to `/auth/signin?next=%2Fcreate`               | error                                                                         |
| `saving-*`          | Save disabled + `aria-busy`, label `Saving…`, name read-only               | disabled + loading                                                            |
| `saved-*`           | `Saved "Morning drill".` status, name cleared and focused, parameters kept | default                                                                       |

`gate-results.json` holds the 100 scripted checks (25 per theme × viewport): theme class, nine fixtures rendered, no horizontal overflow in the section, empty/default (label, hint, no `maxlength`, `aria-describedby`), filled value, hover colour change, keyboard Tab reaches Save, Save focus-visible ring, name field focus ring, `aria-invalid` + `role="alert"` + `aria-describedby` on both name errors, error colour differs from the muted hint, limit/unavailable/session-expired texts and sign-in link, saving (disabled, `aria-busy`, label, read-only name, disabled style), saved (status text, name cleared + focused on mount, parameters kept), no page/console errors. Result: 0 failed.

Gate sensitivity: with `aria-invalid` deliberately forced to `false` in `DrillCreateForm.tsx` the same script reported 8 failed checks (name-required and duplicate-name, all four theme × viewport combinations); the change was reverted and the run above was repeated on the restored code.

## Browser run of `/create` (Phase 3 manual steps, done by a script, not a human)

`e2e-*.png` and `e2e-results-main.json` / `e2e-results-missing-table.json` come from a second Playwright script against the real `/create` page, the real middleware, the real local Supabase (RLS + trigger) and a throw-away user created through the GoTrue admin `generate_link` (the shared local stack has no Mailpit). The script signs in through the UI form, follows the one-time link, drives the page with the keyboard, and deletes the user at the end (cascades its rows). 19 checks in `main`, 11 in `missing-table`; 0 failed.

- Guest `GET /create` → `/auth/signin?next=%2Fcreate`; the sign-in form keeps `next`; after the link the user lands on `/create`.
- Keyboard-only: Tab order name → preparation → exercise (+ preview) → rest (+ preview) → repetitions → random start (+ Standby preview) → Save; Enter submits; empty name shows a `role="alert"` error referenced by `aria-describedby`.
- Save shows `Saved "Morning drill".`, clears and focuses the name, keeps the parameters; the same name in other case shows the duplicate error on the name field; 49 more rows through the API and the 51st through the UI show the limit alert; clearing cookies and saving shows the sign-in alert and link.
- `/` still starts a drill (Cancel/Restart present, countdown, advances to Rest) and Cancel returns to the configuration; no name field or Save button there.
- **Missing table is simulated, not real:** a forwarding proxy answered `404 PGRST205` for `/rest/v1/drill_configurations` (everything else went to the real stack, `.dev.vars` temporarily pointed at it and restored). `/`, `/auth/signin`, `/dashboard`, `/create` stay 200, `POST /api/drills` → `503 unavailable`, the UI shows the "temporarily unavailable" alert. Dropping the real table on the shared stack was not done.

## Limits

- Not done by a human and still open: review of these images (4.4), a phone check (4.5), and a human run of the Phase 3 browser steps (the script covers them, but sound, real e-mail delivery and visual impression are not covered; `/` audio is not verified by the script).
- Pre-existing, not part of this change: at 390 px the existing held-mounted restart fixture makes the whole preview page wider than the viewport; the create section itself does not overflow (checked).
- The `saved` fixture focuses its name field on mount (production behaviour), so a focus ring is visible in `saved-*`.
