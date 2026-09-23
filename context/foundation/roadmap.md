---
project: "DryFire Drill Timer"
version: 1
status: draft
created: 2026-09-23
updated: 2026-09-23
prd_version: 1
main_goal: speed
top_blocker: capacity
milestone_id: first-complete-timer-mvp
milestone_seq: 1
milestone_status: open
---

# Roadmap: DryFire Drill Timer

> Opracowano na podstawie `context/foundation/prd.md` (v1), notatek kształtowania produktu i stanu kodu potwierdzonego przez użytkownika.
> Przekroje są ułożone według zależności; tabela poniżej jest indeksem. Dokument można dopracowywać w miejscu.

## Milestone

**M-1: Kompletny timer z prywatnymi konfiguracjami** — Status: open

- **Intent:** Użytkownik przeprowadza pełne ćwiczenie z nieprzewidywalnym startem, a po zalogowaniu zachowuje i ponownie wykorzystuje własne ustawienia. Pierwszy działający rezultat to timer bez zapisu konfiguracji, zgodnie z `shape-notes.md` §Forward: technical-roadmap.
- **Source materials:** `context/foundation/prd.md` (v1); `context/foundation/shape-notes.md` §Forward: technical-roadmap.
- **Done when:** każdy F-NN i S-NN poniżej ma status `done`, a pełny przebieg został sprawdzony w przeglądarce na komputerze i telefonie.
- **Scope anchors:** FR-001–FR-014; US-01–US-03.

## Vision recap

Obecny timer HIIT pozwala ustawić fazy i powtórzenia, lecz jego przewidywalny start umożliwia przygotowanie reakcji przed sygnałem. Aplikacja zachowuje potrzebny przebieg, dodając osobne, ukryte przed użytkownikiem losowe opóźnienie przed każdym ćwiczeniem.

## North star

**S-02: Użytkownik przechodzi pełne ćwiczenie z losowym startem i sygnałami** — ten przepływ usuwa główny brak obecnego timera opisany w wizji oraz realizuje pierwsze kryterium sukcesu.

> Gwiazda przewodnia oznacza tu najmniejszy pełny przebieg, który dowodzi, że timer rozwiązuje główny problem użytkownika. Poprzedza ją tylko podstawowy przebieg faz, potrzebny do uruchomienia losowego startu.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| S-01 | run-configured-phases | Użytkownik ustawia czasy i wykonuje pełny przebieg faz bez losowego startu | — | US-01, FR-001, FR-003, FR-005 | ready |
| S-02 | run-random-start | Użytkownik wykonuje pełny przebieg z osobnym losowym startem i sygnałami | S-01 | US-01, FR-002, FR-003, FR-004, FR-005 | proposed |
| S-03 | preview-phase-signals | Użytkownik odsłuchuje sygnały i rozumie ich znaczenie przed uruchomieniem | S-02 | US-01, FR-004 | proposed |
| S-04 | view-three-phase-sections | Użytkownik widzi odliczanie, aktualną i następną fazę w trzech sekcjach | S-02 | US-02, FR-005, FR-013 | proposed |
| S-05 | choose-phase-colors | Użytkownik wybiera i widzi osobne kolory czterech faz | S-04 | US-03, FR-013, FR-014 | blocked |
| S-06 | pause-and-resume-drill | Użytkownik wstrzymuje przebieg i wznawia właściwe powtórzenie | S-02 | US-01, FR-006 | proposed |
| S-07 | cancel-current-drill | Użytkownik anuluje przebieg i wraca do ustawień | S-01 | US-01, FR-007 | proposed |
| S-08 | restart-whole-drill | Użytkownik uruchamia cały przebieg ponownie od początku | S-02 | US-01, FR-008 | proposed |
| S-09 | enter-account-by-email-link | Użytkownik tworzy konto lub loguje się przez link email | — | FR-009 | ready |
| S-10 | save-named-drill | Użytkownik zapisuje nazwaną konfigurację ze swoimi kolorami | S-05, S-09 | US-03, FR-010, FR-014 | proposed |
| S-11 | open-saved-drill | Użytkownik widzi własne konfiguracje i uruchamia wybraną | S-10 | FR-011 | proposed |
| S-12 | edit-saved-drill | Użytkownik zmienia własną zapisaną konfigurację | S-10 | US-03, FR-012, FR-014 | proposed |
| S-13 | delete-saved-drill | Użytkownik usuwa własną konfigurację po potwierdzeniu | S-10 | FR-012 | proposed |

