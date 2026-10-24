---
date: 2026-10-24T21:08:43+02:00
researcher: Claude (Opus 5.5) z Janem Kalwodą
git_commit: e958ec8
branch: feature/observability-audit
repository: 10xDevs4
topic: "Jak odróżnić oczekiwane wyniki Supabase Auth od awarii do zaraportowania i co dziś zależy od obecnego zachowania (audyt A1–A5)"
tags: [research, observability, auth, supabase, sentry, middleware, email-auth]
status: complete
last_updated: 2026-10-24
last_updated_by: Claude (Opus 5.5)
---

# Research: widoczność błędów Supabase Auth (A1–A5)

**Date**: 2026-10-24T21:08:43+02:00
**Researcher**: Claude (Opus 5.5) z Janem Kalwodą
**Git Commit**: e958ec8
**Branch**: feature/observability-audit
**Repository**: 10xDevs4

## Research Question

Raport `context/audits/observability/2026-10-24_account-entry-saved-timers-timer-run.md` wskazał ustalenia A1–A5:

- A1: `getUser` w middleware ignoruje `error`;
- A2: wynik `signInWithOtp` jest odrzucany;
- A3: każdy błąd `verifyOtp` daje komunikat „link wygasł”;
- A4: brak sekretów daje cichy klient `null`;
- A5: `signOut` ignoruje `error`.

Pytania:

1. Jak `@supabase/auth-js` sygnalizuje każdy przypadek i którym predykatem odróżnić wynik oczekiwany (gość, wygasły link, limit) od awarii do zaraportowania?
2. Które ścieżki kodu, porty, testy i decyzje projektowe zależą od obecnego zachowania?
3. Jak zgłosić błąd do Sentry z kodu serwera bez naruszenia reguł prywatności?

## Summary

- **Żadne z czterech wywołań nie rzuca wyjątku przy błędzie auth.** `getUser`, `signInWithOtp`, `verifyOtp` i `signOut` zwracają `{ data, error }` przez `_returnResult` (`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:310-315`). `throwOnError` jest domyślnie `false` (`:24`), a `@supabase/ssr` 0.12.7 go nie ustawia (grep w `ssr/dist/module/createServerClient.js` bez trafień). Dlatego obecne `try/catch` w `src/lib/email-auth.ts:174-184` i `:201-211` łapią tylko błędy, które nie są `AuthError`.
- **Klasyfikacja jest możliwa bez dopasowywania tekstu komunikatu**, dzięki eksportowanym type guardom (`lib/errors.js`, re-eksport z `@supabase/supabase-js`, `supabase-js/dist/index.mjs:10`):
    - `isAuthRetryableFetchError` oznacza awarię: sieć (status 0, `lib/fetch.js:28`) albo HTTP z zestawu {500–504, 520–530} (`lib/fetch.js:22-24`, `:35-37`, `:41-44`);
    - `isAuthSessionMissingError` oznacza gościa;
    - `isAuthApiError` niesie `status` i `code`.
