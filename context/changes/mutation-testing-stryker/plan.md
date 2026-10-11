# Testy mutacyjne StrykerJS jako selektywna bramka — plan wdrożenia

## Overview

Wprowadzamy StrykerJS (`@stryker-mutator/core` + `@stryker-mutator/tap-runner`) jako **lokalną, na żądanie** bramkę jakości warstwy jednostkowej (`npm test`, `node:test`, `.ts` przez natywny type stripping Node 24.21.0). Nie jest to bramka CI. Pierwszy przebieg obejmuje moduły pod ryzykami test-planu #2, #5, #6; przetrwałe mutanty oceniamy pytaniem „czy ta zmiana zaszkodziłaby użytkownikowi?” (CLAUDE.md, „Testowanie mutacyjne”).

## Current State Analysis

- Testy jednostkowe: `node --test src/lib/*.test.ts src/lib/services/*.test.ts` (`package.json` `test`), bez narzędzia mutacyjnego; `test-plan.md` §4 nie ma wiersza mutation, §5 nie ma bramki mutation.
- `.gitignore` nie ma `reports/` ani `.stryker-tmp/`; ESLint czyta `.gitignore` przez `includeIgnoreFile` (`eslint.config.js:83`).
- Moduły: `src/lib/protected-routes.ts` (test `protected-routes.test.ts`), `isSafeNextPath` w `src/lib/email-auth.ts:25` (test `email-auth.test.ts`, czyta z dysku `src/pages/auth/callback.astro` i `supabase/config.toml`), walidacja w `src/lib/services/drill-configurations.ts` linie 53–117 (test `drill-configurations.test.ts`, czyta migracje).

## Desired End State

`npm run test:mutation` (oraz `npx stryker run --mutate "<plik>[:od-do]"`) uruchamia mutacje na wskazanym module, kończy się bez błędu dry runu i zapisuje raport HTML w `reports/mutation/` (poza gitem). Trzy moduły mają przegląd mutantów zapisany w `mutation-review.md`; mutanty szkodliwe dla użytkownika są zabite asercjami z wyroczni ze źródeł; dokumentacja opisuje przepis. CI bez zmian.

### Key Discoveries:

- Tap runner działa z natywnym TS Node 24 bez tsx, ale **wymaga `tap.nodeArgs: ["--test-reporter=tap"]` bez `--test`**; z `--test` hook Strykera (`-r hook.cjs`) nie trafia do podprocesu i każdy mutant to `NoCoverage` (`research.md` pkt 2).
- Granularność `perTest` = plik testowy (`research.md` pkt 4).
- Stryker wymaga pakietu `typescript` przy obecnym `tsconfig.json` (jest w repo) (`research.md` pkt 6).
- `drill-configurations.ts` w całości: 45% wyniku, 271 NoCoverage → mutować zakres walidacji (`research.md` pkt 3, 7).

## What We're NOT Doing

- Bramka CI, hook pre-commit, próg `break`, gonienie 100%.
- Mutacje warstwy integracyjnej HTTP (rebuild preview, limit auth 30/5 min) i komponentów React.
- Zmiany §1–§3 `test-plan.md`; nowe zależności poza dwiema zatwierdzonymi (bez tsx; fallback `command` runner tylko po pytaniu).
- Przepisywanie istniejących testów; tylko asercje zabijające szkodliwe mutanty.

## Implementation Approach

