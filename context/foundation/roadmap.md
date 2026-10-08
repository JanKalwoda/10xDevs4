---
project: "DryFire Drill Timer"
version: 1
status: draft
created: 2026-09-23
updated: 2026-10-09
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
- **Source materials:** `context/foundation/prd.md` (v1); `context/foundation/shape-notes.md` §Forward: technical-roadmap; opis użytkownika dotyczący dopracowania UI głównego timera.
- **Done when:** każdy F-NN i S-NN poniżej poza odroczonym S-05 (kolory faz), zablokowanym S-14 i proponowanym S-20 ma status `done`, a pełny przebieg został sprawdzony w przeglądarce na komputerze i telefonie.
- **Scope anchors:** FR-001–FR-014; US-01–US-03; MS-01: dopracowanie istniejącego widoku głównego timera pod `/` na telefonie i komputerze.

## Vision recap

Obecny timer HIIT pozwala ustawić fazy i powtórzenia, lecz jego przewidywalny start umożliwia przygotowanie reakcji przed sygnałem. Aplikacja zachowuje potrzebny przebieg, dodając osobne, ukryte przed użytkownikiem losowe opóźnienie przed każdym ćwiczeniem.

**Zasada przekrojowa interfejsu:** Cały tekst widoczny dla użytkownika jest po angielsku, również nazwy faz, etykiety, komunikaty walidacji i błędów, uwierzytelnianie oraz zakończenie przebiegu. Opisy roadmapy pozostają po polsku.

## North star

**S-02: Użytkownik przechodzi pełne ćwiczenie z losowym startem i sygnałami** — ten przepływ usuwa główny brak obecnego timera opisany w wizji oraz realizuje pierwsze kryterium sukcesu.

> Gwiazda przewodnia oznacza tu najmniejszy pełny przebieg, który dowodzi, że timer rozwiązuje główny problem użytkownika. Poprzedza ją tylko podstawowy przebieg faz, potrzebny do uruchomienia losowego startu.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| S-01 | run-configured-phases | Użytkownik przechodzi z osobnego formularza do pełnego przebiegu faz bez losowego startu | — | US-01, FR-001, FR-003, FR-005 | done |
| S-02 | run-random-start | Użytkownik wykonuje pełny przebieg z osobnym losowym startem i sygnałami | S-01 | US-01, FR-002, FR-003, FR-004, FR-005 | done |
| S-15 | polish-timer-view | Użytkownik korzysta ze spójnego i czytelnego widoku timera podczas konfiguracji, przebiegu i po zakończeniu | S-02 | MS-01, US-01, FR-005 | done |
| S-03 | preview-phase-signals | Użytkownik odsłuchuje sygnały i rozumie ich znaczenie przed uruchomieniem | S-02 | US-01, FR-004 | done |
| S-04 | view-three-phase-sections | Użytkownik widzi odliczanie, aktualną i następną fazę w trzech sekcjach | S-02 | US-02, FR-005, FR-013 | done |
| S-05 | choose-phase-colors | Użytkownik wybiera i widzi osobne kolory czterech faz | S-04 | US-03, FR-013, FR-014 | deferred |
| S-06 | pause-and-resume-drill | Użytkownik wstrzymuje przebieg i wznawia właściwe powtórzenie | S-02 | US-01, FR-006 | done |
| S-07 | cancel-current-drill | Użytkownik anuluje przebieg i wraca do ustawień | S-01 | US-01, FR-007 | done |
| S-08 | restart-whole-drill | Użytkownik uruchamia cały przebieg ponownie od początku | S-02 | US-01, FR-008 | done |
| S-09 | enter-account-by-email-link | Użytkownik tworzy konto lub loguje się przez link email | — | FR-009 | done |
| S-10 | save-named-drill | Użytkownik zapisuje nazwaną konfigurację (bez kolorów faz) | S-09 | FR-010 | done |
| S-11 | open-saved-drill | Użytkownik widzi własne konfiguracje i uruchamia wybraną | S-10 | FR-011 | done |
| S-12 | edit-saved-drill | Użytkownik zmienia własną zapisaną konfigurację | S-10 | FR-012 | done |
| S-13 | delete-saved-drill | Użytkownik usuwa własną konfigurację po potwierdzeniu | S-10 | FR-012 | done |
| S-14 | align-bluetooth-audio | Użytkownik ze słuchawkami Bluetooth wyrównuje widok faz ze słyszanymi sygnałami | S-02 | FR-002, FR-004, FR-005 | blocked |
| S-16 | app-top-bar | Top bar z kontem i motywem | yes | Zob. `context/foundation/ux-fixes-plan.md`. |
| S-17 | timers-list-and-account | Lista timerów, dane konta i przejście po zapisie | yes | Po S-16; zob. `ux-fixes-plan.md`. |
| S-18 | run-view-layout | Układ widoku biegu | yes | Po S-04; zob. `ux-fixes-plan.md`. |
| S-19 | signal-preview-icon | Ikona odsłuchu z tooltipem | yes | Po S-03; zob. `ux-fixes-plan.md`. |
| S-20 | account-deletion | Usuwanie konta (RODO) | no | Wymaga decyzji o przetrzymaniu i kluczu service role. |
| S-16 | app-top-bar | Użytkownik widzi przyklejony top bar z emailem, Sign in/Sign out i przełącznikiem motywu | S-09 | FR-015 | in-progress |
| S-17 | timers-list-and-account | Użytkownik ma osobny ekran listy timerów, stronę danych konta i po zapisie trafia do zapisanego timera | S-16, S-11, S-12, S-13 | FR-011, FR-016, FR-017 | in-progress |
| S-18 | run-view-layout | Użytkownik widzi w biegu czas wyżej, powtórzenie pod czasem oraz czytelniejsze okienka Current i Next | S-04 | FR-013, FR-018 | planning |
| S-19 | signal-preview-icon | Użytkownik odsłuchuje sygnał ikoną głośnika w wierszu pola, a opis widzi w tooltipie | S-03 | FR-004, FR-019 | ready |
| S-20 | account-deletion | Użytkownik usuwa swoje konto z okresem przetrzymania zgodnym z RODO | S-09, S-17 | — | proposed |