- **Ograniczenie:** dla błędów retryable kod serwera (np. `unexpected_failure`, `hook_timeout`) jest tracony (`lib/fetch.js:41-44`), więc raport musi nieść `status` i `message`.
- **Middleware nie może raportować każdego `error`.** `getUser` zwraca `AuthSessionMissingError` przy każdym żądaniu gościa (`GoTrueClient.js:2706-2707`), a sfałszowane ciasteczka dają `AuthApiError`, co test `tests/integration/ownership.test.mjs:410-453` pinuje jako „forged session is a guest”. Wyjściem jest dopiero `isAuthRetryableFetchError` (lub błąd, który nie jest `AuthError`).
- **Outage nie wylogowuje.** `_getUser` czyści sesję tylko przy `AuthSessionMissingError` (`GoTrueClient.js:2717-2721`), a odświeżenie tokena nie czyści jej przy błędzie retryable (`:4290`). Mimo to żądanie widzi `user: null`, więc decyzja „gość czy niedostępne” należy do aplikacji.
- **Żadna decyzja projektowa nie wymaga odpowiedzi 200 przy awarii dostawcy.** Reguła z S-09 brzmi „ten sam kształt odpowiedzi dla istniejącego i nowego konta; błędy nie mogą ujawniać istnienia konta” (`context/archive/2026-10-03-enter-account-by-email-link/plan.md:71`). Jednolite 503 dla każdego adresu jej nie narusza. Obecne 200 przy błędzie dostawcy pinuje jednak test `src/lib/email-auth.test.ts:148-160`, więc zmiana wymaga zapisanej decyzji (CLAUDE.md: „nie edytuj asercji, chyba że zmieniło się wymaganie”).
- **Raportowanie z serwera:** wzorcem jest wstrzykiwany logger (`DrillSaveLogger`, `src/lib/services/drill-configurations.ts:224-229`). `console.error` z obiektem `Error` w argumentach staje się wyjątkiem ze stackiem przez `captureConsoleIntegration` (`node_modules/@sentry/core/build/esm/integrations/captureconsole.js`, `args.find(arg => arg instanceof Error)`), ale tylko wewnątrz `wrapRequestHandler`.
- **Pułapka prywatności (audyt P1):** każde zdarzenie wysłane w trakcie `POST /api/auth/signin` lub `/api/auth/callback` dostaje body żądania (`email=`, `token_hash=`) przez domyślne `httpServerIntegration` (`@sentry/cloudflare/build/esm/prod/baseSdk.js:25`, `integrations/httpServer.js:18`). Dodanie raportów A2/A3 bez wyłączenia zbierania body sprawi, że emaile trafią do Sentry.

## Detailed Findings

### Taksonomia błędów auth-js 2.116.0

Wersje: `@supabase/auth-js` 2.116.0, `@supabase/supabase-js` 2.116.0, `@supabase/ssr` 0.12.7 (jedna kopia każdej, hoisted). Dokumentacja: `context/docs/supabase-auth.md`.

- **Klasy błędów:**
    - `AuthError` ma pola `name`, `message`, `status`, `code` (`lib/errors.js:11-27`).
    - Type guardy sprawdzają `name`, nie `instanceof` (`:28`, `:49`, `:105`, `:222`).
    - Nie ma `isAuthUnknownError`; sprawdza się `name === "AuthUnknownError"` (`:66`).
- **Mapowanie odpowiedzi w `lib/fetch.js`:**
    - wyjątek fetch daje `AuthRetryableFetchError(msg, 0)` (`:28`, `:115-120`);
    - status z zestawu `NETWORK_ERROR_CODES` = {500, 501, 502, 503, 504, 520–530} daje `AuthRetryableFetchError(msg, status)` bez `code` (`:22-24`, `:35-37`, `:41-44`);
    - body, które nie jest JSON, przy innym statusie daje `AuthUnknownError` (`:39`);
    - `session_not_found` daje `AuthSessionMissingError` (`:72-77`);
    - pozostałe przypadki, w tym 429, dają `AuthApiError(msg, status, code)` (`:78`).

