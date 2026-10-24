# Supabase Auth (błędy) — dokumentacja z Context7

- **Library ID:** `/websites/supabase_guides` (Supabase Guides, reputacja High, benchmark 76.02)
- **Data pobrania:** 2026-10-24
- **Źródło:** https://supabase.com/docs/guides/auth/debugging/error-codes, https://supabase.com/docs/guides/api/handling-errors-in-supabase-js, https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0 — pobrane przez `npx ctx7@latest docs`
- **Zmiana:** `fix-auth-error-visibility`
- **Wersja w repo:** `@supabase/auth-js` 2.116.0, `@supabase/supabase-js` 2.116.0, `@supabase/ssr` 0.12.7
- **Zapytania:**
    1. `auth error codes and handling AuthApiError status code`
    2. `auth HTTP status codes 429 500 otp_expired over_email_send_rate_limit session_not_found`

## Typy błędów (auth/debugging/error-codes)

All errors originating from the `supabase.auth` namespace of the client library will be wrapped by the `AuthError` class.
Error objects are split in a few classes:

- `AuthApiError` -- errors which originate from the Supabase Auth API.
    - Use `isAuthApiError` instead of `instanceof` checks to see if an error you caught is of this type.
- `CustomAuthError` -- errors which generally originate from state in the client library.
    - Use the `name` property on the error to identify the class of error received.

Errors originating from the server API classed as `AuthApiError` always have a `code` property that can be used to identify the error returned by the server. The `status` property is also present, encoding the HTTP status code received in the response.

## Obsługa w supabase-js (api/handling-errors-in-supabase-js)

`AuthError` exposes `error.code` (e.g. `'invalid_credentials'`, `'email_not_confirmed'`) and `error.status`. Branch on `code`; log the whole thing.

## Dobre praktyki

- Always use `error.code` and `error.name` to identify errors, not string matching on error messages.
- Avoid relying solely on HTTP status codes, as they may change unexpectedly.

## Kody HTTP

- **429 Too Many Requests** — Sent out when rate-limits are breached for an API. You should handle this status code often, especially in functions that authenticate a user.
- **500 Internal Server Error** — Indicate that the Auth server's service is degraded. Most often it points to issues in your database setup such as a misbehaving trigger on a schema, function, view or other database object.

## Kody błędów (wycinek)

| Kod                            | Znaczenie                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bad_jwt`                      | JWT sent in the Authorization header is not valid.                                                                                                                                                         |
| `email_address_invalid`        | Example and test domains are currently not supported. Use a different email address.                                                                                                                       |
| `email_address_not_authorized` | Email sending is not allowed for this address as your project is using the default SMTP service. ... set up a custom SMTP provider.                                                                        |
| `no_authorization`             | This HTTP request requires an Authorization header, which is not provided.                                                                                                                                 |
| `otp_disabled`                 | Sign in with OTPs (magic link, email OTP) is disabled. Check your server's configuration.                                                                                                                  |
| `otp_expired`                  | OTP code for this sign-in has expired. Ask the user to sign in again.                                                                                                                                      |
| `over_email_send_rate_limit`   | Too many emails have been sent to this email address. Ask the user to wait a while before trying again.                                                                                                    |
| `over_request_rate_limit`      | Too many requests have been sent by this client (IP address). Ask the user to try again in a few minutes. Sometimes can indicate a bug in your application that mistakenly sends out too many requests ... |
| `refresh_token_already_used`   | Refresh token has been revoked and falls outside the refresh token reuse interval.                                                                                                                         |
| `conflict`                     | General database conflict ... too many session refresh requests firing off at the same time for a user ... back off exponentially.                                                                         |
| `hook_timeout`                 | Unable to reach hook within maximum time allocated.                                                                                                                                                        |

## Weryfikacja OTP (troubleshooting)

- 403 Forbidden ... on the `/verify` endpoint typically means the server has rejected the submitted OTP token, often because it's invalid, expired, or used.
- `otp_expired` ... the provided OTP token has passed its validity period ... Other similar messages like "token has expired or is invalid" or "Email link is invalid or has expired" also fall under this category.

## Uwaga z kodu źródłowego (nie z Context7)

`@supabase/auth-js` 2.116.0 `dist/module/lib/fetch.js:22-44`: odpowiedzi 500–504 i 520–530 oraz błędy sieci stają się `AuthRetryableFetchError` (status 0 lub 5xx) **bez `code`** — kod serwera (np. `unexpected_failure`, `hook_timeout`) jest tracony; 429 i pozostałe 4xx to `AuthApiError` z `code`.
