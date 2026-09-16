---
project: "DryFire Drill Timer"
context_type: greenfield
product_type: web-app
target_scale:
  users: small
created: 2026-09-16
updated: 2026-09-16
timeline_budget:
  mvp_weeks: 2
  hard_deadline: 2027-01-10
  after_hours_only: true
checkpoint:
  current_phase: 7
  phases_completed: [1, 2, 3, 4, 5, 6]
  gray_areas_resolved:
    - topic: "Typ kontekstu projektu"
      decision: "Greenfield — użytkownik potwierdził budowę nowej aplikacji od zera."
    - topic: "Pierwszy użytkownik i obecne rozwiązanie"
      decision: "Autor projektu ćwiczy na sucho z timerem HIIT; brakuje mu losowego startu z zadanego przedziału."
    - topic: "Cel losowego startu"
      decision: "Start ma wymuszać reakcję na sygnał, zamiast pozwalać na przygotowanie reakcji dzięki przewidywalnemu czasowi."
    - topic: "Rozdzielczość losowania a dokładność sygnału"
      decision: "Wartości opóźnienia są losowane co 0,01 s. Akceptowalny bezwzględny błąd momentu sygnału względem zaplanowanego momentu wynosi maksymalnie 0,2 s."
    - topic: "Role i własność konfiguracji"
      decision: "Jeden rodzaj konta; każdy zarządza wyłącznie własnymi konfiguracjami."
    - topic: "Metoda logowania"
      decision: "Magic link — jednorazowy link wysyłany na adres email użytkownika."
    - topic: "Tworzenie konta"
      decision: "Pierwsze poprawne użycie magic linku tworzy konto; kolejne loguje do istniejącego konta, bez osobnego formularza rejestracji."
    - topic: "Dostęp bez logowania"
      decision: "Timer jest dostępny bez logowania. Konto jest potrzebne do zapisywania własnych konfiguracji."
    - topic: "Wprowadzanie i prezentacja czasu"
      decision: "Ustawienia czasu w pełnych sekundach; losowanie co 0,01 s. Losowe oczekiwanie pokazuje wyłącznie Standby; pozostałe fazy pokazują czas."
    - topic: "Budżet MVP"
      decision: "Całe MVP: 2 tygodnie przy zaangażowaniu 10–15 godzin tygodniowo."
    - topic: "Dodatkowe kryterium sukcesu i warunki konieczne"
      decision: "Wygodna obsługa konfiguracji i uruchamiania timera na telefonie; konfiguracje konta dostępne wyłącznie właścicielowi; Standby nie ujawnia pozostałego czasu ani momentu startu."
    - topic: "Sterowanie przebiegiem"
      decision: "Zatrzymanie oznacza pauzę z możliwością wznowienia; anulowanie kończy przebieg i wraca do konfiguracji z zachowaniem ustawień; ponowne uruchomienie zaczyna cały przebieg od przygotowania."
    - topic: "Wznowienie po pauzie"
      decision: "Standby lub ćwiczenie: pełny czas przygotowania, następnie to samo powtórzenie od początku z właściwymi sygnałami i nowym losowaniem, jeśli włączone. Ukończone powtórzenia zostają zachowane. Przygotowanie i odpoczynek: kontynuacja pozostałego czasu bez ponownego sygnału początku fazy."
    - topic: "Priorytety wymagań funkcjonalnych"
      decision: "Użytkownik potwierdził wszystkie 12 wymagań jako obowiązkowe w MVP."
    - topic: "Stały przedział losowego startu"
      decision: "Losowy start można włączyć lub wyłączyć; przedział 1–5 s jest stały i nie podlega konfiguracji. Losowanie co 0,01 s."
    - topic: "Odsłuch sygnałów"
      decision: "Przygotowanie nie ma dźwięku. Przy ustawieniach ćwiczenia, odpoczynku i opcji Standby dostępny jest przycisk odsłuchu właściwego sygnału z informacją o jego znaczeniu."
    - topic: "Rozpoznawanie i usuwanie konfiguracji"
      decision: "Użytkownik nadaje nazwę przy zapisie; lista pokazuje nazwę i parametry; usunięcie wymaga potwierdzenia z nazwą konfiguracji."
    - topic: "Jednozdaniowa reguła biznesowa"
      decision: "Timer prowadzi użytkownika przez skonfigurowane fazy i powtórzenia, a przy włączonym losowym starcie poprzedza każde ćwiczenie niezależnym, ukrytym oczekiwaniem 1–5 s, aby użytkownik reagował na sygnał bez znajomości momentu startu."
    - topic: "Przejście aplikacji w tło i blokada ekranu"
      decision: "Przejście do innej aplikacji lub zablokowanie ekranu powoduje pauzę; po powrocie wymagane jest ręczne wznowienie według ustalonych reguł."
    - topic: "Środowisko weryfikacji"
      decision: "Chrome na iPhonie 15 Pro Max."
    - topic: "Początkowa skala użytkowników"
      decision: "Autor projektu i najwyżej kilka osób."
    - topic: "Wpływ skali na reguły timera"
      decision: "Reguły timera pozostają takie same niezależnie od liczby użytkowników."
    - topic: "Terminy kalendarzowe"
      decision: "Twardy termin: 10 stycznia 2027. Cel preferowany: 4 listopada 2026; cel zapasowy w razie problemów: 6 grudnia 2026. Plan nakładu pracy pozostaje równy 2 tygodniom po 10–15 godzin tygodniowo."
    - topic: "Odświeżenie strony"
      decision: "Dla gościa dane nie są zachowywane. Zalogowany użytkownik wraca na stronę startową z listą zapisanych konfiguracji; aktywny przebieg nie jest wznawiany po odświeżeniu."
    - topic: "Zapobieganie wygaszaniu"
      decision: "Podczas uruchomionego przebiegu ekran ma pozostawać włączony. Ręczna blokada ekranu nadal powoduje pauzę."
    - topic: "Limity konfiguracji"
      decision: "Powtórzenia: 1–100. Przygotowanie: 0–600 s; ćwiczenie i odpoczynek: 1–600 s. Czasy ustawiane w pełnych sekundach. Losowy start pozostaje w stałym przedziale 1–5 s co 0,01 s. Przygotowanie 0 s oznacza pominięcie tej fazy."
    - topic: "Zakres zgodności wersji"
      decision: "iPhone 15 Pro Max z najnowszymi stabilnymi wersjami Chrome i iOS dostępnymi w dniu odbioru MVP; konkretne numery wersji zapisane przy testach."
  frs_drafted: 12
  quality_check_status: pending
