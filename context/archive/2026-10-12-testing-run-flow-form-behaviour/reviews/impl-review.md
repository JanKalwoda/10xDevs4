<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 2 — przebieg, sygnały i formularz

- **Plan**: context/changes/testing-run-flow-form-behaviour/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-12
- **Verdict**: NEEDS ATTENTION (przed poprawkami) → poprawki F1–F5 zastosowane w commicie `fix(testing-run-flow-form-behaviour)`
- **Findings**: 0 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Bramki (przed i po poprawkach): `npm test` 306/306, `npm run lint` czysty, `npx astro check` 0 błędów, testy reguł ESLint 6/6, `astro build` kompletny (do katalogu tymczasowego, bo `dist/client` blokował inny proces: EPERM). Kod produkcyjny, `package.json` i `stryker.config.json` bez zmian; brak importów `STEPPER_LIMITS`/`MAX_*`/`CUE_*`/`nextDrillPhase` jako wyroczni; żadne losowanie nie zwraca 1.

## Findings

### F1 — Wznowienie Rest/Preparation nie dowodzi pozostałego czasu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/drill-run-flow.test.ts (przypadki pauzy w Rest i Preparation)
- **Detail**: Plan (faza 2): „po wznowieniu Rest z 0:01”. Test sprawdzał czas tylko w pauzie i kolejność faz; wznowienie od pełnego czasu dawało tę samą sekwencję i przechodziło.
- **Fix**: Pole `afterResume` w tabeli przypadków: faza i sekcja główna zaraz po wznowieniu, ta sama faza 0,25 s przed upływem czasu, następna faza po jego upływie (FR-006).
- **Decision**: FIXED

### F2 — Przypadki pauzy w ćwiczeniu nie dowodzą pełnego czasu po wznowieniu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-run-flow.test.ts (przypadek „Preparation 0 s … resumes straight into the full Exercise”)
- **Detail**: `drive()` scala kolejne równe klucze, więc `exercise#2 → exercise#2` zlewa się w jeden wpis; wznowienie z pozostałymi 2 s zamiast pełnych 3 s przechodziło.
- **Fix**: `afterResume` także dla pauzy w ćwiczeniu (przygotowanie 0: `Exercise · 0:03` przez 3 s; przygotowanie 2 s: pełne `0:02` przygotowania). Kontrola: mutacje `paused.remaining` w gałęziach `resume()` dają czerwony test.
- **Decision**: FIXED

### F3 — Przepisany test kombinacji stracił sprawdzenie Next i kolejności

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/drill-phase-sections.test.ts (test „every combination follows the PRD invariants…”)
- **Detail**: Po usunięciu lustra test liczył tylko rodzaje faz; „Standby przed każdym ćwiczeniem” z planu i podgląd Next (FR-013) dla 4 z 8 kształtów konfiguracji nie były sprawdzane.
- **Fix**: Wyrocznia kolejności z US-01 zbudowana w teście (`prdSequence`) niezależnie od kodu; asercja pełnej sekwencji i `next` każdej fazy = następny element sekwencji PRD, dla wszystkich 16 kombinacji.
  - Strength: przywraca pokrycie Next bez lustra (`nextDrillPhase`).
  - Tradeoff: liczniki stały się nadmiarowe (zostawione).
  - Confidence: HIGH — wyrocznia to reguła US-01.
  - Blind spot: None significant.
- **Decision**: FIXED

### F4 — Tolerancja 0,2 s dla momentów w świecie fałszywek

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-run-signals.test.ts (asercje `near(sounds[0].start, …, 0.2)`)
- **Detail**: Fałszywy zegar i kontekst mają wspólną dokładną oś, więc błąd logiki do 0,2 s (np. przesunięcie o długość dźwięku Standby) przechodził. Budżet NFR dotyczy realnego wyjścia.
- **Fix**: Tolerancja 0,001 s i komentarz wyroczni; słaba asercja `sounds.length >= 2` zastąpiona `checkRepetition` (ton, długość, Rest po czasie ćwiczenia).
- **Decision**: FIXED

### F5 — Wybór „wznowionego” dźwięku przez `.at(-1)`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-run.test.ts (testy wznowienia z ukrytej karty)
- **Detail**: Ostatni zaplanowany `standby-second` jest dźwiękiem wznowionego powtórzenia tylko dopóki lookahead nie sięga dalej.
- **Fix**: Pierwszy dźwięk zaplanowany po wznowieniu (`audio.cues.slice(scheduledBeforeResume)`).
- **Decision**: FIXED

### F6 — Czasy Standby w trybie cichym nie wynikają wprost z PRD

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-run-flow.test.ts (oś czasu z `audio = null`)
- **Detail**: Przy `audio = null` Standby trwa dokładnie wylosowane oczekiwanie. FR-002 mówi tylko, że czas dźwięków nie wlicza się do 1–5 s; o ciszy PRD milczy. Literalne chwile kodują to zachowanie.
- **Fix**: Komentarz wyroczni opisuje wyjątek (bez zmiany oczekiwań); pytanie o regułę do koordynatora/użytkownika.
- **Decision**: ACCEPTED — reguła potwierdzona przez użytkownika 2026-10-12: bez dźwięku Standby trwa dokładnie wylosowany czas; dopisana do PRD FR-002, oczekiwania testów bez zmian

### F7 — „Drill complete” to tekst UI, nie literał PRD

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/drill-run-flow.test.ts (komentarz nagłówka)
- **Detail**: Komentarz twierdził, że każde oczekiwanie jest literałem PRD.
- **Fix**: Komentarz wymienia wyjątek.
- **Decision**: FIXED

### F8 — Drobne: zaokrąglenie odliczania, 0.999 przy krawędzi kubełka, cichy `scriptedRandom` w sygnałach, „strzałki aktywne” dla błędnej wartości

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-run-flow.test.ts, src/lib/drill-run-signals.test.ts, src/lib/drill-stepper-contract.test.ts
- **Detail**: Zaokrąglenie świadomie poza zakresem planu; 0.999 → 5,00 s zgodne z PRD (401 wartości); w sygnałach nadmiarowe losowanie przeszłoby po cichu; aktywność strzałek przy błędnej wartości wywnioskowana z FR-020. Dodatek: test Shift ±10 (EXTRA, nieszkodliwy, granice z PRD).
- **Fix**: Bez zmian.
- **Decision**: SKIPPED
