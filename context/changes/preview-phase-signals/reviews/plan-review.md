<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Preview phase signals

- **Plan**: context/changes/preview-phase-signals/plan.md
- **Mode**: Deep (weryfikacja kodu wykonana bezpośrednio przez recenzenta, bez sub-agenta)
- **Date**: 2026-10-06
- **Verdict**: REVISE
- **Findings**: 0 critical, 6 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (drill-audio.ts, drill-run.ts, drill-audio-initializer.ts, DrillConfigForm, DrillApp, TimerUiPreview, eslint contract, hooks dir), symbols ✓ (CUE_DURATION, STANDBY_SECOND_OFFSET, observeDrillAudioInitialization, FixtureAudio, createDrillAudio), brief↔plan ✓, Progress↔Phase ✓ (1.1–1.2, 2.1–2.3, 3.1–3.2). Zgodność z FR-004: sygnały i parametry zgodne z `DrillRun` (standby: drugi dźwięk w `firstSound.start + STANDBY_SECOND_OFFSET`; exercise/rest: pojedynczy `schedule(kind)`; brak cue dla preparation i rest 0). Kolejność faz (lib → UI → fixtures) poprawna.

## Findings

### F1 — Logika hooka nie jest pokryta przez `npm test`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — hook; kryterium 2.2
- **Detail**: `npm test` = `node --test src/lib/*.test.ts`. Hook w `src/components/hooks/useSignalPreview.ts` (React) nie może być uruchomiony przez ten runner, więc 2.2 jest niespełnialne w obecnej formie, a to najryzykowniejsza logika (gest, cancel, release, late grant).
- **Fix**: Wydzielić czysty kontroler do `src/lib/drill-signal-preview-controller.ts` (wstrzykiwane `createAudio`, zegar, timer), testowany node:test jak `drill-run-identity` / `drill-audio-initializer`; hook tylko cienka warstwa React.
- **Decision**: ACCEPTED

### F2 — Przycisk odsłuchu w `<form>` domyślnie jest `type="submit"`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — SignalPreviewControl / DrillConfigForm
- **Detail**: `src/components/ui/button.tsx` renderuje `<button>` bez domyślnego `type`. W formularzu kliknięcie „Play …" wywołałoby `handleSubmit` i uruchomiło przebieg (Start). Plan tego nie wymienia.
- **Fix**: Wymagać `type="button"` w `SignalPreviewControl` i dodać test/fixture sprawdzający, że odsłuch nie wywołuje `onStart`.
- **Decision**: ACCEPTED

### F3 — Cykl życia audio z gestu niedookreślony (pending, martwy port, retry, zegar)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 — hook; Critical Implementation Details
- **Detail**: `createDrillAudio()` jest async (do 1,5 s `resume()`). Plan zakłada „lazy single port", ale nie rozstrzyga: (a) kliknięcia/Start w trakcie inicjalizacji (brak stanu pending/busy; plan uznaje „loading" za N/A, choć realnie istnieje); (b) port po `statechange` (suspend na iOS/Safari, `available === false`) — kolejny klik musi stworzyć nowy kontekst w nowym geście, nie reużywać martwego; (c) `null` z `createDrillAudio` — czy `unavailable` jest sticky, czy kolejny klik ponawia; (d) `startAt` musi być w domenie `performance.now()/1000` (anchor w `schedule`), więc potrzebny wstrzykiwany zegar.
- **Fix A ⭐ Recommended**: Jawna maszyna stanów w kontrolerze z F1: `idle | initializing | playing | unavailable`; klik w `initializing` ignorowany (przycisk `aria-busy`); reuse portu tylko gdy `port.available`, inaczej nowy `createAudio()` w gestie; `unavailable` ponawiane przy każdym kliku; zegar wstrzykiwany.
  - Strength: Domyka wymóg gestu Web Audio i daje deterministyczne testy oraz fixture „loading".
  - Tradeoff: Trochę więcej kodu niż prosty hook.
  - Confidence: HIGH — spójne z `observeDrillAudioInitialization` i polityką „create in gesture".
  - Blind spot: Zachowanie Safari/iOS tylko do weryfikacji manualnej.
- **Fix B**: Tworzyć nowy port przy każdym kliku i zamykać poprzedni.
  - Strength: Brak reużycia martwych kontekstów, najprostsze.
  - Tradeoff: Limit AudioContext w przeglądarce i opóźnienie do 1,5 s przy każdym kliku.
  - Confidence: MEDIUM — latencja niezmierzona.
  - Blind spot: Zachowanie przy szybkim klikaniu.
- **Decision**: ACCEPTED

