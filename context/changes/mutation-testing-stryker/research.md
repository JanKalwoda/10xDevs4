---
change_id: mutation-testing-stryker
researched: 2026-10-11
branch: feature/mutation-testing-stryker
status: complete
---

# Research: StrykerJS jako selektywna bramka dla `npm test`

## Pytanie
Czy `@stryker-mutator/tap-runner` uruchomi mutacje na plikach `.ts` wykonywanych przez `node:test` z natywnym type strippingiem Node 24.21.0 (bez tsx), z jaką konfiguracją, oraz jakie wyrocznie (źródła, nie implementacja) obowiązują dla trzech modułów pod ryzykami #2, #5, #6 z `context/foundation/test-plan.md` §2.

## Wynik spike'a (sandbox poza repo, nic nie commitowane)
Spike: kopia `src/lib` + `tsconfig.json` w katalogu scratchpad, `@stryker-mutator/core@10.0.0`, `@stryker-mutator/tap-runner@10.0.0` (npm view 2026-10-11; peer `core` 10.0.0), `typescript@6`, Node v24.21.0, Windows.

1. **Tap runner + natywny TS działa bez tsx.** Instrumentacja `.ts` przez Stryker daje kod, który Node uruchamia przez type stripping; wszystkie mutanty były wykonywalne (brak `errors`).
2. **Domyślna konfiguracja z `--test` NIE działa.** Z `nodeArgs: ["--test"]` runner Node uruchamia plik testowy w podprocesie, a hook Strykera (`-r hook.cjs`, `tap-runner/dist/src/setup/hook.cjs`) zostaje w procesie nadrzędnym. Efekt zaobserwowany w tym spike'u: dry run „succeeded”, 36/36 mutantów `NoCoverage`, 0% wyniku. Poprawne: **`"nodeArgs": ["--test-reporter=tap"]`** (plik testowy uruchamiany bezpośrednio przez `node`, bez `--test`, wynik TAP na stdout; plik w `tap-test-runner.js` `runFile`/`buildArguments`).
3. Z poprawną konfiguracją: `protected-routes.ts` + `protected-routes.test.ts` → 36 mutantów, 36 zabitych, 10 s. `drill-configurations.ts` + `drill-configurations.test.ts` → 269 zabitych, 1 timeout, 56 przetrwało, 271 NoCoverage, wynik 45,23% (82,82% covered), 1 min 13 s przy 7 procesach.
4. **Granularność pokrycia = plik testowy** (`perTest` mapuje na `testFile`; log: „Ran 1 tests”), więc każdy mutant uruchamia cały plik. Brak wskazania pojedynczego `it`.
5. **Sandbox kopiuje pliki repo, a testy czytają pliki z dysku.** `email-auth.test.ts` czyta `src/pages/auth/callback.astro` i `supabase/config.toml`; `drill-configurations.test.ts` czyta migracje (`service constants match the CHECKs…`). W spike'u po skopiowaniu części plików dry run nadal padał dla `email-auth` (jeden test „callback GET…”, przyczyna: niepełna kopia repo w sandboxie spike'u, niezweryfikowane co brakuje). W prawdziwym repo sandbox kopiuje cały drzewo nieignorowane, więc to do potwierdzenia w fazie 1. Nie wykluczać też plików czytanych przez testy w `ignorePatterns`.
6. **`typescript` jest wymagany** przez `ts-config-preprocessor` Strykera, gdy w katalogu jest `tsconfig.json` (błąd `ERR_MODULE_NOT_FOUND` bez niego); repo ma `typescript ^6.0.3`, więc OK.
7. Lukę `NoCoverage` w `drill-configurations.ts` tłumaczy zakres testów: moduł ma 579 linii, a `drill-configurations.test.ts` pokrywa walidację, nie handlery/magazyn; pozostałe obsługują `drill-update.test.ts`, `drill-delete.test.ts`, `saved-drills-read.test.ts`. Dla ryzyka #6 mutować tylko walidację (`-m "src/lib/services/drill-configurations.ts:53-117"`, składnia zakresu linii Strykera do potwierdzenia przez `ctx7` w fazie 1), nie cały plik.

