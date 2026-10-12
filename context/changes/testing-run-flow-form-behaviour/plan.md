# Test rollout Phase 2 — przebieg, sygnały i formularz: plan wdrożenia

## Overview

Dowodzimy ryzyk #3, #4 i #6 z `context/foundation/test-plan.md §2` testami „run-level integration” w `node --test`, bez przeglądarki i bez nowych zależności (decyzja koordynatora D1 = A, 2026-10-12). Testy składają prawdziwe moduły: `DrillRun` (`src/lib/drill-run.ts`), model widoku `buildPhaseSections` / `currentPhaseBody` / `nextPhaseBody` (`src/lib/drill-phase-sections.ts`) i `createDrillAudio` (`src/lib/drill-audio.ts`) na fałszywym `AudioContext`. Czas daje fałszywy zegar `DrillClock`, a losowanie skrypt. Wyrocznia to literały i relacje z PRD (US-01, US-02, FR-001–FR-006, FR-013, FR-018, FR-020, NFR, Business Logic), nigdy wynik kodu produkcyjnego. Wzmacniamy też istniejące słabe testy wskazane w `research.md`. Ostatnia faza aktualizuje cookbook `test-plan.md §6.3`, notatkę `§6.6` i status w `§3`.

## Current State Analysis

- Cała logika ryzyk #3, #4 i #6 jest czystym TS w `src/lib` z portami: `DrillClock` (`drill-run.ts:7-11`), `random` w konstruktorze `DrillRun` (`drill-run.ts:63-69`), `DrillAudioPort` (`drill-audio.ts:31-38`), `DrillVisibilityPort` (`drill-visibility.ts:1-4`). `npm test` (`node --test src/lib/*.test.ts src/lib/services/*.test.ts`) uruchamia nowe pliki `src/lib/*.test.ts` w CI bez zmian workflow.
- `.tsx` nie da się zaimportować w `node --test` (`ERR_UNKNOWN_FILE_EXTENSION`), brak DOM. Okablowanie React (Resume → `resumeWithAudio`, ukryta karta → `hide()`, audio w geście Start, handlery `ConfigStepper`) zostaje do fazy 3 rolloutu (e2e).
- Każdy istniejący plik testowy definiuje własne fałszywki lokalnie (np. `FakeClock`/`FakeAudio` w `drill-run.test.ts:16-71`, `FakeContext` w `drill-audio.test.ts:26-60`); nie ma wspólnego modułu pomocniczego. Trzymamy się tej konwencji.
- Słabe miejsca w istniejących testach (`research.md`, sprawdzone):
  - `drill-run.test.ts:115` — tolerancja `< 0.2` nie odróżnia oczekiwania liczonego od końca pierwszego i drugiego dźwięku Standby (różnica 0,15 s);
  - `drill-run.test.ts:227`, `:258` — stały `random = () => 0`, więc wznowienie z ponownie użytym losowaniem przechodzi;
  - `drill-phase-sections.test.ts:103` — test lustrzany (oczekiwanie i obserwacja z `nextDrillPhase`);
  - `drill-phase-sections.test.ts:205` — `random = () => 1` daje 5,01 s, poza zakresem PRD;
  - `FakeAudio.scheduleEvidence` zawsze ma odchylenie 0 (`drill-run.test.ts:47`), a czasy 0.3/0.45/0.35 są skopiowane z `CUE_DURATION`.
- Ryzyko #6 po stronie API, bazy i limitu jest już pokryte (faza 1, unit, pgTAP). Lukę stanowi kontrakt strzałki ↔ parser: `STEPPER_LIMITS` (`drill-stepper.ts:15-20`) i `TIME_SHAPE` (`drill-stepper.ts:23`) to własna kopia reguł z `parseDrillTime` (`drill-timer.ts:18-34`).
- `tests/integration/api-validation.test.mjs:2` ma błędny komentarz „rest at most 59:59” (PRD FR-001: 0–600 s).

## Desired End State

