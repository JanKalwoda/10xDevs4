---
date: 2026-10-11T19:42:32+02:00
researcher: Claude (Opus 5.5) dla Jan Kalwoda
git_commit: 5cb72963b06f44d2097ce41d79489c40de9b47fb
branch: feature/m3l2
repository: 10xDevs4
topic: "Rollout Phase 1 test-plan.md — granice dostępu, własności, przekierowań i walidacji API (ryzyka #1, #2, #5, #6)"
tags: [research, testing, access-control, rls, middleware, redirects, validation, smoke, integration]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Rozstrzygnięte Open Questions 1–4 z autorem (sekcja Decisions); pytanie 1 i 3 zastępują rekomendacje badania"
---

# Research: Rollout Phase 1 — granice dostępu i walidacji

**Date**: 2026-10-11T19:42:32+02:00
**Researcher**: Claude (Opus 5.5) dla Jan Kalwoda
**Git Commit**: 5cb72963b06f44d2097ce41d79489c40de9b47fb (kod produkcyjny niezmieniony względem tego commitu; jedyny niezatwierdzony stan to ten folder zmiany)
**Branch**: feature/m3l2
**Repository**: 10xDevs4

## Research Question

Zakotwiczyć w kodzie ryzyka #1, #2, #5, #6 z `context/foundation/test-plan.md §2`: znaleźć rzeczywistą ścieżkę awarii, zacytować linie, zweryfikować lub skorygować „Risk Response Guidance”, zlokalizować istniejące testy, wskazać najtańszą warstwę z rzeczywistym sygnałem, oznaczyć ryzyka spekulatywne i mylące dowody hot-spot. Sprawdzić, czy mamy wymagane narzędzia/biblioteki (wyszukiwanie: EXA; dokumentacja: Context7).

## Summary

