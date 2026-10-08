<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Open Saved Drill (S-11)

- **Plan**: context/changes/open-saved-drill/plan.md
- **Scope**: Full plan (fazy 1-3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 4 observations

Weryfikacja własna: `npm test` 156/156, `npm run lint` 0 błędów, `astro check` 0 błędów, brak migracji (`git diff --name-only main -- supabase/migrations` puste). pgTAP, smoke i build nie były uruchamiane ponownie (wspólny stack; opieram się na handoff). Analiza statyczna: brak wycieku istnienia cudzego id (jeden `NotFoundView` bez URL/id, non-UUID sprawdzany przed userem i bazą, identyczne nagłówki), no-store/noindex na każdej gałęzi, błąd bazy -> alert/503 (nigdy tekst „brak timerów”), `DrillApp` bez regresji na `/` (domyślny `returnLabel`, ten sam h1).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Kroki ręczne 2.3 i 2.5 odhaczone bez weryfikacji człowieka

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/open-saved-drill/plan.md:260,262
- **Detail**: Plan wymaga ręcznej weryfikacji (Start/Cancel/refresh, klawiatura, nazwy dostępne) i pauzy na potwierdzenie człowieka; wykonał to skrypt Playwright (adnotacja w Progress to przyznaje), a bfcache Back/Forward, czytnik ekranu i urządzenia nie były sprawdzone. Lekcja projektu: oznaczaj kroki po potwierdzeniu użytkownika.
- **Fix**: Zostaw adnotację „by Playwright”, ale odhacz ostatecznie dopiero po potwierdzeniu człowieka (razem z 3.3/3.4 i kontrolą bfcache).
- **Decision**: ACCEPTED-AS-IS — kroki 2.3/2.5 mają jawny dopisek „skryptem, nie człowiek”; ostateczne potwierdzenie ręczne (razem z bfcache) robi użytkownik na końcu kolejki.

### F2 — Brak dowodu stanów hover/focus/Start dla widoku szczegółów i działającego timera w trybie saved

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/timer/SavedDrillFixtures.tsx:80
- **Detail**: Karta `saved-details` jest tylko w stanie default; hover/focus-visible (Start, Back) udokumentowane tylko dla listy. 3.3 i 3.4 (siedmiostanowa bramka, scenariusze Restart) nadal otwarte; w `TimerUiPreview` dodano tylko 2 linie, bez ponownych zrzutów.
- **Fix**: Dodać hover/focus na Start w skrypcie bramki i domknąć 3.3/3.4.
- **Decision**: ACCEPTED-AS-IS — 3.3/3.4 są dla człowieka.

### F3 — pgTAP odczytu nie sprawdza kolejności ani treści

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/tests/database/drill_configurations.test.sql:175-193
- **Detail**: Testy „list query” sprawdzają tylko `count(*)` (1 dla B, 2 dla A), plan obiecywał też kolejność `created_at desc, id desc`. Podmiana filtra o tej samej liczności nie byłaby wykryta; brak asercji, że B nie widzi nazw A.
- **Fix**: Użyć `results_eq`/`is(array_agg(name order ...))` na liście i `is_empty` dla nazw A pod rolą B.
- **Decision**: FIXED — pgTAP (plan 80): kolejność listy (`created_at desc`, tie-break `id desc` vs niezależne `order by id desc`) i dokładna treść wierszy A i B, B nie widzi nazw A.

### F4 — Redirect middleware dla gościa na /{uuid} bez Cache-Control: no-store

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/middleware.ts:24
- **Detail**: Plan: „all responses `private, no-store`”; 302 z `context.redirect` nie ma tego nagłówka (tak samo dla /dashboard, /create przed zmianą). Bez ujawnienia danych (302 identyczny dla każdego UUID), więc ryzyko znikome.
- **Fix**: Ustawić `no-store` na odpowiedzi redirectu albo zapisać wyjątek w planie.
- **Decision**: FIXED — `guestRedirectResponse` w `src/lib/protected-routes.ts` (302 + `Cache-Control: private, no-store`), użyty w middleware; test jednostkowy.

### F5 — Utrata fokusu po Cancel/Return w trybie saved

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/timer/DrillApp.tsx:129
- **Detail**: Po powrocie z biegu/ukończenia przycisk Start jest nowo zamontowany i fokus ląduje na `body` (potwierdzone w handoff). Wzorzec istniał już na `/`, ale w widoku szczegółów użytkownik klawiatury traci kontekst.
- **Fix**: Przenieść fokus na Start/nagłówek po powrocie (osobna zmiana, także dla `/`).
- **Decision**: FIXED — `DrillApp`: po Cancel/Return fokus trafia na nagłówek h1 (`tabIndex=-1`, ref + efekt), także na `/`. Bez testu automatycznego (brak środowiska DOM); sprawdzenie w przeglądarce wpisane do handoff.
