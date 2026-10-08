<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run view layout (S-18)

- **Plan**: context/changes/run-view-layout/plan.md
- **Mode**: Deep
- **Date**: 2026-10-09
- **Verdict**: REVISE (drobne, celowane poprawki; nic nie wymaga zmiany architektury)
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓, 7/7 symbols ✓, brief↔plan ✓, Progress↔Phase ✓.

Zweryfikowane twierdzenia:

1. `display.next.repetition` w Preparation: `nextDrillPhase` zwraca z Preparation `exercise` albo `standby` z `repetition: 1` (`drill-timer.ts:89-92`). Testy wznowienia w `drill-phase-sections.test.ts` potwierdzają numer wznowionego powtórzenia. Preparation zawsze ma `next` ≠ null.
2. Tajność Standby: model czerpie wyłącznie z wartości faz. `repetition` Standby to numer, nie długość.
3. `role="timer"` jest tylko na liczbie (`PhaseSections.tsx:16`).
4. Konsumenci modelu to `PhaseSections.tsx`, `DrillTimerView.tsx` i test. Plan pokrywa wszystkich. `nextPhaseText` jest używany tylko w komponencie i w teście.
5. Pasek (grid 3 kolumn, `size-12`) w `DrillTimerView.tsx:48-82` pozostaje nietknięty.

## Decyzje koordynatora

- (a) Ostrzeżenia pod wierszem statusu w stałym slocie: **akceptowalne**. Czas idzie w górę i nic nad paskiem się nie zmienia. Koszt to stałe ~80 px pustki pod paskiem (F3).
- (b) Next: „Next" większe + jedna linia „Nazwa · czas": **zgodne** z FR-018 i ux-fixes-plan. Bez zastrzeżeń.
- (c) Overflow `TimerUiPreview` poza zakresem: **akceptowalne**, pod warunkiem że skrypt wizualny mierzy overflow tylko w sekcjach `DrillTimerView` (F5). Inaczej znany overflow 414 px wywróci 3.2.

## Findings

### F1 — Wysokość okienka Current zmienia się przy Standby, więc przyciski paska skaczą

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 §2 (`PhaseSections.tsx`), Desired End State („Przyciski paska nie zmieniają położenia")
- **Detail**: Plan każe renderować czas Current „w osobnej linii", a `current.time` jest `null` dla Standby. Linia znika, więc okienko Current (a z nim Next i pasek Cancel/Restart/Pause) przesuwa się o wysokość linii przy każdym wejściu w Standby i wyjściu z niego, w trakcie biegu. Plan pilnuje tylko ostrzeżeń, pauzy i wznowienia. Analogicznie `repetition: null` (kontrakt to dopuszcza) usunęłoby linię powtórzenia. W praktyce nie występuje, ale element powinien mieć zarezerwowaną wysokość.
- **Fix**: Zawsze renderować linię czasu Current (dla `null` pusty placeholder o tej samej wysokości, np. `min-h-6`, `aria-hidden`) i dać `<p>` powtórzenia stałą wysokość. W 3.2 mierzyć `top` przycisków względem góry sekcji we wszystkich fixtures (Standby, Preparation, Rest, complete, paused, loading, z ostrzeżeniem), nie tylko parę z/bez ostrzeżenia. Wartość ma być identyczna.
  - Strength: łapie całą klasę skoków, także Standby.
  - Tradeoff: dodatkowa pusta linia w Standby.
  - Confidence: HIGH — wynika wprost z kształtu `CurrentSection.time`.
  - Blind spot: wysokość Next zakłada jednoliniowy tekst; przy 390 px „Exercise · 10:00" powinno się mieścić, ale trzeba to potwierdzić zrzutem.
- **Decision**: FIX — linia czasu Current zawsze renderowana (placeholder `aria-hidden` o stałej wysokości dla Standby), linia powtórzenia o stałej wysokości; skrypt mierzy `top` przycisków względem góry sekcji we wszystkich fixtures.

### F2 — Bramka wizualna węższa niż kontrakt z AGENTS.md; 2.2 niesprawdzalne w Fazie 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 i 3.3; Phase 2 (2.2)
- **Detail**: AGENTS.md wymaga przeglądu: default, hover, focus-visible, disabled, error, empty (lub uzasadnione N/A), loading, w jasnym i ciemnym motywie przy 1280/390. 3.3 wymienia default, loading, paused, disabled i error-warning. Brakuje hover i focus-visible (przyciski paska) oraz uzasadnienia N/A dla empty. Dodatkowo 2.2 (identyczna pozycja przycisków) jest kryterium ręcznym Fazy 2, ale skrypt, który je potwierdza, powstaje dopiero w Fazie 3. „Każda faza zielona osobno" nie zachodzi więc dla 2.2.
- **Fix**: Rozszerzyć 3.3 o hover i focus-visible Cancel/Restart/Pause oraz wpisać N/A dla empty. Przenieść 2.2 do Fazy 3 (albo dać skrypt już w Fazie 2). W Fazie 2 zaktualizować opis scenariusza „audio-unavailable" („Warning shown above the sections"), żeby fixtures nie kłamały po zmianie.
- **Decision**: FIX — bramka wizualna pełna wg AGENTS.md (hover, focus-visible, empty N/A z uzasadnieniem); kryterium 2.2 przeniesione do fazy 3; opis scenariusza audio-unavailable zaktualizowany.

