# Run view layout Implementation Plan

## Overview

S-18 (FR-013, FR-018): w widoku biegu odliczany czas jest u góry, tuż pod nim „Repetition X of N" (także w Preparation i Standby), okienko Current ma nazwę fazy w pierwszej linii i czas w osobnej linii (bez powtórzenia), okienko Next ma wyraźniejszy napis „Next" oraz nazwę i czas następnej fazy w osobnej linii. Slot ostrzeżeń nie może przesuwać czasu w dół ani przycisków paska.

## Current State Analysis

- `src/lib/drill-phase-sections.ts:6-22` — `CurrentSection` ma `{name, time, detail}`, gdzie `detail` = „Preparing" albo „Repetition X of N"; `NextSection` jest sklejany w jeden tekst przez `nextPhaseText` (`:60-63`, „Next: Rest — 0:02").
- `src/components/timer/PhaseSections.tsx` — kolejność: czas (`role="timer"`, `min-h-20 sm:min-h-24`), Current (h2 z nazwą i czasem w jednej linii + `detail`), Next (jedna linia tekstu w `role="group"`).
- `src/components/timer/DrillTimerView.tsx:40-46` — nad `PhaseSections` stały slot `min-h-20` na ostrzeżenia („Audio unavailable…", „Screen may lock."), który spycha czas w dół o 80 px nawet gdy ostrzeżeń nie ma.
- `DrillDisplay` (`src/lib/drill-run.ts:21-28`) ma `next: DrillPhase | null` z numerem powtórzenia; w Preparation (także po wznowieniu) `next` jest fazą docelową z `repetition`, więc numer nadchodzącego powtórzenia jest dostępny bez zmiany `DrillRun` (potwierdzają to testy wznowienia w `drill-phase-sections.test.ts`).
- Tajność Standby: widok jest wyprowadzany wyłącznie z wartości faz (`buildPhaseSections` + test różnicowy 1 s vs 5 s, `drill-phase-sections.test.ts:157-175`).
- Użycia: `DrillTimer.tsx:171`, `TimerUiPreview.tsx:414,1214,1197`, `PhaseSectionsFixtures.tsx` (12 scenariuszy). Wszystko jest w zakresie lintu timer-ui (`eslint.config.js:104`).

## Desired End State

Widok biegu (od góry): czas (lub „Standby") → „Repetition X of N" → okienko Current (nazwa; pod nią czas, jeśli nie Standby) → okienko Next („Next" większym fontem; pod nim „Nazwa · czas", „Standby" bez czasu albo „Drill complete") → pasek Cancel/Restart/Pause → wiersz statusu → ostrzeżenia. Przyciski paska nie zmieniają położenia przy pojawieniu się ostrzeżeń, pauzie ani wznowieniu. Weryfikacja: testy jednostkowe modelu, lint, `astro check`, build oraz zrzuty `/dev/timer-ui` 1280/390 w jasnym i ciemnym motywie.

### Key Discoveries:

- Numer powtórzenia w Preparation = `display.next.repetition` (`drill-run.ts:24`); `DrillDisplay` bez zmian.
- Okienko Next ma `role="group" aria-label="Next phase"` — zachować jako stabilny hook dla dostępności i fixtures.
- `role="timer"` jest na liczbie (`PhaseSections.tsx:15`); powtórzenie musi zostać poza tym elementem.
- Kontrakt kontrolek z AGENTS.md (Cancel/Restart/Pause, `size-12`, stały hitbox) zostaje nietknięty.

## What We're NOT Doing

- Zmian w `DrillRun`, audio, Wake Lock, kontrolkach paska, logice Cancel/Restart.
- Kolorów faz (S-05 odroczony), nowych tokenów, wartości arbitralnych.
- Naprawy znanego overflow 414 px przy 390 w przyciskach `TimerUiPreview` (poza zakresem; zgłoszone w `[Q]`).
- Archiwizacji i listy testów ręcznych (do końca kolejki).

## Implementation Approach

Trzy małe fazy, każda type-safe i z własnym commitem. Faza 1 zmienia model i `PhaseSections` razem (typy muszą zgadzać się w `astro check`). Faza 2 przenosi ostrzeżenia w `DrillTimerView`. Faza 3 aktualizuje fixtures, zrzuty wizualne i dokumentację.

## Phase 1: Model sekcji i układ PhaseSections

### Overview

Nowy kształt danych i nowa kolejność sekcji, z zachowaniem tajności Standby.

### Changes Required:

#### 1. Model sekcji

**File**: `src/lib/drill-phase-sections.ts`

**Intent**: Przenieść numer powtórzenia do osobnego pola nadrzędnego, odchudzić `current` do nazwy i czasu, rozdzielić etykietę i treść okienka Next.

**Contract**: `PhaseSections` zyskuje `repetition: string | null` („Repetition X of N"; w Preparation z `display.next.repetition`; `null`, gdy brak numeru). `CurrentSection = { name; time: string | null }` (bez `detail`). `NextSection` bez zmian kształtu; `nextPhaseText` zastąpić `nextPhaseBody(next)` zwracającym „Rest · 0:02" / „Standby" / „Drill complete" (etykieta „Next" jest stała w komponencie). Dane wyłącznie z wartości faz.

#### 2. Komponent sekcji

**File**: `src/components/timer/PhaseSections.tsx`

**Intent**: Nowa kolejność: czas → powtórzenie → Current → Next, z nazwą/czasem w osobnych liniach i większym „Next".

**Contract**: `role="timer"` zostaje na liczbie; powtórzenie to osobny `<p>` poza nim; Current: nazwa w `h2`, czas w osobnej linii; Next: `role="group" aria-label="Next phase"`, etykieta „Next" (`text-xl font-semibold`), treść poniżej. Tylko tokeny semantyczne i skala Tailwind.

#### 3. Testy modelu

**File**: `src/lib/drill-phase-sections.test.ts`

**Intent**: Dostosować asercje do nowego kształtu i dodać przypadki: powtórzenie w Preparation (start i wznowienie), Standby, brak powtórzenia w `current`, `nextPhaseBody`; zachować test różnicowy 1 s vs 5 s (porównanie całego `PhaseSections` łącznie z `repetition`).

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`

#### Manual Verification:

- Brak (weryfikacja wizualna w fazie 3).

---

## Phase 2: Slot ostrzeżeń bez przesuwania czasu i przycisków

### Overview

Czas jest u góry karty; ostrzeżenia nie spychają go w dół, a przyciski paska nie skaczą.

### Changes Required:

#### 1. Przeniesienie ostrzeżeń

**File**: `src/components/timer/DrillTimerView.tsx`

**Intent**: Usunąć slot `min-h-20` sprzed `PhaseSections` i umieścić ostrzeżenia pod wierszem statusu, w slocie o stałej wysokości (rezerwacja miejsca, więc pojawienie się ostrzeżenia nie przesuwa nic powyżej).

**Contract**: kolejność w `<section aria-label="Current drill phase">`: `PhaseSections` → pasek (grid 3 kolumn, bez zmian) → wiersz statusu (`min-h-10`) → slot ostrzeżeń (`min-h-20`, `Alert` gdy są ostrzeżenia). Teksty ostrzeżeń bez zmian.

### Success Criteria:

#### Automated Verification:

- Lint, typy i build przechodzą: `npm run lint`, `npx astro check`, `npm run build`

#### Manual Verification:

- Pozycja przycisków paska jest identyczna z ostrzeżeniami i bez nich (potwierdzone skryptem Playwright w fazie 3).

---

## Phase 3: Fixtures, bramka wizualna i dokumentacja

### Overview

Production-backed fixtures obejmują nowy układ; zrzuty w folderze zmiany; reguła dla kolejnego agenta.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/PhaseSectionsFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Zachować 12 scenariuszy; dodać scenariusz z ostrzeżeniem Wake Lock/audio pokazujący brak przesunięcia oraz długą nazwę/czas (np. `10:00`) i rep. `10 of 10`. Zaktualizować opisy.

**Contract**: bez nowych komponentów produkcyjnych; fixtures nadal renderują `DrillTimerView`.

#### 2. Skrypt wizualny i zrzuty

**File**: `context/changes/run-view-layout/screenshots/` (+ skrypt Playwright w scratchpadzie, nie w repo)

**Intent**: Zrzuty `/dev/timer-ui` (sekcje fixtures) w light/dark × 1280/390; skrypt sprawdza: brak poziomego overflow w sekcji biegu, równe `top` przycisków paska z ostrzeżeniami i bez nich, kolejność DOM (czas → powtórzenie → Current → Next).

#### 3. Dokumentacja reguły

**File**: `AGENTS.md`, `src/AGENTS.md`

**Intent**: Jedno zdanie o układzie widoku biegu (kolejność sekcji, ostrzeżenia pod paskiem, `role="timer"` tylko na liczbie, tajność Standby) i ścieżka zrzutów.

### Success Criteria:

#### Automated Verification:

- Pełna weryfikacja: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`
- Skrypt Playwright przechodzi (kolejność, brak overflow, stałe położenie przycisków)

#### Manual Verification:

- Przegląd zrzutów w folderze zmiany (jasny/ciemny, 1280/390; default, loading, paused, disabled, error-warning).

---

## Testing Strategy

### Unit Tests:

- Kształt `PhaseSections` dla każdej pary current → next; `repetition` w Preparation (start i wznowienie), Standby, Rest.
- Test różnicowy Standby 1 s vs 5 s na całym modelu; `nextPhaseBody` dla fazy z czasem, Standby i końca.

### Integration Tests:

- Smoke w CI (bez zmian); lokalnie brak Mailpit.

### Manual Testing Steps:

1. Skrypt Playwright na `/dev/timer-ui` (patrz faza 3).

## Performance Considerations

Brak (czysta zmiana układu).

## Migration Notes

Brak migracji ani zmian API.

## References

- `context/foundation/ux-fixes-plan.md` (S-18), `context/foundation/roadmap.md` (S-18), PRD FR-013, FR-018
- `src/lib/drill-run.ts:21`, `src/lib/drill-phase-sections.ts`, `src/components/timer/PhaseSections.tsx`, `src/components/timer/DrillTimerView.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Model sekcji i układ PhaseSections

#### Automated

- [ ] 1.1 Testy jednostkowe przechodzą: `npm test`
- [ ] 1.2 Lint przechodzi: `npm run lint`
- [ ] 1.3 Typy przechodzą: `npx astro check`

### Phase 2: Slot ostrzeżeń bez przesuwania czasu i przycisków

#### Automated

- [ ] 2.1 Lint, typy i build przechodzą: `npm run lint`, `npx astro check`, `npm run build`

#### Manual

- [ ] 2.2 Pozycja przycisków paska jest identyczna z ostrzeżeniami i bez nich

### Phase 3: Fixtures, bramka wizualna i dokumentacja

#### Automated

- [ ] 3.1 Pełna weryfikacja: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`
- [ ] 3.2 Skrypt Playwright przechodzi (kolejność, brak overflow, stałe położenie przycisków)

#### Manual

- [ ] 3.3 Przegląd zrzutów w folderze zmiany (jasny/ciemny, 1280/390; default, loading, paused, disabled, error-warning)
