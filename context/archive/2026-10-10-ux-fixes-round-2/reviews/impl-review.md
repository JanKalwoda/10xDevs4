<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX fixes round 2 Implementation Plan

- **Plan**: context/changes/ux-fixes-round-2/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Weryfikacja (uruchomiona przez recenzenta)

`npx astro sync`, `npm run lint` (0 błędów), `npm test` (249/249), `node --test scripts/eslint-rules/*.test.mjs` (6/6), `npx astro check` (0 błędów, 0 ostrzeżeń), `npm run build` — wszystko zielone. Skryptów Playwright (S-21, S-18, S-19) nie uruchamiałem (brak zainstalowanego Playwrighta); przejrzałem `ux-fixes-round-2-checks.json` (1291/1291 ok) i zrzuty (stepper fine 1280 light, coarse 390 dark, Standby 390 light).

## Decyzje z plan-review (F1–F9) — wdrożone

- F1 skrypt S-18 zaktualizowany (Progress 2.6, 680/680) ✔
- F2 `any-pointer-coarse:` bez `@custom-variant` ✔ (`ConfigStepper.tsx:21,82`)
- F3 `touch-none`, flaga `handledByPointer` w refie, `setPointerCapture` + `onLostPointerCapture` ✔ (patrz F1/F4 niżej — drobne uwagi)
- F4 44 px we wszystkich czterech wierszach (decyzja użytkownika) ✔
- F5 `sr-only role="status"` + zdanie o ↑/↓ i Shift ✔ (luka dla klawiszy: F2 niżej)
- F6 `tabIndex={-1}` + `aria-disabled` ✔
- F7 `border-t-0`, `relative focus-visible:z-10`, `shadow-none` ✔
- F8 ref `latest` w `useLayoutEffect` ✔ (`useStepRepeat.ts:15-18`)
- F9 `aria-labelledby` na widocznej etykiecie, brak `h2` ✔ (`PhaseSections.tsx:12-19`)

Tajność Standby: model bez zmian poza `currentPhaseBody`; `time: null` w Standby, test różnicowy 1 s vs 5 s rozszerzony o `currentPhaseBody` (identyczny, brak `m:ss`) ✔. Stałe wysokości: obie linie jednowierszowe, `Repetition` zachowuje `min-h-7`; zrzut Standby 390 potwierdza brak przesunięć ✔. Kontrakt UI: tylko tokeny i skala (`h-5.5`, `w-8`, `size-11`), lint zielony, jedyny nowy wyjątek lintu to skrypt bramki ✔. Format `m:ss` i zakresy z `drill-timer.ts`, walidacja przez `onChange` → `onValuesChange` ✔ (`drill-stepper.ts`).

## Findings

### F1 — `useStepRepeat` na cleanup trwale „zabija” powtarzacz (StrictMode / HMR)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useStepRepeat.ts:33-38, src/lib/drill-step-repeat.ts:60-63
- **Detail**: Efekt czyszczący wywołuje `repeater.dispose()`, które ustawia `disposed = true` bezpowrotnie, a powtarzacz żyje w `useState`. Gdy efekt zostanie uruchomiony ponownie na tej samej instancji (React StrictMode, Fast Refresh w dev), `start()` od razu wraca (`if (disposed || …)`) i przytrzymanie oraz pojedynczy krok z `pointerdown` przestają działać do czasu pełnego remontu. Plan (faza 3 §3) wymagał „odporne na StrictMode”, a wzorzec `useSignalHint` używa w cleanup odwracalnego `hide()`. Dziś StrictMode nie jest włączony (grep po `src`), więc to usterka utajona, ale w dev po edycji pliku (HMR) stepper może przestać reagować.
- **Fix**: W cleanup wołać `repeater.stop()` zamiast `dispose()` (albo tworzyć powtarzacz w efekcie); `dispose` zostawić w module z testami.
- **Decision**: FIX — cleanup `useStepRepeat` woła `stop()`, nie `dispose()`; test „stop on cleanup keeps the repeater usable” (start po stop na tej samej instancji, jak ponowny efekt w StrictMode/HMR) w `drill-step-repeat.test.ts` (250/250).

### F2 — ↑/↓ w polu zmieniają wartość bez ogłoszenia dla czytnika ekranu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/DrillConfigForm.tsx:78-90
- **Detail**: Flaga `announceStep` jest ustawiana tylko w `onStep` przycisków. `onKeyDown` woła `onChange` bez niej, więc `role="status"` nie dostaje komunikatu. Strzałki mają `tabIndex={-1}`, więc ↑/↓ to jedyna ścieżka klawiatury (i „Equivalent” dla WCAG 2.5.8), a programowa zmiana wartości w polu tekstowym nie jest zwykle odczytywana przez NVDA/VoiceOver.
- **Fix**: Ustawić `announceStep.current = true` także w `onKeyDown` przed `onChange`.
- **Decision**: FIX — ↑/↓ (także Shift) ustawiają `announceStep` przed `onChange`; `role="status"` ogłasza wartość. Asercja w skrypcie S-21: „ArrowUp is announced by the status region”.

