# Double click or tap on run controls — Implementation Plan

## Overview

Podwójny klik (mysz) lub dwa dotknięcia w jednym punkcie na Restart drill tworzą dwa nowe biegi, a na Pause drill wstrzymują i od razu wznawiają bieg. Plan dodaje wspólną blokadę podwójnej aktywacji paska biegu: przez 500 ms po Start, Restart, Pause albo Resume przycisk Restart i przełącznik Pause/Resume są `aria-disabled` i ignorują aktywację. Cancel nigdy nie jest blokowany. Po naprawie dwa testy z `test.fail()` w `tests/e2e/key-screen-single-action.spec.ts` przechodzą bez tego znacznika.

## Current State Analysis

- Drugi klik trafia w nowy przycisk w tym samym miejscu, który ma własną, poprawną obsługę pojedynczej akcji (`research.md` Summary 1). Restart: `DrillTimer` z `key={activeRun.identity}` (`src/components/timer/DrillApp.tsx:131`) montuje się od nowa ze świeżym `retiredIntentRef` (`src/components/timer/DrillTimer.tsx:38`). Pause: `pause()` bez zatrzasku (`DrillTimer.tsx:142-148`), a w prawym slocie pojawia się Resume (`src/components/timer/DrillTimerView.tsx:52-73`).
- `event.detail` nie wystarczy: iOS Safari i emulacja dotyku w Chromium (projekt `mobile-coarse`) dają zawsze `1` (`research.md`, „Dyskryminator”). Rozpoznawanie odbywa się więc po czasie od poprzedniej akcji paska.
- Stan blokady musi trzymać właściciel `/`, czyli `DrillApp`, bo Restart przemontowuje `DrillTimer` (`research.md`, „Gdzie musi żyć stan blokady”).
- Repo ma wzorzec widocznej blokady: `aria-disabled` (nigdy `disabled`) z `aria-disabled:pointer-events-none aria-disabled:opacity-50` i sprawdzeniem w handlerze (`src/components/timer/DeleteDrillDialog.tsx:86-101`).

## Desired End State

- Podwójny klik i podwójne dotknięcie Restart tworzą dokładnie jeden nowy bieg (start + Restart = 2 konteksty audio). Podwójne Pause zostawia bieg w pauzie.
- Przez 500 ms po każdej aktywacji Start, Restart, Pause albo Resume przycisk Restart i przełącznik Pause/Resume mają `aria-disabled="true"`, są przygaszone (`opacity-50`), nie przyjmują wskaźnika i ignorują aktywację z każdego źródła (wskaźnik, klawiatura, AT). Potem wracają do stanu aktywnego bez interakcji.
- Cancel jest aktywny przez cały czas, także w oknie blokady.
- Istniejące testy pojedynczej akcji i przebiegu przechodzą bez zmian, bo `locator.click()`/`tap()` czekają, aż przycisk przestanie być disabled.
- Weryfikacja: `npm test`, `npm run lint`, `npx playwright test` (oba projekty) na zielono, dwa `test.fail()` usunięte, zrzuty stanu „controls locked” w folderze zmiany.

### Key Discoveries:

- Playwright 1.64.1 traktuje sam przycisk z `aria-disabled="true"` jako disabled: `hasExplicitAriaDisabled` → `hasAriaDisabledInChain(element)` zaczyna od samego elementu (`node_modules/playwright-core/lib/coreBundle.js`, funkcje `getAriaDisabled`/`hasAriaDisabledInChain`). Repo już na tym polega: `tests/e2e/key-screen-layout.spec.ts:51`. To rozstrzyga Open Question 1 z `research.md`.
- `browserDrillClock.now()` zwraca **sekundy** (`performance.now() / 1000`), a `setWake` przyjmuje milisekundy (`src/lib/drill-run.ts:13-19`).
- Bramki held-mounted w `/dev/timer-ui` renderują `DrillTimer` z ręcznie przestawianym zegarem (`src/components/timer/TimerUiPreview.tsx:587-596, 978-988`). Blokada działająca na tym zegarze zablokowałaby ich scenariusze Pause→Resume na stałe.
- `tests/e2e/support/layout.ts:53-54` (`click/tap({ trial: true })`) czeka na Enabled. Pomiar paska tuż po starcie poczeka więc najwyżej 500 ms.