## Streams

Strumienie ułatwiają czytanie równoległych ścieżek. O kolejności prac rozstrzygają zależności elementów.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Przebieg timera | `S-01` → `S-02` → `S-03` → `S-04` → `S-05` → `S-06` → `S-07` → `S-08` | Najpierw dostarcza działający timer; rodzeństwo po S-02 można realizować niezależnie. |
| B | Konto i własne ustawienia | `S-09` → `S-10` → `S-11` → `S-12` → `S-13` | S-10 łączy się ze strumieniem A przy S-05. |

## Baseline

Stan kodu na `2026-09-23`, zbadany automatycznie i potwierdzony przez użytkownika:

- **Frontend:** partial — są strony logowania i panel, lecz strona główna to ekran startera (`src/pages/index.astro:8`); brak timera.
- **Backend / API:** partial — istnieją endpointy konta (`src/pages/api/auth/`); brak przepływu produktu.
- **Data:** partial — dostawca danych jest skonfigurowany (`supabase/config.toml:1`), bez migracji i tabel konfiguracji.
- **Auth:** present — istnieją sesje, endpointy wejścia/wyjścia i ochrona panelu (`src/lib/supabase.ts:9`, `src/middleware.ts:4`); metoda logowania wymaga zmiany na link email.
- **Deploy / infra:** present — konfiguracja wdrożenia i automatyczne publikowanie z gałęzi głównej działają (`wrangler.jsonc:3`, `.github/workflows/ci.yml:73`).
- **Observability:** present — dostępne są podstawowe logi platformy (`wrangler.jsonc:12`); brak osobnej telemetrii aplikacji.

## Foundations

Brak osobnych Foundations. Konfigurację danych, ochronę własności i weryfikację timera wprowadzają pierwsze przekroje, które ich używają; istniejące logowanie oraz wdrożenie nie wymagają ponownego szkieletu.

## Slices

### S-01: Pełny przebieg podstawowych faz

- **Outcome:** Użytkownik ustawia dozwolone czasy i liczbę powtórzeń, po czym wykonuje jednorazowe przygotowanie oraz pełną liczbę cykli ćwiczenia i odpoczynku, łącznie z ostatnim odpoczynkiem.
- **Change ID:** run-configured-phases
- **PRD refs:** US-01, FR-001, FR-003, FR-005
- **Prerequisites:** —
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Poprawny przebieg i odliczanie muszą być dostępne przed dodaniem losowego startu, by odróżnić błędy faz od błędów losowania.
- **Status:** ready

### S-02: Losowy start w pełnym przebiegu

- **Outcome:** Użytkownik uruchamia przebieg, w którym każde ćwiczenie poprzedza nowe, ukryte oczekiwanie 1–5 s liczone po dwóch sygnałach Standby, a rozpoczęcie ćwiczenia i odpoczynku ma ustalone dźwięki.
- **Change ID:** run-random-start
- **PRD refs:** US-01, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-07, S-09
- **Blockers:** —
- **Unknowns:**
  - Czy przeglądarki docelowe utrzymują błąd emisji sygnału poniżej 0,2 s w aktywnej karcie? — Owner: team. Block: no.
- **Risk:** Moment startu oczekiwania musi następować po dźwiękach, a pomiar obejmować rzeczywistą emisję; to główne ryzyko działania produktu.
- **Status:** proposed

### S-03: Odsłuch znaczenia sygnałów

- **Outcome:** Użytkownik odsłuchuje sygnały ćwiczenia, odpoczynku i Standby przy ich ustawieniach oraz widzi opis znaczenia każdego dźwięku.
- **Change ID:** preview-phase-signals
- **PRD refs:** US-01, FR-004
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Odsłuch powinien używać tych samych sygnałów co przebieg, aby objaśnienie nie wprowadzało w błąd.
- **Status:** proposed

