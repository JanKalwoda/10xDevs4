# Mutation review: `src/lib/drill-run.ts` (faza 2 rolloutu)

Polecenie: `npm run test:mutation -- --mutate "src/lib/drill-run.ts"` (2026-10-12, StrykerJS 10.0.0, tap runner).
Wynik: 65,50% (291 zabitych, 26 timeout, 146 przetrwałych, 21 bez pokrycia, 0 błędów). Zgodnie z §6.7 nie gonimy 100%; przetrwałe mutanty pogrupowano po zachowaniu i oceniono pytaniem „czy ta zmiana zaszkodziłaby użytkownikowi lub firmie?”. Nie dodano nowych asercji w tej fazie (patrz „Do rozważenia”).

| moduł (linie) | mutant | decyzja | dlaczego |
|---|---|---|---|
| `browserDrillClock` (13-17) | zegar przeglądarki: `performance.now()/1000`, `setTimeout`, `clearTimeout` | ignoruj | Testy używają `FakeClock`; prawdziwy zegar przeglądarki to okablowanie dla e2e (§3 Phase 3). |
| pola klasy (51, 55, 60) | wartości początkowe `[]`, `false` | ignoruj | Równoważne: pola są nadpisywane w `start`/`rebuild` przed pierwszym odczytem. |
| `armWake` i wake (339-353) | `wakeAt`, `(wakeAt - now) * 1000`, `generation`, `fillAt`, `clearWake` | do e2e | Planowanie budzenia `setTimeout` dla prawdziwego czasu; testy sterują `tick()` ręcznie. Błąd skali (×1000 ↔ /1000) zepsułby odliczanie w przeglądarce, więc łapie go dopiero smoke e2e (Phase 3), nie `node --test`. |
| `recover`/`resumeWithAudio` obsługa błędów (161-190, 233-238) | flagi `recovering`, `recoveryGeneration`, `catch`, `replacement?.close()` | do rozważenia | Wyścigi podwójnego Resume i zamykanie zastępczego kontekstu; ścieżki istnieją po incydencie `2026-10-01-recover-timer-audio`, ale oracle PRD nie opisuje wyścigu, tylko „wznowienie przywraca dźwięk” (to dowodzi `drill-run-signals.test.ts`). |
| `onUnavailable`, `audioFailed` (180-181, 289-292, 333-334) | `catch`/`silent = true`, `cancel()` | do rozważenia | Awaria audio w trakcie przebiegu: przebieg ma iść dalej po cichu. Oracle (PRD NFR/FR-004) jest ogólny, a wywołanie awarii wymaga stuba rzucającego w `schedule`; kandydat na następną zmianę. |
| `display` w pauzie (93) i `scheduleEvidence` (86) | `String`/`Conditional` w `remainingSeconds`, `ArrayDeclaration` | ignoruj | `remainingSeconds` w Standby nie jest czytane przez model widoku (plan, Key Discoveries); evidence służy diagnostyce odchylenia, nie zachowaniu z PRD. |
| `tick`: granica `now < segment.end` i `completed` (99, 124-133, 142-144, 214-220) | `<` → `<=`, `Conditional` | ignoruj | Próbkowanie na granicy faz jest świadomie poza oraclem (PRD nie ustala zaokrąglenia, plan: próbkuj na starcie fazy i w pełnych sekundach). |
| `resumeTarget` (111, 125-126) | czyszczenie po przygotowaniu | ignoruj | Zachowanie pokrywa `drill-run-flow.test.ts` (to samo powtórzenie po wznowieniu); mutanty przy czyszczeniu są równoważne, bo `resumeTarget` jest ustawiane od nowa przy każdym `resume`. |
| `hide`/`resume` wykonanie (139-156, 209-228) | `Conditional`, `invalidate`, `listener`, `this.tick()` | do rozważenia | Rozgałęzienia `hide` w trakcie Standby (`beforeSecondSound`, `remainingWait`) nie mają asercji na wewnętrzne wartości; zewnętrznie (nowe losowanie, pełne przygotowanie, pozostały czas) dowodzą je testy FR-006. Dodanie asercji na `remainingWait` byłoby przypięciem szczegółu implementacji. |
| `rebuild`: warunki dźwięków (266-287) | `Conditional`, `LogicalOperator` przy `entryCue`, `firstSegment` | do rozważenia | Część zabijają testy sygnałów; pozostałe dotyczą kombinacji, których PRD nie rozróżnia obserwowalnie (np. `!this.silent`). |
| `appendLookahead` (309-331) | `start >= now - 0.001`, `finishCycle` | do rozważenia | Dolna granica 0,001 s to tolerancja kosmetyczna; `finishCycle` łapie sekwencja z `drill-run-flow.test.ts` dla pełnego przebiegu. |

## Do rozważenia (kandydaci na kolejną zmianę, wymagają wyroczni PRD)

- Awaria audio w trakcie przebiegu (`audioFailed`, `silent`): przebieg ma iść dalej z `audioAvailable: false` i niezmienioną osią faz; stub `schedule` rzucający wyjątek z hermetyczną asercją osi czasu.
- Podwójny Resume (`recovering`): drugie `resumeWithAudio` w trakcie pierwszego nie może utworzyć drugiego kontekstu ani zagrać sygnału dwa razy.
- Wszystkie pozostałe grupy: `ignoruj` albo e2e (planowanie `setTimeout`, zegar przeglądarki).

Nie zmieniono `stryker.config.json`.
