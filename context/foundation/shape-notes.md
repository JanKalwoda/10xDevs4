---
project: "DryFire Drill Timer"
context_type: greenfield
created: 2026-09-16
updated: 2026-09-16
checkpoint:
  current_phase: 3
  phases_completed: [1, 2]
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

## Access Control

Timer jest dostępny bez logowania, bez możliwości zapisywania konfiguracji na koncie. Konto jest potrzebne do zapisywania własnych konfiguracji.

Logowanie odbywa się przez magic link — jednorazowy link wysyłany na adres email użytkownika. Pierwsze poprawne użycie linku dla nowego adresu tworzy konto, a kolejne loguje do istniejącego konta. Nie ma osobnego formularza rejestracji.

Jeden rodzaj konta. Każdy zalogowany użytkownik zarządza wyłącznie własnymi konfiguracjami. MVP nie obejmuje administratorów ani udostępniania konfiguracji.

## Open Questions

1. Jaki dopuszczalny błąd czasu emisji sygnału jest akceptowalny? Właściciel: użytkownik. Losowanie wartości co 0,01 s jest potwierdzone, lecz nie oznacza wymaganej dokładności sygnału 0,01 s. Do ustalenia w fazie wymagań jakościowych.

## Session status

Fazy 1 (wizja i problem) oraz 2 (persona i kontrola dostępu) zostały ukończone. Faza 3 (dyscyplina MVP) jest w toku. Pozostałe decyzje oraz pytania z `idea-notes.md` będą rozpatrywane w odpowiednich fazach.