## Streams

Strumienie ułatwiają czytanie równoległych ścieżek. Strzałka oznacza zależność, a przecinek oddziela przekroje, które można prowadzić równolegle. O kolejności prac rozstrzygają pola `Prerequisites`.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Główny przebieg i widok | `S-01` → `S-02` → (`S-15`, `S-04` → `S-05` (odroczony), `S-14`) | Po działającym przebiegu dopracowuje jego UI oraz rozwija podgląd faz i synchronizację audio. |
| B | Odsłuch sygnałów | `S-03` | Korzysta z sygnałów wprowadzonych w S-02. |
| C | Sterowanie przebiegiem | `S-06`, `S-07`, `S-08` | S-07 wymaga S-01; S-06 i S-08 wymagają S-02. |
| D | Dostęp do konta i zapis | `S-09` → `S-10` | Zapis S-10 nie wymaga już S-05; kolory faz są odroczone razem z S-05. |
| E | Korzystanie z zapisów | `S-11`, `S-12`, `S-13` | Trzy niezależne działania po zapisie S-10. |
| F | Powłoka, konto i nawigacja | `S-16` → `S-17` → `S-20` | S-17 wymaga paska z S-16; S-20 jest tylko zaproponowany (RODO, wymaga decyzji). |
| G | Dopracowanie widoku biegu i formularza | `S-18`, `S-19` | Niezależne od siebie; S-18 po S-04, S-19 po S-03. |

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

### S-01: Konfiguracja i pełny przebieg podstawowych faz

- **Outcome:** Na `/` użytkownik widzi osobny formularz czasu i powtórzeń z przyciskiem Start. Poprawny start zastępuje formularz widokiem bieżącej fazy, odliczania i powtórzenia. Przygotowanie i odpoczynek ustawione na 0 s są pomijane w każdym właściwym miejscu; dodatni odpoczynek pozostaje także po ostatnim ćwiczeniu, a przy 0 s przebieg kończy się po ostatnim ćwiczeniu. Po zakończeniu można wrócić do formularza z ostatnimi wartościami. Podgląd następnej fazy wprowadza S-04.
- **Change ID:** run-configured-phases
- **PRD refs:** US-01, FR-001, FR-003, FR-005
- **Prerequisites:** —
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Poprawny przebieg i odliczanie, w tym pominięcie odpoczynku 0 s w każdym powtórzeniu, muszą być dostępne przed dodaniem losowego startu, by odróżnić błędy faz od błędów losowania.
- **Status:** done

