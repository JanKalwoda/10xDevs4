<!-- PLAN-REVIEW-REPORT -->
# Plan Review: UX fixes round 3 (S-22)

- **Plan**: context/changes/ux-fixes-round-3/plan.md
- **Mode**: Deep (weryfikacja kodu własna, bez sub-agenta)
- **Date**: 2026-10-11
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓, 6/6 symbols ✓ (`CLICK_AFTER_POINTER_MS`, `handledByPointer`, `createStepRepeater.start`, `any-pointer-coarse`, `max-w-xs`, zakres lintu w `eslint.config.js`), brief↔plan ✓, Progress↔Phase ✓ (4 fazy, kryteria 1:1).

Diagnoza przyczyny (czasowy wyścig `pointerdown` + `click`, `ConfigStepper.tsx:38-72`) jest trafna; model „krok zawsze z `click`, `pointerdown` tylko uzbraja powtarzanie” usuwa ją u źródła. Poniżej luki w szczegółach.

## Findings

### F1 — Flaga pominięcia `click` może „zostać” i połknąć krok z klawiatury / AT

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — #2 Kontroler gestu, Key Discoveries
- **Detail**: Flaga ustawiana przez `onFire` jest kasowana tylko przez `click`, nowy `pointerdown`, abort lub `blur`. Jeśli po długim przytrzymaniu `click` nie nadejdzie, a gest zakończył się `pointerUp` (długie przytrzymanie dotykiem bywa zakończone `contextmenu` bez `click`; `preventDefault` tego nie gwarantuje), flaga zostaje. Następny `click` z klawiatury, czytnika ekranu lub sterowania głosem (bez `pointerdown`) zostanie pominięty — dokładnie ścieżka AT. Plan zakazuje timera, więc nic tej flagi nie wygasi.
- **Fix**: Rozróżnić źródło `click` zdarzeniem, nie czasem: `click(direction, fromPointer = event.detail > 0)`. `detail === 0` (klawiatura, `element.click()` z AT/głosu) zawsze stepuje i kasuje flagę; pomijanie tylko dla `detail > 0` przy ustawionej fladze. Dodać test „flaga po `pointerUp` bez `click`, następny `click` z `detail 0` stepuje”; dodatkowo kasować flagę na `focus`/`blur` i `pointerDown`. Zweryfikować `detail` na tapnięciu w skrypcie Playwright.
  - Strength: eliminuje stan zależny od zdarzenia, które może nie nadejść; bez timera.
  - Tradeoff: poleganie na `detail` (UI Events), dodatkowy parametr API kontrolera.
  - Confidence: MED — `detail` dla syntetycznego `click()` to 0, ale voice control w mobilnych przeglądarkach nie jest zweryfikowany.
  - Blind spot: sterowanie głosem w iOS może wysyłać `click` z `detail 1`.
- **Decision**: PENDING

### F2 — Rozróżnienie `pointerAbort` / `lostpointercapture` po `pointerUp` wymaga stanu „wciśnięty”, którego kontrakt nie nazywa

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — #2 Kontroler gestu, #3 Hook i komponent
- **Detail**: Kolejność zdarzeń to `pointerup` → `lostpointercapture` (niejawne zwolnienie capture) → `click`; na dotyku dodatkowo `pointerleave`/`pointerout` po `pointerup`. Plan mówi „abort bez wcześniejszego `pointerUp`”, ale `createStepPress` nie ma pola `pressed`, a komponent wiąże `onLostPointerCapture` i `onPointerLeave` (dziś oba na `release`). Implementujący musi zgadywać, kto trzyma stan. Brakuje przypadków: `pointerUp` bez `pointerDown`; drugi wskaźnik/multi-touch w trakcie gestu; idempotencja abortu (zwolnienie capture w `handlePointerMove` wywoła potem `lostpointercapture`, więc abort przyjdzie dwa razy).
- **Fix**: Zapisać w kontrakcie: kontroler trzyma `pressed` i `skipClick`; `pointerUp` działa tylko gdy `pressed` (ustawia `pressed=false`); `pointerAbort` działa tylko gdy `pressed` (po `pointerUp` jest no-op, więc kolejność zdarzeń nie ma znaczenia); `pointerDown` w trakcie gestu = restart. Dopisać testy: `pointerUp` bez `pointerDown`, `pointerAbort` po `pointerUp` (flaga zostaje), podwójny `pointerDown`, podwójny `pointerAbort`.
- **Decision**: PENDING

### F3 — Brak decyzji o zakresie lintu i adaptacji tokenów dla `input-group.tsx`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — #1 Prymityw InputGroup; kontrakt timer-ui
- **Detail**: Zakres lintu to jawna lista `src/components/ui/{input,label,checkbox,card,alert,alert-dialog,tooltip}.tsx` (`eslint.config.js:122`). `input-group.tsx` jej nie ma, więc wygenerowany plik (m.in. `h-9`, `ring-[3px]`, kolory) przejdzie lint bez adaptacji i kontrakt „tylko tokeny” złamie się po cichu; plan nie mówi, czy plik wchodzi do zakresu ani czy test `timer-ui-contract.test.mjs` to pinuje. `Input` w repo ma dopasowany ring/ramkę błędu (`aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:...ring-destructive/40`) i kontrast „validation red” z AGENTS.md; `InputGroup` ma własne selektory (`has-[[data-slot][aria-invalid=true]]`) i może się rozjechać w ciemnym motywie. Addon ma domyślny padding/gap/ujemny margines przy `button` — plan nie mówi o zerowaniu, a bez tego kolumna 22 px i przyciski 44 px nie zgrają się z `h-11`. Trzeba też sprawdzić, czy `onClick` addonu (fokus pola) nie zabiera focusu przyciskom. `textarea.tsx` dodany jako zależność rejestru byłby martwym plikiem.
- **Fix**: Dopisać do fazy 2: dodać `input-group` do listy lintu i do pinów testu kontraktu; po generacji zamienić wartości arbitralne i kolory na skalę/tokeny (ring jak w `Input`: `ring-2 ring-ring/50`, błąd jak w `Input`); w użyciu przekazać addonowi `p-0 gap-0` i wyzerować ujemny margines; asercja skryptu na kontrast ramki błędu w jasnym i ciemnym motywie; usunąć niepotrzebny `textarea.tsx`.
  - Strength: kontrakt timer-ui nadal egzekwowany lintem; brak regresji kontrastu błędu.
  - Tradeoff: ręczna adaptacja wygenerowanego pliku (jak dla pozostałych prymitywów).
  - Confidence: HIGH — lista lintu i klasy `Input` zweryfikowane w repo.
  - Blind spot: dokładna treść `input-group` z rejestru nie była czytana w tym przeglądzie.
