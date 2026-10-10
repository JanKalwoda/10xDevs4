# UX fixes round 2 Implementation Plan

## Overview

S-21 (FR-018 zmieniony, nowe FR-020; dotyka FR-004/FR-019): trzy poprawki po testach ręcznych S-16–S-19, okienko Current w widoku biegu wyglądające jak Next oraz strzałki zmiany wartości (stepper ▼/▲) przy polach Preparation, Exercise, Rest i Repetitions w `DrillConfigForm` (formularz na `/`, `/create`, `/{id}/edit`). Brak zmian w API, bazie i migracjach.

## Current State Analysis

- A3.7: `src/components/timer/DrillCreateApp.tsx:42-44` — link „Back to the timer" → `/`; ux-fixes-plan wymaga „Back to timers" → `/timers`. Inne wystąpienia „Back to the timer" (`NotFoundView.astro:20`, `auth/callback.astro:47`, `auth/confirm-email.astro:28`) są poprawne (prowadzą do timera na `/`). Smoke (`scripts/smoke.mjs:339-360`, `verifyCreatePage`) nie sprawdza tego linku; żaden test ani fixture go nie oczekuje (grep po `src`, `scripts`).
- A5.3: `src/components/ui/tooltip.tsx:24` — `w-fit max-w-xs … text-balance`. `text-balance` zawęża linie tekstu wewnątrz pudełka o szerokości `max-w-xs`, więc prawa połowa pudełka zostaje pusta. Jedyny użytkownik tooltipu: `SignalPreviewControl.tsx`.
- A5.9: `SignalPreviewControl.tsx:78` — wyłączona ikona ma `aria-disabled:hover:bg-background dark:aria-disabled:hover:bg-input/30`, ale wariant `outline` (`button.tsx:16`) dokłada `hover:text-accent-foreground`, więc ikona zmienia kolor przy hoverze.
- A4.2: `src/components/timer/PhaseSections.tsx:22-30` — Current to `h2` z nazwą i osobna linia z czasem (`min-h-6`, bo Standby nie ma czasu), bez obramowania; Next to `role="group"` w pudełku `bg-muted border-border rounded-lg border px-4 py-3` z etykietą „Next" i `nextPhaseBody()`. Model `src/lib/drill-phase-sections.ts:9-13,60-64`: `current = {name, time|null}`, Standby ma `time: null` (tajność długości: czas pochodzi wyłącznie z wartości fazy, nigdy z losowego oczekiwania). Testy: `drill-phase-sections.test.ts` (w tym różnicowe 1 s vs 5 s).
- Stepper: `DrillConfigForm.tsx:36-66` — `ConfigField` to `Label` + wiersz `flex items-center gap-2` (`Input` `flex-1` + `action`) + podpowiedź + błąd + `feedback`; `action` ma dziś tylko ikona głośnika (`size-11` = 44 px, więc wiersz Exercise/Rest/Standby ma 44 px, a Preparation/Repetitions 36 px — `Input` `h-9`). Wartości są tekstami (`DrillConfigInput`), walidacja w `drill-timer.ts` (`parseDrillTime`, `MAX_DRILL_SECONDS = 600`, `MAX_REPETITIONS = 100`, `TIME_PATTERN`, `REPETITIONS_PATTERN`); `formatPhaseTime` (`drill-phase-sections.ts:27`) już daje `m:ss`. `handleChange` wywołuje `onValuesChange` i czyści błąd pola.
- Tailwind 4.3.3 (`node_modules/tailwindcss`) ma wbudowane warianty `pointer-fine:`/`pointer-coarse:` (od 4.1) — `@custom-variant` w `global.css` nie jest potrzebny (w `global.css:4` jest tylko `dark`). Skala odstępów jest dynamiczna, więc `h-5.5` (22 px) nie jest wartością arbitralną; reguła `timer-ui-contract.mjs` łapie wyłącznie `klasa-[...]`.
- Wzorce do powtórzenia: czysty moduł z wstrzykiwanymi timerami + test (`signal-preview-hint.ts`/`.test.ts`, hook `useSignalHint.ts`), `aria-disabled` zamiast `disabled`, fixtures production-backed (`SignalPreviewFixtures.tsx`) i skrypt Playwright (`context/changes/signal-preview-icon/screenshots/signal-preview-visual-gate.mjs`, wyjątek lintu w `eslint.config.js:84`).

## Desired End State