## What We're NOT Doing

- Nie blokujemy Cancel (CLAUDE.md: „Keep Cancel enabled…”) i nie dodajemy okna po Cancel. Podwójny Cancel, którego drugi klik trafi w Start formularza, nie jest zgłoszony ani zmierzony; zostaje poza zakresem.
- Nie blokujemy samego przycisku Start ani przycisków formularza. Start tylko otwiera okno dla paska nowego biegu.
- Nie zwalniamy klawiatury/AT (`event.detail === 0`) z okna (decyzja planu).
- Nie rozszerzamy guardu tożsamości `drill-run-identity` ani nie zmieniamy `retireIntent`, Wake Lock czy audio.
- Nie zmieniamy przenoszenia fokusu przy zamianie Pause↔Resume (zachowanie istniejące).
- Nie wpinamy blokady w bramki held-mounted w `/dev/timer-ui`. Używają one domyślnej, nieblokującej blokady, a nowa logika jest pokryta testami jednostkowymi i e2e.

## Implementation Approach

Czysty moduł blokady w `src/lib/` (jak `drill-step-press.ts` i `drill-resume-pending.ts`) z wstrzykiwanym `DrillClock`. `DrillApp` tworzy jedną instancję na zegarze przeglądarki, aktywuje ją w `start` i przekazuje do `DrillTimer`. `DrillTimer` sprawdza ją przed efektami ubocznymi Restart, Pause i Resume, subskrybuje stan i podaje `controlsLocked` do `DrillTimerView`, a widok wystawia blokadę jako `aria-disabled`. Prop jest opcjonalny z domyślną, nieblokującą implementacją, więc fixtures i bramki held-mounted działają bez zmian.

## Critical Implementation Details

- **Kolejność w Restart:** `DrillTimer.restart` musi zapytać blokadę **przed** `retireIntent()`. Odrzucony Restart po `retireIntent` zostawiłby wycofany, zatrzymany bieg na ekranie. Pause i Resume tak samo: najpierw dotychczasowe warunki odrzucenia (`retiredIntentRef`, `visibility.isHidden()` dla Resume), potem `tryActivate`, a dopiero potem efekty. Odrzucona próba nie może otworzyć okna.
- **Jednostki zegara:** `now()` w sekundach, okno 0.5 s, `setWake` w ms (500).
- **Priorytet prawego slotu:** `initializing || resumePending` nadal renderuje natywnie wyłączony loader. `controlsLocked` dotyczy tylko przycisków Pause i Resume, gdy są renderowane, oraz Restart.
- **Źródło snapshotu:** `useSyncExternalStore` w `DrillTimer` czyta `isLocked()`, czyli flagę zmienianą wyłącznie razem z powiadomieniem. Przy dławionych timerach w ukrytej karcie widok i handler mają wtedy zawsze ten sam stan.
- **Nowa instancja po Restart** czyta stan blokady przy montażu (subskrypcja zewnętrznego magazynu, np. `useSyncExternalStore`). Inaczej przycisk nowego biegu przez pierwszy render byłby aktywny.

## Phase 1: Moduł blokady podwójnej aktywacji

### Overview

Czysta logika okna 500 ms, testowana `node --test` z fałszywym zegarem, bez Reacta.

### Changes Required:

#### 1. Moduł blokady

**File**: `src/lib/drill-control-guard.ts`

**Intent**: Jedno źródło prawdy dla „czy pasek biegu przyjmuje teraz akcję”. Pierwsza aktywacja otwiera okno 500 ms, aktywacje w oknie są odrzucane, a koniec okna powiadamia subskrybentów, żeby widok zdjął `aria-disabled` bez interakcji.