### F4 — Wyłączanie odsłuchu Standby przy wyłączonym Random start nie wynika z FR-004

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State; brief „Key Decisions Made"
- **Detail**: FR-004 wymaga przycisku odsłuchu „przy ustawieniach ćwiczenia, odpoczynku i opcji Standby" i wyłącza sygnał tylko dla przygotowania i odpoczynku 0 s. Zablokowany przycisk przy odznaczonym Random start uniemożliwia posłuchanie Standby, by zdecydować o jego włączeniu (US-01). Plan sam oznacza to jako założenie.
- **Fix**: Odsłuch Standby zawsze włączony; warunek Random start jako informacja w tekście, nie blokada. Alternatywnie potwierdzić z użytkownikiem wariant z blokadą.
- **Decision**: ACCEPTED

### F5 — Komunikat „Rest is 0:00" dla niepoprawnego Rest; parser niewyeksportowany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — `signalAvailability`; Desired End State (Rest)
- **Detail**: Plan łączy „0 s lub invalid" w tekst „Rest is 0:00, so there is no rest signal.", fałszywy dla np. „abc" czy „11:00". `parseTime` w `src/lib/drill-timer.ts` nie jest eksportowany, a plik nie jest na liście zmian; użycie `parseDrillConfig` zablokowałoby odsłuch przy błędzie innego pola.
- **Fix**: Wyeksportować parser czasu (np. `parseDrillTime`) w `drill-timer.ts`, dopisać plik do planu i dodać osobny tekst dla invalid („Enter a valid Rest time to hear its signal.").
- **Decision**: ACCEPTED

### F6 — Fixture „playing"/„loading" wymagają wstrzykiwalnego harmonogramu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — fixtures; Phase 2 — kontrakt hooka
- **Detail**: Hook przyjmuje tylko `createAudio`; „playing" czyści się timerem końca cue, więc fixture nie jest deterministyczny. Brak stanu „loading" (patrz F3). `TimerUiPreview.tsx` ma już 1206 linii; wymóg AGENTS.md (rozszerzać fixtures, zachować siedem stanów i held-mounted scenariusze) lepiej spełni osobny moduł fixture.
- **Fix**: Wstrzykiwany scheduler/zegar w kontrolerze (F1) lub `FixtureAudio` z ręcznie zwalnianym końcem; fixture w osobnym module; zmapować stany: default, disabled (rest 0), error (unavailable), loading (initializing), playing; hover/focus-visible przez interakcję.
- **Decision**: ACCEPTED

### F7 — Czas końca z `CUE_DURATION` zamiast ze zwróconego `ScheduledCue.end`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — `playSignalPreview`
- **Detail**: `schedule` przycina start do `context.currentTime`, więc rzeczywisty koniec jest w `ScheduledCue.end`; status „Playing…" czyszczony wg obliczonego czasu może zniknąć za wcześnie. Drugi dźwięk Standby ma startować od `first.start + STANDBY_SECOND_OFFSET` (jak w `DrillRun`), nie od planowanego `startAt`.
- **Fix**: Zwracać `end` ostatniego `ScheduledCue`; test na fake porcie z przesuniętym startem.
- **Decision**: ACCEPTED

### F8 — Drobne niespójności UI (tab order, disabled + reason)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Form integration
- **Detail**: „tab order unchanged" jest sprzeczne z dodaniem nowych przycisków między polami; `ConfigField` nie ma slotu na `children`. Wyłączony `Button` nie jest fokusowalny, więc powód musi być widocznym tekstem, nie tylko `aria-describedby`. Dla błędu można użyć istniejącego `ui/alert.tsx`.
- **Fix**: Zmienić na „istniejące pola zachowują kolejność; nowe przyciski dodają tab stopy", dodać `children` do `ConfigField`, widoczny tekst powodu.
- **Decision**: ACCEPTED

## Resolution (2026-10-06)

All findings ACCEPTED by the coordinator; plan.md and plan-brief.md updated accordingly.

- F1: pure controller `src/lib/drill-signal-preview-controller.ts` tested by `npm test`; hook is a thin `useSyncExternalStore` wrapper.
- F2: `SignalPreviewControl` renders `type="button"`; test/fixture proves preview never calls `onStart`.
- F3: Fix A — state machine `idle | initializing | playing | unavailable`; click ignored while initializing (`aria-busy`); port reused only if `available`, else new `createAudio()` inside the gesture; `unavailable` retried on every click; injected clock in the `performance.now()/1000` domain.
- F4: decision (a) CHANGED by coordinator — Standby preview is ALWAYS enabled; Random start state is only informational text.
- F5: export `parseDrillTime` from `src/lib/drill-timer.ts`; separate texts for Rest 0:00 vs invalid Rest.
- F6: injected timer/clock in the controller; fixtures in a separate module `SignalPreviewFixtures.tsx`, minimal change to `TimerUiPreview.tsx`.
- F7: end time taken from the last returned `ScheduledCue.end`; second Standby cue starts at `first.start + STANDBY_SECOND_OFFSET`.
- F8: existing fields keep their order, new buttons add tab stops; `ConfigField` gets `children`; reason is visible text; errors use `ui/alert.tsx`.