### S-04: Czytelny widok bieżącej i następnej fazy

- **Outcome:** Użytkownik widzi trzy sekcje: główne odliczanie lub Standby, stały pełny czas bieżącej fazy oraz nazwę i pełny czas następnej fazy, także przy pominiętych fazach i końcu przebiegu.
- **Change ID:** view-three-phase-sections
- **PRD refs:** US-02, FR-005, FR-013
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Podgląd nie może ujawnić długości oczekiwania Standby ani sugerować fazy po ostatnim odpoczynku.
- **Status:** proposed

### S-05: Niezależne kolory faz

- **Outcome:** Użytkownik wybiera osobny kolor dla każdej fazy z dziewięciu kafelków i rozpoznaje fazy po czytelnym tle podczas przebiegu.
- **Change ID:** choose-phase-colors
- **PRD refs:** US-03, FR-013, FR-014
- **Prerequisites:** S-04
- **Parallel with:** S-03, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Jakie dokładne odcienie dziewięciu kolorów spełniają rozróżnialność i kontrast z czarną czcionką? — Owner: user. Block: yes.
- **Risk:** Dobór odcieni przed implementacją ogranicza poprawki interfejsu i ryzyko nieczytelności na telefonie.
- **Status:** blocked

### S-06: Pauza i bezpieczne wznowienie

- **Outcome:** Użytkownik wstrzymuje ćwiczenie lub wraca do aplikacji po jej ukryciu i ręcznie wznawia właściwą fazę albo to samo powtórzenie według reguł PRD.
- **Change ID:** pause-and-resume-drill
- **PRD refs:** US-01, FR-006
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Jak zachowują się pauza po blokadzie ekranu i utrzymanie włączonego ekranu w przeglądarkach odbiorowych? — Owner: team. Block: no.
- **Risk:** Wznowienie Standby lub ćwiczenia musi zachować ukończone powtórzenia i ponowić pełne przygotowanie bez automatycznego startu po powrocie.
- **Status:** proposed

### S-07: Anulowanie przebiegu

- **Outcome:** Użytkownik anuluje bieżący przebieg i wraca do konfiguracji z zachowanymi ustawieniami.
- **Change ID:** cancel-current-drill
- **PRD refs:** US-01, FR-007
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Anulowanie ma zakończyć bieżący przebieg bez utraty konfiguracji i bez niezamierzonego wznowienia.
- **Status:** proposed

### S-08: Ponowne uruchomienie od początku

- **Outcome:** Użytkownik uruchamia cały przebieg ponownie od przygotowania, z pierwszym powtórzeniem i nowymi losowaniami, gdy losowy start jest włączony.
- **Change ID:** restart-whole-drill
- **PRD refs:** US-01, FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Restart nie może zachować postępu ani poprzedniego opóźnienia losowego.
- **Status:** proposed

### S-09: Dostęp do konta przez link email

- **Outcome:** Użytkownik podaje adres email i przez otrzymany link tworzy konto lub wraca do istniejącego konta.
- **Change ID:** enter-account-by-email-link
- **PRD refs:** FR-009
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Obecne logowanie hasłem nie odpowiada wymaganej metodzie; zmiana nie może odebrać dostępu do chronionych stron.
- **Status:** ready

### S-10: Zapis nazwanej konfiguracji

- **Outcome:** Zalogowany użytkownik nadaje nazwę ustawieniom timera i zapisuje je wraz z osobnymi kolorami faz, dostępnymi tylko jemu.
- **Change ID:** save-named-drill
- **PRD refs:** US-03, FR-010, FR-014
- **Prerequisites:** S-05, S-09
- **Parallel with:** S-03, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwsze dane aplikacji wymagają ochrony własności od chwili zapisu, zanim zostaną udostępnione na liście.
- **Status:** proposed

### S-11: Powrót do zapisanej konfiguracji

