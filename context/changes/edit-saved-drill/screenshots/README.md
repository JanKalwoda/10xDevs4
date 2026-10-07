# Phase 3 visual gate — edit-saved-drill (S-12)

Captured on 2026-10-07 from the local Astro dev server (`/dev/timer-ui?theme=light|dark`) by a **Playwright script, not a human** (temporary Playwright 1.63 + Chromium from the shared cache, outside repository dependencies). Element screenshots of the production `DrillCreateForm` (edit props: `Save changes`, edit `signInHref`) plus the `DrillEditApp` links inside the `EditDrillFixtures` cards, and of the production `SavedDrillDetails` with the `Edit timer` action inside the `SavedDrillFixtures` card; 1280×800 and 390×844, light and dark. The round Astro dev toolbar visible in some 390 px captures is the dev server overlay, not part of the app.

| File prefix                                      | State                                                               | Visual-gate state                         |
| ------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| `default-*`                                      | prefilled stored name and parameters (0:00 rest, 10:00 exercise)    | default (also the "empty" N/A, see below) |
| `hover-*`                                        | hover on `Save changes` (background change asserted)                | hover                                     |
| `focus-visible-*`                                | keyboard Tab from the name onto `Save changes` (ring asserted)      | focus-visible                             |
| `saved-*`                                        | `Saved "Morning drill".`, name kept, links stay                     | default (success)                         |
| `saving-*`                                       | `Saving…`, button disabled, name read-only                          | disabled and loading                      |
| `error-name-required-*`                          | cleared name, field error, `aria-invalid`                           | error                                     |
| `error-duplicate-name-*`                         | duplicate name: field error, typed values stay                      | error                                     |
| `error-invalid-parameters-*`                     | rest `99:99`, inline error after pressing `Save changes`            | error                                     |
| `error-server-validation-*`                      | server refused the parameters: destructive alert                    | error                                     |
| `error-not-found-*`                              | timer gone: alert with `Back to dashboard`                          | error                                     |
| `error-session-expired-*`                        | alert with sign-in link back to `/{id}/edit`                        | error                                     |
| `error-unavailable-*`                            | saving temporarily unavailable                                      | error                                     |
| `details-edit-*`, `-hover-*`, `-focus-visible-*` | saved timer details with `Edit timer` (hover, Tab from Start, ring) | default, hover, focus-visible             |

Empty: justified N/A (the edit form is always prefilled; the empty-name error is the `error-name-required` card). Disabled and loading: the `saving` card (no other disabled control). The shared 404 for a foreign or unknown id is an Astro view: its evidence is the HTTP checks in `e2e-results.json` and the smoke script (identical status, body and headers for foreign, random and non-UUID ids).

`gate-results.json`: 161 scripted checks (theme class, no section overflow, the page width is not widened by the new section — the preview page is 414 px wide at 390 px even without it, from existing preview content —, per card controls and links, prefilled values, hover colour change, keyboard reach and focus ring, saved/saving/error texts, destructive alerts, links and hrefs, Edit link in the actions slot with Start still the primary action, no page errors); 0 failed.

## Browser run of the Phase 2 manual steps 2.7–2.10 (by script, not a human)

`e2e-results.json` and `e2e-*.png`: Playwright against `npm run preview` (production build, workerd), real middleware and local Supabase, two throw-away users via GoTrue admin `generate_link` (deleted at the end, cascade). 33 checks, 0 failed:

- 2.7: details → `Edit timer` → prefilled form → change name, exercise and repetitions → `Saved "…".`, form keeps the saved values and focus is on the name → `Back to timer` shows the new data (also after reload) → `Start` runs the new parameters (exercise counts down from 0:02, `Repetition 1 of 1`, completes) → dashboard lists the edited and the untouched timer.
- 2.8: duplicate name (other casing) → field error, typed name and parameters stay; case-only rename of the own name saves; 200 characters save; 201 is refused with the name error and the value stays; a parameter change removes a stale `Saved` message.
- 2.9: second user on a foreign id, a random UUID and `/not-a-uuid` at `/{x}/edit` → identical 404 view (no id, no timer name), a foreign `PUT` → 404, the owner's timer unchanged; guest `/{uuid}/edit` → 302 `/auth/signin?next=%2F{uuid}%2Fedit`, guest `/not-a-uuid/edit` → 404 without redirect.
- 2.10: Tab order Name → Preparation → Exercise → Rest → Repetitions → `Save changes` (with the signal buttons in between); `Save changes` and `Edit timer` show a focus ring; Enter on `Save changes` saves and returns focus to the name; Enter on the focused `Edit timer` opens the edit page.
- Extra: the row deleted behind the form's back → not-found alert with `Back to dashboard`; the session cleared → unauthorized alert whose sign-in link returns to `/{id}/edit`; typed values stay in both cases.

Not covered by the script (still open for a human): bfcache Back after saving, real devices, sound, screen reader.
