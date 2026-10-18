<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Key-screen layout and tap-target check (test-plan Phase 4)

- **Plan**: context/changes/testing-key-screen-layout/plan.md
- **Mode**: Deep
- **Date**: 2026-10-15
- **Verdict**: REVISE (after fixes: SOUND)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | PASS    |

## Grounding

Grounding: 8/8 paths ✓ (playwright.config.ts, support/{hydration,run-view,audio-spy}.ts, DrillApp.tsx, DrillTimer.tsx, DrillConfigForm.tsx, S-22 gate script), 6/6 symbols ✓ (waitForHydration, parseRunView, installAudioSpy, readAudioContexts, MAX_DRILL_NAME_LENGTH = 200, README.md:67 pre-push), brief↔plan ✓, Progress↔Phase ✓ (6/5/5 items).

## Findings

### F1 — Dwa kolejne `tap()` to nie podwójne dotknięcie

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 2 §1 Contract
- **Detail**: Drugi `locator.tap()` ponownie rozwiązuje lokator i czeka na actionability. Po pierwszym dotknięciu `Pause drill` zmienia nazwę na `Resume drill` (ten sam slot), a Start odmontowuje się — drugi `tap()` kończy się timeoutem. Przy `test.fail()` timeout liczy się jako expected failure, więc test „przechodzi” z niewłaściwego powodu i nie mierzy podwójnego dotknięcia.
- **Fix**: Coarse: `boundingBox()` przed akcją, potem dwa `page.touchscreen.tap(x, y)` w tym samym punkcie; fine: `locator.dblclick()`; po podwójnej akcji tylko asercje.
- **Decision**: FIXED (Fix in plan)

### F2 — Brak punktu ustalenia dla asercji „dokładnie jedna akcja”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 Contract (obserwacje, `expect.poll`)
- **Detail**: `expect.poll` i `toBeVisible` kończą się na pierwszym dopasowaniu; bez zdefiniowanego momentu, w którym druga akcja byłaby już widoczna, licznik = 1 może być odczytany przed drugim żądaniem/biegiem. Plan nie mówi, kiedy czytać liczniki.
- **Fix**: Punkt ustalenia per kontrolka: żądania — po `waitForURL` celu i `waitForHydration`; konteksty audio — jednorazowo po widoku „Repetition 1 of N”; Pause/Resume — jedna asercja stanu końcowego (CDP dostarcza zdarzenia sekwencyjnie, React 19 opróżnia dyskretne aktualizacje synchronicznie).
    - Strength: Deterministyczny odczyt bez `waitForTimeout`.
    - Tradeoff: Dla Restart/Start opiera się na synchronicznym tworzeniu `AudioContext` w geście (udokumentowane w `audio-spy.ts`).
    - Confidence: HIGH — nawigacja następuje po obu kliknięciach, które Playwright wysyła przed asercją.
    - Blind spot: Nie zweryfikowano w przeglądarce czasu nawigacji `location.replace` przy dotyku.
- **Decision**: FIXED (Fix in plan)

### F3 — Lista winowajców od `innerWidth` zamiast `clientWidth`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §2 `expectNoHorizontalScroll`
- **Detail**: Plan deklaruje przeniesienie z S-22, ale S-22 (`ux-fixes-round-3-visual-gate.mjs:451`) używa `document.documentElement.clientWidth`. Meta viewport (`src/layouts/Layout.astro:22`) to `width=device-width` bez `initial-scale`; przy `isMobile` Chromium może pomniejszyć stronę z overflow, `innerWidth` > 390 i lista winowajców wyjdzie pusta — dokładnie wtedy, gdy jest potrzebna (kryterium 1.5).
- **Fix**: Predykat `rect.right > document.documentElement.clientWidth + 0.5`.
- **Decision**: FIXED (Fix in plan)

### F4 — Stan Preparation wyścigowy, źródło biegu nieokreślone

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 Contract (bieg krótki)
- **Detail**: Preparation `0:01` trwa krócej niż pomiar trzech kontrolek (scroll, viewport, `trial`) — test może mierzyć Exercise zamiast Preparation albo być niestabilny. Plan nie mówi też, skąd startuje bieg; najgorszy przypadek nagłówka (długa nazwa, `SAVED_DRILL_HEADING_CLASS`) jest tylko w biegu z `/{id}`.
- **Fix**: Biegi z `/{id}`; Preparation na timerze granicznym (preparation `10:00`), Exercise i pauza na osobnym krótkim timerze z długą nazwą.
- **Decision**: FIXED (Fix in plan)

### F5 — `trial` nie wykryje przykrycia przez sticky top bar

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details (Sticky top bar); plan-brief „Key risk” fazy 1
- **Detail**: Playwright przy przykrytym celu ponawia przewinięcie z wyrównaniem `end`/`center`/`start`, więc `trial` dowodzi trafialności przy jakimś położeniu przewinięcia. Fałszywie czerwony wynik od sticky bara jest mało prawdopodobny, a wykrywane są tylko trwałe przykrycia.
- **Fix**: Opisać granicę w Critical Implementation Details i w nagłówku `support/layout.ts`.
- **Decision**: FIXED (Fix in plan)
