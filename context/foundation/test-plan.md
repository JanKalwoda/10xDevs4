# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-15

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Kontekst projektu: autor nie czyta biegle Astro ani Reacta i weryfikuje aplikację ręcznie (wywiad P3). Dlatego wyrocznia każdego testu pochodzi z PRD, roadmapy lub wywiadu — nigdy z bieżącego zachowania kodu — a asercje opisują zachowanie widoczne dla użytkownika.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `scripts/` (30 dni do 2026-10-11, 77 commitów w zakresie).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                   | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Zalogowany użytkownik widzi, edytuje albo usuwa cudzy zapisany timer (na stronie lub przez API) albo odpowiedź dla cudzego id różni się od odpowiedzi dla nieistniejącego id                                                                              | High   | Medium     | PRD §Success Criteria/Guardrails, §NFR „dostępne wyłącznie właścicielowi”; interview Q1, Q4; hot-spot dir `src/lib/services` (21 zmian/30d), `src/pages/api` (13)                                                    |
| 2   | Niezalogowany użytkownik dostaje treść albo wykonuje zapis, edycję lub usunięcie na trasach chronionych (lista, konto, tworzenie, szczegóły, edycja, API zapisu i usuwania) zamiast przekierowania lub odmowy                                             | High   | Medium     | PRD §Access Control; interview Q1, Q4; hot-spot dir `src/pages/auth` (18), `src/pages/api` (13)                                                                                                                      |
| 3   | Brak sygnału dźwiękowego startu ćwiczenia lub Standby na starcie, po wznowieniu albo po powrocie z zablokowanego ekranu lub innej aplikacji                                                                                                               | High   | High       | PRD FR-004, FR-006, §NFR błąd sygnału ≤ 0,2 s; interview Q1, Q2 (już się zdarzyło); archive `2026-10-01-recover-timer-audio`; hot-spot dir `src/components/timer` (111)                                              |
| 4   | Przebieg pokazuje złą fazę, czas lub numer powtórzenia, wznowienie zaczyna złe powtórzenie albo Standby ujawnia pozostały czas lub moment startu                                                                                                          | High   | High       | PRD US-01, US-02, FR-003, FR-006, Guardrail Standby; interview Q3; hot-spot dir `src/lib` (114), `src/components/timer` (111)                                                                                        |
| 5   | Przekierowanie lub link prowadzi w złe miejsce (po zalogowaniu nie na listę timerów, po zapisie nie na zapisany timer, z edycji lub po usunięciu nie tam, gdzie trzeba) albo parametr powrotu przekierowuje poza aplikację                                | Medium | High       | PRD FR-011, FR-017; roadmap S-17 Risk; interview Q4; hot-spot dir `src/pages/auth` (18)                                                                                                                              |
| 6   | Formularz lub API przyjmuje nieprawidłową konfigurację (wartości poza zakresem, pusta lub za długa nazwa, przekroczony limit konfiguracji) albo jedno kliknięcie strzałki zmienia wartość o więcej niż jeden krok                                         | Medium | Medium     | PRD FR-001, FR-020; roadmap S-10 (limity 200 znaków / 50 konfiguracji); archive `2026-10-11-ux-fixes-round-3`; interview Q2, Q3                                                                                      |
| 7   | Na kluczowym ekranie (formularz, widok biegu, tworzenie, szczegóły, edycja, lista) na komputerze (1280 px) albo telefonie (390 px) pole lub treść wychodzi poza ekran, a przyciski są zasłonięte, za małe do trafienia albo nie reagują na klik lub dotyk | Medium | High       | PRD §NFR responsywność („bez przewijania w poziomie”, „odporne na przypadkowe dotknięcia”), FR-020; interview Q3 + uwaga do briefu; archive `2026-10-11-ux-fixes-round-3`; hot-spot dir `src/components/timer` (111) |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                                                                              | Must challenge                                                                      | Context `/10x-research` must ground                                                                            | Likely cheapest layer                                                                                        | Anti-pattern to avoid                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| #1   | Użytkownik B dostaje identyczną odpowiedź 404 dla timera użytkownika A przy odczycie, edycji, usunięciu, na stronie szczegółów i edycji, a dane A pozostają niezmienione                                                                                                 | „Testy RLS w bazie oznaczają, że aplikacja jest bezpieczna”                         | dwa konta na lokalnym Supabase, kształt sesji w ciasteczkach, tłumaczenie błędów bazy na 404                   | integracja HTTP przeciw lokalnemu Supabase                                                                   | mock klienta bazy (test sprawdza mock, nie politykę dostępu)                    |
| #2   | Każda chroniona trasa i metoda bez sesji kończy się przekierowaniem do logowania lub odmową, bez treści i bez zmiany w bazie                                                                                                                                             | „Lista chronionych tras jest kompletna” oraz „GET wystarczy”                        | pełna lista tras i metod, zachowanie ochrony tras w runtime Cloudflare                                         | integracja HTTP                                                                                              | test tylko jednej strony GET                                                    |
| #3   | Po Start, po wznowieniu i po powrocie z ukrytej karty sygnał zostaje zaplanowany w momencie zgodnym z PRD, a wyjście audio jest aktywne                                                                                                                                  | „Test jednostkowy planowania oznacza, że dźwięk zagra w przeglądarce”               | granica audio, wymóg gestu użytkownika, zdarzenia widoczności, istniejące porty testowe                        | e2e w przeglądarce z obserwacją granicy audio                                                                | asercja na mocku przepisanym z implementacji                                    |
| #4   | Krótka konfiguracja (np. 1 s / 1 s / 1 s, 2 powtórzenia, losowy start) daje sekwencję faz, czasów, powtórzeń i podglądu Next zgodną z PRD; w Standby nigdzie nie ma czasu                                                                                                | „Bieżący wynik kodu jest poprawnym oczekiwaniem”                                    | sterowanie zegarem i losowaniem, istniejące testy logiki przebiegu                                             | test komponentu z fałszywym zegarem, potem jeden przebieg e2e                                                | wyrocznia skopiowana z logiki produkcyjnej zamiast z PRD                        |
| #5   | Każde przejście (logowanie, zapis, edycja, usunięcie, linki powrotu) kończy się na adresie z PRD; obcy adres w parametrze powrotu jest odrzucany                                                                                                                         | „Ścieżka szczęśliwa logowania pokrywa wszystkie przejścia”                          | przepływ magic link przez lokalną skrzynkę, obsługa parametru powrotu                                          | integracja HTTP (kod i nagłówek Location) + e2e przejść UI                                                   | sprawdzenie samego kodu przekierowania bez celu                                 |
| #6   | API odrzuca wartości spoza zakresu niezależnie od klienta; pojedynczy klik lub dotyk strzałki daje dokładnie jeden krok                                                                                                                                                  | „Walidacja w formularzu wystarcza”                                                  | reguły walidacji po stronie serwera vs formularz, model zdarzeń wskaźnika                                      | integracja API + test komponentu                                                                             | testowanie tylko poprawnych wartości                                            |
| #7   | W obu szerokościach brak poziomego scrolla, każde pole i przycisk mieści się w oknie, główne przyciski (Start, Pause/Resume, Cancel, Restart, strzałki, Save, Delete) mają pole trafienia ≥ 44 px przy dotyku, nie są przykryte, a jedno kliknięcie wywołuje jedną akcję | „Dobrze wygląda na zrzucie, więc działa” oraz „działa myszką, więc działa dotykiem” | istniejące ręczne skrypty bramek wizualnych, fixtures podglądu deweloperskiego, emulacja wskaźnika fine/coarse | deterministyczne pomiary geometrii w e2e na dwóch viewportach; opcjonalnie przegląd multimodalny 1–2 ekranów | snapshot pikselowy każdej strony albo model wizyjny tam, gdzie wystarcza pomiar |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                             | Goal (one line)                                                                                                                  | Risks covered                           | Test types                                             | Status      | Change folder                                                 |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| 1   | Access and ownership boundaries        | Udowodnić izolację właściciela, ochronę tras dla gościa, cele przekierowań i walidację API na najtańszej warstwie                | #1, #2, #5, #6                          | integration (HTTP vs lokalny Supabase)                 | complete    | `context/archive/2026-10-11-testing-access-boundaries/`       |
| 2   | Run flow and form behaviour            | Udowodnić sekwencję faz, sygnałów, pauzy i wznowienia oraz krok strzałek bez prawdziwej przeglądarki                             | #3, #4, #6                              | component + integration (fałszywy zegar i audio)       | complete    | `context/archive/2026-10-12-testing-run-flow-form-behaviour/` |
| 3   | Critical-path browser smoke            | Minimalny smoke w przeglądarce: formularz, pełny przebieg z dźwiękiem, pauza i wznowienie, logowanie, zapis, edycja, usunięcie   | #3, #4, #5 + #6 wiring (arrow/keyboard) | e2e                                                    | complete    | `context/changes/testing-critical-path-browser-smoke/`        |
| 4   | Key-screen layout and tap-target check | Brak wychodzenia poza ekran i trafialne przyciski na kluczowych ekranach dla 1280 i 390 px (fine i coarse); domknięcie bramek CI | #7, cross-cutting                       | e2e geometry checks, optional multimodal review, gates | not started | —                                                             |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.

