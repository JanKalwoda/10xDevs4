---
change_id: mutation-testing-stryker
title: StrykerJS mutation testing as a selective quality gate
status: implementing
created: 2026-10-11
updated: 2026-10-11
archived_at: null
---

## Notes

Cel: wprowadzić testy mutacyjne StrykerJS jako SELEKTYWNĄ bramkę jakości dla warstwy jednostkowej (`npm test`, node --test, pliki .ts uruchamiane natywnym usuwaniem typów Node 24.21.0) — zgodnie z sekcją „Testowanie mutacyjne (Stryker)” w CLAUDE.md: lokalnie, na żądanie, zawężone do modułu (`npx stryker run --mutate "<plik>"`), NIE bramka CI przy każdym commicie, bez gonienia 100%.

Zakres ustalony z użytkownikiem:
- devDependencies: @stryker-mutator/core + @stryker-mutator/tap-runner (tap runner obsługuje wbudowany runner Node, perTest coverage). Fallback tylko jeśli tap nie działa: runner `command` z `npm test` (bez nowych zależności typu tsx bez pytania użytkownika).
- stryker.config.json, skrypt `npm run test:mutation`, raport HTML w katalogu ignorowanym przez git (reports/ lub podobny), sandbox Strykera (.stryker-tmp) też w .gitignore i ignorach ESLint.
- Pierwszy przebieg na trzech modułach pod ryzykami test-planu: src/lib/protected-routes.ts (#2), logika bezpiecznego `next` w src/lib/email-auth.ts (#5), walidacja w src/lib/services/drill-configurations.ts (#6). Przegląd przetrwałych mutantów wg CLAUDE.md: „czy ta zmiana zaszkodziłaby użytkownikowi?” → tak: asercja zabijająca mutanta z wyrocznią ze źródła (nie z implementacji); nie: świadomie ignoruj i zapisz dlaczego.
- Dokumentacja: context/foundation/test-plan.md §4 (wiersz mutation | StrykerJS (tap runner) | <wersja> | checked: <data>; When NOT to use: warstwa integracyjna HTTP — rebuild preview i limit auth 30/5 min), §5 (bramka „mutation — local, on demand po fazie rolloutu — optional”), §6 (krótki przepis); README „Available Scripts”; CLAUDE.md i AGENTS.md jedna linia. NIE zmieniać §1–§3 test-planu.
- Pierwsza rzecz do sprawdzenia: czy instrumentacja Strykera dla .ts działa z natywnym type stripping Node 24 (bez tsx) w tap runnerze. Dokumentację bibliotek pobierać przez `npx ctx7@latest`.