Trzy fazy: (1) infrastruktura + dowód na najmniejszym module, (2) przegląd i asercje dla trzech modułów, (3) dokumentacja. Wyrocznie z tabeli w `research.md` (PRD FR-001, FR-011, FR-017, Access Control, test-plan Risk #2/#5/#6); komunikatów i kosmetyki nie przypinamy. Dokumentację biblioteki (składnia `--mutate` z zakresem linii, `ignorePatterns`, reportery, thresholds) pobieramy przez `npx ctx7@latest` (library → docs). Zakres linii jest kruchy po zmianach pliku — udokumentować konieczność aktualizacji (komentarz przy konfiguracji/skrypcie i §6); mutowanie po nazwie funkcji tylko jeśli Stryker to umożliwia (sprawdzić w ctx7), w przeciwnym razie zostajemy przy liniach.

## Phase 1: Instalacja, konfiguracja i pierwszy przebieg

### Overview

Zależności, `stryker.config.json`, skrypt, ignory, przebieg na `protected-routes.ts`.

### Changes Required:

#### 1. Zależności i skrypt

**File**: `package.json`, `package-lock.json`

**Intent**: Dodać `@stryker-mutator/core` i `@stryker-mutator/tap-runner` jako devDependencies oraz skrypt na żądanie.

**Contract**: wersje `^10.0.0` (obie); skrypt `"test:mutation": "stryker run"`. Skrypt `test` i CI nie zmieniają się.

#### 2. Konfiguracja Strykera

**File**: `stryker.config.json`

**Intent**: Konfiguracja tap runnera z opisem nieoczywistych wymagań (nodeArgs bez `--test`, kruchy zakres linii).

**Contract**: `testRunner: "tap"`, `plugins`, `tap.testFiles` = pliki testowe trzech modułów, `tap.nodeArgs: ["--test-reporter=tap"]` (komentarz przy konfiguracji, jeśli format pozwala; w przeciwnym razie opis w README i test-plan §6), `coverageAnalysis: "perTest"`, `reporters: ["clear-text","progress","html"]`, `htmlReporter.fileName: "reports/mutation/mutation.html"`, `thresholds` high 80 / low 60 **bez `break`**, `tempDirName: ".stryker-tmp"`, `ignorePatterns` (`context`, `dist`, `.astro`, `.wrangler`, `reports`; zostają `supabase/` i `src/pages/auth/`). Moduły podawane przez `--mutate`.

#### 3. Ignory

**File**: `.gitignore`

**Intent**: `reports/` i `.stryker-tmp/` poza gitem; ESLint dziedziczy przez `includeIgnoreFile`.

**Contract**: dwie nowe linie; `npm run lint` bez nowych błędów (jeśli ESLint skanuje `.stryker-tmp`, dodać `globalIgnores` w `eslint.config.js`).

### Success Criteria:

#### Automated Verification:

- Instalacja czysta: `npm install`
- Przebieg na pierwszym module kończy się sukcesem dry runu: `npx stryker run --mutate "src/lib/protected-routes.ts"`
- Raport powstał, a git go nie widzi: `test -f reports/mutation/mutation.html && git status --short reports .stryker-tmp`
- `npm run lint` i `npm test` przechodzą

#### Manual Verification:

- Raport HTML otwiera się i pokazuje mutanty `protected-routes.ts` z wynikiem > 0%
- Zanotowane w `mutation-review.md`: wersje, czas przebiegu, fakt użycia natywnego TS bez tsx

**Implementation Note**: Po fazie zatrzymaj się na potwierdzenie ręczne. Phase blocks use plain bullets — the `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Przegląd mutantów i asercje dla trzech modułów

### Overview

Przebieg i przegląd dla `protected-routes.ts` (#2), `isSafeNextPath` w `email-auth.ts` (#5), walidacji w `drill-configurations.ts` (#6, zakres linii 53–117 albo wg Phase 1).

### Changes Required:

#### 1. Przegląd przetrwałych mutantów

**File**: `context/changes/mutation-testing-stryker/mutation-review.md`

**Intent**: Tabela `moduł | mutant | decyzja | dlaczego` dla każdego przetrwałego mutanta; decyzja: `zabić` albo `ignoruj` z jednozdaniowym uzasadnieniem (równoważny, kosmetyczny, treść komunikatu).

**Contract**: kryterium „czy ta zmiana zaszkodziłaby użytkownikowi lub firmie?”; wyrocznie wyłącznie z tabeli w `research.md`.

#### 2. Asercje zabijające

**File**: `src/lib/protected-routes.test.ts`, `src/lib/email-auth.test.ts`, `src/lib/services/drill-configurations.test.ts`

**Intent**: Dla mutantów ocenionych jako szkodliwe dodać asercje z wartościami z PRD/test-planu (granice 0/1/600 s, 1/100 powtórzeń, nazwa 200 znaków, odrzucane `//host`, `/\host`, `%2f`, 2048 znaków itd.) jako parametryzowane przypadki zamiast kopii.

**Contract**: żadnej asercji wyliczanej logiką modułu; test przypinający szczegół implementacji tylko po to, by zabić kosmetyczny mutant, jest niedozwolony.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi
- Przebiegi trzech modułów kończą się sukcesem: `npx stryker run --mutate "src/lib/protected-routes.ts"`, `--mutate "src/lib/email-auth.ts:<zakres isSafeNextPath>"`, `--mutate "src/lib/services/drill-configurations.ts:53-117"`
- Brak przetrwałych mutantów oznaczonych `zabić` w `mutation-review.md` po ponownym przebiegu
- `npm run lint` przechodzi

#### Manual Verification:

- Każdy `ignoruj` ma uzasadnienie; przegląd zgodny z wyrocznią ze źródeł (nie z kodu)

**Implementation Note**: Zatrzymaj się na potwierdzenie ręczne przed fazą 3.

---

## Phase 3: Dokumentacja i cookbook

### Overview

Zapisanie przepisu i bramki bez zmiany §1–§3.

### Changes Required:

#### 1. test-plan

**File**: `context/foundation/test-plan.md`

**Intent**: §4 wiersz `mutation | StrykerJS (tap runner) | <wersja> | checked: <data>` z „When NOT to use: warstwa integracyjna HTTP — rebuild preview i limit auth 30/5 min”; §5 bramka „mutation — local, on demand po fazie rolloutu — optional”; §6 krótki przepis.

**Contract**: §6 zawiera komendę, wymóg `tap.nodeArgs=["--test-reporter=tap"]` bez `--test` (z powodem), ostrzeżenie, że zakres linii trzeba zaktualizować po zmianie walidacji, regułę przeglądu mutantów i wskazanie, gdzie zapisywać decyzje o ignorowanych mutantach.

#### 2. README, CLAUDE.md, AGENTS.md

**File**: `README.md`, `CLAUDE.md`, `AGENTS.md`

**Intent**: Jedna linia o `npm run test:mutation` (README „Available Scripts”; CLAUDE.md i AGENTS.md: lokalne, na żądanie, nie CI).

**Contract**: bez innych zmian w tych plikach.

### Success Criteria:

#### Automated Verification:

- `npm run lint` i `npm test` przechodzą; `git diff` dla §1–§3 test-planu pusty

#### Manual Verification:

- Nowa osoba potrafi z §6 uruchomić przebieg na jednym module

---

## Testing Strategy

### Unit Tests:

- Nowe asercje tylko dla szkodliwych mutantów; granice zakresu i odrzucane formy `next` jako parametryzowane przypadki.

### Manual Testing Steps:

1. `npm run test:mutation` / `npx stryker run --mutate "<plik>"` na każdym module.
2. Otwarcie raportu HTML; porównanie z `mutation-review.md`.

## Performance Considerations

Szeroki zakres ~1 min przy 7 procesach (spike); stąd zawężanie do modułu/zakresu linii.

## Migration Notes

Brak; zmiana lokalnego tooling, bez wpływu na CI i produkcję.

## References

- Related research: `context/changes/mutation-testing-stryker/research.md`
- CLAUDE.md „Testowanie mutacyjne (Stryker)”; `context/foundation/test-plan.md` §2 (#2, #5, #6), §4–§6
- `src/lib/protected-routes.ts`, `src/lib/email-auth.ts:25`, `src/lib/services/drill-configurations.ts:53`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Instalacja, konfiguracja i pierwszy przebieg

#### Automated

- [ ] 1.1 Instalacja czysta (`npm install`)
- [ ] 1.2 Przebieg na protected-routes.ts kończy się sukcesem dry runu
- [ ] 1.3 Raport HTML powstał, a git go nie widzi
- [ ] 1.4 `npm run lint` i `npm test` przechodzą

#### Manual

- [ ] 1.5 Raport HTML otwiera się i pokazuje mutanty protected-routes.ts z wynikiem > 0%
- [ ] 1.6 Zanotowane wersje, czas przebiegu i użycie natywnego TS bez tsx

### Phase 2: Przegląd mutantów i asercje dla trzech modułów

#### Automated

- [ ] 2.1 `npm test` przechodzi
- [ ] 2.2 Przebiegi trzech modułów kończą się sukcesem
- [ ] 2.3 Brak przetrwałych mutantów oznaczonych „zabić” po ponownym przebiegu
- [ ] 2.4 `npm run lint` przechodzi

#### Manual

- [ ] 2.5 Każdy „ignoruj” ma uzasadnienie, przegląd zgodny z wyrocznią ze źródeł

### Phase 3: Dokumentacja i cookbook

#### Automated

- [ ] 3.1 `npm run lint` i `npm test` przechodzą, diff §1–§3 test-planu pusty

#### Manual

- [ ] 3.2 Nowa osoba potrafi z §6 uruchomić przebieg na jednym module