Profil bazy testów: `sparse` — runner `node --test` (bez pliku konfiguracyjnego), 31 plików testów w `src/lib` i `src/lib/services` (w tym 3 testy przebiegu z fazy 2: sekwencja i pauza, sygnały, kontrakt strzałki), 2 testy reguł ESLint, 1 test pgTAP, skrypt smoke HTTP (tylko przepływ logowania), 5 plików integracyjnych HTTP (`tests/integration/`: trasy, ochrona, własność, przekierowania, walidacja API); 7 specyfikacji e2e i projekt uwierzytelniania `setup` (`tests/e2e/`, Playwright; patrz §6.4).

| Layer                                   | Tool                                                                                      | Version                                                               | Notes                                                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unit                                    | Node test runner (`node --test`)                                                          | Node 24.21.0                                                          | istniejące testy czystej logiki; uruchamiane w CI przez `npm test`                                                                                                                                                       |
| database (RLS, granty, ograniczenia)    | pgTAP przez Supabase CLI                                                                  | supabase ^2.23.4                                                      | `supabase/tests/database/`, job `smoke` w CI                                                                                                                                                                             |
| HTTP smoke                              | `scripts/smoke.mjs`                                                                       | n/a                                                                   | przepływ auth przez Mailpit na podglądzie produkcyjnym; punkt wyjścia dla fazy 1                                                                                                                                         |
| integration (trasy, ochrona, własność)  | Node test runner (`node --test`) + `scripts/lib/app-client.mjs`, HTTP vs lokalny Supabase | Node 24.21.0                                                          | `tests/integration/`, `npm run test:integration`, job `smoke` w CI; wzorzec §6.2 (faza 1)                                                                                                                                |
| run-level (przebieg, sygnały, strzałki) | Node test runner (`node --test`) z fałszywym zegarem, `AudioContext` i losowaniem         | Node 24.21.0                                                          | `src/lib/drill-run-*.test.ts`, `drill-stepper-contract.test.ts`, w `npm test`; wzorzec §6.3 (faza 2). Bez DOM i bez nowych zależności: okablowanie React (`.tsx`) należy do e2e (§6.4)                                   |
| e2e                                     | Playwright Test                                                                           | @playwright/test 1.64.1 — checked: 2026-10-15                         | `tests/e2e/`, `npx playwright test`, job `smoke` w CI; reguły i uruchomienie w §6.4                                                                                                                                      |
| layout / tap targets                    | none yet — see Phase 4                                                                    | —                                                                     | pomiary geometrii na 1280 i 390 px                                                                                                                                                                                       |
| mutation (unit)                         | StrykerJS (tap runner)                                                                    | @stryker-mutator/core 10.0.0, tap-runner 10.0.0 — checked: 2026-10-11 | lokalnie, na żądanie, `npm run test:mutation`; moduły `protected-routes.ts`, `isSafeNextPath`, walidacja w `drill-configurations.ts`. When NOT to use: warstwa integracyjna HTTP — rebuild preview i limit auth 30/5 min |
| (optional) AI-native                    | przegląd multimodalny zrzutów 1–2 ekranów (np. Claude z wizją — checked: 2026-10-11)      | n/a                                                                   | When NOT to use: gdy deterministyczny pomiar overflow i rozmiaru celu wykrywa regresję; nie do logiki przebiegu ani dźwięku                                                                                              |