| Wywołanie                                 | Oczekiwane (sprawdzone ścieżki)                                                                                                                                                                                    | Do raportu (sprawdzone ścieżki)                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getUser()` (`GoTrueClient.js:2670-2727`) | `AuthSessionMissingError` (brak tokena, `:2706-2707`; sesja odwołana, `:2717-2721`); `AuthApiError` z kodem z sesji martwej (`refresh_token_not_found`, `refresh_token_already_used`, `bad_jwt`, `user_not_found`) | `AuthRetryableFetchError` (status 0 lub 5xx/52x); błąd, który nie jest `AuthError`, jest rzucany (`:2725`) i już dociera do `wrapRequestHandler`                                                                                                       |
| `signInWithOtp` (`:1851-1903`)            | `AuthApiError` 429 (`over_email_send_rate_limit`, `over_request_rate_limit`); `email_address_invalid`, `validation_failed`                                                                                         | `AuthRetryableFetchError` (sieć, 5xx, w tym awaria SMTP lub hooka, kod utracony); `email_address_not_authorized`, `email_provider_disabled`, `otp_disabled` (konfiguracja); `AuthApiError` 401 bez `code` (prawdopodobnie zły klucz, niezweryfikowane) |
| `verifyOtp` (`:2041-2077`)                | `AuthApiError` 403 `otp_expired` (link wygasły, użyty lub nieprawidłowy; `context/docs/supabase-auth.md`); 429                                                                                                     | `AuthRetryableFetchError`; `AuthUnknownError`                                                                                                                                                                                                          |
| `signOut()` (`:3409-3449`)                | brak sesji (zwraca `null` bez żądania); 401, 403, 404 i session-missing są ignorowane przez bibliotekę (`:3436-3438`)                                                                                              | błąd ładowania sesji (`:3426-3427`, ciasteczka **nie** są czyszczone); 5xx, sieć i inne 4xx (`:3439-3443`, ciasteczka czyszczone lokalnie, ale refresh token może pozostać ważny na serwerze)                                                          |

### Ścieżki kodu i porty

- **Middleware** (`src/middleware.ts:29-56`):
    - `createClient` (`src/lib/supabase.ts:7-10`) → `getUser()` (`:38-40`), odczytywane jest tylko `data.user` (`:41`).
    - Klient `null` daje `user = null` (`:42-44`).
    - Dla ścieżki chronionej przy braku usera: `guestRedirectResponse` (`src/lib/protected-routes.ts:26,32`), czyli 302 `/auth/signin?next=…`.
    - Middleware nie korzysta z portu i nie da się go przetestować jednostkowo: importuje `astro:middleware`, `cloudflare:workers`, a `supabase.ts` importuje `astro:env/server`. Logikę sesji trzeba wyodrębnić do `src/lib` (wzorzec: `email-auth.ts`, `protected-routes.ts`, `html-cache-control.ts`).
- **Konsumenci `locals.user` i `locals.supabase`:**
    - `src/pages/api/drills/index.ts:11-12`, `src/pages/api/drills/[id].ts`;
    - `src/pages/timers.astro:15`, `src/pages/[id].astro:18`, `src/pages/[id]/edit.astro:18`;
    - top bar i `/dashboard`.
    - Handlery API sprawdzają `userId === null` (401) **przed** `store === null` (503): `drill-configurations.ts:367-369`, `:429-431`, `:476-478`. Strony robią to samo przez `resolveTimersPage`/`resolveSavedDrillPage` (`:562-578`).
    - Trzeci stan sesji („niedostępne”) wymaga więc nowego pola w `App.Locals` (`src/env.d.ts`) i sprawdzenia go przed `userId`.
- **Sign-in** (`POST /api/auth/signin`, `signin.ts:8-11`; `signup.ts:3,6` używa tego samego handlera):
    - Ścieżka: `handleEmailLinkRequest` (`email-auth.ts:223`) → `requestEmailLink` (`:162-188`), port `EmailLinkAuthPort` (`:121-124`).
    - Wynik: 400 dla złego emaila lub `next`, w każdym innym przypadku 200 `EMAIL_LINK_MESSAGE`.
    - Formularz `src/components/auth/SignInForm.tsx:30-37` pokazuje „We couldn't request a sign-in link right now. Please try again.” dla każdego statusu innego niż ok i 400, więc odpowiedź 503 nie wymaga zmian w UI.
- **Callback** (`POST /api/auth/callback`, `callback.ts:8-11`):
    - Ścieżka: `handleEmailLinkCallback` (`email-auth.ts:253`) → `verifyEmailLink` (`:192-214`).
    - Wynik: 303 do `next` albo 303 `/auth/callback?error=invalid&next=…`.
    - Skrypt klienta strony (`src/pages/auth/callback.astro:65-86`) sprawdza tylko `response.redirected` i origin.
- **Sign-out:**
    - Ścieżka: `src/pages/api/auth/signout.ts:4-10` (wynik ignorowany, 302 `/`), formularze w `AppTopBar.astro:45` i `AccountDetails.astro:28`.
    - Plik nie ma `export const prerender = false` (działa dzięki `output: "server"`; CLAUDE.md wymaga tego eksportu w trasach API).
- **Brak konfiguracji:**
    - `createClient` zwraca `null` dla 4 wywołujących: `middleware.ts:33`, `api/auth/signin.ts:9`, `callback.ts:9`, `signout.ts:5`.
    - Baner z `src/lib/config-status.ts` jest wyłączony (`showConfigWarnings={false}`) na stronach auth.

### Testy, które pinują obecne zachowanie

Runner: `node --test` z TS stripping, importy z rozszerzeniem `.ts`, bez aliasu `@/` i bez `astro:*`. Fake'i to literały obiektów implementujące port.

| Test                                                              | Co pinuje                                                                                     | Wpływ poprawki                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/email-auth.test.ts:114-146`                              | identyczna odpowiedź 200 dla nowego i istniejącego konta                                      | bez zmian (to jest reguła S-09)                                                                     |
| `src/lib/email-auth.test.ts:148-160`                              | błąd dostawcy, wyjątek i `auth = null` dają `{ok:true,status:200}`                            | zmiana tylko po zapisanej decyzji (Open Questions 1)                                                |
| `src/lib/email-auth.test.ts:162-175`                              | adapter POST, `{error: new Error("account-specific provider detail")}` daje 200               | jak wyżej; komunikat dostawcy może zawierać dane konta, więc nie wolno go przekazywać użytkownikowi |
| `src/lib/email-auth.test.ts:212-267`                              | wygasły lub użyty token i wyjątek `verifyOtp` dają 303 `error=invalid`, bez tokena w Location | ścieżka `otp_expired` bez zmian; retryable zależy od decyzji (Open Questions 3)                     |
| `src/lib/protected-routes.test.ts:79-84`                          | redirect gościa 302 `private, no-store`                                                       | bez zmian                                                                                           |
| `src/lib/route-inventory.test.ts:136-140`                         | `/api/auth/*` to PUBLIC_API, `/api/drills*` to SELF_GUARDED_API („answer 401 themselves”)     | nowy plik trasy lub strony trzeba sklasyfikować                                                     |
| `tests/integration/guest-access.test.mjs:43-49`, `:102-119`       | strony chronione dają gościowi 302, API daje 401                                              | bez zmian dla gościa                                                                                |
| `tests/integration/ownership.test.mjs:410-453`                    | sfałszowane ciasteczka to gość (302, 401)                                                     | musi pozostać: `AuthApiError` i `AuthSessionMissingError` nie są awarią                             |
| `tests/integration/redirects.test.mjs:171-187`, `:263-278`        | callback z błędem daje 303 `error=invalid`; poprawny sign-in daje 200                         | bez zmian dla ścieżek oczekiwanych                                                                  |
| `scripts/smoke.mjs:104-107`, `scripts/lib/app-client.mjs:233-241` | sign-out 302 `/`; neutralne 200                                                               | sign-out bez zmiany statusu                                                                         |