### S-02: Losowy start w pełnym przebiegu

- **Outcome:** Użytkownik uruchamia przebieg, w którym każde ćwiczenie poprzedza nowe, ukryte oczekiwanie 1–5 s liczone po dwóch sygnałach Standby, a rozpoczęcie ćwiczenia i dodatniego odpoczynku ma ustalone dźwięki; odpoczynek 0 s nie emituje sygnału.
- **Change ID:** run-random-start
- **PRD refs:** US-01, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-07, S-09
- **Blockers:** —
- **Unknowns:**
  - Czy przeglądarki docelowe utrzymują błąd emisji sygnału poniżej 0,2 s w aktywnej karcie? — Owner: team. Block: no.
- **Risk:** Moment startu oczekiwania musi następować po dźwiękach. Programowe czasy nie mierzą fizycznej emisji; na komputerze i iPhonie 15 Pro Max słuchawki Bluetooth miały zauważalne opóźnienie względem widoku. Synchronizację wyodrębniono do S-14.
- **Status:** done

### S-15: Dopracowany widok głównego timera

- **Outcome:** Użytkownik wygodnie konfiguruje timer, śledzi przebieg i rozpoznaje jego zakończenie w spójnym, czytelnym widoku pod `/` na telefonie i komputerze; wszystkie istniejące stany i działania pozostają zrozumiałe oraz dostępne.
- **Change ID:** polish-timer-view
- **PRD refs:** MS-01, US-01, FR-005
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-06, S-07, S-08, S-09, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dopracowanie jednego działającego widoku powinno wyznaczyć spójny wzorzec dla kolejnych zmian UI, bez zmiany logiki timera ani wyprzedzania funkcji z późniejszych przekrojów.
- **Status:** done

### S-03: Odsłuch znaczenia sygnałów

- **Outcome:** Użytkownik odsłuchuje sygnały ćwiczenia, odpoczynku i Standby przy ich ustawieniach oraz widzi opis znaczenia każdego dźwięku.
- **Change ID:** preview-phase-signals
- **PRD refs:** US-01, FR-004
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Odsłuch powinien używać tych samych sygnałów co przebieg, aby objaśnienie nie wprowadzało w błąd.
- **Status:** done

### S-04: Czytelny widok bieżącej i następnej fazy

- **Outcome:** Użytkownik widzi trzy sekcje: główne odliczanie lub Standby, stały pełny czas bieżącej fazy oraz nazwę i pełny czas następnej rzeczywistej fazy, z pominięciem przygotowania lub odpoczynku 0 s i z informacją o końcu przebiegu.
- **Change ID:** view-three-phase-sections
- **PRD refs:** US-02, FR-005, FR-013
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Podgląd nie może ujawnić długości oczekiwania Standby ani sugerować pominiętego odpoczynku 0 s lub fazy po zakończeniu przebiegu.
- **Status:** done

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
- **Status:** deferred — odroczone decyzją użytkownika (2026-10-07); S-10–S-13 realizujemy bez kolorów faz, bez kolumny na kolory w bazie.

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
- **Status:** done

### S-07: Anulowanie przebiegu

- **Outcome:** Użytkownik anuluje bieżący przebieg i wraca do konfiguracji z zachowanymi ustawieniami.
- **Change ID:** cancel-current-drill
- **PRD refs:** US-01, FR-007
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Anulowanie ma zakończyć bieżący przebieg bez utraty konfiguracji i bez niezamierzonego wznowienia.
- **Status:** done

### S-08: Ponowne uruchomienie od początku

- **Outcome:** Użytkownik uruchamia cały przebieg ponownie od przygotowania, z pierwszym powtórzeniem i nowymi losowaniami, gdy losowy start jest włączony.
- **Change ID:** restart-whole-drill
- **PRD refs:** US-01, FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Restart nie może zachować postępu ani poprzedniego opóźnienia losowego.
- **Status:** done

