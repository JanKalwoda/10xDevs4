# Testy mutacyjne StrykerJS — Plan Brief

> Full plan: `context/changes/mutation-testing-stryker/plan.md`
> Research: `context/changes/mutation-testing-stryker/research.md`

## What & Why

Dodajemy StrykerJS jako lokalną bramkę na żądanie dla testów jednostkowych, żeby sprawdzić, czy testy wykryłyby zepsucie kodu, a nie tylko wykonały linie. Zgodnie z CLAUDE.md: zawężone do modułu, nie CI, bez gonienia 100%.

## Starting Point

`npm test` (node:test na `.ts`) działa, brak narzędzia mutacyjnego; test-plan §4–§6 nie wspomina o mutacjach.

## Desired End State

`npm run test:mutation` daje raport HTML poza gitem; trzy moduły (ryzyka #2, #5, #6) mają przegląd mutantów i asercje zabijające szkodliwe; przepis w test-plan §6, README, CLAUDE.md, AGENTS.md.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runner | tap runner, `nodeArgs=["--test-reporter=tap"]` bez `--test` | spike: z `--test` hook nie trafia do podprocesu, 0% | Research |
| Zależności | core + tap-runner `^10.0.0` | bez tsx; fallback `command` tylko po pytaniu | Plan |
| Zakres walidacji | zakres linii 53–117 | cały plik 45%, 271 NoCoverage; zakres wymaga aktualizacji po zmianach | Research |
| Próg | thresholds bez `break` | nie bramka | Plan |
| Mutanty ignorowane | `mutation-review.md` + skrót w §6 | uzasadnienie świadomego pominięcia | Plan |
| Sandbox | `ignorePatterns` bez `src/` i `supabase/` | testy czytają te pliki | Research |

## Scope

**In scope:** instalacja, config, skrypt, ignory, 3 moduły, dokumentacja.
**Out of scope:** CI, integracja HTTP, React, §1–§3 test-planu, tsx.

## Architecture / Approach

Stryker kopiuje repo do `.stryker-tmp`, instrumentuje wskazany `.ts`, tap runner uruchamia plik testowy bezpośrednio przez `node` z hookiem pokrycia; wynik: clear-text + HTML.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Instalacja i config | działający przebieg na protected-routes | `email-auth` dry run padł w spike'u (niepełna kopia repo) |
| 2. Przegląd mutantów | `mutation-review.md` + asercje | testy pod kosmetykę zamiast ryzyka |
| 3. Dokumentacja | test-plan §4–§6, README, CLAUDE/AGENTS | kruchy zakres linii |

**Prerequisites:** Node 24.21.0, brak dodatkowej infrastruktury.
**Estimated effort:** ~2–3 sesje, 3 fazy.

## Open Risks & Assumptions

- Dry run `email-auth`: przyczyna znaleziona (w kopii spike'u brakowało plików czytanych przez test), do potwierdzenia w repo.
- Komentarze w JSON przez `_comment` (do potwierdzenia uruchomieniem); mutacji po funkcji brak — tylko zakres linii.

## Success Criteria (Summary)

- Przebieg na każdym z trzech modułów działa lokalnie, bez wpływu na CI.
- Szkodliwe przetrwałe mutanty zabite asercjami z wyroczni; reszta uzasadniona.
