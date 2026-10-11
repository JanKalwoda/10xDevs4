# Test rollout Phase 1 — granice dostępu, własności, przekierowań i walidacji API: plan wdrożenia

## Overview

Wydzielamy z `scripts/smoke.mjs` wszystkie kroki HTTP dowodzące ryzyk #1, #2, #5 i #6 (`context/foundation/test-plan.md §2`) do nowego zestawu integracyjnego na `node:test`. Zestaw wysyła `fetch` do działającego `astro preview` (runtime Cloudflare/workerd) z lokalnym Supabase, a sesje tworzy przez magic link z Mailpit. Zestaw dostaje też brakujące przypadki z „Mapy pokrycia” w `research.md`, a w CI uruchamia go job `smoke`. Smoke zostaje przy przepływie logowania i przy trybie `remote` dla bramki `deploy`. Plan kończy aktualizacja cookbooka `test-plan.md §6.2` oraz wiersza „integration” w §4.

## Current State Analysis

- Warstwa „HTTP przeciw lokalnemu Supabase” już istnieje: `scripts/smoke.mjs` (943 linie) w trybie `local` działa w CI w jobie `smoke` (`.github/workflows/ci.yml`, krok „Run local Mailpit E2E against production preview”). Smoke to jeden sekwencyjny scenariusz ze wspólnym stanem (`savedDrill`, `otherDrill`, `fillerIds`, `smoke.mjs:322,455,393`) i jednym słoikiem ciasteczek na moduł (`smoke.mjs:37`). Szczegóły błędów są wyciszone (`smoke.mjs:940-942`), więc awaria pokazuje tylko nazwę kroku.
- Tryb `remote` (`smoke.mjs:729-782`) działa po deployu w jobie `deploy` i korzysta z `verifyAnonymousDrillApi`, `verifyGuestEdit` i `verifyGuestDelete`. Ta zmiana nie może go osłabić.
- Luki bez dowodu HTTP (research, „Mapa pokrycia”): POST/HEAD gościa na stronach chronionych, sfałszowane ciasteczko, warianty ścieżek w runtime, inwentarz tras, obcy `next` u każdego konsumenta, `href` linków powrotu w SSR na `/{id}` i `/{id}/edit`, a dla #6 pusta nazwa, `exercise 0:00`, `repetitions 0/101` i nieznane pole przez HTTP.
- Runner: `npm test` = `node --test src/lib/*.test.ts src/lib/services/*.test.ts` (Node 24.21.0 sam usuwa typy). Lint: `scripts/**/*.mjs` ma `disableTypeChecked` i globalne zmienne Node (`eslint.config.js`, `scriptsConfig`).
- Limity auth lokalnego Supabase: `sign_in_sign_ups = 30` i `token_verifications = 30` na 5 min na IP (`supabase/config.toml:194-196`).

## Desired End State

- `npm run test:integration` uruchamia `tests/integration/*.test.mjs` przeciw działającej aplikacji (`BASE_URL`, `MAILPIT_URL`, tylko lokalne originy). Każdy przypadek jest niezależny: konto jest wspólne w obrębie pliku, ale każdy test tworzy własne timery z unikalnymi nazwami.
- Każda asercja z lokalnego smoke dla #1/#2/#5/#6 ma swój odpowiednik w zestawie (tabela „krok smoke → nowy test” niżej), a luki z „Mapy pokrycia” mają przypadki.
- `src/lib/route-inventory.test.ts` w `npm test` nie przepuszcza nowej strony w `src/pages/**`, dopóki nie zostanie jawnie sklasyfikowana.
- Lokalny smoke zawiera tylko przepływ logowania i paska. Tryb `remote` się nie zmienia.
- Job `smoke` w CI uruchamia smoke i zestaw integracyjny jako osobne kroki przeciw temu samemu preview.
- `test-plan.md §6.2` opisuje, jak dodać test dla trasy chronionej lub granicy własności, a §4 i §5 pokazują warstwę „integration” jako podłączoną.

Weryfikacja: `npm run lint`, `npm test`, `npx astro check`, a przy uruchomionym lokalnym Supabase i preview `npm run smoke` oraz `npm run test:integration` przechodzą. CI na PR jest zielone.

### Key Discoveries:

- Strażnik middleware patrzy tylko na pathname, nie na metodę (`src/middleware.ts:21`). Odpowiedź gościa ma pusty `null` body, `302`, `Location` i `Cache-Control: private, no-store` (`src/lib/protected-routes.ts:32-37`).
- `/create` nie ma własnego strażnika (`src/pages/create.astro:1-8`) i zależy wyłącznie od listy middleware (`protected-routes.ts:3`).
- Obcy `next` u konsumentów (`src/lib/email-auth.ts`):
  - `POST /api/auth/signin` daje 400 `{ok:false}` przed wywołaniem Supabase (`:162-171`), więc nie zużywa limitu auth;
  - `POST /api/auth/callback` z obcym `next` daje 303 na `/auth/callback?error=invalid&next=%2Ftimers` (`:193-196,267-271`);
  - GET `/auth/callback?next=<obcy>` renderuje stan retry (`:83-86`);
  - `/auth/signin` ustawia ukryte pole `next` na `/timers` (`signin.astro:7-8`, `SignInForm.tsx:44`);
  - `/auth/confirm-email` ma `href="/auth/signin"` (`confirm-email.astro:10-12`);
  - legacy `/auth/signup` daje 302 na `/auth/signin` (`email-auth.ts:104-106`).
