<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run view layout

- **Plan**: context/changes/run-view-layout/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Weryfikacja: `npm run lint` (0 błędów), `npm test` (217/217), `node --test scripts/eslint-rules/*.test.mjs` (6/6), `npx astro check` (0 błędów, 1 hint), `run-view-checks.json` (failed: 0). Zrzuty obejrzane: sections-390-dark, error-two-warnings-390-light. Punkty ręczne 3.3 i 3.4 pozostają `[ ]` w Progress (do oznaczenia po potwierdzeniu użytkownika, zob. lekcja).

## Findings

### F1 — Reguła ignorowania w eslint zbyt szeroka

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:84
- **Detail**: `globalIgnores(["context/**/screenshots/**"])` wyłącza z lintu każdy plik w dowolnym folderze zrzutów (także przyszłe skrypty, w tym skrypt bramki). Plan tego nie przewidywał. Skrypt używa `require`/`process` i nie przeszedłby `scriptsConfig` (globals), stąd ignore, ale zakres jest szerszy niż potrzeba.
- **Fix**: Zawęzić do `context/**/screenshots/*.mjs` albo do konkretnego pliku `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs`; udokumentować w planie jako addendum.
- **Decision**: FIX — globalIgnores zawężone do `context/changes/run-view-layout/screenshots/*.mjs`.

### F2 — Skrypt bramki zależy od PLAYWRIGHT_PATH i nie jest w CI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs:1-12
- **Detail**: Playwright nie jest w package.json; skrypt ładuje go przez `createRequire` z `PLAYWRIGHT_PATH`. CI (`npm ci`, lint, test, build) go nie uruchamia ani nie importuje, więc nie psuje CI, a po ignore także lintu. Wada: kryterium 3.2 nie jest powtarzalne w CI i zależy od lokalnej instalacji. Skrypt pozostaje zgodny z zakresem planu (skrypt obok zrzutów).
- **Fix**: Zostawić (plan tego chciał); ewentualnie dopisać w AGENTS.md wymaganie `PLAYWRIGHT_PATH` i `npm run dev` (komentarz w nagłówku skryptu już to opisuje).
- **Decision**: ACCEPTED — uruchomienie (`npm run dev` + `PLAYWRIGHT_PATH`) opisane w AGENTS.md.

### F3 — Wizualna luka między paskiem a ostrzeżeniami

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/DrillTimerView.tsx:84-97
- **Detail**: Stały wiersz statusu `min-h-10` + `space-y-4` + slot `min-h-20` dają pustą przestrzeń ok. 60 px nad Alertem na 390 px (zrzut error-two-warnings-390-light). Plan dopuszczał zmniejszenie do `min-h-16` pod warunkiem braku skoków; skrypt sprawdza tylko `top` przycisków, nie wysokość sekcji. Dwa ostrzeżenia mieszczą się w `min-h-20` (zrzut), ale zawinięcie na najwęższych ekranach nie jest sprawdzone.
- **Fix**: Zostawić `min-h-20`; jeśli zbędna pustka przeszkadza, zmniejszyć do `min-h-16` po sprawdzeniu zrzutu z dwoma ostrzeżeniami przy 390 px.
- **Decision**: ACCEPTED — stały slot, bez skoków.

### F4 — Brak testu serwerowego dla Standby w widoku przy zerowej liczbie powtórzeń

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-phase-sections.ts:51
- **Detail**: Tajność Standby zachowana: model czyta wyłącznie wartości faz, `repetition` w Standby pochodzi z `phase.repetition`, test różnicowy 1 s vs 5 s porównuje cały `PhaseSections` (w tym `repetition`). W Preparation `repetition` z `next` jest `null`, gdy `next === null` (w praktyce nie występuje); wtedy `<p>` zostaje pusty o stałej wysokości `min-h-7`. `role="timer"` zostaje tylko na liczbie; podczas `initializing` brak elementu timera, ale kontener `min-h-20` zachowuje wysokość. Bez problemu, uwaga informacyjna.
- **Fix**: Brak potrzeby.
- **Decision**: ACCEPTED — informacyjne, bez zmian.
