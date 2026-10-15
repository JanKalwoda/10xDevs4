# Key-screen layout and tap-target check (test-plan Phase 4) Implementation Plan

## Overview

Podłączyć do CI deterministyczną bramkę ryzyka #7 z `context/foundation/test-plan.md`: na kluczowych ekranach przy 1280 px (pointer fine) i 390 px (pointer coarse) nie ma poziomego scrolla, główne kontrolki mieszczą się w oknie, nie są przykryte, mają pole trafienia co najmniej 44 px (pasek biegu i strzałki przy coarse) lub 24 px (pozostałe główne przyciski), a pojedyncze kliknięcie lub dotknięcie wywołuje jedną akcję. Dodatkowo zmierzyć w przeglądarce podwójne dotknięcie Start, Restart i Pause oraz domknąć bramki z §5 (dokumentacja i wymagane checki na `main`).

## Current State Analysis

Na podstawie `context/changes/testing-key-screen-layout/research.md`:

- Pomiary layoutu istnieją tylko w ręcznych skryptach bramek wizualnych (S-18, S-19, S-21, S-22) w `context/archive/**/screenshots/*.mjs`, uruchamianych na `npm run dev`, poza CI. Ostatni przebieg S-22 (2026-10-11) zmierzył brak overflow przy 390 px na widokach produkcyjnych; 1280 px na widokach produkcyjnych nie mierzono, przykrycia nie mierzy nic.
- `playwright.config.ts:26-33` ma projekty `setup` i `chromium` (`Desktop Chrome`, 1280×720). Brak projektu 390/coarse; w `tests/e2e/` brak asercji geometrii.
- Rozmiary: pasek biegu `size-12` = 48 px (`src/components/timer/DrillTimerView.tsx:43-73`), strzałki przy coarse 44×44 (`src/components/timer/ConfigStepper.tsx:21`), przy fine ok. 21 px (wyjątek „Equivalent” WCAG 2.5.8, CLAUDE.md); Start, Save timer, Save changes, Delete timer i przyciski dialogu 36 px (`src/components/ui/button.tsx:21`).
- Pojedyncze kliknięcie: strzałki pokryte w e2e tylko dla fine (`tests/e2e/config-form-stepper.spec.ts`); coarse odłożony do tej fazy. Podwójny klik: Start bez stanu pending (`src/components/timer/DrillConfigForm.tsx:165-170`), Restart montuje nowy bieg z przyciskiem w tym samym miejscu (`src/components/timer/DrillApp.tsx:107-111,131`), Pause bez zatrzasku (`src/components/timer/DrillTimer.tsx:141-147`) — wnioskowanie z kodu, niezweryfikowane w przeglądarce. Save, Save changes, Delete confirm, Cancel i Resume mają blokadę.
- CI: `npx playwright test` w jobie `smoke` (`.github/workflows/ci.yml:86-92`) uruchamia wszystkie projekty z configu, więc nowy projekt wchodzi do CI bez zmian w YAML.
- Ruleset `main` (id 23709389) ma tylko `non_fast_forward` i `pull_request`, bez `required_status_checks`; branch protection brak.
- Hook po edycji jest podłączony (`.claude/settings.json`), `.husky/pre-push` ma zakomentowane linie (`.husky/pre-push:1-2`), a `README.md:67` nadal opisuje aktywny pre-push.

## Desired End State

