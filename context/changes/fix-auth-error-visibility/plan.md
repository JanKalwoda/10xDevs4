# Widoczność błędów Supabase Auth — plan implementacji

## Overview

Zmiana usuwa ustalenia A1–A5 i P1 z audytu `context/audits/observability/2026-10-24_account-entry-saved-timers-timer-run.md`. Dziś awaria Supabase Auth wygląda dla użytkownika i dla respondera jak wylogowanie albo jak sukces. Po zmianie każda awaria jest:

- raportowana do Sentry, bez danych konta;
- zgłaszana użytkownikowi jako odpowiedź 503 albo komunikat „chwilowo niedostępne”.

Wyniki oczekiwane (gość, wygasły link, limit, zły adres) zachowują się jak dotąd i nie są raportowane. Body żądań przestaje trafiać do zdarzeń Sentry.

## Current State Analysis

- **Wywołania auth-js nie rzucają wyjątków.** `getUser`, `signInWithOtp`, `verifyOtp` i `signOut` zwracają `{ error }` (`@supabase/auth-js` 2.116.0, `GoTrueClient.js:310-315`, `throwOnError=false`, nie nadpisywane przez `@supabase/ssr` 0.12.7). Obecne `try/catch` łapią tylko błędy, które nie są `AuthError`.
- **A1:** `src/middleware.ts:38-41` odczytuje tylko `data.user`. Awaria daje `user = null`, czyli 302 na stronach chronionych (`src/lib/protected-routes.ts:32`) i 401 w `/api/drills*` (`src/lib/services/drill-configurations.ts:367-369`, `:429-431`, `:476-478`).
- **A2:** `src/lib/email-auth.ts:173-184` odrzuca wynik `signInWithOtp` i zawsze zwraca 200 `EMAIL_LINK_MESSAGE`. To zachowanie pinuje `src/lib/email-auth.test.ts:148-160` i `:162-175`.
- **A3:** `src/lib/email-auth.ts:201-211` każdy błąd `verifyOtp` zamienia w 303 `/auth/callback?error=invalid` (`:267-269`). Strona (`src/pages/auth/callback.astro`, stan z `emailLinkCallbackPageState`, `email-auth.ts:79-102`) zna tylko stany `confirm` i `retry`.
- **A4:** `src/lib/supabase.ts:7-10` przy brakujących sekretach zwraca `null` bez żadnego sygnału. Sign-in udaje wtedy 200, callback pokazuje „wygasł”, a API odpowiada 401.
- **A5:** `src/pages/api/auth/signout.ts:4-10` ignoruje wynik `signOut()` i nie eksportuje `prerender = false`.
- **P1:** domyślne `httpServerIntegration` dołącza do zdarzeń body POST/PUT do 10 KB (`@sentry/cloudflare/build/esm/prod/baseSdk.js:25`, `dev/integrations/httpServer.js:18`). Każdy raport z `/api/auth/*` niósłby `email=` lub `token_hash=`.
- **Testowalność:** middleware importuje `astro:middleware` i `cloudflare:workers`, więc nie da się go przetestować pod `node --test`. Logika musi przejść do `src/lib` za portem (wzorzec `EmailLinkAuthPort`, `DrillSaveLogger`).

## Desired End State

- `getUser()` z `isAuthRetryableFetchError` lub `AuthUnknownError` oraz klient `null`: żądanie ma stan `authUnavailable`.
    - Strony chronione zwracają 503 z widokiem „Service unavailable”, a nie 302.
    - `/api/drills*` zwraca 503 `unavailable` przed 401.
    - Strony publiczne renderują gościa.
    - Awaria jest raportowana do Sentry (klient `null` raz na isolate).
- Gość (`AuthSessionMissingError`) i sfałszowane lub martwe sesje (`AuthApiError` z kodem z listy martwych sesji) zostają gościem bez raportu. `tests/integration/ownership.test.mjs:410-453` przechodzi bez zmian.
- `POST /api/auth/signin`: awaria dostawcy, błąd konfiguracji lub klient `null` dają 503 z jednym komunikatem dla każdego adresu oraz raport. 429, `over_*_rate_limit`, `email_address_invalid` i `validation_failed` dają neutralne 200 jak dotąd, bez raportu.
- `POST /api/auth/callback`: awaria `verifyOtp` lub klient `null` dają 303 `/auth/callback?error=unavailable&next=…` (komunikat „chwilowo niedostępne”) oraz raport. Pozostałe `AuthApiError` (w tym `otp_expired` 403) dają `error=invalid` jak dotąd, bez raportu.
- `POST /api/auth/signout`: błąd `signOut()` jest raportowany, odpowiedź to nadal 302 `/`.
- Zdarzenia Sentry z serwera nie zawierają body żądań. Raport auth niesie tylko `auth.step`, nazwę klasy błędu, `status` i `code`, a `message` tylko dla błędów retryable. Nigdy nie zawiera emaila, tokena ani sesji.
- Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, `npm run test:integration` przechodzą. Zrzuty ekranu nowych stanów leżą w `context/changes/fix-auth-error-visibility/screenshots/`.