---

## Seed idea

Źródło: `idea-notes.md`. Plik zawiera opis pomysłu dostarczony przez użytkownika i pozostaje niezmieniony.

## Vision & Problem Statement

Autor projektu podczas ćwiczeń strzeleckich na sucho korzysta z timera HIIT, który obsługuje czas przygotowania, ćwiczenia, odpoczynku i liczbę powtórzeń. Brakuje w nim losowego opóźnienia startu z zadanego przedziału. Przewidywalny czas pozwala przygotować reakcję z wyprzedzeniem zamiast reagować na sygnał, co ogranicza przydatność obecnego timera w tym zastosowaniu.

DryFire Drill Timer ma zachować potrzebny przebieg faz i powtórzeń oraz umożliwić nieprzewidywalny start. Użytkownik chce symulować opisany przez siebie scenariusz zawodów IPSC: po potwierdzeniu gotowości i komendzie „standby” sygnał startu pojawia się po losowym opóźnieniu od 1 do 5 sekund. Jest to opis motywacji użytkownika, a nie deklaracja zgodności aplikacji z regulaminem zawodów. Reguły timera pozostają takie same niezależnie od liczby użytkowników, również przy stukrotnym wzroście skali.

## User & Persona

Pierwszym użytkownikiem jest autor projektu, ćwiczący strzelanie na sucho. Sięga po timer do prowadzenia sekwencji przygotowania, ćwiczenia i odpoczynku przez zadaną liczbę powtórzeń. Potrzebuje reagować na nieprzewidywalny sygnał startu.