- `npx playwright test` w CI uruchamia dwie nowe specyfikacje w projekcie `chromium` (1280, fine) i w nowym projekcie `mobile-coarse` (390×844, `hasTouch` + `isMobile`, coarse primary pointer). Obie są zielone, z wyjątkiem testów podwójnego dotknięcia, które w przeglądarce potwierdziły dwie akcje: te są oznaczone `test.fail()` z odnośnikiem do nowej zmiany naprawczej.
- Złamanie układu (np. element szerszy niż okno, przycisk paska poniżej 44 px przy coarse, przykrycie kontrolki) czyni bramkę czerwoną; sprawdzone celowym zepsuciem i przywróceniem.
- `test-plan.md` ma jawny podział progów w §2 #7 (44 px / 24 px), wiersz layoutu w §4 i §5 jako `wired`, uzupełnione §6.5 i §6.6, hook po edycji jako `wired`, wiersze dla dwóch kroków CI bez pokrycia w §5, §3 Phase 4 `complete`.
- Ruleset `main` wymaga zielonych checków `ci` i `smoke` (po Twojej zgodzie, po zielonym PR).

Weryfikacja: `npx playwright test` lokalnie i w CI na PR; `gh api repos/{owner}/{repo}/rulesets/23709389 --jq '.rules[].type'` zawiera `required_status_checks`.

### Key Discoveries:

- Próg 44 px pochodzi z PRD FR-020 (strzałki przy coarse, `context/foundation/prd.md:153`) i CLAUDE.md (pasek biegu, 48 px hitbox); 24 px to minimum WCAG 2.2 AA (2.5.8) — decyzja planowania, zawęża §2 #7 test-planu.
- `hasTouch` w Chromium daje coarse primary pointer (CLAUDE.md, Config stepper); wariantu „fine primary + touch” nie da się ustawić opcją projektu (S-22 używa CDP) — zostaje w ręcznej bramce.
- `locator.click/tap({ trial: true })` wykonuje tylko kontrole actionability, w tym „Receives Events” (brak przykrycia); `toBeInViewport({ ratio: 1 })` — cały element w oknie (`context/docs/playwright.md`).
- `locator.tap()` wymaga `hasTouch: true` w kontekście (`context/docs/playwright.md`), więc tapy działają tylko w projekcie `mobile-coarse`.
- Do przeniesienia z S-22: predykat `documentElement.scrollWidth <= clientWidth` i lista winowajców `rect.right > vw + 0.5` przy błędzie (`context/archive/2026-10-11-ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs:81,305,450-457`).
- Wzorzec specyfikacji: `tests/e2e/seed.spec.ts` (lokatory po roli, `waitForHydration`, nazwa z `Date.now()`), dane przez `page.request.post("/api/drills")` z `Origin`, sprzątanie `DELETE` w `afterEach` (§6.4).

## What We're NOT Doing

- Nie zmieniamy rozmiarów przycisków (Start, Save, Delete itd. zostają 36 px) — decyzja planowania: 44 px tylko dla paska biegu i strzałek, reszta ≥ 24 px.
- Nie naprawiamy podwójnego dotknięcia Start, Restart i Pause w tej fazie; potwierdzony błąd trafia do nowej zmiany (`/10x-new`), test zostaje z `test.fail()`.
- Nie mierzymy w CI wariantu „fine primary pointer + touch” (laptop dotykowy) ani 390 px przy fine — zostają w ręcznej bramce S-22.
- Nie mierzymy rozmiaru strzałek przy fine (ok. 21 px, wyjątek „Equivalent” WCAG 2.5.8 udokumentowany w CLAUDE.md).
- Bez snapshotów pikselowych (`toHaveScreenshot`) i bez przeglądu multimodalnego (§5: optional; pomiar wystarcza dla overflow, rozmiaru i przykrycia).
- Nie sprawdzamy alertu `Saved "{name}".` (`src/components/timer/DrillCreateForm.tsx:107-111`): zapis przekierowuje na `/{id}`, a osiągalność tego stanu jest niepotwierdzona.
- Bez zmian w `.github/workflows/ci.yml` (nowy projekt wchodzi przez `npx playwright test`) i bez włączania pre-push (decyzja z commitu a9eb5ee).
- Bez stanów biegu Rest, Standby i ukończonego w pomiarze geometrii (Preparation, Exercise i pauza pokrywają oba warianty slotu Pause/Resume i wiersz statusu).

## Implementation Approach