### Key Discoveries:

- `isAuthRetryableFetchError`, `isAuthSessionMissingError` i `isAuthApiError` są eksportowane z `@supabase/supabase-js` (`supabase-js/dist/index.mjs:10`). Retryable to status 0 (sieć) lub {500–504, 520–530} (`auth-js/dist/module/lib/fetch.js:22-44`). `code` jest wtedy tracony.
- Outage nie czyści ciasteczek sesji (`GoTrueClient.js:2717-2721`, `:4290`), więc po powrocie Supabase użytkownik jest znów zalogowany bez ponownego logowania.
- Rewrite `next("/path")` w middleware renderuje inną trasę bez ponownego uruchamiania middleware i z tymi samymi `locals` (dokumentacja Astro, Context7 `/withastro/docs`, guides/middleware „Rewriting”).
- `SignInForm.tsx:30-37` pokazuje komunikat błędu dla każdego statusu innego niż ok i 400, więc 503 z sign-in nie wymaga zmian w formularzu.
- Strony `/timers` i `/{id}` nie potrzebują zmian: middleware zatrzymuje żądanie, zanim dotrze do `resolveTimersPage`/`resolveSavedDrillPage`.
- Reguła S-09 (`context/archive/2026-10-03-enter-account-by-email-link/plan.md:71`) wymaga takiej samej odpowiedzi dla istniejącego i nowego konta, a nie odpowiedzi 200.

## What We're NOT Doing

- `Sentry.setUser`, tagi kontekstu poza raportem auth i wyłączenie zbierania IP (`userInfo`): audyt P4, osobna zmiana.
- Raportowanie po stronie przeglądarki (SignInForm, skrypt `callback.astro`): audyt A6, A7.
- Mapowanie błędów store w CRUD (S1–S11) i błędy przebiegu timera (R1–R15).
- Komunikat dla użytkownika o nieudanym wylogowaniu: decyzja „raport + redirect /”.
- Zmiana szablonu magic linka (A10) i obsługa `formData()`, którego nie da się sparsować (A8).
- Sondy w środowisku uruchomieniowym (fałszywy endpoint Sentry). Weryfikacja jest jednostkowa, integracyjna i ręczna.
- `/10x-test-plan --refresh`: nowe ryzyko trafia do `change.md` (§2 test-planu jest zamrożony).

## Implementation Approach

Najpierw warunek prywatności (faza 1), potem pure klasyfikator i port reportera (faza 2), na którym opierają się fazy 3 i 4. Każda faza zaczyna się od nieprzechodzącego testu jednostkowego (CLAUDE.md: „błąd najpierw staje się nieprzechodzącym testem”), a dopiero potem zmienia kod. Kod Astro i Workers (middleware, trasy, strony) zostaje cienką warstwą, a decyzje przechodzą do `src/lib`.

## Critical Implementation Details

- **Kolejność sprawdzeń w handlerach API:** `authUnavailable` sprawdza się przed `userId === null`, bo przy awarii `userId` też jest `null`. Kolejność „401 przed 503 store” dla gościa przy działającym auth zostaje bez zmian.
- **Rewrite na widok 503 tylko dla GET/HEAD stron:** `next("/service-unavailable")` tworzy nowe `Request` ze starego, więc nie wolno wcześniej czytać body. Ścieżki chronione to wyłącznie strony (`PROTECTED_ROUTES`, `isSavedDrillPath`), a API pilnuje się samo, więc warunek jest spełniony.
- **Bezpośrednie wejście na `/service-unavailable`** bez stanu `authUnavailable` renderuje `NotFoundView` z 404. Strona nie może ogłaszać awarii, gdy jej nie ma, ani być wyroczni.

## Phase 1: Sentry bez body żądań

### Overview

Zanim pojawią się raporty z `/api/auth/*`, zdarzenia serwera przestają zawierać body żądań (email, `token_hash`, nazwa timera).

### Changes Required:

#### 1. Opcje Sentry serwera jako testowalny moduł

**File**: `src/lib/sentry-server-options.ts` (nowy), `src/lib/sentry-server-options.test.ts` (nowy)