Wniosek: tap runner jest wystarczający; **fallback `command` runner nie jest potrzebny**. Brak nowych zależności poza dwiema zatwierdzonymi.

## Wyrocznie (źródło → oczekiwane zachowanie)
| Moduł | Ryzyko | Źródło wyroczni | Co test musi udowodnić |
|---|---|---|---|
| `src/lib/protected-routes.ts` | #2 | PRD §Access Control; FR-011; komentarze kontraktu S-11/S-12 w module opisują zachowanie, nie służą za wyrocznię | `/dashboard`, `/create`, `/timers` i ich podścieżki oraz `/{uuid}` i `/{uuid}/edit` wymagają sesji; `/created` i `/{nie-uuid}/edit` nie; warianty zapisu (`//create`, `/%63reate`, końcowy `/`) nie omijają ochrony; odpowiedź gościa `302` + `Cache-Control: private, no-store` |
| `isSafeNextPath` (`src/lib/email-auth.ts`) | #5 | PRD FR-017 (domyślnie `/timers`), test-plan Risk #5 („obcy adres w parametrze powrotu jest odrzucany”); standard: URL względny tylko do tego samego originu | odrzuca `//host`, `/\host`, `https://…`, `javascript:`, znaki sterujące, `%2f`/`%5c` w ścieżce, niepoprawne `%`, bardzo długie wartości (limit długości; konkretna liczba 2048 to stała implementacji, nie wyrocznia), białe znaki na brzegach; akceptuje lokalne ścieżki z `?`/`#` i zwykłe zapytania średniej długości |
| walidacja w `src/lib/services/drill-configurations.ts` | #6 | PRD FR-001 (przygotowanie/odpoczynek 0–600 s, ćwiczenie 1–600 s, powtórzenia 1–100), roadmap S-10 (nazwa ≤ 200 znaków, ≤ 50 konfiguracji); migracja CHECK jako źródło domenowe | granice (min−1, min, max, max+1) każdego pola, pusta/za długa/ze znakami sterującymi nazwa, nieznane pola, brak obiektu, stała `MAX_SAVED_DRILLS` = 50 |

Przegląd mutantów: „czy ta zmiana zaszkodziłaby użytkownikowi/firmie?” — tak → asercja z wartością z powyższej tabeli (nie z kodu); nie (równoważna, kosmetyczna, treść komunikatu) → ignoruj z jednozdaniowym uzasadnieniem w `plan.md`/§6. Nie gonić 100%.

## Ryzyka i luki
- Nierozstrzygnięte: dokładny powód porażki dry runu `email-auth` w spike'u (patrz pkt 5) — faza 1 sprawdza w prawdziwym repo.
- `ignorePatterns` trzeba dobrać tak, by sandbox nie kopiował `context/`, `dist`, `.wrangler`, `reports`, ale zachował pliki czytane przez testy (`supabase/`, `src/pages/auth/`).
- Czas: ~1 min dla szerokiego zakresu; zawężenie do zakresu linii skraca.
- `.gitignore` zasila też `includeIgnoreFile` w `eslint.config.js` (linia 83), więc wpis `.stryker-tmp/` i `reports/` w `.gitignore` wystarcza dla ESLint; dodatkowy `globalIgnores` zbędny (do potwierdzenia lintem).
- Biblioteczna dokumentacja przez `npx ctx7@latest` nie była pobrana w tej sesji (spike oparty na kodzie zainstalowanego pakietu); faza 1 ma ją pobrać dla składni `--mutate` z zakresem linii i `ignorePatterns`.
- Limit auth 30/5 min i rebuild preview nie dotyczą warstwy jednostkowej — stąd „When NOT to use” dla integracji HTTP.

## Uzupełnienie 2026-10-11: odpowiedzi ze źródeł (a–d)