1. **Najważniejsze ustalenie: warstwa „integration HTTP przeciw lokalnemu Supabase” już istnieje i działa w CI** — to `scripts/smoke.mjs` (943 linie) w trybie `local`, uruchamiany w jobie `smoke` przeciw `astro preview` (runtime Cloudflare/workerd) z lokalnym Supabase i Mailpit (`.github/workflows/ci.yml`, krok „Run local Mailpit E2E against production preview”). Loguje dwa różne konta przez magic link i pokrywa większość zachowań wymaganych przez #1 i #2 oraz część #5 i #6. `test-plan.md §4` opisuje go jako „HTTP smoke … przepływ auth” i twierdzi, że „trasy API, ochrona tras … nie mają testów automatycznych” — **to twierdzenie jest częściowo błędne** (patrz tabela pokrycia niżej). Faza 1 to więc **domknięcie konkretnych luk i wydzielenie czytelnego zestawu**, a nie budowa warstwy od zera.
2. **#1 (własność)**: odczyt pojedynczego timera (`findById`) filtruje **wyłącznie przez RLS** — bez `user_id` w zapytaniu (`src/lib/services/drill-configurations.ts:197`), w przeciwieństwie do update/delete, które mają podwójny filtr (`:201`, `:203`). Dla stron `/{id}` i `/{id}/edit` polityka `drill_configurations_select_own` jest jedyną barierą. Wyzwanie „pgTAP RLS = aplikacja bezpieczna” jest zasadne w drugą stronę: pgTAP dowodzi polityki, ale nie tego, że aplikacja odpytuje bazę **kluczem publishable z JWT użytkownika** (a nie np. kluczem service-role) — tylko test HTTP z dwoma kontami to dowodzi. Smoke już to robi dla 5 powierzchni (strona szczegółów, strona edycji, PUT, DELETE, lista) i sprawdza, że dane A są niezmienione.
3. **#2 (gość)**: chronione powierzchnie to dokładnie 5 typów stron (lista `PROTECTED_ROUTES` + wzorzec UUID, `src/lib/protected-routes.ts:3,17`) i 3 mutujące metody API, które same odrzucają brak sesji (401) — API **nie jest** na liście middleware (`src/lib/protected-routes.test.ts:14` pinuje `/api/drills` jako niechronione przez middleware). Smoke sprawdza GET dla każdej strony i POST/PUT/DELETE bez sesji. **Luki**: inne metody niż GET na stronach (POST/HEAD), sfałszowane/nieważne ciasteczko sesji, brak treści w odpowiedzi przekierowania, oraz brak „inwentarza tras” wykrywającego nową stronę, której ktoś zapomni dodać do listy.
4. **#5 (przekierowania)**: przejścia dzielą się na **serwerowe** (gość → `/auth/signin?next=…`, callback → `next`, signout → `/`, legacy `/auth/signup`) i **klienckie** (po zapisie → `/{id}` przez `window.location.assign`, po usunięciu → `/timers` przez `location.replace`, edycja zostaje na formularzu). Klienckich nie da się zobaczyć testem HTTP; ich cel jest już pokryty testami jednostkowymi kontrolerów (`src/lib/drill-create-controller.test.ts:48,59`, `src/lib/drill-delete-controller.test.ts:32`). **Luka HTTP**: smoke nigdy nie wysyła obcego `next` (`https://…`, `//…`, `/\…`) do żadnego endpointu — odrzucanie jest dowiedzione tylko jednostkowo (`src/lib/email-auth.test.ts:49,277,301`). PRD **nie określa** celu po edycji ani po usunięciu — wyrocznią jest decyzja roadmapy S-17 (usunięcie i linki powrotu → `/timers`), a dla edycji archiwum S-12 (zostaje na formularzu z linkami `/{id}` i `/timers`).
5. **#6 (walidacja)**: serwer waliduje niezależnie od klienta trzema warstwami: `validateSaveDrillRequest` (strict zod + `parseDrillConfig` + reguły nazwy) wywoływany w POST i PUT (`drill-configurations.ts:251,387`), CHECK-i i trigger limitu w bazie (migracja `:32-42,68-87`, pokryte pgTAP). Formularz i API **dzielą tę samą funkcję** `parseDrillConfig` — więc błąd w niej psuje obie warstwy naraz; niezależnym zabezpieczeniem są CHECK-i bazy. Najtańsza warstwa z sygnałem dla macierzy wartości to **istniejące testy jednostkowe** (`drill-configurations.test.ts:98-168`, `drill-update.test.ts:90-123`); HTTP potrzebuje tylko kilku przypadków dowodzących, że trasa naprawdę wywołuje walidator i że baza nie przyjmuje wiersza. Część „jedno kliknięcie strzałki = jeden krok” należy do Fazy 2 (komponent), nie do tej fazy.
6. **Narzędzia**: **nie trzeba żadnej nowej biblioteki.** Node 24 `node:test` + globalny `fetch` + istniejący `@supabase/supabase-js` wystarczą. Wyszukiwanie EXA nie wskazało niczego tańszego niż `fetch` przeciw działającemu `astro preview`; supertest/Container API nie uruchamiają middleware w runtime Cloudflare, a Playwright API to Lekcja 4. Context7 potwierdza, że `auth.admin.generateLink` zwraca `properties.hashed_token` — możliwe szybsze tworzenie sesji niż Mailpit, ale wymaga klucza service-role tylko w procesie testów (patrz Open Questions).
7. **Dowody hot-spot są zawyżone jako sygnał prawdopodobieństwa**: liczby 21/13/18 to **liczba dotknięć plików**, nie commitów (commitów: 8/7/6 w 30 dniach), i prawie wszystkie to commity budujące nowe slice'y (`feat(...)`), a nie poprawki; tylko 2 commity to poprawki po review (`f377d2c`, `53c69b0`). Nie unieważnia to ryzyk (ich źródłem są PRD i wywiad), ale „Likelihood: High” dla #5 opiera się głównie na wywiadzie, nie na historii błędów.

## Detailed Findings

### Mapa pokrycia: co już jest dowiedzione i gdzie

