<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Edit Saved Drill (S-12) Implementation Plan

- **Plan**: context/changes/edit-saved-drill/plan.md
- **Mode**: Deep
- **Date**: 2026-10-07
- **Verdict**: REVISE (drobne, ukierunkowane poprawki; podejście poprawne)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (drill-configurations.ts, protected-routes.ts, drill-create-controller.ts, useDrillCreate.ts, DrillCreateForm.tsx, SavedDrillDetails.tsx, saved-drill-summary.ts, eslint.config.js, drill_configurations.test.sql), 8/8 symbols ✓ (SAVED_DRILL_COLUMNS, classifyStoreError, resolveSavedDrillPage, isDrillId/normalizeDrillId, OPEN_DRILL_MESSAGES, STATUS_BY_CODE, SAVE_DRILL_MESSAGES, plan(80)), brief↔plan ✓, Progress↔Phase ✓ (3 fazy, 7/10/5 kroków zgodnych z kryteriami).

## Zweryfikowane twierdzenia (bez ustaleń)

- Migracja `20261007120000`: polityka `drill_configurations_update_own` (USING + WITH CHECK `auth.uid() = user_id`), grant kolumnowy UPDATE tylko na 6 kolumnach (bez `user_id`, `id`, `created_at`, `updated_at`), trigger `set_updated_at`, CHECK-i nazwy (1–200 code points, trim, NFC, brak znaków kontrolnych), unikalny indeks `(user_id, lower(name))`, limit 50 tylko BEFORE INSERT. Brak potrzeby migracji — potwierdzone.
- `requestShape` to `z.strictObject` → `id`/`user_id`/`created_at` w body dają 400 (`unknownFields`); podmiana właściciela niemożliwa ani z API, ani z poziomu grantów.
- `@supabase/postgrest-js` 2.116: `maybeSingle()` na PATCH ustawia tylko `isMaybeSingle`; 0 wierszy → `data: null`, `error: null` (dist/index.cjs:495–512). Plan słusznie mapuje `null` → 404 `not_found`; wyciek "błąd vs 0 wierszy" nie występuje.
- Kolizja nazwy przy edycji: indeks unikalny jest atomowy (brak wyścigu), zmiana samej wielkości liter własnego wiersza nie koliduje z samym sobą; `classifyStoreError` już mapuje 23505 + nazwę indeksu.
- 404 bez wycieku: kolejność 401 → 503 → `!isDrillId` → 404 bez dotykania store'u; obcy i nieistniejący wiersz dają identyczne `null`. Strona `/{x}/edit` przez `resolveSavedDrillPage` (non-UUID przed `sign_in`, więc gość na `/not-a-uuid/edit` dostaje 404, nie redirect).
- `isSavedDrillPath`/`routerPath` (dekodowanie, zwijanie `//`) przeniosą się na `/{uuid}/edit`; `[id].astro` i `[id]/edit.astro` nie kolidują w routingu.

## Findings

### F1 — Glob eslint `src/pages/[id].astro` nie obejmuje pliku; planowany `[id]/edit.astro` powtórzy błąd

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — #6 Lint scope (i istniejący wpis S-11 w `eslint.config.js:108`)
- **Detail**: W minimatch (`@eslint/config-array`, opcje `{dot:true}`) `[id]` to klasa znaków `i|d`, nie literał. Zweryfikowane: `minimatch("src/pages/[id].astro", "src/pages/[id].astro") === false`, a dopasowuje się `src/pages/i.astro`. Test przez `eslint --stdin` w checkoucie `main` z `bg-red-500`: `create.astro` → błąd `timer-ui/contract`, `[id].astro` → 0 błędów. Czyli od S-11 `/{id}` nie jest objęte kontraktem UI mimo zapisu w AGENTS.md, a literał `src/pages/[id]/edit.astro` z planu też nie zadziała. Escapowanie backslashem nie działa na Windows (sprawdzone); działa forma klasy znaków.
- **Fix**: W `eslint.config.js` użyć `src/pages/[[]id[]].astro` oraz `src/pages/[[]id[]]/edit.astro` (zweryfikowane: dopasowuje literalny plik, nie `i.astro`, na Windows i Linux); naprawić też istniejący wpis `[id].astro` i usunąć ewentualne naruszenia, które się ujawnią; dodać trwały dowód (np. test w `timer-ui-contract.test.mjs` lub krok CI `eslint --stdin --stdin-filename "src/pages/[id]/edit.astro"` z literalnym kolorem, oczekiwany exit ≠ 0) zamiast jednorazowego "temporary literal color".
- **Decision**: ACCEPTED (applied to plan.md and plan-brief.md)