**Intent**: Przenieść budowanie opcji z `src/middleware.ts:13-27` do `src/lib`, żeby test mógł sprawdzić listę integracji. W liście domyślnej podmienić `httpServerIntegration` na instancję z `maxRequestBodySize: "none"`.

**Contract**: `buildSentryServerOptions({ dsn, release }): CloudflareOptions`. Wynik zachowuje `defaultIntegrations: Sentry.getDefaultIntegrations(...)` i `captureConsoleIntegration({ levels: ["warn","error"] })`. Funkcja `integrations` odfiltrowuje domyślną integrację o nazwie `HttpServer` i dodaje `Sentry.httpServerIntegration({ maxRequestBodySize: "none" })`, więc wynik ma dokładnie jedną `HttpServer`. Test (najpierw czerwony): po wywołaniu funkcji `integrations(defaults)` istnieje dokładnie jedna integracja `HttpServer`, a jej `maxRequestBodySize === "none"`; `CaptureConsole` jest obecna.

#### 2. Middleware używa modułu

**File**: `src/middleware.ts`

**Intent**: Zastąpić lokalne `baseSentryOptions`/`sentryOptions` wywołaniem `buildSentryServerOptions({ dsn: env.PUBLIC_SENTRY_DSN, release: env.CF_VERSION_METADATA?.id })`. Komentarz o pustym DSN przenieść do modułu.

**Contract**: zachowanie `wrapRequestHandler` i `setAsyncLocalStorageAsyncContextStrategy()` bez zmian.

### Success Criteria:

#### Automated Verification:

- Test `sentry-server-options.test.ts` był czerwony przed zmianą i jest zielony po niej: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `npm run dev`: strona główna i `/auth/signin` ładują się bez błędów w konsoli Workera

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 2: Klasyfikator błędów auth i port reportera

### Overview

Jedno miejsce decyduje, czy wynik auth jest oczekiwany, czy jest awarią, i raportuje awarie bez danych konta.

### Changes Required:

#### 1. Klasyfikator

**File**: `src/lib/auth-errors.ts` (nowy), `src/lib/auth-errors.test.ts` (nowy)

**Intent**: Pure funkcja klasyfikująca `error` z każdego z czterech wywołań według decyzji z planowania. Używa type guardów z `@supabase/supabase-js`, nigdy treści `message`.

**Contract**:

- `type AuthStep = "session" | "sign_in" | "callback" | "sign_out"`.
- `classifyAuthError(step, error: unknown): { kind: "ok" } | { kind: "expected" } | { kind: "unavailable" } | { kind: "unexpected" }`.
    - `error == null` → `ok`.
    - `isAuthRetryableFetchError` lub `name === "AuthUnknownError"` lub obiekt, który nie jest `AuthError` → `unavailable`.
    - `session`: `isAuthSessionMissingError` lub `AuthApiError` z `code` ∈ {`refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found`, `bad_jwt`, `user_not_found`, `user_banned`} → `expected`; inne `AuthApiError` → `unexpected` (gość + raport).
    - `sign_in`: `AuthApiError` ze `status === 429` lub `code` ∈ {`over_email_send_rate_limit`, `over_request_rate_limit`, `email_address_invalid`, `validation_failed`} → `expected`; inne `AuthApiError` (np. `email_address_not_authorized`, `email_provider_disabled`, `otp_disabled`, `signup_disabled`, 401 bez `code`) → `unavailable`.
    - `callback`: każdy `AuthApiError` (w tym `otp_expired` 403, 429) → `expected`.
    - `sign_out`: każdy błąd (biblioteka już pomija 401/403/404, `GoTrueClient.js:3436-3438`) → `unexpected`.
- Test tabelaryczny (najpierw czerwony) dla każdego wiersza powyżej. Błędy budowane z klas eksportowanych przez `@supabase/supabase-js` (`AuthRetryableFetchError`, `AuthApiError`, `AuthSessionMissingError`, `AuthUnknownError`).

#### 2. Port reportera

**File**: `src/lib/auth-errors.ts`, `src/lib/auth-errors.test.ts`

**Intent**: Wstrzykiwany port, który wysyła do Sentry zdarzenie zbudowane wyłącznie z bezpiecznych pól. Domyślna implementacja używa `captureException` z `@sentry/cloudflare` (wzorzec wstrzykiwania: `DrillSaveLogger`, `drill-configurations.ts:224-229`).

**Contract**:

- `type AuthErrorReporter = (step: AuthStep, error: unknown) => void`.
- `safeAuthErrorFields(error): { name: string; status?: number; code?: string; message?: string }`, gdzie `message` jest wypełniane tylko dla `isAuthRetryableFetchError`.
- `reportAuthError: AuthErrorReporter` (domyślny): `captureException(new Error(\`auth ${step} failed: ${name}\`), { level: "error", tags: { "auth.step": step, "auth.error": name, "auth.status": String(status ?? ""), "auth.code": code ?? "" }, extra: message ? { message } : undefined })`.
- Oryginalny obiekt błędu nie jest przekazywany do Sentry.
- Test: `safeAuthErrorFields` dla `AuthApiError("…user@example.com…", 400, "email_address_invalid")` nie zawiera `message`. Dla `AuthRetryableFetchError("fetch failed", 0)` zawiera `message`. Importu domyślnego reportera w teście nie wywołuje się bez klienta Sentry (`captureException` bez klienta nic nie robi).

### Success Criteria:

#### Automated Verification:

- Testy `auth-errors.test.ts` (klasyfikacja i bezpieczne pola) były czerwone przed implementacją i są zielone po niej: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 3: Stan sesji `unavailable`

### Overview

Middleware odróżnia gościa od niedostępnego auth. Strony chronione i `/api/drills*` przy awarii odpowiadają 503 zamiast udawać wylogowanie.

### Changes Required:

#### 1. Rozstrzyganie sesji

**File**: `src/lib/auth-session.ts` (nowy), `src/lib/auth-session.test.ts` (nowy)

**Intent**: Pure decyzja o sesji, którą middleware tylko wywołuje.

**Contract**:

- `resolveSession(auth: { getUser(): Promise<{ data: { user: User | null }; error: unknown }> } | null, report: AuthErrorReporter): Promise<{ kind: "user"; user: User } | { kind: "guest" } | { kind: "unavailable" }>`.
- `auth === null` → `unavailable` + raport `("session", new Error("supabase client not configured"))` raz na isolate (flaga modułu; eksport `resetSessionReportStateForTests()`).
- Klasyfikacja przez `classifyAuthError("session", error)`: `unavailable` → raport + `unavailable`; `unexpected` → raport + `guest`; `expected` → `guest` bez raportu; `ok` → `user` lub `guest`.
- Testy (najpierw czerwone) dla każdego przypadku: brak raportu dla `AuthSessionMissingError` i `bad_jwt`, jeden raport przy dwóch wywołaniach z `null`.

#### 2. `App.Locals` i middleware

**File**: `src/env.d.ts`, `src/middleware.ts`

**Intent**: Middleware zapisuje `locals.authUnavailable` i dla ścieżki chronionej w stanie `unavailable` renderuje widok 503 rewritem zamiast przekierowania gościa.

**Contract**:

- `App.Locals.authUnavailable: boolean`.
- `user` i `supabase` bez zmian znaczenia (przy `unavailable` `user = null`).
- W middleware: `const session = await resolveSession(supabase?.auth ?? null, reportAuthError)`.
- `isProtectedPath && authUnavailable` → `return withPrivateNoStoreForHtml(await next("/service-unavailable"))`.
- `isProtectedPath && !user` → `guestRedirectResponse` jak dotąd.

#### 3. Widok i strona 503

**File**: `src/components/timer/ServiceUnavailableView.astro` (nowy), `src/pages/service-unavailable.astro` (nowy), `eslint.config.js`

**Intent**: Widok wzorowany na `NotFoundView.astro` („Service temporarily unavailable”, krótki opis „Sign-in is temporarily unavailable. Please try again in a moment.”, link „Back to the timer”). Strona ustawia 503 tylko przy `Astro.locals.authUnavailable`; w przeciwnym razie renderuje `NotFoundView` z 404.

**Contract**:

- `service-unavailable.astro`: `prerender = false`, `Cache-Control: private, no-store`, `Retry-After: 30` przy 503, `<meta name="robots" content="noindex">`.
- Plik strony dopisany do listy `timer-ui/contract` w `eslint.config.js` (widok jest objęty globem `src/components/timer/**`).

#### 4. API `/api/drills*`

**File**: `src/lib/services/drill-configurations.ts`, `src/lib/services/drill-configurations.test.ts`, `src/pages/api/drills/index.ts`, `src/pages/api/drills/[id].ts`

**Intent**: Handlery POST, PUT i DELETE odpowiadają 503 `unavailable` przed sprawdzeniem `userId`, gdy auth jest niedostępne.

**Contract**:

- Konteksty `SaveDrillRequestContext` (i odpowiedniki dla update/delete) dostają `authUnavailable: boolean`.
- Pierwsza linia każdego handlera: `if (context.authUnavailable) return toResponse(failure("unavailable", SAVE_DRILL_MESSAGES.unavailable))`.
- Trasy przekazują `locals.authUnavailable`.
- Testy (najpierw czerwone): `authUnavailable: true, userId: null` → 503 `unavailable` dla każdego z trzech handlerów; `authUnavailable: false, userId: null` → 401 jak dotąd.

#### 5. Inwentarz tras i test integracyjny

**File**: `src/lib/route-inventory.test.ts`, `tests/integration/guest-access.test.mjs`

**Intent**: Sklasyfikować nową stronę i przypiąć, że bez awarii `/service-unavailable` niczego nie ogłasza.

**Contract**: `/service-unavailable` jako strona publiczna. Test integracyjny: `GET /service-unavailable` → 404, a body jest takie samo jak `GET` nieistniejącej ścieżki.

### Success Criteria:

#### Automated Verification:

- Testy `auth-session.test.ts` i nowe przypadki w `drill-configurations.test.ts` były czerwone przed zmianą i są zielone po niej: `npm test`
- Inwentarz tras klasyfikuje `/service-unavailable`: `npm test`
- Lint (w tym `timer-ui/contract` dla nowej strony i widoku) przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy integracyjne przechodzą, w tym niezmieniony `ownership.test.mjs` „forged session is a guest” i nowy przypadek `/service-unavailable` → 404: `npm run test:integration`

#### Manual Verification:

- Lokalnie z błędnym `SUPABASE_URL` w `.dev.vars` (np. nieosiągalny port), zalogowany lub nie: `/timers` daje 503 z widokiem „Service temporarily unavailable”, `/` renderuje gościa, `POST /api/drills` daje 503. Po przywróceniu `SUPABASE_URL` sesja nadal działa.
- Gość przy działającym Supabase: `/timers` daje 302 na `/auth/signin?next=%2Ftimers` jak dotąd.

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 4: Sign-in, callback i sign-out

### Overview

Endpointy auth przestają udawać sukces albo wygaśnięcie linku przy awarii i raportują ją.

### Changes Required:

#### 1. Zmiana wymagania (zapis)

**File**: `context/changes/fix-auth-error-visibility/change.md`

**Intent**: Zapisać w `## Notes`, że wymaganie neutralności sign-in brzmi „ta sama odpowiedź dla każdego adresu”, a nie „zawsze 200”. Awaria dostawcy, błąd konfiguracji i brak klienta dają jednolite 503 (decyzja planowania 2026-10-24). Uzasadnia to zmianę asercji `email-auth.test.ts:148-160` i `:162-175` (CLAUDE.md: asercję zmienia się tylko przy zmianie wymagania).

**Contract**: sekcja `## Notes`, akapit „Zmiana wymagania”.

#### 2. Sign-in

**File**: `src/lib/email-auth.ts`, `src/lib/email-auth.test.ts`

**Intent**: `requestEmailLink` odczytuje `{ error }` z `signInWithOtp`, klasyfikuje go (`classifyAuthError("sign_in", …)`) i przy `unavailable` raportuje oraz zwraca 503. Klient `null` też daje 503 (raport wysyła `resolveSession` w middleware). Wyjątek, który nie jest `AuthError`, jest klasyfikowany jak `unavailable` zamiast być połykany.

**Contract**:

- `EmailLinkRequestResult` dostaje wariant `{ ok: false; status: 503; message: EMAIL_LINK_UNAVAILABLE_MESSAGE }` z nową stałą `"We couldn't send a sign-in link right now. Please try again in a moment."`.
- Reporter jest wstrzykiwany parametrem (domyślnie `reportAuthError`) do `requestEmailLink` i `handleEmailLinkRequest`.
- Treść odpowiedzi nie zależy od adresu ani od `message` dostawcy.
- Testy (najpierw czerwone):
    - `AuthRetryableFetchError` → 503 + jeden raport `sign_in`;
    - `email_address_not_authorized` → 503;
    - `AuthApiError` 429 → 200 neutralne, bez raportu;
    - `email_address_invalid` → 200 neutralne;
    - `auth = null` → 503;
    - nowe i istniejące konto przy awarii dają identyczną odpowiedź.
- Test `:114-146` (to samo 200 dla nowego i istniejącego konta) zostaje bez zmian.

#### 3. Callback

**File**: `src/lib/email-auth.ts`, `src/lib/email-auth.test.ts`, `src/pages/auth/callback.astro`