Prawdziwej awarii Supabase nie da się tanio wywołać w warstwie integracyjnej (`context/foundation/test-plan.md` §6.2), więc realną warstwą dla nowych przypadków są testy jednostkowe z fake'iem portu (§6.1, `test-plan.md:141-146`).

### Raportowanie do Sentry i prywatność

- **Mechanizm:**
    - `captureConsoleIntegration({ levels: ["warn","error"] })` (`src/middleware.ts:26`) zamienia `console.error(..., err)` z `Error` w argumentach na `captureException` ze stackiem; bez `Error` powstaje `captureMessage`.
    - Wszystkie argumenty trafiają do `extra.arguments`, więc nie wolno przekazywać emaila, `token_hash` ani sesji.
    - Działa tylko w scope żądania (`captureconsole.js:22`, `getClient() !== client`).
- **Import `@sentry/cloudflare` w `src/lib`:** ładuje się pod Node (sprawdził pracownik przez `node -e import(...)`; nie sprawdzono w `node --test` z TS stripping). Spójniejszy z bazą kodu jest wstrzykiwany port, jak `DrillSaveLogger` (`drill-configurations.ts:224-229`, testy zbierają wywołania do tablicy, `drill-configurations.test.ts:289-305`).
- **Reguły prywatności:**
    - S-09 zabrania tokenów, emaili i pełnych URL callbacku w logach (`context/archive/2026-10-03-enter-account-by-email-link/plan.md:53,55,71,154`);
    - `wrangler.jsonc` ma `redact_query_string: true`;
    - logger CRUD zapisuje tylko kod (`drill-configurations.ts:223`).
    - Komunikat `AuthError` może zawierać dane konta (`email-auth.test.ts:168`), dlatego bezpieczne pola raportu to `name`, `status` i `code`. `message` wolno wysłać do Sentry tylko dla błędów retryable i tylko po sprawdzeniu, że nie zawiera adresu (decyzja dla planu).
