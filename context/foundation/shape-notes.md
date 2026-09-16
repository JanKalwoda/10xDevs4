---
project: "DryFire Drill Timer"
context_type: greenfield
created: 2026-09-16
updated: 2026-09-16
timeline_budget:
  mvp_weeks: 2
checkpoint:
  current_phase: 4
  phases_completed: [1, 2, 3]
  gray_areas_resolved:
    - topic: "Typ kontekstu projektu"
      decision: "Greenfield — użytkownik potwierdził budowę nowej aplikacji od zera."
    - topic: "Pierwszy użytkownik i obecne rozwiązanie"
      decision: "Autor projektu ćwiczy na sucho z timerem HIIT; brakuje mu losowego startu z zadanego przedziału."
    - topic: "Cel losowego startu"
      decision: "Start ma wymuszać reakcję na sygnał, zamiast pozwalać na przygotowanie reakcji dzięki przewidywalnemu czasowi."
    - topic: "Rozdzielczość losowania a dokładność sygnału"
      decision: "Wartości opóźnienia są losowane co 0,01 s. Sygnał może wystąpić z błędem; tolerancji jeszcze nie określono."
    - topic: "Role i własność konfiguracji"
      decision: "Jeden rodzaj konta; każdy zarządza wyłącznie własnymi konfiguracjami, bez administratorów i udostępniania."
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
  frs_drafted: 0
  quality_check_status: pending
---

## Seed idea

Źródło: `idea-notes.md`. Plik zawiera opis pomysłu dostarczony przez użytkownika i pozostaje niezmieniony.

## Vision & Problem Statement

Autor projektu podczas ćwiczeń strzeleckich na sucho korzysta z timera HIIT, który obsługuje czas przygotowania, ćwiczenia, odpoczynku i liczbę powtórzeń. Brakuje w nim losowego opóźnienia startu z zadanego przedziału. Przewidywalny czas pozwala przygotować reakcję z wyprzedzeniem zamiast reagować na sygnał, co ogranicza przydatność obecnego timera w tym zastosowaniu.

DryFire Drill Timer ma zachować potrzebny przebieg faz i powtórzeń oraz umożliwić nieprzewidywalny start. Użytkownik chce symulować opisany przez siebie scenariusz zawodów IPSC: po potwierdzeniu gotowości i komendzie „standby” sygnał startu pojawia się po losowym opóźnieniu od 1 do 5 sekund. Jest to opis motywacji użytkownika, a nie deklaracja zgodności aplikacji z regulaminem zawodów.

## User & Persona

Pierwszym użytkownikiem jest autor projektu, ćwiczący strzelanie na sucho. Sięga po timer do prowadzenia sekwencji przygotowania, ćwiczenia i odpoczynku przez zadaną liczbę powtórzeń. Potrzebuje reagować na nieprzewidywalny sygnał startu.

## Success Criteria

### Primary

- Użytkownik bez logowania ustawia czasy przygotowania, ćwiczenia i odpoczynku, liczbę powtórzeń oraz opcjonalny przedział losowego startu, a następnie uruchamia pełny przebieg. Timer realizuje jednorazowe przygotowanie i zadaną liczbę cykli: opcjonalne losowe oczekiwanie, ćwiczenie, odpoczynek, włącznie z odpoczynkiem po ostatnim ćwiczeniu.
- Każde powtórzenie otrzymuje osobno losowane opóźnienie z zadanego przedziału co 0,01 s. Podczas oczekiwania widoczny jest tylko napis „Standby”; pozostałe fazy pokazują czas. Początek oczekiwania sygnalizują dwa krótkie dźwięki w innej tonacji niż start ćwiczenia, początek ćwiczenia jeden długi dźwięk, a początek odpoczynku jeden krótki dźwięk.

### Secondary

- Użytkownik może wygodnie skonfigurować i uruchomić timer na telefonie.

### Guardrails

- Konfiguracje konta są dostępne wyłącznie właścicielowi.
- Podczas „Standby” interfejs nie ujawnia pozostałego czasu ani momentu startu ćwiczenia.

## Access Control

Timer jest dostępny bez logowania, bez możliwości zapisywania konfiguracji na koncie. Konto jest potrzebne do zapisywania własnych konfiguracji.

Logowanie odbywa się przez magic link — jednorazowy link wysyłany na adres email użytkownika. Pierwsze poprawne użycie linku dla nowego adresu tworzy konto, a kolejne loguje do istniejącego konta. Nie ma osobnego formularza rejestracji.

Jeden rodzaj konta. Każdy zalogowany użytkownik zarządza wyłącznie własnymi konfiguracjami. MVP nie obejmuje administratorów ani udostępniania konfiguracji.

## Open Questions

1. Jaki dopuszczalny błąd czasu emisji sygnału jest akceptowalny? Właściciel: użytkownik. Losowanie wartości co 0,01 s jest potwierdzone, lecz nie oznacza wymaganej dokładności sygnału 0,01 s. Do ustalenia w fazie wymagań jakościowych.

## MVP flow

1. Użytkownik otwiera aplikację i ustawia czas przygotowania, ćwiczenia, odpoczynku oraz liczbę powtórzeń.
2. Opcjonalnie włącza losowy start i podaje dolną oraz górną granicę opóźnienia. Ustawienia czasu są w pełnych sekundach, np. 0:02, 0:05, 0:10.
3. Użytkownik uruchamia timer. Czas przygotowania jest odliczany raz na początku przebiegu.
4. Jeśli włączono losowy start, przed każdym ćwiczeniem losowane jest nowe opóźnienie co 0,01 s. Dwa krótkie sygnały rozpoczynają oczekiwanie z widocznym wyłącznie napisem „Standby”. Opóźnienie poprzedza czas ćwiczenia i nie skraca go.
5. Jeden długi sygnał rozpoczyna odliczanie pełnego czasu ćwiczenia.
6. Jeden krótki sygnał rozpoczyna odliczanie odpoczynku.
7. Kroki 4–6 powtarzają się zadaną liczbę razy, a przebieg kończy się po ostatnim odpoczynku. Przy wyłączonym losowym starcie krok 4 jest pomijany.

Przykład podany przez użytkownika: 3 powtórzenia, przygotowanie 5 s, ćwiczenie 4 s, losowe opóźnienie 1–5 s, odpoczynek 2 s. Dokładne wylosowane wartości nie są z góry narzucone.

## Timeline budget

Użytkownik zakłada 2 tygodnie na całe MVP przy zaangażowaniu 10–15 godzin tygodniowo.

## Session status

Fazy 1 (wizja i problem), 2 (persona i kontrola dostępu) oraz 3 (dyscyplina MVP) zostały ukończone. Następna faza: 4 (wymagania funkcjonalne i user stories). Pozostałe decyzje oraz pytania z `idea-notes.md` będą rozpatrywane w odpowiednich fazach.