**Contract**: eksportuje `DRILL_CONTROL_GUARD_WINDOW_SECONDS = 0.5`, interfejs `DrillControlGuard { tryActivate(): boolean; arm(): void; isLocked(): boolean; subscribe(listener: () => void): () => void; reset(): void }`, fabrykę `createDrillControlGuard(clock: DrillClock): DrillControlGuard` oraz nieblokującą `unlockedDrillControlGuard`, której `tryActivate()` zawsze zwraca `true`, `arm()` i `reset()` nic nie robią, a `isLocked()` zawsze zwraca `false`. Niezmienniki:

- Jedno źródło prawdy: wewnętrzna flaga `locked`. Zapalają ją `tryActivate()` i `arm()`, gasi ją wybudzenie albo `reset()`. `isLocked()` i `tryActivate()` czytają tylko tę flagę, nigdy nie liczą czasu (plan-review F4).
- `tryActivate()` zwraca `false` i niczego nie zmienia, gdy `locked`. W przeciwnym razie robi to samo co `arm()` i zwraca `true`.
- `arm()` zawsze (ponownie) otwiera okno od teraz: czyści poprzednie wybudzenie, zapala `locked`, planuje `clock.setWake(…, 500)` i powiadamia subskrybentów, gdy flaga zmieniła wartość. Używa go Start, żeby okno trwało pełne 500 ms także wtedy, gdy poprzednie jeszcze trwa (plan-review F2).
- Wybudzenie gasi `locked` i powiadamia subskrybentów.
- `reset()` czyści wybudzenie i gasi `locked` (z powiadomieniem, gdy flaga się zmieniła), ale zostawia blokadę używalną: kolejne `tryActivate()` znowu blokuje i planuje wybudzenie. Subskrybenci nie są odpinani, bo odpina ich `unsubscribe` z efektu. Wzorzec: `src/components/hooks/useStepRepeat.ts:45` i test „stop on cleanup keeps the repeater usable when the effect runs again on the same instance” w `src/lib/drill-step-repeat.test.ts` (plan-review F1).

#### 2. Testy modułu

**File**: `src/lib/drill-control-guard.test.ts`

**Intent**: Wyrocznia z decyzji planu (500 ms, wspólne okno), nie ze stałej w kodzie. Wartości graniczne są literałami w teście.

**Contract**: przypadki (fałszywy zegar z ręcznym `now` i kolejką wybudzeń):

- pierwsza aktywacja przechodzi i blokuje;
- druga przy +0.499 s jest odrzucona i nie przesuwa okna;
- aktywacja przy +0.5 s przechodzi i otwiera nowe okno;
- wybudzenie powiadamia o odblokowaniu, a `isLocked()` jest wtedy `false`;
- `isLocked()` pozostaje `true` po upływie 0.5 s, dopóki wybudzenie się nie wykona (flaga, nie czas);
- odrzucona aktywacja nie planuje nowego wybudzenia;
- `arm()` przy +0.3 s w trwającym oknie przesuwa koniec okna: przy +0.6 s blokada nadal trwa, a jej koniec przypada na +0.8 s;
- `subscribe` zwraca funkcję odpinającą;
- `reset()` czyści wybudzenie (`clearWake`), odblokowuje, jest idempotentne, a po nim `tryActivate()` znowu blokuje i planuje wybudzenie;
- `unlockedDrillControlGuard` nigdy nie blokuje.

Plik zostaje objęty wzorcem `npm test` (`src/lib/*.test.ts`).

### Success Criteria:

#### Automated Verification:

- Testy modułu przechodzą: `node --test src/lib/drill-control-guard.test.ts`
- Cały zestaw jednostkowy przechodzi: `npm test`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Celowe zepsucie (wybudzenie po 400 ms zamiast 500 albo `arm()` bez czyszczenia poprzedniego wybudzenia) daje czerwony test graniczny albo test `arm()`; po przywróceniu `git diff -- src/lib/drill-control-guard.ts` pokazuje tylko zamierzony kod

