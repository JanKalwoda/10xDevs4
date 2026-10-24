# Widoczność błędów Supabase Auth — Plan Brief

> Full plan: `context/changes/fix-auth-error-visibility/plan.md`
> Research: `context/changes/fix-auth-error-visibility/research.md`

## What & Why

Dziś awaria Supabase Auth jest niewidoczna dla respondera i myląca dla użytkownika:

- outage wygląda jak masowe wylogowanie;
- awaria wysyłki magic linka zwraca 200 „link wysłany”;
- awaria potwierdzenia mówi „link wygasł”.

Sentry nie dostaje nic, bo auth-js zwraca `{ error }` zamiast rzucać wyjątek (audyt A1–A5). Zmiana sprawia, że awarie są raportowane bez danych konta, a użytkownik dostaje uczciwe „chwilowo niedostępne”.

## Starting Point

- Middleware (`src/middleware.ts:38-41`), sign-in i callback (`src/lib/email-auth.ts:162-214`) oraz sign-out (`src/pages/api/auth/signout.ts`) ignorują albo spłaszczają `{ error }`.
- Brak sekretów daje cichy klient `null`.
- Sentry dołącza body żądań (email, `token_hash`) do zdarzeń.

## Desired End State

- Przy awarii auth strony chronione i `/api/drills*` odpowiadają 503 (widok „Service temporarily unavailable”), a strony publiczne renderują gościa.
- Sign-in daje jednolite 503 dla każdego adresu, callback pokazuje „chwilowo niedostępne”, błąd wylogowania jest raportowany.
- Każda awaria trafia do Sentry z krokiem, klasą, statusem i kodem, nigdy z emailem.
- Gość, sfałszowana sesja, wygasły link i limit działają jak dotąd i nie są raportowane.

## Key Decisions Made

| Decyzja                | Wybór                                                                               | Dlaczego                                                                                  | Źródło   |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Rozpoznanie awarii     | `isAuthRetryableFetchError` / `AuthUnknownError` / błąd, który nie jest `AuthError` | type guardy biblioteki, bez dopasowywania tekstu; gość i `bad_jwt` to nie awaria          | Research |
| Sign-in przy awarii    | jednolite 503 + raport                                                              | S-09 wymaga tej samej odpowiedzi dla każdego konta, nie 200; użytkownik nie czeka na mail | Plan     |
| Middleware przy awarii | stan `authUnavailable`: 503 na stronach chronionych i w API, gość na publicznych    | awaria przestaje wyglądać jak wylogowanie, brak pętli logowania                           | Plan     |
| Callback przy awarii   | `error=unavailable` z osobnym komunikatem                                           | użytkownik nie marnuje linku, który nadal może być ważny                                  | Plan     |
| Brak sekretów          | jak `unavailable`, raport raz na isolate                                            | jedna ścieżka kodu, zepsuty deploy widoczny od razu                                       | Plan     |
| Kanał raportu          | port `AuthErrorReporter`, domyślnie `captureException` z bezpiecznymi tagami        | testowalny fake'iem, pełna kontrola pól (bez emaila)                                      | Plan     |
| Body żądań w Sentry    | wyłączone w fazie 1 (`maxRequestBodySize: "none"`)                                  | bez tego raporty z `/api/auth/*` niosą email                                              | Plan     |
| Sign-out przy błędzie  | raport + 302 `/`                                                                    | użytkownik wylogowany lokalnie, smoke bez zmian                                           | Plan     |

## Scope

**In scope:**

- A1–A5 i P1 (body żądań)
- nowy widok i strona 503
- stan `unavailable` w callbacku
- `prerender = false` w `signout.ts`
- zrzuty ekranu i dokumentacja

**Out of scope:**

- `setUser` i zbieranie IP (P4)
- raportowanie w przeglądarce (A6, A7)
- błędy store CRUD (S1–S11) i przebiegu timera (R1–R15)
- komunikat o nieudanym wylogowaniu
- szablon magic linka (A10)
- sondy w środowisku uruchomieniowym

## Architecture / Approach

Decyzje przechodzą do `src/lib` za portami (wzorzec `EmailLinkAuthPort`, `DrillSaveLogger`):

- `auth-errors.ts`: klasyfikator i reporter;
- `auth-session.ts`: decyzja o sesji;
- `sentry-server-options.ts`: opcje Sentry serwera.

Middleware i trasy tylko je wywołują. Strony chronione przy awarii przechodzą rewritem `next("/service-unavailable")` (bez ponownego uruchamiania middleware). Handlery API sprawdzają `authUnavailable` przed `userId`.

## Phases at a Glance

| Faza                           | Co dostarcza                                      | Główne ryzyko                                                                 |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Sentry bez body             | zdarzenia bez emaila i tokena                     | podwójna integracja `HttpServer`, jeśli filtr nie zadziała                    |
| 2. Klasyfikator + reporter     | jedna tabela decyzji i bezpieczne pola raportu    | kod błędu spoza listy martwych sesji daje szum (nadal gość)                   |
| 3. Stan `unavailable`          | 503 na stronach chronionych i w `/api/drills*`    | rewrite i bezpośrednie wejście na `/service-unavailable` (musi dać 404)       |
| 4. Sign-in, callback, sign-out | 503, `error=unavailable`, raport wylogowania      | zmiana asercji `email-auth.test.ts:148-175` wymaga zapisanej zmiany wymagania |
| 5. Bramka wizualna + docs      | 8 zrzutów, reguły w CLAUDE.md, AGENTS.md i README | —                                                                             |

**Prerequisites:** lokalna Supabase (Docker) do testów integracyjnych i smoke; PR #69 (raport audytu) zmergowany lub praca na tej samej gałęzi.

**Estimated effort:** ~3 sesje w 5 fazach.

## Open Risks & Assumptions

- Status `bad_jwt` i postać błędu przy złym kluczu API nie były sprawdzone na żywym serwerze. Kod spoza listy daje gościa z raportem, czyli szum, ale nie zmianę zachowania. `ownership.test.mjs` to wychwyci.
- Import `@sentry/cloudflare` w `src/lib` ładuje się pod Node, ale nie był uruchamiany w `node --test`. Faza 1 to potwierdzi jako pierwsza.
- Prawdziwego outage nie da się tanio odtworzyć w testach integracyjnych. Zastępują go nieosiągalny `SUPABASE_URL` w weryfikacji ręcznej i testy jednostkowe z fake'iem portu.

## Success Criteria (Summary)

- Przy niedostępnej Supabase użytkownik widzi „chwilowo niedostępne” zamiast prośby o logowanie albo „link wysłany”, a Sentry dostaje zdarzenie z krokiem i statusem, bez emaila.
- Gość, sfałszowana sesja i wygasły link zachowują się identycznie jak dziś (niezmienione testy integracyjne).
