# Test rollout Phase 1 — granice dostępu i walidacji: brief planu

> Full plan: `context/changes/testing-access-boundaries/plan.md`
> Research: `context/changes/testing-access-boundaries/research.md`

## What & Why

Ryzyka #1 (cudzy timer), #2 (gość na trasach chronionych), #5 (przekierowania i obcy `next`) i #6 (walidacja API) z `test-plan.md §2` mają dostać czytelny, niezależny dowód HTTP w runtime Cloudflare z lokalnym Supabase. Dziś ten dowód jest rozproszony w jednym sekwencyjnym `scripts/smoke.mjs`, który nie pokazuje szczegółów błędów i ma luki: POST/HEAD gościa, sfałszowane ciasteczko, warianty ścieżek, obcy `next`, linki SSR i część klas walidacji.

## Starting Point

Lokalny smoke (40 kroków) loguje dwa konta przez Mailpit i dowodzi już większości #1/#2 przeciw `astro preview` w jobie CI `smoke`. Tryb `remote` smoke działa po deployu. Brak jednak zestawu z niezależnymi przypadkami i brak mechanizmu, który zauważy nową stronę bez ochrony.

## Desired End State

`npm run test:integration` (`node:test` + `fetch`, `tests/integration/`) dowodzi #1/#2/#5/#6 w czterech plikach z niezależnymi przypadkami. Test jednostkowy inwentarza tras nie przepuszcza nieklasyfikowanej strony. Smoke zostaje przy przepływie logowania i trybie `remote`. CI uruchamia smoke i zestaw jako osobne kroki joba `smoke`, a `test-plan.md §6.2` mówi, jak dodać kolejny taki test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Kształt zestawu | Wszystkie kroki HTTP #1/#2/#5/#6 przechodzą ze smoke do `node:test`, z tabelą „krok smoke → nowy test” | Niezależne przypadki i czytelna diagnostyka bez utraty żadnej asercji | Research (Decisions 1) |
| Co zostaje w smoke | Przepływ logowania przez Mailpit (L1, L5–L10, L20, L29–L40) i cały tryb `remote` | Bramka `deploy` nie może osłabnąć | Research (Decisions 1) |
| Sesje | Magic link z Mailpit przez wspólny `scripts/lib/app-client.mjs`; konta A, B, V, L | Bez klucza service-role; ok. 6 logowań na przebieg przy limicie 30 na 5 min | Research (Decisions 2) |
| Gość: POST/HEAD na stronie | Tylko 302 na `/auth/signin?next=<ścieżka>`, puste ciało, `private, no-store` | Jedna deterministyczna wyrocznia zamiast „przekierowanie lub odmowa” | Research (Decisions 4) |
| Warianty ścieżek | 302 na `/auth/signin` bez treści, bez asercji dokładnego `next` | Wyrocznią jest brak treści, nie normalizacja ścieżki | Plan |
| Cel po edycji → `/{id}` | Osobna zmiana produktu `edit-redirect-to-saved-timer` (propozycja w planie); zestaw sprawdza tylko, że `/{id}` po PUT pokazuje nowe wartości | Faza testów nie ukrywa zmiany zachowania ani bramki wizualnej UI | Plan (wybór autora) |
| Inwentarz tras | Test jednostkowy z jawnymi klasami tras nad `src/pages/**` | Najtańszy sygnał dla „lista chronionych tras jest kompletna” | Research |
| Język i lint zestawu | `.mjs` jak smoke, `tests/**/*.mjs` w `scriptsConfig` ESLint | Wspólny moduł ze smoke bez typowanego lintu | Plan |

## Scope

**In scope:**
- wspólny klient HTTP i Mailpit;
- 4 pliki zestawu i test inwentarza tras;
- przypadki z „Mapy pokrycia”: POST/HEAD, warianty ścieżek, sfałszowane ciasteczko, obcy `next` u 6 konsumentów, linki SSR, klasy #6 dla POST i PUT z dowodem braku wiersza;
- odchudzenie lokalnego smoke, kroki CI, cookbook §6.2, §4, §5, README, CLAUDE.md i AGENTS.md.

**Out of scope:**
- mocki klienta bazy, nowe zależności, service-role;
- kliknięcia w przeglądarce (Faza 3) i strzałki steppera (Faza 2);
- zmiana celu po edycji (osobna zmiana);
- tryb `remote` i job `deploy`.

## Architecture / Approach

Testy wysyłają `fetch` z `redirect: "manual"` do działającego `astro preview` (workerd), który rozmawia z lokalnym Supabase. Sesje powstają przez POST `/api/auth/signin`, odczyt linku z Mailpit i POST `/api/auth/callback`. Każdy klient ma własny słoik ciasteczek, każdy plik testów to osobny proces, a każdy test tworzy własne timery z unikalnymi nazwami. Przeniesione asercje istnieją równolegle w smoke aż do Fazy 5.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Wspólny klient i szkielet | `scripts/lib/app-client.mjs`, smoke na nim, `npm run test:integration`, lint | Refaktor smoke zmieni jego zachowanie |
| 2. Gość, obcy `next`, inwentarz | `guest-access`, `redirects`, `route-inventory.test.ts` | Konsument ignorujący `next` przejdzie test (stąd kontrole pozytywne) |
| 3. Własność A/B i linki SSR | `ownership.test.mjs` (L11–L15, L19, L21–L27, L36 + sfałszowane ciasteczko) | Utrata którejś asercji „bajt w bajt” |
| 4. Walidacja i limit 50 | `api-validation.test.mjs` (konta V i L) | Budżet logowań przy kolejnych przebiegach lokalnych |
| 5. Odchudzenie smoke i CI | Lokalny smoke tylko dla logowania, osobny krok zestawu w jobie `smoke` | Osłabienie trybu `remote` albo preview nieżyjący między krokami |
| 6. Cookbook i docs | §6.2, §4, §5, §6.6, README, CLAUDE.md, AGENTS.md | Cookbook niewystarczający dla nowego testu |

**Prerequisites:** Docker i `npx supabase start`, `npm run build && npm run preview` (port 4321), Mailpit na 55324. Gałąź `feature/m3l2`.
**Estimated effort:** ok. 3–4 sesje w 6 fazach (Fazy 3 i 4 są największe).

## Open Risks & Assumptions

- Zakładamy, że proces preview uruchomiony w tle w jednym kroku GitHub Actions żyje w kolejnych krokach joba. Jeśli nie, plan przewiduje powrót do jednego kroku z `set -e`.
- Wiele lokalnych przebiegów w ciągu 5 min (ok. 5) albo kilka worktree na jednym lokalnym Supabase może trafić w limit auth (ok. 6 logowań na przebieg zestawu i smoke; CI startuje od zera). Błąd logowania w zestawie i smoke ma czytelny komunikat „prawdopodobnie limit auth, odczekaj 5 minut i uruchom ponownie”, a cookbook §6.2 wymaga ponownego używania kont pliku (A, B, V, L) zamiast zakładania nowych.
- Zmiana celu po edycji jest odłożona. Do czasu osobnej zmiany edycja zostaje na formularzu, a zestaw tego nie utrwala.

## Success Criteria (Summary)

- Każda asercja lokalnego smoke dla #1/#2/#5/#6 ma nazwany test w `tests/integration/`, a luki z „Mapy pokrycia” mają przypadki.
- Nowa nieklasyfikowana strona albo zdjęcie ochrony z `/create` wywraca `npm test` i zestaw integracyjny.
- CI zielone z osobnymi krokami smoke i zestawu; tryb `remote` i bramka `deploy` bez zmian.
