# Przegląd mutantów — mutation-testing-stryker

Kryterium decyzji (CLAUDE.md, „Testowanie mutacyjne”): „czy ta zmiana zaszkodziłaby użytkownikowi lub firmie?”. `zabić` = dodana asercja z wartością z wyroczni (`research.md`, tabela „Wyrocznie”: PRD FR-017, test-plan Risk #5, standard URL względnego; PRD FR-001, roadmap S-10), nigdy z logiki modułu. `ignoruj` = uzasadnienie niżej. Nie gonimy 100%.

## Faza 1: pierwszy przebieg

- Wersje: `@stryker-mutator/core` 10.0.0, `@stryker-mutator/tap-runner` 10.0.0, Node v24.21.0, Windows.
- Komenda: `npx stryker run --mutate "src/lib/protected-routes.ts"`.
- Wynik: 36 mutantów, 36 zabitych, 0 przetrwałych, wynik 100% (raport: `reports/mutation/mutation.html`, poza gitem).
- Czas: dry run 2 s, całość 14 s (około 18 s ze startem `npx`).
- Natywny TS: instrumentowane pliki `.ts` uruchamia Node 24 przez type stripping, bez `tsx` i bez dodatkowych zależności.
- Konfiguracja: `tap.nodeArgs` to tylko `--test-reporter=tap` (bez `--test`). Klucz `_comment` wewnątrz `tap` odrzuca walidator ("must NOT have additional properties"), więc komentarze są na najwyższym poziomie (`_comment`, `_comment_tap`).

## Faza 2: przegląd

| Moduł | Zakres | Przed | Po | Przetrwałe po ponownym przebiegu |
|---|---|---|---|---|
| `src/lib/protected-routes.ts` | cały plik | 100% (36/36) | bez zmian | 0 |
| `src/lib/email-auth.ts` | `25-53` (`isSafeNextPath`, schemat) | 59,38% (23 przetrwałe + 3 NoCoverage) | 78,13% (po korekcie granicy 2048: 11 przetrwałych + 3 NoCoverage), wszystkie `ignoruj` | 0 oznaczonych `zabić` |
| `src/lib/services/drill-configurations.ts` | `53-117` (walidacja) | 81,13% (20 przetrwałych) | 82,08% (19 przetrwałych), wszystkie `ignoruj`; po szerszym `tap.testFiles` (F2) 83,02% (18 przetrwałych) | 0 oznaczonych `zabić` |

Czasy przebiegów: `email-auth` ok. 30 s, `drill-configurations` ok. 27 s (Windows, 7 procesów).

### protected-routes.ts

Brak przetrwałych mutantów; nic do przeglądu.

### isSafeNextPath (`email-auth.ts:25-53`)

| Mutant (linia) | Decyzja | Dlaczego |
|---|---|---|
| L27 `typeof value !== "string"` → `false`; `typeof… \|\| …` → `false`; `\|\|` → `&&` (3 warianty) | zabić | Wartość spoza stringa (`null`, `undefined`, `42`, `{}`, tablica) musi zostać odrzucona, a nie rzucić `TypeError` (funkcja przyjmuje `unknown`, kontrakt „odrzuca obcy adres”, test-plan Risk #5). Test: `safe next rejects anything that is not a string without throwing`. |
| L29 `value.length > 2048` → `false` | zabić | Bez limitu długości `next` o dowolnej długości trafia do cookie/URL (test-plan Risk #5). Asercja właściwości, bez przypinania stałej: `next` z 10 000 znaków jest odrzucany, a zwykła ścieżka z zapytaniem ~200 znaków przyjmowana. Test: `rejects a very long path and accepts an ordinary one with a medium query`. |
| L29 `value.length >= 2048` | ignoruj | Kosmetyczny: PRD i test-plan nie podają liczby 2048 (to stała implementacji); granica o jeden znak nie szkodzi użytkownikowi, a test przypinający stałą byłby testem vibe (CLAUDE.md). |
| L30 `value !== value.trim()` → `false` / `value.trim()` → `value` (oraz warianty L27 `\|\|` → `&&` zależne od tej gałęzi) | zabić | Białe znaki na brzegach (`"/dashboard "`, NBSP) muszą być odrzucone; parser URL po cichu je obcina lub koduje, więc bez tej gałęzi do przekierowania trafiłby nieznormalizowany `next`. Test: `rejects whitespace at either edge`. |
| L35 regex `(?![0-9a-f]{2})` → `(?![0-9a-f])` | zabić | `%1`, `%1z` to niepoprawne ucieczki (research: „niepoprawne `%`”); mogą zepsuć dekodowanie `decodeURIComponent` dalej. Test: `rejects an incomplete or non-hex percent escape`. |
| L35 regex → `(?![^0-9a-f]{2})` | zabić | Ten mutant odrzucałby poprawne ucieczki (`%C3%A9`, `%20`); poprawne zakodowane ścieżki lokalne muszą przejść. Test: `…accepts a valid one`. |
| L28 `value.length === 0` → `false` | ignoruj | Równoważny: pusty string odrzuca i tak `!value.startsWith("/")`; wynik funkcji nie zmienia się dla żadnego wejścia. |
| L32 `startsWith("//")` → `endsWith("//")` | ignoruj | Nieszkodliwy, ale **nie równoważny** (korekta po przeglądzie ręcznym 2026-10-12; wcześniejsze „fuzz: brak różnic” było błędne). Mutant odrzuca poprawne lokalne ścieżki zakończone na `//` (np. `/timers//`, `/a?x=//`), więc taki użytkownik trafia na domyślne `/timers` zamiast do celu; aplikacja nie tworzy takich adresów. Obcy `//host` przechodzi przez ten strażnik, ale odrzuca go końcowa kontrola origin (L47). Asercja na `/a//` przypinałaby szczegół implementacji bez wartości dla użytkownika. |
| L47 `return destination.origin === … && username === "" && password === ""` (7 mutantów: `true`, `\|\|`, części warunku) | ignoruj | Warstwa defense-in-depth: po wcześniejszych strażnikach (zaczyna się od `/`, nie `//`, bez `\`, bez znaków sterujących) parser URL nie zmieni origin ani nie doda poświadczeń dla ścieżki bezwzględnej. Fuzz (400 000 wejść): wynik funkcji z tą kontrolą i bez niej identyczny, 0 różnic. Nie istnieje wejście, które zabije mutanta. |

**L32 i L47 są nawzajem nadmiarowe.** Każdego z nich da się zignorować tylko dlatego, że drugi zostaje: Stryker mutuje jedną rzecz naraz, więc nie zgłosi usunięcia jednej warstwy. Usunięcie obu łapią testy odrzucające `//host` (`safe next accepts local paths and rejects absolute, scheme-relative, …` w `email-auth.test.ts` oraz `redirects.test.mjs`). Przy refaktorze `isSafeNextPath` zachować co najmniej jedną z tych warstw i uruchomić te testy.
| L40 `?? ""` → `"Stryker was here!"` (NoCoverage) | ignoruj | `split(...)[0]` zawsze istnieje dla stringa; gałąź nieosiągalna. |
| L48–L49 `catch { return false }` (NoCoverage ×2) | ignoruj | `new URL("/…", base)` po wcześniejszych strażnikach nie rzuca; gałąź nieosiągalna (fuzz jak wyżej). |
| L53 komunikat `"Enter a local path"` → `""` | ignoruj | Treść komunikatu; plan nie przypina komunikatów. |

### Walidacja w `drill-configurations.ts:53-117`

Granice pól (0/1/600 s, 1/100 powtórzeń, nazwa 200 znaków) leżą w `drill-timer.ts` i `normalizeDrillName`; mutanty tych gałęzi były już zabite — żadne granice nie przetrwały.

| Mutant (linia) | Decyzja | Dlaczego |
|---|---|---|
| L113 `unknownFields && Object.keys(fieldErrors).length === 0` → `true` | zabić | Przy zwykłej błędnej wartości (bez nieznanych kluczy) klient API dostałby komunikat „Remove unknown fields”, co wprowadza w błąd (komunikat opisujący nieistniejący błąd szkodzi użytkownikowi; komunikat mniej szczegółowy nie, i to odróżnia ten mutant od L104 i L113:26, które zignorowano). Test: `invalid values without unknown keys get the generic validation message…` (porównanie ze stałą `SAVE_DRILL_MESSAGES.validation`, nie z tekstem). |
| L113 `&&` → `\|\|`; L113:26 `length === 0` → `true` | ignoruj | Oba mutanty (`&&` → `\|\|` oraz `→ true`) różnią się od oryginału tylko wtedy, gdy nieznany klucz występuje razem z innym błędem (np. `repetitions: "0"` + `extra: 1`: oryginał daje komunikat ogólny, mutant „Remove unknown fields”), gdy nieznany klucz występuje razem z innym błędem; źródła (PRD, roadmapa) nie rozstrzygają, który komunikat jest właściwy, oba opisują prawdziwy błąd; kolejność byłaby przypięciem implementacji. |
| L86:27, L86:45, L86:80 (`unknownFields` → `true`, `some` → `every`, `issue.code === … → true`) | ignoruj | Zmieniają `unknownFields` tylko, gdy `fieldErrors` jest niepuste (każdy błąd kształtu daje wpis w `fieldErrors`), a wtedy L113 i tak zwraca komunikat ogólny; wynik funkcji identyczny. |
| L97 `record.randomStartEnabled === true` → `true` | zabić (zabity przez `drill-update.test.ts` po F2; nowej asercji nie dodajemy) | **Szkodliwy, nie równoważny** (korekta po przeglądzie ręcznym 2026-10-12). Przy poprawnym zapisie z `randomStartEnabled: false` mutant zapisałby konfigurację z **włączonym** losowym startem, wbrew wyborowi użytkownika (PRD FR-001). To, że zabija go test innego pliku, dowodzi, że nie jest równoważny. Zabija go `drill-update.test.ts`, dlatego `tap.testFiles` musi obejmować wszystkie pliki testowe (F2). |
| L99 `!config.valid` → `true` | ignoruj | `Object.assign(fieldErrors, undefined)` dla poprawnej konfiguracji to no-op. Równoważny. |
| L104 `key === "randomStartEnabled"` → `false`; `"randomStartEnabled"` → `""` | ignoruj | Zmienia wyłącznie tekst błędu pola `randomStartEnabled` (ogólny zamiast „Choose whether the start is random.”); treść komunikatu, nie przypinamy. Pole nadal jest oznaczone jako błędne (test `wrong types…` to sprawdza). |
| L105 (3 mutanty), L57–L58 `isFieldKey` (6 mutantów) | ignoruj | Gałąź nieosiągalna z efektem: każde pole tekstowe z nietekstową wartością ma już błąd z `normalizeDrillName`/`parseDrillConfig` (`text()` zamienia je na `""`), więc `fieldErrors[key] === undefined` jest zawsze fałszem dla kluczy pól, a błąd ścieżki pustej (nieznane klucze) nie jest kluczem pola. Zmiana mogłaby tylko podmienić tekst komunikatu. Obserwacja do rozważenia przy refaktorze: ta pętla jest w praktyce martwa (nie błąd). |
| L76 `""` → `"Stryker was here!"` | ignoruj | `text()` dla nie-stringa: i `""`, i podstawiony string dają `valid: false`, ponieważ `requestShape` wykrywa nietekstowe pole; zmienia się tylko tekst błędu. |
