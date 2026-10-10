# UX fixes round 3 Implementation Plan

## Overview

S-22 (poprawki po ponownym teście S-21, 2026-10-11; dotyka FR-018, FR-019, FR-020): (1) pojedynczy klik lub dotknięcie strzałki steppera zmienia wartość o 2, (2) strzałki mają być wewnątrz ramki pola jak natywny spinner, a układ ma wybierać główny wskaźnik (nie `any-pointer`), (3) tooltip odsłuchu na komputerze łamie tekst i zostawia pustą prawą część, (4) okienko Current wraca do wyglądu bez ramki i tła. Brak zmian w API, bazie, migracjach i walidacji.

## Current State Analysis

- Podwójny krok: `src/components/timer/ConfigStepper.tsx:35-67` — krok na `pointerdown` (przez `useStepRepeat().start`, który stepuje natychmiast, `useStepRepeat.ts:41-52`), `handledByPointer` w refie tłumi następny `click`, a flaga jest kasowana timerem `CLICK_AFTER_POINTER_MS = 100` uzbrajanym w `release()` (wołane z `pointerup`, `pointerleave`, `pointercancel`, `lostpointercapture`) oraz w `onBlur`. `click` po `pointerup` na dotyku, przy wolnym renderze lub touchpadzie przychodzi później niż 100 ms (albo flaga zniknie wcześniej przez `blur`/`pointerleave`), więc `handleClick` stepuje drugi raz. Przyczyna jest strukturalna: poprawność zależy od czasu, a ten sam gest ma dwa źródła kroku (`pointerdown` i `click`). Skutek odwrotny: `pointerup` poza przyciskiem (brak `click`) zostawia flagę ustawioną do wygaśnięcia timera.
- Powtarzanie: `src/lib/drill-step-repeat.ts` — `createStepRepeater.start(step)` wykonuje krok od razu, po `REPEAT_DELAY_MS = 400` uruchamia interwał `REPEAT_INTERVAL_MS = 100`; testy w `drill-step-repeat.test.ts`. Logika wartości: `src/lib/drill-stepper.ts` (`stepFieldValue`, `canStep`, bez zmian).
- Układ steppera: `ConfigStepper.tsx:21,100-104` — kolumna 2 × `h-5.5` domyślnie, `any-pointer-coarse:` przełącza na dwa przyciski 44 px obok siebie; stepper jest osobnym elementem wiersza obok `Input` (`DrillConfigForm.tsx:64-95`: `flex items-center gap-2`, `Input` `flex-1`, `ConfigStepper`, `action` lub pusty `size-11`). Laptop z ekranem dotykowym ma `any-pointer: coarse`, więc dostaje układ dotykowy mimo głównej myszy.
- shadcn `input-group` (`npx shadcn@latest view input-group`): `InputGroup` (ramka, ring całości przez `has-[[data-slot=input-group-control]:focus-visible]`, stan błędu przez `aria-invalid`), `InputGroupInput` (pole bez ramki), `InputGroupAddon` (`align="inline-end"`), `InputGroupButton`. Pasuje; wysokość domyślnie `h-9`, więc trzeba przekazać `h-11`. Rejestr zależy od `button` i `input` (są) oraz `textarea` (nie jest używany; instalacja doda plik `textarea.tsx`).
- Tooltip: `src/components/ui/tooltip.tsx:24` — `w-fit max-w-xs` (320 px); treść to dwa `<p>` (`SignalPreviewControl.tsx:115-118`: znaczenie sygnału plus opcjonalna nota). Opisy: `SIGNAL_MEANINGS` w `src/lib/drill-signal-preview.ts`.
- Current: `src/components/timer/PhaseSections.tsx:10-20` — `PhaseBox` (`bg-muted border-border rounded-lg border px-4 py-3`, etykieta `text-xl font-semibold`, linia `text-lg font-medium tabular-nums`) renderuje oba okienka; model `src/lib/drill-phase-sections.ts` i jego testy (w tym różnicowe Standby) zostają bez zmian. AGENTS.md mówi „two identical `role="group"` boxes”; PRD FR-018 i `ux-fixes-plan.md` opisują Current „jak Next”.
- Fixtures i bramka: `ConfigStepperFixtures.tsx`, `PhaseSectionsFixtures.tsx`, `SignalPreviewFixtures.tsx` w `/dev/timer-ui`; skrypt `context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs` (setupy fine / coarse / mouse-touch, 7 stanów × jasny/ciemny × 1280/390; wyjątek lintu tylko dla pliku skryptu w `eslint.config.js`).

