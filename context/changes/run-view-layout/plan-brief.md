# Run view layout — Plan Brief

> Full plan: `context/changes/run-view-layout/plan.md`

## What & Why

W widoku biegu czas ma być u góry, tuż pod nim „Repetition X of N", a okienka Current i Next mają być czytelniejsze (FR-013, FR-018). Dziś stały slot ostrzeżeń spycha czas w dół, a powtórzenie siedzi w okienku Current.

## Starting Point

`buildPhaseSections` zwraca `main`, `current` (nazwa, czas, `detail` z powtórzeniem) i `next` (sklejony tekst „Next: Rest — 0:02"). `PhaseSections.tsx` renderuje je w tej kolejności, a `DrillTimerView.tsx` dokłada nad nimi slot `min-h-20` na ostrzeżenia.

## Desired End State

Kolejność: czas (lub „Standby") → „Repetition X of N" (także w Preparation i Standby) → Current (nazwa, pod nią czas) → Next (większy napis „Next", pod nim nazwa i czas) → pasek Cancel/Restart/Pause → status → ostrzeżenia. Przyciski paska nie zmieniają położenia.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Powtórzenie w Preparation | `display.next.repetition` | `DrillDisplay` już je niesie, także po wznowieniu. | Plan |
| Ostrzeżenia | Pod wierszem statusu, slot o stałej wysokości | Czas idzie w górę, a pojawienie się ostrzeżenia nic nie przesuwa. | Plan |
| Treść Next | Linia „Nazwa · czas", „Standby" bez czasu, „Drill complete" | Zgodne z FR-018 i z tajnością Standby. | Plan |
| Zakres faz | 3 fazy: model + komponent, ostrzeżenia, fixtures/zrzuty/docs | Każda faza jest type-safe i ma własny commit. | Plan |

## Scope

**In scope:** model sekcji, `PhaseSections`, `DrillTimerView`, testy, fixtures, zrzuty, jedno zdanie reguły w AGENTS.md.

**Out of scope:** `DrillRun`, kontrolki paska, kolory faz (S-05), overflow 414 px w `TimerUiPreview`.

## Architecture / Approach

Czyste wyprowadzenie z wartości faz (bez dostępu do długości Standby), komponent tylko prezentuje. Bez nowych tokenów i komponentów.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Model i PhaseSections | Nowy kształt danych, kolejność i okienka | Wyciek długości Standby (pilnuje test różnicowy) |
| 2. Slot ostrzeżeń | Czas wyżej, przyciski bez skoków | Przesunięcie paska |
| 3. Fixtures, zrzuty, docs | Bramka wizualna 1280/390 light/dark | Overflow przy 390 px |

**Prerequisites:** S-04 (scalone). **Estimated effort:** ~3 sesje, 3 fazy.

## Open Risks & Assumptions

- Układ linii w Next („Nazwa · czas" w jednej linii) to założenie wymagające potwierdzenia.
- Znany overflow 414 px przy 390 w `TimerUiPreview` nie jest naprawiany.

## Success Criteria (Summary)

- Czas na górze, powtórzenie pod nim w każdej fazie, w tym Preparation i Standby.
- Przyciski paska w stałym miejscu z ostrzeżeniami i bez.
- Wszystkie bramki zielone, zrzuty w folderze zmiany.
