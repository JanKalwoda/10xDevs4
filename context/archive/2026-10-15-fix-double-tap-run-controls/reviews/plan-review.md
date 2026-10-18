<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Double click or tap on run controls

- **Plan**: context/changes/fix-double-tap-run-controls/plan.md
- **Mode**: Deep
- **Date**: 2026-10-18
- **Verdict**: REVISE → SOUND after triage (all 5 findings fixed in plan)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

8/8 paths ✓, 4/4 symbols ✓ (`browserDrillClock`, `identityState`, `expectTarget` z `trial`, zdanie o Restart w CLAUDE.md i AGENTS.md), brief↔plan ✓, Progress↔fazy 14/14 ✓

## Findings

### F1 — Jednokierunkowe dispose() wyłącza blokadę po StrictMode/Fast Refresh

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 (kontrakt `dispose`) + Phase 2 (`DrillApp`)
- **Detail**: Blokada powstaje raz w `useState`, a `dispose()` jest wywoływane w cleanupie efektu. Według kontraktu po `dispose()` „późniejsze `tryActivate()` zwraca `true` bez planowania wybudzenia”, więc blokada już nigdy nie blokuje. Cleanup uruchamia się też przy StrictMode i Fast Refresh na tej samej instancji (`src/components/hooks/useStepRepeat.ts:45`), więc w dev ochrona po cichu znika. E2E działa na produkcyjnym preview i tego nie wykryje.
- **Fix**: Zamienić `dispose()` na `reset()`, które czyści wybudzenie i stan blokady, ale zostawia ją używalną, zgodnie z testem „stop on cleanup keeps the repeater usable when the effect runs again on the same instance” (`src/lib/drill-step-repeat.test.ts`). Test: po `reset()` kolejne `tryActivate()` znowu blokuje i planuje wybudzenie.
    - Strength: Zgodne z istniejącym wzorcem repo; brak martwego stanu w dev.
    - Tradeoff: Subskrybenci muszą przeżyć `reset` (odpina ich `unsubscribe` z efektu w `DrillTimer`, nie `reset`).
    - Confidence: HIGH — repo już raz rozwiązało ten sam problem w `useStepRepeat`.
    - Blind spot: Nie sprawdzono, czy Astro React włącza StrictMode; Fast Refresh wystarcza jako przyczyna.
- **Decision**: FIXED (Fix in plan)

### F2 — Start nie otwiera nowego okna, gdy blokada jeszcze trwa

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 (`DrillApp.start`) vs Desired End State
- **Detail**: Desired End State obiecuje 500 ms po każdej aktywacji Start, a plan każe Startowi wywołać `tryActivate()`, które w trwającym oknie zwraca `false` i niczego nie zmienia. Pause (t=0) → Cancel (t=0.1) → Start (t=0.3) odblokuje pasek nowego biegu po 0.2 s.
- **Fix**: Dodać do kontraktu `arm()`, które zawsze (ponownie) otwiera okno od teraz. Start używa `arm()`, pasek `tryActivate()`. Test jednostkowy: `arm()` w trwającym oknie przesuwa koniec okna.
- **Decision**: FIXED (Fix in plan)

### F3 — Żaden test nie wykryje przypadkowo zablokowanego Cancel

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — testy e2e
- **Detail**: „Cancel nigdy nie jest blokowany” sprawdza tylko ręczne 2.5. Gdyby Cancel dostał `aria-disabled`, `locator.click()` by poczekał i wszystkie testy dalej by przeszły.
- **Fix**: W `key-screen-single-action.spec.ts` zaraz po Pause sprawdzić `expect(cancel).not.toHaveAttribute("aria-disabled", "true")` i od razu kliknąć Cancel (asercja deterministyczna, bo Cancel nigdy nie ma tego atrybutu).
- **Decision**: FIXED (Fix in plan)

### F4 — Nieokreślone źródło snapshotu dla widoku

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 (`isLocked`) + Critical Implementation Details
- **Detail**: `isLocked()` liczy się z czasu (`now - activatedAt < 0.5`), a widok dowiaduje się o odblokowaniu z wybudzenia. Przy dławionych timerach w ukrytej karcie snapshot `useSyncExternalStore` zmienia się bez powiadomienia: przycisk wygląda na zablokowany, a handler już przyjmuje akcję.
- **Fix**: Jedno źródło prawdy: flaga `locked` zapalana w `tryActivate`/`arm` i gaszona w wybudzeniu; `isLocked()` i `tryActivate()` czytają tę flagę. Test graniczny 0.499/0.5 s przechodzi na wybudzenie fałszywego zegara.
- **Decision**: FIXED (Fix in plan)

### F5 — Brak regresji istniejących bramek wizualnych

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Manual Verification
- **Detail**: CLAUDE.md: „preserve the seven-state light/dark visual gate”. Bramka `ux-fixes-round-3` klika pasek w produkcyjnym widoku biegu przy 390 px, a faza 3 dodaje tylko nowe zrzuty.
- **Fix**: Dodać kryterium ręczne: ponownie uruchomić `run-view-visual-gate.mjs` i `ux-fixes-round-3-visual-gate.mjs` jako regresję.
- **Decision**: FIXED (Fix in plan)