## Success Criteria

### Primary

- Użytkownik bez logowania ustawia czasy przygotowania, ćwiczenia i odpoczynku oraz liczbę powtórzeń i opcjonalnie włącza losowy start o stałym przedziale 1–5 s, a następnie uruchamia pełny przebieg. Nieprzerwany przebieg obejmuje jednorazowe przygotowanie i zadaną liczbę cykli: opcjonalne losowe oczekiwanie, ćwiczenie, odpoczynek, włącznie z odpoczynkiem po ostatnim ćwiczeniu.
- Przy włączonym losowym starcie każde powtórzenie otrzymuje osobno losowane opóźnienie z przedziału 1–5 s co 0,01 s. Podczas oczekiwania widoczny jest tylko napis „Standby”; pozostałe fazy pokazują czas. Początek oczekiwania sygnalizują dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, początek ćwiczenia jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.

### Secondary

- Użytkownik może wygodnie skonfigurować i uruchomić timer na telefonie.

### Guardrails

- Konfiguracje konta są dostępne wyłącznie właścicielowi.
- Podczas „Standby” interfejs nie ujawnia pozostałego czasu ani momentu startu ćwiczenia.

## User Stories

### US-01: Użytkownik wykonuje pełny przebieg z losowym startem

- **Given** niezalogowany użytkownik ustawił przygotowanie 5 s, ćwiczenie 4 s, odpoczynek 2 s, 3 powtórzenia i włączył losowy start o stałym przedziale 1–5 s.
- **When** uruchamia timer i pozwala mu zakończyć przebieg bez przerw.
- **Then** po 5 s przygotowania timer wykonuje 3 cykle: niezależnie losowane „Standby”, 4 s ćwiczenia i 2 s odpoczynku. Odtwarza ustalone sygnały, ukrywa czas „Standby” i kończy przebieg po ostatnim odpoczynku.

#### Acceptance Criteria

- Przygotowanie występuje raz, przed pierwszym cyklem nieprzerwanego przebiegu.
- Każdy z trzech cykli otrzymuje osobno losowane opóźnienie z przedziału 1–5 s, co 0,01 s.
- W czasie losowego oczekiwania widoczny jest wyłącznie napis „Standby”; pozostałe fazy pokazują czas.
- Początek Standby sygnalizują dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, początek ćwiczenia jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.
- Czas ćwiczenia wynosi 4 s niezależnie od długości poprzedzającego oczekiwania.
- Przebieg kończy się po odpoczynku trzeciego cyklu.

## Functional Requirements

Użytkownik potwierdził wszystkie 12 wymagań jako must-have. Runda wyzwania Sokratesowego została zakończona; poniżej zapisano kontrargumenty i rozstrzygnięcia użytkownika.

### Konfiguracja i przebieg timera

- FR-001: Użytkownik może bez logowania ustawić czas przygotowania 0–600 s, ćwiczenia i odpoczynku po 1–600 s, w pełnych sekundach, oraz liczbę powtórzeń 1–100; przygotowanie 0 s jest pomijane. Priority: must-have
  > Socrates: Kontrargument: pełne sekundy mogą być zbyt mało precyzyjne dla krótkich ćwiczeń. Decyzja użytkownika: bez zmian.
- FR-002: Użytkownik może włączyć lub wyłączyć losowy start o stałym przedziale 1–5 s, z osobnym losowaniem co 0,01 s przed każdym powtórzeniem. Priority: must-have
  > Socrates: Kontrargument: stałe 1–5 s wystarczy, a dowolny przedział zwiększa liczbę ustawień. Decyzja użytkownika: stałe 1–5 s z możliwością włączenia lub wyłączenia losowego startu.
