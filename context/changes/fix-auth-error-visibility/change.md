---
change_id: fix-auth-error-visibility
title: Fix auth error visibility
status: impl_reviewed
created: 2026-10-24
updated: 2026-10-24
archived_at: null
---

## Notes

Źródło: audyt `context/audits/observability/2026-10-24_account-entry-saved-timers-timer-run.md`, ustalenia A1–A5 (+ P1 jako warunek wstępny).

Research (2026-10-24, `research.md`, docs: `context/docs/supabase-auth.md`):

- auth-js 2.116.0 nie rzuca; `getUser`/`signInWithOtp`/`verifyOtp`/`signOut` zwracają `{ error }`. Awaria = `isAuthRetryableFetchError` (status 0 lub 500–504/520–530, bez `code`); gość = `isAuthSessionMissingError`; `AuthApiError` niesie `status`+`code` (429, `otp_expired` 403 są oczekiwane).
- Middleware nie może raportować każdego `error`: gość i sfałszowane ciasteczka też zwracają błąd (`ownership.test.mjs:410-453` musi zostać gościem).
- Reguła S-09 to „ta sama odpowiedź dla każdego konta”, nie „zawsze 200”; 200 przy awarii pinuje tylko `email-auth.test.ts:148-160`.
- Raport: wzorzec wstrzykiwanego loggera (`DrillSaveLogger`); `console.error(label, err)` → wyjątek przez `captureConsole`. Bez wyłączenia zbierania body (P1) raport z `/api/auth/*` niesie email.
- Otwarte decyzje: 200 vs 503 przy awarii sign-in, gość vs stan `unavailable` w middleware, komunikat callbacku, brak konfiguracji, kanał raportu, zakres P1, sign-out.

Zmiana wymagania (faza 4, decyzja planowania 2026-10-24): wymaganie neutralności sign-in (S-09) brzmi „ta sama odpowiedź dla każdego adresu”, a nie „zawsze 200”. Awaria dostawcy (retryable, nieznany błąd, wyjątek spoza `AuthError`), błąd konfiguracji niezależny od adresu (`email_provider_disabled`, `otp_disabled`, `signup_disabled`) i brak klienta dają jednolite 503 z jednym komunikatem, niezależnym od adresu i od `message` dostawcy; oczekiwane wyniki (429, `over_*_rate_limit`, `email_address_invalid`, `validation_failed`) zostają neutralnym 200 bez raportu. Pozostałe 4xx (np. `email_address_not_authorized`, `user_banned`, 401 bez `code`) mogą zależeć od adresu lub konta, więc dają neutralne 200 (status nigdy nie zależy od adresu), ale są raportowane (poprawka impl-review F3, 2026-10-24). To uzasadnia zmianę asercji `email-auth.test.ts:148-160` i `:162-175` (pinowały 200 przy awarii). Wyjątek, który nie jest `AuthError`, jest od teraz awarią (`unavailable`), więc fake'i w testach callbacku, które modelują błąd tokenu, używają `AuthApiError` (`otp_expired`, 403) zamiast zwykłego `Error`.

Nowe ryzyko (faza 5): „awaria Supabase Auth niewidoczna albo udająca wylogowanie lub sukces”. Zasada: błąd auth klasyfikuje `classifyAuthError`, awarię raportuje `AuthErrorReporter` bez danych konta, a stan `authUnavailable` daje 503 na stronach chronionych i w `/api/drills*`. Reguła zapisana w sekcji „Auth flow” CLAUDE.md i AGENTS.md. §2 test-planu jest zamrożony, więc ryzyko żyje tutaj.

Warstwa testów: jednostkowe z fake'iem portu reportera (`auth-errors`, `auth-session`, `email-auth`, `drill-configurations`, `sentry-server-options`) oraz integracyjne dla oczekiwanych wyników (gość, sfałszowana sesja, redirecty, `/service-unavailable` → 404). Awaria dostawcy nie jest tanio odtwarzalna w integracji (wymagałaby zatrzymania Supabase w środku zestawu), więc sprawdza ją ręcznie bramka wizualna z nieosiągalnym `SUPABASE_URL`.

Bramka wizualna (faza 5): zrzuty w `screenshots/`. Znalezione i naprawione: kontrast linków 2,28:1 w light w `ServiceUnavailableView` i stanie `unavailable` callbacku (zob. `screenshots/README.md`).
