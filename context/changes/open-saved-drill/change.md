---
change_id: open-saved-drill
title: Open and run saved timers from the dashboard
status: in-progress
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

S-11 (FR-011): /dashboard lists the signed-in user's saved timers (name + parameters, empty-state text, keep the "Create a timer" link); /{id_timera} shows a saved timer and lets the user run it. Ownership via RLS; foreign/nonexistent/non-UUID id => 404. No resume of an active run after refresh. No edit/delete (S-12/S-13).