- FR-003: Użytkownik może uruchomić pełny przebieg z jednorazowym przygotowaniem i zadaną liczbą cykli obejmujących opcjonalne Standby, ćwiczenie i odpoczynek, także po ostatnim ćwiczeniu. Priority: must-have
  > Socrates: Kontrargument: użytkownik może oczekiwać zakończenia od razu po ostatnim ćwiczeniu. Decyzja użytkownika: bez zmian, ostatni odpoczynek pozostaje.
- FR-004: Użytkownik może rozpoznać początek Standby po dwóch krótkich dźwiękach w innej tonacji niż start ćwiczenia, początek ćwiczenia po jednym długim dźwięku i początek odpoczynku po jednym krótkim dźwięku oraz przy ustawieniach ćwiczenia, odpoczynku i opcji Standby użyć przycisku odsłuchu sygnału z informacją o jego znaczeniu; przygotowanie nie ma sygnału dźwiękowego. Priority: must-have
  > Socrates: Kontrargument: bez wcześniejszego odsłuchu znaczenie sygnałów może być niejasne. Decyzja użytkownika: przyciski odsłuchu z informacją o znaczeniu przy ćwiczeniu, odpoczynku i opcji Standby; przygotowanie pozostaje bez dźwięku i bez przycisku odsłuchu.
- FR-005: Użytkownik może obserwować pozostały czas przygotowania, ćwiczenia i odpoczynku, natomiast podczas losowego oczekiwania widzi wyłącznie napis „Standby”. Priority: must-have
  > Socrates: Kontrargument: odliczanie podczas ćwiczenia może odciągać od niego uwagę. Decyzja użytkownika: bez zmian.

### Sterowanie timerem

- FR-006: Użytkownik może zatrzymać przebieg i go wznowić; przejście do innej aplikacji lub zablokowanie ekranu również powoduje pauzę wymagającą ręcznego wznowienia; po pauzie w Standby lub ćwiczeniu odliczany jest pełny czas przygotowania, po czym to samo powtórzenie zaczyna się od początku z właściwymi sygnałami i nowym losowaniem, jeśli włączone, z zachowaniem ukończonych powtórzeń; przygotowanie i odpoczynek kontynuują pozostały czas bez ponawiania sygnału początku fazy. Priority: must-have
  > Socrates: Kontrargument: wznowienie ćwiczenia bez przygotowania może zaskoczyć użytkownika. Decyzja użytkownika: pełne przygotowanie i rozpoczęcie tego samego powtórzenia od początku, wraz z dźwiękami i nowym losowaniem, jeśli włączone; nie kontynuacja pozostałego czasu ćwiczenia.
- FR-007: Użytkownik może anulować przebieg i wrócić do konfiguracji z zachowaniem ustawień. Priority: must-have
  > Socrates: Kontrargument: przypadkowe naciśnięcie może zakończyć przebieg wbrew intencji użytkownika. Decyzja użytkownika: bez zmian.
- FR-008: Użytkownik może ponownie uruchomić cały przebieg od przygotowania. Priority: must-have
  > Socrates: Kontrargument: przypadkowy restart może utracić postęp bieżącego przebiegu. Decyzja użytkownika: bez zmian.

### Konto i zapisane konfiguracje

- FR-009: Użytkownik może uzyskać dostęp do konta przez magic link; pierwsze poprawne użycie linku tworzy konto dla nowego adresu, a kolejne loguje. Priority: must-have
  > Socrates: Kontrargument: otwieranie poczty może utrudnić dostęp do konfiguracji przed ćwiczeniem. Decyzja użytkownika: bez zmian.
- FR-010: Zalogowany użytkownik może zapisać własną konfigurację timera, nadając jej nazwę. Priority: must-have
  > Socrates: Kontrargument: bez rozróżnialnych nazw trudno rozpoznać zapisaną konfigurację. Decyzja użytkownika: nadawanie nazwy przy zapisie.
