# UX fixes round 2 — Plan Brief

> Full plan: `context/changes/ux-fixes-round-2/plan.md`

## What & Why

S-21 zbiera poprawki po testach ręcznych S-16–S-19 (zły link na `/create`, tooltip z pustą połową, hover wyłączonej ikony odsłuchu), zmienia okienko Current w widoku biegu tak, by wyglądało jak Next (zmiana FR-018), i dodaje strzałki ▼/▲ do pól Preparation, Exercise, Rest i Repetitions w formularzu timera (nowe FR-020).

## Starting Point

Formularz `DrillConfigForm` ma wiersze `Input` + ikona głośnika (44 px); Current to nagłówek z osobną linią czasu bez obramowania, Next to pudełko z etykietą; tooltip używa `text-balance`; wyłączona ikona zmienia kolor przez wariant `outline`.

## Desired End State

Link „Back to timers" → `/timers`; tooltip dopasowany do tekstu; wyłączona ikona bez zmiany koloru przy hoverze; Current i Next to identyczne pudełka „Etykieta / Nazwa · czas" (Standby bez czasu); stepper w czterech polach: na dotyku `▼ ▲` obok siebie po 44 px przed ikoną głośnika, na komputerze kolumna `▲` nad `▼` 2 × 22 px bez powiększania wiersza 44 px; przytrzymanie powtarza, ↑/↓ i Shift działają w polu, granice wyłączają strzałki.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Układy steppera | Duży przy `any-pointer-coarse:`, kompaktowy domyślnie (Tailwind 4.3) | Hybrydy z dotykiem dostają cele 44 px, bez `@custom-variant` | Review planu |
| Wysokość na komputerze | `h-5.5` × 2 = 44 px | Równa wysokości ikony głośnika, wiersze Exercise/Rest nie rosną | Plan |
| WCAG 2.5.8 na komputerze | Wyjątek „Equivalent" (pole tekstowe i ↑/↓) | Cel 22 px nie spełnia 24 px; ta sama funkcja jest dostępna większym celem | Plan (do potwierdzenia) |
| Krok z myszy/dotyku | Na `pointerdown` + `touch-none` + `setPointerCapture`; `click` stepuje tylko bez flagi `handledByPointer` | Brak kroków od przewijania, działa z AT | Review planu |
| Tabulator | Strzałki `tabIndex={-1}`; ↑/↓ w polu; `role="status"` z ostatnią wartością | Brak 8 przystanków, czytnik słyszy zmianę | Review planu |
| Wysokość wierszy na komputerze | Wszystkie cztery 44 px | Decyzja użytkownika | Użytkownik |
| Granica zakresu | `aria-disabled`, nie `disabled` | Zachowuje fokus przy przytrzymaniu, jak w odsłuchu | Plan |
| Pusta/błędna wartość | Pierwsze naciśnięcie daje minimum pola (oba kierunki); poprawna poza zakresem zaciska się | Jednoznaczny wynik w formacie `m:ss` | Plan (do potwierdzenia) |
| Powtarzanie | 400 ms pauzy, potem co 100 ms, bez przyspieszania | Zgodnie z wymaganiem, prosto testowalne | Plan |
| Current w Standby | Sama nazwa, bez czasu | Tajność długości losowego oczekiwania | Użytkownik |
| Logika | Czyste moduły w `src/lib` z testami + hook | `npm test` obejmuje tylko `src/lib` | Plan |

## Scope

**In scope:** poprawki A3.7, A5.3, A5.9; Current jak Next; stepper z klawiaturą i przytrzymaniem; fixtures, skrypt Playwright, dokumentacja (AGENTS.md, PRD FR-018/FR-020, roadmapa).

**Out of scope:** API/baza, walidacja, przyspieszane powtarzanie, `type="number"`, steppery w widoku biegu, archiwizacja i testy ręczne poza opisem PR.

## Architecture / Approach

Czysty `drill-stepper.ts` (następna wartość, granice) i `drill-step-repeat.ts` (opóźnienie/interwał z wstrzykiwanymi timerami) w `src/lib`; hook `useStepRepeat`; komponent `ConfigStepper` wpinany w `ConfigField` między `Input` a ikoną głośnika; klawisze ↑/↓ w `Input`. Current i Next współdzielą pudełko w `PhaseSections.tsx` i `currentPhaseBody` w modelu.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Poprawki A3.7, A5.3, A5.9 | Trzy poprawki, asercja w smoke, szkielet skryptu | Specyficzność klas hovera |
| 2. Current jak Next | Model, komponent, FR-018, fixtures | Tajność Standby, stałe wysokości |
| 3. Logika steppera | Moduły + testy + hook | Granice i formaty `m:ss` |
| 4. Stepper w formularzu | Przyciski w dwóch układach, klawiatura | Wysokość wiersza, podwójny krok, overflow 390 px |
| 5. Fixtures i bramka | 7 stanów × motywy × szerokości × układy, dokumentacja | Regresja starych skryptów |

**Prerequisites:** S-17, S-18, S-19 zmergowane (są na `main`).
**Estimated effort:** ~5 sesji (5 faz).

## Open Risks & Assumptions

- Cel 22 px na komputerze nie spełnia WCAG 2.5.8 bez wyjątku „Equivalent".
- Wiersze Preparation i Repetitions rosną z 36 do 44 px.
- Urządzenia hybrydowe (dotyk + mysz) dostają układ duży (`any-pointer-coarse`).
- `touch-none` uniemożliwia rozpoczęcie przewijania palcem na samym przycisku.

## Success Criteria (Summary)

- Poprawki widoczne w zrzutach i smoke; Current identyczne z Next, Standby bez czasu.
- Stepper działa myszą, dotykiem i klawiaturą w obu układach bez overflow i skoków wysokości.
- Pełna bramka (lint, testy, typy, build, skrypt wizualny) zielona.