- `/create`: „Back to timers" → `/timers`.
- Tooltip bez pustej połowy w każdej szerokości (pudełko dopasowuje się do tekstu aż do `max-w-xs`).
- Wyłączona ikona odsłuchu przy hoverze zachowuje kolor ikony, tło i `cursor-not-allowed`.
- Widok biegu: Current i Next to dwa identyczne pudełka (`role="group"`): na górze większa etykieta („Current" / „Next"), pod nią jedna linia „Nazwa · czas" (w Standby sama nazwa, bez czasu — także w Current). Powtórzenie „Repetition X of N" nadal pod czasem, `role="timer"` tylko na głównej liczbie, wszystkie linie mają stałą wysokość, więc czas i pasek przycisków się nie przesuwają.
- Każde z pól Preparation, Exercise, Rest (krok 1 s) i Repetitions (krok 1) ma dwa przyciski ▼/▲ (`ChevronDown`/`ChevronUp`, outline `Button`, tokeny, `aria-label`, `aria-controls`). Dotyk (każde urządzenie wskazujące dotykowe, `any-pointer: coarse`): obok siebie `▼ ▲` po prawej stronie pola, przed ikoną głośnika, każdy 44 px, bez overflow przy 390 px. Komputer (domyślnie, bez dotyku): `▲` nad `▼` w jednej kolumnie 2 × 22 px, bez zwiększania wysokości wierszy z ikoną głośnika (44 px); wszystkie cztery wiersze mają na komputerze 44 px (Preparation i Repetitions rosną z 36 px — decyzja użytkownika). Przytrzymanie powtarza zmianę (pauza, potem co ok. 0,1 s); puszczenie, wyjście wskaźnika, utrata przechwytu wskaźnika, utrata fokusu i odmontowanie zatrzymują. Strzałki są dla myszy, dotyku i technologii asystujących (`tabIndex={-1}`); klawiatura używa ↑/↓ w polu. Nowa wartość jest ogłaszana przez `sr-only` `role="status"`, a akapit nad formularzem wspomina o ↑/↓ i Shift. W polu ↑/↓ zmieniają o 1, z Shift o 10. Na granicy zakresu odpowiednia strzałka jest `aria-disabled`; pusta/błędna wartość startuje od minimum pola; wynik zawsze `m:ss` (czasy) lub liczba całkowita przez `onValuesChange`.
- Weryfikacja: `npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`, bramka wizualna `/dev/timer-ui` (skrypt Playwright, 7 stanów × jasny/ciemny × 1280/390; „script, not human"). Smoke lokalny nie działa (brak Mailpit) — potwierdza go CI.

### Key Discoveries:

- Warianty wbudowane w Tailwind 4.3.3 (`any-pointer-coarse:`, `any-pointer-fine:`, `pointer-coarse:`, `pointer-fine:`; potwierdzone w `node_modules/tailwindcss/dist/lib.js`) wystarczą do dwóch układów bez `@custom-variant` i bez wartości arbitralnych. Układ duży wybieramy przy `any-pointer-coarse:` (laptop z dotykiem i myszą też dostaje cele 44 px), kompaktowy jest domyślny. Playwright `hasTouch` + `isMobile` ustawia też `any-pointer: coarse`; scenariusz „mysz + dotyk” emulujemy osobnym kontekstem (tylko `hasTouch`).
- Wysokość kolumny 2 × `h-5.5` = 44 px = wysokość `size-11` ikony głośnika, więc wiersze Exercise/Rest nie rosną (`SignalPreviewControl.tsx:77`). Wiersze Preparation/Repetitions rosną z 36 do 44 px (`Input` `h-9`), co jest nieuniknione także na dotyku (cel 44 px).
- WCAG 2.5.8 (24 × 24 px) nie jest spełnione przez cel 22 px wysokości; skorzystamy z wyjątku „Equivalent": ta sama funkcja jest dostępna przez cel spełniający kryterium — pole tekstowe (wpisanie wartości) i klawisze ↑/↓ w polu. Kompromis opisany w AGENTS.md; na dotyku cele mają 44 px.
- Kliknięcie po `pointerdown` podwoiłoby krok, a `click.detail === 0` jest zawodne dla technologii asystujących; mysz/dotyk stepują na `pointerdown` i ustawiają flagę `handledByPointer` w refie, a `click` stepuje tylko gdy flaga nie jest ustawiona (klawiatura, VoiceOver, TalkBack, Voice Control). `touch-none` na przyciskach wyłącza gest przewijania z celu (brak kroków od scrolla), `setPointerCapture` + `onLostPointerCapture` zatrzymują powtarzanie.
- Tryb `aria-disabled` (jak w odsłuchu) zamiast `disabled` zachowuje fokus, gdy przycisk osiąga granicę podczas przytrzymania. Strzałki mają `tabIndex={-1}`: klawiatura ma ↑/↓ w polu (to też „Equivalent” dla 2.5.8), więc nie ma 8 dodatkowych przystanków ani niezgodności kolejności fokusu z układem wizualnym.
- `react-hooks` v7 w lincie zabrania zapisu `ref.current` w trakcie renderu; „najnowsza wartość" dla powtarzacza trafia do refa w efekcie (`useEffect`/`useLayoutEffect`).
- Tajność Standby: model nie ma żadnych danych o losowym oczekiwaniu; w Current Standby nadal `time: null`, a testy różnicowe 1 s vs 5 s przechodzą bez zmian logiki (zmienia się tylko renderowanie).

## What We're NOT Doing

- Zmian w API, bazie, walidacji (`parseDrillConfig`, zakresy 0:00/0:01–10:00, 1–100), kontrolerze odsłuchu i sygnałach.
- Przyspieszania powtarzania przy długim przytrzymaniu (stała częstotliwość ok. 0,1 s) oraz kroku większego niż 1 dla przycisków (Shift działa tylko dla klawiszy ↑/↓).
- Zmiany pola na `type="number"` lub `role="spinbutton"` (zostaje tekstowe `m:ss`).
- Stepperów w widoku biegu, zmiany „Back to the timer" na stronach 404/auth (prowadzą do timera).
- Nowych tokenów kolorów; używamy istniejących.
- Poprawek znanego overflow 414 px w `TimerUiPreview`.
- Archiwizacji tej zmiany oraz S-16–S-19 (po całej kolejce, decyzja użytkownika); checklisty testów ręcznych poza opisem PR (B4.2, B5.2, B5.6 — zgodne z planem, weryfikacja B5 w kodzie zaakceptowana).

## Implementation Approach

Pięć małych faz, każda zielona osobno i z własnym commitem: (1) trzy poprawki + szkielet skryptu bramki S-21, (2) Current jak Next (model, komponent, FR-018), (3) czysta logika steppera + testy + hook (bez UI), (4) stepper w formularzu (oba układy, klawiatura), (5) fixtures, pełna bramka wizualna i dokumentacja. Skrypt Playwright `ux-fixes-round-2-visual-gate.mjs` powstaje w fazie 1 i rośnie z każdą fazą; w fazie 5 dostaje pełny przebieg 7 stanów. Stary skrypt S-19 i S-18 uruchamiamy jako regresję po fazie 4 (formularz się zmienia) i odświeżamy tylko te zrzuty, których układ faktycznie się zmienił.

## Phase 1: Poprawki A3.7, A5.3, A5.9 i szkielet skryptu bramki

### Overview

Trzy punktowe poprawki oraz plik skryptu wizualnego z pierwszymi asercjami.

### Changes Required:

#### 1. Link powrotu na `/create`

**File**: `src/components/timer/DrillCreateApp.tsx`, `scripts/smoke.mjs`

**Intent**: Link „Back to the timer" → `/` zamienić na „Back to timers" → `/timers` (jak w `DrillEditApp`/`SavedDrillDetails`) i pilnować go w smoke, żeby regresja nie wróciła.

**Contract**: `<a href="/timers" …>Back to timers</a>` z tymi samymi klasami; `verifyCreatePage` w smoke dodatkowo sprawdza w HTML `/create` link `href="/timers"` z tekstem „Back to timers" (oraz brak „Back to the timer"). Potwierdza go CI; lokalnie nie da się uruchomić.