**Stack grounding tools (current session):**

- Docs: none (Context7 / docs MCP not available in current session) — wersje z `package.json` i `.nvmrc`; checked: 2026-10-11
- Search: WebSearch dostępny, nieużyty — wybór narzędzi zostawiony do `/10x-research` faz; checked: 2026-10-11
- Runtime/browser: wtyczka terminal-browser i Claude in Chrome dostępne — możliwe do ręcznej weryfikacji, nie jako bramka CI; checked: 2026-10-11
- Provider/platform: none (brak MCP GitHub / Supabase / Cloudflare) — CLI `gh`, `supabase`, `wrangler` w repo; checked: 2026-10-11

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery or current status only, then prefer official docs
as the evidence. Do not use MCP docs/search to infer code failure anchors;
those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                                        | Where                               | Required?                    | Catches                                                                          |
| ----------------------------------------------------------- | ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| lint (w tym kontrakt UI) + `astro check`                    | local + CI (`ci`)                   | required (wired)             | dryf składni, typów i tokenów UI                                                 |
| unit (`npm test`)                                           | local + CI (`ci`)                   | required (wired)             | regresje czystej logiki                                                          |
| pgTAP (`supabase test db`)                                  | CI (`smoke`)                        | required (wired)             | RLS, granty, ograniczenia tabel                                                  |
| HTTP smoke auth (tylko logowanie)                           | CI (`smoke`)                        | required (wired)             | zepsuty przepływ logowania na podglądzie produkcyjnym                            |
| integration: trasy, własność, przekierowania, walidacja API | local + CI (`smoke`)                | required (wired)             | ryzyka #1, #2, #5, #6                                                            |
| run-level: przebieg i formularz (w `npm test`)              | local + CI (`ci`)                   | required (wired)             | ryzyka #3, #4, #6 w logice przebiegu; okablowanie React — e2e (§6.4)             |
| e2e na krytycznych przepływach                              | CI (`smoke`, `npx playwright test`) | required (wired)             | ryzyka #3, #4, #5 w przeglądarce; #6 wiring (strzałki, klawiatura)               |
| layout i tap targets (1280 / 390 px)                        | CI on PR                            | required after §3 Phase 4    | ryzyko #7                                                                        |
| multimodal visual review (1–2 ekrany)                       | local / on demand                   | optional after §3 Phase 4    | problemy wizualne, których pomiar nie łapie                                      |
| post-edit hook                                              | local (agent loop)                  | recommended after §3 Phase 2 | regresje logiki w czasie edycji; nie zastępuje CI                                |
| mutation (`npm run test:mutation`)                          | local, on demand po fazie rolloutu  | optional                     | testy, które przechodzą mimo zepsutej logiki (przetrwałe mutanty); nie bramka CI |
| pre-prod smoke (publiczne trasy)                            | po deployu (`deploy`)               | required (wired)             | błędy specyficzne dla produkcji                                                  |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: obok modułu w `src/lib/` lub `src/lib/services/`, plik `<module>.test.ts`.
- **Reference test**: dowolny istniejący `src/lib/*.test.ts`.
- **Run locally**: `npm test`.
- Uzupełnienie konwencji (wyrocznia z PRD, sterowanie zegarem) — TBD — see §3 Phase 2.