- `npm test` zawiera trzy nowe pliki: `src/lib/drill-run-flow.test.ts` (sekwencja i pauza/wznowienie, #4), `src/lib/drill-run-signals.test.ts` (sygnały przez prawdziwy `createDrillAudio`, #3), `src/lib/drill-stepper-contract.test.ts` (strzałka ↔ parser, #6). Wszystkie oczekiwane wartości to literały z PRD albo relacje z PRD.
- Wskazane słabe asercje w `drill-run.test.ts` i `drill-phase-sections.test.ts` są zaostrzone lub zastąpione literałami.
- Każda faza ma ręczną kontrolę „czy test łapie regresję”: celowe zepsucie jednej linii produkcyjnej daje czerwony test, potem przywrócenie.
- `test-plan.md §6.3` opisuje, jak dodać test przebiegu lub formularza, `§6.6` ma notatkę fazy 2, a `§3` status `complete`.

Weryfikacja: `npm run lint`, `npm test`, `npx astro check` i `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs` są zielone po każdej fazie.

### Key Discoveries:

- `DrillRun.display` (`drill-run.ts:96-108`): `remainingSeconds = Math.max(0, Math.ceil(current.end - now))`, `null` w Standby. PRD nie ustala zaokrąglenia, więc testy próbkują tylko w chwilach, w których ceil i floor dają to samo: na starcie fazy i w pełnych sekundach od jej początku.
- `resume()` (`drill-run.ts:186-206`) ma trzy gałęzie: Standby/Exercise z przygotowaniem > 0, Standby/Exercise z przygotowaniem 0 i Preparation/Rest (kontynuacja bez sygnału). Gałąź „Exercise z przygotowaniem 0” nie ma dziś testu.
- `createDrillAudio` (`drill-audio.ts:58-147`) liczy kotwicę `performance.now() / 1000 - context.currentTime` raz (`:87`) i planuje dźwięk na `Math.max(at - anchor, context.currentTime)` (`:114`). Test integracyjny musi więc wiązać fałszywy zegar z `performance.now` (patrz Critical Implementation Details).
- `CUE_PITCH` jest prywatne (`drill-audio.ts:50-55`); wysokość i długość dźwięku są obserwowalne tylko przez fałszywy oscylator (`frequency.value`, `start`, `stop`). To dobrze: test widzi to, co trafia do Web Audio, a nie stałe modułu.
- `stepFieldValue(field, value, delta)` i `canStep(field, value, direction)` (`drill-stepper.ts:41,49`), `parseDrillConfig(input)` / `parseDrillTime(value, allowZero)` (`drill-timer.ts:21,31`).

## What We're NOT Doing

- Nie dodajemy `happy-dom`, `jsdom`, `tsx`, `@testing-library/*` ani żadnej innej zależności (decyzja D1).
- Nie testujemy `.tsx`: okablowania `DrillTimer`/`DrillApp` (Resume, widoczność, gest Start, Wake Lock), handlerów wskaźnika `ConfigStepper`, klawiatury ↑/↓ w `DrillConfigForm`. To faza 3 rolloutu (e2e).
- Nie dodajemy przypadków API, bazy ani limitu 50 (pokryte w fazie 1, unit i pgTAP). Jedyna zmiana w `tests/integration/` to poprawka komentarza.
- Nie przypinamy zaokrąglenia odliczania (ceil vs floor) ani dokładnych wartości `CUE_DURATION` / `CUE_PITCH` / wzoru losowania jako wyroczni.
- Nie mierzymy realnego wyjścia dźwięku, opóźnienia Bluetooth, iOS (blokada, przełącznik wyciszenia) — `test-plan.md §7`.
- Nie zmieniamy kodu produkcyjnego. Jeśli test z wyrocznią PRD wykaże błąd, zatrzymujemy się i zgłaszamy go koordynatorowi (naprawa to osobna zmiana, Lekcja 5).
- Nie edytujemy `test-plan.md` §1, §2, §4, §5 ani §7. Korekty §2 i potrzebne zmiany §4/§5 tylko raportujemy koordynatorowi.

## Implementation Approach

Kolejność według koszt × sygnał: najpierw najtańsza i najszersza sieć (literalna sekwencja przebiegu przez prawdziwy silnik i model widoku, #4), potem gałęzie FR-006, które dziś mają najsłabsze testy, potem sygnały przez prawdziwy `createDrillAudio` (#3, droższa fałszywka `AudioContext`), na końcu tani kontrakt strzałka ↔ parser (#6) i cookbook. Każda faza dodaje jeden plik testowy (fałszywki lokalne, jak w reszcie repo), poprawia wskazane słabe testy w swoim obszarze i kończy się ręczną kontrolą „zepsuj linię → czerwony test → przywróć”.

Zasady wspólne dla wszystkich faz:
- Wyrocznia: literały i relacje z PRD; nazwa testu opisuje zachowanie z PRD, np. „pause in Exercise restarts the same repetition after full preparation with a new Standby draw”.
- Losowanie: skryptowane wartości z krańców zakresu PRD (`0` → 1,00 s, `0.999` → 5,00 s), żeby oczekiwany czas oczekiwania wynikał z PRD (1–5 s), a nie ze wzoru losowania. Wartość `1` jest zabroniona (poza `[0,1)`).
- Próbkowanie czasu: na starcie fazy i w pełnych sekundach od jej początku, nigdy na granicy z poprzedzającą fazą.
- Warianty jako pętla nad tabelą przypadków (`for … of` + `test`/`t.test`), nie kopie testu.

## Critical Implementation Details

- **Zegar i Web Audio w jednej osi (faza 3).** `createDrillAudio` liczy kotwicę z `performance.now()` i `context.currentTime`, a `DrillRun` planuje w sekundach z `DrillClock.now()`. Fałszywy zegar musi zwracać `performance.now() / 1000` (zamockowane przez `t.mock.method(performance, "now", …)`, wzorzec z `drill-audio.test.ts:90`), a fałszywy `AudioContext.currentTime` przesuwać się razem z nim. Inaczej każdy dźwięk trafia na „teraz” przez `Math.max(…, currentTime)` i test mierzy fałszywkę. `node:test` `mock.timers` nie mockuje `performance.now()` (`context/docs/nodejs-test-runner.md`).
- **Asynchroniczny `createDrillAudio`.** Funkcja zwraca `Promise`; test musi `await` przed zbudowaniem `DrillRun` (jak `DrillTimer.tsx:52-59`) i przed asercją po `resumeWithAudio`.

## Faza 1: #4 sekwencja przebiegu z PRD (silnik + model widoku)

### Overview

Literalna oś czasu krótkiej konfiguracji przez prawdziwy `DrillRun` (bez audio, `audio = null`) i prawdziwy model widoku. Dowodzi kolejności faz, czasów, „Repetition X of N”, podglądu Next, pomijania 0 s i braku czasu w Standby.

- **Zachowanie (PRD):** US-01 i jego AC (przygotowanie raz, Standby przed każdym ćwiczeniem, ćwiczenie pełny czas niezależnie od oczekiwania, koniec po ostatnim dodatnim odpoczynku, odpoczynek 0 s pomijany), US-02 (główna sekcja odlicza, aktualna faza stały pełny czas, Next z pełnym czasem, „Next: Standby” bez czasu, zapowiedź końca przy ostatnim odpoczynku lub ostatnim ćwiczeniu przy odpoczynku 0 s), FR-018 (Repetition X of N także w Preparation i Standby), Guardrail Standby.
- **Regresja, którą łapie:** zła kolejność faz, pominięty lub zdublowany odpoczynek, przygotowanie powtarzane w każdym cyklu, Standby skracający ćwiczenie, zły numer powtórzenia, czas w Standby, zły podgląd ostatniej fazy.
- **Źródło:** `research.md` → Risk #4, Gaps 1, 5, 6; weak spots `drill-phase-sections.test.ts:103,205`.
- **Przypadek brzegowy:** przygotowanie 0 + odpoczynek 0 + losowy start wyłączony (przebieg z samych ćwiczeń; podgląd końca już w ostatnim ćwiczeniu); oczekiwania 1,00 s i 5,00 s dają identyczny widok.
- **Antywzorzec unikany:** wyrocznia skopiowana z `nextDrillPhase` (test lustrzany `:103`).

### Changes Required:

#### 1. Nowy plik testów sekwencji

**File**: `src/lib/drill-run-flow.test.ts`

**Intent**: Tabela przypadków konfiguracji z oczekiwaną osią czasu zapisaną literałami z PRD; dla każdej chwili próbkowania test porównuje fazę, linię powtórzenia, sekcję główną, aktualną i Next z modelu widoku zbudowanego z `run.display`.

**Contract**: Lokalny `FakeClock implements DrillClock` (sterowanie `advance`), skryptowany `random` (kolejka wartości, licznik wywołań), `new DrillRun(config, clock, null, random)`, `run.start()`, `run.tick()` po każdym przesunięciu, `buildPhaseSections(run.display, repetitions)`, `currentPhaseBody`, `nextPhaseBody`. Przypadki co najmniej:
- A: przygotowanie 1 s, ćwiczenie 1 s, odpoczynek 1 s, 2 powtórzenia, losowy start, losowania 1,00 s i 5,00 s → Preparation (rep 1 of 2, Next Standby bez czasu) → Standby rep 1 (Next Exercise 0:01) → Exercise rep 1 (Next Rest 0:01) → Rest rep 1 (Next Standby) → Standby rep 2 trwa 5 s → Exercise rep 2 → Rest rep 2 (Next = koniec) → `phase: null`; łącznie 2 losowania;
- B: przykład z US-02: przygotowanie 5 s, ćwiczenie 4 s, odpoczynek 2 s, bez losowego startu; po 3 s przygotowania główna sekcja 0:02, aktualna 0:05, Next Exercise 0:04; w ćwiczeniu aktualna 0:04 przez całą fazę, Next Rest 0:02;
- C: przygotowanie 0, odpoczynek 0, 2 powtórzenia, bez losowego startu → Exercise rep 1 (Next Exercise) → Exercise rep 2 (Next = koniec) → koniec;
- D: odpoczynek 0 z losowym startem → po ćwiczeniu Standby kolejnego powtórzenia, w ostatnim ćwiczeniu zapowiedź końca.
- Właściwość Standby (jedna pętla): w każdej próbce Standby sekcja główna jest `standby`, aktualna i Next nie zawierają czasu `m:ss` ani wartości losowania; widoki przy oczekiwaniu 1,00 s i 5,00 s są identyczne w tych samych chwilach od początku Standby.

#### 2. Usunięcie testu lustrzanego i wejścia spoza zakresu

**File**: `src/lib/drill-phase-sections.test.ts`

**Intent**: Test `:103` porównuje `next` z fazą wyliczoną przez ten sam `nextDrillPhase` (lustro), ale przechodzi 16 kombinacji, których nowy plik nie powtarza. Zostawiamy przegląd kombinacji, usuwamy asercję równości `next` z obserwowaną fazą i zostawiamy w nim tylko niezmienniki z PRD (przygotowanie tylko przy dodatnim czasie, odpoczynek tylko przy dodatnim czasie, Standby przed każdym ćwiczeniem przy losowym starcie, ostatni `next` = koniec); nazwę testu zmieniamy na opis tych niezmienników. Literalne sekwencje Next dają przypadki A–D z nowego pliku. W teście `:203-205` `random = () => 1` zmieniamy na wartość z `[0,1)` dającą 5,00 s (np. `0.999`).

**Contract**: Nazwy pozostałych testów bez zmian; żaden test nie wylicza oczekiwania przez `nextDrillPhase`.

### Success Criteria:

#### Automated Verification:

- Nowe testy sekwencji przechodzą: `node --test src/lib/drill-run-flow.test.ts`
- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint (z kontraktem UI) przechodzi: `npm run lint`
- Typecheck przechodzi: `npx astro check`
- Testy reguł ESLint przechodzą: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual Verification:

- Kontrola regresji: tymczasowa zmiana `restSeconds > 0` na `>= 0` w `drill-timer.ts:99` oraz osobno usunięcie gałęzi `standby` sekcji głównej w `buildPhaseSections` (`drill-phase-sections.ts:53`, Standby dostaje tekst czasu) daje czerwony `drill-run-flow.test.ts`; po przywróceniu zielony, `git diff src/lib/drill-timer.ts src/lib/drill-phase-sections.ts` pusty. (Zmiana samego `display.remainingSeconds` w Standby nie jest dobrą kontrolą: model widoku go w Standby nie czyta.)

**Implementation Note**: Po zielonych bramkach i kontroli regresji zatrzymaj się na raport do koordynatora przed fazą 2.

---

## Faza 2: #4 pauza i wznowienie według FR-006

### Overview

Każda gałąź FR-006 z literalnym oczekiwaniem: pauza w Standby lub ćwiczeniu → pełne przygotowanie, to samo powtórzenie od początku, nowe losowanie; pauza w przygotowaniu lub odpoczynku → pozostały czas.

- **Zachowanie (PRD):** FR-006, Business Logic („Wznowienie pauzy w Standby lub ćwiczeniu dodaje pełne przygotowanie i rozpoczyna to samo powtórzenie od początku, zachowując ukończone powtórzenia; […] opóźnienie losowane jest ponownie”; „Przygotowanie i odpoczynek 0 s są pomijane, również przy wznowieniu”), Guardrail Standby.
- **Regresja, którą łapie:** wznowienie z pozostałym czasem ćwiczenia, wznowienie złego powtórzenia (następnego lub pierwszego), ponowne użycie starego losowania, brak przygotowania przed wznowieniem, przygotowanie przy przygotowaniu 0 s, restart odpoczynku od pełnego czasu, utrata ukończonych powtórzeń.
- **Źródło:** `research.md` → Risk #4, Gaps 2, 3, 4, 5; weak spots `drill-run.test.ts:227,258`.
- **Przypadek brzegowy:** pauza w ćwiczeniu przy przygotowaniu 0 (gałąź `drill-run.ts:198-202` bez testu), z losowym startem i bez; pauza w ostatnim powtórzeniu.
- **Antywzorzec unikany:** stały `random`, przy którym „nowe losowanie” i „stare losowanie” są nieodróżnialne.

### Changes Required:

#### 1. Testy wznowienia w pliku sekwencji

**File**: `src/lib/drill-run-flow.test.ts`

**Intent**: Tabela przypadków pauzy (faza, powtórzenie, chwila pauzy, chwila wznowienia) z literalną osią czasu po wznowieniu; losowanie skryptowane różnymi wartościami przed i po pauzie, żeby długość wznowionego Standby i licznik losowań dowodziły nowego losowania.

**Contract**: `run.hide()` jako pauza (to wywołuje przycisk Pause, `DrillTimer.tsx:146`), `run.resume()`; konfiguracja np. przygotowanie 2 s, ćwiczenie 3 s, odpoczynek 2 s, 3 powtórzenia. Przypadki co najmniej:
- pauza w Exercise rep 2 → po wznowieniu Preparation 0:02 (Repetition 2 of 3, Next Standby bez czasu) → Standby rep 2 o nowej długości (np. 5,00 s zamiast 1,00 s; licznik losowań +1) → Exercise rep 2 z pełnym 0:03 → dalej rep 3 i koniec; liczba zakończonych ćwiczeń = 3 (bez utraty i bez dubla rep 1);
- pauza w Standby rep 2 → to samo;
- przygotowanie 0, pauza w Exercise rep 2: bez losowego startu → od razu Exercise rep 2 z pełnym 0:03; z losowym startem → Standby rep 2 z nowym losowaniem;
- pauza w Rest po 1 s z 2 s → po wznowieniu Rest z 0:01 (ten sam rep), potem Standby/Exercise następnego powtórzenia;
- pauza w Preparation po 1 s z 2 s → po wznowieniu Preparation z 0:01;
- podczas pauzy `display.paused` jest prawdziwe, a w żadnej próbce Standby (także w trakcie pauzy i przygotowania po wznowieniu) nie ma czasu oczekiwania.

#### 2. Zaostrzenie istniejących testów wznowienia

**File**: `src/lib/drill-run.test.ts`

**Intent**: Testy `:227` i `:258` używają `() => 0`; dajemy im skrypt z różnymi wartościami przed i po pauzie i dodajemy asercję nowego losowania (licznik lub długość Standby), bez zmiany nazw testów.

**Contract**: Nazwy testów bez zmian; pozostałe asercje bez zmian.

### Success Criteria:

#### Automated Verification:

- Testy sekwencji i wznowienia przechodzą: `node --test src/lib/drill-run-flow.test.ts src/lib/drill-run.test.ts`
- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Typecheck przechodzi: `npx astro check`
- Testy reguł ESLint przechodzą: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual Verification:

- Kontrola regresji: tymczasowe przekazanie `paused.remaining` jako `firstRemaining` w gałęzi Standby/Exercise (`drill-run.ts:197`) oraz osobno `repetition + 1` w `resumeTarget` daje czerwony test; po przywróceniu zielony, `git diff src/lib/drill-run.ts` pusty

**Implementation Note**: Po zielonych bramkach i kontroli regresji zatrzymaj się na raport do koordynatora przed fazą 3.

---

## Faza 3: #3 sygnały przez prawdziwy `createDrillAudio` (Start, wznowienie, powrót z ukrytej karty)

### Overview

`DrillRun` z prawdziwym `createDrillAudio` na fałszywym `AudioContext`, który zapisuje każdy oscylator (wysokość, start, stop). Dowodzi, że dźwięk jest planowany w momencie z PRD w każdej ścieżce wejścia, że relacje dźwięków zgadzają się z PRD i że po wznowieniu wyjście audio jest znów aktywne.

- **Zachowanie (PRD):** FR-004 i US-01 AC (Standby: dwa krótkie dźwięki w innej tonacji niż start ćwiczenia; ćwiczenie: jeden długi; dodatni odpoczynek: jeden krótki; przygotowanie i odpoczynek 0 s bez dźwięku), FR-002 (oczekiwanie liczone od końca drugiego dźwięku Standby), NFR (błąd momentu ≤ 0,2 s), FR-006 (wznowienie z właściwymi sygnałami; przygotowanie i odpoczynek bez ponawiania sygnału; ukrycie karty = pauza z ręcznym wznowieniem).
- **Regresja, którą łapie:** oczekiwanie liczone od pierwszego dźwięku, brak dźwięku po wznowieniu (incydent `2026-10-01-recover-timer-audio`), dźwięki planowane na starym, zamkniętym kontekście, dźwięk przygotowania lub odpoczynku 0 s, ponowiony sygnał odpoczynku po wznowieniu, ten sam ton Standby i startu, dźwięk ćwiczenia nie dłuższy od pozostałych.
- **Źródło:** `research.md` → Risk #3, weak spots `drill-run.test.ts:47,114-117,115`; archiwum `2026-10-01-recover-timer-audio`.
- **Przypadek brzegowy:** `resume()` kontekstu kończy się, ale stan zostaje `suspended` (typowe iOS) → `createDrillAudio` zwraca `null`, przebieg idzie po cichu z `audioAvailable: false`, a kolejne Pause/Resume ze zdrowym kontekstem przywraca dźwięk; brak `AudioContext` → przebieg po cichu z nienaruszoną osią czasu.
- **Antywzorzec unikany:** asercja na fałszywce przepisanej z implementacji (wartości `CUE_DURATION`/`CUE_PITCH`, odchylenie zawsze 0 z `FakeAudio`).

### Changes Required:

#### 1. Nowy plik testów sygnałów

**File**: `src/lib/drill-run-signals.test.ts`

**Intent**: Lokalny fałszywy `AudioContext` (rejestr oscylatorów: `frequency.value`, `start(at)`, `stop(at)`, kontekst właściciel; sterowalny `state` i wynik `resume()`), podstawiany jako `globalThis.AudioContext`; fałszywy zegar powiązany z `performance.now` i `currentTime`. Tabela ścieżek wejścia z oczekiwanym planem dźwięków z PRD.

**Contract**: `await createDrillAudio()` → `new DrillRun(config, clock, port, random)`; po ukryciu `run.hide()`, wznowienie `await run.resumeWithAudio(() => createDrillAudio())`. Asercje co najmniej:
- Start, przygotowanie 1 s, losowy start (oczekiwanie 1,00 s): żaden dźwięk w przygotowaniu; dwa dźwięki Standby od granicy przygotowania (≤ 0,2 s); start dźwięku ćwiczenia − koniec drugiego dźwięku Standby = 1,00 s (ścisła tolerancja, np. 0,001 s); start dźwięku odpoczynku − start dźwięku ćwiczenia = skonfigurowany czas ćwiczenia;
- relacje PRD: wysokość obu dźwięków Standby ≠ wysokość dźwięku ćwiczenia; długość dźwięku ćwiczenia > długość każdego dźwięku Standby i > długość dźwięku odpoczynku; ćwiczenie i odpoczynek mają po jednym dźwięku na fazę;
- odpoczynek 0 s: żadnego dźwięku odpoczynku w całym przebiegu; przygotowanie: żadnego dźwięku;
- powrót z ukrytej karty w ćwiczeniu: `hide()` → zaplanowane przyszłe dźwięki starego kontekstu zatrzymane; `resumeWithAudio` → nowy kontekst w stanie `running`, stary zamknięty, `audioAvailable: true`, a dźwięki Standby tego samego powtórzenia na nowym kontekście w chwili końca pełnego przygotowania (≤ 0,2 s);
- wznowienie w odpoczynku: brak ponownego dźwięku odpoczynku, kolejny dźwięk to Standby następnego powtórzenia po pozostałym czasie;
- `resume()` kontekstu bez przejścia do `running` przy Start → `createDrillAudio` = `null`, przebieg działa (`audioAvailable: false`), następne Pause + `resumeWithAudio` ze zdrowym kontekstem → `audioAvailable: true` i dźwięki zaplanowane;
- brak `globalThis.AudioContext` → `null`, przebieg działa po cichu z tą samą osią faz.

#### 2. Zaostrzenie istniejącej asercji oczekiwania

**File**: `src/lib/drill-run.test.ts`

**Intent**: `:115` zamieniamy z `< 0.2` na ścisłą tolerancję (np. `< 0.001`), żeby oczekiwanie liczone od pierwszego dźwięku Standby dawało czerwony test.

**Contract**: Nazwa testu bez zmian.

### Success Criteria:

#### Automated Verification:

- Testy sygnałów przechodzą: `node --test src/lib/drill-run-signals.test.ts src/lib/drill-run.test.ts`
- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Typecheck przechodzi: `npx astro check`
- Testy reguł ESLint przechodzą: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual Verification:

- Kontrola regresji: tymczasowe przypisanie `secondSoundEnd = firstSound.end` zamiast `secondSound.end` (osobno w `rebuild`, `drill-run.ts:271`, i w `appendLookahead`, `drill-run.ts:320`; oczekiwanie liczone od końca pierwszego dźwięku; każda z dwóch mutacji musi dać czerwony test, więc przypadki muszą obejmować Standby pierwszego i kolejnego powtórzenia) oraz osobno wywołanie `this.resume()` zamiast podmiany portu w `resumeWithAudio` daje czerwony `drill-run-signals.test.ts`; po przywróceniu zielony, `git diff src/lib/drill-run.ts` pusty

**Implementation Note**: Po zielonych bramkach i kontroli regresji zatrzymaj się na raport do koordynatora przed fazą 4.

---

## Faza 4: #6 kontrakt strzałki z parserem i zakresami PRD

### Overview

Strzałka ma własną kopię minimów i wzorca `m:ss`. Test przechodzi strzałką cały zakres każdego pola i sprawdza, że każda wartość jest przyjmowana przez wspólny parser (ten sam, którego używa API) i że granice są granicami z PRD.

- **Zachowanie (PRD):** FR-001 (przygotowanie i odpoczynek 0–600 s, ćwiczenie 1–600 s, pełne sekundy, powtórzenia 1–100), FR-020 (krok 1 s lub 1 w granicach zakresu, format `m:ss` lub liczba całkowita, strzałka na granicy nieaktywna, pusta lub błędna wartość startuje od minimum pola).
- **Regresja, którą łapie:** strzałka produkuje wartość odrzucaną przez API (np. `0:00` w ćwiczeniu, `10:01`, `101`), rozjazd minimów strzałki i parsera, krok większy niż 1, brak blokady na granicy PRD.
- **Źródło:** `research.md` → Risk #6, „The stepper duplicates the rules”.
- **Przypadek brzegowy:** przejście `0:59 → 1:00` i `9:59 → 10:00`; start z pustej wartości dla ćwiczenia (`0:01`, nie `0:00`).
- **Antywzorzec unikany:** testowanie tylko poprawnych wartości i wyrocznia z `STEPPER_LIMITS` zamiast z PRD.

### Changes Required:

#### 1. Nowy plik kontraktu strzałki

**File**: `src/lib/drill-stepper-contract.test.ts`

**Intent**: Pętla nad tabelą pól z granicami z PRD zapisanymi literałami (nie z `STEPPER_LIMITS` ani `MAX_*`): od minimum w górę do maksimum i z powrotem w dół, krok po kroku.

**Contract**: `stepFieldValue`, `canStep`, `parseDrillTime` / `parseDrillConfig`. Dla każdego pola: każda wartość po kroku jest przyjmowana przez parser i różni się o dokładnie 1 s (1 dla powtórzeń) od poprzedniej; liczba kroków od minimum do maksimum = literał z PRD (600, 599, 600, 99); `canStep` w dół na minimum i w górę na maksimum = `false`; krok poza granicę nie zmienia wartości; pusta i błędna wartość dają minimum pola z PRD (`0:00`, `0:01`, `0:00`, `1`).

#### 2. Poprawka komentarza wyroczni

**File**: `tests/integration/api-validation.test.mjs`

**Intent**: Komentarz `:2` mówi „rest at most 59:59”; PRD FR-001 mówi 0–600 s. Poprawiamy tylko komentarz.

**Contract**: Brak zmian w kodzie testów.

### Success Criteria:

#### Automated Verification:

- Kontrakt strzałki przechodzi: `node --test src/lib/drill-stepper-contract.test.ts`
- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Typecheck przechodzi: `npx astro check`
- Testy reguł ESLint przechodzą: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`

#### Manual Verification:

- Kontrola regresji: tymczasowa zmiana minimum ćwiczenia w `STEPPER_LIMITS` na 0 oraz osobno maksimum powtórzeń na 101 daje czerwony `drill-stepper-contract.test.ts`; po przywróceniu zielony, `git diff src/lib/drill-stepper.ts` pusty

**Implementation Note**: Po zielonych bramkach i kontroli regresji zatrzymaj się na raport do koordynatora przed fazą 5.

---

## Faza 5: Cookbook §6.3, notatka §6.6, status §3 i opcjonalny Stryker

### Overview

Zapis wzorca w `test-plan.md`, żeby kolejny test przebiegu lub formularza powstał tak samo. Opcjonalnie selektywna bramka mutacyjna na `drill-run.ts`.

- **Zachowanie:** cookbook odpowiada na pytanie „jak dodać test przebiegu lub formularza w tym projekcie”.
- **Regresja, którą łapie:** kolejny test z wyrocznią z kodu, stałym `random`, próbkowaniem na granicy albo nową zależnością DOM.
- **Źródło:** `test-plan.md §6.2` (wzorzec formatu), fazy 1–4 tego planu.
- **Przypadek brzegowy:** test, który wymaga `.tsx` → cookbook kieruje go do fazy 3 (e2e), nie do DOM w `node --test`.
- **Antywzorzec unikany:** gonienie 100% wyniku mutacji i asercje przypinające szczegóły implementacji.

### Changes Required:

#### 1. Cookbook i stan rolloutu

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąpić placeholder `§6.3` wzorcem (lokalizacja `src/lib/<obszar>.test.ts`, fałszywki lokalne w pliku, `FakeClock implements DrillClock`, skryptowany `random` z krańców zakresu PRD, próbkowanie na starcie fazy i w pełnych sekundach, fałszywy `AudioContext` + `performance.now` w jednej osi, relacje dźwięków zamiast stałych, kontrakt strzałka ↔ parser, testy referencyjne, polecenie uruchomienia, granica: `.tsx` → faza 3). Dopisać 2–3 linie do `§6.6` (Phase 2). Ustawić `§3` wiersz 2 na `complete` z folderem zmiany.

**Contract**: Zmieniane wyłącznie `§3` (status, folder), `§6.3`, `§6.6`. `§1`, `§2`, `§4`, `§5`, `§7` bez zmian.

#### 2. Opcjonalna bramka mutacyjna

**File**: `context/changes/testing-run-flow-form-behaviour/mutation-review.md` (tylko jeśli Stryker zostanie uruchomiony)

**Intent**: `npx stryker run --mutate "src/lib/drill-run.ts"`; dla przetrwałych mutantów decyzja według `test-plan.md §6.7` (tabela `moduł | mutant | decyzja | dlaczego`). Asercje zabijające mutanty tylko z wartością z PRD.

**Contract**: Plik powstaje tylko po uruchomieniu; brak zmian w `stryker.config.json`.

### Success Criteria:

#### Automated Verification:

- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Typecheck przechodzi: `npx astro check`
- Testy reguł ESLint przechodzą: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`
- Diff `test-plan.md` dotyka tylko §3, §6.3 i §6.6: `git diff context/foundation/test-plan.md`

#### Manual Verification:

- Koordynator potwierdza, że §6.3 wystarcza do napisania nowego testu przebiegu bez czytania tego planu
- (opcjonalnie) Stryker na `drill-run.ts` uruchomiony i przetrwałe mutanty opisane w `mutation-review.md`

**Implementation Note**: Po tej fazie raport końcowy do koordynatora (w tym korekty §2, §4, §5 do decyzji) i otwarcie PR do `main`; merge robi użytkownik.

---

## Testing Strategy

### Unit Tests:

- Warstwa „run-level integration” w `node --test`: prawdziwe `DrillRun`, model widoku i `createDrillAudio`, fałszywe tylko granice (zegar, losowanie, `AudioContext`).
- Kluczowe przypadki brzegowe: przygotowanie 0 i odpoczynek 0, oczekiwanie 1,00 s i 5,00 s, pauza w każdej z czterech faz, kontekst audio, który nie startuje, krańce zakresów pól.

### Integration Tests:

- Bez nowych przypadków HTTP (pokryte w fazie 1). Okablowanie React i realny gest/`visibilitychange` → faza 3 rolloutu.

### Manual Testing Steps:

1. Po każdej fazie: kontrola regresji z sekcji Manual Verification (zepsuj, czerwony, przywróć, pusty diff).
2. Po fazie 5: przeczytanie §6.3 przez koordynatora.

## Performance Considerations

Testy działają na fałszywym zegarze, bez czekania; pełny przebieg 100 powtórzeń nie jest potrzebny (istnieje w `drill-timer.test.ts:53`). `npm test` nie powinien wydłużyć się zauważalnie.

## Migration Notes

Nie dotyczy (bez zmian kodu produkcyjnego i danych).

## References

- Research: `context/changes/testing-run-flow-form-behaviour/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#3, #4, #6), §3 (Phase 2), §6.2 (format cookbooka), §6.7 (Stryker)
- PRD: `context/foundation/prd.md` (US-01, US-02, FR-001–FR-006, FR-013, FR-018, FR-020, NFR, Business Logic)
- Dokumentacja: `context/docs/nodejs-test-runner.md`
- Archiwum: `context/archive/2026-10-01-recover-timer-audio/`, `context/archive/2026-10-11-testing-access-boundaries/plan.md`
- Wzorce: `src/lib/drill-run.test.ts:16-71` (`FakeClock`, `FakeAudio`), `src/lib/drill-audio.test.ts:26-90` (`FakeContext`, mock `performance.now`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: #4 sekwencja przebiegu z PRD (silnik + model widoku)

#### Automated

- [x] 1.1 Nowe testy sekwencji przechodzą — 6f9f6eb
- [x] 1.2 Cały zestaw jednostkowy przechodzi — 6f9f6eb
- [x] 1.3 Lint (z kontraktem UI) przechodzi — 6f9f6eb
- [x] 1.4 Typecheck przechodzi — 6f9f6eb
- [x] 1.5 Testy reguł ESLint przechodzą — 6f9f6eb

#### Manual

- [x] 1.6 Kontrola regresji: zepsucie pomijania odpoczynku 0 s i ukrycia czasu Standby daje czerwony test — 6f9f6eb

### Phase 2: #4 pauza i wznowienie według FR-006

#### Automated

- [x] 2.1 Testy sekwencji i wznowienia przechodzą — c96d86d
- [x] 2.2 Cały zestaw jednostkowy przechodzi — c96d86d
- [x] 2.3 Lint przechodzi — c96d86d
- [x] 2.4 Typecheck przechodzi — c96d86d
- [x] 2.5 Testy reguł ESLint przechodzą — c96d86d

#### Manual

- [x] 2.6 Kontrola regresji: wznowienie z pozostałym czasem i złe powtórzenie dają czerwony test — c96d86d

### Phase 3: #3 sygnały przez prawdziwy createDrillAudio (Start, wznowienie, powrót z ukrytej karty)

#### Automated

- [x] 3.1 Testy sygnałów przechodzą — 3a16913
- [x] 3.2 Cały zestaw jednostkowy przechodzi — 3a16913
- [x] 3.3 Lint przechodzi — 3a16913
- [x] 3.4 Typecheck przechodzi — 3a16913
- [x] 3.5 Testy reguł ESLint przechodzą — 3a16913

#### Manual

- [x] 3.6 Kontrola regresji: oczekiwanie od pierwszego dźwięku i wznowienie bez nowego portu dają czerwony test — 3a16913

### Phase 4: #6 kontrakt strzałki z parserem i zakresami PRD

#### Automated

- [ ] 4.1 Kontrakt strzałki przechodzi
- [ ] 4.2 Cały zestaw jednostkowy przechodzi
- [ ] 4.3 Lint przechodzi
- [ ] 4.4 Typecheck przechodzi
- [ ] 4.5 Testy reguł ESLint przechodzą

#### Manual

- [ ] 4.6 Kontrola regresji: zepsucie minimum ćwiczenia i maksimum powtórzeń w strzałce daje czerwony test

### Phase 5: Cookbook §6.3, notatka §6.6, status §3 i opcjonalny Stryker

#### Automated

- [ ] 5.1 Cały zestaw jednostkowy przechodzi
- [ ] 5.2 Lint przechodzi
- [ ] 5.3 Typecheck przechodzi
- [ ] 5.4 Testy reguł ESLint przechodzą
- [ ] 5.5 Diff test-plan.md dotyka tylko §3, §6.3 i §6.6

#### Manual

- [ ] 5.6 Koordynator potwierdza, że §6.3 wystarcza do napisania nowego testu przebiegu
- [ ] 5.7 (opcjonalnie) Stryker na drill-run.ts uruchomiony i przetrwałe mutanty opisane