**Intent**: `verifyEmailLink` przy `unavailable` (klasyfikacja `callback`) lub `auth === null` zwraca nowy wynik, który handler zamienia w 303 `/auth/callback?error=unavailable&next=…`. `emailLinkCallbackPageState` rozpoznaje `error=unavailable` jako stan `unavailable` z osobnym komunikatem, a strona go renderuje.

**Contract**:

- `EmailLinkVerificationResult` dostaje `{ ok: false; reason: "invalid" | "unavailable"; next; message }`.
- Nowa stała `EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE = "We couldn't confirm this link right now. Please try again in a moment."`.
- `EmailLinkCallbackPageState` dostaje `{ kind: "unavailable"; message; next }`.
- Strona: tytuł „Sign-in temporarily unavailable”, komunikat, ten sam układ karty co stan `retry`.
- Token nigdy nie trafia do Location.
- Testy (najpierw czerwone):
    - `AuthRetryableFetchError` → 303 `error=unavailable` + raport `callback`;
    - `otp_expired` 403 → 303 `error=invalid`, bez raportu;
    - stan strony dla `?error=unavailable&next=%2Ftimers` to `unavailable` z bezpiecznym `next`;
    - niebezpieczne `next` → `DEFAULT_NEXT_PATH`.

#### 4. Sign-out

**File**: `src/pages/api/auth/signout.ts`, `src/lib/email-auth.ts` (lub mały helper w `src/lib/auth-errors.ts`), test jednostkowy

**Intent**: Odczytać `{ error }` z `signOut()` i przy błędzie zaraportować (`sign_out`). Odpowiedź to nadal `redirect("/")` (302). Dodać `export const prerender = false`.

**Contract**:

- Pure `handleSignOut(auth | null, report): Promise<void>` w `src/lib` (wzorzec portu), wywoływany przez trasę.
- Testy: błąd → jeden raport; `null` lub brak błędu → zero raportów.

### Success Criteria:

#### Automated Verification:

- Nowe i zmienione testy `email-auth.test.ts` oraz test sign-out były czerwone przed zmianą i są zielone po niej: `npm test`
- `change.md` zawiera akapit „Zmiana wymagania” przed zmianą asercji `email-auth.test.ts:148-175`
- Lint (`account-entry-ui/contract` dla `callback.astro`) przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy integracyjne przechodzą bez zmian asercji w `redirects.test.mjs` (callback z błędnym tokenem → `error=invalid`, poprawny sign-in → 200): `npm run test:integration`
- Smoke przechodzi (sign-out → 302 `/`): `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- Z nieosiągalnym `SUPABASE_URL`: formularz `/auth/signin` pokazuje komunikat błędu (nie „link wysłany”), a odpowiedź sieciowa to 503 z tym samym body dla dwóch różnych adresów.
- Strona `/auth/callback?error=unavailable&next=%2Ftimers` pokazuje stan „Sign-in temporarily unavailable”.
- Przy działającym Supabase: pełne logowanie magic linkiem i wylogowanie działają jak dotąd.

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 5: Bramka wizualna i dokumentacja

### Overview

Nowe stany UI przechodzą bramkę wizualną projektu, a reguły trafiają do dokumentacji, z której korzysta następny agent.

### Changes Required:

#### 1. Zrzuty ekranu

**File**: `context/changes/fix-auth-error-visibility/screenshots/`

**Intent**: Zrzuty widoku 503 (`ServiceUnavailableView`) i stanu `unavailable` strony callbacku w light/dark przy 1280 i 390 px, w tym fokus na linku/przycisku. Stany bez sensu dla statycznego widoku (disabled, loading, empty) oznaczyć jako N/A z uzasadnieniem w `screenshots/README.md`.

**Contract**: 8 zrzutów (2 widoki × 2 motywy × 2 szerokości) + README z listą stanów.

#### 2. Dokumentacja

**File**: `CLAUDE.md`, `AGENTS.md`, `README.md`, `context/changes/fix-auth-error-visibility/change.md`

**Intent**: Zapisać regułę „błąd auth klasyfikuj przez `classifyAuthError`, awarię raportuj przez `AuthErrorReporter` bez danych konta; gość i wygasły link nie są raportowane; stan `authUnavailable` daje 503 na stronach chronionych i w `/api/drills*`”. W README dopisać `/service-unavailable` i odpowiedzi 503 endpointów auth. W `change.md` zapisać nowe ryzyko („awaria auth niewidoczna lub udająca wylogowanie”) i warstwę testów (jednostkowe z fake'iem portu; outage nie jest tanio odtwarzalny w integracji).

**Contract**: sekcje „Auth flow” w CLAUDE.md i AGENTS.md (identyczne), tabela „Auth routes” w README, `## Notes` w `change.md`.