#### 2. Tooltip bez pustej połowy

**File**: `src/components/ui/tooltip.tsx`

**Intent**: Usunąć `text-balance` z `TooltipContent`; `w-fit max-w-xs` zostają, więc pudełko dopasowuje się do najdłuższej linii.

**Contract**: Brak innych zmian klas; sprawdzić wszystkie tooltipy (jedyny użytkownik to `SignalPreviewControl`: Exercise, Rest, Standby — także długi opis Standby i powód wyłączenia przy 390 px) — szerokość pudełka równa szerokości najdłuższej linii tekstu (± padding).

#### 3. Hover wyłączonej ikony bez zmiany koloru

**File**: `src/components/timer/SignalPreviewControl.tsx`

**Intent**: Dopisać do klas przycisku blokadę koloru ikony przy hoverze dla `aria-disabled`, obok istniejącej blokady tła; kursor `not-allowed` i tło zostają.

**Contract**: `aria-disabled:hover:text-foreground` (kolor bazowy outline to dziedziczony `foreground`); wygrywa specyficznością nad `hover:text-accent-foreground`, tak jak istniejące `aria-disabled:hover:bg-*`. Dokumentacja (AGENTS.md, opis Signal preview) nie opisuje hovera wyłączonej ikony — brak zmian; sprawdzić grep po „hover" w opisie S-19.

#### 4. Szkielet skryptu bramki S-21

**File**: `context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs`, `eslint.config.js`

**Intent**: Playwright wzorowany na `signal-preview-visual-gate.mjs` (`PLAYWRIGHT_PATH`, `BASE_URL`, `check()`, zapis `ux-fixes-round-2-checks.json`). W tej fazie: asercje A5.3 (szerokość `[data-slot="tooltip-content"]` ≈ szerokość najdłuższej linii tekstu, bez pustej prawej połowy; sprawdzenie przez `Range.getBoundingClientRect()` tekstu vs pudełko) i A5.9 (obliczony `color` ikony wyłączonej Rest przy hoverze = bez hovera; `cursor: not-allowed`; tło bez zmiany).

**Contract**: Wyjątek lintu dopisany do `globalIgnores` (`eslint.config.js:84`) tylko dla tego jednego pliku. Skrypt nie jest częścią CI.

### Success Criteria:

#### Automated Verification:

- Link i brak starego tekstu w `DrillCreateApp.tsx`: `grep -n "Back to timers" src/components/timer/DrillCreateApp.tsx` zwraca trafienie, a „Back to the timer" nie występuje w tym pliku
- Lint, testy, kontrakt, typy i build: `npx astro sync && npm run lint && npm test && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`
- Skrypt wizualny (A5.3, A5.9) kończy się kodem 0: `npm run dev` + `PLAYWRIGHT_PATH=<path> node context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs`

#### Manual Verification:

- Na `/create` link „Back to timers" prowadzi do `/timers` (script, not human: asercja href w smoke i na fixture; użytkownik potwierdza przy testach ręcznych kolejki)
- Tooltip Exercise/Rest/Standby nie ma pustej prawej połowy przy 1280 i 390 px (script, not human: zrzuty przejrzane)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-1-OK]`.

---

## Phase 2: Okienko Current jak Next

### Overview

Zmiana FR-018: Current w widoku biegu ma pudełko, etykietę i linię „Nazwa · czas" jak Next; Standby bez czasu.

### Changes Required:

#### 1. Model sekcji

**File**: `src/lib/drill-phase-sections.ts`, `src/lib/drill-phase-sections.test.ts`

**Intent**: Dodać eksportowany `currentPhaseBody(current)` (lustro `nextPhaseBody`): „Nazwa · czas" albo sama nazwa gdy `time === null`; struktura `PhaseSections` bez zmian.

**Contract**: `currentPhaseBody({name:"Exercise",time:"0:04"}) === "Exercise · 0:04"`, `currentPhaseBody({name:"Standby",time:null}) === "Standby"`. Testy: nowe oczekiwania dla każdej pary current → next oraz zachowanie testów różnicowych Standby 1 s vs 5 s (identyczne sekcje i identyczny `currentPhaseBody`; w treści Current ani Next nie pojawia się czas oczekiwania).

#### 2. Komponent

**File**: `src/components/timer/PhaseSections.tsx`

**Intent**: Wspólne pudełko `bg-muted border-border rounded-lg border px-4 py-3` z `role="group"`, etykietą `text-xl font-semibold` i linią treści `text-lg font-medium tabular-nums` używane przez Current i Next (`aria-label` „Current phase" / „Next phase"); usunąć osobne `h2` i linię czasu Current. Zachować czas, `role="timer"` tylko na głównej liczbie, „Repetition X of N" pod czasem.

**Contract**: Pudełko Current ma `aria-labelledby` wskazujące widoczną etykietę „Current” (nazwa grupy bez duplikatu z `aria-label="Current drill phase"` sekcji); Next analogicznie („Next”). Brak `h2` jest świadomą decyzją (sekcja ma etykietę, a pudełka są grupami). Obie linie treści mają jedną linię tekstu (bez zawijania przy 390 px dla najdłuższego „Preparation · 10:00"); stałe wysokości: linia Current nie znika w Standby (nazwa zostaje), więc brak skoków pasku przycisków. Sprawdzić `aria-live`/headings: `h2` zniknie, więc strukturę nagłówków sprawdzić w `DrillApp`/`DrillTimerView` (sekcja ma `aria-label`).

#### 3. Dokumentacja wymagania i fixtures

**File**: `context/foundation/prd.md` (FR-018), `context/foundation/ux-fixes-plan.md` (tabela decyzji „Widok biegu", S-18), `AGENTS.md` (opis układu widoku biegu), `src/components/timer/PhaseSectionsFixtures.tsx`

**Intent**: Zaktualizować opis: „okienko Current: etykieta „Current", pod nią „Nazwa · czas" (Standby: sama nazwa); okienko Next analogicznie". Fixtures: opisy scenariuszy bez „name on first line, time on its own"; zakres scenariuszy bez zmian (w tym Standby, both warnings, longest values).

**Contract**: FR-018 zmienia tylko opis Current; pozostałe zdania bez zmian. EOL plików zachowany.

#### 4. Aktualizacja skryptu S-18

**File**: `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs`

**Intent**: Faza 2 usuwa `h2` z Current, a skrypt S-18 (`:58,70`) szuka `h2` i kolejności `rep → h2 → group`; zaktualizować go tak, by Current był grupą (`[role="group"]` z etykietą „Current”), kolejność to `time → repetition → Current → Next`, a treść Current jest jedną linią jak w Next.

**Contract**: Skrypt kończy się kodem 0 po fazie 2 (zrzuty S-18 odświeżone tylko tam, gdzie Current się zmienił); jest to skrypt uruchamiany w regresji 5.3.

#### 5. Asercje w skrypcie bramki S-21

**File**: `context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs`

**Intent**: Dla każdego `sections-*`: pudełko Current ma te same style (tło, obramowanie, promień) co Next; etykieta większa niż treść; treść w jednej linii; Standby: tekst Current to dokładnie „Standby"; pozycja `[role="timer"]` i paska przycisków identyczna we wszystkich scenariuszach tej samej szerokości; brak overflow przy 390 px.

**Contract**: Zrzuty 1280/390 × jasny/ciemny zapisane w `screenshots/`.

### Success Criteria:

#### Automated Verification:

- Testy modelu (w tym różnicowe Standby) przechodzą: `npm test`
- Bramka: `npx astro sync && npm run lint && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`
- Skrypt wizualny (Current jak Next, Standby bez czasu, stałe pozycje) kończy się kodem 0

#### Manual Verification:

- Okienko Current wygląda jak Next we wszystkich 14 scenariuszach, w obu motywach i szerokościach (script, not human: zrzuty przejrzane)
- Czas i pasek przycisków nie skaczą między fazami (script, not human: pozycje porównane)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-2-OK]`.

---

## Phase 3: Czysta logika steppera i powtarzacza

### Overview

Moduły bez UI w `src/lib` z testami `npm test` i cienki hook; jeszcze bez zmian w formularzu.

