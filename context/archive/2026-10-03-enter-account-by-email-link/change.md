---
change_id: enter-account-by-email-link
title: Account entry by email link
status: archived
created: 2026-10-03
updated: 2026-10-06
archived_at: 2026-10-06T20:40:50Z
---

## Notes

Implement FR009 as one email-only magic-link flow for new and existing accounts. Keep the timer available to guests at `/`, preserve the SSR cookie session and protected dashboard, and require an explicit POST from a no-store, no-referrer confirmation page before consuming a token. The plan requires local email confirmations and uses the same `type=email` callback in confirmation and magic_link templates; allow `localhost:4321` for CI and `localhost:4323` for auth dev, adding 127.0.0.1 only if used. Node tests cover a pure injected boundary; local Mailpit E2E proves actual Astro SSR cookie persistence. Use the `/10x-ui` matrix for existing views, coordinate shared CSS/Layout/components, and leave timer components untouched. Phase 3 adds `observability.redact_query_string=true` while keeping Worker observability enabled; app logs omit token URLs, browser history remains a limitation, and generated deploy config is checked before merge. Remote smoke covers public routes and dashboard protection only; production magic-link verification remains a manual completion gate.

Completion confirmed by the user on 2026-10-04 after production deployment at 3117e51: magic-link delivery/login, timer, authenticated dashboard and sign-out passed. All plan Progress gates are complete. Status remains impl_reviewed until archival.
