---
project: "DryFire Drill Timer"
version: 1
status: draft
created: 2026-09-17
context_type: greenfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 2
  hard_deadline: 2027-01-10
  after_hours_only: true
---

## Vision & Problem Statement

Autor projektu podczas ćwiczeń strzeleckich na sucho korzysta z timera HIIT, który obsługuje czas przygotowania, ćwiczenia, odpoczynku i liczbę powtórzeń. Brakuje w nim losowego opóźnienia startu z zadanego przedziału. Przewidywalny czas pozwala przygotować reakcję z wyprzedzeniem zamiast reagować na sygnał, co ogranicza przydatność obecnego timera w tym zastosowaniu.

DryFire Drill Timer ma zachować potrzebny przebieg faz i powtórzeń oraz umożliwić nieprzewidywalny start. Użytkownik chce symulować opisany przez siebie scenariusz zawodów IPSC: po potwierdzeniu gotowości i komendzie „standby” sygnał startu pojawia się po losowym opóźnieniu od 1 do 5 sekund. Jest to opis motywacji użytkownika, a nie deklaracja zgodności aplikacji z regulaminem zawodów. Reguły timera pozostają takie same niezależnie od liczby użytkowników, również przy stukrotnym wzroście skali.

## User & Persona

Pierwszym użytkownikiem jest autor projektu, ćwiczący strzelanie na sucho. Sięga po timer do prowadzenia sekwencji przygotowania, ćwiczenia i odpoczynku przez zadaną liczbę powtórzeń. Potrzebuje reagować na nieprzewidywalny sygnał startu.

## Success Criteria

### Primary

- Użytkownik bez logowania ustawia czasy przygotowania, ćwiczenia i odpoczynku oraz liczbę powtórzeń i opcjonalnie włącza losowy start o stałym przedziale 1–5 s, a następnie uruchamia pełny przebieg. Nieprzerwany przebieg obejmuje jednorazowe przygotowanie i zadaną liczbę cykli: opcjonalne losowe oczekiwanie, ćwiczenie, odpoczynek, włącznie z odpoczynkiem po ostatnim ćwiczeniu.
- Przy włączonym losowym starcie każde powtórzenie otrzymuje osobno losowane opóźnienie z przedziału 1–5 s co 0,01 s. Podczas oczekiwania widoczny jest tylko napis „Standby”; pozostałe fazy pokazują czas. Losowe oczekiwanie rozpoczyna się dopiero po zakończeniu obu krótkich dźwięków Standby w innej tonacji niż start ćwiczenia; czas ich odtwarzania nie wlicza się do opóźnienia 1–5 s. Początek ćwiczenia sygnalizuje jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.

### Secondary

- Użytkownik może wygodnie skonfigurować i uruchomić timer w przeglądarce na telefonie lub komputerze.

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
- Odliczanie wylosowanego opóźnienia zaczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby; czas odtwarzania obu dźwięków nie wlicza się do opóźnienia. Po upływie całego wylosowanego czasu rozpoczyna się sygnał startu ćwiczenia.
- W czasie losowego oczekiwania widoczny jest wyłącznie napis „Standby”; pozostałe fazy pokazują czas.
- Początek Standby sygnalizują dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, początek ćwiczenia jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.
- Czas ćwiczenia wynosi 4 s niezależnie od długości poprzedzającego oczekiwania.
- Przebieg kończy się po odpoczynku trzeciego cyklu.

## Functional Requirements

Użytkownik potwierdził wszystkie 12 wymagań jako must-have. Runda wyzwania Sokratesowego została zakończona; poniżej zapisano kontrargumenty i rozstrzygnięcia użytkownika.

### Konfiguracja i przebieg timera

- FR-001: Użytkownik może bez logowania ustawić czas przygotowania 0–600 s, ćwiczenia i odpoczynku po 1–600 s, w pełnych sekundach, oraz liczbę powtórzeń 1–100; przygotowanie 0 s jest pomijane. Priority: must-have
  > Socrates: Kontrargument: pełne sekundy mogą być zbyt mało precyzyjne dla krótkich ćwiczeń. Decyzja użytkownika: bez zmian.
- FR-002: Użytkownik może włączyć lub wyłączyć losowy start o stałym przedziale 1–5 s, z osobnym losowaniem co 0,01 s przed każdym powtórzeniem; odliczanie wylosowanego czasu zaczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby, a czas odtwarzania sygnałów nie wlicza się do opóźnienia 1–5 s. Priority: must-have
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
- Aplikacja webowa umożliwia konfigurację i pełny przebieg timera oraz uzgodnioną obsługę pauzy w przeglądarce na telefonie lub komputerze, bez ograniczenia do konkretnego modelu urządzenia lub systemu operacyjnego.
- Interfejs dostosowuje się do ekranów telefonów i komputerów, bez konieczności przewijania w poziomie. Na telefonie obszary dotykowe przycisków mają co najmniej 44 × 44 piksele CSS i odstępy ograniczające przypadkowe naciśnięcia. Podczas działania timera faza i odliczanie są czytelne bez powiększania, a sterowanie jest łatwo dostępne.
- Podczas uruchomionego przebiegu ekran nie wygasza się automatycznie. Ręczna blokada ekranu powoduje pauzę według ustalonych reguł.
- Konfiguracje zapisane na koncie są dostępne wyłącznie właścicielowi.
- W trakcie Standby użytkownik nie otrzymuje informacji ujawniającej pozostały czas ani zaplanowany moment startu.

