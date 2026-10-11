# Przegląd mutantów — mutation-testing-stryker

## Faza 1: pierwszy przebieg

- Wersje: `@stryker-mutator/core` 10.0.0, `@stryker-mutator/tap-runner` 10.0.0, Node v24.21.0, Windows.
- Komenda: `npx stryker run --mutate "src/lib/protected-routes.ts"`.
- Wynik: 36 mutantów, 36 zabitych, 0 przetrwałych, wynik 100% (raport: `reports/mutation/mutation.html`, poza gitem).
- Czas: dry run 2 s, całość 14 s (około 18 s ze startem `npx`).
- Natywny TS: instrumentowane pliki `.ts` uruchamia Node 24 przez type stripping, bez `tsx` i bez dodatkowych zależności.
- Konfiguracja: `tap.nodeArgs` to tylko `--test-reporter=tap` (bez `--test`). Klucz `_comment` wewnątrz `tap` odrzuca walidator ("must NOT have additional properties"), więc komentarze są na najwyższym poziomie (`_comment`, `_comment_tap`).

## protected-routes.ts

Brak przetrwałych mutantów.

## isSafeNextPath, drill-configurations (walidacja)

Do uzupełnienia w fazie 2.
