# Test rollout Phase 2 — przebieg, sygnały i formularz — Plan Brief

> Full plan: `context/changes/testing-run-flow-form-behaviour/plan.md`
> Research: `context/changes/testing-run-flow-form-behaviour/research.md`

## What & Why

Faza 2 rolloutu z `context/foundation/test-plan.md` ma dowieść ryzyk #3 (brak sygnału na starcie, po wznowieniu, po powrocie z ukrytej karty), #4 (zła faza, czas, powtórzenie, wznowienie złego powtórzenia, Standby ujawnia czas) i #6 (nieprawidłowa konfiguracja, jeden klik strzałki ≠ jeden krok). Autor weryfikuje aplikację ręcznie, więc testy muszą łapać regresje z wyrocznią z PRD, nie z kodu.

## Starting Point

Logika przebiegu, sygnałów i strzałek to czysty TS w `src/lib` z portami (zegar, losowanie, audio, widoczność) i ma już sporo testów, ale z lukami: brak literalnej osi czasu krótkiej konfiguracji, brak dowodu nowego losowania po wznowieniu, tolerancja `< 0.2` nieodróżniająca pierwszego i drugiego dźwięku Standby, test lustrzany podglądu Next, czasy dźwięków skopiowane z implementacji. Komponenty `.tsx` nie mają testów i nie da się ich uruchomić w `node --test` bez nowych zależności.

## Desired End State

`npm test` zawiera trzy nowe pliki testów „run-level integration” (sekwencja i wznowienie, sygnały przez prawdziwy `createDrillAudio`, kontrakt strzałka ↔ parser) z wyrocznią z PRD, a słabe istniejące asercje są zaostrzone. Każda faza ma udokumentowaną kontrolę „zepsuj linię → czerwony test”. `test-plan.md §6.3` mówi, jak dodać kolejny taki test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa testów | `node --test` na prawdziwych modułach `src/lib` z fałszywym zegarem, losowaniem i `AudioContext` | Cała logika ryzyk jest czysta i ma porty; to najtańszy test z realnym sygnałem | Research |
| Nowe zależności (DOM, JSX) | Brak (`happy-dom`, `tsx`, `@testing-library` odrzucone) | Gest i audio i tak byłyby fałszywe; okablowanie React lepiej dowiedzie e2e | Koordynator (D1 = A) |
| Okablowanie React | Faza 3 rolloutu (e2e) | Wymaga prawdziwego gestu i `visibilitychange` | Research + koordynator |
| #6 API, baza, limit | Bez nowych przypadków | Pokryte w fazie 1, unit i pgTAP | Research |
| Zaokrąglenie odliczania | Nieprzypinane; próbki na starcie fazy i w pełnych sekundach | PRD nie ustala ceil vs floor | Research + koordynator |
| Losowanie w testach | Skrypt z krańców zakresu PRD (1,00 s i 5,00 s), różne wartości przed i po pauzie | Oczekiwanie wynika z PRD, a nowe losowanie jest obserwowalne | Plan |
| Dźwięki | Relacje z PRD (inna wysokość Standby, ćwiczenie dłuższe), nie stałe `CUE_*` | Unika testu lustrzanego | Plan |
| Fałszywki | Lokalnie w każdym pliku testów | Konwencja repo (brak wspólnego helpera) | Plan |
| Stryker | Opcjonalny krok ręczny na `drill-run.ts` | Selektywna bramka po fazie ryzyka, nie CI | Koordynator |
| Błąd w kodzie wykryty testem | Stop i zgłoszenie koordynatorowi, bez naprawy | Faza testowa nie zmienia kodu produkcyjnego | Plan |

## Scope

**In scope:**
- `src/lib/drill-run-flow.test.ts` (sekwencja US-01/US-02, pauza i wznowienie FR-006)
- `src/lib/drill-run-signals.test.ts` (sygnały FR-004/FR-002/NFR, wznowienie z nowym portem, kontekst niestartujący)
- `src/lib/drill-stepper-contract.test.ts` (FR-001/FR-020)
- zaostrzenie `drill-run.test.ts` (`:115`, `:227`, `:258`) i `drill-phase-sections.test.ts` (`:103`, `:205`)
- poprawka komentarza `tests/integration/api-validation.test.mjs:2`
- `test-plan.md` §3 (status), §6.3, §6.6

**Out of scope:**
- testy `.tsx`, DOM, nowe zależności
- nowe przypadki HTTP, bazy i limitu
- realne wyjście dźwięku, Bluetooth, iOS
- zmiany kodu produkcyjnego
- edycja `test-plan.md` §1, §2, §4, §5, §7 (tylko raport do koordynatora)

## Architecture / Approach

Każdy test składa prawdziwy łańcuch `DrillRun` → `display` → `buildPhaseSections` / `currentPhaseBody` / `nextPhaseBody` (to, co renderuje widok, bez Reacta), a dla sygnałów dodatkowo prawdziwy `createDrillAudio` na fałszywym `AudioContext`, który zapisuje oscylatory. Fałszywe są tylko granice: zegar `DrillClock` powiązany z `performance.now`, skryptowany `random` i `AudioContext`. Oczekiwane wartości to tabele literałów z PRD.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. #4 sekwencja z PRD | Literalna oś czasu 4 konfiguracji, Standby bez czasu, usunięty test lustrzany | Próbkowanie na granicy faz przypnie zaokrąglenie |
| 2. #4 pauza i wznowienie | Wszystkie gałęzie FR-006, nowe losowanie, przygotowanie 0 | Test może ujawnić rozbieżność kodu z PRD (wtedy stop) |
| 3. #3 sygnały | Moment i relacje dźwięków, wznowienie z nowym portem, kontekst niestartujący | Zegar i `currentTime` w różnych osiach dadzą fałszywie zielony test |
| 4. #6 strzałka ↔ parser | Cały zakres pól przyjmowany przez parser, granice z PRD | Wyrocznia wzięta z `STEPPER_LIMITS` zamiast z PRD |
| 5. Cookbook i status | §6.3, §6.6, §3 `complete`, opcjonalny Stryker | Edycja zakazanych sekcji test-planu |

**Prerequisites:** Node 24.21.0, `npm ci`; bez Supabase i bez preview (testy czysto lokalne).
**Estimated effort:** ~5 krótkich sesji, jedna podfaza na sesję, commit na podfazę.

## Open Risks & Assumptions

- Test z wyrocznią PRD może ujawnić błąd w kodzie (np. w gałęzi wznowienia przy przygotowaniu 0); plan zakłada zatrzymanie i zgłoszenie, nie naprawę.
- Okablowanie React pozostaje niepokryte do fazy 3; regresja typu „Resume wywołuje `resume()` zamiast `resumeWithAudio`” w `.tsx` przejdzie przez fazę 2.
- Korekty do test-plan §2 (#3 warstwa dzielona, #6 API już pokryte, hot-spot `src/components/timer` to cienka powłoka) oraz wiersz §4 „component” i bramka §5 wymagają decyzji koordynatora.

## Success Criteria (Summary)

- Zepsucie kolejności faz, wznowienia, momentu dźwięku lub granicy strzałki daje czerwony `npm test` w CI.
- Każda oczekiwana wartość w nowych testach wynika z PRD, nie z kodu.
- Kolejny test przebiegu lub formularza da się napisać według §6.3 bez czytania tego planu.
