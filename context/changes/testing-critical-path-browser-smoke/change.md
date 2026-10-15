---
change_id: testing-critical-path-browser-smoke
title: Test rollout Phase 3 — critical-path browser smoke (risks #3, #4, #5)
status: impl_reviewed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Critical-path browser smoke".
Risks covered: #3, #4, #5. Test types planned: e2e.
Risk response intent:

- #3: after Start, after Resume and after returning from a hidden page the signal is scheduled at the PRD moment and the audio output is active (observe the audio boundary, never assert on a mock copied from the implementation).
- #4: a short configuration (e.g. 1 s / 1 s / 1 s, 2 repetitions, random start) gives the PRD sequence of phases, times, repetitions and Next preview; Standby shows no time anywhere (oracle from the PRD, not from production logic).
- #5: every transition (sign-in, save, edit, delete, back links) ends on the PRD address; a foreign return address is rejected (check the target, not only the redirect code).
  Already done outside a change (standalone /10x-e2e runs on branch feature/m3l4, PR #64): Playwright setup + seed (#5 save -> /{id}, delete -> /timers), run-audio-signals.spec.ts (#3), run-phase-sequence.spec.ts (#4), saved-timer-navigation.spec.ts (#5 edit and back links), E2E suite wired into the CI smoke job. Research must verify these against the phase goal and name the remaining gaps (e.g. #5 sign-in landing on /timers and the return-address flow in the browser; the "formularz" part of the phase), plus the §4/§6.4/§6.6 bookkeeping.
  Git: do NOT create a new branch; continue on the current branch feature/m3l4 (PR #64).

### Research summary (2026-10-15, `research.md`)

- Suite green in CI on `4b98ae0` (run 38641885740: `5 passed`). #3 (Start, Resume, hidden page; real Web Audio through a pass-through spy) and #4 (PRD literal sequence, Standby leak check) cover the phase goal and close the React wiring Phase 2 deferred.
- #5 covered: save → `/{id}`, delete → `/timers`, list/edit/back links, default sign-in → `/timers` (only in `auth.setup.ts`).
- Gaps: (1) no layer completes a sign-in with a non-default `next` (guest `/create` → sign-in → `/create`); the browser-only hops `SignInForm` and the `callback.astro` script are untested, and the HTTP client accepts only `/`, `/dashboard`, `/timers`; foreign `next` is covered on HTTP only. (2) "Formularz": stepper click and ↑/↓ wiring were deferred by Phase 2 and have no e2e (belongs to #6, scope decision). (3) Optional: Start from a saved timer `/{id}`.
- Product question, not a test gap: FR-011 "wejściu i odświeżeniu" vs `/` rendering the guest form for signed-in users.
- Bookkeeping: §4 (e2e row, profile), §5 ("full Phase 3 pending"), §6.4 (TBD), §6.6 (Phase 3 notes), `test-stack.md:16`.
- Sources: no external docs needed (the existing Playwright patterns in the repo were enough; no exa or Context7 lookups).