### Changes Required:

#### 1. Krok wartości pola

**File**: `src/lib/drill-stepper.ts`, `src/lib/drill-stepper.test.ts`

**Intent**: Czysty moduł liczący następną wartość tekstu pola i dostępność strzałek, na stałych z `drill-timer.ts` (`MAX_DRILL_SECONDS`, `MAX_REPETITIONS`) i formatowaniu `formatPhaseTime`.

**Contract**: `type StepperField = "preparation" | "exercise" | "rest" | "repetitions"`; `STEPPER_LIMITS` (preparation 0–600, exercise 1–600, rest 0–600, repetitions 1–100, krok 1); `stepFieldValue(field, value, delta): string` — poprawna wartość + `delta` zaciśnięte do zakresu, wynik w formacie `m:ss` (czasy) lub liczba całkowita (powtórzenia); poprawna składniowo wartość poza zakresem (np. „12:00", „250") zaciska się do granicy zakresu przed lub po kroku; pusta lub błędna składniowo wartość (np. „", „abc", „0:5", „0") daje minimum pola dla obu kierunków (pierwsze naciśnięcie sprowadza do poprawnej wartości); `canStep(field, value, direction): boolean` — fałsz tylko gdy wartość jest poprawna i leży na granicy w tym kierunku (przy błędnej wartości obie strzałki włączone). Krok z klawiatury: `delta = ±1` lub `±10` z Shift. Testy: wszystkie cztery pola × granice (Exercise 0:01 ▼ wyłączone, czasy 10:00 ▲ wyłączone, Repetitions 1/100), przejścia 0:59→1:00 i 9:59→10:00, krok 10 zaciśnięty (0:05 − 10 → min, 9:55 + 10 → 10:00), pusta/błędna/poza zakresem wartość, brak zmiany formatu (np. „1:05" zostaje „1:05", „0:01"+1 → „0:02").

#### 2. Powtarzacz przytrzymania

**File**: `src/lib/drill-step-repeat.ts`, `src/lib/drill-step-repeat.test.ts`

**Intent**: Wzorem `signal-preview-hint.ts` wydzielić logikę przytrzymania z wstrzykiwanymi timerami, żeby `npm test` ją sprawdzał bez DOM.

**Contract**: `createStepRepeater({ setTimer, clearTimer, setIntervalTimer?, clearIntervalTimer?, delayMs = 400, intervalMs = 100 })` → `{ start(step: () => boolean): void; stop(): void; dispose(): void }`; `start` wykonuje krok od razu, po `delayMs` powtarza co `intervalMs`; `step` zwracające `false` (granica) zatrzymuje powtarzanie; ponowny `start` zatrzymuje poprzednie; `stop` i `dispose` czyszczą timery (idempotentne). Testy: pierwszy krok natychmiast, brak powtórzeń przed opóźnieniem, powtórzenia co 100 ms, zatrzymanie na granicy, stop/dispose, podwójny start, brak kroków po `dispose`.

#### 3. Hook

**File**: `src/components/hooks/useStepRepeat.ts`

**Intent**: Utworzyć powtarzacz w `useState`, z realnymi `setTimeout`/`setInterval` i `dispose()` w cleanup (odporne na StrictMode), jak `useSignalHint.ts`.

**Contract**: Zwraca `{ start, stop }`; hook trzyma ref `latest` z `{ value, onStep }` aktualizowany w `useLayoutEffect` (reguła `react-hooks` v7 zabrania zapisu w renderze), a `start` przyjmuje krok czytający `latest`, więc powtarzanie nigdy nie używa starej kopii wartości ani callbacka; odmontowanie zatrzymuje powtarzanie. Test w `drill-step-repeat.test.ts`: krok, który zwraca `false` po zewnętrznej zmianie wartości, kończy powtarzanie.

### Success Criteria:

#### Automated Verification:

- Nowe i istniejące testy przechodzą: `npm test`
- Lint, kontrakt, typy i build: `npx astro sync && npm run lint && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`

#### Manual Verification:

- Przegląd diffu: moduły w `src/lib` nie importują Reacta ani DOM, rozszerzenia `.ts` w importach (script, not human: `grep` po importach)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-3-OK]`.

---

## Phase 4: Stepper w formularzu (oba układy, klawiatura)

### Overview

Podłączyć logikę do `ConfigField` i dodać przyciski w dwóch układach wskaźnika.

### Changes Required:

#### 1. Komponent przycisków

**File**: `src/components/timer/ConfigStepper.tsx`

**Intent**: Dwa przyciski (▲ zwiększ, ▼ zmniejsz) ze współdzielonym `Button variant="outline"`, ikony lucide `ChevronUp`/`ChevronDown` (`aria-hidden`), tokeny semantyczne, `aria-controls={inputId}`, `aria-label` („Increase exercise by 1 second", „Decrease repetitions by 1" itd.), `tabIndex={-1}`, `aria-disabled` na granicy (z blokadą hovera jak w odsłuchu: `aria-disabled:hover:*`, `aria-disabled:cursor-not-allowed aria-disabled:opacity-50`), `touch-none select-none` i `onContextMenu` blokujące menu przy długim dotyku (iOS `-webkit-touch-callout`: wystarczy `select-none`).

**Contract**: Props: `field`, `inputId`, `value`, `label`, `onStep(next: string)`. Układ: kontener `flex flex-col any-pointer-coarse:flex-row-reverse`, DOM ▲ potem ▼ (na dotyku wizualnie `▼ ▲`; tabulator nie dotyczy, bo `tabIndex={-1}`). Rozmiary: domyślnie `h-5.5 w-8` (22 px, kolumna dokładnie 44 px: dolny przycisk `border-t-0`, górny `rounded-b-none`, dolny `rounded-t-none`, `shadow-none`, oba `relative focus-visible:z-10` dla widocznego ringu); `any-pointer-coarse:size-11` (44 px) z pełnym obramowaniem, `rounded-md` i `shadow-xs`. Zdarzenia: `onPointerDown` (tylko przycisk główny / dotyk): `setPointerCapture`, flaga `handledByPointer = true` w refie, `useStepRepeat.start`; `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`, `onPointerLeave`, `onBlur` → `stop` i zerowanie flagi; `onClick` stepuje tylko gdy `handledByPointer` nie jest ustawiona (klawiatura, AT, Voice Control), w przeciwnym razie zeruje flagę i nic nie robi. Krok czyta najnowszą wartość przez ref hooka. Na granicy przycisk jest `aria-disabled` i nic nie robi. Komunikat dla czytników: `sr-only` `role="status"` (w `ConfigField`, obecny w DOM przed zmianą) z ostatnią wartością, np. „Exercise 0:06"; aktualizowany ok. 300 ms po `stop` (pojedynczy krok: po tym samym opóźnieniu), czyszczony przy zmianie pola.

#### 2. Podłączenie w polu i klawisze ↑/↓

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: `ConfigField` renderuje `ConfigStepper` w wierszu między `Input` a `action` dla czterech pól; `Input` dostaje `onKeyDown`: `ArrowUp`/`ArrowDown` → `preventDefault`, zmiana o 1 (z Shift o 10) przez `stepFieldValue` i `handleChange` (czyści błąd pola, przechodzi przez `onValuesChange`).

**Contract**: `ConfigField` przekazuje `field` do logiki; kolejność w wierszu: `Input`, stepper, `action`. Preparation i Repetitions (bez ikony głośnika) też mają stepper; ich wiersze rosną do 44 px na komputerze (decyzja użytkownika; na dotyku cel 44 px i tak to wymusza). Akapit „Enter times in m:ss format (for example, 0:05).” dostaje zdanie „Use the arrows, or ↑ and ↓ in a field (Shift for 10).” Brak zmian w walidacji, podpowiedziach i `PREPARATION_NO_SOUND`. Przy 390 px brak overflow: dotyk `Input` + 2×44 + ikona 44 + odstępy mieści się w karcie `max-w-md`.

### Success Criteria:

#### Automated Verification:

- Pełna bramka: `npx astro sync && npm run lint && npm test && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`
- Skrypt wizualny: układ komputera (kolumna ▲ nad ▼, kolumna dokładnie 44 px, każdy przycisk 22 px, wszystkie cztery wiersze 44 px, brak podwójnej ramki), dotyku (`hasTouch` + `isMobile`: obok siebie ▼ ▲ po lewej od ikony, 44 px, `scrollWidth <= clientWidth` przy 390 px), „mysz + dotyk” (kontekst tylko `hasTouch`: układ duży), `click` bez `pointerdown` (`dispatchEvent`) stepuje, `pointerdown` + `click` stepuje raz, `sr-only` status ma ostatnią wartość, zdanie o ↑/↓ w akapicie

#### Manual Verification:

- Kliknięcie ▲/▼ zmienia wartość o 1 s/1, przytrzymanie powtarza po krótkiej pauzie co ok. 0,1 s i zatrzymuje się przy puszczeniu, wyjściu wskaźnika i utracie fokusu (script, not human: Playwright mouse/touch, zrzuty i liczniki kroków)
- ↑/↓ w polu zmieniają o 1, Shift+↑/↓ o 10; na granicy strzałka jest wyłączona, a zakres jest zachowany (script, not human)
- Rzeczywista weryfikacja na urządzeniu dotykowym i czytnikiem ekranu — po całej kolejce (lista testów ręcznych)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-4-OK]`.

---

## Phase 5: Fixtures, pełna bramka wizualna i dokumentacja

### Overview

Production-backed fixtures steppera, pełny przebieg 7 stanów i dokumentacja reguł.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/ConfigStepperFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Fixtures na prawdziwym `DrillConfigForm`, z `data-testid`/`data-visual-state`: default; disabled na granicy (Exercise 0:01, Rest i Preparation 10:00, Repetitions 1 i 100); error (błędne/puste wartości: błąd walidacji i pierwsze naciśnięcie sprowadza do minimum); loading (przycisk submit/pending, jak w istniejących fixtures formularza); empty — N/A (formularz zawsze ma wartości; pusty input to stan error); hover, focus-visible wymusza skrypt; focus-visible dotyczy pola (↑/↓), a nie strzałek — strzałki mają `tabIndex={-1}`, więc ich focus-visible jest N/A (dostępne klawiaturą przez ↑/↓ w polu; ring po kliknięciu myszą nie jest focus-visible). Układ komputera/dotyku wybiera kontekst przeglądarki skryptu (media `pointer`), nie prop.

