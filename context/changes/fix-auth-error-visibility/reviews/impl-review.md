<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Widoczność błędów Supabase Auth

- **Plan**: context/changes/fix-auth-error-visibility/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automatyczna weryfikacja w tym przeglądzie: `npm test` 375/375, `npm run lint` czysty, `npx astro check` 0 błędów, `npm run build` OK, 8 plików `screenshots/*.png`, `prettier --check` OK. `npm run test:integration` i smoke nie były uruchamiane ponownie (wymagają lokalnego Supabase i działającej aplikacji); Progress 3.5, 4.5, 4.6 opiera się na wynikach implementacji. Ręczne kroki (1.5, 3.6, 3.7, 4.7–4.9, 5.4, 5.5) mają opisane dowody w Progress, zrzutach i `screenshots/README.md`.

## Findings

### F1 — `message` błędu 5xx może nieść tekst dostawcy z adresem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:61-62
- **Detail**: Komentarz zakłada, że błąd retryable to zawsze błąd transportu. W `@supabase/auth-js/dist/main/lib/fetch.js` (`handleError`) odpowiedź 500–530 z ciałem JSON staje się `AuthRetryableFetchError(_getErrorMessage(data), status)`, czyli niesie `msg`/`message`/`error_description` napisane przez serwer Auth (np. błąd SMTP lub send-email hooka przy `signInWithOtp`, który może cytować adres). Ten tekst trafia do `extra.message` w Sentry, wbrew regule „never an email”.
- **Fix**: Wypełniać `message` tylko przy `status === 0` (prawdziwy błąd fetch); dla 5xx wystarczą `status` i `code`. Dodać przypadek do `auth-errors.test.ts` (`AuthRetryableFetchError("…user@example.com…", 500)` → brak `message`).
- **Decision**: PENDING

### F2 — Wylogowanie z martwą sesją jest raportowane jako awaria

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:40-41
- **Detail**: `GoTrueClient._signOut` zwraca wcześnie `sessionError` (np. `refresh_token_not_found` z odświeżenia), gdy nie jest to `AuthSessionMissingError`. Krok `sign_out` klasyfikuje każdy błąd jako `unexpected`, więc kliknięcie „Sign out” z wygasłą sesją wysyła zdarzenie do Sentry. To szum sprzeczny z zasadą „martwa sesja nie jest raportowana” (krok `session` traktuje `DEAD_SESSION_CODES` jako `expected`). Plan zakładał, że biblioteka już filtruje 401/403/404 — dotyczy to tylko `admin.signOut`, nie błędu wczytania sesji.
- **Fix**: W kroku `sign_out` traktować `AuthSessionMissingError` i `AuthApiError` z kodem z `DEAD_SESSION_CODES` jako `expected`; test regresji w `auth-errors.test.ts` / `auth-signout.test.ts`.
- **Decision**: PENDING

### F3 — Status odpowiedzi sign-in może zależeć od adresu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:33-37
- **Detail**: W kroku `sign_in` każdy `AuthApiError` spoza `EXPECTED_SIGN_IN_CODES` i bez 429 daje 503, reszta 200. Plan świadomie wymienia `email_address_not_authorized` jako `unavailable`, ale ten kod (domyślny SMTP Supabase) zależy od adresu, a ewentualne kody zależne od stanu konta (np. `user_banned`, nieweryfikowane w źródle GoTrue) też dałyby 503 tylko dla części adresów. Reguła S-09 to „ta sama odpowiedź dla każdego adresu” — sama treść 503 jest jednolita, ale status 200 vs 503 może różnić się per adres. To problem planu, nie odchylenie implementacji.
- **Fix A ⭐ Recommended**: 503 tylko dla retryable/unknown/nie-AuthError i błędów konfiguracji niezależnych od adresu (`email_provider_disabled`, `otp_disabled`, `signup_disabled`); pozostałe 4xx raportować, ale odpowiadać neutralnym 200.
    - Strength: Zachowuje S-09 bez wyjątków i nadal raportuje nieoczekiwane kody.
    - Tradeoff: Użytkownik z adresem odrzuconym przez dostawcę widzi „link wysłany” i nie dostaje maila (jak przed zmianą); wymaga zmiany asercji testów `email_address_not_authorized` → 200 i aktualizacji „Zmiana wymagania”.
    - Confidence: MED — zależy od listy kodów, które GoTrue zwraca dla OTP.
    - Blind spot: Nie sprawdzono pełnej listy kodów GoTrue dla `/otp`.
- **Fix B**: Zostawić jak jest i zapisać w `change.md` akceptację ryzyka (produkcja używa własnego SMTP, więc `email_address_not_authorized` nie występuje).
    - Strength: Bez zmian kodu; operator widzi błędy konfiguracji jako 503.
    - Tradeoff: Pozostaje teoretyczny oracle zależny od konfiguracji dostawcy.
    - Confidence: MED — prawdziwe tylko, jeśli produkcja ma własny SMTP.
    - Blind spot: Konfiguracja SMTP produkcji nie została sprawdzona.