- FR-011: Zalogowany użytkownik może przeglądać listę własnych konfiguracji z nazwami i parametrami oraz ich szczegóły i uruchomić wybraną konfigurację; lista jest stroną startową, na którą trafia po odświeżeniu strony. Priority: must-have
  > Socrates: Kontrargument: wybór bez widocznych parametrów może prowadzić do uruchomienia niewłaściwego ćwiczenia. Decyzja użytkownika: nazwa i parametry widoczne na liście przed uruchomieniem.
- FR-012: Zalogowany użytkownik może edytować i usuwać własne konfiguracje, przy czym usunięcie wymaga potwierdzenia z nazwą konfiguracji. Priority: must-have
  > Socrates: Kontrargument: przypadkowo usuniętą konfigurację trzeba odtworzyć z pamięci. Decyzja użytkownika: potwierdzenie usunięcia z nazwą konfiguracji.

## Non-Functional Requirements

- Podczas aktywnego przebiegu bezwzględny błąd momentu emisji sygnału dźwiękowego względem zaplanowanego momentu nie przekracza 0,2 s. Krok losowania 0,01 s jest odrębną właściwością.
- Aplikacja umożliwia konfigurację i pełny przebieg timera oraz uzgodnioną obsługę pauzy na iPhonie 15 Pro Max w najnowszych stabilnych wersjach Chrome i iOS dostępnych w dniu odbioru MVP. Konkretne numery wersji zostaną zapisane przy testach.
- Podczas uruchomionego przebiegu ekran nie wygasza się automatycznie. Ręczna blokada ekranu powoduje pauzę według ustalonych reguł.
- Konfiguracje zapisane na koncie są dostępne wyłącznie właścicielowi.
- W trakcie Standby użytkownik nie otrzymuje informacji ujawniającej pozostały czas ani zaplanowany moment startu.

## Business Logic

Timer prowadzi użytkownika przez skonfigurowane fazy i powtórzenia, a przy włączonym losowym starcie poprzedza każde ćwiczenie niezależnym, ukrytym oczekiwaniem 1–5 s, aby użytkownik reagował na sygnał bez znajomości momentu startu.

Wejściem są czas przygotowania 0–600 s, czasy ćwiczenia i odpoczynku po 1–600 s (wszystkie w pełnych sekundach), liczba powtórzeń 1–100 oraz wybór włączenia lub wyłączenia losowego startu. Przedział losowania 1–5 s jest stały; wartości losowane są co 0,01 s. Nieprzerwany przebieg zaczyna się przygotowaniem, po którym następuje zadana liczba cykli obejmujących opcjonalne Standby, pełny czas ćwiczenia i odpoczynek, także po ostatnim ćwiczeniu. Przygotowanie 0 s jest pomijane, również przy wznowieniu i restarcie. Losowe oczekiwanie nie skraca ćwiczenia.

Użytkownik rozpoznaje fazy po sygnałach: Standby — dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, ćwiczenie — jeden długi dźwięk, odpoczynek — jeden krótki dźwięk. Przygotowanie nie ma dźwięku. Podczas Standby widoczny jest wyłącznie ten napis, a podczas pozostałych faz pozostały czas. Przed startem użytkownik może odsłuchać sygnały przy odpowiednich ustawieniach wraz z informacją o ich znaczeniu.

Wznowienie pauzy w Standby lub ćwiczeniu dodaje pełne przygotowanie i rozpoczyna to samo powtórzenie od początku, zachowując ukończone powtórzenia; przy włączonym losowym starcie opóźnienie losowane jest ponownie. Wznowienie przygotowania lub odpoczynku kontynuuje pozostały czas bez ponownego sygnału. Przejście do innej aplikacji lub blokada ekranu powoduje pauzę wymagającą ręcznego wznowienia po powrocie według tych samych reguł. Anulowanie wraca do konfiguracji z zachowaniem ustawień, a ponowne uruchomienie rozpoczyna cały przebieg od przygotowania.

## Access Control

Timer jest dostępny bez logowania, bez możliwości zapisywania konfiguracji na koncie. Konto jest potrzebne do zapisywania własnych konfiguracji.

