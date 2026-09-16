# DryFire Drill Timer

## Główny problem i cel projektu

Osoby ćwiczące strzelanie na sucho potrzebują prostego timera, który prowadzi je przez powtarzalny scenariusz ćwiczenia i nie ujawnia z góry momentu rozpoczęcia właściwego ćwiczenia. Celem projektu jest umożliwienie treningu sekwencji, dyscypliny czasowej i refleksu bez używania ostrej amunicji.

Użytkownik powinien móc zdefiniować ćwiczenie składające się z faz przygotowania, ćwiczenia i odpoczynku, określić liczbę powtórzeń oraz — opcjonalnie — ustawić losowy czas rozpoczęcia fazy ćwiczenia.

## Najmniejszy zestaw funkcjonalności (MVP)

- Responsywna aplikacja webowa wygodna w użyciu na urządzeniach mobilnych.
- Rejestracja, logowanie i dostęp użytkownika do jego własnych danych.
- Tworzenie konfiguracji timera z ustawieniami:
  - czasu przygotowania,
  - czasu ćwiczenia,
  - czasu odpoczynku,
  - liczby powtórzeń cyklu ćwiczenie–odpoczynek,
  - zakresu losowego opóźnienia rozpoczęcia ćwiczenia.
- Lista zapisanych konfiguracji oraz ich przeglądanie, edycja i usuwanie.
- Uruchomienie wybranej konfiguracji i przeprowadzenie użytkownika przez wszystkie fazy oraz powtórzenia.
- Czytelny sygnał rozpoczęcia ćwiczenia i sygnały zmiany faz.
- Możliwość zatrzymania, anulowania i ponownego uruchomienia timera.
- Co najmniej jeden test sprawdzający pełny przepływ z perspektywy użytkownika.
- Dokumentacja kontekstowa projektu i wersja wdrożona pod adresem umożliwiającym demonstrację.

Pierwszy działający kamień milowy: pojedynczy timer realizujący pełną sekwencję faz, powtórzenia i losowy start, jeszcze przed dodaniem zapisywania konfiguracji.

## Co nie wchodzi w MVP

Poniższe elementy są propozycjami ograniczenia zakresu i wymagają potwierdzenia podczas sesji planistycznej:

- statystyki wyników i historia treningów,
- udostępnianie ćwiczeń innym użytkownikom,
- gotowa biblioteka przykładowych drillów,
- tryb offline i pełna aplikacja PWA,
- powiadomienia działające poza aktywną aplikacją,
- integracja z urządzeniami zewnętrznymi lub sprzętem treningowym,
- rozbudowane role użytkowników i funkcje społecznościowe.

## Doświadczenie, możliwości czasowe i zakładany termin

Autor ma ponad 20 lat doświadczenia programistycznego. Od około roku codziennie korzysta z GitHub Copilot w VS Code przy implementowaniu pojedynczych funkcjonalności w istniejącym kodzie, dodawaniu testów, rozwiązywaniu problemów i naprawianiu błędów.

Główny cel edukacyjny projektu to nauczenie się pracy z agentami LLM, w której modele wykonują całość implementacji, a autor definiuje zadania, weryfikuje rezultaty, uruchamia testy i kieruje poprawkami bez ręcznego pisania kodu.

Planowana dostępność: 10–15 godzin tygodniowo.

Preferowany termin zgłoszenia: 4 listopada 2026. Termin zapasowy: 6 grudnia 2026.

## Otwarte pytania i tematy do uzupełnienia

- Czy losowy start ma być losowany z przedziału minimalnego i maksymalnego, czy z innego modelu?
- Czy losowanie dotyczy każdego powtórzenia, czy tylko początku całego ćwiczenia?
- Jakie sygnały są potrzebne: dźwiękowe, wizualne, wibracje, czy ich kombinacja?
- Jak aplikacja ma zachować się po zatrzymaniu, anulowaniu, odświeżeniu strony lub przejściu karty w tło?
- Czy ekran powinien zapobiegać wygaszeniu urządzenia podczas aktywnego ćwiczenia?
- Jaka dokładność odmierzania czasu jest wystarczająca dla użytkownika?
- Czy konfiguracja może mieć wiele różnych bloków/faz, czy MVP ogranicza się do jednego stałego schematu?
- Jakie zasady walidacji zakresów czasu, liczby powtórzeń i losowego opóźnienia są potrzebne?
- Jaki mechanizm wdrożenia i przechowywania danych będzie odpowiedni dla wersji demonstracyjnej?
- Jakie dokumenty kontekstowe i dowody procesu pracy agentów powinny zostać przygotowane?

## Kryteria sukcesu

- Użytkownik może utworzyć konto i bezpiecznie korzystać ze swoich konfiguracji.
- Użytkownik może utworzyć, odczytać, zmienić i usunąć konfigurację timera.
- Uruchomiony drill przechodzi przez fazy i powtórzenia w poprawnej kolejności.
- Losowy sygnał rozpoczęcia pojawia się w ustalonym przez użytkownika zakresie i nie jest przewidywalny z poziomu interfejsu.
- Użytkownik otrzymuje jednoznaczny sygnał rozpoczęcia ćwiczenia oraz zmiany faz.
- Timer działa poprawnie na typowym telefonie i w aktualnej przeglądarce desktopowej.
- Kluczowy przepływ użytkownika jest pokryty testem automatycznym lub innym powtarzalnym testem akceptacyjnym.
- Projekt można zademonstrować pod działającym adresem, a jego dokumentacja opisuje decyzje, ograniczenia i sposób weryfikacji wyników agentów.
