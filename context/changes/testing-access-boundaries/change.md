---
change_id: testing-access-boundaries
title: Test rollout phase 1 — access, ownership, redirect and API validation boundaries
status: implementing
created: 2026-10-11
updated: 2026-10-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Access and ownership boundaries".
Risks covered: #1 (signed-in user sees, edits or deletes another user's saved timer; foreign id must answer like a missing id), #2 (guest gets content or mutates data on protected routes instead of redirect/denial), #5 (redirects and links land in the wrong place, or the return parameter redirects outside the app), #6 (form/API accepts an invalid configuration). Test types planned: integration (HTTP against local Supabase).
Risk response intent:
- #1: prove user B gets the identical 404 for user A's timer on read, edit, delete, details page and edit page, and A's data stays unchanged; do not mock the database client.
- #2: prove every protected route and method without a session ends in a redirect to sign-in or a denial, with no content and no database change; cover all methods, not one GET.
- #5: prove each transition (sign-in, save, edit, delete, back links) ends at the PRD address (assert Location, not only the status code) and a foreign return target is rejected.
- #6: prove the API rejects out-of-range values, empty or too-long names and the per-user limit regardless of the client; test invalid values, not only valid ones.
After creating the folder, follow the downstream continuation rule.