- **Body żądań:** domyślne `httpServerIntegration` zbiera body POST do 10 KB i dołącza je do zdarzeń w żądaniu (`@sentry/cloudflare/build/esm/prod/baseSdk.js:25`, `dev/integrations/httpServer.js:18`, domyślne `httpBodies` w `@sentry/core/.../resolveDataCollectionOptions.js:5`). Raport z `/api/auth/signin` niósłby więc `email=`. Wyłączenie tego (audyt P1) jest warunkiem wstępnym bezpiecznego A2/A3.

## Code References

- `src/middleware.ts:33-44` — `createClient`, `getUser`, odrzucony `error`, klient `null` daje gościa
- `src/middleware.ts:15-27` — opcje Sentry (DSN, release, `captureConsoleIntegration`), brak `dataCollection`
- `src/lib/supabase.ts:7-10` — `null` przy brakujących sekretach
- `src/lib/email-auth.ts:121-124` — `EmailLinkAuthPort`
- `src/lib/email-auth.ts:162-188` — `requestEmailLink` (odrzucony wynik `signInWithOtp`, `catch {}`)
- `src/lib/email-auth.ts:192-214` — `verifyEmailLink` (wszystkie błędy dają ten sam retry)
- `src/lib/email-auth.ts:223`, `:253` — handlery POST
- `src/pages/api/auth/signout.ts:4-10` — ignorowany `signOut()`, brak `prerender = false`
- `src/lib/services/drill-configurations.ts:224-229` — wzorzec wstrzykiwanego loggera
- `src/lib/services/drill-configurations.ts:367-369`, `:429-431`, `:476-478`, `:562-578` — kolejność 401 przed 503
- `src/env.d.ts` — `App.Locals` (`user`, `supabase`)
- `node_modules/@supabase/auth-js/dist/module/lib/fetch.js:22-44`, `:72-78`, `:115-120` — mapowanie odpowiedzi na klasy błędów
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:2670-2727`, `:3409-3449`, `:4290` — `getUser`, `signOut`, czyszczenie sesji

## Architecture Insights

- Kod Astro i Workers zostaje w trasie, middleware lub pliku `.astro`, a logika w `src/lib` za portem lub wstrzykniętą zależnością (`drill-configurations.ts:367`: „kept free of Astro and Supabase so it can be tested with plain Requests”). Decyzja o sesji powinna przejść tę samą drogę, np. pure `resolveSessionUser(auth, report)` → `user | guest | unavailable` w `src/lib`.
- Wzorzec „degrade, don't break” istnieje dla bazy (503 zamiast awarii strony: README; `context/archive/*save-named-drill*/plan.md:24,146`), ale nie dla auth. Auth degraduje do „gościa”, czyli do stanu, którego nie da się odróżnić od zwykłego wylogowania.
- Reguła „ta sama odpowiedź niezależnie od konta” (S-09) i reguła „nie ukrywaj dowodów” (CLAUDE.md, lekcja 5) są zgodne: neutralność dotyczy treści odpowiedzi dla użytkownika, a nie raportu do trackera.

## Historical Context (from prior changes)

- `context/archive/2026-10-03-enter-account-by-email-link/plan.md:71`, `:79`, `:109` — neutralna odpowiedź i retry dla nowego i istniejącego konta. Wspiera regułę anty-enumeracji. Nie mówi nic o awarii dostawcy ani o 200 jako wymaganiu.
- `src/lib/email-auth.ts:183` (komentarz „Keep provider failures account-neutral”) i `email-auth.test.ts:148-160` — jedyne miejsca, które traktują awarię dostawcy jako 200. Twierdzenie „neutralność wymaga 200” jest **częściowo** poparte: neutralność tak, 200 nie.
- `context/archive/*/plan.md` (save-named, edit, delete) — kolejność 401 → 503 → 404 jest świadomą decyzją. Dlatego dziś brak konfiguracji daje 401 (audyt A4).
- PR #68 (commit 05e0d7a), bez folderu w `context/`: serwer używa `@sentry/cloudflare`, bo „Node transport of @sentry/astro silently drops events on Workers” (`astro.config.mjs`). Pusty DSN wyłącza Sentry (CI).
- `context/foundation/test-plan.md:45,48,57,60` — ryzyka #2 (gość widzi treść chronioną) i #5 (redirecty, adres powrotu). Żadne ryzyko z §2 nie obejmuje niewidocznej awarii auth. §2 jest zamrożone, więc nowe ryzyko trzeba zapisać w `change.md` albo przez `/10x-test-plan --refresh`.
- Sprzeczność w dokumentach: `context/changes/deployment/deployment-plan.md:5` podaje „Supabase's built-in SMTP”, a archiwum S-09 (`coordinator-production-preparation.md:35-37`) podaje Brevo. Lokalny limit `email_sent = 2` (`supabase/config.toml:185-197`) działa tylko z własnym SMTP, a ten jest lokalnie wyłączony (`:233`). Audyt A2 cytuje „2/h” zbyt ogólnie.

## Related Research

- `context/audits/observability/2026-10-24_account-entry-saved-timers-timer-run.md` — źródło ustaleń A1–A5 i P1
- `context/archive/2026-10-03-enter-account-by-email-link/research.md` — research S-09 (magic link)

## Open Questions

Decyzje produktowe dla `/10x-plan` (fakty są ustalone, wybór nie):

1. **Sign-in przy awarii dostawcy (A2):**
    - (a) neutralne 200 + raport (rekomendacja audytu): użytkownik czeka na mail, który nie przyjdzie;
    - (b) jednolite 503 „spróbuj później” dla każdego adresu: zgodne z S-09, UI już obsługuje (`SignInForm.tsx:30-37`), ale wymaga zmiany `email-auth.test.ts:148-160` z zapisaną zmianą wymagania.
    - 429 i `email_address_invalid` zostają bez raportu w obu wariantach.
2. **Middleware przy `AuthRetryableFetchError` (A1):**
    - (a) gość + raport (minimalna zmiana);
    - (b) trzeci stan `unavailable` w `App.Locals`: strony chronione dają 503 zamiast 302, `/api/drills*` daje 503 przed 401, strony publiczne renderują gościa.
    - Wariant (b) dotyka `env.d.ts`, `drill-configurations.ts:367-578` i wymaga klasyfikacji nowej strony 503 w `route-inventory.test.ts`.
3. **Callback przy błędzie retryable (A3):** ten sam ekran retry + raport, czy osobny komunikat „chwilowo niedostępne” (wtedy nowe `error=` w URL i stan strony `callback.astro`).
4. **Brak konfiguracji (A4):** raport raz na isolate czy też 503 na endpointach auth i API (zmienia kolejność 401 → 503 z wcześniejszych planów).
5. **Kanał raportu:** wstrzykiwany port (`AuthErrorReporter`, domyślnie `console.error(label, err)` przez `captureConsole`) czy bezpośredni `captureException` z tagiem `auth.step`. Które pola wolno wysłać: `name`, `status`, `code` na pewno; `message` tylko dla retryable?
6. **Zakres P1:** czy wyłączenie zbierania body (`httpServerIntegration({ maxRequestBodySize: "none" })` lub `dataCollection`) wchodzi do tej zmiany jako warunek wstępny. Bez niego raporty z `/api/auth/*` niosą email.
7. **Sign-out (A5):** czy tylko raportować (użytkownik i tak jest wylogowany lokalnie), czy informować o nieudanym wylogowaniu. Przy okazji: dodać brakujące `export const prerender = false` w `signout.ts`.
8. **Niezweryfikowane fakty (do sprawdzenia na lokalnej Supabase przed asercjami):**
    - status `bad_jwt` (401 czy 403);
    - postać błędu przy złym kluczu API (`AuthApiError` 401 bez `code`?);
    - kod błędu `signInWithOtp` przy `shouldCreateUser: false`, choć projekt używa `true`, więc to marginalne.