- Nieznane pole (`user_id`) daje 400 z kodem walidacji i pustym `fieldErrors` (`src/lib/services/drill-configurations.ts:111-114`), więc asercja dotyczy kodu i braku wiersza, nie pola.
- Linki SSR: `SavedDrillDetails.tsx:34` (`/{id}/edit`), `:39` (`/timers`); `DrillEditApp.tsx:16,19` (`/{id}`, `/timers`). Obie wyspy mają `client:load`, więc są w HTML z SSR (`[id].astro:53`, `[id]/edit.astro:53`).
- Bieżące pliki `src/pages/` (18): 5 typów stron chronionych (`dashboard`, `create`, `timers`, `[id]`, `[id]/edit`), publiczne `index`, `404`, `auth/*`, `dev/timer-ui` (w produkcji 404, sprawdzane w CI), API `api/auth/*` (publiczne) i `api/drills/*` (same zwracają 401, `protected-routes.test.ts:14`).

## What We're NOT Doing

- Mocki klienta bazy, nowe zależności (vitest, supertest, playwright, msw) i klucz service-role. Sesje tworzymy tylko przez Mailpit.
- Kliknięcia w przeglądarce (przejścia klienckie po zapisie i usunięciu to Faza 3 test-planu; tu dowodzą ich testy jednostkowe kontrolerów).
- Część #6 o strzałkach steppera (Faza 2 test-planu).
- Zmiany w trybie `remote` smoke, w jobie `deploy` i w sekretach CI.
- Asercja, że edycja zostaje na formularzu. Zestaw sprawdza po PUT tylko, czy `/{id}` pokazuje nowe wartości, więc pozostaje prawdziwy przed zmianą produktu poniżej i po niej.
- Zmiana statusu wiersza §3 w `test-plan.md`: robi to orkiestrator `/10x-test-plan`.

### Propozycja osobnej zmiany produktu: cel po zapisaniu edycji

Decyzja autora (research, Decisions 3): po udanym zapisie edycji użytkownik trafia na `/{id}`. To zmiana zachowania aplikacji, więc **nie jest częścią tego planu**. Prowadzić ją jako osobną zmianę: `/10x-new edit-redirect-to-saved-timer`, potem `/10x-research`, `/10x-plan` i jedna faza `/10x-tdd`.

- **Wyrocznia (dopisać przed testem)**: rozszerzenie PRD FR-017, np. „Po zapisaniu zmian w edycji zapisanego timera użytkownik trafia na widok tego timera (`/{id}`).”
- **Pierwszy czerwony test**: „po udanym zapisie edycji kontroler nawiguje dokładnie raz do `/{id}`”. Zastępuje `src/lib/drill-create-controller.test.ts:339` („edit mode never navigates”); nieudany zapis edycji nadal nie nawiguje.
- **Do zmiany wtedy**: `DrillEditApp.tsx` (tryb `keepAfterSave`, domyślna nawigacja `location.assign` jak przy tworzeniu), `src/components/timer/EditDrillFixtures.tsx` (stan `saved` staje się stanem przekierowania, jak `saving` przy tworzeniu), zrzuty bramki wizualnej w folderze tej zmiany, opis `/{id}/edit` w README i CLAUDE.md.

## Implementation Approach

Kolejność „najpierw wspólny klient, potem przypadki, na końcu cięcie smoke” sprawia, że przez Fazy 2–4 przeniesione asercje są w obu miejscach. Smoke traci je dopiero w Fazie 5, po sprawdzeniu tabeli mapowania. Pliki zestawu są podzielone według ryzyka, a każdy plik działa we własnym procesie `node --test`, więc konta są wspólne tylko w obrębie pliku:

| Plik | Ryzyka | Konta (logowania na przebieg) |
|---|---|---|
| `tests/integration/guest-access.test.mjs` | #2 | brak |
| `tests/integration/redirects.test.mjs` | #5 (obcy `next`) | brak |
| `tests/integration/ownership.test.mjs` | #1, #2 (sfałszowane ciasteczko, gość na prawdziwym id), #5 (linki SSR, zapis → `/{id}`) | A, B |
| `tests/integration/api-validation.test.mjs` | #6 | V, L (limit) |

Razem 4 logowania z zestawu i 2 ze smoke, czyli ok. 6 z limitu 30 na 5 min.