E2E w Playwright na podglądzie produkcyjnym jest najtańszą warstwą z realnym sygnałem (geometria wymaga silnika layoutu; `node --test` nie ma DOM, §6.3). Jedna specyfikacja geometrii i jedna jednego kliknięcia, obie uruchamiane w dwóch projektach: istniejącym `chromium` (1280, fine) i nowym `mobile-coarse` (390, coarse). Progi i działanie zależą od projektu (`testInfo.project.name` lub wynik `matchMedia`), ale lokatory i przebieg są wspólne. Pomiary geometrii, które wymagają odczytu DOM całej strony (szerokość dokumentu, lista winowajców), żyją w jednym helperze `tests/e2e/support/layout.ts`, tak jak jedyne zapytanie DOM w `support/hydration.ts`; specyfikacje zostają przy lokatorach po roli. Fazy 1 i 2 prowadzi `/10x-e2e` (ryzyko → eksploracja `playwright-cli` → generowanie → przegląd antywzorców → weryfikacja przez celowe zepsucie); faza 3 to dokumentacja i ustawienia repozytorium.

## Critical Implementation Details

- **Kolejność dla Restart/Start w biegu:** Restart i Start tworzą nowy bieg z nowym `AudioContext` (`DrillApp.tsx:107-116`); liczba kontekstów z `installAudioSpy`/`readAudioContexts` (`tests/e2e/support/audio-spy.ts`) jest obserwowalnym licznikiem „ile biegów wystartowało”, bez sięgania do kodu. Spy instaluj przed `page.goto`.
- **Tapy tylko w `mobile-coarse`:** `tap()` rzuca bez `hasTouch`; w `chromium` używaj `click()`/`dblclick()`.
- **Podwójne kliknięcie/dotknięcie w jednym punkcie, bez ponownego lokalizowania:** dwa kolejne `locator.tap()` to nie podwójne dotknięcie — drugie wywołanie ponownie rozwiązuje lokator i czeka na actionability, więc po zmianie nazwy (`Pause drill` → `Resume drill`) albo odmontowaniu (Start) kończy się timeoutem, który `test.fail()` policzyłby jako „oczekiwany błąd”. W `mobile-coarse`: przed akcją odczytaj `boundingBox()` kontrolki, potem `page.touchscreen.tap(x, y)` dwa razy w środku tego pola, bez żadnej akcji na lokatorze między nimi. W `chromium`: `locator.dblclick()` (jedna kontrola actionability, oba kliknięcia w tym samym punkcie). Po podwójnej akcji nie wykonuj już akcji na lokatorach, tylko asercje (tak, by test z `test.fail()` mógł paść wyłącznie na asercji).
- **Punkt ustalenia dla „dokładnie jednej akcji”:** `expect.poll`/`toBeVisible` kończą się na pierwszym dopasowaniu i same nie dowodzą braku drugiej akcji. Licznik czytaj dopiero w stanie, w którym druga akcja byłaby już widoczna: Save timer / Save changes / Delete — po `waitForURL` na docelową stronę i `waitForHydration` (oba kliknięcia/dotknięcia są wysłane przed nawigacją, więc ewentualne drugie żądanie jest już w liczniku `page.on("request")`); Start / Restart — po widoku „Repetition 1 of N” liczba kontekstów audio jednorazowo przez `readAudioContexts` (konteksty powstają synchronicznie w geście, `audio-spy.ts`); Pause/Resume — oba zdarzenia są dostarczone przed asercją (CDP wysyła je sekwencyjnie, React 19 opróżnia dyskretne aktualizacje synchronicznie), więc jedna asercja stanu końcowego (widoczny przycisk `Resume drill` / `Pause drill`).
- **Sticky top bar:** Playwright przy przykrytym celu ponawia przewinięcie z innym wyrównaniem (`end`, `center`, `start`), więc `click/tap({ trial: true })` dowodzi „da się trafić przy jakimś położeniu przewinięcia” i nie da fałszywie czerwonego wyniku od paska `sticky top-0 z-50` (`src/components/AppTopBar.astro:21`); wykrywa trwałe przykrycia (np. warstwę nad kontrolką). Nie omijaj go przez `force`. Nagłówek `support/layout.ts` opisuje tę granicę.