## Business Logic

Timer realizuje ustawione fazy i powtórzenia, a przy włączonym losowym starcie każde ćwiczenie poprzedza niezależnie losowanym oczekiwaniem 1–5 s, ukrywając przed użytkownikiem moment sygnału startu.

Wejściem są czas przygotowania 0–600 s, czasy ćwiczenia i odpoczynku po 1–600 s (wszystkie w pełnych sekundach), liczba powtórzeń 1–100 oraz wybór włączenia lub wyłączenia losowego startu. Przedział losowania 1–5 s jest stały; wartości losowane są co 0,01 s. Nieprzerwany przebieg zaczyna się przygotowaniem, po którym następuje zadana liczba cykli obejmujących opcjonalne Standby, pełny czas ćwiczenia i odpoczynek, także po ostatnim ćwiczeniu. Przygotowanie 0 s jest pomijane, również przy wznowieniu i restarcie. Losowe oczekiwanie nie skraca ćwiczenia.

Użytkownik rozpoznaje fazy po sygnałach: Standby — dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, ćwiczenie — jeden długi dźwięk, odpoczynek — jeden krótki dźwięk. Odliczanie losowego oczekiwania 1–5 s rozpoczyna się dopiero po zakończeniu drugiego krótkiego dźwięku Standby. Czas odtwarzania sygnałów nie wlicza się do tego opóźnienia; po jego upływie rozpoczyna się długi sygnał startu ćwiczenia. Przygotowanie nie ma dźwięku. Podczas Standby widoczny jest wyłącznie ten napis, a podczas pozostałych faz pozostały czas. Przed startem użytkownik może odsłuchać sygnały przy odpowiednich ustawieniach wraz z informacją o ich znaczeniu.

Wznowienie pauzy w Standby lub ćwiczeniu dodaje pełne przygotowanie i rozpoczyna to samo powtórzenie od początku, zachowując ukończone powtórzenia; przy włączonym losowym starcie opóźnienie losowane jest ponownie i odliczane dopiero po zakończeniu obu ponownie odtworzonych krótkich dźwięków Standby. Wznowienie przygotowania lub odpoczynku kontynuuje pozostały czas bez ponownego sygnału. Przejście do innej aplikacji lub blokada ekranu powoduje pauzę wymagającą ręcznego wznowienia po powrocie według tych samych reguł. Anulowanie wraca do konfiguracji z zachowaniem ustawień, a ponowne uruchomienie rozpoczyna cały przebieg od przygotowania.

## Access Control

Timer jest dostępny bez logowania, bez możliwości zapisywania konfiguracji na koncie. Konto jest potrzebne do zapisywania własnych konfiguracji.

Logowanie odbywa się przez magic link — jednorazowy link wysyłany na adres email użytkownika. Pierwsze poprawne użycie linku dla nowego adresu tworzy konto, a kolejne loguje do istniejącego konta. Nie ma osobnego formularza rejestracji.

Jeden rodzaj konta. Każdy zalogowany użytkownik zarządza wyłącznie własnymi konfiguracjami.

Po odświeżeniu strony dane niezalogowanego użytkownika nie są zachowywane. Zalogowany użytkownik trafia na stronę startową — listę zapisanych konfiguracji. Odświeżenie nie wznawia aktywnego przebiegu.

## Non-Goals

### Permanent Non-Goals

Trwałe granice produktu: poniższe funkcje nie będą implementowane ani w MVP, ani w przyszłych wersjach aplikacji.

- Udostępnianie konfiguracji, funkcje społecznościowe i rozbudowane role — produkt służy samodzielnej pracy z własnymi konfiguracjami.
- Integracje z urządzeniami zewnętrznymi i sprzętem treningowym — produkt pozostaje samodzielnym timerem bez integracji sprzętowych.

### MVP Non-Goals

Wyłączenia dotyczące pierwszej wersji; nie stanowią zobowiązania do implementacji w przyszłości.

- Historia treningów i statystyki — MVP prowadzi bieżące ćwiczenie, bez zapisywania zakończonych sesji (daty, użytej konfiguracji, ukończonych powtórzeń, czasu ćwiczeń) i zestawień aktywności między sesjami.
- Gotowa biblioteka drillów — użytkownik sam konfiguruje ćwiczenia.
- Tryb offline i pełna aplikacja PWA — MVP nie zapewnia działania offline ani pełnego zakresu PWA.
- Powiadomienia poza aktywną aplikacją — przejście w tło powoduje pauzę z ręcznym wznowieniem po powrocie.

## Open Questions

Brak nierozstrzygniętych pytań z końcowej kontroli zakresu produktu. Planowanym środowiskiem testów odbiorowych jest Chrome na iPhonie 15 Pro Max, w najnowszych stabilnych wersjach przeglądarki i iOS dostępnych w dniu odbioru MVP. iPhone jest wyłącznie wskazanym urządzeniem testowym i nie ogranicza platform docelowych aplikacji webowej. Testy mogą być również przeprowadzone na innym telefonie lub w przeglądarce na komputerze. Faktycznie użyte urządzenia, systemy operacyjne i wersje przeglądarek zostaną odnotowane przy testach.