### F3 — Niestabilny test S-19 „outside tap closes the touch hint”: przesłanka testowa, nie błąd produktu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/signal-preview-icon/screenshots/signal-preview-visual-gate.mjs:236-243 (oraz dodany `waitForTimeout(1500)` w `prepare`, :43)
- **Detail**: Zmiana produktu nie dotyka ścieżki zamykania (diff `SignalPreviewControl.tsx` to jedna klasa Tailwind; `onPointerDownOutside` bez zmian). Skrypt dotyka `heading.x + 4, heading.y + 4` bez gwarancji, że nagłówek jest w viewportcie (po `scrollIntoViewIfNeeded` ikony nagłówek fixture’u może być przewinięty poza ekran, a stepper zmienił wysokości wierszy i pozycję przewinięcia), a Radix rejestruje nasłuch „outside” po ticku, w dev dodatkowo dochodzi późna hydratacja (dlatego dodano 1,5 s oczekiwania). To wskazuje na flake testu (czasowy/geometryczny), nie na regresję. Nie zweryfikowałem tego uruchomieniem (brak Playwrighta); wniosek oparty na lekturze kodu i diffu.
- **Fix**: W skrypcie: `heading.scrollIntoViewIfNeeded()` i asercja, że `boundingBox` mieści się w viewportcie, przed tapnięciem (albo tap w stały bezpieczny element, np. wolny obszar karty); zostawić czekanie na hydrację.
- **Decision**: FIX — skrypt S-19: `scrollIntoViewIfNeeded()` nagłówka, ponowny pomiar i asercja, że cel tapnięcia mieści się w viewportcie; skrypt uruchomiony 3x pod rząd: 236/236 za każdym razem.

### F4 — Ochrona przed podwójnym krokiem oparta na oknie 100 ms

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/timer/ConfigStepper.tsx:9,40-46,50-52
- **Detail**: Flaga `handledByPointer` jest zerowana po `CLICK_AFTER_POINTER_MS` od puszczenia; jeśli `click` dotrze później (obciążony wątek na słabym telefonie), nastąpi drugi krok, a `setPointerCapture` może rzucić `NotFoundError` dla zsyntetyzowanego/nieważnego `pointerId` i wtedy `start()` się nie wykona. Normalnie `click` przychodzi tuż po `pointerup`, a test Playwright potwierdza pojedynczy krok.
- **Fix**: Owinąć `setPointerCapture` w try/catch; rozważyć zerowanie flagi wyłącznie w `click`/`pointerleave` zamiast czasu.
- **Decision**: ACCEPTED (okno 100 ms) / FIX (`setPointerCapture`) — `setPointerCapture` owinięty w try/catch (krok i tak działa bez capture). Okno 100 ms flagi `handledByPointer` zostaje: `click` po `pointerup` przychodzi w tym samym zadaniu, a późny `click` na przeciążonym wątku dałby co najwyżej jeden dodatkowy krok; zerowanie tylko w `click`/`pointerleave` pozostawiłoby flagę po puszczeniu poza przyciskiem i zjadło następny klik z klawiatury/czytnika.

### F5 — Steppery w wierszach bez ikony głośnika nie są w jednej kolumnie z pozostałymi

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/timer/DrillConfigForm.tsx (kolejność `Input`, stepper, `action`); zrzuty stepper-fine-1280-light.png, stepper-coarse-390-dark.png
- **Detail**: Preparation i Repetitions mają stepper przy prawej krawędzi, Exercise/Rest przed ikoną, więc pola wejściowe i strzałki mają różne szerokości/położenia. Zgodne z planem (kolejność `Input`, stepper, `action`), tylko kosmetyka.
- **Fix**: Zostawić albo zarezerwować pusty slot o szerokości ikony w dwóch wierszach (poza zakresem planu).
- **Decision**: FIX — zrzuty potwierdziły niewyrównanie (Preparation i Repetitions miały stepper przy prawej krawędzi). Wiersze bez ikony dostają niewidoczny `span aria-hidden` `size-11 shrink-0` (ta sama skala co ikona), więc stepper jest w jednej kolumnie we wszystkich czterech wierszach. Asercja w S-21: „steppers of all four rows share one column”; zrzuty odświeżone (1307/1307).