**Contract**: `TimerUiPreview.tsx` montuje nową sekcję obok `SignalPreviewFixtures`. Opisy w `SignalPreviewFixtures.tsx`, `CreateDrillFixtures.tsx`, `EditDrillFixtures.tsx` są poprawne bez zmian (ten sam formularz); sprawdzić, czy asercje starych skryptów (S-19, S-18) nadal przechodzą po dołożeniu steppera, i odświeżyć tylko zrzuty, w których układ się zmienił.

#### 2. Pełna bramka wizualna

**File**: `context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs`

**Intent**: Rozszerzyć skrypt o 7 stanów (default, hover, focus-visible, disabled, error, empty/N/A uzasadnione, loading) × jasny/ciemny × 1280/390, w obu układach wskaźnika (kontekst „fine" i kontekst `hasTouch`/`isMobile` „coarse"), z asercjami: rozmiary celów, kolejność ▲/▼, brak zmiany wysokości wiersza z ikoną, brak overflow, kontrast hover/focus (ring widoczny), przytrzymanie (liczba kroków w czasie, zatrzymanie po puszczeniu/wyjściu wskaźnika/blurze), ↑/↓/Shift, granice, format `m:ss`, poprawka A3.7–A5.9 i Current z faz 1–2 jako regresja.

**Contract**: Zrzuty i `ux-fixes-round-2-checks.json` w `context/changes/ux-fixes-round-2/screenshots/`; kroki ręczne w Progress oznaczone „script, not human".

#### 3. Dokumentacja

**File**: `AGENTS.md`, `context/foundation/prd.md`, `context/foundation/roadmap.md`, `context/foundation/ux-fixes-plan.md`, `README.md` (jeśli opisuje formularz)

