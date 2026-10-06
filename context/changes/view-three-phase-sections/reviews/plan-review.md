<!-- PLAN-REVIEW-REPORT -->
# Plan Review: View three phase sections

- **Plan**: context/changes/view-three-phase-sections/plan.md
- **Mode**: Deep (weryfikacja kodu bezpośrednio; skill `/10x-plan-review` niedostępny w sesji, format wzorowany na preview-phase-signals)
- **Date**: 2026-10-06
- **Verdict**: REVISE (drobne poprawki, brak blokerów)
- **Findings**: 0 critical, 3 warnings, 3 observations

## Zgodność z wymaganiami

- Trzy sekcje, kolejność main → current → next, sterowanie pod spodem: ✓ (US-02, FR-005).
- Standby: main „Standby" bez odliczania, current bez czasu, next „Next: Standby" bez czasu: ✓.
- Pominięte fazy (prep 0, rest 0), Standby on/off, koniec przebiegu (ostatni odpoczynek / ostatnie ćwiczenie przy rest 0): ✓ — pokrywa `nextDrillPhase` (`drill-timer.ts:79-108`).
- `next` po pauzie/wznowieniu: pomysł poprawny. Zweryfikowane w `drill-run.ts`: `resume()` (`:184-188`) ustawia `resumeTarget` i buduje pełne przygotowanie; pauza w trakcie resume-prep zachowuje `resumeTarget` (gałąź `:194-195`), `tick` czyści go dopiero po końcu prep (`:117`). Pomocnik `phase.kind==="preparation" && resumeTarget ? resumeTarget : nextDrillPhase` jest więc poprawny w obu gałęziach `display`. Pauza w Standby/ćwiczeniu przy prep 0 (`:189-193`) daje `nextDrillPhase(target)` — poprawnie.
- Brak ujawnienia długości Standby: `next` to zwykły `DrillPhase` bez czasu Standby; `display.remainingSeconds` dla Standby = null. ✓
- Kolory faz (S-05) pominięte świadomie: ✓ (PRD US-02 AC o tle w kolorze fazy jest odroczone do S-05 — warto to zapisać w change.md/roadmapie jako znane odstępstwo).
- `npm test` (`src/lib/*.test.ts`) obejmie nowe pliki w `src/lib`: ✓. Kontrakt UI timera (tokeny, skala Tailwind, pasek sterowania bez zmian): ✓.

## Findings

### F1 — Kryterium 3.2 „no digit in Standby main/current" jest sprzeczne z planem
- **Severity**: ⚠️ WARNING
- **Location**: Phase 3, kryterium 3.2 vs. Desired End State (current: „Repetition X of N")
- **Detail**: Sekcja current w Standby zawiera linię „Repetition X of N", więc zawiera cyfry. Test Playwright oparty na „braku cyfr" zawsze by się wywalił albo został po cichu osłabiony. Podobnie test jednostkowy „carry no number" jest niedookreślony.
- **Fix**: Zdefiniować asercje jako: `main.kind === "standby"`, `current.time === null`, brak wzorca `m:ss` (`/\d+:\d\d/`) w tekście main/current/next-Standby; w Playwright sprawdzać brak `\d+:\d\d`, a nie brak cyfr.

### F2 — Format czasu „0:02" kontra PRD „2 s"; brief twierdzi „exactly"
- **Severity**: ⚠️ WARNING
- **Location**: plan-brief.md „Success Criteria"; plan.md Desired End State
- **Detail**: PRD US-02 podaje „Next: Rest — 2 s" (oraz 4 s dla ćwiczenia), plan używa `m:ss` („0:02") i w briefie deklaruje, że „PRD examples render exactly". To nieprawda dosłownie. Decyzja o `m:ss` jest sensowna (spójność z odliczaniem), ale nie jest oznaczona jako świadome odstępstwo od PRD.
- **Fix**: Zapisać odstępstwo jawnie (change.md/plan: „PRD 2 s → 0:02, decyzja użytkownika?") i poprawić sformułowanie w briefie na „semantycznie zgodne"; albo zatwierdzić format z użytkownikiem przed implementacją. Test PRD-przykładu niech używa wybranego formatu.

### F3 — Niespójność o testach na urządzeniach
- **Severity**: ⚠️ WARNING (niski wpływ)
- **Location**: „What We're NOT Doing" („no claim of testing on real devices") vs. kryterium 3.4 „Real-device drill…"
- **Detail**: Plan jednocześnie wyklucza i wymaga weryfikacji na prawdziwym urządzeniu.
- **Fix**: Zostawić 3.4 jako ręczne, opcjonalne, i usunąć/uściślić wykluczenie („nie twierdzimy bez wykonania 3.4").

### F4 — Test „next == następna faza widoczna w display" wymaga obsługi ścieżki resume
- **Severity**: 🔎 OBSERVATION
- **Detail**: Przy resume wyświetlana sekwencja to prep → (rep N) a nie wynik `nextDrillPhase(prep)`; test napędzający `DrillRun` musi porównywać z faktycznie pokazywaną fazą, nie z `nextDrillPhase`. Plan to opisuje (Testing Strategy), warto dodać jawne przypadki: pauza w resume-prep + drugie wznowienie (jest), pauza w rest/prep bez resumeTarget (next bez zmian), losowe Standby z wstrzykniętym `random`.
- **Fix**: Dodać te przypadki do listy testów.

### F5 — Strażnik „exact key set of display" jest słabym dowodem braku wycieku
- **Severity**: 🔎 OBSERVATION
- **Detail**: Chroni przed dodaniem pól, ale nie przed wyciekiem przez `remainingSeconds` czy przez `next`. Warto dodać test z dwoma różnymi `random` (1 s vs 5 s) sprawdzający, że sekwencja `display` + `buildPhaseSections` w Standby jest identyczna do momentu końca Standby.
- **Fix**: Dodać taki test różnicowy (deterministyczny zegar).

### F6 — Pusty stan i kontrakt `initializing`
- **Severity**: 🔎 OBSERVATION
- **Detail**: `buildPhaseSections` zwraca `null` dla `phase: null`; `DrillTimer.tsx:65` traktuje to jako koniec (onComplete), więc `null` nie dociera do widoku — warto to napisać w planie (uzasadnienie N/A dla „empty" w bramce wizualnej). `initialDrillDisplay` zastępuje ręczny literał w `DrillTimer.tsx:43-46` — dobre, usuwa duplikat.

## Podsumowanie

Plan jest solidny i poprawnie rozpoznaje pułapkę resume (`resumeTarget` prywatny w `DrillRun`). Przed implementacją: F1 (sprzeczne kryterium), F2 (jawna decyzja o formacie vs PRD), F3 (spójność). Reszta to uzupełnienia testów.
