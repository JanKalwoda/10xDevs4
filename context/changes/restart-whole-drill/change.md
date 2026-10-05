---
change_id: restart-whole-drill
title: Restart the entire drill from its first phase
status: planned
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

Implement FR-008 restart-whole-drill in the existing `/` timer view using the Ocean Breeze design system. Restart the complete drill from its first configured phase without confirmation, preserve settings, and regenerate randomized selections when random mode is enabled. Keep Restart in the middle slot of the timer bar below time, count, and repetition; preserve Cancel/Pause/Resume positions, shared Button and semantic token conventions. Reuse S-06 idempotent disposal and S-07 run ownership while preventing prior progress, paused state, resume target, sampled wait, audio, Wake Lock, visibility events, and completions from leaking across runs.