### F3 — Stały slot ostrzeżeń 80 px pod paskiem: martwa przestrzeń i zawijanie

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2
- **Detail**: Slot `min-h-20` rezerwuje ~80 px pod wierszem statusu także bez ostrzeżeń. Dwa ostrzeżenia sklejone („Audio unavailable; running silently. Screen may lock.") mogą przy 390 px zająć 3 linie (>80 px). Nic powyżej się nie przesunie, ale karta urośnie.
- **Fix**: Dodać fixture z oboma ostrzeżeniami naraz przy 390 px. Rozważyć `min-h-16` zamiast `min-h-20`, jeśli zrzut pokaże zbyt dużą pustkę.
- **Decision**: FIX — fixture z dwoma ostrzeżeniami przy 390 px; slot zmniejszony do `min-h-16`, jeśli zrzut pokaże martwą przestrzeń bez skoków.

### F4 — Skrypt Playwright poza repo i niepełne asercje

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §2, 3.2
- **Detail**: Skrypt w scratchpadzie nie jest powtarzalny dla kolejnego agenta ani recenzenta (w repo zostają tylko PNG). Asercje nie obejmują wprost reguły „powtórzenie poza `role="timer"`", a test jednostkowy tego nie złapie.
- **Fix**: Zapisać skrypt w `context/changes/run-view-layout/screenshots/` obok zrzutów. Dodać asercję: `[role=timer]` zawiera wyłącznie liczbę, a „Repetition X of N" jest elementem poza nim. Opcjonalnie sprawdzić obecność „Repetition" w Preparation i Standby.
- **Decision**: FIX — skrypt w `context/changes/run-view-layout/screenshots/`, asercja powtórzenia poza `role=timer`.

### F5 — Pomiar overflow musi być ograniczony do sekcji biegu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 (decyzja c)
- **Detail**: Znany overflow 414 px przy 390 pochodzi z przycisków `TimerUiPreview` poza zakresem. Jeśli skrypt sprawdzi `document.scrollWidth`, 3.2 się wywróci mimo poprawnej zmiany.
- **Fix**: Sprawdzać `scrollWidth <= clientWidth` dla `section[aria-label="Current drill phase"]` w każdej karcie fixtures, nie dla strony.
- **Decision**: FIX — overflow mierzony tylko w `section[aria-label="Current drill phase"]`.

### F6 — Nieaktualne teksty w dokumentacji i drobne niespójności

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §3; PRD US-02
- **Detail**: PRD US-02 nadal cytuje „Next: Rest — 2 s" i „Next: Standby", mimo że FR-018 opisuje już nowy układ. `src/AGENTS.md` to generyczny przewodnik bez sekcji UI, więc reguła układu pasuje do sekcji UI w głównym `AGENTS.md`. Separator „·" zastępuje „—" między nazwą a czasem. To świadoma zmiana, którą warto odnotować w testach `nextPhaseBody`.
- **Fix**: Jedno zdanie w sekcji UI głównego `AGENTS.md` (kolejność sekcji, ostrzeżenia pod paskiem, `role="timer"` tylko na liczbie, stała wysokość linii wrażliwych na Standby, ścieżka zrzutów). `src/AGENTS.md` pominąć albo uzasadnić. Zdania PRD US-02 zostawić koordynatorowi jako uwagę.
- **Decision**: FIX — reguła w głównym `AGENTS.md` (sekcja UI); `src/AGENTS.md` pominięty (generyczny przewodnik); PRD US-02 do koordynatora.
