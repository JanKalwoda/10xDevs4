# Phase 2 visual gate

Captured on 2026-10-04 from the local Astro dev server at port 4323 with cached Playwright Chromium. The screenshots are browser renders at 1280×800 and 390×844 in light and dark; the injected Astro dev toolbar is removed only from each temporary Playwright page, with no application change. Theme was selected through the persisted drill-timer-theme preference; no screenshot script toggled the document class. A separate browser check verified that no stored preference follows the operating-system color scheme and that a stored light preference overrides a dark system scheme.

Sign-in: default, hover, keyboard focus-visible, invalid-email error, and a held request showing both loading and disabled controls are captured. The empty state is N/A as this is an entry form with no collection or results; an empty field is the default and submitting it is the validation-error state.

Confirmation sent: default, hover, and keyboard focus-visible are captured. Disabled, error, empty, and loading are N/A because this is a static neutral receipt with synchronous navigation links and no pending operation.

Callback: default, hover, keyboard focus-visible, held POST showing loading and disabled states, invalid-link error, and missing-token (empty) retry state are captured. GET did not issue a callback POST. The response carried no-store/no-referrer headers; the callback page and shared layout made no third-party network requests.

Root shell: guest account-link default, hover, focus-visible, and the guest timer are captured. Disabled, error, empty, and loading are N/A for the account link because it is synchronous navigation; timer controls retain their separate UI contract and were not modified. The nav was checked for overlap and horizontal overflow at both widths.

The authenticated account-link branch reads Astro.locals.user and points to /dashboard; visual session verification remains for Phase 3 local Supabase E2E. No timer components, global CSS, Layout, or shared UI components were changed.
