# S-08 restart-whole-drill — Coordinator Handoff

## Checkpoint

Historical planning checkpoint (see Phase 1 status at the end of this file).

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

## Phase 1 status — 2026-10-05

**Zrobione (commit fazy 1, SHA w Progress):** Restart w środkowym slocie paska (`DrillTimerView`, `RotateCcw`, 48 px, `aria-label="Restart drill"`); `DrillTimer` ma wspólny `retireIntent` dla Cancel/Restart (synchroniczny latch + idempotentny dispose); `DrillApp` używa `drill-run-identity` (begin/isCurrent/retire/complete), `key={identity}`, a Start i Restart tworzą zasoby (audio + Wake Lock) synchronicznie w geście przez wspólne `createActiveRun`; `TimerUiPreview` ma `onRestart` w 3 miejscach (stub rejestrujący). Testy: `drill-run-identity.test.ts`, 3 nowe testy w `drill-run.test.ts` (pełne Preparation po stop, zero-prep random z nową próbką, zero-prep bez random). Bramki lokalne: lint, npm test (68), testy reguł ESLint, astro check, build — PASS.

**Weryfikacja ręczna (wykonana automatem Playwright na `/` dev 4322, wymaga potwierdzenia człowieka — 1.3/1.4 nieodhaczone):** Restart po późniejszym powtórzeniu wraca do Preparation 0:03 (prep>0), do Exercise rep 1 (prep 0, bez random) i do Standby rep 1 (prep 0, random); ustawienia zachowane po Cancel; podwójny klik nie psuje stanu; hitboxy 48x48 w stałych pozycjach (1280/390). Screenshoty: `screenshots/phase-1/restart-{1280,390}-{light,dark}.png`.

**Dalej:** Faza 2 (fixture z held-mounted replacement, port widoczności `drill-visibility.ts`, testy lifecycle, AGENTS.md, screenshoty 7 stanów w `screenshots/phase-2/`).

**Pułapki:** Astro 7 dev to daemon (`astro dev stop` do zatrzymania; start potrafi przekroczyć 30 s przy pierwszym uruchomieniu — ponów). Playwright nie jest w repo; użyto `playwright-core` z katalogu tymczasowego i chromium z `%LOCALAPPDATA%\ms-playwright`. Preview `onRestart` w fazie 1 tylko rejestruje komunikat; pełna wymiana runu to faza 2. Roadmap S-08 ustawiona na in-progress.

## Phase 2 status — 2026-10-06

**Zrobione (commit fazy 2: 9a2b9d2):** `src/lib/drill-visibility.ts` (`DrillVisibilityPort`, `browserDrillVisibility`) używany przez `DrillTimer` (opcjonalny prop `visibility`); fixture `HeldMountedRestartFixture` w `TimerUiPreview.tsx` (klasa `RestartLab`: współdzielony `drill-run-identity`, paczka zasobów na tożsamość, zachowane ukryte stare dzieci, `captureActiveWake`/`fireCapturedWake`, sterowalna widoczność wspólna z `WakeLockSession`); testy Node: martwy wake/tick starego runu, późny grant Wake Lock i zdarzenie hidden, późne audio inicjalne, stan Resume-pending, port widoczności; AGENTS.md (kontrakt Restart); screenshoty + README w `screenshots/phase-2/` (7 stanów, Empty = N/A, 1280/390, jasny/ciemny, plus `lifecycle-restart`).

**Bramki lokalne:** astro sync, lint, npm test (74), testy reguł ESLint (4), astro check (0/0/0), build — PASS. Break-check: usunięcie guardów `generation` + `finished` w `DrillRun` -> nowy test i stary "stop cancels..." czerwone; usunięcie `unsubscribeHidden` w sesji Wake Lock i `close()` w inicjalizatorze audio -> testy czerwone; zmiany odwrócone `git checkout`.

**Weryfikacja ręczna (2.3/2.4) — skryptem Playwright, NIE człowiek:** 40/40 asercji na `/dev/timer-ui` (Restart przy init/active/paused/pending Resume, stary wake odpalony po wymianie, odrzucone stare completion/intencje, hide przy oczekującej wymianie, show nie wznawia ani nie ponawia Wake Lock, podwójne Restart, Restart->Cancel, idempotentny unmount) i 16/16 na produkcyjnym `/` (stale wake przechwycony z `setTimeout`, szybkie Restart, Restart->Cancel zachowuje ustawienia, visibility, stare completion nie kończy nowego runu). Pułapka: `click()` dwa razy w tym samym tasku trafia w ten sam przycisk (React nie zdążył przerenderować) — drugi klik zatrzymuje latch w `DrillTimer`.

**Otwarte:** 2.2 (druga część: smoke w CI na finalnym HEAD PR oraz 404 `/dev/timer-ui` na produkcji) — zostaje dla koordynatora, nie odhaczone.

## Naprawa findings z impl-review — 2026-10-06

F1 (DrillApp używa `browserDrillVisibility`), F3 (`fireCapturedWake` zwraca realny sygnał z licznika wywołań owiniętego callbacku) i F4 (`useState(createDrillRunIdentityState)`) naprawione w jednym commicie fix. F2 zostaje udokumentowane: kroki 1.3/1.4/2.3/2.4 zweryfikował skrypt Playwright, nie człowiek. Bramki lokalne (astro sync, lint, npm test 74/74, testy reguł ESLint 4/4, astro check 0/0/0, build) PASS. Powtórzony Playwright: 40/40 na `/dev/timer-ui` i 16/16 na `/` (visibility, Restart, stale wake). Audio i Wake Lock bez testu na fizycznym urządzeniu. Otwarte: 2.2 (CI po pushu, 404 `/dev/timer-ui` na produkcji) — koordynator.

## Coordinator completion — 2026-10-06

- PR #36 merged as 3e136ad into main; CI, production-preview smoke and deploy are green on main.
- Production (checked by the coordinator): `/` = 200, `/dev/timer-ui` = 404.
- Progress 2.2 is complete. S-08 is done in the roadmap.