### 6.2 Adding a test for a protected route or ownership boundary

- **Location**: `tests/integration/<ryzyko>.test.mjs` (`node:test`, jeden plik = jeden proces, konta wspólne tylko w obrębie pliku). Istniejące: `guest-access`, `redirects`, `ownership`, `api-validation` (+ `environment`).
- **Naming**: nazwa testu opisuje zachowanie, np. „foreign details page: B gets the same 404 for A's timer as for a random, malformed or nested path”; warianty jako podtesty `t.test` w pętli, nie kopie.
- **Reference tests**: `ownership.test.mjs` „foreign details page” (dwa konta, cudzy id == nieistniejący) i `guest-access.test.mjs` (gość, każda metoda i ścieżka).
- **Helper**: `scripts/lib/app-client.mjs` — `createAppClient` (jeden klient i słoik ciasteczek na konto), `rawRequest` dla wariantów ścieżek (`//timers`), `createMailpit`, `signIn`, `resolveLocalTargets` (tylko lokalne originy).
- **Rules**:
    - wyrocznia ze źródła (PRD Access Control i Guardrails, FR-011/017, roadmap), nie z odczytu kodu;
    - „foreign == missing” porównuj bajt w bajt (status, ciało, nagłówki) oraz sprawdzaj `no-store`;
    - każdy test tworzy własne timery z unikalną nazwą (`<test>-<uuid>`);
    - bez klucza service-role i bez mocków bazy; POST na stronę wysyłaj z `Origin` aplikacji.