Logowanie odbywa się przez magic link — jednorazowy link wysyłany na adres email użytkownika. Pierwsze poprawne użycie linku dla nowego adresu tworzy konto, a kolejne loguje do istniejącego konta. Nie ma osobnego formularza rejestracji.

Jeden rodzaj konta. Każdy zalogowany użytkownik zarządza wyłącznie własnymi konfiguracjami.

Po odświeżeniu strony dane niezalogowanego użytkownika nie są zachowywane. Zalogowany użytkownik trafia na stronę startową — listę zapisanych konfiguracji. Odświeżenie nie wznawia aktywnego przebiegu.

## Non-Goals

- Historia treningów i statystyki — MVP prowadzi bieżące ćwiczenie, bez zapisywania zakończonych sesji (daty, użytej konfiguracji, ukończonych powtórzeń, czasu ćwiczeń) i zestawień aktywności między sesjami.
- Udostępnianie konfiguracji, funkcje społecznościowe i rozbudowane role — produkt służy samodzielnej pracy z własnymi konfiguracjami.
- Gotowa biblioteka drillów — użytkownik sam konfiguruje ćwiczenia.
- Integracje z urządzeniami zewnętrznymi i sprzętem treningowym — przebieg obsługiwany jest w aplikacji na telefonie.
- Tryb offline i pełna aplikacja PWA — MVP nie zapewnia działania offline ani pełnego zakresu PWA.
- Powiadomienia poza aktywną aplikacją — przejście w tło powoduje pauzę z ręcznym wznowieniem po powrocie.

## Open Questions

Brak nierozstrzygniętych pytań z końcowej kontroli zakresu produktu. Konkretne wersje środowiska odbioru zostaną odnotowane przy testach zgodnie z wymaganiem zgodności.

## MVP flow

1. Użytkownik otwiera aplikację i ustawia czas przygotowania 0–600 s, ćwiczenia i odpoczynku po 1–600 s oraz liczbę powtórzeń 1–100.
2. Opcjonalnie włącza losowy start o stałym przedziale 1–5 s, bez edycji granic. Pozostałe ustawienia czasu są w pełnych sekundach, np. 0:02, 0:05, 0:10. Przy ustawieniach ćwiczenia, odpoczynku i opcji Standby może odsłuchać właściwy sygnał wraz z informacją o jego znaczeniu.
3. Użytkownik uruchamia timer. Czas przygotowania jest odliczany raz na początku nieprzerwanego przebiegu, bez sygnału dźwiękowego; przy 0 s faza jest pomijana.
4. Jeśli włączono losowy start, przed każdym ćwiczeniem losowane jest nowe opóźnienie 1–5 s co 0,01 s. Dwa krótkie sygnały rozpoczynają oczekiwanie z widocznym wyłącznie napisem „Standby”. Opóźnienie poprzedza czas ćwiczenia i nie skraca go.
5. Jeden długi sygnał rozpoczyna odliczanie pełnego czasu ćwiczenia.
6. Jeden krótki sygnał rozpoczyna odliczanie odpoczynku.
7. Kroki 4–6 powtarzają się zadaną liczbę razy, a przebieg kończy się po ostatnim odpoczynku. Przy wyłączonym losowym starcie krok 4 jest pomijany.

Przykład podany przez użytkownika: 3 powtórzenia, przygotowanie 5 s, ćwiczenie 4 s, losowe opóźnienie 1–5 s, odpoczynek 2 s. Dokładne wylosowane wartości nie są z góry narzucone.

### Sterowanie przebiegiem