### S-09: Dostęp do konta przez link email

- **Outcome:** Użytkownik podaje adres email i przez otrzymany link tworzy konto lub wraca do istniejącego konta.
- **Change ID:** enter-account-by-email-link
- **PRD refs:** FR-009
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Obecne logowanie hasłem nie odpowiada wymaganej metodzie; zmiana nie może odebrać dostępu do chronionych stron.
- **Status:** done

### S-10: Zapis nazwanej konfiguracji

- **Outcome:** Zalogowany użytkownik tworzy nowy timer pod `/create`, nadaje mu nazwę i zapisuje parametry timera (bez kolorów faz), dostępne tylko dla niego. Nazwa jest unikalna w obrębie użytkownika i ma najwyżej 200 znaków; użytkownik ma najwyżej 50 zapisanych konfiguracji. Gość i zalogowany użytkownik nadal widzą domyślny timer pod `/`.
- **Change ID:** save-named-drill
- **PRD refs:** FR-010
- **Prerequisites:** S-09
- **Parallel with:** S-03, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwsze dane aplikacji wymagają ochrony własności (RLS, unikalność nazwy per użytkownik, limit 50) od chwili zapisu, zanim zostaną udostępnione na liście. Migracja musi trafić na hostowany Supabase przed wdrożeniem kodu, który z niej korzysta (merge do `main` wdraża automatycznie). Kolory faz odroczone: bez kolumny na kolory.
- **Status:** done

### S-11: Powrót do zapisanej konfiguracji

- **Outcome:** Zalogowany użytkownik po wejściu lub odświeżeniu strony `/dashboard` (strona startowa zalogowanego) widzi listę własnych nazwanych konfiguracji z parametrami albo tekst informujący, że nie ma jeszcze zapisanych timerów; pod `/{id_timera}` otwiera szczegóły i uruchamia wybraną konfigurację.
- **Change ID:** open-saved-drill
- **PRD refs:** FR-011
- **Prerequisites:** S-10
- **Parallel with:** S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Lista i szczegóły muszą respektować tę samą własność danych co zapis oraz nie wznawiać aktywnego przebiegu po odświeżeniu.
- **Status:** done

### S-12: Edycja własnej konfiguracji

- **Outcome:** Zalogowany użytkownik zmienia nazwę i parametry jednej zapisanej konfiguracji (bez kolorów faz) bez modyfikowania innych; unikalność nazwy per użytkownik i limit 200 znaków obowiązują także przy edycji.
- **Change ID:** edit-saved-drill
- **PRD refs:** FR-012
- **Prerequisites:** S-10
- **Parallel with:** S-11, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana jednej konfiguracji nie może przeniknąć do pozostałych ani do cudzych danych.
- **Status:** done

### S-13: Usunięcie własnej konfiguracji

- **Outcome:** Zalogowany użytkownik usuwa własną konfigurację dopiero po potwierdzeniu pokazującym jej nazwę.
- **Change ID:** delete-saved-drill
- **PRD refs:** FR-012
- **Prerequisites:** S-10
- **Parallel with:** S-11, S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Potwierdzenie z nazwą ogranicza przypadkowe usunięcie, a kontrola własności chroni cudze dane.
- **Status:** done

### S-14: Synchronizacja dźwięku Bluetooth z widokiem

- **Outcome:** Użytkownik korzystający ze słuchawek Bluetooth może wyrównać zmianę widocznej fazy ze słyszanym sygnałem bez zmiany odstępu między dwoma sygnałami Standby a startem ćwiczenia i bez ujawniania losowego czasu oczekiwania.
- **Change ID:** align-bluetooth-audio
- **PRD refs:** FR-002, FR-004, FR-005
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-06, S-07, S-08, S-09
- **Blockers:** Ustalenie sposobu wyrównania i weryfikacji na docelowych słuchawkach; same znaczniki planowania Web Audio nie dowodzą chwili słyszalnej emisji.
- **Unknowns:**
  - Czy oszacowanie opóźnienia wyjścia przez przeglądarkę wystarczy, czy potrzebna jest kalibracja przez użytkownika? — Owner: team. Block: yes.
  - Jak zmierzyć błąd słyszalnego sygnału względem widoku na komputerze i telefonie z Bluetooth? — Owner: team. Block: yes.