- **Reuse accounts**: nowy przypadek używa kont już logowanych w swoim pliku (A, B, V, L) i własnych timerów; nowe konto tylko gdy przypadek wymaga stanu konta (np. limit 50). Budżet: 5 wysyłek linku (4 logowania zestawu + 1 kontrola pozytywna w `redirects`) + 2 smoke, ok. 7 z 30 na przebieg; w CI każdy przebieg startuje od zera.
- **Sign-in failure = wait 5 minutes first**: komunikat o limicie auth oznacza przekroczenie 30 logowań lub weryfikacji na 5 min na IP (ok. 5 szybkich przebiegów lokalnie albo kilka worktree na jednym Supabase). Odczekaj 5 minut i uruchom ponownie, zanim zaczniesz szukać błędu w kodzie.
- **New page**: sklasyfikuj ją w `src/lib/route-inventory.test.ts` (inaczej `npm test` failuje z jej ścieżką) i dodaj przypadek gościa w `guest-access`.
- **Run locally**: `npx supabase start`, `npm run build && npm run preview`, potem `npm run test:integration` (`BASE_URL` domyślnie `http://localhost:4321`, `MAILPIT_URL` `http://localhost:55324`). Pojedynczy test: `node --test --test-name-pattern="<nazwa>" tests/integration/ownership.test.mjs`.

### 6.3 Adding a test for run flow or form behaviour

- **Location**: `src/lib/<obszar>.test.ts` (`node --test`, bez DOM i bez nowych zależności; `npm test` łapie je globem `src/lib/*.test.ts`). Istniejące: `drill-run-flow.test.ts` (sekwencja faz, pauza i wznowienie), `drill-run-signals.test.ts` (sygnały), `drill-stepper-contract.test.ts` (strzałka ↔ parser).
- **Granica**: składa się prawdziwe moduły z `src/lib` (`DrillRun`, `buildPhaseSections`, `createDrillAudio`, `stepFieldValue`, `parseDrillTime`), a fałszywe są tylko granice. `.tsx` nie da się zaimportować w `node --test` (brak DOM i loadera JSX), więc okablowanie React (Resume, widoczność karty, gest Start, handlery wskaźnika strzałki) należy do e2e (§6.4), nie do DOM w `node --test`.
- **Fałszywki lokalne w pliku** (bez wspólnego modułu pomocniczego, jak w reszcie repo):
    - zegar: `FakeClock implements DrillClock` z `advance`; po każdym przesunięciu `run.tick()`;
    - losowanie: skryptowana kolejka wartości z krańców zakresu PRD (`0` → 1,00 s, `0.999` → 5,00 s), z licznikiem wywołań; wartość `1` jest zabroniona (poza `[0,1)`). Stały `() => 0` nie odróżnia „nowego” losowania od „starego”;
    - audio: fałszywy `AudioContext` podstawiony jako `globalThis.AudioContext`, rejestrujący oscylatory (`frequency.value`, `start`, `stop`); `performance.now` zamockowane przez `t.mock.method(performance, "now", …)` i powiązane z `currentTime` (jedna oś czasu, inaczej `Math.max(…, currentTime)` planuje wszystko na „teraz”); `node:test` `mock.timers` nie mockuje `performance.now()`. `createDrillAudio` jest asynchroniczne: `await` przed `new DrillRun` i przed asercją po `resumeWithAudio`.