| Zachowanie (wyrocznia) | Jednostkowe (`npm test`) | pgTAP | HTTP (`smoke.mjs`, CI `smoke`) | Luka |
|---|---|---|---|---|
| #1 B dostaje identyczny 404 dla timera A na `/{id}` | `saved-drills-read.test.ts:142,183` (na stubie) | select-own, `drill_configurations.test.sql:139-250` | `verifyForeignSavedDrillPages` `smoke.mjs:581-604` (status, bajty, nagłówki = losowy UUID = nie-UUID) | — |
| #1 … na `/{id}/edit` | — | — | `verifyForeignEdit` `smoke.mjs:572-578` | — |
| #1 … PUT `/api/drills/{id}` | `drill-update.test.ts:125,228` | update-own | `smoke.mjs:561-571` | — |
| #1 … DELETE | `drill-delete.test.ts:56` | delete-own | `verifyForeignDelete` `smoke.mjs:688-700` (+ bajty = 404 z PUT) | — |
| #1 dane A niezmienione po próbach B | — | `drill_configurations.test.sql:139-149` | `verifyFirstUserTimersUnchanged` `smoke.mjs:618-623` (nazwa + linia parametrów obu timerów A) | sprawdza tekst listy, nie `updated_at`; akceptowalne |
| #1 lista B nie zawiera timerów A | — | tak | `smoke.mjs:597-603` | — |
| #2 gość GET `/dashboard`, `/timers`, `/create`, `/{uuid}`, `/{uuid}/edit` → 302 + `next` | `protected-routes.test.ts:6-88` (predykat) | — | `smoke.mjs:792-806,334-344,606-613,543-554` | — |
| #2 gość POST/PUT/DELETE API → 401, bez zmian | handler order: `drill-configurations.test.ts:340`, `drill-update.test.ts:186`, `drill-delete.test.ts:85` | anon bez grantów `…test.sql:68-89` | `smoke.mjs:334-337,543-547,680-685` | brak dowodu „bez zmiany w bazie” na HTTP (pokrywa pgTAP: anon nie ma grantów) |
| #2 metody inne niż GET na stronach chronionych | — | — | **brak** | POST/HEAD `/timers`, `/dashboard`, `/create`, `/{uuid}`, `/{uuid}/edit` |
| #2 sfałszowane / nieważne ciasteczko = gość | — | — | **brak** | `Cookie: sb-…-auth-token=garbage` |
| #2 wariant ścieżki (`/%63reate`, `//timers`, `/{UUID}` wielkimi) w runtime | `protected-routes.test.ts:19-77` (predykat) | — | **brak** | czy router workerd dekoduje tak, jak zakłada `routerPath` (`protected-routes.ts:5-15`) |
| #2 nowa strona poza listą | — | — | **brak** | inwentarz `src/pages/**` vs lista publiczna |
| #5 logowanie bez `next` → `/timers` | `email-auth.test.ts:38` | — | `smoke.mjs:811-830,253-270` (Location = `next`) | — |
| #5 obcy `next` odrzucony | `email-auth.test.ts:49,70,81,277,301` | — | **brak** | `/api/auth/signin`, `/api/auth/callback`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` |
| #5 po zapisie → `/{id}` | `drill-create-controller.test.ts:48,59` | — | „server half” `smoke.mjs:369-371` | klik w przeglądarce = Faza 3 |
| #5 po usunięciu → `/timers` | `drill-delete-controller.test.ts:32` | — | — | klik w przeglądarce = Faza 3 |
| #5 linki powrotu w SSR HTML | — | — | `/create` → `/timers` `smoke.mjs:357-359`; `/{id}` → `/{id}/edit` `:493-494`; edycja „Back to timer” tylko tekst `:505` | brak asercji `href` dla „Back to timer” (`/{id}`) i „Back to timers” na `/{id}` i edycji |
| #5 signout → `/` | — | — | `smoke.mjs:284-286` | — |
| #6 nazwa pusta / 201 znaków / kontrolne / zakresy / nieznane pola | `drill-configurations.test.ts:98-168`, `drill-update.test.ts:90-123` | CHECK-i `…test.sql:292-400` | `rest:"99:99"` (POST, PUT), 201 znaków tylko PUT, 415 (`smoke.mjs:388-393,516-524`) | HTTP: pusta nazwa, `exercise:"0:00"`, `repetitions:"0"/"101"`, nieznane pole `user_id` na POST |
| #6 limit 50 | `drill-configurations.test.ts:258` | `…test.sql:422-505` | `verifyDrillLimit` `smoke.mjs:395-410` (+ współbieżnie) | — |

### #1 — Własność: rzeczywista ścieżka awarii

- Klient Supabase jest tworzony z kluczem publishable i ciasteczkami żądania (`src/lib/supabase.ts:11-21`), a middleware rozwiązuje użytkownika przez `supabase.auth.getUser()` (`src/middleware.ts:12-19`) i udostępnia **ten sam** klient stronom i API (`src/middleware.ts:10`, `src/pages/api/drills/index.ts:8-12`).
- Odczyt: `findById: (id) => client.from("drill_configurations").select(SAVED_DRILL_COLUMNS).eq("id", id).maybeSingle()` (`src/lib/services/drill-configurations.ts:197`) — **bez filtra `user_id`**; komentarz `:188` mówi wprost „RLS limits both reads”. Zero wierszy → `not_found` (`:550`) → strona 404 (`src/pages/[id].astro:25`, `src/pages/[id]/edit.astro:25`).
- Zapis: update i delete mają `.eq("user_id", userId)` jako obronę w głąb (`:198-203`).
- Realne ścieżki awarii (wnioskowanie): (a) ktoś „uprości” `createClient` do klucza service-role lub doda drugi klient omijający RLS — pgTAP przejdzie, aplikacja wycieknie; (b) zmiana polityki select (np. przy S-20 usuwaniu konta) — pgTAP to złapie; (c) różnica w treści 404 strony vs nieistniejącej (oracle istnienia) — dziś obie ścieżki renderują `NotFoundView` (`[id].astro:29`, `404.astro:11`), smoke porównuje bajty.
- **Weryfikacja guidance #1**: trafna. „Nie mockuj klienta bazy” — potwierdzone: testy jednostkowe usług już używają stubów `DrillConfigurationStore` (np. `drill-update.test.ts:125`), więc dowodzą tylko tłumaczenia „zero wierszy → 404”, nie polityki. Właściwa warstwa to HTTP z dwoma kontami — **już istnieje w smoke**. Korekta: zamiast pisać to od nowa, wydzielić/zostawić i dodać ewentualnie jedno porównanie nagłówków `Content-Type` 404 strony vs API (obecnie porównywane są tylko w obrębie jednej powierzchni, co jest zgodne z wyrocznią „foreign == missing” — PRD nie wymaga, by strona i API dawały ten sam 404).