## Phase 1: Coarse project and key-screen geometry

### Overview

Nowy projekt `mobile-coarse` i specyfikacja `key-screen-layout.spec.ts`, która na sześciu ekranach i trzech stanach biegu sprawdza brak poziomego scrolla, mieszczenie się kontrolek w oknie, progi rozmiaru i brak przykrycia, w obu projektach.

### Changes Required:

#### 1. Projekt 390 px z coarse pointer

**File**: `playwright.config.ts`

**Intent**: Dodać projekt, który emuluje telefon z dotykiem jako głównym wskaźnikiem i uruchamia tylko specyfikacje kluczowych ekranów, żeby nie podwajać czasu całego zestawu przy `workers: 1` w CI.

**Contract**: projekt `mobile-coarse`: `viewport { width: 390, height: 844 }`, `hasTouch: true`, `isMobile: true`, przeglądarka Chromium (jak `Desktop Chrome`), `storageState: "playwright/.auth/user.json"`, `dependencies: ["setup"]`, `testMatch: /key-screen-.*\.spec\.ts/`. Projekt `chromium` bez zmian (uruchamia też nowe specyfikacje przy 1280).

#### 2. Helper pomiarów layoutu

**File**: `tests/e2e/support/layout.ts` (nowy)

**Intent**: Jedno miejsce na asercje geometrii, żeby specyfikacje używały tylko lokatorów po roli, a odczyt DOM całej strony był w helperze (jak `hydration.ts`).

**Contract**:

- `expectNoHorizontalScroll(page)` — `documentElement.scrollWidth <= clientWidth`; przy błędzie komunikat z listą winowajców (`rect.right > document.documentElement.clientWidth + 0.5`, jak S-22 `:451`; nie `innerWidth`, bo przy `isMobile` i meta viewport bez `initial-scale` (`src/layouts/Layout.astro:22`) Chromium może pomniejszyć stronę i `innerWidth` przekroczy 390, a lista wyjdzie pusta; tag + nazwa dostępna lub tekst, skrócone).
- `expectTarget(locator, { minSize })` — po `scrollIntoViewIfNeeded()`: `toBeInViewport({ ratio: 1 })`, `boundingBox()` w poziomie w `[0, viewportWidth]` z tolerancją 0,5 px, szerokość i wysokość ≥ `minSize`, oraz sprawdzian przykrycia `click({ trial: true })` (w coarse `tap({ trial: true })`).
- `expectCoarsePointer(page, expected: boolean)` — `matchMedia("(pointer: coarse)").matches` zgodne z projektem; strażnik emulacji.
- Nagłówek pliku tłumaczy, dlaczego tu jest odczyt DOM (wyjątek od reguły lokatorów §6.4, tylko w helperze), oraz granicę `trial`: wykrywa trwałe przykrycie, nie przykrycie przez sticky top bar przy jednym położeniu przewinięcia (Playwright ponawia przewinięcie).

#### 3. Specyfikacja geometrii kluczowych ekranów

**File**: `tests/e2e/key-screen-layout.spec.ts` (nowy)

**Intent**: Udowodnić ryzyko #7 (bez poziomego scrolla, w oknie, trafialne, nieprzykryte) na ekranach z §2 #7, w najgorszym przypadku danych.

**Contract**:

- Nagłówek trzech linii (§6.4): `// risk: test-plan.md #7 — facet: layout and tap targets`, `// seed: tests/e2e/seed.spec.ts`, `// Oracle: PRD §NFR (no horizontal scroll, touch-proof controls), FR-020 (44 px coarse arrows), CLAUDE.md run bar; 24 px = WCAG 2.5.8; literals only`.
- Progi jako literały w specyfikacji: `TOUCH_TARGET = 44`, `MIN_TARGET = 24`. Przy coarse: Cancel drill, Restart drill, Pause drill / Resume drill i strzałki (`Increase|Decrease … by 1[ second]`) ≥ 44; Start, Save timer, Save changes, Delete timer, dialog Delete i Cancel ≥ 24. Przy fine: wszystkie wymienione ≥ 24 oprócz strzałek (tylko w oknie i nieprzykryte).
- Dane: timer przez API z najdłuższą nazwą (200 znaków, w tym jeden ciąg bez spacji) i wartościami granicznymi (`10:00`, `10:00`, `10:00`, `100`), sprzątanie `DELETE` z `Origin` w `afterEach`.
- Ekrany (każdy osobny test, `waitForHydration` przed pomiarem): `/` (pola z wartościami granicznymi, strzałki, głośniki, Start), `/create` (Save timer), `/{id}` (Start, Edit timer, Delete timer), dialog „Delete timer?” otwarty (Delete, Cancel; strona pod spodem nie jest mierzona), `/{id}/edit` (pola, strzałki, Save changes), `/timers` (karta timera), bieg w Preparation, w Exercise i w pauzie (Cancel drill, Restart drill, Pause drill/Resume drill). Na każdym `expectNoHorizontalScroll`.
- Stany biegu startują z `/{id}` (nagłówek `DrillApp` z długą nazwą, `SAVED_DRILL_HEADING_CLASS`, to najgorszy przypadek). Preparation: timer graniczny (preparation `10:00`), więc stan trwa dłużej niż pomiar. Exercise i pauza: osobny timer z tą samą długą nazwą (z innym sufiksem) i krótkim biegiem (preparation `0:01`, exercise `0:30`), Exercise rozpoznawany przez `parseRunView` (`tests/e2e/support/run-view.ts`), pauza mierzona po `Pause drill` (widoczny `Resume drill`); bez `waitForTimeout`.
- Każdy test zaczyna od `expectCoarsePointer` zgodnego z projektem.

### Success Criteria:

#### Automated Verification:

- Nowa specyfikacja przechodzi w obu projektach: `npx playwright test tests/e2e/key-screen-layout.spec.ts`
- Projekt coarse uruchamia tylko specyfikacje kluczowych ekranów: `npx playwright test --project=mobile-coarse --list` wypisuje wyłącznie pliki `key-screen-*.spec.ts`
- Cały zestaw e2e zielony: `npx playwright test`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Celowe zepsucie układu daje czerwony test z czytelną listą winowajców (np. tymczasowe `min-w-[480px]` na karcie lub `size-9` zamiast `size-12` na pasku), a po przywróceniu `git diff -- src/` jest pusty
- Przegląd specyfikacji względem pięciu antywzorców `/10x-e2e` (bez CSS/XPath w specyfikacji, bez `waitForTimeout`, niezależność, wyrocznia z literałów, sprzątanie)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: One click or tap is one action

### Overview

Specyfikacja `key-screen-single-action.spec.ts`: pojedynczy klik (fine) i pojedyncze dotknięcie (coarse) każdej głównej kontrolki wywołuje dokładnie jedną akcję; pomiar podwójnego kliknięcia/dotknięcia Start, Restart i Pause w przeglądarce.

### Changes Required:

#### 1. Specyfikacja jednej akcji

**File**: `tests/e2e/key-screen-single-action.spec.ts` (nowy)

**Intent**: Udowodnić „jedno kliknięcie = jedna akcja” z §2 #7 dla Start, Pause/Resume, Cancel, Restart, strzałek, Save timer, Save changes i Delete, zarówno myszą, jak i dotykiem; zmierzyć podwójne dotknięcie tam, gdzie kod nie ma blokady.