- **Rules**:
    - wyrocznia z PRD (US-01, US-02, FR-001–FR-006, FR-018, FR-020), jako literały i relacje; nigdy `nextDrillPhase`, `STEPPER_LIMITS`, `CUE_DURATION`, `CUE_PITCH` ani wzór losowania;
    - nazwa testu opisuje zachowanie z PRD, np. „pause in Exercise restarts the same repetition after full preparation with a new Standby draw”; warianty jako pętla `for … of` nad tabelą przypadków, nie kopie;
    - czas próbkuj na starcie fazy i w pełnych sekundach od jej początku, nigdy na granicy z poprzednią fazą (PRD nie ustala zaokrąglenia ceil/floor);
    - sygnały: relacje (ton Standby ≠ ton ćwiczenia, ćwiczenie dłuższe od pozostałych, oczekiwanie liczone od końca drugiego dźwięku Standby ze ścisłą tolerancją 0,001 s, moment dźwięku ≤ 0,2 s), nie stałe modułu; sprawdzaj Standby pierwszego i kolejnego powtórzenia;
    - strzałka: przejdź cały zakres każdego pola i sprawdź, że każdą wartość przyjmuje ten sam parser co API, a granice to literały z PRD (`0–600`, `1–600`, `0–600`, `1–100`);
    - sygnały: przygotowanie i pominięty odpoczynek 0 s nie mają sygnału dźwiękowego (PRD FR-004);
    - sygnały: po wznowieniu przygotowanie i odpoczynek kontynuują pozostały czas bez ponawiania sygnału początku fazy (PRD FR-006);
    - Standby nigdy nie pokazuje czasu oczekiwania (także w pauzie i w przygotowaniu po wznowieniu).
- **Reference tests**: `drill-run-flow.test.ts` (tabela osi czasu A–D i przypadki pauzy), `drill-run-signals.test.ts` (powrót z ukrytej karty, kontekst, który nie wstaje), `drill-stepper-contract.test.ts`.
- **Run locally**: `npm test`; pojedynczy plik: `node --test src/lib/drill-run-flow.test.ts`. Kontrola, że test coś chroni: zepsuj jedną linię produkcyjną, test ma zrobić się czerwony, przywróć (`git diff` pusty); opcjonalnie §6.7 na `src/lib/drill-run.ts`.

### 6.4 Adding an e2e critical-path test

- **Location/naming**: `tests/e2e/<area>-<behaviour>.spec.ts`. Nagłówek pliku to trzy linie: `// risk: test-plan.md #<n> — facet: …`, `// seed: …`, `// Oracle: …` (PRD, FR, roadmap, literały z wyroczni, nie z kodu).
- **Reference specs** (wszystkie siedem, jedna linia każdy):
    - `seed.spec.ts` — zapis nowego timera otwiera `/{id}`, usunięcie wraca na `/timers` (wzorzec: lokatory, czekanie na stan, sprzątanie).
    - `auth.setup.ts` — projekt `setup`: logowanie linkiem magicznym przez UI i skrzynkę Mailpit; domyślne lądowanie na `/timers`.
    - `auth-return-address.spec.ts` — gość z `/create` loguje się i wraca na `/create` (parametr `next`, sprawdzany cel, nie tylko kod przekierowania).
    - `run-phase-sequence.spec.ts` — krótka konfiguracja daje literalną sekwencję faz, czasów i powtórzeń; Standby bez czasu; pauza wznawia to samo powtórzenie.
    - `run-audio-signals.spec.ts` — Start, wznowienie i powrót z ukrytej strony: sygnał zaplanowany wg PRD, wyjście audio aktywne (obserwacja przez spy, nie mock z implementacji).
    - `config-form-stepper.spec.ts` — jedno kliknięcie strzałki = jeden krok; ↑/↓ o 1, Shift o 10.
    - `saved-timer-navigation.spec.ts` — z listy do zapisanego timera, jego edycji i z powrotem; każdy link i „Save changes” kończy się na właściwym adresie.
    - `saved-timer-start.spec.ts` — Start na zapisanym timerze uruchamia zapisaną konfigurację, nie wartości domyślne.