- Zatrzymanie oznacza pauzę z możliwością wznowienia.
- Przejście do innej aplikacji lub zablokowanie ekranu powoduje pauzę. Powrót do aplikacji nie wznawia automatycznie przebiegu; użytkownik wznawia go ręcznie według reguł właściwych dla przerwanej fazy.
- Wznowienie po pauzie w Standby lub ćwiczeniu odlicza pełny skonfigurowany czas przygotowania, a następnie rozpoczyna to samo powtórzenie od początku. Przy włączonym losowym starcie podwójny krótki sygnał rozpoczyna nowe oczekiwanie losowane z 1–5 s, po którym długi sygnał rozpoczyna pełny czas ćwiczenia. Przy wyłączonym losowym starcie po przygotowaniu długi sygnał rozpoczyna od razu pełny czas ćwiczenia. Ukończone powtórzenia pozostają zachowane. Dodatkowe przygotowanie dotyczy takiego wznowienia, nie wszystkich kolejnych powtórzeń.
- Wznowienie podczas przygotowania lub odpoczynku kontynuuje pozostały czas bez ponownego sygnału początku fazy.
- Anulowanie kończy przebieg i wraca do konfiguracji, zachowując ustawienia.
- Ponowne uruchomienie rozpoczyna cały przebieg od przygotowania.
- Odświeżenie strony nie zachowuje danych gościa; zalogowanego użytkownika kieruje na listę zapisanych konfiguracji. Aktywny przebieg nie jest wznawiany po odświeżeniu.
- Podczas uruchomionego przebiegu ekran ma pozostawać włączony bez automatycznego wygaszania.
- Przygotowanie ustawione na 0 s jest pomijane także przy wznowieniu lub ponownym uruchomieniu przebiegu.

## Timeline budget

Użytkownik zakłada 2 tygodnie na całe MVP przy zaangażowaniu 10–15 godzin tygodniowo, wyłącznie po godzinach pracy.

Twardy, nieprzekraczalny termin zakończenia: 10 stycznia 2027. Wcześniejsze cele kalendarzowe: 4 listopada 2026 — preferowany termin, jeśli uda się go osiągnąć; 6 grudnia 2026 — termin zapasowy dający dodatkowy czas w razie problemów. Cele kalendarzowe nie zmieniają dwutygodniowego planu pracy nad MVP.

## Forward: technical-roadmap

Wymagania procesu dostarczone w `idea-notes.md`, do przejęcia w planowaniu technicznym:

- Pierwszy działający kamień milowy: pełny timer z fazami, powtórzeniami i losowym startem przed dodaniem zapisywania konfiguracji.
- Co najmniej jeden test pełnego przepływu z perspektywy użytkownika; w notatkach dopuszczono test automatyczny lub inny powtarzalny test akceptacyjny.
- Wersja wdrożona pod adresem umożliwiającym demonstrację oraz dokumentacja kontekstowa opisująca decyzje, ograniczenia i sposób weryfikacji wyników agentów.
- Cel autora: implementacja wykonywana przez agentów LLM; autor definiuje zadania, weryfikuje rezultaty, uruchamia testy i kieruje poprawkami bez ręcznego pisania kodu.
- Do rozstrzygnięcia po wyborze technologii: mechanizm wdrożenia i przechowywania danych oraz zestaw dokumentów i dowodów procesu pracy agentów.

## Quality cross-check

| Kryterium | Wynik |
| --- | --- |
| Access Control | present — magic link, dostęp gościa, własność konfiguracji |
| Business Logic | present — zatwierdzona jednozdaniowa reguła i opis przebiegu |
| Project artifacts | present — shape-notes.md i checkpoint |
| Timeline-cost acknowledgment | present — MVP 2 tygodnie, dodatkowe potwierdzenie dłuższego terminu nie jest wymagane |
| Non-Goals | present — jawne wyłączenia zakresu |
| Preserved behavior | n/a — greenfield |

Nie wykryto braków w kryteriach kontroli. Wszystkie 12 FR-ów ma zapis rundy Sokratesowej; US-01 jest potwierdzony. Wynik oczekuje na końcową akceptację użytkownika.

## Session status

Fazy 1–6 zostały ukończone, włącznie z rundą wyzwania Sokratesowego dla wszystkich 12 wymagań must-have. Potwierdzono US-01, regułę biznesową, wymagania jakościowe i granice MVP. Bieżąca faza: 7 (końcowa kontrola krzyżowa). Kontrola zakończona bez braków; oczekuje na końcową akceptację użytkownika.