- **Risk:** Opóźnienie Bluetooth zależy od urządzenia i toru odtwarzania; korekta nie może skrócić losowego odstępu słyszanego między końcem drugiego sygnału Standby a startem ćwiczenia ani obiecywać dokładności bez pomiaru.
- **Status:** blocked

### S-16: Przyklejony top bar z informacją o koncie

- **Outcome:** Na każdej stronie poza stronami logowania użytkownik widzi przyklejony do góry, zawsze widoczny pasek: dla zalogowanego email (link do `/dashboard`), link „Timers", przełącznik motywu jasny/ciemny i „Sign out"; dla gościa „Sign in" i przełącznik motywu. Pasek zastępuje pływający link konta i przełączniki motywu w kartach, więc „Sign in" nie nachodzi na kartę timera na telefonie. „Back to the timer" na stronie callback jest przyciskiem.
- **Change ID:** app-top-bar
- **PRD refs:** FR-015
- **Prerequisites:** S-09
- **Parallel with:** S-18, S-19
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Email trafia do HTML każdej strony z paskiem, więc strony z paskiem (w tym `/` i 404) muszą mieć `Cache-Control: private, no-store`; sticky pasek nie może dawać dodatkowego przewijania ani przesuwać układu karty.
- **Status:** in-progress

### S-17: Lista timerów i dane konta