Źródła: dokumentacja Context7 `/stryker-mutator/stryker-js` (docs/configuration.md, docs/config-file.md), strona `https://stryker-mutator.io/docs/stryker-js/tap-runner/` (exa), `https://github.com/stryker-mutator/stryker-js/issues/5421` (exa) oraz drugi spike (ten sam sandbox poza repo).

**(a) Zakres linii.** Potwierdzone: zakres dopisuje się do ścieżki, `plik:start[:kol]-koniec[:kol]`, np. `src/app.js:1-11`, `src/app.js:5:4-6:4`; zakresu nie wolno łączyć z globem w jednym wpisie (docs/configuration.md, opcja `mutate`). Mutacji po nazwie funkcji w tej dokumentacji nie ma (sprawdzone: opis `mutate` i przykłady zakresów) → **zostajemy przy zakresie linii**; jego kruchość (przesunięcie po edycji pliku) trzeba opisać w konfiguracji i §6. Drugi spike: `--mutate "src/lib/email-auth.ts:25-53"` (`isSafeNextPath`, `email-auth.ts:25`) → 38 zabitych, 23 przetrwałe, 3 NoCoverage, wynik 59,38%; to realny materiał do przeglądu w fazie 2.

**(b) Komentarze w `stryker.config.json`.** Dokumentacja podaje konwencję właściwości `_comment` (`"_comment": "..."` w JSON; docs/config-file.md); konfigurację można też napisać w pliku JS (eksportującym obiekt). Wybór: JSON z `$schema` i `_comment` (klucz z `_comment` w nazwie nie jest opcją); jeśli walidacja schematu odrzuci nieznany klucz, przejść na `stryker.config.mjs`. Do potwierdzenia w fazie 1 uruchomieniem.

**(c) Tap runner.** Strona tap-runner: runner uruchamia pliki z `tap.testFiles` przez `node` z `tap.nodeArgs` jako dodatkowymi argumentami; domyślnie dopisuje `--test-reporter=tap`, `-r <hook>` i plik testowy na końcu (placeholdery `{{hookFile}}`, `{{testFile}}`); `testFiles` domyślnie szuka plików `*.test.*`/`*.spec.*`. Dokumentacja przykładowo podaje `--import tsx` dla TS, ale nie wymaga tsx, gdy Node uruchamia `.ts` natywnie (potwierdza to spike). Issue #5421 (open w momencie sprawdzenia) opisuje ten sam objaw „wszystkie mutanty not covered” dla `node --test`. **Potwierdzenie spike'a:** plik testowy ma być uruchamiany bezpośrednio, a nie przez `--test`; poprawka planu: `nodeArgs` może zawierać wyłącznie `--test-reporter=tap` (jawnie, dla czytelności) i nie może zawierać `--test`. Ograniczenie: granularność = plik testowy (issue #5421 prosi o perTest na poziomie testu; brak).

**(d) Przyczyna padnięcia dry runu `email-auth`.** Znaleziona: test czyta z dysku `src/pages/api/auth/callback.ts` (`email-auth.test.ts:260`), `src/pages/auth/callback.astro` (`:250`), `supabase/config.toml` i `supabase/templates/magic_link.html` (`:308-309`). W pierwszym spike'u brakowało `src/pages/api/auth/callback.ts` w kopii. Po dokopiowaniu: `node --test` 0 porażek i dry run Strykera zakończony sukcesem. Wniosek: w prawdziwym repo sandbox ma te pliki, o ile `ignorePatterns` ich nie wyklucza — **`ignorePatterns` nie może obejmować `supabase/`, `src/pages/` ani `src/`**; ryzyko zamknięte, w fazie 1 tylko potwierdzić w repo.

### Skutki dla planu
- Faza 1: `_comment` zamiast komentarzy, `$schema`; `nodeArgs` tylko `--test-reporter=tap`; `ignorePatterns` jak w planie (bez `src/`, `supabase/`).
- Faza 2: `email-auth.ts` zakres `25-53` (przeliczyć po zmianach pliku) daje 23 przetrwałe do przeglądu.
- Brak zmian w liczbie faz.