**Contract**:

- Nagłówek trzech linii jak w fazie 1 (`facet: one click or tap is one action`).
- Akcja wg projektu: `click()` w `chromium`, `tap()` w `mobile-coarse`; podwójne: `locator.dblclick()` w `chromium`, dwa `page.touchscreen.tap(x, y)` w środku `boundingBox()` odczytanego przed akcją w `mobile-coarse` (Critical Implementation Details: bez ponownego lokalizowania między dotknięciami).
- Każda obserwacja „dokładnie jedna” jest czytana w punkcie ustalenia z Critical Implementation Details (docelowy URL + hydratacja dla żądań, widok „Repetition 1 of N” dla kontekstów audio, stan końcowy przycisku dla Pause/Resume), nie przez `expect.poll` na liczniku.
- Obserwacje (wyrocznia z PRD, literały):
    - Start: dokładnie jeden bieg — jeden `AudioContext` w `readAudioContexts`, widok „Repetition 1 of N”, bieg nie jest w pauzie.
    - Pause → widok pauzy i „Resume drill”; Resume → bieg wznowiony; po każdym widok stały (jeden stan, nie przełączony z powrotem).
    - Cancel → formularz konfiguracji (przycisk Start widoczny), brak biegu.
    - Restart → dokładnie jeden nowy bieg (liczba kontekstów audio +1), powtórzenie 1.
    - Strzałki przy coarse: jedno dotknięcie = jeden krok (literały wartości, jak w `config-form-stepper.spec.ts`).
    - Save timer → dokładnie jedno żądanie `POST /api/drills` (licznik `page.on("request")`) i lądowanie na `/{id}`.
    - Save changes → dokładnie jedno `PUT /api/drills/{id}`.
    - Delete (dialog) → dokładnie jedno `DELETE /api/drills/{id}` i lądowanie na `/timers`.
- Podwójne kliknięcie/dotknięcie: Start (jeden bieg, nie w pauzie), Restart (+1 kontekst audio, nie +2), Pause (bieg pozostaje w pauzie), oraz Save timer i Delete (nadal jedno żądanie) jako kontrola blokad. Test, który w przeglądarce potwierdzi dwie akcje, dostaje `test.fail()` z komentarzem wskazującym nową zmianę naprawczą; asercja zostaje bez zmian (CLAUDE.md: czerwony test to sygnał).
- Dane przez API i sprzątanie jak w fazie 1; bez `waitForTimeout` (czekanie na stan, `waitForResponse`, `expect.poll` z gęstymi interwałami jak w `saved-timer-start.spec.ts`).

#### 2. Zgłoszenie potwierdzonego błędu podwójnego dotknięcia

**File**: `context/changes/testing-key-screen-layout/change.md` (sekcja `## Notes`)

**Intent**: Zapisać, które kontrolki w przeglądarce wykonały dwie akcje przy podwójnym dotknięciu, i otworzyć dla nich nową zmianę naprawczą, żeby `test.fail()` miał właściciela.

**Contract**: wpis w `## Notes` (kontrolka, projekt, obserwacja) + nowa zmiana przez `/10x-new` (np. `fix-double-tap-run-controls`), której id występuje w komentarzu przy `test.fail()`. Jeśli żaden test nie potwierdzi błędu, wpis mówi to wprost i nie ma `test.fail()`.

### Success Criteria:

#### Automated Verification:

- Specyfikacja przechodzi w obu projektach (testy z `test.fail()` raportowane jako expected failure): `npx playwright test tests/e2e/key-screen-single-action.spec.ts`
- Cały zestaw e2e zielony: `npx playwright test`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Celowe zepsucie (np. usunięcie zatrzasku `if (deleting) return` w `DeleteDrillDialog.tsx` razem z `pointer-events-none`, albo podwójne wywołanie kroku strzałki) daje czerwony test; po przywróceniu `git diff -- src/` jest pusty
- Każdy `test.fail()` ma w komentarzu id nowej zmiany, a zmiana istnieje w `context/changes/`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Close the quality gates