## Desired End State

- Jeden klik myszą lub jedno dotknięcie strzałki zmienia wartość dokładnie o 1, niezależnie od opóźnienia `click` po `pointerup`; przytrzymanie dłużej niż 400 ms powtarza krok co 100 ms i po puszczeniu nie dodaje kroku. `click` bez wskaźnika (klawiatura, czytnik ekranu, sterowanie głosem) stepuje o 1. Puszczenie, wyjście wskaźnika, utrata capture, `blur`, odmontowanie i `pointercancel` zatrzymują powtarzanie; brak menu kontekstowego; granica `aria-disabled`.
- Strzałki `ChevronUp`/`ChevronDown` leżą wewnątrz ramki pola przy prawej krawędzi (wspólna ramka, jeden focus ring, pole bez własnej ramki). Główny wskaźnik precyzyjny (także laptop z dotykiem): ▲ nad ▼ w kolumnie 2 × 22 px, wiersz 44 px. Główny wskaźnik coarse (`pointer-coarse`): ▼ i ▲ obok siebie, każdy 44 px, z separatorem, w ramce; ikona głośnika pozostaje poza polem po prawej; brak overflow przy 390 px (także `10:00`, `100`, komunikat błędu).
- Tooltip na komputerze szerszy (od `md` do `max-w-md`, 448 px) — opisy w 1–2 liniach, bez luki; na telefonie bez zmian (`max-w-xs`).
- Current bez ramki i bez tła (napisy i rozmieszczenie jak dziś, ta sama wysokość co Next); Next bez zmian.
- Weryfikacja: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`, bramka wizualna `/dev/timer-ui` (skrypt Playwright: 7 stanów × jasny/ciemny × 1280/390 × fine/coarse oraz „fine primary + touch”, test jednego kliku/tapnięcia także z opóźnionym `click`), checki skryptem opisywane jako „script, not human”; regresja skryptów S-18 i S-19. Smoke lokalny nie działa (brak Mailpit), potwierdza go CI.

### Key Discoveries:

- Wyścig jest czasowy (`ConfigStepper.tsx:38-43,67-72`); usunięcie go u źródła = jeden krok zawsze z `click`, a `pointerdown` tylko uzbraja powtarzanie. Jeśli powtarzanie ruszyło, następny `click` (generowany po puszczeniu na tym samym przycisku) jest pomijany; flaga jest kasowana przez ten `click`, nowy `pointerdown` albo przerwanie gestu, nigdy timerem. Kolejność zdarzeń: `pointerup` → `lostpointercapture` → `click`, więc `lostpointercapture` po `pointerup` nie może kasować flagi.
- Tailwind 4.3 ma wbudowane `pointer-coarse:`/`pointer-fine:`; domyślny układ (bez wariantu) zostaje kolumną, `pointer-coarse:` przełącza na wiersz, bez `@custom-variant`.
- Kolumna 2 × `h-5.5` = 44 px = wysokość ikony głośnika; ramka `InputGroup` z `h-11` wyrównuje wiersze Preparation/Repetitions do pozostałych.
- WCAG 2.5.8 (24 px): kolumna 22 px nadal korzysta z wyjątku „Equivalent” (pole tekstowe i ↑/↓); na `pointer-coarse` cele mają 44 px. Uzasadnienie w AGENTS.md zmienia się z `any-pointer-coarse` na główny wskaźnik.
- Playwright (poza zależnościami; `PLAYWRIGHT_PATH`): kontekst `hasTouch` zmienia też główny wskaźnik na coarse (zweryfikowane, faza 1), więc „fine primary + touch” = zwykły kontekst + tapnięcia przez CDP `Input.dispatchTouchEvent`; `click` po takim tapnięciu ma `detail` 1.

## What We're NOT Doing

- Zmian w `drill-stepper.ts` (wartości, granice), API, bazie, walidacji, kontrolerze odsłuchu i sygnałach.
- Przyspieszania powtarzania, kroku innego niż 1 dla przycisków, `type="number"`, zmiany klawiszy ↑/↓ i ogłaszania wartości.
- Zmian okienka Next, modelu `drill-phase-sections.ts` i jego testów (tylko renderowanie Current).
- Zmian tooltipu na telefonie i logiki podpowiedzi dotykowej (`signal-preview-hint`).
- Nowych tokenów kolorów, archiwizacji zmian S-16–S-21, testów ręcznych poza opisem PR.

## Implementation Approach

Cztery małe fazy, każda zielona osobno (commit kodu + mały commit docs z SHA): (1) logika kroku bez podwójnego kliku: czysty moduł + testy + podłączenie w `ConfigStepper` bez zmiany wyglądu oraz szkielet skryptu bramki z testem „1 klik = 1 krok”, (2) strzałki w polu (`input-group`) i układ wg głównego wskaźnika, (3) tooltip szerszy na komputerze i Current bez ramki/tła, (4) fixtures, pełna bramka wizualna (7 stanów, trzy setupy), dokumentacja i regresja S-18/S-19.

## Phase 1: Krok bez podwójnego kliku

### Overview

Zastąpić „krok na `pointerdown` + flaga z timerem” modelem „krok zawsze z `click`, `pointerdown` uzbraja powtarzanie po pauzie”, w czystym module z testami. Wygląd bez zmian.

### Changes Required:

#### 1. Powtarzanie uzbrajane po pauzie

**File**: `src/lib/drill-step-repeat.ts`, `src/lib/drill-step-repeat.test.ts`

**Intent**: Dodać do repeatera operację, która NIE wykonuje kroku od razu, tylko po `REPEAT_DELAY_MS` wykonuje pierwszy krok powtarzania i uruchamia interwał; istniejące `start` zostaje.

**Contract**: `StepRepeater.arm(step: () => boolean, onFire?: () => void): void` — `onFire` wołane raz, tuż przed pierwszym krokiem po pauzie (sygnał „powtarzanie ruszyło”), także gdy ten pierwszy krok zwraca `false` (użytkownik trzymał >400 ms, więc następny `click` ma być pominięty); `step` zwracające `false` (granica) zatrzymuje powtarzanie; `stop()`/`dispose()` anulują pauzę i interwał. Kontroler nie uzbraja, gdy wartość jest już na granicy w tym kierunku (`click` i tak nic nie robi). Zmiana UX względem rundy 2: pojedynczy krok następuje przy puszczeniu (`click`), nie przy wciśnięciu, a powtarzanie zaczyna się po 400 ms — do opisu PR. Testy `arm`: brak kroku przed pauzą, krok po 400 ms, interwał, `onFire` także przy granicy w pierwszym kroku, brak uzbrojenia na granicy, `stop`/`dispose`.

#### 2. Kontroler gestu

**File**: `src/lib/drill-step-press.ts` (nowy), `src/lib/drill-step-press.test.ts` (nowy)

**Intent**: Czysty moduł bez DOM i bez czasu rzeczywistego (wstrzykiwany repeater) trzymający stan gestu: czy powtarzanie ruszyło i czy następny `click` ma być pominięty. Zastępuje `handledByPointer` + timer.

**Contract**: `createStepPress(repeater, performStep): { pointerDown(direction), pointerUp(overButton: boolean), pointerAbort(), blur(), click(direction, fromPointer: boolean) }`. Kontroler trzyma dwa pola: `pressed` (gest trwa) i `skipClick` (jeden następny `click` pochodzi z tego gestu). Reguły:
- `pointerDown` (także w trakcie gestu = restart): czyści `skipClick`, ustawia `pressed`, uzbraja powtarzanie; `onFire` ustawia `skipClick` (powtarzanie ruszyło).
- `pointerUp(overButton)`: działa tylko gdy `pressed` (inaczej no-op); ustawia `pressed = false`, zatrzymuje powtarzanie; `skipClick` zostaje tylko gdy powtarzanie wystartowało ORAZ puszczenie nastąpiło nad przyciskiem (`overButton`, z `getBoundingClientRect` w komponencie); puszczenie poza przyciskiem = abort (click nie przyjdzie).
- `pointerAbort()` (leave, cancel, utrata capture): działa tylko gdy `pressed`; po `pointerUp` jest no-op (kolejność `pointerup` → `lostpointercapture` → `click` i podwójny abort nie mają znaczenia); zatrzymuje powtarzanie i czyści `skipClick`.
- `blur()` i odmontowanie (dispose w hooku): zatrzymują powtarzanie, czyszczą `pressed` i `skipClick`.
- `click(direction, fromPointer)`: `fromPointer = event.detail > 0`. Gdy `fromPointer` jest `false` (klawiatura, `element.click()` z AT/głosu), zawsze wykonuje krok i czyści `skipClick`. Gdy `true` i `skipClick`, pomija krok i czyści flagę. W pozostałych przypadkach jeden krok (na granicy `canStep` blokuje).
Wymagane testy: pojedynczy klik = 1 krok; „click po >100 ms (np. 1000 ms) od `pointerUp` daje dokładnie 1 krok”; przytrzymanie 400 ms+ powtarza, a po `pointerUp` + `click` nie dodaje kroku; przytrzymanie, puszczenie poza przyciskiem (abort) i następny `click` z `detail` 0 stepuje; flaga po `pointerUp` bez `click` (np. `contextmenu`), następny `click` z `detail` 0 stepuje, a nowy `pointerDown` czyści flagę; `pointerAbort` po `pointerUp` zostawia flagę; `lostpointercapture` po `pointerUp` nie kasuje flagi; `pointerUp` bez `pointerDown` = no-op; podwójny `pointerDown` i podwójny `pointerAbort`; `blur` w trakcie przytrzymania zatrzymuje i czyści flagę; granica zatrzymuje powtarzanie. Ryzyko F1: voice control w iOS może wysłać `click` z `detail` 1 — wtedy pominięty zostanie najwyżej jeden krok po długim przytrzymaniu, które i tak kończy się `pointerup` nad przyciskiem; akceptowane i zapisane w ryzykach.

#### 3. Hook i komponent

**File**: `src/components/hooks/useStepRepeat.ts`, `src/components/timer/ConfigStepper.tsx`

**Intent**: Hook udostępnia kontroler (krok czyta aktualną wartość z refa jak dziś, a krok z `click` też aktualizuje ref); `ConfigStepper` przestaje używać `handledByPointer`, `clearTimer` i `CLICK_AFTER_POINTER_MS`, a zdarzenia mapuje na `pointerDown`/`pointerUp`/`pointerAbort`/`blur`/`click`. `setPointerCapture`, wykrywanie wyjścia w `onPointerMove`, `touch-none`, `onContextMenu`, `aria-disabled` i `tabIndex={-1}` zostają.

**Contract**: `useStepRepeat(field, value, onStep)` zwraca `{ pointerDown, pointerUp, pointerAbort, blur, click }`; komponent przekazuje `overButton` (współrzędne `pointerup` w prostokącie przycisku) i `event.detail > 0`; na granicy `click` nic nie robi (`canStep`); efekt sprzątający hooka woła `blur()`. Propsy `ConfigStepper` bez zmian.

#### 4. Szkielet skryptu bramki

**File**: `context/changes/ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs` (nowy; wzór: skrypt z `ux-fixes-round-2`; dopisać ten plik do wyjątku lintu w `eslint.config.js` obok istniejących)

**Intent**: Pierwsze asercje Playwright na fixture „default”: jeden klik myszą i jedno dotknięcie strzałki zmieniają wartość o dokładnie 1, także gdy `click` jest sztucznie opóźniony o >100 ms po `pointerup`; przytrzymanie ok. 1 s powtarza, a puszczenie nie dodaje kroku; tapnięcie potwierdza `event.detail > 0` na `click`. Na początku fazy 1 zweryfikować emulację setupu „fine primary + touch” (wynik niżej).

**Wynik weryfikacji emulacji (Chromium, Playwright, 2026-10-11)**: kontekst `hasTouch` (także z `isMobile`) daje `pointer: coarse`, `any-pointer: coarse`, `hover: none` — NIE daje primary fine, więc nie nadaje się na laptop dotykowy. Plan B (zweryfikowany): zwykły kontekst bez `hasTouch` (`pointer: fine`, `any-pointer: fine`, `hover: hover`) i tapnięcia przez CDP `Input.dispatchTouchEvent` (`touchStart`/`touchEnd`) — dają `pointerType: touch`, `click` z `detail` 1; `any-pointer` pozostaje `fine`, ale układ zależy wyłącznie od głównego wskaźnika, więc to wystarcza. Asercje `matchMedia` (`pointer` i `any-pointer`) są twarde w każdym setupie: fine = zwykły kontekst, coarse = `hasTouch` + `isMobile`, fine + touch = zwykły kontekst + CDP dla tapnięć.

### Success Criteria:

#### Automated Verification:

- Testy kontrolera i repeatera (w tym click po >100 ms = 1 krok) przechodzą: `npm test`
- Lint, typy i build przechodzą: `npm run lint`, `npx astro check`, `npm run build`
- Skrypt bramki (część „1 klik = 1 krok”, mysz i dotyk, z opóźnionym `click`) kończy się kodem 0: `PLAYWRIGHT_PATH=<ścieżka> node context/changes/ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs`

#### Manual Verification:

- Jeden klik/tap zmienia wartość o 1, przytrzymanie powtarza — script, not human (asercje skryptu); użytkownik potwierdza na komputerze i telefonie w teście ręcznym

**Implementation Note**: Po fazie i zielonych kontrolach zatrzymaj się na potwierdzenie koordynatora (`[FAZA-1-OK]`).

---

## Phase 2: Strzałki w polu i układ wg głównego wskaźnika

### Overview

Strzałki wewnątrz ramki pola (InputGroup), układ wybierany przez `pointer-coarse:` (domyślnie fine).

### Changes Required:

#### 1. Prymityw InputGroup

**File**: `src/components/ui/input-group.tsx` (nowy, z `npx shadcn@latest add input-group`), `eslint.config.js` (lista zakresu timer-ui, linia ok. 122), `scripts/eslint-rules/timer-ui-contract.test.mjs` (pin)

**Intent**: Użyć oficjalnego prymitywu (ramka, focus ring całości, stan `aria-invalid` na ramce) i objąć go kontraktem timer-ui jak pozostałe prymitywy: dodać `input-group.tsx` do listy lintu i do pinów testu kontraktu, po generacji zamienić wartości arbitralne (`ring-[3px]`, `rounded-[calc(...)]`, `[&>...]` itp.) i kolory na skalę/tokeny. Ring i błąd dopasować do `Input`: `ring-2 ring-ring/50`, `border-destructive`, `ring-destructive/20`, `dark:ring-destructive/40` (kontrast „validation red” z AGENTS.md). Usunąć niepotrzebny `textarea.tsx` i jego użycie z `input-group.tsx` (martwy plik; używamy tylko `InputGroupInput`), o ile CLI go doda.

**Contract**: Używane: `InputGroup`, `InputGroupInput`, `InputGroupAddon` (`align="inline-end"`). Wysokość ramki `h-11` przez `className` w miejscu użycia. Addon dostaje `p-0 gap-0` i wyzerowany ujemny margines przy `button`; sprawdzić, że `onClick` addonu (fokus pola) nie zabiera focusu przyciskom strzałek (jest pomijany dla `closest("button")`, więc OK — potwierdzić w skrypcie).

#### 2. Wiersz pola

**File**: `src/components/timer/DrillConfigForm.tsx` (`ConfigField`)

**Intent**: `Input` zastąpić `InputGroupInput` wewnątrz `InputGroup` (`h-11`), a `ConfigStepper` renderować jako `InputGroupAddon` wewnątrz ramki; ikona głośnika (`action`) i pusty `size-11` zostają poza ramką po prawej. Zachować `id`, `name`, `inputMode`, `aria-*`, `onKeyDown`, `onChange` i ogłoszenie wartości.

**Contract**: `aria-invalid` na polu wyzwala czerwoną ramkę i ring błędu grupy (mechanizm `InputGroup`); brak ringu na samym polu.

#### 3. Układ steppera

**File**: `src/components/timer/ConfigStepper.tsx`

**Intent**: Wewnątrz ramki: domyślnie (główny wskaźnik fine, także laptop dotykowy) kolumna ▲ nad ▼, każdy przycisk 22 px wysokości (`h-5.5`), razem 44 px, bez własnej ramki, rozdzielone cienką linią `border-input`, z separatorem od pola; `pointer-coarse:` przełącza na wiersz ▼ ▲, każdy `size-11` (44 px), z separatorami `border-input` między polem, ▼ i ▲. Zachować `aria-label`, `aria-controls`, `aria-disabled` + style hover wyłączonych, `tabIndex={-1}`, `touch-none`. Wszystkie `any-pointer-coarse:` zamienić na `pointer-coarse:`.

**Contract**: Przy 390 px i `pointer-coarse` pole + 88 px przycisków + separatory + 44 px głośnika + odstęp mieszczą się bez overflow (najdłuższe wartości `10:00`, `100`, pole błędu); asercja `scrollWidth <= clientWidth` w skrypcie.

### Success Criteria:

#### Automated Verification:

- Lint (w tym kontrakt timer-ui), `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build` przechodzą
- Test kontraktu timer-ui pinuje `input-group.tsx` w zakresie lintu: `node --test scripts/eslint-rules/*.test.mjs`
- Skrypt bramki: kolumna przy `fine` i przy „fine + touch” (zwykły kontekst + CDP, patrz faza 1), wiersz 44 px przy `coarse` (390 px, `hasTouch` + `isMobile`), brak overflow poziomego, wiersze 44 px, strzałki wewnątrz ramki (`getBoundingClientRect`), focus ring na grupie, kolor ramki błędu (token destructive) w jasnym i ciemnym motywie

#### Manual Verification:

- Wygląd jak natywny spinner (wspólna ramka, jedna kontrolka), jasny i ciemny, 1280 i 390 px — script, not human (zrzuty przejrzane); użytkownik potwierdza na laptopie dotykowym i telefonie

**Implementation Note**: Po fazie i zielonych kontrolach zatrzymaj się (`[FAZA-2-OK]`).

---

## Phase 3: Tooltip na komputerze i okienko Current

### Overview

Szerszy tooltip od `md` oraz Current bez ramki i tła.

### Changes Required:

#### 1. Tooltip

**File**: `src/components/ui/tooltip.tsx`

**Intent**: Na szerokich ekranach zwiększyć maksymalną szerokość do `md:max-w-md`; poniżej `md` zostaje `max-w-xs`. Breakpoint zamiast `pointer-fine:`: ograniczeniem jest dostępna szerokość, nie rodzaj wskaźnika; telefon w pionie (390 px) pozostaje bez zmian.

**Contract**: `w-fit max-w-xs md:max-w-md text-pretty` (`text-pretty` ogranicza krótkie ostatnie linie; 7 px jest celem, nie gwarancją, bo `md` mierzy okno, a Radix może przyciąć pudełko przy kotwicy na prawej krawędzi); test na najdłuższym `SIGNAL_MEANINGS` z notą; sprawdzić Exercise, Rest i Random start, każdy w stanie dostępnym i wyłączonym z notą: pudełko szerokością tekstu, brak luki po prawej (asercja skryptu: różnica między szerokością pudełka a najdłuższą linią ≤ 7 px, jak w S-21), przy 1280 i 390 px.

#### 2. Current bez ramki i tła

**File**: `src/components/timer/PhaseSections.tsx`

**Intent**: `PhaseBox` dostaje wariant bez ramki i tła dla Current (te same paddingi, etykieta i linia „Nazwa · czas” jak dziś, Standby bez czasu), z przezroczystą ramką o tej samej grubości, aby wysokość i pozycja tekstu były identyczne jak w Next; Next bez zmian. `role="group"` i `aria-labelledby` zostają na obu; stałe wysokości nie zmieniają się, więc pasek przycisków nie skacze.

**Contract**: wariant przez prop (np. `framed`) z `cn()`: Current = `border border-transparent px-4 py-3` (te same `px-4 py-3` co Next), Next bez zmian. `border-transparent` przechodzi kontrakt (reguły w `timer-ui-contract.mjs:3-6` blokują tylko klasy palety i wartości arbitralne), więc bez planu zapasowego. Asercja skryptu: `getBoundingClientRect().height` Current = Next oraz identyczne pozycje czasu i paska przycisków (także Standby).

### Success Criteria:

#### Automated Verification:

- Testy modelu (`drill-phase-sections.test.ts`, w tym różnicowe Standby) przechodzą bez zmian: `npm test`
- Lint, typy i build przechodzą
- Skrypty (tooltip i run view): brak luki w tooltipie; Current bez ramki i tła (obliczone style), wysokość Current = wysokość Next, pozycje czasu i paska identyczne między fazami (także Standby)

#### Manual Verification:

- Tooltip czytelny w 1–2 liniach na komputerze, bez zmian na telefonie — script, not human (zrzuty przejrzane)
- Current bez ramki i tła, Next z ramką, napisy jak wcześniej — script, not human (zrzuty przejrzane)

**Implementation Note**: Po fazie i zielonych kontrolach zatrzymaj się (`[FAZA-3-OK]`).

---

## Phase 4: Fixtures, bramka wizualna i dokumentacja

### Overview

Dopasować fixtures, uruchomić pełną bramkę i zaktualizować dokumentację.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/ConfigStepperFixtures.tsx`, `src/components/timer/PhaseSectionsFixtures.tsx`, `src/components/timer/SignalPreviewFixtures.tsx` (jeśli opisy lub stany się zmieniły)

**Intent**: Opisy fixture'ów („22 px column / 44 px buttons when any pointer is coarse”) zmienić na układ wg głównego wskaźnika i strzałki w ramce; fixtures Current (Standby, najdłuższe wartości) potwierdzają brak ramki; tooltipy wszystkich trzech sygnałów w obu stanach dostępne w `SignalPreviewFixtures`.

**Contract**: Brak nowych komponentów; stany: default, hover, focus-visible (pole), disabled, error, empty (N/A uzasadnione: pole nigdy nie jest puste w fixture, pusty tekst obejmuje fixture error), loading.

#### 2. Pełna bramka wizualna

**File**: `context/changes/ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs`, `context/changes/ux-fixes-round-3/screenshots/*.png`

**Intent**: Rozszerzyć skrypt z fazy 1: 7 stanów steppera w jasnym i ciemnym motywie przy 1280 i 390 px dla setupów `fine`, `coarse` (isMobile) i „fine primary + touch” (zwykły kontekst + tapnięcia CDP, bo `hasTouch` daje primary coarse; oczekiwany układ pionowy), tooltipy (3 sygnały × 2 stany), Current/Next, brak overflow; zrzuty zapisane i przejrzane. Powtórzyć jako regresję skrypty S-18 (`run-view-visual-gate.mjs`), S-19 (`signal-preview-visual-gate.mjs`) i `ux-fixes-round-2-visual-gate.mjs`; asercje nieaktualne po tej zmianie (np. `any-pointer-coarse`, „identyczne pudełka”) zaktualizować i odnotować w raporcie.

#### 3. Dokumentacja

**File**: `AGENTS.md`, `context/foundation/prd.md` (FR-018, FR-020), `context/foundation/ux-fixes-plan.md`, `context/foundation/roadmap.md`, `README.md` (tylko jeśli opisuje stepper)

**Intent**: AGENTS.md: Run view layout — Current bez ramki i tła (nie „two identical boxes”), Next z ramką i tłem; Signal preview — tooltip `md:max-w-md`; Config stepper — strzałki w `InputGroup`, układ wg `pointer-coarse:`/domyślnie fine (nie `any-pointer`), głośnik poza polem, zaktualizowane uzasadnienie WCAG 2.5.8 („Equivalent”: pole tekstowe i ↑/↓; 22 px dotyczy głównego wskaźnika precyzyjnego, także laptopa dotykowego), logika `drill-step-press.ts` (krok z `click`, `pointerdown` tylko uzbraja powtarzanie), ścieżki zrzutów i skryptu `ux-fixes-round-3`. PRD i `ux-fixes-plan.md`: FR-018 (Current bez ramki), FR-020 (w polu, wg głównego wskaźnika). Roadmapa: status S-22 zgodnie z postępem.

### Success Criteria:

#### Automated Verification:

- Pełna bramka: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`
- Skrypt Playwright S-22 (7 stanów × motywy × 1280/390 × trzy setupy, 1 klik = 1 krok, tooltipy, Current) kończy się kodem 0; regresje S-18/S-19 przechodzą

#### Manual Verification:

- Zrzuty przejrzane (default, hover, focus-visible, disabled, error, empty N/A, loading; light/dark; 1280/390) — script, not human
- Dokumentacja zgodna z implementacją — przegląd `/10x-impl-review`

**Implementation Note**: Po fazie zatrzymaj się (`[FAZA-4-OK]`), następnie review implementacji i PR.

---

## Testing Strategy

### Unit Tests:

- `drill-step-press.test.ts`: jeden klik = 1 krok; click po >100 ms od `pointerUp` = 1 krok; przytrzymanie powtarza i po puszczeniu brak dodatkowego kroku; abort/blur kasują flagę; `lostpointercapture` po `pointerUp` nie kasuje flagi; granica; klawiatura/AT.
- `drill-step-repeat.test.ts`: `arm` — brak kroku przed pauzą, krok po `REPEAT_DELAY_MS`, interwał, `onFire`, `stop`/`dispose`.
- Model run view (`drill-phase-sections.test.ts`) bez zmian — Standby nie ujawnia losowego oczekiwania.

### Integration Tests:

- Skrypt Playwright na `/dev/timer-ui` (nie w CI): klik myszą, dotknięcie, opóźniony `click`, przytrzymanie; układy fine / coarse / fine + touch; tooltipy; Current.

### Manual Testing Steps:

1. Komputer: pojedynczy klik w ▲/▼ zmienia o 1; przytrzymanie powtarza; strzałki w ramce pola.
2. Laptop z ekranem dotykowym: układ pionowy, pojedyncze dotknięcie = 1 krok.
3. Telefon: ▼ ▲ obok siebie po 44 px w ramce, głośnik po prawej, brak overflow przy `10:00`/`100`.
4. Tooltip na komputerze w 1–2 liniach; Current bez ramki.

## Performance Considerations

Brak (jeden timer pauzy na przytrzymanie, jak dotąd).

## Migration Notes

Brak zmian danych. Usunięcie `CLICK_AFTER_POINTER_MS` i `handledByPointer` nie zmienia propsów `ConfigStepper`.

## References

- Poprzednia runda: `context/changes/ux-fixes-round-2/plan.md`, `reviews/`, skrypt `screenshots/ux-fixes-round-2-visual-gate.mjs`
- Plan i roadmapa: `context/foundation/ux-fixes-plan.md`, `context/foundation/roadmap.md` (S-22), PRD FR-018–FR-020
- Kod: `src/components/timer/ConfigStepper.tsx`, `src/components/hooks/useStepRepeat.ts`, `src/lib/drill-step-repeat.ts`, `src/components/timer/DrillConfigForm.tsx`, `src/components/ui/tooltip.tsx`, `src/components/timer/PhaseSections.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Krok bez podwójnego kliku

#### Automated

- [ ] 1.1 Testy kontrolera gestu i repeatera (w tym click po >100 ms = 1 krok) przechodzą
- [ ] 1.2 Lint, typy i build przechodzą
- [ ] 1.3 Skrypt bramki: 1 klik myszą i 1 tap = 1 krok, także z opóźnionym click, kończy się kodem 0

#### Manual

- [ ] 1.4 Jeden klik/tap zmienia wartość o 1, przytrzymanie powtarza — script, not human

### Phase 2: Strzałki w polu i układ wg głównego wskaźnika

#### Automated

- [ ] 2.1 Lint, kontrakt, testy, typy i build przechodzą
- [ ] 2.2 Skrypt bramki: kolumna przy fine (także fine + touch), wiersz 44 px przy coarse, strzałki w ramce, brak overflow 390 px, wiersze 44 px

#### Manual

- [ ] 2.3 Wygląd jak natywny spinner w jasnym i ciemnym motywie przy 1280 i 390 px — script, not human

### Phase 3: Tooltip na komputerze i okienko Current

#### Automated

- [ ] 3.1 Testy modelu run view przechodzą bez zmian, lint, typy i build przechodzą
- [ ] 3.2 Skrypt: tooltip bez luki (3 sygnały × 2 stany, 1280/390), Current bez ramki i tła o wysokości Next, pozycje bez skoków

#### Manual

- [ ] 3.3 Tooltip i Current wyglądają zgodnie z decyzją — script, not human

### Phase 4: Fixtures, bramka wizualna i dokumentacja

#### Automated

- [ ] 4.1 Pełna bramka (sync, lint, test, kontrakt, check, build) przechodzi
- [ ] 4.2 Skrypt S-22 (7 stanów, motywy, szerokości, trzy setupy) i regresje S-18/S-19 kończą się kodem 0

#### Manual

- [ ] 4.3 Zrzuty przejrzane, dokumentacja zgodna z implementacją — script, not human