**Implementation Note**: Po zielonych kontrolach automatycznych zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Podpięcie do biegu i testy w przeglądarce

### Overview

Właściciel tworzy blokadę i aktywuje ją przy Start, `DrillTimer` używa jej przed efektami Restart, Pause i Resume, a widok wystawia `aria-disabled`. Dwa `test.fail()` znikają.

### Changes Required:

#### 1. Właściciel `/`

**File**: `src/components/timer/DrillApp.tsx`

**Intent**: Jedna blokada na czas życia `DrillApp`, przeżywająca przemontowanie `DrillTimer` przy Restart.

**Contract**: instancja `createDrillControlGuard(browserDrillClock)` utworzona raz (jak `identityState`, `DrillApp.tsx:62`). Cleanup efektu wywołuje `reset()` (nie jednokierunkowe zwolnienie), więc po StrictMode i Fast Refresh ta sama instancja dalej blokuje. `start(snapshot)` wywołuje `arm()` przed `createActiveRun`, więc okno trwa pełne 500 ms od Startu, nawet gdy poprzednie jeszcze trwa. Startu nic nie blokuje. Instancja trafia do `<DrillTimer controlGuard={…}>`. `restart` i `cancel` w `DrillApp` bez zmian, bo aktywację Restart wykonuje `DrillTimer` przed `onRestart`.

#### 2. Bieg

**File**: `src/components/timer/DrillTimer.tsx`

**Intent**: Odrzucać Restart, Pause i Resume w oknie, zanim cokolwiek zostanie wycofane, wstrzymane albo wznowione, i przekazać stan blokady do widoku.

**Contract**: nowy opcjonalny prop `controlGuard?: DrillControlGuard`, domyślnie `unlockedDrillControlGuard`.

- `restart`: `if (!controlGuard.tryActivate()) return` przed `retireIntent()`, ale po sprawdzeniu `retiredIntentRef`, żeby wycofana instancja nie otwierała okna.
- `pause`: po `if (retiredIntentRef.current) return`.
- `resume`: po sprawdzeniu `retiredIntentRef`, `visibility.isHidden()` i `runRef.current`.
- `cancel` bez zmian.
- Stan `controlsLocked` z subskrypcji `controlGuard`, czytany przy montażu, przekazany do `DrillTimerView`.

#### 3. Widok paska

**File**: `src/components/timer/DrillTimerView.tsx`

**Intent**: Pokazać i egzekwować blokadę tak, żeby Playwright i AT widziały ją jako disabled, a geometria i fokus się nie zmieniały.

**Contract**: nowy prop `controlsLocked?: boolean` (domyślnie `false`). Gdy `true`: przycisk Restart oraz renderowany przycisk Pause albo Resume dostają `aria-disabled="true"` i klasy `aria-disabled:pointer-events-none aria-disabled:opacity-50` (przez `cn()`), a ich `onClick` nie wywołuje callbacku. Cancel i loader (natywne `disabled`) bez zmian. Bez nowych kolorów i wymiarów (kontrakt timer UI, `npm run lint`).

#### 4. Testy e2e

**File**: `tests/e2e/key-screen-single-action.spec.ts`

**Intent**: Błąd jest naprawiony, więc testy podwójnej akcji mają przechodzić. Asercje zostają bez zmian (CLAUDE.md: czerwony test to sygnał).

**Contract**: usunąć `test.fail()` i komentarz o zmianie naprawczej z „a double Restart still starts one new run” (`:214-228`) i „a double Pause leaves the run paused” (`:230-242`). Komentarz nagłówka (`:5-6`) zaktualizować: podwójna akcja jest blokowana przez okno 500 ms. Nowy test „Cancel stays enabled right after Pause”: po `startRun` aktywacja Pause, od razu `expect(cancel).not.toHaveAttribute("aria-disabled", "true")`, potem natychmiast Cancel i asercje jak w „Cancel returns…”. Asercja jest deterministyczna, bo Cancel nigdy nie ma tego atrybutu, a `click()` czekający na Enabled nie wykryłby zablokowanego Cancel (plan-review F3). Bez `waitForTimeout` i bez dodatkowych oczekiwań w innych specyfikacjach.