### F2 — Komunikat `Saved "<name>".` (i alert błędu) zostaje po zmianie parametrów w trybie edycji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — #2 Edit controller (`keepAfterSave`), #4 DrillEditApp
- **Detail**: Kontroler resetuje `status`/`savedName`/`failure` wyłącznie w `setName`; wartości parametrów żyją w stanie `DrillCreateApp`/`DrillEditApp` i kontroler o ich zmianie nie wie. W `/create` to niewidoczne (nazwa czyszczona po zapisie), ale przy `keepAfterSave` formularz zostaje wypełniony — użytkownik zmienia np. powtórzenia i dalej widzi `Saved "X".`, sugerujące zapisanie niezapisanej zmiany. Plan definiuje tylko "next `setName` returns to idle".
- **Fix**: Dodać do kontrolera np. `markEdited()` (saved/error → idle, poza `saving`) wołane z `onValuesChange` w `DrillEditApp` (bezpieczne także dla create), z testem w `drill-create-controller.test.ts`; dopisać kryterium w Fazie 2.
- **Decision**: ACCEPTED (applied to plan.md and plan-brief.md)

### F3 — Fallback statusu w porcie klienta mapuje 409 na `limit_reached` także dla PUT

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — #2 `putSaveDrill`
- **Detail**: `STATUS_CODES` w `drill-create-controller.ts` ma `409: "limit_reached"`. Plan dodaje tylko `404 → not_found`. Przy nieczytelnym body odpowiedzi 409 z PUT użytkownik zobaczy „You can save up to 50 timers. Delete one to save another.”, choć na edycji 409 oznacza wyłącznie duplikat nazwy.
- **Fix**: Wspólny helper żądania przyjmuje mapę fallbacków per port; dla PUT `409 → duplicate_name`, `404 → not_found`; test na nieczytelne body.
- **Decision**: ACCEPTED (applied to plan.md and plan-brief.md)

### F4 — Ochrona CSRF/Origin dla PUT nie jest nazwana w planie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — #3/#4 (handler, route)
- **Detail**: Ochrona faktycznie istnieje, ale jest niejawna: PUT i `Content-Type: application/json` wymuszają preflight CORS (brak nagłówków CORS → przeglądarka nie wyśle), handler odrzuca nie-JSON 415 przed odczytem body i store'em, Astro `checkOrigin` obejmuje typy formularzowe, ciasteczka `@supabase/ssr` są SameSite=Lax. Przyszła zmiana (np. akceptacja `text/plain` lub dodanie CORS) po cichu otworzyłaby CSRF.
- **Fix**: Zapisać to założenie w Current State/Key Discoveries i dodać do macierzy testów jawne przypadki `PUT` z `text/plain` i `application/x-www-form-urlencoded` → 415 bez wywołania store'u.
- **Decision**: ACCEPTED (applied to plan.md and plan-brief.md)

### F5 — Test round-trip m:ss nie zmieści się w `npm test`, jeśli konwersja zostanie w `DrillEditApp`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — #4 DrillEditApp; Testing Strategy (m:ss prefill round-trip)
- **Detail**: `npm test` uruchamia tylko `src/lib/*.test.ts` i `src/lib/services/*.test.ts`; komponent w `src/components/timer/` nie jest testowalny tą komendą. Dodatkowo formatter to `formatPhaseTime` z `src/lib/drill-phase-sections.ts` (już eksportowany), a nie z `saved-drill-summary.ts`, jak sugeruje plan.
- **Fix**: Dodać w `src/lib` (np. `saved-drill-summary.ts`) `configInputFromSavedDrill(configuration): DrillConfigInput` oparty na `formatPhaseTime`, użyć go w `DrillEditApp` i przetestować round-trip z `parseDrillConfig` (w tym 0:00, 10:00, random start).
- **Decision**: ACCEPTED (applied to plan.md and plan-brief.md)
