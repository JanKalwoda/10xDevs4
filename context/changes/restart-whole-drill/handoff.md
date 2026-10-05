# S-08 restart-whole-drill — Coordinator Handoff

## Checkpoint

S-08 is research/planning only. Do not implement in this checkpoint. The change metadata is `planned`; the full plan and brief are ready for independent deep plan review. Planning artifacts will be committed separately from all future code phases.

## Base and worktrees

- Planning: `D:/Dev/10xDevs4-restart-whole-drill`, branch `feature/restart-whole-drill`, source base `34e8b7d1b942dbb40185727a17e4ee534be3c396`.
- Lifecycle research: `D:/Dev/10xDevs4-restart-whole-drill-research-lifecycle`, branch `feature/restart-whole-drill-research-lifecycle`, read-only and clean.
- UI research: `D:/Dev/10xDevs4-restart-whole-drill-research-ui`, branch `feature/restart-whole-drill-research-ui`, read-only and clean.
- Coordinator reports PR #34 merged at main `45951a61e599215684e28d403665ce9824db8daa`. Synchronize the S-08 implementation branch with that main before the first implementation change; this planning checkpoint intentionally remains based on its original `34e8b7d` base.
- Roadmap item `restart-whole-drill` remains `ready`; it was inspected but not edited per coordinator instruction. S-07 docs/status were not edited.

## Review questions

1. Product assumption: does FR-008 expose Restart only while a timer run is mounted, leaving the Completed → Return to configuration view unchanged? The plan assumes yes because Restart was placed in the in-run control bar.
2. Test seam: the repo declares Node library tests and a held-mounted production `DrillTimer` preview fixture, but no React DOM/browser test runner. The current preview does not replace the production parent run. Review whether a narrow run-identity unit seam plus production-backed held-mounted preview is sufficient to prove stale parent completion, or specify another no-dependency timer seam. No dependency is proposed.
3. Confirm the two-phase split and per-phase separate commit gates.

## Model and run constraints

No model switch was performed. The available collaboration selector exposes GPT-6-Luna with `max` as its highest effort value and no separate `xHigh` value; both research agents were explicitly launched with Luna `max` as the closest exposed setting. All researcher tool calls after correction used their own worktree.

No tests or servers were run. Local Supabase on port 55321 was not touched. Later manual browser checks should use dev port 4322 and stop only the PID started for this worktree.

## Coordinator review checkpoint — 2026-10-05

Planning commit: 11e79da864ca9892e7dc8ac8b74255c7902840f9. Successful native compact (22s), verified clear and GPT-6-Luna xHigh restoration completed before further agent work. No implementation started.

Coordinator confirms Completed stays unchanged and the two-phase split. Deep review found four targeted gaps; the plan now names required callback consumers and build gates, the shared production identity guard, per-run held fixture resources/exact captured wake/visibility port, and coordinator CI after the Phase 2 commit. Focused verification accepted the corrected contracts; the remaining overview sentence was clarified by the coordinator. The final plan verdict is SOUND. Main 45951a6 is merged into this branch. npm ci completed in this worktree; no dependency manifest was changed.

Future native work must use GPT-6-Luna xHigh. The native reasoning menu exposes Extra high separately from More reasoning/Max. If a native collaboration tool cannot select xHigh, route required delegation to the coordinator rather than substituting Max. Existing research work remains attributed to its actual Luna Max setting.

## Next authorized phase

Implement only Phase 1 using /10x-implement restart-whole-drill phase 1 in this worktree. Read the full corrected plan, research, brief, reviews, AGENTS and lessons. Phase 1 must update every required callback consumer, pass its local tests/sync/check/build and browser/screenshot gates, then commit code/tests separately and record SHA in Progress/handoff. Stop for coordinator compact/clear before Phase 2. PR CI stays a post-push coordinator gate. Root handles any delegation requiring Luna xHigh if the native collaboration selector cannot express it.