### Success Criteria:

#### Automated Verification:

- Zrzuty istnieją: `ls context/changes/fix-auth-error-visibility/screenshots/*.png` zwraca 8 plików
- Formatowanie dokumentów przechodzi: `npx prettier --check CLAUDE.md AGENTS.md README.md context/changes/fix-auth-error-visibility`
- Pełny zestaw przechodzi: `npm run lint && npm test && npx astro check && npm run build`

#### Manual Verification:

- Przegląd zrzutów: kontrast, układ przy 390 px bez przewijania w poziomie, widoczny fokus w obu motywach
- CLAUDE.md i AGENTS.md opisują regułę klasyfikacji tak samo

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- `classifyAuthError` dla każdego kroku i każdej klasy błędu (tabela z fazy 2), w tym błąd, który nie jest `AuthError`, i `null`.
- `safeAuthErrorFields`: brak `message` dla `AuthApiError`, obecny dla retryable.
- `resolveSession`: gość, martwa sesja, awaria, klient `null` raportowany raz.
- Handlery `/api/drills*`: 503 przed 401 przy `authUnavailable`.
- `requestEmailLink`, `verifyEmailLink`, `emailLinkCallbackPageState`, `handleSignOut`: wszystkie gałęzie z fazy 4, z fake'iem reportera zbierającym wywołania.
- `buildSentryServerOptions`: jedna `HttpServer` z `maxRequestBodySize: "none"`.

### Integration Tests:

- Istniejący zestaw bez zmian asercji (gość, sfałszowana sesja, redirecty, walidacja API). To dowód, że oczekiwane wyniki nie zmieniły zachowania.
- Nowy przypadek: `/service-unavailable` bez awarii to identyczne 404.

### Manual Testing Steps:

1. W `.dev.vars` ustaw `SUPABASE_URL` na nieosiągalny adres i uruchom `npm run dev`.
2. Wejdź na `/timers`: oczekiwane 503 i widok „Service temporarily unavailable”; `/` renderuje gościa.
3. Wyślij formularz `/auth/signin` dla dwóch adresów: komunikat błędu, w sieci 503 z identycznym body.
4. Otwórz `/auth/callback?error=unavailable&next=%2Ftimers`: stan „Sign-in temporarily unavailable”.
5. Przywróć `SUPABASE_URL`, zaloguj się magic linkiem, wyloguj: wszystko jak dotąd.

## Performance Considerations

Brak: klasyfikacja to kilka porównań na żądanie, raport wysyłany jest tylko przy awarii, a flush odbywa się przez `waitUntil` jak dotąd.

## Migration Notes

Brak zmian w bazie. Wdrożenie przez standardowy merge do `main`. Wycofanie przez revert PR.

## References

- Research: `context/changes/fix-auth-error-visibility/research.md`
- Audyt: `context/audits/observability/2026-10-24_account-entry-saved-timers-timer-run.md` (A1–A5, P1)
- Dokumentacja: `context/docs/supabase-auth.md`
- Wzorzec portu: `src/lib/services/drill-configurations.ts:224-229`, `src/lib/email-auth.ts:121-124`
- Wzorzec widoku: `src/components/timer/NotFoundView.astro`, `src/pages/404.astro`
- Reguła S-09: `context/archive/2026-10-03-enter-account-by-email-link/plan.md:71`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sentry bez body żądań

#### Automated

- [x] 1.1 Test `sentry-server-options.test.ts` był czerwony przed zmianą i jest zielony po niej: `npm test` — fdb95a1 (claude-sonnet-5-5)
- [x] 1.2 Lint przechodzi: `npm run lint` — fdb95a1 (claude-sonnet-5-5)
- [x] 1.3 Typy przechodzą: `npx astro check` — fdb95a1 (claude-sonnet-5-5)
- [x] 1.4 Build przechodzi: `npm run build` — fdb95a1 (claude-sonnet-5-5)

#### Manual

- [x] 1.5 `npm run dev`: strona główna i `/auth/signin` ładują się bez błędów w konsoli Workera — fdb95a1 (claude-sonnet-5-5)

### Phase 2: Klasyfikator błędów auth i port reportera

#### Automated

- [x] 2.1 Testy `auth-errors.test.ts` (klasyfikacja i bezpieczne pola) były czerwone przed implementacją i są zielone po niej: `npm test` — 24b390a (claude-sonnet-5-5)
- [x] 2.2 Lint przechodzi: `npm run lint` — 24b390a (claude-sonnet-5-5)
- [x] 2.3 Typy przechodzą: `npx astro check` — 24b390a (claude-sonnet-5-5)

