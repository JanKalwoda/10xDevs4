---
change_id: edit-saved-drill
title: Edit own saved timer (name and parameters)
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

S-12 (FR-012): the signed-in user edits the name and parameters (no phase colors) of one own saved timer without touching others; per-user case-insensitive name uniqueness and the 200-character name limit apply to edits too. Reuse the S-10/S-11 service, DTOs and form. Leave room for a future Delete action (S-13), not implemented here.
