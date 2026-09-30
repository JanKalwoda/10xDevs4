# Dopracowanie widoku głównego timera — Plan Brief

> Full plan: [plan.md](./plan.md)
> Research: [research.md](./research.md)

## What & Why

Dopracowujemy działający timer pod `/`, aby konfiguracja, ćwiczenie i zakończenie były spójne oraz czytelne na telefonie i komputerze. Audyt wykazał pomijanie tokenów, osobno stylowane kontrolki i Resume, nieczytelne oczekiwanie na audio oraz ostrzeżenie konta nad ćwiczeniem gościa.

## Starting Point

Timer ma działający formularz, fazy, losowy start, audio, automatyczną pauzę i powrót z zachowaniem ustawień. Istnieją neutralne tokeny light/dark, wspólny Button, ESLint i testy silnika; brakuje wspólnych pól, przełącznika motywu i bramki wizualnej. Audyt znalazł 22 wystąpienia klas palety w komponentach timera.

## Desired End State

Spokojny, neutralny widok z formularzem w jednej kolumnie i czytelnym licznikiem. Użytkownik może przełączyć motyw i zachować wybór; bez zapisanej preferencji wygląd odpowiada urządzeniu. Po Start status „Starting timer…” zajmuje miejsce licznika do faktycznego rozpoczęcia przebiegu. Ostrzeżenie Supabase pozostaje na stronach konta.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Kierunek wyglądu | Spokojny, neutralny | Pasuje do istniejących tokenów i pozwala skupić uwagę na ćwiczeniu. | Plan: użytkownik |
| Formularz | Jedna kolumna na telefonie i komputerze | Zachowuje obecny porządek i miejsce na podpowiedzi oraz błędy. | Plan: użytkownik |
| Motyw | Ręczny wybór light/dark, zapis lokalny; domyślnie urządzenie | Łączy wygodny pierwszy start z trwałą preferencją użytkownika. | Plan: użytkownik |
| Ostrzeżenie Supabase | Ukryte na timerze, zachowane na stronach konta | Brak konta nie blokuje ćwiczenia. | Plan: użytkownik |
| Uruchamianie | „Starting timer…” ze wskaźnikiem w miejscu licznika | Wyjaśnia oczekiwanie bez udawanego odliczania. | Plan: użytkownik |
| Kontrakt | Rozszerzenie istniejącego shadcn i tokenów | Unika kolejnej palety i osobno projektowanych kontrolek. | Research / Plan |
| Bramka | Lokalny kitchen sink, dwa motywy, 1280 px i 390 px | Zapewnia dowód stanów bez instalacji runnera screenshotów. | Research / Plan |

## Scope

**In scope:**

- Input, Label, Checkbox, Card i Alert przez shadcn; ponowne użycie Button.
- Tokeny, przełącznik z zapisem preferencji, publiczny punkt wejścia oraz istniejące stany timera.
- Wszystkie C1–C5, macierz siedmiu stanów, zrzuty, lokalna kontrola ESLint i reguła AGENTS.md.

**Out of scope:**

- Trzy sekcje faz, wybór kolorów, nowe sterowanie, odsłuch, zapis konfiguracji i synchronizacja Bluetooth.
- Zmiany silnika, API, danych i uwierzytelniania; rebranding stron konta i nowy runner testowy.

## Architecture / Approach

Obecne komponenty zachowują stan i logikę, a wspólne prymitywy oraz wydzielona prezentacja przebiegu zapewniają spójny wygląd. Tokeny pozostają w global.css. Mały skrypt ustala motyw przed malowaniem, kontrolka go zmienia, a localStorage zapisuje light/dark pod `drill-timer-theme`. Bez poprawnego zapisu preferencja urządzenia pozostaje aktywna, również przy jej zmianie; nie dodajemy opcji resetowania. Podgląd `/dev/timer-ui` używa stabilnych fixture'ów i zwraca 404 poza development.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wspólne komponenty | Minimalne prymitywy i lokalny podgląd | Registry może zmienić zależności lub dostarczyć literały wymagające dostosowania. |
| 2. Tokeny i motyw | Neutralny kontrakt i trwały wybór wyglądu | Błysk niewłaściwego motywu lub rozbieżność hydratacji. |
| 3. Widok timera | Spójne stany i usunięcie C1–C5 | Naruszenie gestu audio, lifecycle lub dostępności formularza. |
| 4. Weryfikacja i utrwalenie | Macierz, zrzuty, guard i review | Zielone CI nie sprawdza wyglądu ani interakcji React. |

**Prerequisites:** Działający S-02, istniejąca gałąź `feature/m2l5`, dostęp do shadcn registry, przeglądarka do zrzutów i lokalny Supabase/Docker do auth smoke.
**Estimated effort:** Orientacyjnie 3–4 sesje wdrożenia i przeglądu; zależy od poprawek po oględzinach.

## Open Risks & Assumptions

- Audio może inicjalizować się długo; zachowujemy moment startu i nie dodajemy timeoutu. Niedostępność lub odrzucenie obietnicy prowadzi do ćwiczenia w ciszy.
- Awaria localStorage nie blokuje timera; wybór działa w bieżącej karcie. Kontrast i pierwszy render wymagają przeglądarki, nie samego skanu kodu.
- Wspólne tokeny mogą wpływać na inne strony; plan wymaga porównania ich prezentacji bez rozszerzania restyle.

## Success Criteria (Summary)

- Wszystkie istniejące działania działają, formularz jest pionowy, a motyw startuje zgodnie z urządzeniem i zachowuje ręczny wybór.
- Uruchamianie, pauza, brak audio i zakończenie są czytelne; Standby nie ujawnia czasu oczekiwania.
- C1–C5 zamknięte, zero literałów w widoku, macierz i zrzuty ocenione; lint, testy, Astro check/build oraz auth smoke przechodzą podczas wdrożenia.