- **Outcome:** Zalogowany użytkownik po wejściu lub odświeżeniu strony widzi listę własnych nazwanych konfiguracji z parametrami, otwiera szczegóły i uruchamia wybraną.
- **Change ID:** open-saved-drill
- **PRD refs:** FR-011
- **Prerequisites:** S-10
- **Parallel with:** S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Lista i szczegóły muszą respektować tę samą własność danych co zapis oraz nie wznawiać aktywnego przebiegu po odświeżeniu.
- **Status:** proposed

### S-12: Edycja własnej konfiguracji

- **Outcome:** Zalogowany użytkownik zmienia parametry i kolory jednej zapisanej konfiguracji bez modyfikowania innych.
- **Change ID:** edit-saved-drill
- **PRD refs:** US-03, FR-012, FR-014
- **Prerequisites:** S-10
- **Parallel with:** S-11, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana kolorów jednego zestawu nie może przeniknąć do pozostałych zapisanych konfiguracji.
- **Status:** proposed

### S-13: Usunięcie własnej konfiguracji

- **Outcome:** Zalogowany użytkownik usuwa własną konfigurację dopiero po potwierdzeniu pokazującym jej nazwę.
- **Change ID:** delete-saved-drill
- **PRD refs:** FR-012
- **Prerequisites:** S-10
- **Parallel with:** S-11, S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Potwierdzenie z nazwą ogranicza przypadkowe usunięcie, a kontrola własności chroni cudze dane.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| S-01 | run-configured-phases | Pełny przebieg faz bez losowego startu | yes | Uruchom `/10x-plan run-configured-phases`. |
| S-02 | run-random-start | Losowy start i sygnały w każdym cyklu | no | Po S-01; gwiazda przewodnia. |
| S-03 | preview-phase-signals | Odsłuch sygnałów w konfiguracji | no | Po S-02. |
| S-04 | view-three-phase-sections | Trzy sekcje przebiegu i podglądu | no | Po S-02. |
| S-05 | choose-phase-colors | Wybór kolorów faz | no | Wymaga wyboru odcieni i S-04. |
| S-06 | pause-and-resume-drill | Pauza i ręczne wznowienie | no | Po S-02. |
| S-07 | cancel-current-drill | Anulowanie przebiegu | no | Po S-01. |
| S-08 | restart-whole-drill | Restart przebiegu | no | Po S-02. |
| S-09 | enter-account-by-email-link | Wejście do konta linkiem email | yes | Równolegle z S-01, po pierwszym działającym timerze w domyślnej kolejności. |
| S-10 | save-named-drill | Zapis nazwanej konfiguracji | no | Po S-05 i S-09. |
| S-11 | open-saved-drill | Lista i uruchomienie zapisanej konfiguracji | no | Po S-10. |
| S-12 | edit-saved-drill | Edycja zapisanej konfiguracji | no | Po S-10. |
| S-13 | delete-saved-drill | Usunięcie zapisanej konfiguracji | no | Po S-10. |

## Open Roadmap Questions

1. **Jakie dokładne odcienie zastosować dla dziewięciu wybranych kolorów?** — Do dobrania podczas projektowania interfejsu, przed implementacją FR-014, z zachowaniem łagodności, wyraźnego rozróżnienia barw i kontrastu z czarną czcionką. Zestaw kolorów i ich domyślne przypisanie do faz są ustalone. — Owner: user. Block: S-05.

## Parked

- **Historia treningów i statystyki** — Why parked: PRD §MVP Non-Goals wyklucza zapis zakończonych sesji i zestawienia aktywności.
- **Gotowa biblioteka ćwiczeń** — Why parked: PRD §MVP Non-Goals; użytkownik sam konfiguruje przebieg.
- **Tryb offline i pełna aplikacja PWA** — Why parked: PRD §MVP Non-Goals.
- **Powiadomienia poza aktywną aplikacją** — Why parked: PRD §MVP Non-Goals; powrót z tła wymaga ręcznego wznowienia.
- **Udostępnianie konfiguracji, funkcje społecznościowe i role** — Why parked: PRD §Permanent Non-Goals.
- **Integracje ze sprzętem treningowym** — Why parked: PRD §Permanent Non-Goals.

## Milestone History

Brak zamkniętych kamieni milowych.

## Done

Brak ukończonych przekrojów.