- **Decision**: PENDING

### F4 — Zmieniony wygląd istniejącego stanu `retry` callbacku bez zrzutów

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/auth/callback.astro:35, :47
- **Detail**: Poprawka kontrastu (`pt-4`, link `text-foreground underline` zamiast `text-primary hover:underline`) dotyka też istniejącego stanu `retry`, nie tylko nowego `unavailable`. Uzasadnione w `screenshots/README.md`, ale stan `retry` nie ma zrzutów po zmianie. Dodatkowo `ServiceUnavailableView` ma przycisk `outline` zamiast planowanego linku (opisane w README) oraz zrzuty `screenshots/signin-error/` i `checks.json` spoza planu; skrypt bramki nie trafił do repo, więc bramki nie da się powtórzyć.
- **Fix**: Dodać zrzuty stanu `retry` (light/dark, 1280/390) do `screenshots/` i wpis w README; opcjonalnie dołączyć skrypt bramki.
- **Decision**: PENDING

### F5 — `authUnavailable` opcjonalne i nieaktualny komentarz kolejności

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/drill-configurations.ts:330, :472, :479
- **Detail**: Plan: `authUnavailable: boolean`; jest `authUnavailable?: boolean`, więc nowa trasa, która zapomni pola, cicho traktuje auth jako dostępne. Komentarz DELETE „same order as PUT (401, 503, 404…)” nie uwzględnia nowego 503 auth na początku.
- **Fix**: Uczynić pole wymaganym (kompilator wymusi przekazanie w trasach i testach) i poprawić komentarz na „503 auth, 401, 503 store, 404”.
- **Decision**: PENDING

### F6 — Zmiana asercji testów poza zakresem wskazanym w planie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/email-auth.test.ts (~:286, :318-341)
- **Detail**: Plan dopuszczał zmianę asercji tylko w `:148-175`. Zmieniono też fake'i callbacku (`Error` → `AuthApiError otp_expired`) i asercję „thrown → retry” na „thrown → unavailable”. To konsekwencja reguły „nie-AuthError → unavailable” i jest zapisana w „Zmiana wymagania” w `change.md`, więc zgodna z zasadą „asercję zmienia się przy zmianie wymagania”.
- **Fix**: Brak zmian w kodzie; dopisać w planie (addendum) zakres zmienionych asercji.
- **Decision**: PENDING

### F7 — Brak testu automatycznego ścieżki 503 w middleware

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: src/middleware.ts:36
- **Detail**: Nic automatycznie nie potwierdza, że rewrite `next("/service-unavailable")` daje 503 z `Retry-After: 30` i `Cache-Control: private, no-store` (integracja sprawdza tylko wariant bez awarii → 404). Decyzja `resolveSession` jest przetestowana jednostkowo, a ścieżkę sprawdzono ręcznie (3.6), więc to świadoma luka opisana w `change.md`.
- **Fix**: Wydzielić decyzję middleware („chroniona + unavailable → rewrite, chroniona + gość → redirect”) do czystej funkcji w `src/lib` z testem jednostkowym.
    - Strength: Domyka ryzyko regresji w kolejności sprawdzeń bez zatrzymywania Supabase w integracji.
    - Tradeoff: Kolejna mała abstrakcja; sam rewrite Astro nadal testowany tylko ręcznie.
    - Confidence: MED — wzorzec `resolveSession` już istnieje.
    - Blind spot: Nagłówki ustawiane przez stronę po rewrite nadal bez testu automatycznego.
- **Decision**: PENDING

### F8 — Puste tagi Sentry `auth.status` / `auth.code`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:74-75
- **Detail**: Dla błędów bez `status`/`code` (np. retryable bez kodu, `Error` spoza auth) wysyłane są tagi z pustą wartością, które Sentry może odrzucić jako nieprawidłowe dane i które utrudniają filtrowanie.
- **Fix**: Dodawać tagi `auth.status` i `auth.code` tylko, gdy wartość istnieje.
- **Decision**: PENDING

### F9 — Domyślny reporter Sentry w czystym module `email-auth.ts`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/email-auth.ts:176, :220, :264, :296
- **Detail**: Parametry `report = reportAuthError` sprawiają, że `email-auth.ts` importuje `@sentry/cloudflare`, a trasy `signin.ts` i `callback.ts` polegają na wartości domyślnej, podczas gdy `signout.ts` przekazuje reporter jawnie. Wzorzec `DrillSaveLogger` to port bez twardego importu dostawcy. Niespójne, ale bez wpływu na zachowanie.
- **Fix**: Przekazywać `reportAuthError` jawnie w `signin.ts` i `callback.ts` (jak w `signout.ts`), opcjonalnie bez wartości domyślnej.
- **Decision**: PENDING