### Success Criteria:

#### Automated Verification:

- Specyfikacja jednej akcji przechodzi w obu projektach, bez `test.fail()`: `npx playwright test tests/e2e/key-screen-single-action.spec.ts`
- Cały zestaw e2e przechodzi, w tym `run-audio-signals`, `run-phase-sequence` i `key-screen-layout`: `npx playwright test`
- `npm test`, `npm run lint` i `npx astro check` przechodzą

#### Manual Verification:

- Celowe zepsucie: pominięcie `tryActivate()` w `DrillTimer.restart` daje czerwony „a double Restart…”, a w `pause` czerwony „a double Pause…”; po przywróceniu `git diff -- src/` pokazuje tylko zamierzone zmiany
- Na telefonie albo w DevTools (390 px, dotyk): podwójne dotknięcie Pause zostawia pauzę, Resume po chwili działa; Cancel w oknie blokady działa od razu

**Implementation Note**: Po zielonych kontrolach automatycznych zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Fixtures, bramka wizualna i kontrakt

### Overview

Nowy stan kontrolek trafia do `/dev/timer-ui` i do bramki wizualnej, a kontrakt paska w CLAUDE.md i AGENTS.md dostaje wyjątek dla okna blokady.

### Changes Required:

#### 1. Fixture stanu zablokowanego

**File**: `src/components/timer/TimerUiPreview.tsx`

**Intent**: Deterministyczny podgląd paska w oknie blokady, aktywnego i w pauzie, do przeglądu wizualnego i stanu disabled bramki.

**Contract**: dwa wpisy w liście `fixtures` sekcji „Timer phase state examples” (`TimerUiPreview.tsx:1205-1235`), np. „Controls locked active” i „Controls locked paused”, z `controlsLocked: true` przekazanym do `DrillTimerView` i `data-visual-state="disabled"`. Bramki held-mounted bez zmian.

#### 2. Zrzuty

**File**: `context/changes/fix-double-tap-run-controls/screenshots/`

**Intent**: Dowód wizualny przed akceptacją zmiany UI (CLAUDE.md, „Visual gate”).

**Contract**: zrzuty obu nowych fixtures oraz istniejącego stanu aktywnego (dla porównania) w trybie jasnym i ciemnym przy 1280 i 390 px, wykonane `playwright-cli` albo małym skryptem w tym folderze (wzór: `context/archive/2026-10-09-run-view-layout/screenshots/run-view-visual-gate.mjs`; nowy skrypt dodany do ignorów lint tylko jako ten jeden plik, jak poprzednie).

#### 3. Kontrakt paska

**File**: `CLAUDE.md`, `AGENTS.md` (sekcja „Timer controls”, oba pliki mają tę samą treść)

**Intent**: Zapisać decyzję, żeby następny agent nie usunął blokady jako sprzecznej z „Restart enabled”.

**Contract**: zdanie o Restart dostaje wyjątek: przez 500 ms po Start, Restart, Pause albo Resume (`src/lib/drill-control-guard.ts`, instancja w `DrillApp`) Restart i Pause/Resume są `aria-disabled` i ignorują aktywację z każdego źródła, a Cancel nigdy nie jest blokowany. Dopisać odwołanie do zrzutów w folderze zmiany.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi, w tym kontrakt timer UI dla `TimerUiPreview.tsx` i `DrillTimerView.tsx`
- `npm test` i `npx astro check` przechodzą
- Prettier nie zmienia dokumentów: `npx prettier --check CLAUDE.md AGENTS.md context/changes/fix-double-tap-run-controls`

#### Manual Verification:

- Zrzuty fixtures „controls locked” w jasnym i ciemnym przy 1280 i 390 px przejrzane: przygaszony Restart i Pause/Resume, Cancel pełny, bez przesunięcia paska
- CLAUDE.md i AGENTS.md mają identyczny nowy wyjątek
- Regresja istniejących bramek wizualnych: oba skrypty zapisują zrzuty obok siebie (`join(here, …)`), więc archiwum zostaje nietknięte, a ich kopie trafiają do `context/changes/fix-double-tap-run-controls/screenshots/regression/` (dodane do ignorów lint jak nowy skrypt). `npm run dev`, potem `PLAYWRIGHT_PATH=… node …/regression/run-view-visual-gate.mjs` i `node …/regression/ux-fixes-round-3-visual-gate.mjs` (lokalny Supabase) kończą się bez błędów, a `git status -- context/archive` jest pusty (plan-review F5)

**Implementation Note**: Po tej fazie zmiana jest gotowa do `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `drill-control-guard.test.ts`: granica 0.499/0.5 s, odrzucenie nie przesuwa okna, flaga zamiast czasu, `arm()` przesuwa koniec okna, powiadomienie przy odblokowaniu, `reset()` zostawia blokadę używalną, wariant nieblokujący.

### Integration Tests:

- E2E `key-screen-single-action.spec.ts` (projekty `chromium` i `mobile-coarse`): podwójny Restart = +1 kontekst audio, podwójny Pause = pauza; Cancel bez `aria-disabled` zaraz po Pause; testy pojedynczej akcji i przebiegu zostają bez zmian jako regresja (czekają na Enabled).

### Manual Testing Steps:

1. Na `/{id}` uruchom bieg i zrób podwójny klik Restart: widać jeden nowy bieg od „Repetition 1 of 2”.
2. Podwójne dotknięcie Pause przy 390 px z dotykiem: bieg zostaje w pauzie, Resume jest przez chwilę przygaszony, potem działa.
3. Zaraz po Pause kliknij Cancel: powrót do konfiguracji od razu.

## Performance Considerations

Brak: jeden timer na aktywację, czyszczony przy następnym `arm()` i `reset()`.

## Migration Notes

Nie dotyczy.

## References

- Research: `context/changes/fix-double-tap-run-controls/research.md`
- Wzorzec `aria-disabled`: `src/components/timer/DeleteDrillDialog.tsx:86-101`
- Wzorzec czystej logiki gestu: `src/lib/drill-step-press.ts`, `src/lib/drill-resume-pending.ts`
- Poprzednia faza testów: `context/archive/2026-10-15-testing-key-screen-layout/plan.md:56,150-159`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Moduł blokady podwójnej aktywacji

Model: Claude Sonnet 5.5

#### Automated

- [x] 1.1 Testy modułu przechodzą — 1734966
- [x] 1.2 Cały zestaw jednostkowy przechodzi — 1734966
- [x] 1.3 Lint przechodzi — 1734966

#### Manual

- [x] 1.4 Celowe zepsucie wybudzenia albo arm() daje czerwony test — 1734966

### Phase 2: Podpięcie do biegu i testy w przeglądarce

#### Automated

- [ ] 2.1 Specyfikacja jednej akcji przechodzi w obu projektach bez test.fail()
- [ ] 2.2 Cały zestaw e2e przechodzi
- [ ] 2.3 npm test, lint i astro check przechodzą

#### Manual

- [ ] 2.4 Celowe zepsucie w restart i pause daje czerwone testy podwójnej akcji
- [ ] 2.5 Podwójne dotknięcie Pause na 390 px zostawia pauzę, Cancel w oknie działa

### Phase 3: Fixtures, bramka wizualna i kontrakt

#### Automated

- [ ] 3.1 Lint przechodzi z kontraktem timer UI
- [ ] 3.2 npm test i astro check przechodzą
- [ ] 3.3 Prettier nie zmienia dokumentów

#### Manual

- [ ] 3.4 Zrzuty controls locked przejrzane w jasnym i ciemnym przy 1280 i 390 px
- [ ] 3.5 CLAUDE.md i AGENTS.md mają identyczny wyjątek
- [ ] 3.6 Bramki run-view i ux-fixes-round-3 przechodzą jako regresja
