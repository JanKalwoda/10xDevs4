# Key-screen layout and tap-target check (test-plan Phase 4) — Plan Brief

> Full plan: `context/changes/testing-key-screen-layout/plan.md`
> Research: `context/changes/testing-key-screen-layout/research.md`

## What & Why

Ryzyko #7 test-planu: na kluczowym ekranie przy 1280 px albo 390 px treść wychodzi poza ekran, a przyciski są zasłonięte, za małe albo nie reagują na klik lub dotyk. PRD wymaga interfejsu bez przewijania w poziomie i sterowania „odpornego na przypadkowe dotknięcia”. Dziś chronią to tylko ręczne skrypty bramek wizualnych poza CI, więc regresja układu przechodzi niezauważona.

## Starting Point

E2E Playwright działa w CI (projekt `chromium`, 1280 px, pointer fine), ale bez żadnej asercji geometrii i bez projektu telefonu. Pasek biegu ma 48 px, strzałki przy dotyku 44 px, a Start, Save i Delete 36 px. Podwójny klik Start, Restart i Pause wg kodu daje dwie akcje. Ruleset `main` nie wymaga żadnych checków CI.

## Desired End State

Każdy PR uruchamia w CI pomiar sześciu ekranów (w tym dialog usuwania) i trzech stanów biegu przy 1280 fine i 390 coarse: brak poziomego scrolla, kontrolki w oknie i nieprzykryte, pasek biegu i strzałki ≥ 44 px przy dotyku, pozostałe główne przyciski ≥ 24 px, jedno kliknięcie lub dotknięcie = jedna akcja. Podwójne dotknięcie jest zmierzone w przeglądarce; potwierdzony błąd ma własną zmianę naprawczą. Czerwony `ci` lub `smoke` blokuje merge.

## Key Decisions Made

| Decision            | Choice                                                             | Why (1 sentence)                                                                            | Source   |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------- |
| Próg 44 px          | Tylko pasek biegu i strzałki przy coarse                           | Literalny rozmiar podają PRD FR-020 i CLAUDE.md; reszta przycisków bez zmian UI w tej fazie | Plan     |
| Pozostałe przyciski | ≥ 24 px (WCAG 2.5.8)                                               | Próg z normy, nie z kodu; łapie regres do mikroprzycisków, dziś zielone (36 px)             | Plan     |
| §2 #7 test-planu    | Jawny podział 44/24 z datą                                         | Zawężenie wyroczni to zmiana test-planu, nie dopasowanie asercji                            | Plan     |
| Podwójne dotknięcie | Najpierw zmierzyć; potwierdzony błąd → `test.fail()` + nowa zmiana | Dowód zamiast wnioskowania; naprawa logiki biegu poza fazą layoutu                          | Plan     |
| Macierz             | `chromium` 1280 fine + nowy `mobile-coarse` 390 coarse             | Pokrywa dwie szerokości i główny wskaźnik; fine + touch zostaje w S-22                      | Plan     |
| Warstwa             | E2E na podglądzie produkcyjnym, pomiary deterministyczne           | Geometria wymaga silnika layoutu; bez snapshotów i modelu wizyjnego                         | Research |
| Przykrycie          | `click/tap({ trial: true })`                                       | Actionability „Receives Events” bez wykonania akcji, bez selektorów CSS                     | Research |
| Wymagane checki     | Ruleset `main` + `ci`, `smoke` (za zgodą, po zielonym PR)          | „Required” w §5 staje się wymuszone                                                         | Plan     |

## Scope

**In scope:**

- Projekt `mobile-coarse` w `playwright.config.ts` (390×844, `hasTouch`, `isMobile`, tylko `key-screen-*.spec.ts`)
- Helper `tests/e2e/support/layout.ts` i specyfikacje `key-screen-layout.spec.ts`, `key-screen-single-action.spec.ts`
- Ekrany `/`, `/create`, `/{id}` z dialogiem, `/{id}/edit`, `/timers`; bieg w Preparation, Exercise i pauzie
- Aktualizacja test-planu (§2 #7, §3, §4, §5, §6.5, §6.6, §8) i README; ruleset `main`

**Out of scope:**

- Powiększanie przycisków 36 px i naprawa podwójnego dotknięcia (osobna zmiana)
- Fine + touch i 390 fine w CI, rozmiar strzałek przy fine (wyjątek WCAG „Equivalent”)
- Snapshoty pikselowe, przegląd multimodalny, alert `Saved "{name}".`, zmiany w `ci.yml`, włączanie pre-push

## Architecture / Approach

Dwie specyfikacje, uruchamiane w dwóch projektach Playwright; progi i rodzaj akcji (click vs tap) zależą od projektu, lokatory po roli są wspólne. Odczyt DOM całej strony (szerokość dokumentu, lista winowajców) jest tylko w helperze `support/layout.ts`. Dane przez API z wartościami granicznymi (nazwa 200 znaków, `10:00`, `100`), sprzątanie w `afterEach`. Liczniki: konteksty audio (ile biegów wystartowało) i żądania API (ile zapisów/usunięć). CI bez zmian YAML — `npx playwright test` obejmuje nowy projekt.

## Phases at a Glance

| Phase                                     | What it delivers                                                          | Key risk                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Coarse project and key-screen geometry | `mobile-coarse` + pomiar overflow, rozmiaru i przykrycia na 9 widokach    | Sticky top bar przykrywa kontrolkę po przewinięciu (fałszywie czerwony) |
| 2. One click or tap is one action         | Pojedyncze i podwójne akcje × 2 projekty, zgłoszenie potwierdzonego błędu | Stabilność obserwacji biegu bez `waitForTimeout`                        |
| 3. Close the quality gates                | Test-plan i README zgodne z bramkami, wymagane `ci` i `smoke`             | Flaky e2e po wymuszeniu checków blokuje merge                           |

**Prerequisites:** lokalny Supabase (`npx supabase start`), `.env.e2e` z `E2E_USERNAME` i `MAILPIT_URL`, Chromium Playwright; zgoda na zmianę rulesetu przed fazą 3 krok 3.
**Estimated effort:** ~3 sesje, po jednej na fazę (fazy 1–2 przez `/10x-e2e`).

## Open Risks & Assumptions

- Zakładamy, że `hasTouch` + `isMobile` w Chromium daje `pointer: coarse` (CLAUDE.md); test sprawdza to `matchMedia`, zanim cokolwiek zmierzy.
- Podwójne dotknięcie może w przeglądarce zachować się inaczej niż wnioskowanie z kodu (np. drugi tap trafia w pusty obszar) — wtedy test jest zielony bez `test.fail()`.
- Zawężenie 44 px do paska i strzałek zostawia Start/Save/Delete na 36 px; PRD „odporne na przypadkowe dotknięcia” dla nich chroni tylko próg 24 px.

## Success Criteria (Summary)

- Złamanie układu lub blokady czyni CI czerwonym (sprawdzone celowym zepsuciem i przywróceniem).
- Na telefonie i komputerze kluczowe ekrany mają zmierzony brak poziomego scrolla i trafialne, nieprzykryte kontrolki.
- Merge do `main` wymaga zielonych `ci` i `smoke`.