- **Outcome:** Zalogowany użytkownik widzi listę zapisanych timerów na osobnym ekranie `/timers` (strona startowa po wejściu i odświeżeniu), a `/dashboard` pokazuje dane konta (na razie email). Po zalogowaniu link prowadzi do listy („Continue to your timers"), a po zapisie nowego timera użytkownik trafia na widok zapisanego timera `/{id}`. Linki powrotu i przekierowanie po usunięciu kierują do `/timers`.
- **Change ID:** timers-list-and-account
- **PRD refs:** FR-011, FR-016, FR-017
- **Prerequisites:** S-16, S-11, S-12, S-13
- **Parallel with:** S-18, S-19
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana domyślnego celu logowania, tras i linków dotyka middleware, `next`, smoke i wielu testów; nowa trasa `/timers` musi być chroniona i nie może kolidować z `/{id}`.
- **Status:** in-progress

### S-18: Układ widoku biegu

- **Outcome:** W widoku biegu odliczany czas jest wyżej, tuż pod nim widać „Repetition X of N" (także w Preparation i Standby), okienko bieżącej fazy ma nazwę w pierwszej linii i czas w osobnej linii bez numeru powtórzenia, a okienko następnej fazy ma większy napis „Next" oraz nazwę i czas w osobnej linii.
- **Change ID:** run-view-layout
- **PRD refs:** FR-013, FR-018
- **Prerequisites:** S-04
- **Parallel with:** S-16, S-17, S-19
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Przemodelowanie `buildPhaseSections` nie może ujawnić długości losowego Standby ani przesuwać przycisków paska; numer powtórzenia w Preparation wymaga danych z `DrillDisplay`.
- **Status:** planning

### S-19: Ikona odsłuchu sygnału z tooltipem

- **Outcome:** Odsłuch sygnału to sama ikona głośnika na końcu wiersza z polem czasu (Standby przy opcji Random start); opis znaczenia i powód wyłączenia są w tooltipie, a na telefonie dotknięcie ikony odtwarza dźwięk i pokazuje ten sam opis na kilka sekund.
- **Change ID:** signal-preview-icon
- **PRD refs:** FR-004, FR-019
- **Prerequisites:** S-03
- **Parallel with:** S-16, S-17, S-18
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tooltip nie działa na dotyk, a wyłączony przycisk nie pokazuje powodu; nowy prymityw `tooltip` musi mieścić się w kontrakcie UI (tokeny, lint).
- **Status:** ready

### S-20: Usuwanie konta

- **Outcome:** Zalogowany użytkownik usuwa swoje konto z miesięcznym okresem przetrzymania danych zgodnie z RODO.
- **Change ID:** account-deletion
- **PRD refs:** —
- **Prerequisites:** S-09, S-17
- **Parallel with:** —
- **Blockers:** Decyzje prawne i techniczne (patrz Open Roadmap Questions): okres i sposób przetrzymania, klucz service role po stronie serwera, mechanizm czyszczący.
- **Unknowns:**
  - Czy usunięcie jest miękkie (30 dni z możliwością przywrócenia) czy natychmiastowe? — Owner: user. Block: yes.
- **Risk:** Wymaga uprawnień administracyjnych Supabase (dziś aplikacja używa tylko klucza publikowalnego) oraz zadania czyszczącego po okresie przetrzymania.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| S-01 | run-configured-phases | Pełny przebieg faz bez losowego startu | yes | Uruchom `/10x-plan run-configured-phases`. |
| S-02 | run-random-start | Losowy start i sygnały w każdym cyklu | no | Po S-01; gwiazda przewodnia. |
| S-15 | polish-timer-view | Dopracowanie widoku głównego timera | yes | Działający widok pod `/`; dla `/10x-ui` użyj Change ID `polish-timer-view`. |
| S-03 | preview-phase-signals | Odsłuch sygnałów w konfiguracji | yes | Po S-02. |
| S-04 | view-three-phase-sections | Trzy sekcje przebiegu i podglądu | yes | Po S-02. |
| S-05 | choose-phase-colors | Wybór kolorów faz | no | Odroczone (2026-10-07); wymaga wyboru odcieni i S-04. |
| S-06 | pause-and-resume-drill | Pauza i ręczne wznowienie | yes | Po S-02. |
| S-07 | cancel-current-drill | Anulowanie przebiegu | yes | Po S-01. |
| S-08 | restart-whole-drill | Restart przebiegu | yes | Po S-02. |
| S-09 | enter-account-by-email-link | Wejście do konta linkiem email | yes | Równolegle z S-01, po pierwszym działającym timerze w domyślnej kolejności. |
| S-10 | save-named-drill | Zapis nazwanej konfiguracji | yes | Po S-09; bez kolorów (S-05 odroczone); `/create`, limity 200 znaków i 50 konfiguracji. |
| S-11 | open-saved-drill | Lista i uruchomienie zapisanej konfiguracji | no | Po S-10; `/dashboard` i `/{id_timera}`. |
| S-12 | edit-saved-drill | Edycja zapisanej konfiguracji | no | Po S-10. |
| S-13 | delete-saved-drill | Usunięcie zapisanej konfiguracji | no | Po S-10. |
| S-14 | align-bluetooth-audio | Wyrównanie widoku i sygnałów na słuchawkach Bluetooth | no | Po S-02; najpierw rozstrzygnąć metodę kalibracji i pomiaru słyszalnego opóźnienia. |

## Open Roadmap Questions

1. **Jakie dokładne odcienie zastosować dla dziewięciu wybranych kolorów?** — Do dobrania podczas projektowania interfejsu, przed implementacją FR-014, z zachowaniem łagodności, wyraźnego rozróżnienia barw i kontrastu z czarną czcionką. Zestaw kolorów i ich domyślne przypisanie do faz są ustalone. — Owner: user. Block: S-05 (odroczone).
2. **Jak wyrównać i zmierzyć słyszalny sygnał Bluetooth względem widoku fazy?** — Porównać oszacowanie przeglądarki z kalibracją i sprawdzić wynik na docelowych słuchawkach; programowe znaczniki Web Audio nie wystarczą. — Owner: team. Block: S-14.
3. **Jak realizować usuwanie konta z miesięcznym przetrzymaniem (RODO)?** — Do rozstrzygnięcia: miękkie usunięcie na 30 dni czy natychmiastowe, serwerowy klucz service role (dziś brak), zadanie czyszczące, eksport danych i treść informacyjna. — Owner: user. Block: S-20.

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

- **S-15: Użytkownik wygodnie konfiguruje timer, śledzi przebieg i rozpoznaje jego zakończenie w spójnym, czytelnym widoku pod `/` na telefonie i komputerze; wszystkie istniejące stany i działania pozostają zrozumiałe oraz dostępne.** — Archived 2026-10-02 → `context/archive/2026-09-30-polish-timer-view/`. Lesson: —.

- **S-01: Użytkownik przechodzi z osobnego formularza do pełnego przebiegu faz bez losowego startu** — Archived 2026-09-28 → `context/archive/2026-09-24-run-configured-phases/`. Lesson: —.
- **S-02: Użytkownik uruchamia przebieg, w którym każde ćwiczenie poprzedza nowe, ukryte oczekiwanie 1–5 s liczone po dwóch sygnałach Standby, a rozpoczęcie ćwiczenia i dodatniego odpoczynku ma ustalone dźwięki; odpoczynek 0 s nie emituje sygnału.** — Archived 2026-09-28 → `context/archive/2026-09-25-run-random-start/`. Lesson: —.
- **S-06: Użytkownik wstrzymuje ćwiczenie lub wraca do aplikacji po jej ukryciu i ręcznie wznawia właściwą fazę albo to samo powtórzenie według reguł PRD.** — Archived 2026-10-06 → `context/archive/2026-10-03-pause-and-resume-drill/`. Lesson: —.
- **S-07: Użytkownik anuluje bieżący przebieg i wraca do konfiguracji z zachowanymi ustawieniami.** — Archived 2026-10-06 → `context/archive/2026-10-04-cancel-current-drill/`. Lesson: —.
- **S-08: Użytkownik uruchamia cały przebieg ponownie od przygotowania, z pierwszym powtórzeniem i nowymi losowaniami, gdy losowy start jest włączony.** — Archived 2026-10-06 → `context/archive/2026-10-05-restart-whole-drill/`. Lesson: —.
- **S-09: Użytkownik podaje adres email i przez otrzymany link tworzy konto lub wraca do istniejącego konta.** — Archived 2026-10-06 → `context/archive/2026-10-03-enter-account-by-email-link/`. Lesson: —.
- **S-03: Użytkownik odsłuchuje sygnały ćwiczenia, odpoczynku i Standby przy ich ustawieniach oraz widzi opis znaczenia każdego dźwięku.** — Archived 2026-10-08 → `context/archive/2026-10-06-preview-phase-signals/`. Lesson: —.
- **S-04: Użytkownik widzi trzy sekcje: główne odliczanie lub Standby, stały pełny czas bieżącej fazy oraz nazwę i pełny czas następnej rzeczywistej fazy, z pominięciem przygotowania lub odpoczynku 0 s i z informacją o końcu przebiegu.** — Archived 2026-10-08 → `context/archive/2026-10-06-view-three-phase-sections/`. Lesson: —.
- **S-10: Zalogowany użytkownik tworzy nowy timer pod `/create`, nadaje mu nazwę i zapisuje parametry timera (bez kolorów faz), dostępne tylko dla niego. Nazwa jest unikalna w obrębie użytkownika i ma najwyżej 200 znaków; użytkownik ma najwyżej 50 zapisanych konfiguracji. Gość i zalogowany użytkownik nadal widzą domyślny timer pod `/`.** — Archived 2026-10-08 → `context/archive/2026-10-07-save-named-drill/`. Lesson: —.
- **S-11: Zalogowany użytkownik po wejściu lub odświeżeniu strony `/dashboard` (strona startowa zalogowanego) widzi listę własnych nazwanych konfiguracji z parametrami albo tekst informujący, że nie ma jeszcze zapisanych timerów; pod `/{id_timera}` otwiera szczegóły i uruchamia wybraną konfigurację.** — Archived 2026-10-08 → `context/archive/2026-10-07-open-saved-drill/`. Lesson: —.
- **S-12: Zalogowany użytkownik zmienia nazwę i parametry jednej zapisanej konfiguracji (bez kolorów faz) bez modyfikowania innych; unikalność nazwy per użytkownik i limit 200 znaków obowiązują także przy edycji.** — Archived 2026-10-08 → `context/archive/2026-10-07-edit-saved-drill/`. Lesson: —.
- **S-13: Zalogowany użytkownik usuwa własną konfigurację dopiero po potwierdzeniu pokazującym jej nazwę.** — Archived 2026-10-08 → `context/archive/2026-10-07-delete-saved-drill/`. Lesson: —.
