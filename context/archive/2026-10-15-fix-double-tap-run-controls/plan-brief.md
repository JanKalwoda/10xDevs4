# Double click or tap on run controls — Plan Brief

> Full plan: `context/changes/fix-double-tap-run-controls/plan.md`
> Research: `context/changes/fix-double-tap-run-controls/research.md`

## What & Why

Podwójny klik albo dwa szybkie dotknięcia Restart drill tworzą dwa nowe biegi, a na Pause drill wstrzymują i od razu wznawiają bieg. PRD wymaga sterowania „odpornego na przypadkowe dotknięcia”, a ryzyko #7 test-planu mówi wprost: jedno kliknięcie lub dotknięcie to jedna akcja. Dwa testy e2e potwierdzają błąd i są dziś oznaczone `test.fail()`.

## Starting Point

Drugi klik trafia w nowy przycisk w tym samym miejscu: po Restart montuje się nowy `DrillTimer` ze świeżym zatrzaskiem, a po Pause w tym samym slocie pojawia się Resume. Save i Delete mają stan „w toku”, Start jest odporny tylko przypadkiem (geometria), a Restart i Pause nie mają żadnej ochrony.

## Desired End State

Przez 500 ms po Start, Restart, Pause albo Resume przycisk Restart i przełącznik Pause/Resume są przygaszone (`aria-disabled`) i ignorują aktywację. Potem same wracają do stanu aktywnego. Cancel działa zawsze. Podwójny gest wykonuje jedną akcję w obu projektach e2e, a istniejące testy przechodzą bez zmian.

## Key Decisions Made

| Decision                                        | Choice                                                   | Why (1 sentence)                                                                              | Source                          |
| ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| Dyskryminator podwójnego gestu                  | Czas od poprzedniej akcji paska                          | `event.detail` przy dotyku jest zawsze `1` (iOS Safari, emulacja w Chromium)                  | Research                        |
| Gdzie żyje stan                                 | Jedna blokada w `DrillApp`, prop do `DrillTimer`         | Restart przemontowuje `DrillTimer`, więc stan w instancji by przepadł                         | Research                        |
| Długość okna                                    | 500 ms                                                   | Pełny domyślny interwał podwójnego kliknięcia w Windows obejmuje też wolniejsze dotknięcia    | Plan                            |
| Jak wystawić blokadę                            | `aria-disabled` + `opacity-50` + wyjątek w CLAUDE.md     | Testy czekają na stan bez `waitForTimeout`, a użytkownik widzi, że przycisk chwilę nie działa | Plan                            |
| Zakres                                          | Okno po Start, Restart, Pause i Resume; Cancel nigdy     | Jedna reguła, Start przestaje być odporny tylko przypadkiem                                   | Plan                            |
| Klawiatura i AT                                 | Ta sama blokada                                          | Spójny stan `aria-disabled`; chroni też przed autorepeat Enter/Spacji                         | Plan                            |
| `aria-disabled` na samym przycisku a Playwright | Wystarcza (`hasAriaDisabledInChain` zaczyna od elementu) | Rozstrzyga otwarte pytanie z badania; repo już na tym polega (`key-screen-layout.spec.ts:51`) | Plan (źródła Playwright 1.64.1) |

## Scope

**In scope:**

- Czysty moduł `src/lib/drill-control-guard.ts` z testem z fałszywym zegarem
- Podpięcie w `DrillApp`, `DrillTimer` i `DrillTimerView`
- Usunięcie dwóch `test.fail()`
- Fixtures „controls locked” w `/dev/timer-ui` i zrzuty
- Wyjątek w CLAUDE.md i AGENTS.md

**Out of scope:**

- Blokada Cancel i okno po Cancel
- Blokada samego Startu i przycisków formularza
- Zmiany guardu tożsamości, audio i Wake Lock
- Fokus przy zamianie Pause↔Resume
- Wpięcie blokady w bramki held-mounted (zostają z wariantem nieblokującym)

## Architecture / Approach

`DrillApp` tworzy `createDrillControlGuard(browserDrillClock)` i otwiera okno w `start` przez `arm()`, które zawsze liczy 500 ms od nowa. Cleanup efektu woła `reset()`, które zostawia blokadę używalną po StrictMode i Fast Refresh. Stan to jedna flaga gaszona przez wybudzenie, nie liczenie z czasu. `DrillTimer` dostaje go jako opcjonalny prop (domyślnie `unlockedDrillControlGuard`) i woła `tryActivate()` przed `retireIntent` (Restart) oraz przed pauzą i wznowieniem. Subskrybuje też stan i podaje `controlsLocked` do `DrillTimerView`, który ustawia `aria-disabled` na Restart i Pause/Resume. Uwaga na jednostki: `clock.now()` zwraca sekundy, `setWake` przyjmuje milisekundy.

## Phases at a Glance

| Phase                         | What it delivers                                                                                         | Key risk                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Moduł blokady              | `drill-control-guard.ts` i testy graniczne 0.499/0.5 s                                                   | Pomylenie sekund z milisekundami                                    |
| 2. Podpięcie i e2e            | Naprawiony podwójny Restart i Pause, usunięte `test.fail()`                                              | Odrzucony Restart po `retireIntent` zostawi martwy bieg (kolejność) |
| 3. Fixtures, zrzuty, kontrakt | Stan „controls locked” w podglądzie, zrzuty, regresja istniejących bramek, wyjątek w CLAUDE.md/AGENTS.md | Rozjazd treści CLAUDE.md i AGENTS.md                                |

**Prerequisites:** gałąź `fix/double-tap-run-controls`; lokalny Supabase i Mailpit do `npx playwright test`.
**Estimated effort:** ~1–2 sesje w 3 fazach.

## Open Risks & Assumptions

- Przygaszenie Restart i Pause/Resume na 500 ms po każdej akcji jest widoczne. Zaakceptowane jako sygnał, do oceny na zrzutach w fazie 3.
- Testy przebiegu (`run-phase-sequence`, `run-audio-signals`) wydłużą się o najwyżej 500 ms na akcję, bo `click()` poczeka na Enabled. Nie zmienia to sekwencji faz (pauza wraca przez pełne Preparation).
- Podwójny Cancel nie jest objęty i nie był mierzony.

## Success Criteria (Summary)

- Podwójny klik i dotknięcie Restart dają jeden nowy bieg, a podwójne Pause zostawia pauzę, w `chromium` i `mobile-coarse`.
- Cancel działa od razu w każdym stanie, a pojedyncze akcje i istniejące przebiegi przechodzą bez zmian w testach.
- Stan „controls locked” jest widoczny w `/dev/timer-ui` i przejrzany na zrzutach.
