# Zrzuty: widoki błędów auth (faza 5)

Bramka wizualna zmiany `fix-auth-error-visibility`. Zrzuty zrobione Playwrightem (`@playwright/test` z `node_modules`) na `npm run dev` z nieosiągalnym `SUPABASE_URL` (`http://127.0.0.1:1` w tymczasowym `.dev.vars`, potem przywróconym). Widok 503 powstaje z ciasteczka sesji z ważnym JWT (auth-js wywołuje wtedy `/user`, które zawodzi jako `AuthRetryableFetchError`); bez ciasteczka gość jest rozpoznawany lokalnie i awarii nie widać.

Skrypt bramki dla stanu `retry` jest w repozytorium (`callback-retry-visual-gate.mjs`, wyjątek lint tylko dla tego pliku; `npm run dev`, potem `PLAYWRIGHT_PATH=<katalog z node_modules/playwright> OUT=<ten folder> node callback-retry-visual-gate.mjs`; wyniki w `checks-callback-retry.json`). Skrypt pierwszej bramki (503 i formularz sign-in, nieosiągalny `SUPABASE_URL`) nie został zachowany; wyniki jego pomiarów: `checks.json` (status HTTP, brak przewijania poziomego, kontrast tekstu z canvas).

## Zrzuty (8 + 4 + 4)

W każdym zrzucie fokus klawiatury (Tab) stoi na głównej akcji karty.

| Plik                                                    | Widok                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `service-unavailable-{1280,390}-{light,dark}.png`       | `ServiceUnavailableView` (503), fokus na „Back to the timer"                                                                         |
| `callback-unavailable-{1280,390}-{light,dark}.png`      | `/auth/callback?error=unavailable&next=%2Ftimers`, fokus na „Request a new sign-in link"                                             |
| `callback-retry-{1280,390}-{light,dark}.png`            | `/auth/callback?error=invalid&next=%2Ftimers` (istniejący stan `retry`, po zmianie kontrastu), fokus na „Request a new sign-in link" |
| `signin-error/signin-error-{1280,390}-{light,dark}.png` | Formularz `/auth/signin` po 503 przy niedostępnym Supabase (komunikat błędu, przycisk znów aktywny)                                  |

## Macierz stanów

| Stan              | Wynik                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| default           | zrzuty (z fokusem na akcji; bez fokusu karta jest identyczna)                                                 |
| focus-visible     | tak, pierścień widoczny w obu motywach                                                                        |
| error             | to jest sam stan błędu; formularz sign-in osobno w `signin-error/`                                            |
| hover             | N/A: akcje to istniejące warianty `Button` (outline) i podkreślony link, bez własnego stylu hover             |
| disabled, loading | N/A: widoki statyczne, bez akcji asynchronicznych (stan `pending` formularza sign-in nie jest częścią zmiany) |
| empty             | N/A: widoki nie wyświetlają danych                                                                            |

## Znalezione i naprawione podczas przeglądu

- Link „Back to the timer" (wariant `link`, `text-primary`) miał w light kontrast 2,28:1 (min. 4,5:1). `ServiceUnavailableView` używa teraz wariantu `outline` (kontrast tekstu 10,31:1 light / 9,93:1 dark).
- Link „Request a new sign-in link" w `callback.astro` miał ten sam kontrast i przylegał do opisu. Teraz `text-foreground` z podkreśleniem i `pt-4` w karcie stanów innych niż `confirm`.
- Wariant `link` przycisku (`text-primary`) ma w light niski kontrast w całej aplikacji (m.in. `NotFoundView`); to wada tokenu poza zakresem tej zmiany.

## Pomiary (po poprawkach)

Brak przewijania poziomego w żadnym ze zrzutów (390 px też). Kontrast w light/dark: nagłówek 10,31 / 9,93, opis 4,83 / 5,71, akcja 10,31 / 9,93, komunikat błędu formularza 5,89 / 5,77.