- **Helpers** (`tests/e2e/support/`): `hydration` (`waitForHydration`), `audio-spy` (`installAudioSpy`, `readAudioContexts`), `page-visibility` (`setPageHidden`), `run-view` (`recordRunUntilCompleted`, `parseRunView`), `mailpit` (`snapshotInbox`).
- **Rules**:
    - lokatory po roli i etykiecie (`getByRole`, `getByLabel`, `getByText`); bez selektorów CSS, XPath i struktury DOM; `getByTestId` tylko przy niejednoznacznych atrybutach dostępności;
    - bez `page.waitForTimeout()`: czekaj na stan (`toBeVisible`, `waitForURL`, `waitForResponse`);
    - przebieg, który nic nie tworzy, używa gościa (`storageState: { cookies: [], origins: [] }`); dane tworzy przez API (`page.request.post("/api/drills")` z nagłówkiem `Origin` aplikacji), a sprzątanie to `DELETE` z asercją `toBeOK()`;
    - kliknięcie niebędące idempotentnym zapisem (albo wykonywane przed hydracją) poprzedź `waitForHydration`; Playwright nie ponawia kliknięć, a kliknięcie przed hydracją nic nie robi;
    - dźwięk obserwujemy przez przezroczysty spy `AudioContext`; widoczność karty emulujemy na dokumencie (`setPageHidden`);
    - widok biegu czytamy tylko przez `ariaSnapshot` (`parseRunView`), nie przez tekst wizualny;
    - budżet poczty: każde logowanie w e2e to jedna wysyłka; dziś 2 na przebieg (`auth.setup.ts` i `auth-return-address.spec.ts`);
    - unikalne nazwy z sufiksem `Date.now()`, żeby równoległe przebiegi i ponowne uruchomienia nie kolidowały.
- **Run**: `npx supabase start` (lokalny stos), `.env.e2e` z `E2E_USERNAME`, `MAILPIT_URL` i opcjonalnie `E2E_PORT` (plik jest ignorowany przez git); cały zestaw `npx playwright test`, pojedynczy plik `npx playwright test tests/e2e/<plik>.spec.ts`. W CI raport trafia do artefaktu `playwright-report` przy błędzie.
- **Verify**: złam jedną linię produkcyjną, którą spec chroni; spec ma być czerwony; przywróć i sprawdź `git diff -- src/` (pusty).

### 6.5 Adding a layout / tap-target check for a screen

- TBD — see §3 Phase 4 (wzorzec: brak poziomego scrolla i trafialne przyciski na 1280 i 390 px, fine i coarse).

### 6.6 Per-rollout-phase notes

(Po każdej fazie 2–3 linie o tym, czego faza nauczyła.)

- **Phase 1 (access boundaries)**: warstwa „HTTP vs lokalny Supabase” już istniała w smoke; potrzebne było jej wydzielenie do klienta i niezależnych plików, a smoke zostało przy logowaniu.
- Limit auth lokalnego Supabase (30 / 5 min / IP) nie wygląda jak błąd (neutralne 200, `error=invalid`), więc `signIn` ma jeden czytelny komunikat; planuj budżet logowań.
- Dodatkowo inwentarz tras w `npm test` zamyka lukę „nowa strona bez ochrony”.
- **Phase 2 (run flow and form)**: cała logika przebiegu jest czystym TS z portami, więc „component” w tej fazie to run-level integration w `node --test` (prawdziwy `DrillRun` + model widoku + `createDrillAudio`, fałszywe tylko zegar, losowanie i `AudioContext`); okablowanie `.tsx` zostaje do e2e (Phase 3).
- **Phase 3 (critical-path browser smoke)**: większość specyfikacji powstała z samodzielnych przebiegów `/10x-e2e`; jedyną luką między warstwami były przeglądarkowe przeskoki adresu powrotu (logowanie z `next`), które dopiero spec `auth-return-address` zamknął.
- Pułapki fazy: widoczność w headless (emulowana na dokumencie), hydracja przed kliknięciami bez efektu, wspólna skrzynka Mailpit (liczy się tylko wiadomość nadesłana po wysłaniu formularza).
- Najczęstsze pułapki: stały `random` (wznowienie z ponownie użytym losowaniem przechodzi), tolerancja 0,2 s nieodróżniająca końca pierwszego od drugiego dźwięku Standby, test lustrzany podglądu Next oraz zegar Web Audio niepowiązany z `performance.now`. Każdy z nich naprawiono w istniejących testach i opisano w §6.3.