### #2 — Gość: rzeczywista ścieżka awarii

- Strażnik: `isProtectedPath` (`src/lib/protected-routes.ts:26-29`) = `PROTECTED_ROUTES = ["/dashboard", "/create", "/timers"]` (`:3`) z podścieżkami **lub** `/{uuid}` / `/{uuid}/edit` (`:17`). Middleware zwraca `guestRedirectResponse` przed wywołaniem strony (`src/middleware.ts:21-26`), ciało `null` (`protected-routes.ts:33`) — więc brak treści jest konstrukcyjny dla ścieżek z listy.
- Strażnik patrzy **tylko na pathname, nie na metodę** (`middleware.ts:21`) — więc POST/HEAD na stronę chronioną też powinien dać 302 (wniosek z kodu; nie zaobserwowany w runtime — dlatego warto to przetestować, bo to dokładnie wyzwanie „GET wystarczy”).
- Obrona w głąb na poziomie stron: `/timers` (`timers.astro:15-21`), `/dashboard` (`dashboard.astro:13-16`), `/{id}` i `/{id}/edit` (`resolveSavedDrillPage`, `drill-configurations.ts:562-569`) przekierowują same, nawet gdyby middleware je przepuścił. **`/create` nie ma własnego strażnika** (`src/pages/create.astro:1-8`) — zależy wyłącznie od listy middleware. Skutek wycieku byłby ograniczony (formularz bez danych; zapis i tak 401 w `handleSaveDrillRequest`, `:368`), ale to jedyna strona chroniona pojedynczą barierą.
- API: `/api/drills` i `/api/drills/{id}` nie są w middleware (`protected-routes.test.ts:14`); każdy handler zaczyna od `userId === null → 401` (`drill-configurations.ts:368,430,477`). Inne metody na `/api/drills/{id}` → 405 bez czytania sesji (`src/pages/api/drills/[id].ts:25`, `:487-489`).
- Publiczne z założenia: `/`, `/auth/*`, `/api/auth/*`, `/404`, `/dev/timer-ui` (w produkcji 404 — sprawdzane w `ci.yml`), dowolny nie-UUID (`protected-routes.ts:19-21`).
- **Weryfikacja „lista chronionych tras jest kompletna”**: dla bieżących 13 plików w `src/pages/` (`find src/pages -type f`) — **tak**, każda strona z danymi użytkownika jest chroniona. Lista jest jednak ręczna; brak mechanizmu, który wykryje nową stronę. Najtańszy sygnał: test jednostkowy „inwentarza” czytający `src/pages/**` i wymagający, by każda trasa była albo na jawnej liście publicznej, albo `isProtectedPath(...) === true` (wzorzec już stosowany: test czytający migrację, `drill-configurations.test.ts:395`).
- **Weryfikacja „GET wystarczy”**: nie wystarczy dla API (smoke już testuje POST/PUT/DELETE), dla stron to luka bez dowodu.
- **Weryfikacja „bez zmiany w bazie”**: na HTTP gość nie ma sesji, więc nie może sprawdzić bazy; dowód „bez zmiany” to (a) 401 przed dotknięciem store (jednostkowo, handler order) + (b) brak grantów dla `anon` (pgTAP). Ewentualny test HTTP: po 401 gościa zalogowany właściciel widzi niezmienioną listę — smoke robi to pośrednio (`verifyGuestEdit`/`verifyGuestDelete` na `savedDrill.id`, potem `verifyFirstUserTimersUnchanged`).

### #5 — Przekierowania: rzeczywista ścieżka awarii

