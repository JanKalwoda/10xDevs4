<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Test rollout Phase 2 — przebieg, sygnały i formularz

- **Plan**: context/changes/testing-run-flow-form-behaviour/plan.md
- **Mode**: Deep (najryzykowniejsze twierdzenia sprawdzone lokalnie, bez sub-agenta: wszystkie były zlokalizowanymi faktami)
- **Date**: 2026-10-12
- **Verdict**: SOUND (po poprawkach; przed nimi REVISE)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING → PASS po poprawkach |

## Grounding

5/5 paths ✓ (`drill-run.test.ts`, `drill-phase-sections.test.ts`, `drill-stepper.ts`, `tests/integration/api-validation.test.mjs`, `test-plan.md`), 6/6 symbols ✓ (`stepFieldValue`, `canStep`, `parseDrillTime`, `createDrillAudio`, `DrillRun.resumeWithAudio`, `buildPhaseSections`), brief↔plan ✓. Sprawdzone też: `createDrillAudio` czyści timeout (`drill-audio.ts:80-82`), `cancel` zatrzymuje źródła przez `stop()` bez argumentu (`drill-audio.ts:89-97`), krok strzałki jest obcinany do granic (`drill-stepper.ts:41-46`).

## Findings

### F1 — Kontrola regresji fazy 1 nie dałaby czerwonego testu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 — Manual Verification
- **Detail**: Plan proponował „zwrócenie czasu Standby w `display`”. `buildPhaseSections` w Standby nie czyta `remainingSeconds` (sekcja główna to `{kind:"standby"}`, `phaseTime` = null; `drill-phase-sections.ts:53`), więc mutacja przeżyłaby i kontrola nie mogłaby przejść.
- **Fix**: Mutacja gałęzi `standby` sekcji głównej w `drill-phase-sections.ts:53`; dopisana uwaga, dlaczego `display` nie jest dobrą kontrolą.
- **Decision**: FIXED

### F2 — Otwarta decyzja „zastąp albo usuń” test lustrzany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 — Changes Required #2
- **Detail**: Plan zostawiał wdrażającemu wybór. Test `drill-phase-sections.test.ts:103` przegląda 16 kombinacji konfiguracji, których nowy plik nie powtarza, więc usunięcie całego testu traci pokrycie.
- **Fix**: Zostaje przegląd kombinacji z niezmiennikami z PRD, usunięta tylko asercja równości z `nextDrillPhase`, nowa nazwa testu.
- **Decision**: FIXED

### F3 — Mutacja oczekiwania Standby w fazie 3 wskazywała niedostępną zmienną i tylko jedno miejsce

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 3 — Manual Verification
- **Detail**: `firstSound` nie jest widoczne w `drill-run.ts:273`, a koniec drugiego dźwięku jest ustawiany w dwóch miejscach: `rebuild` (`:271`) i `appendLookahead` (`:320`). Test obejmujący tylko pierwsze powtórzenie przepuściłby mutację w lookahead.
- **Fix**: Dwie osobne mutacje (`:271`, `:320`) i wymóg przypadków Standby pierwszego i kolejnego powtórzenia.
- **Decision**: FIXED

### F4 — Kryterium „diff dotyka tylko §3, §6.3, §6.6” nie jest poleceniem pass/fail

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 5 — Automated Verification 5.5
- **Detail**: `git diff context/foundation/test-plan.md` wymaga odczytu przez agenta; nie zwraca kodu błędu.
- **Fix**: Bez zmiany; wdrażający raportuje nagłówki sekcji z hunków diffu.
- **Decision**: ACCEPTED