**Intent**: AGENTS.md (sekcja UI): jedno zdanie o stepperze (`ConfigStepper`, `pointer-coarse:`/`pointer-fine:`, `aria-disabled`, kompromis 22 px i wyjątek „Equivalent" WCAG 2.5.8, fixtures `ConfigStepperFixtures.tsx`, skrypt i zrzuty w `context/changes/ux-fixes-round-2/screenshots/`). PRD: nowe FR-020 (stepper) z kryteriami z „Desired End State". Roadmapa: S-21 `PRD refs` = FR-018, FR-020. ux-fixes-plan: krótka sekcja S-21 z decyzjami i kompromisem 2.5.8.

**Contract**: Bez zmian innych reguł; zachować EOL.

### Success Criteria:

#### Automated Verification:

- Pełna bramka: `npx astro sync && npm run lint && npm test && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`
- Skrypt wizualny kończy się kodem 0 (7 stanów × motywy × szerokości × układy): `npm run dev` + `PLAYWRIGHT_PATH=<path> node context/changes/ux-fixes-round-2/screenshots/ux-fixes-round-2-visual-gate.mjs`
- Regresja skryptów S-19 i zaktualizowanego S-18 (`signal-preview-visual-gate.mjs`, `run-view-visual-gate.mjs`) kończy się kodem 0

#### Manual Verification:

- Zrzuty 7 stanów × jasny/ciemny × 1280/390 (komputer i dotyk) zapisane i przejrzane (script, not human)
- Dokumentacja zgodna z implementacją (przegląd diffu AGENTS.md, PRD, roadmapy)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-5-OK]`; potem review implementacji (`rev`), poprawki, PR do `main`.

---

## Testing Strategy

### Unit Tests:

- `drill-stepper.test.ts`: granice i formaty wszystkich pól, krok 1 i 10, wartości puste/błędne/poza zakresem, `canStep`.
- `drill-step-repeat.test.ts`: opóźnienie 400 ms, powtarzanie co 100 ms, stop na granicy, stop/dispose, podwójny start.
- `drill-phase-sections.test.ts`: `currentPhaseBody`, wszystkie pary current → next, różnicowe Standby 1 s vs 5 s.
- Istniejące testy bez zmian (`npm test`), testy kontraktu lintu (`node --test scripts/eslint-rules/*.test.mjs`).

### Integration Tests:

- Skrypt Playwright S-21 (nie w CI) na `/dev/timer-ui`: oba układy wskaźnika, przytrzymanie, klawiatura, 7 stanów.
- Smoke w CI: `/create` ma „Back to timers" → `/timers` (lokalnie niemożliwy bez Mailpit).

### Manual Testing Steps:

1. `/create` i `/`: ▲/▼ przy każdym polu, przytrzymanie, ↑/↓ i Shift w polu, granice.
2. Emulacja dotyku 390 px: przyciski obok siebie przed ikoną głośnika, brak overflow.
3. Widok biegu: Current i Next identyczne, Standby bez czasu w obu miejscach.
4. Tooltip odsłuchu: brak pustej połowy; wyłączona ikona bez zmiany koloru przy hoverze.
5. (Użytkownik, po kolejce) rzeczywisty telefon i czytnik ekranu; B4.2, B5.2, B5.6 odnotowane w opisie PR.

## Performance Considerations

Brak istotnych: jeden interwał 100 ms tylko podczas przytrzymania, czyszczony przy puszczeniu, blurze i odmontowaniu; każdy krok to jeden `onValuesChange`.

## Migration Notes

Brak migracji bazy danych i zmian API. Stepper działa na istniejących tekstowych wartościach pól; zapisane timery nie wymagają zmian.

## References

- Roadmap: `context/foundation/roadmap.md` (S-21), `context/foundation/ux-fixes-plan.md`
- PRD: FR-018 (zmiana), FR-020 (nowe), FR-004, FR-019 (`context/foundation/prd.md`)
- Wzór logiki z wstrzykiwanymi timerami: `src/lib/signal-preview-hint.ts`, `src/components/hooks/useSignalHint.ts`
- Wzór przycisku `aria-disabled`: `src/components/timer/SignalPreviewControl.tsx`
- Wzór bramki wizualnej: `context/changes/signal-preview-icon/screenshots/signal-preview-visual-gate.mjs`, `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs`
- Plany poprzednich zmian: `context/changes/{run-view-layout,signal-preview-icon,timers-list-and-account}/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Poprawki A3.7, A5.3, A5.9 i szkielet skryptu bramki

#### Automated

- [x] 1.1 Link „Back to timers" → `/timers` w `DrillCreateApp.tsx` i asercja w smoke — 18f49cd
- [x] 1.2 Pełna bramka (sync, lint, test, kontrakt, check, build) przechodzi — 18f49cd
- [x] 1.3 Skrypt wizualny (A5.3, A5.9) kończy się kodem 0 — 18f49cd

#### Manual

- [x] 1.4 Link powrotu na `/create` prowadzi do `/timers` — script, not human (href asserted in smoke and markup; user confirms in the manual list) — 18f49cd
- [x] 1.5 Tooltip bez pustej prawej połowy przy 1280 i 390 px — script, not human (tooltip gap <= 7 px, screenshots reviewed) — 18f49cd

### Phase 2: Okienko Current jak Next

#### Automated

- [x] 2.1 Testy modelu (w tym różnicowe Standby) przechodzą — 867be5f
- [x] 2.2 Lint, kontrakt, typy i build przechodzą — 867be5f
- [x] 2.3 Skrypt wizualny (Current jak Next, Standby bez czasu, stałe pozycje) kończy się kodem 0 (444/444) — 867be5f
- [x] 2.6 Skrypt S-18 `run-view-visual-gate.mjs` zaktualizowany (Current jako grupa) i kończy się kodem 0 (680/680) — 867be5f

#### Manual

- [x] 2.4 Current wygląda jak Next we wszystkich scenariuszach i motywach — script, not human (style equality asserted, screenshots reviewed) — 867be5f
- [x] 2.5 Czas i pasek przycisków nie skaczą między fazami — script, not human (positions compared across all scenarios) — 867be5f

### Phase 3: Czysta logika steppera i powtarzacza

#### Automated

- [x] 3.1 Testy `drill-stepper` i `drill-step-repeat` oraz istniejące przechodzą — 2c30fa2
- [x] 3.2 Lint, kontrakt, typy i build przechodzą — 2c30fa2

#### Manual

- [x] 3.3 Moduły `src/lib` nie importują Reacta ani DOM — script, not human (grep over imports, no React or DOM) — 2c30fa2

### Phase 4: Stepper w formularzu (oba układy, klawiatura)

#### Automated

- [x] 4.1 Pełna bramka (sync, lint, test, kontrakt, check, build) przechodzi — f6abe51
- [x] 4.2 Skrypt wizualny: układ komputera i dotyku, rozmiary, wysokość wiersza, brak overflow (722/722; S-18 680/680, S-19 234/234) — f6abe51

#### Manual

- [x] 4.3 Kliknięcie, przytrzymanie i zatrzymanie powtarzania działają zgodnie z wymaganiem — script, not human (Playwright mouse/touch, release, leave, blur) — f6abe51
- [x] 4.4 ↑/↓, Shift i granice zakresu działają zgodnie z wymaganiem — script, not human — f6abe51
- [x] 4.5 Ogłoszenie wartości (`role="status"`) i wzmianka o ↑/↓ w akapicie potwierdzone skryptem — f6abe51

### Phase 5: Fixtures, pełna bramka wizualna i dokumentacja

#### Automated

- [x] 5.1 Pełna bramka (sync, lint, test, kontrakt, check, build) przechodzi (249 testów, 6 kontraktu) — 9319af6
- [x] 5.2 Skrypt wizualny (7 stanów × motywy × szerokości × układy) kończy się kodem 0 (1291/1291) — 9319af6
- [x] 5.3 Regresja skryptów S-19 i S-18 kończy się kodem 0 (S-19 234/234, S-18 680/680) — 9319af6

#### Manual

- [x] 5.4 Zrzuty 7 stanów w obu motywach, szerokościach i układach przejrzane — script, not human (zrzuty przejrzane, asercje w skrypcie) — 9319af6
- [x] 5.5 Dokumentacja (AGENTS.md, PRD, roadmapa, ux-fixes-plan) zgodna z implementacją — script, not human (przegląd diffu) — 9319af6