### Overview

Uaktualnić test-plan i README do stanu bramek, przejść zielony PR i (za zgodą) wymusić checki `ci` i `smoke` na `main`.

### Changes Required:

#### 1. Test-plan

**File**: `context/foundation/test-plan.md`

**Intent**: Zapisać zawężenie wyroczni #7, nową warstwę i podłączone bramki, żeby kolejne zmiany wiedziały, jak dodać pomiar ekranu.

**Contract**:

- §2 Risk Response #7: kolumna „What would prove protection” — pole trafienia ≥ 44 px przy dotyku dla paska biegu (Cancel, Restart, Pause/Resume) i strzałek, ≥ 24 px (WCAG 2.5.8) dla Start, Save, Save changes, Delete i przycisków dialogu; z datą decyzji.
- §3 Phase 4: `complete`.
- §4: wiersz „layout / tap targets” → Playwright (projekty `chromium` 1280 fine i `mobile-coarse` 390 coarse), liczba specyfikacji w profilu bazy testów.
- §5: „layout i tap targets” → `required (wired)` z miejscem `CI (smoke, npx playwright test)`; „post-edit hook” → `recommended (wired)`; nowe wiersze dla `ci.yml:22` (testy reguł ESLint i dowód hooków) i `ci.yml:70-72` (404 `/dev/timer-ui`); wymuszenie przez ruleset `main` (`ci`, `smoke`) albo stan „nie wymuszone”, jeśli krok 3 nie dostał zgody.
- §6.5: wzorzec (lokalizacja `tests/e2e/key-screen-*.spec.ts`, projekt `mobile-coarse`, helper `support/layout.ts`, progi 44/24, `trial` dla przykrycia, tap vs click, dane graniczne, uruchomienie `--project`).
- §6.6: 2–3 linie o fazie 4. §8: daty przeglądu strategii i weryfikacji.

#### 2. README

**File**: `README.md`

**Intent**: Usunąć rozbieżność: pre-push jest wyłączony (`.husky/pre-push:1-2`), a README opisuje go jako aktywny.

**Contract**: linia o hookach Git (`README.md:67`) mówi, że pre-push jest obecnie wyłączony, a `astro check` i `test:hooks` biegną w CI (`ci`); lista CI w README wspomina projekt `mobile-coarse`.

#### 3. Wymagane checki na `main`

**File**: ustawienia repozytorium GitHub (ruleset 23709389), bez pliku w repo

**Intent**: Sprawić, że „required” w §5 jest wymuszone: czerwony `ci` lub `smoke` blokuje merge.

**Contract**: krok ręczny, wykonywany dopiero po zielonym PR tej zmiany i po Twojej zgodzie. Dodać regułę `required_status_checks` z kontekstami `ci` i `smoke`, zachowując istniejące `non_fast_forward` i `pull_request` (PUT nadpisuje całą listę reguł):

```sh
gh api repos/{owner}/{repo}/rulesets/23709389 --jq '{name, target, enforcement, conditions, rules}' > ruleset.json
# dopisać do .rules:
# {"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,
#   "required_status_checks":[{"context":"ci"},{"context":"smoke"}]}}
gh api -X PUT repos/{owner}/{repo}/rulesets/23709389 --input ruleset.json
```

### Success Criteria:

#### Automated Verification:

- Formatowanie dokumentów: `npx prettier --check context/foundation/test-plan.md README.md`
- PR do `main` ma zielone `ci` i `smoke`, a krok `npx playwright test` w logu pokazuje testy projektu `mobile-coarse`: `gh pr checks`
- Ruleset wymaga checków: `gh api repos/{owner}/{repo}/rulesets/23709389 --jq '.rules[].type'` zawiera `required_status_checks`

#### Manual Verification:

- Zgoda na zmianę rulesetu udzielona przed wykonaniem kroku 3
- §2 #7, §5 i §6.5 test-planu czytają się spójnie z wybranymi progami i specyfikacjami

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Brak nowych: geometria i okablowanie kliknięć wymagają przeglądarki (§6.3).

### Integration Tests:

- Brak nowych: liczniki żądań w fazie 2 obserwują istniejące API z przeglądarki; walidacja API jest w `tests/integration/`.

### E2E:

- `key-screen-layout.spec.ts` — 9 testów (5 stron: `/`, `/create`, `/{id}`, `/{id}/edit`, `/timers` + dialog usuwania + 3 stany biegu: Preparation, Exercise, pauza) × 2 projekty.
- `key-screen-single-action.spec.ts` — pojedyncze i podwójne akcje × 2 projekty.

### Manual Testing Steps:

1. Celowe zepsucie układu i blokady (fazy 1–2), czerwony test, przywrócenie, pusty `git diff -- src/`.
2. Przegląd raportu HTML Playwright z błędu: lista winowajców i zrzut przy błędzie czytelne.
3. Po zmianie rulesetu: PR z czerwonym checkiem pokazuje zablokowany merge (obserwacja przy kolejnym PR).

## Performance Considerations

- `mobile-coarse` uruchamia tylko `key-screen-*.spec.ts`; `chromium` uruchamia je dodatkowo przy 1280. Ostatni zmierzony krok e2e w CI to ok. 50 s; job `smoke` ma limit 30 min (`.github/workflows/ci.yml:28`).
- Bez nowych logowań: oba projekty używają jednego `storageState` z `setup` (budżet poczty bez zmian).

## Migration Notes

Brak danych do migracji. Wycofanie: usunięcie projektu `mobile-coarse` i dwóch specyfikacji; ruleset przywraca się tym samym `PUT` bez reguły `required_status_checks`.

## References

- Related research: `context/changes/testing-key-screen-layout/research.md`
- Playwright docs: `context/docs/playwright.md`
- Wzorzec specyfikacji: `tests/e2e/seed.spec.ts`, `tests/e2e/config-form-stepper.spec.ts`
- Ręczna bramka (techniki pomiaru): `context/archive/2026-10-11-ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs:34-38,81,305,450-457`
- Test-plan: `context/foundation/test-plan.md` §2 #7, §5, §6.4, §6.5

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Coarse project and key-screen geometry

#### Automated

- [ ] 1.1 Nowa specyfikacja przechodzi w obu projektach
- [ ] 1.2 Projekt coarse uruchamia tylko specyfikacje kluczowych ekranów
- [ ] 1.3 Cały zestaw e2e zielony
- [ ] 1.4 Lint przechodzi

#### Manual

- [ ] 1.5 Celowe zepsucie układu daje czerwony test z listą winowajców, git diff -- src/ pusty
- [ ] 1.6 Przegląd specyfikacji względem pięciu antywzorców /10x-e2e

### Phase 2: One click or tap is one action

#### Automated

- [ ] 2.1 Specyfikacja przechodzi w obu projektach (test.fail jako expected failure)
- [ ] 2.2 Cały zestaw e2e zielony
- [ ] 2.3 Lint przechodzi

#### Manual

- [ ] 2.4 Celowe zepsucie blokady daje czerwony test, git diff -- src/ pusty
- [ ] 2.5 Każdy test.fail() wskazuje istniejącą nową zmianę

### Phase 3: Close the quality gates

#### Automated

- [ ] 3.1 Formatowanie dokumentów
- [ ] 3.2 PR do main ma zielone ci i smoke z testami mobile-coarse
- [ ] 3.3 Ruleset wymaga checków

#### Manual

- [ ] 3.4 Zgoda na zmianę rulesetu udzielona przed krokiem 3
- [ ] 3.5 §2 #7, §5 i §6.5 test-planu spójne z progami i specyfikacjami
