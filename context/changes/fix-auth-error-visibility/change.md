---
change_id: fix-auth-error-visibility
title: Fix auth error visibility
status: implementing
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