- **Decision**: PENDING

### F4 — Setup „fine primary + touch” opiera się na emulacji, której nie zweryfikowano

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — kryteria; Phase 4 — #2; Key Discoveries (ostatnia pozycja)
- **Detail**: Plan zakłada, że kontekst Playwright `hasTouch` bez `isMobile` daje `(pointer: fine)` i `(any-pointer: coarse)`. Skrypt z rundy 2 sprawdza tylko `any-pointer` (`ux-fixes-round-2-visual-gate.mjs:251,411`), nigdy `pointer`. W Chromium emulacja dotyku może przestawić także główny wskaźnik na `coarse`; wtedy test „laptop dotykowy dostaje kolumnę” jest fałszywie czerwony lub źle skonfigurowany. Brak planu B.
- **Fix**: W fazie 1 (przy szkielecie skryptu) sprawdzić `matchMedia("(pointer: fine)")` w kontekście `hasTouch`. Jeśli wynik to `coarse`, wybrać alternatywę (np. kontekst bez `hasTouch` + `Input.dispatchTouchEvent` przez CDP, lub osobny kontekst fine z syntetycznymi zdarzeniami dotyku) i zapisać wybór w planie. Asercja `matchMedia` ma być twarda w każdym setupie.
- **Decision**: PENDING

### F5 — Tooltip: `md:max-w-md` nie gwarantuje braku luki przy zawijaniu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — #1 Tooltip
- **Detail**: `w-fit max-w-xs` (`tooltip.tsx:24`) przy zawijaniu wypełnia całe `max-width`, a ostatnie linie są krótsze. Szersze `md:max-w-md` zmniejsza liczbę zawinięć, ale opis dłuższy niż 448 px lub dwa `<p>` (znaczenie + nota) znów zostawią lukę. `md` mierzy okno, nie miejsce przy kotwicy; Radix przy ikonie na prawej krawędzi może przesunąć/przyciąć 448 px.
- **Fix**: Dodać `text-pretty` lub `text-balance` do treści i test na najdłuższym `SIGNAL_MEANINGS` z notą; traktować 7 px jako cel, nie gwarancję.
- **Decision**: PENDING

### F6 — Current bez ramki: `border-transparent` przechodzi lint, hedge jest zbędny

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — #2
- **Detail**: Reguły w `timer-ui-contract.mjs:3-6` blokują klasy palety i wartości arbitralne; `border-transparent` nie jest w żadnym regexie, więc przejdzie. Warunek „jeśli lint nie dopuści” jest niepotrzebny i zostawia furtkę na padding „ze skali”, który łatwo rozjedzie wysokości względem Next.
- **Fix**: Zapisać wprost `border border-transparent` + te same `px-4 py-3`; asercja skryptu porównuje `getBoundingClientRect().height` Current i Next oraz pozycje czasu i paska (także Standby).
- **Decision**: PENDING

### F7 — `arm`: granica, `onFire` i zmiana momentu pierwszego kroku niedopowiedziane

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — #1
- **Detail**: Kontrakt `arm(step, onFire)` nie rozstrzyga: (a) czy uzbraja, gdy wartość jest już na granicy (nie powinien, `click` i tak nic nie robi); (b) czy `onFire` jest wołane, gdy pierwszy krok po pauzie zwraca `false` (powinno, bo użytkownik trzymał >400 ms i `click` ma być pominięty); (c) krok następuje teraz przy puszczeniu, nie przy wciśnięciu — zmiana UX względem rundy 2, którą użytkownik może zauważyć jako opóźnienie.
- **Fix**: Dopisać (a)–(c) do kontraktu i testów `arm`; wspomnieć o (c) w opisie PR.
- **Decision**: PENDING

## Sprawdzone bez uwag

- Układ: kolumna domyślnie, `pointer-coarse:` → wiersz; Tailwind 4.3.3 (lockfile) ma `pointer-coarse:`/`pointer-fine:`; jedyne użycie `any-pointer` w kodzie to `ConfigStepper.tsx` (reszta to dokumenty, które plan aktualizuje).
- 390 px: rozkład szerokości jak dziś (pole + 2 × 44 + głośnik 44); ramka grupy zastępuje ramkę pola, więc brak nowego overflow; asercja `scrollWidth <= clientWidth` wystarcza.
- Tooltip: `tooltip.tsx` używany tylko przez `DrillConfigForm` i `SignalPreviewControl` — mały promień rażenia.
- Zakres i „NOT doing” spójne z fazami; Progress zgodny z formatem.