Wyrocznie pochodzą ze źródeł, nie z kodu:
- PRD Access Control, Guardrails i NFR „dostępne wyłącznie właścicielowi” (#1, #2);
- FR-011 i FR-017 (`/timers` jako start, po zapisie `/{id}`);
- roadmapa S-17 (linki powrotu i usunięcie → `/timers`);
- archiwum S-12 (link `Back to timer` → `/{id}` na edycji);
- FR-001 i S-10 (zakresy, 1–200 znaków, limit 50);
- research Decisions 4 (302 dla każdej metody na stronie chronionej).

### Tabela „krok smoke → nowy test”

Kroki lokalnego smoke (`runLocalSmoke`, `smoke.mjs:784-934`):

| # | Krok smoke (skrót nazwy `runStep`) | Gdzie po zmianie |
|---|---|---|
| L1 | public home route | zostaje w smoke |
| L2 | anonymous dashboard redirects to sign-in | `guest-access`: GET/POST/HEAD `/dashboard` |
| L3 | anonymous timers list redirects to sign-in | `guest-access`: GET/POST/HEAD `/timers` |
| L4 | anonymous drill API 401 and /create redirects | `guest-access`: POST `/api/drills` 401 `unauthorized` + no-store; GET/POST/HEAD `/create` |
| L5–L8 | email request without next, Mailpit, confirmation GET, explicit POST | zostaje w smoke (domyślny `next` = `/timers`) |
| L9 | top bar + barred pages no-store | zostaje w smoke |
| L10 | SSR cookies authorize the dashboard | zostaje w smoke |
| L11 | user reaches /create, timers list links to it (+ `Back to timers` → `/timers`) | `ownership`: „owner navigation links” |
| L12 | saves, duplicates, invalid and wrong-type | 201 + UUID + konfiguracja + `/{id}` 200 no-store z nazwą → `ownership`: „owner save”; 409 `duplicate_name` z `fieldErrors.name`, 400 `rest 99:99`, 415 → `api-validation` |
| L13 | timers list shows the saved timer and /{id} details (noindex, no-store, no running view) | `ownership`: „owner details” |
| L14 | account page shows the account only | `ownership`: „account page lists no timers” |
| L15 | owner edits: PUT 200, list and /{id}/edit show new values, other timer untouched | `ownership`: „owner edit” (+ `/{id}` pokazuje nowe wartości) |
| L16 | edit rules: duplicate, case-only, 200/201, invalid, 415, restore | `api-validation`: „PUT rules” |
| L17 | 50-timer limit, also concurrent | `api-validation` (konto L) |
| L18 | edit at the limit | `api-validation` (konto L) |
| L19 | owner delete at the limit: 403 Origin, 405 Allow, 204, repeat = same 404, freed slot one save, others stay | 403/405/204/powtórka = 404 bajt w bajt/inne timery zostają → `ownership`: „owner delete”; zwolnione miejsce przyjmuje jeden zapis, usunięta nazwa wolna → `api-validation` (konto L) |
| L20 | sign-out clears the session | zostaje w smoke |
| L21 | anonymous /{id} redirect with next, non-UUID plain 404 | `guest-access` (losowy UUID) + `ownership` (świeży klient gościa na prawdziwym id A) |
| L22 | anonymous PUT 401, /{id}/edit redirect, /not-a-uuid/edit = /not-a-uuid bajt w bajt | `guest-access` + `ownership` (prawdziwe id A, A niezmieniony) |
| L23 | anonymous DELETE 401 | `guest-access` + `ownership` (prawdziwe id A, A nadal istnieje) |
| L24 | second account signs in | `ownership` (konto B) |
| L25 | B: foreign == random 404 (status, bajty, nagłówki), == /not-a-uuid == /abc/def, no-store, brak id; lista B pusta | `ownership`: „foreign details page” |
| L26 | B: PUT i /edit — foreign == random == malformed | `ownership`: „foreign edit” |
| L27 | B: DELETE foreign == random == malformed, == PUT 404 | `ownership`: „foreign delete” |
| L28 | sign-out clears the second account | pokryte przez L20 (smoke) |
| L29 | signed-out home links Sign in | zostaje w smoke |
| L30–L35 | existing-account request, Mailpit, GET, POST, top bar, dashboard | zostaje w smoke |
| L36 | first account's timers unchanged after B | `ownership`: „owner data unchanged” (nazwa i linia parametrów obu timerów A) |
| L37–L40 | sign-out, signed-out home, malformed link, consumed link | zostaje w smoke |

## Critical Implementation Details

- **Ścieżki z `//`**: `new URL("//timers", origin)` traktuje `//timers` jak host. Warianty ścieżek trzeba budować z surowego stringa (`appOrigin + "//timers"`), a klient musi ostrzec, gdy wynikowy origin różni się od aplikacji, zamiast przepisywać ścieżkę.
- **POST na stronę**: wysyłać nagłówek `Origin` aplikacji i typ formularza. Bez niego `checkOrigin` Astro może odpowiedzieć 403, zanim zadziała middleware, a wyrocznią Decisions 4 jest wyłącznie 302.
- **Diagnostyka bez wycieku**: komunikaty asercji mogą zawierać status, ścieżkę i fragment HTML, ale nigdy wartości ciasteczek, `token_hash` ani pełnego linku z maila. Konta są jednorazowe (`…@example.com`).
- **Limit auth nie wygląda jak błąd w kodzie**: aplikacja ukrywa błędy dostawcy przy wysyłce linku (`email-auth.ts:182`, zawsze neutralne 200), a odrzucone potwierdzenie daje 303 na `/auth/callback?error=invalid`. Przekroczony limit (`sign_in_sign_ups` / `token_verifications`, 30 na 5 min na IP) objawia się więc jako „mail nie dotarł” albo „link odrzucony” podczas `signIn`, a nie jako 429. Dlatego te dwa błędy `signIn` mają mieć jeden czytelny komunikat (patrz Faza 1).
- **Brak cichego pominięcia**: gdy `BASE_URL` lub `MAILPIT_URL` nie są lokalne albo aplikacja nie odpowiada, zestaw ma failować z czytelnym komunikatem. Nie wolno mu pominąć testów i zostawić CI zielonego.

## Faza 1: Wspólny klient HTTP i szkielet zestawu

### Overview

Wydzielamy ze smoke pomocniki HTTP i sesji do modułu wielokrotnego użytku z klientem bez stanu globalnego. Smoke przechodzi na ten moduł bez zmiany zachowania, a powstaje pusty zestaw z guardami środowiska.

### Changes Required:

#### 1. Moduł klienta aplikacji i Mailpit

**File**: `scripts/lib/app-client.mjs` (nowy)

**Intent**: Przenieść ze smoke słoik ciasteczek, `appRequest`, `originRequest`, `snapshot`, `responseLocation`, `visibleText`, `decodeHtmlAttribute`, logowanie przez Mailpit (`requestEmailLink`, `waitForEmail`, `callbackFromMessage`, `confirmLink`, `signInNewAccount`) oraz walidację `BASE_URL` i `MAILPIT_URL`. Każdy klient ma mieć własny słoik, żeby jeden plik testów mógł mieć konta A, B i gościa jednocześnie.

**Contract**:
- `resolveLocalTargets(env)` zwraca `{ appOrigin, mailpitUrl }` albo rzuca błąd przy nielokalnym originie (te same reguły co `smoke.mjs:12-32` dla trybu local).
- `createAppClient(appOrigin)` zwraca `{ request(path, opts), rawRequest(rawUrl, opts), originRequest, snapshot(path), cookieNames(), withCookies(map) }`. `request` odrzuca inny origin; `rawRequest` służy do wariantów ścieżek.
- `createMailpit(mailpitUrl)` z `waitForEmail(email)` (zbiór odebranych ID na instancję).
- `signIn(client, mailpit, email, next)` zwraca link. Gdy mail nie dotrze w terminie albo callback przekieruje na `error=invalid`, rzuca błąd z komunikatem w rodzaju: `Sign-in failed (no email / link rejected). Most likely the local Supabase auth limit (30 sign-ins or verifications per 5 min per IP) was hit, not an app bug: wait 5 minutes and run again before debugging.` Komunikat nie zawiera adresu, tokenu ani ciasteczek. Używa go też smoke: komunikat trafia do jego linii `FAIL`, bo jest bezpieczny, a szczegóły innych błędów nadal są wyciszone.
- Stałe wspólne: `NEUTRAL_MESSAGE`, `RETRY_MESSAGE`, `DRILL_DEFAULTS`, `UUID_PATTERN`.

Nazwy wewnętrzne dobiera implementujący.

#### 2. Smoke na wspólnym module

**File**: `scripts/smoke.mjs`

**Intent**: Zastąpić lokalne kopie pomocników importem z `scripts/lib/app-client.mjs` (jeden klient na przebieg), bez zmiany kroków, ich nazw i asercji.

**Contract**: Wyjście `PASS …` / `FAIL …` i kod wyjścia bez zmian w obu trybach. Wyciszenie szczegółów błędów (`smoke.mjs:940-942`) zostaje.

#### 3. Szkielet zestawu i skrypt

**File**: `tests/integration/environment.test.mjs` (nowy), `package.json`

**Intent**: Pierwszy test sprawdza, że cel jest lokalny i aplikacja odpowiada (`GET /` → 200). Skrypt npm uruchamia cały katalog.

**Contract**: `"test:integration": "node --test tests/integration/*.test.mjs"`. Zmienne `BASE_URL` (domyślnie `http://localhost:4321`) i `MAILPIT_URL` (domyślnie `http://localhost:55324`).

#### 4. Lint dla zestawu

**File**: `eslint.config.js`

**Intent**: Objąć `tests/**/*.mjs` tą samą konfiguracją co `scripts/**/*.mjs` (bez reguł typowanych, globalne Node), żeby `npm run lint` przechodził.

**Contract**: `scriptsConfig.files` zawiera `"tests/**/*.mjs"`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Local smoke still passes against a running app with local Supabase: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`
- Integration skeleton passes: `npm run test:integration`
- Integration suite fails with a clear message when `BASE_URL` is not a local origin: `BASE_URL=https://example.com npm run test:integration`

#### Manual Verification:

- Smoke output lists the same step names in the same order as before the refactor
- A sign-in failure (simulated once, e.g. with a wrong `MAILPIT_URL` port so no email arrives) prints the auth-limit message with the instruction to wait 5 minutes, without email, token or cookie values

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 2: #2 gość, obcy `next` (#5) i inwentarz tras

### Overview

Przypadki bez konta: każda metoda gościa na każdej stronie chronionej, 401 z API, warianty ścieżek w runtime oraz obcy `next` u każdego konsumenta. Do tego test jednostkowy inwentarza tras.

### Changes Required:

#### 1. Gość na trasach chronionych

**File**: `tests/integration/guest-access.test.mjs` (nowy)

**Intent**: Udowodnić PRD Access Control i Decisions 4: bez sesji każda metoda na stronie chronionej daje wyłącznie przekierowanie do logowania bez treści, a API odmawia bez zmian.

**Contract**:
- Dla ścieżek `/dashboard`, `/create`, `/timers`, `/{losowy uuid}`, `/{losowy uuid}/edit`, `/timers?x=1`, każdej metody GET, POST i HEAD (jeden test z pętlą `t.test` po metodzie i ścieżce, nie kopie):
  - status 302;
  - `Location` = `/auth/signin?next=<encodeURIComponent(ścieżka z zapytaniem)>`;
  - ciało puste (dla GET i POST `text() === ""`);
  - `Cache-Control` zawiera `private` i `no-store`.
- Warianty ścieżek w runtime (`/%63reate`, `/%74imers`, `//timers` przez `rawRequest`, `/timers/`, `/dashboard/`, `/{UUID wielkimi literami}`, `/{uuid}/edit/`):
  - status 302, `Location` ze ścieżką `/auth/signin`, puste ciało;
  - `next` (jeśli jest) jest bezpieczną ścieżką lokalną: zaczyna się od `/`, nie od `//`.
  - Dokładnej wartości `next` dla wariantów nie sprawdzamy: wyrocznią jest „brak treści”, nie normalizacja.
- API bez sesji:
  - `POST /api/drills`, `PUT /api/drills/{losowy uuid}` i `DELETE /api/drills/{losowy uuid}` dają 401 `{ok:false, code:"unauthorized"}` z `no-store`;
  - `/not-a-uuid` i `/not-a-uuid/edit` dają 404 bez `Location`, bajt w bajt identyczne (status, ciało, `cache-control`, `content-type`, `referrer-policy`).

#### 2. Obcy `next`

**File**: `tests/integration/redirects.test.mjs` (nowy)

**Intent**: Udowodnić drugą połowę #5: parametr powrotu nigdy nie prowadzi poza aplikację. Wyrocznia: PRD FR-017 (domyślnie lista timerów) i research #5.

**Contract**: Tabela obcych wartości `https://evil.example/x`, `//evil.example`, `/\evil.example`, `/%2F%2Fevil.example`, `javascript:alert(1)`, sparametryzowana w jednym teście na konsumenta:
- `POST /api/auth/signin` (`email` lokalny, `next` obcy): 400 `{ok:false}` i w Mailpit brak wiadomości do tego adresu po krótkim oknie (np. 2 s);
- `POST /api/auth/callback` (`token_hash` dowolny, `type=email`, `next` obcy): 303 i `Location` = `/auth/callback?error=invalid&next=%2Ftimers`;
- `GET /auth/callback?token_hash=x&type=email&next=<obcy>`: 200 i stan retry („Sign-in link unavailable”), bez formularza `email-link-confirmation`;
- `GET /auth/signin?next=<obcy>`: 200 i ukryte pole `name="next"` z `value="/timers"`;
- `GET /auth/signup?next=<obcy>`: 302 i `Location` = `/auth/signin`;
- `GET /auth/confirm-email?next=<obcy>`: 200 i link „Use a different email address” z `href="/auth/signin"`.

Każdy przypadek ma jeszcze kontrolę pozytywną z `next=/timers` lub `/create`, żeby test nie przeszedł przez to, że konsument zawsze ignoruje `next`. Np. `/auth/signin?next=/create` daje ukryte `value="/create"`, a `/auth/signup?next=/create` daje `Location` `/auth/signin?next=%2Fcreate`.

#### 3. Inwentarz tras

**File**: `src/lib/route-inventory.test.ts` (nowy)

**Intent**: Wykryć nową stronę, której ktoś zapomni dodać do ochrony. Każdy plik w `src/pages/**` musi być jawnie sklasyfikowany. Wyrocznia: PRD Access Control. Klasyfikacja jest listą w teście, nie wynikiem z kodu.

**Contract**:
- Test czyta `src/pages` rekursywnie (`node:fs`) i mapuje plik na trasę (`index` → `/`, `[id]` → przykładowy UUID).
- Klasy jawne w teście: `PUBLIC_PAGES` (`/`, `/404`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/auth/callback`, `/dev/timer-ui`), `PUBLIC_API` (`/api/auth/*`), `SELF_GUARDED_API` (`/api/drills`, `/api/drills/[id]`, zwracają 401 same), `PROTECTED_PAGES` (`/dashboard`, `/create`, `/timers`, `/[id]`, `/[id]/edit`).
- Asercje:
  - każdy plik należy do dokładnie jednej klasy (nieznany plik → błąd z jego ścieżką);
  - `isProtectedPath(trasa) === true` dla każdej `PROTECTED_PAGES`;
  - `false` dla `PUBLIC_*` i `SELF_GUARDED_API`.
- Wzorzec czytania plików jak `drill-configurations.test.ts:395`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests including the route inventory pass: `npm test`
- Guest and redirect integration tests pass against the running app: `npm run test:integration`
- Route inventory fails with the file path when a new page file is added to `src/pages/` without being classified (checked once with a temporary file, then removed)

#### Manual Verification:

- Each foreign-`next` consumer has a passing positive control, so a consumer that ignores `next` entirely would fail the suite

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 3: #1 własność (konta A i B) i linki SSR

### Overview

Przenosimy wszystkie kroki własności i ścieżek właściciela ze smoke do niezależnych testów z dwoma kontami i dodajemy sfałszowane ciasteczko oraz `href` linków powrotu.

### Changes Required:

#### 1. Zestaw własności

**File**: `tests/integration/ownership.test.mjs` (nowy)

**Intent**: Udowodnić PRD Guardrails i NFR „dostępne wyłącznie właścicielowi”. B nie odróżnia timera A od nieistniejącego na żadnej powierzchni, a dane A się nie zmieniają. Dowód idzie przez prawdziwy klient z kluczem publishable i JWT, czyli to, czego pgTAP nie dowodzi.

**Contract**:
- `before`: konta A i B przez `signIn` (każde z własnym klientem).
- Każdy test tworzy własne timery A z unikalną nazwą (`<test>-<uuid>`) i nie zależy od kolejności.
- Przypadki (nazwy testów jak w tabeli mapowania):
  - **owner save** (L12, FR-017): 201, UUID, konfiguracja 5/4/2/3/false; `GET /{id}` daje 200, `no-store` i nazwę.
  - **owner details** (L13): na liście `href="/{id}"`, nazwa i linia parametrów; na `/{id}` `noindex`, `no-store`, parametry i `Start`, bez `Cancel drill` i `Pause`.
  - **owner navigation links** (L11, S-17, S-12):
    - `/timers` ma link `Create a timer` → `/create`, a `/create` ma `Back to timers` → `/timers` i nie ma tekstu „Back to the timer”;
    - `/{id}` ma `href="/{id}/edit"` i link „Back to timers” z `href="/timers"`;
    - `/{id}/edit` ma „Back to timer” z `href="/{id}"` oraz „Back to timers” z `href="/timers"`.
  - **account page lists no timers** (L14): `/dashboard` nie zawiera id, nazwy ani tekstów listy.
  - **owner edit** (L15):
    - PUT 200 z nowymi wartościami;
    - lista, `/{id}` i `/{id}/edit` (`value=…`) pokazują nowe wartości;
    - drugi timer A bez zmian.
  - **owner delete** (L19, część właściciela):
    - DELETE z obcym `Origin` i bez `Origin` daje 403, a timer nadal ma 200;
    - GET, POST i PATCH na `/api/drills/{id}` dają 405 z `Allow: PUT, DELETE`;
    - DELETE daje 204 z pustym ciałem i `no-store`, potem `/{id}` daje 404 i timera nie ma na liście;
    - powtórne DELETE == losowy == nie-UUID (status, bajty, nagłówki);
    - inne timery A zostają.
  - **foreign details page** (L25):
    - B na `/{id A}` dostaje to samo co na `/{losowy}`, `/not-a-uuid` i `/abc/def`: 404, bajty i trzy nagłówki identyczne, `no-store`, brak id A w treści;
    - lista B nie zawiera id ani nazwy A.
  - **foreign edit** (L26): PUT B na id A == losowy == nie-UUID (404, bajty, nagłówki, `no-store`, brak id); strona `/{id A}/edit` == losowy == nie-UUID.
  - **foreign delete** (L27): DELETE B na id A == losowy == nie-UUID, a ciało == 404 z PUT bajt w bajt.
  - **owner data unchanged** (L36): po próbach B lista A ma nazwę i linię parametrów każdego timera A sprzed prób.
  - **guest on a real id** (L21–L23):
    - świeży klient bez ciasteczek na `/{id A}` i `/{id A}/edit` dostaje 302 z `next`;
    - PUT i DELETE dają 401;
    - potem A widzi timer niezmieniony.
  - **forged session = guest** (nowa luka #2):
    - klient z nazwami ciasteczek A i wartością `garbage`, potem klient z wartością A zmodyfikowaną o jeden znak w tokenie;
    - `/timers` i `/{id A}` dają 302 na `/auth/signin`, `PUT /api/drills/{id A}` daje 401;
    - A widzi timer niezmieniony.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Ownership integration tests pass against the running app: `npm run test:integration`
- Each ownership test passes when run alone: `node --test --test-name-pattern="<test name>" tests/integration/ownership.test.mjs` (checked for at least the foreign and owner delete cases)

#### Manual Verification:

- Every ownership row of the "smoke step → new test" table (L11–L15, L19 owner part, L21–L27, L36) has a named test with the same assertions

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 4: #6 walidacja API i limit 50

### Overview

Po jednym przypadku HTTP na klasę błędu dla POST i PUT, z dowodem, że baza nie przyjęła ani nie zmieniła wiersza. Do tego reguły edycji i limit 50 na osobnym koncie.

### Changes Required:

#### 1. Zestaw walidacji

**File**: `tests/integration/api-validation.test.mjs` (nowy)

**Intent**: Udowodnić FR-001 i S-10 niezależnie od formularza: trasa w runtime naprawdę wywołuje walidator, a odrzucenie nie zostawia śladu w danych. Macierz wartości granicznych zostaje w testach jednostkowych (`drill-configurations.test.ts:98-168`, `drill-update.test.ts:90-123`).

**Contract**:
- Konta V (walidacja) i L (limit), każde z własnym klientem.
- **POST classes** (jeden test, sparametryzowane podtesty), dla klas:
  - pusta nazwa `""`;
  - 201 znaków;
  - `exercise: "0:00"`;
  - `repetitions: "0"` i `"101"`;
  - `rest: "99:99"`;
  - dodatkowe pole `user_id: <losowy uuid>`.
  
  Każdy podtest sprawdza:
  - status 400, `code: "validation"`, `no-store`;
  - `fieldErrors.<pole>` jest stringiem dla klas pól (dla `user_id` bez wymogu pola);
  - liczba linków `href="/{uuid}"` na `/timers` przed żądaniem i po nim jest równa.
- **PUT classes**: te same klasy na timer V utworzony w teście. Po każdym odrzuceniu `/{id}` pokazuje oryginalną nazwę i parametry.
- **POST/PUT rules** (L12 i L16):
  - duplikat w innej wielkości liter daje 409 `duplicate_name` z `fieldErrors.name`;
  - zmiana samej wielkości liter własnej nazwy przez PUT daje 200;
  - PUT z nazwą 200 znaków daje 200, a z 201 daje 400 (pole `name`);
  - `Content-Type: text/plain` daje 415 `unsupported_media_type` (POST i PUT).
- **limit 50** (L17–L19, konto L):
  - 48 zapisów sekwencyjnie, potem 5 współbieżnych o różnych nazwach: dokładnie 2 × 201 i 3 × 409 `limit_reached`;
  - 51. zapis daje 409 `limit_reached`;
  - edycja przy limicie daje 200;
  - po DELETE jednego timera: dokładnie jeden zapis o usuniętej nazwie daje 201, następny 409.
  - Wynik współbieżny to tylko sygnał regresji; blokadę dowodzi pgTAP (komentarz `smoke.mjs:390-392` przenieść).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Validation and limit integration tests pass against the running app: `npm run test:integration`
- Full suite stays within the auth budget: two consecutive `npm run test:integration` runs within 5 minutes both pass

#### Manual Verification:

- Every #6 row of the "smoke step → new test" table (L12 validation part, L16–L19 limit part) has a named test with the same assertions

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 5: Odchudzenie smoke i bramka CI

### Overview

Usuwamy z lokalnego smoke kroki przeniesione do zestawu (według tabeli), zostawiamy tryb `remote` bez zmian i podłączamy zestaw w jobie `smoke`.

### Changes Required:

#### 1. Lokalny smoke tylko dla logowania

**File**: `scripts/smoke.mjs`

**Intent**: `runLocalSmoke` zawiera tylko kroki oznaczone w tabeli „zostaje w smoke” (L1, L5–L10, L20, L29–L35, L37–L40). Usuwamy funkcje używane wyłącznie przez przeniesione kroki. `runRemoteSmoke` i funkcje, których używa, zostają bez zmian.

**Contract**:
- Tryb `remote` daje te same kroki i asercje co przed zmianą.
- Lokalny smoke loguje jedno konto (nowe i istniejące).
- Komentarz nagłówka pliku wskazuje `tests/integration/` jako miejsce testów tras, własności i walidacji.

#### 2. Kroki CI

**File**: `.github/workflows/ci.yml` (job `smoke`)

**Intent**: Rozdzielić obecny krok na start preview, smoke Mailpit, zestaw integracyjny i sprawdzenie `/dev/timer-ui` = 404, żeby awaria zestawu była widoczna jako osobny krok.

**Contract**:
- Krok „Start production preview”: `npm run preview -- --port 4321 &`, potem pętla gotowości z błędem, gdy serwer nie wstanie.
- Krok „Run local Mailpit smoke against production preview”: bez zmian w komendzie.
- Krok „Run integration suite against production preview”: `BASE_URL=http://localhost:4321 MAILPIT_URL=http://localhost:55324 npm run test:integration`.
- Krok sprawdzenia 404 dla `/dev/timer-ui`.
- Proces preview uruchomiony w tle żyje do końca joba. Gdyby się okazało inaczej, wrócić do jednego kroku z `set -e`, zachowując kolejność.
- Job `deploy` i job `ci` bez zmian.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Local smoke passes with the reduced step list: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`
- Integration suite passes: `npm run test:integration`
- CI on the PR is green, with separate "smoke" and "integration suite" steps in job `smoke`

#### Manual Verification:

- Every row of the "smoke step → new test" table is either still in smoke or has its named integration test (row-by-row check against the final files)
- `runRemoteSmoke` diff is empty apart from imports, so the `deploy` gate is not weakened

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą.

---

## Faza 6: Cookbook §6.2, Stack §4 i dokumentacja

### Overview

Zapisujemy wzorzec jako kanoniczną odpowiedź na pytanie „jak dodać test trasy chronionej lub granicy własności” i oznaczamy bramkę integracyjną jako podłączoną.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Uzupełnić cookbook i stan stacku o to, co dostarczyła Faza 1 rolloutu.

**Contract**:
- §6.2 zastępuje „TBD” wpisem z elementami:
  - lokalizacja `tests/integration/<ryzyko>.test.mjs`;
  - nazewnictwo testów według zachowania;
  - testy referencyjne (`ownership.test.mjs` „foreign details page”, `guest-access.test.mjs`);
  - klient `scripts/lib/app-client.mjs` (jeden klient na konto, `rawRequest` dla wariantów);
  - zasady: wyrocznia ze źródła, porównanie „foreign == missing” bajt w bajt, unikalne nazwy na test, bez service-role i mocków bazy;
  - **ponowne używanie kont**: nowy przypadek używa kont już logowanych w swoim pliku (A, B, V, L) i własnych timerów z unikalnymi nazwami; nowe konto tylko wtedy, gdy przypadek wymaga stanu konta (np. limit 50). Obecny budżet to 4 logowania zestawu + 2 smoke, czyli ok. 6 z 30 na przebieg, a w CI każdy przebieg startuje od zera;
  - **błąd logowania = najpierw odczekaj 5 minut**: komunikat o limicie auth oznacza przekroczenie 30 logowań lub weryfikacji na 5 min na IP (ok. 5 szybkich przebiegów lokalnie albo kilka worktree na jednym lokalnym Supabase). Odczekać 5 minut i uruchomić ponownie, zanim zacznie się szukać błędu w kodzie;
  - nowa strona wymaga klasyfikacji w `src/lib/route-inventory.test.ts`;
  - uruchomienie: `npx supabase start`, `npm run build && npm run preview`, `npm run test:integration`.
- §4: wiersz „integration (trasy, ochrona, własność)” pokazuje `node:test` + `fetch` + Mailpit (`tests/integration/`, Node 24.21.0); wiersz „HTTP smoke” opisuje tylko przepływ logowania i tryb remote; zdanie profilu bazy testów nie twierdzi już, że trasy API i ochrona tras nie mają testów.
- §5: wiersz „integration” ma „required (wired)” i miejsce „local + CI (`smoke`)”.
- §6.6: 2–3 linie o tym, czego faza nauczyła (np. warstwa już istniała w smoke, potrzebne było jej wydzielenie).
- „Last updated” = data wdrożenia.

#### 2. README i CLAUDE.md

**File**: `README.md`, `CLAUDE.md`, `AGENTS.md`

**Intent**: Opisać nowy skrypt i nowy podział smoke/zestaw, żeby kolejny agent dodawał przypadki we właściwym miejscu.

**Contract**:
- README:
  - „Available Scripts” dostaje `npm run test:integration` (wymaga lokalnego Supabase i działającej aplikacji);
  - sekcje „Smoke test” i „CI” opisują nowy krok;
  - sekcja smoke mówi, że lokalny tryb pokrywa przepływ logowania.
- CLAUDE.md i AGENTS.md, sekcja „CI”: jedna linia „trasy, ochrona, własność i walidacja API: `tests/integration/` (`npm run test:integration`, job `smoke`); dodaj przypadek dla każdej nowej trasy chronionej lub endpointu, używaj istniejących kont pliku i sklasyfikuj stronę w `src/lib/route-inventory.test.ts`; błąd logowania w zestawie oznacza zwykle limit auth: odczekaj 5 minut i uruchom ponownie (`test-plan.md §6.2`)”.

### Success Criteria:

#### Automated Verification:

- Lint and format checks pass: `npm run lint`
- `test-plan.md §6.2` no longer contains "TBD"

#### Manual Verification:

- A reader can add a test for a new protected route using only `test-plan.md §6.2` (reference test, helper, run command, auth budget)
- §4 and §5 rows describe the wired integration layer and match the CI job
- §6.2 states the account-reuse rule and the "wait 5 minutes and rerun on a sign-in failure" instruction, and the CLAUDE.md/AGENTS.md CI line points to it

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- `src/lib/route-inventory.test.ts`: klasyfikacja każdego pliku `src/pages/**`, ochrona chronionych, brak ochrony publicznych.
- Istniejące testy jednostkowe zostają źródłem macierzy wartości #6 i przejść klienckich #5 (bez zmian).

### Integration Tests:

- `guest-access`, `redirects`, `ownership`, `api-validation` (opis w Fazach 2–4) przeciw `astro preview` i lokalnemu Supabase.

### Manual Testing Steps:

1. `npx supabase start`, `npm run build && npm run preview -- --port 4321`.
2. `npm run test:integration`: wszystkie pliki przechodzą, a awaria pokazuje nazwę testu i status bez danych sesji.
3. Celowo zepsuć jedno zachowanie lokalnie (np. usunąć `/create` z `PROTECTED_ROUTES`) i sprawdzić, że failuje i test jednostkowy inwentarza, i `guest-access`. Cofnąć zmianę.
4. `SMOKE_MODE=local npm run smoke`: zostaje tylko przepływ logowania.

## Performance Considerations

Najdłuższy jest test limitu (ok. 55 zapisów). Pliki działają równolegle (domyślna współbieżność `node --test`), więc czas zestawu jest zbliżony do czasu najdłuższego pliku. Logowania (4 na przebieg) są głównym kosztem i ograniczeniem (limit 30 na 5 min).

## Migration Notes

Brak zmian w bazie i sekretach. Przeniesienie asercji odbywa się bez okna bez pokrycia: smoke traci kroki dopiero w Fazie 5, po potwierdzeniu tabeli mapowania.

## References

- Research: `context/changes/testing-access-boundaries/research.md` (Mapa pokrycia, Decisions 2026-10-11)
- Test plan: `context/foundation/test-plan.md` §2, §3 Phase 1, §4, §5, §6.2
- Istniejący smoke: `scripts/smoke.mjs:66-90,225-234,326-934`
- Strażnik: `src/middleware.ts:7-29`, `src/lib/protected-routes.ts:3-37`
- Konsumenci `next`: `src/lib/email-auth.ts:25-51,79-106,138-141,162-171,253-273`
- Walidacja: `src/lib/services/drill-configurations.ts:44-117`
- Wzorzec testu czytającego pliki: `src/lib/services/drill-configurations.test.ts:395`
- CI: `.github/workflows/ci.yml` (job `smoke`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wspólny klient HTTP i szkielet zestawu

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — a6663d0
- [x] 1.2 Unit tests pass: `npm test` — a6663d0
- [x] 1.3 Type check passes: `npx astro check` — a6663d0
- [x] 1.4 Local smoke still passes against a running app with local Supabase: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke` — a6663d0
- [x] 1.5 Integration skeleton passes: `npm run test:integration` — a6663d0
- [x] 1.6 Integration suite fails with a clear message when `BASE_URL` is not a local origin: `BASE_URL=https://example.com npm run test:integration` — a6663d0

#### Manual

- [x] 1.7 Smoke output lists the same step names in the same order as before the refactor (script, not human) — a6663d0
- [x] 1.8 A sign-in failure (simulated once, e.g. with a wrong `MAILPIT_URL` port so no email arrives) prints the auth-limit message with the instruction to wait 5 minutes, without email, token or cookie values (script, not human) — a6663d0

### Phase 2: #2 gość, obcy `next` (#5) i inwentarz tras

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — f3a095c
- [x] 2.2 Unit tests including the route inventory pass: `npm test` — f3a095c
- [x] 2.3 Guest and redirect integration tests pass against the running app: `npm run test:integration` — f3a095c
- [x] 2.4 Route inventory fails with the file path when a new page file is added to `src/pages/` without being classified (checked once with a temporary file, then removed) — f3a095c

#### Manual

- [x] 2.5 Each foreign-`next` consumer has a passing positive control, so a consumer that ignores `next` entirely would fail the suite (script, not human) — f3a095c

### Phase 3: #1 własność (konta A i B) i linki SSR

#### Automated

- [x] 3.1 Lint passes: `npm run lint`
- [x] 3.2 Ownership integration tests pass against the running app: `npm run test:integration`
- [x] 3.3 Each ownership test passes when run alone: `node --test --test-name-pattern="<test name>" tests/integration/ownership.test.mjs` (checked for at least the foreign and owner delete cases)

#### Manual

- [x] 3.4 Every ownership row of the "smoke step → new test" table (L11–L15, L19 owner part, L21–L27, L36) has a named test with the same assertions (script, not human)

### Phase 4: #6 walidacja API i limit 50

#### Automated

- [ ] 4.1 Lint passes: `npm run lint`
- [ ] 4.2 Validation and limit integration tests pass against the running app: `npm run test:integration`
- [ ] 4.3 Full suite stays within the auth budget: two consecutive `npm run test:integration` runs within 5 minutes both pass

#### Manual

- [ ] 4.4 Every #6 row of the "smoke step → new test" table (L12 validation part, L16–L19 limit part) has a named test with the same assertions

### Phase 5: Odchudzenie smoke i bramka CI

#### Automated

- [ ] 5.1 Lint passes: `npm run lint`
- [ ] 5.2 Local smoke passes with the reduced step list: `SMOKE_MODE=local BASE_URL=http://localhost:4321 npm run smoke`
- [ ] 5.3 Integration suite passes: `npm run test:integration`
- [ ] 5.4 CI on the PR is green, with separate "smoke" and "integration suite" steps in job `smoke`

#### Manual

- [ ] 5.5 Every row of the "smoke step → new test" table is either still in smoke or has its named integration test (row-by-row check against the final files)
- [ ] 5.6 `runRemoteSmoke` diff is empty apart from imports, so the `deploy` gate is not weakened

### Phase 6: Cookbook §6.2, Stack §4 i dokumentacja

#### Automated

- [ ] 6.1 Lint and format checks pass: `npm run lint`
- [ ] 6.2 `test-plan.md §6.2` no longer contains "TBD"

#### Manual

- [ ] 6.3 A reader can add a test for a new protected route using only `test-plan.md §6.2` (reference test, helper, run command, auth budget)
- [ ] 6.4 §4 and §5 rows describe the wired integration layer and match the CI job
- [ ] 6.5 §6.2 states the account-reuse rule and the "wait 5 minutes and rerun on a sign-in failure" instruction, and the CLAUDE.md/AGENTS.md CI line points to it