### 6.7 Running a mutation check on a module (Stryker)

- **When**: lokalnie, na żądanie, po fazie ryzyka, gdy testy jednostkowe są zielone. Nie w CI i nie przy każdym commicie; nie gonimy 100%.
- **Run**: `npx stryker run --mutate "src/lib/protected-routes.ts"` (cały plik) albo z zakresem linii, np. `--mutate "src/lib/email-auth.ts:25-53"` (`isSafeNextPath`) i `--mutate "src/lib/services/drill-configurations.ts:53-117"` (walidacja). Goły `npm run test:mutation` mutuje domyślne `mutate` z konfiguracji (te trzy moduły); inny moduł: `npm run test:mutation -- --mutate "<plik>"`. Raport HTML: `reports/mutation/mutation.html` (poza gitem, `.stryker-tmp/` też).
- **Config** (`stryker.config.json`): runner `tap`, `tap.testFiles` = te same globy co `npm test` (`src/lib/*.test.ts`, `src/lib/services/*.test.ts`), `coverageAnalysis: "perTest"`. `tap.nodeArgs` musi być dokładnie `["--test-reporter=tap"]` **bez `--test`**: z `--test` plik testowy idzie do podprocesu bez hooka Strykera i każdy mutant jest `NoCoverage`. Pliki `.ts` działają przez natywny type stripping Node 24, bez `tsx`.
- **Warning**: zakres linii (`plik:od-do`) jest kruchy — po edycji pliku z walidacją zaktualizuj go (Stryker nie mutuje po nazwie funkcji ani nie łączy zakresu z globem).
- **Review rule**: dla każdego przetrwałego mutanta zapytaj „czy ta zmiana zaszkodziłaby użytkownikowi lub firmie?”. Tak → asercja z wartością z wyroczni (PRD, test-plan), nie z logiki modułu. Nie (równoważny, kosmetyczny, treść komunikatu) → `ignoruj` z jednozdaniowym uzasadnieniem. Test przypinający szczegół implementacji tylko po to, by zabić kosmetyczny mutant, jest testem vibe.
- **Where to record**: tabela `moduł | mutant | decyzja | dlaczego` w `context/changes/<change-id>/mutation-review.md`. Przykład: `context/archive/2026-10-11-mutation-testing-stryker/mutation-review.md` (dokumentacja biblioteki: `context/docs/stryker-js.md`).

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Pomiar opóźnienia dźwięku przez Bluetooth** — bez sprzętu i metody pomiaru automatyczny test byłby fikcją (roadmap S-14 blocked); zostaje ręczna weryfikacja. Re-evaluate, gdy S-14 dostanie metodę kalibracji i pomiaru. (Source: Phase 2 interview Q5.)
- **Wszystkie kombinacje pól, przycisków i stanów** — testujemy minimalny zestaw kluczowych ekranów i przepływów; pełną macierz stanów obsługują fixtures podglądu deweloperskiego i ręczne bramki wizualne. Re-evaluate, gdy regresja przejdzie przez minimalny zestaw. (Source: Phase 2 interview Q5.)
- **Kolory faz i usuwanie konta** — funkcje nie istnieją (S-05 deferred, S-20 proposed). Re-evaluate przy ich implementacji. (Source: roadmap.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-11
- Stack versions last verified: 2026-10-15
- AI-native tool references last verified: 2026-10-11

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