- Sanitizacja: `isSafeNextPath` (`src/lib/email-auth.ts:25-51`) — odrzuca nie-string, `//`, `\`, znaki kontrolne, złe `%`, zakodowane `/`/`\` w ścieżce, inną origin. Domyślny cel `DEFAULT_NEXT_PATH = "/timers"` (`:10`).
- Konsumenci `next` (5 miejsc): `signInUrlForProtectedPath` (`:138-141`), `/auth/signin` (`src/pages/auth/signin.astro:7-8`, ukryte pole `SignInForm.tsx:44`), `/auth/confirm-email` (`confirm-email.astro:10-12`), callback GET (`emailLinkCallbackPageState`, `email-auth.ts:79-102`) i POST (`handleEmailLinkCallback` → `callbackRedirect(result.next)`, `:253-273`, status 303), legacy `/auth/signup` (`src/pages/auth/signup.ts:7-13`). Link w mailu budowany na origin żądania (`buildEmailRedirectTo`, `:143-159`).
- Przejścia klienckie: zapis → `options.navigate?.(\`/${encodeURIComponent(response.drill.id)}\`)` (`src/lib/drill-create-controller.ts:119`, domyślnie `window.location.assign`, `useDrillCreate.ts:17-20`); usunięcie → `navigate(TIMERS_HREF)` (`drill-delete-controller.ts:64`, `TIMERS_HREF = "/timers"` w `app-top-bar.ts:2`, domyślnie `location.replace`, `DeleteDrillDialog.tsx:33`); edycja nie nawiguje (`drill-create-controller.test.ts:339`). Linki powrotu: `DrillEditApp.tsx:16,19` (`/{id}`, `/timers`), `SavedDrillDetails.tsx:34,39`, `DrillCreateApp.tsx:42`, `DrillCreateForm.tsx:93,98`.
- Wyrocznie: PRD FR-017 (po zapisie → widok zapisanego timera; po zalogowaniu domyślnie lista), FR-011/Access Control (strona startowa `/timers`). **PRD milczy o celu po edycji i po usunięciu** — źródłem jest roadmapa S-17 (`roadmap.md:298`: „Linki powrotu i przekierowanie po usunięciu kierują do `/timers`”) i plan archiwalny S-12 (`context/archive/2026-10-07-edit-saved-drill/plan.md:169`, edycja zostaje z linkami `Back to timer` → `/{id}`). Uwaga: S-17 mówi „linki powrotu → `/timers`”, a edycja ma też link `/{id}` — to nie sprzeczność (są oba linki), ale plan powinien przyjąć tę decyzję jawnie, nie wyprowadzać jej z kodu.
- **Weryfikacja guidance #5**: „sprawdzaj Location, nie sam status” — smoke już to robi wszędzie, gdzie testuje przekierowania (`responseLocation`, `smoke.mjs:225-234`). **Korekta warstwy**: „integracja HTTP + e2e przejść UI” → w Fazie 1 tylko HTTP dla przekierowań serwerowych i `href` w SSR; przejścia klienckie są już pokryte jednostkowo na poziomie kontrolera, a klik w przeglądarce należy do Fazy 3 (test-plan §3 Phase 3 już to obejmuje). Wyzwanie „szczęśliwa ścieżka logowania pokrywa wszystko” — zasadne: obcy `next` nie jest nigdzie sprawdzany na HTTP.

### #6 — Walidacja API: rzeczywista ścieżka awarii

- POST i PUT: `readJsonRequest` (415 dla nie-JSON, 413 > 4096 B, 400 dla złego JSON; `drill-configurations.ts:343-364`) → `validateSaveDrillRequest` (`:79-117`): `z.strictObject` (`:44-51`, nieznane pola → błąd), `normalizeDrillName` (NFC, znaki kontrolne, 1–200 punktów kodowych; `:65-73`), `parseDrillConfig` (`src/lib/drill-timer.ts:31-72`, wzorce `TIME_PATTERN`/`REPETITIONS_PATTERN` `:18-19`, zakresy zgodne z FR-001: 0–600/1–600/0–600 s, 1–100).
- Baza: CHECK-i nazwy i zakresów (`supabase/migrations/20261007120000_create_drill_configurations.sql:32-42`), trigger limitu 50 z blokadą doradczą (`:68-87`), granty kolumnowe (`:99-104`) — klient nie może ustawić `id`/`user_id` przy update.
- Test jednostkowy pilnuje zgodności stałych serwisu z migracją (`drill-configurations.test.ts:395`).
- **Weryfikacja „walidacja w formularzu wystarcza”**: wyzwanie zasadne, ale w tym kodzie serwer **nie ufa** formularzowi — waliduje ponownie. Prawdziwe ryzyko to **wspólna funkcja** `parseDrillConfig` (formularz i serwer): błąd w niej (np. dopuszczenie `10:01`) przejdzie przez obie warstwy; złapią go CHECK-i bazy (500 `unexpected` zamiast 400) i pgTAP. Dlatego wyrocznia testów `parseDrillConfig` musi pochodzić z FR-001, nie z regexów.
- **Weryfikacja guidance #6**: „testuj wartości niepoprawne, nie tylko poprawne” — istniejące testy jednostkowe to robią (granice 200/201, puste, białe znaki, typy, nieznane klucze). Korekta warstwy: macierz wartości → jednostkowo (już jest); HTTP → po jednym reprezentatywnym przypadku na klasę (nazwa, zakres, nieznane pole, limit) dla POST i PUT, żeby dowieść okablowania trasy w runtime. Druga połowa #6 (strzałki) → Faza 2.

### Narzędzia i biblioteki

- Dostępne: Node 24.21.0 (`node:test`, `fetch`), `@supabase/supabase-js` i `@supabase/ssr` (`node_modules/@supabase/`), Supabase CLI (`supabase` ^2.23.4), Mailpit na porcie 55324 (`supabase/config.toml:99-102`), skrypt smoke z gotowymi pomocnikami (słoik ciasteczek `smoke.mjs:45-64`, `appRequest` z `redirect: "manual"`, `waitForEmail`, `callbackFromMessage`).
- Niedostępne i niepotrzebne: vitest, supertest, playwright, msw (sprawdzone w `node_modules`).
- EXA (`web_search_exa`, 2026-10-11): rekomendowany wzorzec to `fetch` przeciw działającemu serwerowi `astro preview` dla middleware + tras; Supabase zaleca lokalny stack i admin API do szybkiego tworzenia potwierdzonych użytkowników. Supertest/Container API nie wykonują middleware w adapterze Cloudflare — gorszy sygnał niż obecny smoke.
- Context7 (`/supabase/supabase-js`): `auth.admin.generateLink` zwraca `GenerateLinkProperties.hashed_token`; `verifyOtp({ token_hash, type })`. Aplikacja weryfikuje z `type: "email"` (`email-auth.ts:67,204`) — zgodność tokenu z `generateLink({ type: "magiclink" })` przy `type: "email"` **nie została zweryfikowana** (wymaga spike'u).
- Ograniczenia lokalnego Supabase: `sign_in_sign_ups = 30` i `token_verifications = 30` na 5 min na IP (`config.toml:194-196`) — zestaw tworzący wiele kont magic linkiem może w nie trafić; `email_sent = 2` dotyczy tylko włączonego SMTP (komentarz `:185`), Mailpit go nie podlega.

### Dowody hot-spot (likelihood)

- `git log --since=2026-09-11 --name-only -- <dir>` daje 21/13/18 dotknięć plików — zgodne z §2; ale commitów jest 8/7/6. W `src/lib/services` 6 z 8 to `feat(...)` budujące S-10…S-17, 2 to poprawki po impl-review (`f377d2c`, `53c69b0`). `src/pages/auth` zawiera 2 commity bootstrapu/formatowania (`6861174`, `8c366f8`).
- Werdykt: dowód „churn” jest prawdziwy liczbowo, ale mierzy budowę funkcji, nie niestabilność; nie jest mylący co do **miejsca** (te katalogi rzeczywiście zawierają granice), jest zawyżony co do **prawdopodobieństwa**. Żadne z ryzyk #1, #2, #5, #6 nie jest spekulatywne — wszystkie mają źródło w PRD (Guardrails, Access Control, FR-001, FR-011, FR-017). Najsłabiej osadzona część to w #5 „z edycji … nie tam, gdzie trzeba” (brak wymagania w PRD; źródło tylko roadmapa/archiwum).

## Code References

- `src/middleware.ts:7-29` — rozwiązanie użytkownika i przekierowanie gościa dla chronionych ścieżek (bez względu na metodę)
- `src/lib/protected-routes.ts:3,17,26-37` — lista chronionych tras, wzorzec UUID, odpowiedź 302 z `next`
- `src/lib/supabase.ts:7-23` — klient SSR z kluczem publishable i ciasteczkami żądania
- `src/lib/services/drill-configurations.ts:185-205` — adapter store; `:197` odczyt tylko przez RLS
- `src/lib/services/drill-configurations.ts:79-117,343-375,429-438,476-484` — walidacja i kolejność handlerów (401 → 503 → 404 → 415/413/400)
- `src/lib/services/drill-configurations.ts:562-579` — decyzje stron `/{id}` i `/timers`
- `src/pages/[id].astro:16-26`, `src/pages/[id]/edit.astro:16-26`, `src/pages/timers.astro:14-21`, `src/pages/dashboard.astro:10-16` — obrona w głąb na stronach
- `src/pages/create.astro:1-8` — strona chroniona tylko przez middleware
- `src/pages/api/drills/index.ts:7-14`, `src/pages/api/drills/[id].ts:7-25` — trasy API
- `src/lib/email-auth.ts:10,25-51,79-102,138-159,253-273` — sanitizacja i konsumenci `next`
- `src/lib/drill-create-controller.ts:119`, `src/lib/drill-delete-controller.ts:64` — przejścia klienckie
- `src/lib/drill-timer.ts:16-72` — `parseDrillConfig` (wspólny dla formularza i serwera)
- `supabase/migrations/20261007120000_create_drill_configurations.sql:32-42,68-121` — CHECK-i, limit, granty, polityki RLS
- `supabase/tests/database/drill_configurations.test.sql` — 105 asercji pgTAP (`:9`)
- `scripts/smoke.mjs:66-90,225-234,326-700,788-938` — istniejące testy HTTP (lokalny tryb w CI)
- `.github/workflows/ci.yml` (job `smoke`) — uruchamia pgTAP i smoke przeciw `astro preview`

## Architecture Insights

- Wzorzec „handler bez Astro i Supabase” (`handleSaveDrillRequest` itd., komentarz `drill-configurations.ts:366`) daje tanie testy jednostkowe kolejności i mapowania błędów na stubach; polityki dostępu dowodzi pgTAP, a złożenia obu w runtime — HTTP smoke. Trzy warstwy już istnieją; Faza 1 powinna je **nazwać i uzupełnić**, nie dublować.
- Smoke jest jednym sekwencyjnym scenariuszem ze współdzielonym stanem (`savedDrill`, `fillerIds`) i tłumi szczegóły błędów (`smoke.mjs:940-942`, celowo, by nie logować emaili/tokenów). Dla Fazy 1 to koszt diagnostyczny: awaria #1 pokazuje tylko nazwę kroku. Plan powinien zdecydować: (A) dopisać brakujące kroki do smoke (najtaniej, spójnie z CI), albo (B) wydzielić `node --test` zestaw integracyjny z helperem sesji wyciągniętym ze smoke (lepsza diagnostyka, niezależne przypadki, ale nowy krok CI i ryzyko limitów auth).
- Konwencja „foreign == missing == non-UUID, bajt w bajt” jest spójnie stosowana w stronach i API i już pinowana testami — nowy test powinien porównywać pełne odpowiedzi (status, ciało, wybrane nagłówki), nie tylko status.

## Historical Context (from prior changes)

- `context/archive/2026-10-07-edit-saved-drill/plan.md:153,169` — edycja zostaje na formularzu (`keepAfterSave`), linki `Back to timer` → `/{id}`; foreign/unknown/non-UUID = jeden 404 (supported przez bieżący kod `[id]/edit.astro:25`, `drill-update.test.ts:228`).
- `context/archive/2026-10-08-timers-list-and-account/plan.md:190-198` — po zapisie nawigacja do `/{id}` tylko w trybie tworzenia, `location.assign`; supported (`drill-create-controller.ts:119`). Roadmapa S-17 (`roadmap.md:298`) — usunięcie i linki powrotu → `/timers`; supported dla usunięcia (`drill-delete-controller.ts:64`), partial dla linków powrotu (edycja ma dodatkowo `/{id}`).
- `context/foundation/roadmap.md` S-10 Risk — „baza jest granicą bezpieczeństwa” (RLS, unikalność, limit 50); supported (migracja `:3-4`, pgTAP).
- `context/foundation/test-plan.md §4` — „trasy API, ochrona tras … nie mają testów automatycznych”: **contradicted** dla tras API, ochrony tras i własności (pokrywa `smoke.mjs` w CI); supported dla komponentów i przepływów w przeglądarce.

## Related Research

- Brak wcześniejszych `research.md` dla testów; powiązane decyzje w archiwach S-10…S-17 (wyżej).

## Open Questions (rozstrzygnięte 2026-10-11 — patrz Decisions)

1. **Kształt zestawu (decyzja dla `/10x-plan`)**: dopisać luki do `scripts/smoke.mjs` (A) czy wydzielić `tests/integration/*.test.mjs` na `node:test` z helperem sesji (B)? Rekomendacja badania: **B dla nowych przypadków #2/#5/#6 jako niezależne testy, A zostaje bez zmian** jako dowód #1 (nie przenosić działających kroków bez potrzeby). Wymaga decyzji, czy zestaw B dostaje osobny krok w jobie `smoke` (bramka `required after §3 Phase 1` w §5).
2. **Tworzenie sesji w zestawie B**: Mailpit magic link (sprawdzony w smoke, wolniejszy, limit 30/5 min) czy `auth.admin.generateLink` (szybszy; wymaga `SERVICE_ROLE_KEY` z `supabase status -o env` wyłącznie w procesie testów — CI dziś eksportuje tylko `API_URL|PUBLISHABLE_KEY|ANON_KEY`; klucz nie może trafić do `.env`/`.dev.vars` aplikacji). Zgodność `hashed_token` z `type: "email"` w callbacku wymaga spike'u.
3. **Wyrocznia po edycji**: czy „po zapisaniu edycji użytkownik zostaje na formularzu z potwierdzeniem” to zaakceptowana decyzja produktowa (archiwum S-12), którą test ma utrwalić? PRD tego nie mówi — potwierdzić z autorem przed asercją.
4. **POST/HEAD na stronach chronionych**: oczekiwanie „302 do logowania” wynika z kodu middleware, nie z PRD; PRD mówi tylko „przekierowanie lub odmowa”. Test powinien akceptować 302 z `Location` na `/auth/signin` (bez treści) jako jedyny poprawny wynik — potwierdzić w planie.

## Decisions (2026-10-11, autor)

Odpowiedzi autora na Open Questions 1–4. Tam, gdzie decyzja różni się od rekomendacji badania, zaznaczono, co zastępuje.

1. **Kształt zestawu: wszystko do `node:test`** (zastępuje rekomendację „smoke zostaje + nowy node:test”). Istniejące kroki HTTP dla #1, #2, #5, #6 z `scripts/smoke.mjs` przechodzą do nowego zestawu integracyjnego; luki z „Mapy pokrycia” dochodzą jako nowe przypadki. Konsekwencje dla planu:
   - Smoke nie znika w całości: tryb `remote` (`smoke.mjs:729-782`) działa po deployu na produkcji i używa wspólnych funkcji (`verifyAnonymousDrillApi`, `verifyGuestEdit`, `verifyGuestDelete`). Plan musi zdecydować, co zostaje w smoke (przepływ logowania przez Mailpit, tryb remote) i nie może osłabić bramki `deploy`.
   - Przeniesienie musi zachować każdą obecną asercję (porównania bajt w bajt foreign == random == nie-UUID, nagłówki `no-store`, `Location` z `next`), a najlepiej mieć tabelę „krok smoke → nowy test”, żeby nic nie zginęło po drodze.
   - Każdy przypadek ma być niezależny (własne konto/dane albo jawny setup), zamiast współdzielonego stanu `savedDrill`/`fillerIds`; test limitu 50 potrzebuje osobnego konta.
2. **Sesje: Mailpit magic link** (zgodne z rekomendacją). Helper sesji wyciągnięty ze smoke (`requestEmailLink`, `waitForEmail`, `callbackFromMessage`, `confirmLink`, słoik ciasteczek). Bez klucza service-role i bez zmian sekretów CI. Ograniczenie: `sign_in_sign_ups = 30` i `token_verifications = 30` na 5 min na IP (`supabase/config.toml:194-196`), więc zestaw powinien logować niewiele kont (np. A, B, konto do limitu) i używać ich ponownie w obrębie przebiegu.
3. **Po zapisaniu edycji: przejście do `/{id}`** (zastępuje decyzję archiwum S-12 i bieżące zachowanie). Dziś edycja zostaje na formularzu (`drill-create-controller.ts`, tryb `keepAfterSave`; test `drill-create-controller.test.ts:339` „edit mode never navigates”). Konsekwencje:
   - To **zmiana zachowania aplikacji**, nie tylko test. PRD nie ma tego wymagania; trzeba je dopisać (np. przy FR-017) albo potwierdzić w roadmapie, żeby wyrocznia pochodziła ze źródła, a nie z rozmowy.
   - Granice lekcji i fazy: Faza 1 to faza testów. Do rozstrzygnięcia w `/10x-plan`: osobna mała zmiana produktowa (zalecane, np. `/10x-new edit-redirect-to-saved-timer`) albo jedna faza tej zmiany prowadzona przez `/10x-tdd` (czerwony test: „po udanym zapisie edycji kontroler nawiguje raz do `/{id}`”).
   - Przejście jest klienckie (`window.location`), więc dowód należy do testu jednostkowego kontrolera (Faza 1/2), a klik w przeglądarce do Fazy 3. Test HTTP może sprawdzić tylko, że `/{id}` po PUT pokazuje nowe wartości.
   - Trzeba zmienić istniejący test `drill-create-controller.test.ts:339` oraz fixtures `EditDrillFixtures.tsx` (CLAUDE.md wymaga ich aktualizacji przy zmianie `DrillEditApp`).
4. **POST/HEAD gościa na chronionej stronie: tylko 302 do logowania** (zgodne z rekomendacją). Wyrocznia: status 302, `Location` = `/auth/signin?next=<ścieżka z zapytaniem>`, puste ciało, `Cache-Control: private, no-store` (`protected-routes.ts:32-37`). Dotyczy `/dashboard`, `/create`, `/timers`, `/{uuid}`, `/{uuid}/edit`.
