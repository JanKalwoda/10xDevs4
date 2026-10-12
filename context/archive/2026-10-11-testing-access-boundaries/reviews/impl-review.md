<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 1 — granice dostępu, własności, przekierowań i walidacji API

- **Plan**: context/changes/testing-access-boundaries/plan.md
- **Scope**: Full plan (zakres git 80c4396..HEAD, draft PR #56)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Weryfikacja (tylko do odczytu, 2026-10-11): `npm run lint` przechodzi; `npm test` 272/272; CI PR #56 (run 38170079757) zielone, job `smoke`: zestaw integracyjny `tests 113, pass 113, fail 0, skipped 0, cancelled 0`. `npm run test:integration` nie był uruchamiany lokalnie (brak działającej aplikacji na :4321). `runRemoteSmoke` przed i po zmianie jest identyczny (diff pusty). Ręczny punkt 6.3 w Progress jest nadal `[ ]` (oczekuje na człowieka, to nie jest ustalenie).

Wyrocznie (punkt 1 zlecenia): asercje `guest-access`, `redirects`, `ownership`, `api-validation` i `route-inventory` wynikają z PRD (Access Control, Guardrails, FR-001, FR-011, FR-017), S-10/S-12/S-17 i research Decisions 4. Klasyfikacja w `route-inventory.test.ts` jest ręczną listą, nie wynikiem z guardu, a każdy konsument obcego `next` ma kontrolę pozytywną. Jedyny przypadek wyroczni wziętej z obserwacji runtime, a nie ze źródła, to `//timers` (F2).

Tabela „krok smoke → nowy test” (punkt 3): porównałem nazwy `runStep` w `runLocalSmoke` przed (39 kroków, 80c4396) i po zmianie (19 kroków). Usunięte kroki to dokładnie L2–L4, L11–L19, L21–L28 i L36. Każdy z nich ma nazwany test, a pozostałe 19 kroków to wiersze „zostaje w smoke”. Na poziomie asercji zgubiło się kilka drobnych sprawdzeń (F4).

## Findings

### F1 — Test „forged session” nie zabija mutanta getSession(); realnie odsłonięta powierzchnia (/dashboard) nie jest sprawdzana

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/ownership.test.mjs:354-405 (powiązane: src/middleware.ts:13-16, src/pages/dashboard.astro:9-15)
- **Detail**: Zgłoszenie deva się potwierdza i ma konkretną przyczynę. W auth-js 2.116 `getSession()` (`GoTrueClient.__loadSession`) zwraca sesję z ciasteczka po sprawdzeniu samego kształtu (`_isValidSession`: `access_token`, `refresh_token`, `expires_at`) i ważności `expires_at`. Podpisu nie weryfikuje, a `session.user` bierze z zapisanego JSON-a, nie z JWT. Przy tokenie z jednym zmienionym znakiem podpisu mutant ustawia `locals.user = A`, ale zatrzymuje go druga linia obrony. PostgREST odrzuca zły podpis (PGRST301/303), `classifyStoreError` mapuje to na `unauthorized` (drill-configurations.ts:245), więc `/timers` i `/{id}` dają `sign_in` → 302 (`resolveTimersPage`, :568/:578), a PUT daje 401. Dla tych trzech asercji mutant jest więc równoważny. Nie da się go zabić na powierzchniach, które czytają bazę. Prawdziwa dziura mutanta leży tam, gdzie strona ufa samemu `locals.user` bez odczytu bazy: `/dashboard` (renderuje `user.email`, AccountDetails bez DB) i pasek górny na każdej stronie (`Layout.astro:29`). Wariant `garbage` też nie pomaga, bo wartość bez prefiksu `base64-` nie parsuje się na sesję, więc `getSession` też daje `null`.
  Tani sfałszowany token, który `getSession` przyjmie, a `getUser` odrzuci: wystarczy dowolna struktura sesji z przyszłym `expires_at`. Podpis i nawet format JWT nie są potrzebne, bo `getSession` ich nie czyta, a `getUser` wysyła token do `/auth/v1/user` i dostaje 401/403.
- **Fix**: Dodać do testu „forged session” trzeci wariant „fabricated session (valid shape, no valid signature)” i asercje na powierzchniach bez odczytu bazy:
  ```js
  const FORGED_EMAIL = "forged-" + randomUUID() + "@example.com";
  // Shape that getSession() accepts (it checks fields and expires_at, not the signature); getUser() asks the auth server and gets 401.
  function fabricatedSession(cookies) {
      const base = Object.keys(cookies).map((c) => c.match(/^(.*-auth-token)(\.\d+)?$/)?.[1]).find(Boolean);
      const now = Math.floor(Date.now() / 1000);
      const session = {
          access_token: "forged.access.token", token_type: "bearer", expires_in: 3600, expires_at: now + 3600,
          refresh_token: "forged-refresh",
          user: { id: randomUUID(), aud: "authenticated", role: "authenticated", email: FORGED_EMAIL },
      };
      return { [base]: "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url") };
  }
  // in the test:
  const fabricated = a.withCookies(fabricatedSession(real));
  const dashboard = await fabricated.request("/dashboard");
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get("location"), "/auth/signin?next=%2Fdashboard");
  assert.equal(await dashboard.text(), "");
  const home = visibleText(await (await fabricated.request("/")).text());
  assert.ok(!home.includes(FORGED_EMAIL) && home.includes("Sign in"), "the top bar treats a fabricated session as a guest");
  ```
  Tę samą asercję `/dashboard` warto dodać też do wariantu z jednym zmienionym znakiem (tam mutant pokaże prawdziwy e-mail A). Po dodaniu sprawdzić raz mutantem `getSession()` w `src/middleware.ts` (lokalnie, bez commita), że test czerwienieje, a w komentarzu testu zapisać, dlaczego `/timers`, `/{id}` i PUT sam nie wystarczą (druga linia obrony PostgREST).
  - Strength: Zabija dokładnie tę regresję, której dotyczy ryzyko #2 (sesja z ciasteczka bez weryfikacji). Nie wymaga kryptografii ani service-role i działa bez kont.
  - Tradeoff: Test zależy od formatu ciasteczka `@supabase/ssr` (`base64-` + JSON). Przy zmianie formatu w bibliotece trzeba go poprawić, choć `tamperedSession` ma już tę samą zależność.
  - Confidence: HIGH — potwierdzone w źródle auth-js 2.116 (`__loadSession`, :2513-2596) i w kodzie stron (`dashboard.astro` bez DB, `Layout.astro:29`).
  - Blind spot: Nie uruchomiłem mutanta (brak działającej aplikacji, zakaz zmian). Do potwierdzenia jednym lokalnym przebiegiem.
- **Decision**: ACCEPTED — dodano wariant „fabricated session” oraz asercje `/dashboard` (302, `Location`, puste ciało) i paska górnego na `/` do wszystkich wariantów; kontrola pozytywna rozszerzona o `/dashboard` i e-mail w pasku. Komentarz testu wyjaśnia, czemu `/timers`, `/{id}` i PUT nie wystarczą. Mutant `getSession()` w `src/middleware.ts`: czerwienieją „token changed by one character” i „fabricated session” (garbage przechodzi, jak przewidziano), plik przywrócony `git checkout`, przebudowa z czystego kodu i całość zielona.

### F2 — `//timers` przypięte do artefaktu runtime preview, odstępstwo nieudokumentowane w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: tests/integration/guest-access.test.mjs:63-72
- **Detail**: Plan (Faza 2, Contract) wymaga dla `//timers` przez `rawRequest` statusu 302 do `/auth/signin` i pustego ciała. Implementacja sprawdza 200 i ciało bajt w bajt równe `GET /`. Odstępstwo jest zapisane tylko w komunikacie commita fazy 2, a w `plan.md` brakuje adnotacji. Wyrocznia nie pochodzi ze źródła, tylko z obserwacji. Predykat `isProtectedPath("//timers")` zwraca `true` (`routerPath` zwija `//`, protected-routes.ts:5-15), więc skoro aplikacja renderuje stronę główną, middleware widzi inny pathname. Najpewniej warstwa preview składa URL jak `new URL("//timers", origin)`, czyli host `timers` i ścieżkę `/`. To zachowanie runtime/adaptera, nie produktu. Na produkcyjnym Workerze (inny front) albo po aktualizacji adaptera ta sama ścieżka może dać poprawne 302, a test zaczerwieni się bez regresji bezpieczeństwa. Odwrotnie, równość z `/` przestanie działać, gdy strona główna dostanie dowolny element zależny od żądania. Właściwa wyrocznia (plan, Decisions 4, PRD Access Control) to „brak treści chronionej”, nie „identyczność z `/`”.
- **Fix A ⭐ Recommended**: Rozluźnić asercję do wyroczni i udokumentować odstępstwo. Akceptowane są dwa wyniki: (a) 302 z `Location` zaczynającym się od `/auth/signin`, puste ciało albo (b) 200, w którym nie ma znaczników strony chronionej (`Saved timers`, `Create a timer`, nagłówek `Timers`) i jest treść strony głównej. Dopisać w `plan.md` (Faza 2) adnotację „Odstępstwo” z przyczyną.
  - Strength: Test zostaje prawdziwy na preview i na produkcji, a zgodnie z planem sprawdza brak treści, nie normalizację.
  - Tradeoff: Asercja jest słabsza od „bajt w bajt”, bo listę znaczników trzeba utrzymywać razem ze stroną `/timers`.
  - Confidence: MED — przyczynę (URL z hostem `timers`) wywnioskowałem z kodu predykatu i zachowania, w adapterze jej nie potwierdziłem.
  - Blind spot: Nie sprawdziłem, jak `//timers` zachowuje się na produkcyjnym Workerze.
- **Fix B**: Zostawić równość z `/`, ale dopisać adnotację w planie i komentarz, że to cecha preview (z linkiem do przyczyny).
  - Strength: Najmniejsza zmiana i najostrzejsza asercja w obecnym środowisku.
  - Tradeoff: Test zależy od szczegółu adaptera i będzie fałszywie czerwony przy jego zmianie.
  - Confidence: MED — działa dziś w CI.
  - Blind spot: To samo co wyżej.
- **Decision**: ACCEPTED (Fix A) — `//timers` akceptuje 302 do `/auth/signin` z pustym ciałem albo 200 bez znaczników strony chronionej i z treścią strony głównej; adnotacja „Odstępstwo” w plan.md (Faza 2).

### F3 — Sprawdzenie „brak maila” dla obcego `next` może przejść pusto (brak kontroli pozytywnej wyszukiwania Mailpit)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/redirects.test.mjs:22-27, :37-41, :134-140
- **Detail**: `mailTo()` liczy wiadomości przez `/api/v1/search?query=to:<adres>` z `messages_count ?? 0`. Jeśli składnia zapytania albo nazwa pola rozjedzie się z wersją Mailpit, funkcja zawsze zwróci 0 i asercja „brak maila” przejdzie, nawet gdy aplikacja wyśle link. Kontrola pozytywna (`POST /api/auth/signin positive control`) wysyła prawdziwy link, ale sprawdza tylko 200 `ok:true`, a nie to, że `mailTo` go widzi.
- **Fix**: W kontroli pozytywnej odpytywać `mailTo(email)` do skutku (np. do 10 s) i asercją wymagać `>= 1`. To ta sama wysyłka, więc budżet auth się nie zmienia.
- **Decision**: ACCEPTED — kontrola pozytywna `POST /api/auth/signin` czeka do 10 s na mail w Mailpit i wymaga `>= 1`.

### F4 — Przeniesione asercje gubią kilka sprawdzeń smoke (no-store na 201/409/415, formularz /create)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/integration/api-validation.test.mjs:42-45, :112-155; tests/integration/ownership.test.mjs:94-101, :139-142
- **Detail**: Plan (kryteria 3.4, 4.4, 5.5) wymaga „the same assertions” co smoke. Helpery smoke `saveDrill`/`updateDrill` (80c4396 `scripts/smoke.mjs`) sprawdzały `Cache-Control: no-store` przy KAŻDEJ odpowiedzi POST/PUT. Nowy zestaw sprawdza no-store tylko dla 400 (`assertRefusal`), PUT 200 i 401. Bez tego sprawdzenia zostały POST 201 („owner save”), 409 `duplicate_name` i `limit_reached` oraz 415. Zniknęło też sprawdzenie, że `/create` renderuje formularz (`Create a timer` i `Save timer`), bo zostało tylko sprawdzenie linku powrotu. To mała strata sygnału (odpowiedzi API z danymi użytkownika mogłyby zostać zcache'owane), ale wiersze L12/L16/L11 tabeli nie są w pełni równoważne.
- **Fix**: Przenieść sprawdzenie no-store do helpera `send()` w api-validation (i do POST w „owner save”), a w „owner navigation links” dodać `Save timer` na `/create`.
- **Decision**: ACCEPTED — `no-store` sprawdzane w helperze `send()` api-validation (każda odpowiedź) i przy POST 201 w „owner save”; `Save timer` na `/create` w „owner navigation links”.

### F5 — Brak limitów czasu: zawieszony fetch blokuje CI do limitu joba (6 h)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/lib/app-client.mjs:109-118, :192-198; package.json (`test:integration`); .github/workflows/ci.yml (job `smoke`)
- **Detail**: `send()` i `json()` w Mailpit wołają `fetch` bez `signal`, `node --test` działa bez `--test-timeout`, a job `smoke` nie ma `timeout-minutes`. Zawieszony preview (np. workerd po błędzie) nie kończy się porażką, tylko wisi. Cichego pominięcia testów nie ma, bo guardy środowiska failują głośno, a CI pokazuje `skipped 0`, ale istnieje cichy hang.
- **Fix**: Dodać `signal: AbortSignal.timeout(15_000)` w `send()` i w Mailpit `json()` oraz `--test-timeout=180000` w skrypcie `test:integration`. Opcjonalnie `timeout-minutes: 20` dla joba `smoke`.
- **Decision**: ACCEPTED — `AbortSignal.timeout(15_000)` w `send()` i Mailpit `json()` (oraz w `mailTo()`), `--test-timeout=180000` w `test:integration`, `timeout-minutes: 20` dla joba `smoke`; `AbortSignal` dodany do globali `scriptsConfig` w eslint.

### F6 — Krok zestawu integracyjnego i kontrola /dev/timer-ui są pomijane, gdy padnie smoke

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:62-67
- **Detail**: Rozdzielenie kroków jest zgodne z planem i działa (preview w tle przeżywa kolejne kroki, CI zielone). Domyślne `if: success()` sprawia jednak, że błąd smoke (np. limit auth) ukrywa wynik zestawu i sprawdzenie 404 `/dev/timer-ui`, więc jedna przyczyna zasłania pozostałe sygnały.
- **Fix**: Nadać krokowi preview `id: preview` i dla trzech kolejnych kroków ustawić `if: ${{ !cancelled() && steps.preview.outcome == 'success' }}`.
- **Decision**: ACCEPTED — krok preview ma `id: preview`, a trzy kolejne kroki `if: ${{ !cancelled() && steps.preview.outcome == 'success' }}`.

### F7 — Nieplanowane `.claude/**` w globalIgnores eslint

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:86
- **Detail**: Zmiana spoza planu (Faza 1 przewidywała tylko `tests/**/*.mjs` w `scriptsConfig`). Uzasadnienie z commita a6663d0 („skille 10x failowały lint na HEAD”) jest rozsądne i zgodne z precedensem `.agents/**`. `.claude/` zawiera wyłącznie narzędzia agentów (skills, prompts, commands), a nie kod aplikacji. Brakuje tylko wpisu w planie.
- **Fix**: Dopisać w `plan.md` (Faza 1, #4) adnotację o ignorowaniu `.claude/**` z powodem.
- **Decision**: ACCEPTED — adnotacja „Odstępstwo” w plan.md (Faza 1, #4) o `.claude/**` w `globalIgnores`.

### F8 — Budżet auth w §6.2 nie liczy wysyłki z kontroli pozytywnej redirects

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/redirects.test.mjs:134-140; context/foundation/test-plan.md §6.2
- **Detail**: §6.2 i plan podają „4 logowania zestawu + 2 smoke”. Kontrola pozytywna `POST /api/auth/signin` wysyła prawdziwy magic link, który zużywa `sign_in_sign_ups`, więc zestaw zużywa 5 wysyłek i 4 weryfikacje. Przy limicie 30 na 5 min to wciąż bezpieczne (ok. 7 na przebieg), ale liczba w cookbooku jest zaniżona, a na jej podstawie liczy się szybkie przebiegi z kilku worktree.
- **Fix**: Poprawić w §6.2 budżet na „5 wysyłek linku (4 logowania + 1 kontrola redirects) + 2 smoke”.
- **Decision**: ACCEPTED — budżet w test-plan.md §6.2 i w plan.md: 5 wysyłek linku (4 logowania + 1 kontrola redirects) + 2 smoke.
