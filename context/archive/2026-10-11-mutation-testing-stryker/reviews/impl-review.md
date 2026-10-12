<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testy mutacyjne StrykerJS jako selektywna bramka

- **Plan**: context/changes/mutation-testing-stryker/plan.md
- **Scope**: Full plan (main..HEAD, PR #57)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Weryfikacja (uruchomione przez recenzenta)

- `npm test`: 277 pass, 0 fail. `npm run lint`: bez błędów.
- `npx stryker run --mutate "src/lib/email-auth.ts:25-53"`: 78,13%, 11 przetrwałych, 3 NoCoverage, zgodnie z `mutation-review.md`.
- `npx stryker run --mutate "src/lib/services/drill-configurations.ts:53-117"`: 82,08%, 19 przetrwałych, zgodnie z `mutation-review.md`.
- `git status` po przebiegach czysty (`reports/`, `.stryker-tmp/` ignorowane).
- `npx stryker run --dryRunOnly` bez `--mutate`: „Found 82 of 370 file(s) to be mutated… 5151 mutant(s)” (zob. F1).
- Progress 2.5 (manual) pozostaje `[ ]`; ten przegląd sprawdził decyzje „ignoruj” (F3, F4, uwagi niżej), ale potwierdzenie należy do użytkownika.

## Sprawdzone punkty koordynatora

1. **Selektywna bramka**: zgodna z CLAUDE.md. `ci.yml` bez zmian, `thresholds` bez `break`, przepis w §6.7 zawęża do modułu, brak gonienia 100% (78% i 82% zaakceptowane z uzasadnieniem). Jedyny zgrzyt: skrypt bez `--mutate` (F1).
2. **Nowe asercje**: wyrocznie dla `isSafeNextPath` pochodzą z tabeli w `research.md` (Risk #5: niestringi, długie wartości, białe znaki, niepoprawne `%`); test długości nie przypina stałej 2048 (10 000 vs ~210 znaków), co jest dobrym testem właściwości. Asercje sparametryzowane pętlą, bez kopii. Test w `drill-configurations.test.ts` porównuje ze stałą `SAVE_DRILL_MESSAGES.validation`, nie z tekstem; jego wyrocznia nie jest jednak w tabeli researchu (F4). Brak testów lustrzanych.
3. **Decyzje „ignoruj”**: żaden zignorowany mutant w `isSafeNextPath` nie otwiera przekierowania. L32 (`startsWith("//")` → `endsWith`) i L47 (kontrola origin) przetrwały, bo wzajemnie się dublują; usunięcie obu łapie istniejący test `//example.com` (`email-auth.test.ts:57`) i `//evil.example` (`:104`), więc zachowanie dla użytkownika jest chronione. L29 `>=` (granica o jeden znak) poprawnie zignorowany jako szczegół implementacji. W walidacji (#6) granice pól są zabite; przetrwałe mutanty dotyczą wyłącznie wyboru komunikatu, przy czym jedno uzasadnienie jest nieprecyzyjne (F3).
4. **Konfiguracja**: `tap.nodeArgs` bez `--test` z uzasadnieniem w `_comment_tap`; `ignorePatterns` nie wyklucza `src/` ani `supabase/` (zgodnie z research pkt d); `.gitignore` +2 linie; `package.json` dwie zależności 10.0.0 i skrypt. Uwagi: brak domyślnego `mutate` (F1), sztywna lista `tap.testFiles` (F2). Kruchość zakresów linii opisana w `_comment` i §6.7.
5. **Dokumentacja**: §1–§3 test-planu bez zmian (diff tylko w §4, §5, §6.7); README jedna linia; sekcja „Research” i linia `test:mutation` identyczne w CLAUDE.md i AGENTS.md; `context/docs/README.md` i `stryker-js.md` mają library ID, zapytania, datę i źródło. Sekcja „Research” wykracza poza kontrakt planu (F6).

## Findings

### F1 — `npm run test:mutation` bez `--mutate` mutuje cały `src/`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: stryker.config.json:1 (brak klucza `mutate`); README.md:66; context/foundation/test-plan.md §6.7
- **Detail**: Konfiguracja nie ma `mutate`, więc goły `npm run test:mutation` używa domyślnego globu Strykera: dry run zgłasza 82 pliki i 5151 mutantów (komponenty React, strony, cały `src/lib`), uruchamianych tylko przez 3 pliki testowe. Wynik to długi przebieg z masą NoCoverage i mylącym wynikiem. README, CLAUDE.md, AGENTS.md i §6.7 przedstawiają `npm run test:mutation` jako punkt wejścia („uruchamia `stryker run` z konfiguracji”), a ostrzeżenie „narrow it to one module” nie mówi, jak to zrobić przez skrypt npm.
- **Fix A ⭐ Recommended**: Dodać w `stryker.config.json` domyślne `"mutate": ["src/lib/protected-routes.ts", "src/lib/email-auth.ts:25-53", "src/lib/services/drill-configurations.ts:53-117"]` (CLI `--mutate` nadal je nadpisuje).
  - Strength: Goły skrypt robi to, co opisuje dokumentacja: trzy moduły ryzyk, ~1 min; zgodne z „zawężone do modułu” z CLAUDE.md.
  - Tradeoff: Kruche zakresy linii trafiają też do konfiguracji (już opisane w `_comment`).
  - Confidence: HIGH — `mutate` w pliku i nadpisanie z CLI to udokumentowane zachowanie (`context/docs/stryker-js.md`, zapytanie 2).
  - Blind spot: Nie sprawdzono, czy zakres linii w tablicy `mutate` konfiguracji zachowuje się identycznie jak w CLI.
- **Fix B**: Zostawić konfigurację, a w README/CLAUDE.md/AGENTS.md/§6.7 pisać zawsze `npm run test:mutation -- --mutate "<plik>"` i ostrzec, że bez `--mutate` mutowany jest cały `src/`.
  - Strength: Brak drugiego miejsca z kruchymi zakresami.
  - Tradeoff: Pułapka zostaje; zależy od czytania dokumentacji.
  - Confidence: MED — dokumentacja już raz tego nie przekazała.
  - Blind spot: None significant.
- **Decision**: ACCEPTED — Fix A: domyślne `mutate` w stryker.config.json (trzy moduły z zakresami linii), `_comment`, README, CLAUDE.md, AGENTS.md i §6.7 zaktualizowane.

### F2 — Sztywna lista `tap.testFiles` daje fałszywe wyniki dla innych modułów

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: stryker.config.json:9-13
- **Detail**: `tap.testFiles` zawiera tylko trzy pliki testowe. Przepis w CLAUDE.md/README zachęca do `--mutate` na dowolnym module; np. `--mutate "src/lib/drill-timer.ts"` uruchomi się bez błędu, ale bez `drill-timer.test.ts`, więc mutanty będą NoCoverage albo przetrwają, choć test istnieje. §6.7 wspomina „dodaj plik testowy do `tap.testFiles`”, ale CLAUDE.md i README nie. Przy `perTest` dry run uruchamia wszystkie pliki raz, a potem dla mutanta tylko pliki pokrywające, więc szersza lista kosztuje ~2 s (`npm test` trwa ~2 s).
- **Fix**: Ustawić `tap.testFiles` na te same globy co `npm test` (`["src/lib/*.test.ts", "src/lib/services/*.test.ts"]`) i usunąć zdanie o ręcznym dopisywaniu z §6.7.
- **Decision**: ACCEPTED — `tap.testFiles` = globy jak w `npm test`; zdanie o ręcznym dopisywaniu usunięte z §6.7.

### F3 — Nieprecyzyjne uzasadnienie „równoważny” dla L113 `&&` → `||`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/mutation-testing-stryker/mutation-review.md (tabela walidacji, wiersz L113 `&&` → `||`)
- **Detail**: Uzasadnienie mówi, że mutant jest równoważny. Nie jest: dla `{ ...validRequest, repetitions: "0", extra: 1 }` oryginał zwraca komunikat ogólny, a mutant „Remove unknown fields”. To ten sam przypadek co sąsiedni mutant L113:26 `→ true` (nieznany klucz razem z innym błędem), który zignorowano, bo źródła nie rozstrzygają komunikatu. Decyzja „ignoruj” jest spójna, opis nie.
- **Fix**: Zmienić uzasadnienie na to samo co dla L113:26 (różnica tylko przy nieznanym kluczu i innym błędzie; źródła nie rozstrzygają komunikatu).
- **Decision**: ACCEPTED — uzasadnienie L113 `&&` → `||` w mutation-review.md zmienione na zgodne z L113:26.

### F4 — Wyrocznia testu „generic validation message” spoza tabeli researchu

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/drill-configurations.test.ts:170
- **Detail**: Kontrakt fazy 2: „wyrocznie wyłącznie z tabeli w `research.md`”. Tabela dla #6 obejmuje granice, nazwę, nieznane pola i brak obiektu, ale nie wybór komunikatu; research i §6.7 mówią „treść komunikatu → ignoruj”, a L104 (komunikat pola `randomStartEnabled`) zignorowano właśnie z tego powodu. L113 zabito, bo „Remove unknown fields” przy braku nieznanych pól kieruje klienta API do złej poprawki. To rozsądne rozróżnienie (komunikat fałszywy, a nie mniej szczegółowy), test nie przypina tekstu, ale źródło wyroczni nie jest zapisane.
- **Fix**: Dopisać w `mutation-review.md` przy L113 jedno zdanie o regule: komunikat, który opisuje nieistniejący błąd, szkodzi użytkownikowi; komunikat mniej szczegółowy nie (to odróżnia L113 od L104).
- **Decision**: ACCEPTED — reguła (komunikat fałszywy vs mniej szczegółowy) dopisana przy L113 w mutation-review.md.

### F5 — Niewidoczne NBSP w literałach testu białych znaków

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/email-auth.test.ts:83
- **Detail**: Tablica `["/dashboard ", " /dashboard", "/dashboard ", " /dashboard"]` wygląda jak dwie zduplikowane pary; trzeci i czwarty element zawierają U+00A0 (bajty `302 240`). Recenzent albo formatter może je „odduplikować” i usunąć przypadek NBSP, który uzasadnia zabicie mutanta `trim()`.
- **Fix**: Zapisać je jako `"/dashboard "` i `" /dashboard"`.
- **Decision**: ACCEPTED — NBSP zapisane jako ` ` w email-auth.test.ts:83.

### F6 — Sekcja „Research” w CLAUDE.md/AGENTS.md i `context/docs/README.md` poza kontraktem planu

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: CLAUDE.md:135-138; AGENTS.md:110-113; context/docs/README.md
- **Detail**: Kontrakt fazy 3: „jedna linia… bez innych zmian w tych plikach”. Commit 3b332d1 dodaje też sekcję „Research” (exa, find-docs, `context/docs/`, podsumowanie w `change.md` Notes) i `context/docs/README.md`. Treść jest identyczna w obu plikach i odpowiada temu, jak research faktycznie przebiegał (`context/docs/stryker-js.md`, Notes w `change.md`), więc zmiana jest nieszkodliwa, ale nie ma jej w planie.
- **Fix**: Dopisać w `plan.md` (faza 3) krótkie addendum o sekcji „Research” i `context/docs/README.md`.
- **Decision**: ACCEPTED — addendum w plan.md (faza 3) o sekcji „Research” i context/docs/README.md.
