---
change_id: mutation-testing-stryker
title: StrykerJS mutation testing as a selective quality gate
status: archived
created: 2026-10-11
updated: 2026-10-12
archived_at: 2026-10-12T16:39:55Z
---

## Notes

Cel: wprowadzić testy mutacyjne StrykerJS jako SELEKTYWNĄ bramkę jakości dla warstwy jednostkowej (`npm test`, node --test, pliki .ts uruchamiane natywnym usuwaniem typów Node 24.21.0) — zgodnie z sekcją „Testowanie mutacyjne (Stryker)” w CLAUDE.md: lokalnie, na żądanie, zawężone do modułu (`npx stryker run --mutate "<plik>"`), NIE bramka CI przy każdym commicie, bez gonienia 100%.

Zakres ustalony z użytkownikiem:
- devDependencies: @stryker-mutator/core + @stryker-mutator/tap-runner (tap runner obsługuje wbudowany runner Node, perTest coverage). Fallback tylko jeśli tap nie działa: runner `command` z `npm test` (bez nowych zależności typu tsx bez pytania użytkownika).
- stryker.config.json, skrypt `npm run test:mutation`, raport HTML w katalogu ignorowanym przez git (reports/ lub podobny), sandbox Strykera (.stryker-tmp) też w .gitignore i ignorach ESLint.
- Pierwszy przebieg na trzech modułach pod ryzykami test-planu: src/lib/protected-routes.ts (#2), logika bezpiecznego `next` w src/lib/email-auth.ts (#5), walidacja w src/lib/services/drill-configurations.ts (#6). Przegląd przetrwałych mutantów wg CLAUDE.md: „czy ta zmiana zaszkodziłaby użytkownikowi?” → tak: asercja zabijająca mutanta z wyrocznią ze źródła (nie z implementacji); nie: świadomie ignoruj i zapisz dlaczego.
- Dokumentacja: context/foundation/test-plan.md §4 (wiersz mutation | StrykerJS (tap runner) | <wersja> | checked: <data>; When NOT to use: warstwa integracyjna HTTP — rebuild preview i limit auth 30/5 min), §5 (bramka „mutation — local, on demand po fazie rolloutu — optional”), §6 (krótki przepis); README „Available Scripts”; CLAUDE.md i AGENTS.md jedna linia. NIE zmieniać §1–§3 test-planu.
- Pierwsza rzecz do sprawdzenia: czy instrumentacja Strykera dla .ts działa z natywnym type stripping Node 24 (bez tsx) w tap runnerze. Dokumentację bibliotek pobierać przez `npx ctx7@latest`.

### Wyniki researchu (podsumowanie)

Źródła: MCP exa (strona tap-runner, issue #5421) i Context7 `/stryker-mutator/stryker-js` (pełna treść: `context/docs/stryker-js.md`); szczegóły w `research.md`.

- **(a) Zakres linii:** `--mutate "plik:start-koniec"` (np. `src/lib/email-auth.ts:25-53`), bez łączenia z globem; mutowania po nazwie funkcji brak → zakres linii, kruchy po edycji pliku (opisane w konfiguracji i test-plan §6.7).
- **(b) Komentarze w JSON:** konwencja `_comment`; walidator schematu odrzuca nieznany klucz wewnątrz `tap`, więc komentarze są na najwyższym poziomie.
- **(c) Tap runner:** działa z natywnym TS Node 24 bez `tsx`; `tap.nodeArgs` tylko `["--test-reporter=tap"]`, bez `--test` (z `--test` hook Strykera nie trafia do podprocesu i wszystkie mutanty są NoCoverage; zob. issue #5421).
- **(d) Dry run `email-auth`:** testy czytają pliki z dysku (`src/pages/api/auth/callback.ts`, `src/pages/auth/callback.astro`, `supabase/config.toml`, szablon `magic_link.html`), więc `ignorePatterns` nie może wykluczać `src/` ani `supabase/`.
- **Decyzje:** tylko lokalnie i na żądanie (nie CI, bez progu `break`); trzy moduły pod ryzykami #2, #5, #6; wyrocznie z PRD/test-planu (stała 2048 to szczegół implementacji, nie wyrocznia, więc test limitu długości `next` jest testem właściwości); mutanty równoważne i kosmetyczne ignorowane z uzasadnieniem w `mutation-review.md`; brak nowych zależności poza `@stryker-mutator/core` i `tap-runner` 10.0.0.