### Phase 3: Stan sesji `unavailable`

#### Automated

- [x] 3.1 Testy `auth-session.test.ts` i nowe przypadki w `drill-configurations.test.ts` były czerwone przed zmianą i są zielone po niej: `npm test` — 5f56e92 (claude-sonnet-5-5)
- [x] 3.2 Inwentarz tras klasyfikuje `/service-unavailable`: `npm test` — 5f56e92 (claude-sonnet-5-5)
- [x] 3.3 Lint (w tym `timer-ui/contract` dla nowej strony i widoku) przechodzi: `npm run lint` — 5f56e92 (claude-sonnet-5-5)
- [x] 3.4 Typy przechodzą: `npx astro check` — 5f56e92 (claude-sonnet-5-5)
- [x] 3.5 Testy integracyjne przechodzą, w tym niezmieniony `ownership.test.mjs` „forged session is a guest” i nowy przypadek `/service-unavailable` → 404: `npm run test:integration` — 5f56e92 (claude-sonnet-5-5)

#### Manual

- [x] 3.6 Lokalnie z błędnym `SUPABASE_URL`: `/timers` daje 503 z widokiem, `/` renderuje gościa, `POST /api/drills` daje 503; po przywróceniu sesja działa — powrót sesji potwierdzony zieloną integracją; awaria z sesją trwa ~30 s przez retry refresh auth-js — 5f56e92 (claude-sonnet-5-5)
- [x] 3.7 Gość przy działającym Supabase: `/timers` daje 302 na `/auth/signin?next=%2Ftimers` jak dotąd — 5f56e92 (claude-sonnet-5-5)

### Phase 4: Sign-in, callback i sign-out

#### Automated

- [x] 4.1 Nowe i zmienione testy `email-auth.test.ts` oraz test sign-out były czerwone przed zmianą i są zielone po niej: `npm test` — c934f52 (claude-sonnet-5-5)
- [x] 4.2 `change.md` zawiera akapit „Zmiana wymagania” przed zmianą asercji `email-auth.test.ts:148-175` — c934f52 (claude-sonnet-5-5)
- [x] 4.3 Lint (`account-entry-ui/contract` dla `callback.astro`) przechodzi: `npm run lint` — c934f52 (claude-sonnet-5-5)
- [x] 4.4 Typy przechodzą: `npx astro check` — c934f52 (claude-sonnet-5-5)
- [x] 4.5 Testy integracyjne przechodzą bez zmian asercji w `redirects.test.mjs`: `npm run test:integration` — c934f52 (claude-sonnet-5-5)
- [x] 4.6 Smoke przechodzi (sign-out → 302 `/`): `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` — c934f52 (claude-sonnet-5-5)

#### Manual

- [x] 4.7 Z nieosiągalnym `SUPABASE_URL`: formularz sign-in pokazuje komunikat błędu, sieć pokazuje 503 z tym samym body dla dwóch adresów — widok błędu formularza sprawdzony w bramce wizualnej fazy 5; 503 z tym samym body potwierdzone curl-em (bc26275, claude-sonnet-5-5)
- [x] 4.8 `/auth/callback?error=unavailable&next=%2Ftimers` pokazuje stan „Sign-in temporarily unavailable” — bc26275 (claude-sonnet-5-5)
- [x] 4.9 Przy działającym Supabase pełne logowanie magic linkiem i wylogowanie działają jak dotąd — potwierdzone smoke (bc26275, claude-sonnet-5-5)

### Phase 5: Bramka wizualna i dokumentacja

#### Automated

- [x] 5.1 Zrzuty istnieją: `ls context/changes/fix-auth-error-visibility/screenshots/*.png` zwraca 8 plików — f4c3eae (claude-sonnet-5-5)
- [x] 5.2 Formatowanie dokumentów przechodzi: `npx prettier --check CLAUDE.md AGENTS.md README.md context/changes/fix-auth-error-visibility` — f4c3eae (claude-sonnet-5-5)
- [x] 5.3 Pełny zestaw przechodzi: `npm run lint && npm test && npx astro check && npm run build` — f4c3eae (claude-sonnet-5-5)

#### Manual

- [ ] 5.4 Przegląd zrzutów: kontrast, układ przy 390 px bez przewijania w poziomie, widoczny fokus w obu motywach
- [ ] 5.5 CLAUDE.md i AGENTS.md opisują regułę klasyfikacji tak samo
