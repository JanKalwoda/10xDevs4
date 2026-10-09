<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Signal preview icon (S-19)

- **Plan**: context/changes/signal-preview-icon/plan.md
- **Mode**: Deep
- **Date**: 2026-10-09
- **Verdict**: REVISE
- **Findings**: 1 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

6/6 ścieżek ✓ (SignalPreviewControl, DrillConfigForm, drill-signal-preview.ts, useSignalPreview, SignalPreviewFixtures, eslint.config.js:117 — glob jest w linii 117, nie 103), symbole ✓ (signalAvailability, SIGNAL_MEANINGS, createSignalPreviewController), brief↔plan ✓, Progress↔Phase ✓ (3 fazy, kryteria 1:1). Brak plików `tooltip.tsx` ✓ (do dodania). `docs/reference/contract-surfaces.md` nie istnieje — pominięto.

## Findings

### F1 — Sterowany `open` tooltipu nie jest zdefiniowany; Radix zamknie podpowiedź dotykową własnym onClick

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — #2 Przycisk-ikona z tooltipem, #1 Logika podpowiedzi
- **Detail**: Plan mówi „otwierany przez hover/fokus oraz sterowanie `open` z `createSignalHint` na dotyk", ale nie rozstrzyga, kto jest właścicielem `open`. Radix `TooltipTrigger` na `click` wywołuje `onClose` → `onOpenChange(false)`, na `blur` i `pointerleave` też. Kolejność na dotyku: `pointerdown` (plan: `showFor()`) → `click` (Radix zamyka) → podpowiedź znika w tej samej chwili, więc wymaganie FR-019 („po dotknięciu pojawiają się") nie zadziała, a testy jednostkowe `signal-preview-hint` tego nie wykryją. Radix także pomija otwarcie na focus po `pointerdown` i ignoruje dotyk w `pointermove`. Dodatkowo `Esc` i dotknięcie poza elementem (Radix `onDismiss`) muszą zamykać również stan dotykowy (WCAG 1.4.13: dismissible).
- **Fix**: Zapisać w kontrakcie jawny model: `open = radixOpen || hint.open`; `onOpenChange(next)` zapisuje `radixOpen` tylko dla przyczyn hover/focus/Esc/outside, a `false` pochodzące z `click` na triggerze nie wpływa na `hint.open` (np. `onClick` triggera `event.preventDefault()` nie pomaga — rozróżnić po zdarzeniu lub trzymać dwa stany); `Esc`/outside wywołują też `hint.hide()`. Dodać do Phase 2 kryterium automatyczne w skrypcie Playwright z `hasTouch` (tap → tooltip widoczny po 500 ms i niewidoczny po ~4,5 s).
- **Decision**: FIX — open = radixOpen || hint.open; zamknięcie z click triggera ignorowane; Esc/klik poza gasi oba; testy w module hint.

### F2 — Dostępność na mobile: live region zależy od `pointerType`, więc czytnik ekranu go nie dostanie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — `decidePress`, live region
- **Detail**: `decidePress` rozróżnia `touch` od `mouse/keyboard`. Aktywacja z TalkBack/VoiceOver (podwójne dotknięcie) generuje `click` z `pointerType` pustym/„mouse" lub bez poprzedzającego `pointerdown`, więc opis w live region się nie pojawi. Powód wyłączenia (`Rest is 0:00`) dla użytkownika czytnika jest wtedy dostępny tylko przez `aria-describedby` po fokusie — to działa, ale nie ma potwierdzenia po „kliknięciu" wyłączonej ikony (jedyny sygnał „nie odtworzyło się"). Dodatkowo: live region musi istnieć w DOM przed zmianą treści; ten sam tekst ogłaszany ponownie przy drugim dotknięciu nie zostanie odczytany (brak zmiany), a opis w live region + `aria-describedby` + Radix `role="tooltip"` dubluje odczyt.
- **Fix**: Doprecyzować: (a) dla wyłączonej ikony live region dostaje powód niezależnie od `pointerType` (`decidePress.announce`), (b) dla włączonej ikony live region ogłasza tylko stan („Starting sound…", „Playing … signal"), a pełny opis zostaje w `aria-describedby`/tooltipie (bez trzeciej kopii), (c) przy ponownym ogłoszeniu czyścić i ustawiać tekst w kolejnych ticku (lub dodać licznik), (d) `aria-disabled` zachowuje fokus i Enter/Space → ten sam `onClick`. Dodać do testów `decidePress` przypadek `pointerType: ""`.
- **Decision**: FIX — powód/opis do live region niezależnie od pointerType, bez trzeciej kopii, reset tekstu przy powtórce; test pointerType "".

### F3 — Domyślne klasy shadcn `tooltip.tsx` łamią kontrakt lintu; plan mówi tylko „sprawdzić klasy"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — #1 Prymityw shadcn
- **Detail**: Reguła `scripts/eslint-rules/timer-ui-contract.mjs:6` odrzuca `translate-y-[calc(-50%_-_2px)]` i `rounded-[2px]` (strzałka w standardowym `TooltipContent`) — to wartości arbitralne bez `var(--…)`. `origin-(--radix-tooltip-content-transform-origin)` i `data-[state=…]:` przechodzą (nie są w regexie), więc animacje zostają. Faza 1 przejdzie lint dopiero po ręcznej podmianie, a plan tego nie wskazuje.
- **Fix**: Wpisać do kontraktu: strzałka bez arbitralnych wartości (np. `size-2.5 rotate-45 rounded-xs` + pozycjonowanie `translate-y-[-50%]` zastąpione klasą skali, np. `-translate-y-1/2` i `-mt-px`, lub rezygnacja ze strzałki) oraz dopisać regresyjny przypadek w `timer-ui-contract.test.mjs`. Poprawić odwołanie do globu na `eslint.config.js:117` (nie 103).
- **Decision**: FIX — klasy tooltip.tsx dopasowane do kontraktu, glob w eslint.config.js:117, pin w teście kontraktu.

### F4 — Tooltip przy 390 px: brak limitu szerokości/marginesu, a bramka overflow go nie wykryje

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 contract, Phase 3 — #2 Skrypt bramki
- **Detail**: Ikona jest przy prawej krawędzi wiersza, a opis Standby ma ok. 150 znaków (`SIGNAL_MEANINGS.standby`) plus notatka (`STANDBY_OFF_NOTE`). Standardowy `TooltipContent` ma `w-fit` bez `max-w` i bez `collisionPadding` → bąbel dochodzi do krawędzi okna lub ją przekracza. Sprawdzenie `scrollWidth <= clientWidth` jest ślepe na elementy `position: fixed` w portalu (nie wpływają na przewijalny obszar dokumentu), więc skrypt przejdzie mimo przycięcia.
- **Fix**: W `TooltipContent` dodać `max-w-xs` (lub `max-w-(--radix-tooltip-content-available-width)` — przechodzi lint dzięki `var(--…)`), `collisionPadding` ≥ 8 i `text-balance`; w skrypcie sprawdzać `getBoundingClientRect()` otwartego tooltipu: `left >= 0 && right <= innerWidth`, zarówno dla hover/focus, jak i dotyku, w obu motywach.
- **Decision**: FIX — max-w ze skali + collisionPadding; bramka sprawdza getBoundingClientRect tooltipu w viewport przy 390.

### F5 — Zachowanie kluczowe dla FR-019 (wyłączona ikona nie gra, dotyk) nie ma żadnego testu automatycznego

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Testing Strategy, Phase 3 — #2
- **Detail**: Testy jednostkowe obejmują tylko `signal-preview-hint` (timer, `decidePress`). Połączenie z komponentem (blokada `onPlay` przy `aria-disabled`, brak `disabled`, `aria-describedby`, `aria-busy`, brak odtworzenia po kliknięciu/Enterze w wyłączoną ikonę) weryfikuje tylko ręcznie/zrzutami. Bramka Playwright sprawdza overflow i hitbox, ale nie zachowanie, a fixture ma gotowy licznik `data-evidence="cues"` (`SignalPreviewFixtures.tsx:113`), którego można użyć.
- **Fix**: Dodać do skryptu bramki asercje: klik i Enter/Space na ikonie Rest w fixture `signal-disabled-zero` → `cues` pozostaje `none` i tooltip pokazuje powód; klik na włączonej → `cues` rośnie; `aria-disabled="true"` bez atrybutu `disabled`; `aria-describedby` wskazuje istniejący element z tekstem. Dopisać to do kryterium 3.2.
- **Decision**: FIX — asercje Playwright na data-evidence=cues, aria-disabled bez disabled, klawiatura.

### F6 — Podpowiedź po dotyku 4 s jest za krótka względem długości tekstu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — `createSignalHint({ durationMs = 4000 })`
- **Detail**: Opis Standby ma ok. 150 znaków (kilkanaście sekund czytania dla wolniejszego czytelnika), a po dotknięciu ikona dodatkowo odtwarza dźwięk. 4 s to też zawartość czasowa bez możliwości wydłużenia (WCAG 2.2.1 dotyczy limitów czasu; tu samo zniknięcie opisu pozbawia informacji, bo nie ma stałego akapitu).
- **Fix**: Czas zależny od długości tekstu (np. `max(4 s, 60 ms × znaki)`, cap ~10 s) albo stały 8 s; restart przy kolejnym dotknięciu zostaje; zamknięcie także przez dotknięcie poza ikoną. Zapisać wybraną wartość jako decyzję w planie.
- **Decision**: FIX — podpowiedź stałe 8 s.

### F7 — Założenie: hitbox 44 px (`size-11`) vs 48 px paska timera

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — #2 Przycisk-ikona
- **Detail**: 44 px spełnia WCAG 2.5.5 (AAA) i znacznie przekracza 2.5.8 (AA, 24 px); 48 px w AGENTS.md dotyczy wyłącznie paska sterowania biegiem (`size-12`). Obok `Input` (`h-9`, 36 px) przycisk 44 px da wiersz o wysokości 44 px, więc pole będzie wycentrowane i wizualnie niższe od ikony.
- **Fix**: Zostawić `size-11` (rekomendacja: akceptuję założenie), dopisać jedno zdanie uzasadnienia w planie i sprawdzić w zrzutach wyrównanie `Input` ↔ ikona; wyciszony stan: `aria-disabled:opacity-50` + zablokować `hover:bg-accent` dla `aria-disabled` (Button ma tylko `disabled:` w CVA, `button.tsx:8`), a `aria-disabled:pointer-events-auto` jest zbędne (nic go nie wyłącza).
- **Decision**: ACCEPTED — size-11 (44 px), hover bg zablokowany dla aria-disabled, bez pointer-events-auto.

### F8 — Prop wymuszający otwarty tooltip przepycha kod testowy przez komponenty produkcyjne; opisy fixtures zdezaktualizowane

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — #1 Fixtures
- **Detail**: „Prop inicjalizujący `createSignalHint`" musiałby przejść `DrillCreateForm` → `DrillConfigForm` → `SignalPreviewControl` tylko dla podglądu. Skrypt Playwright i tak potrafi najechać/sfokusować/dotknąć ikonę. Teksty w `SignalPreviewFixtures.tsx` (linie 144, 148, 164, 172) mówią o „Play button", „visible reason", „off note" — po fazie 2 będą nieprawdziwe.
- **Fix**: Bez nowego propa: stany hover/focus/tap wymuszać w skrypcie; zaktualizować opisy fixtures w fazie 2 (żeby faza zostawiała spójny `/dev/timer-ui`).
- **Decision**: FIX — bez propu wymuszającego otwarcie; opisy fixtures w fazie 2.

### F9 — Szczegóły modułu `signal-preview-hint` i jedna uwaga o treści

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — #1 Logika podpowiedzi
- **Detail**: (a) `npm test` uruchamia pliki bezpośrednio w Node: importy w `src/lib` muszą mieć rozszerzenie `.ts` (jak w `drill-signal-preview.ts:1`). (b) `getSnapshot` musi zwracać stabilny obiekt (`useSyncExternalStore`), a `dispose` nie może uszkodzić instancji w React StrictMode (efekt zamontuj→odmontuj→zamontuj) — tworzyć w `useState`/`useEffect` z cleanupem `hide()`. (c) Standby przy wyłączonym Random start ma `enabled: true` + `note` (`drill-signal-preview.ts:46`): `decidePress` ma grać, a tooltip/live region pokazać notatkę — dopisać przypadek do testów. (d) Usunięcie stałych akapitów (decyzja z ux-fixes-plan) jest zgodne z FR-019; przy dotyku brak wskazówki, że wyłączona ikona ma powód, to świadomy kompromis — nie wymaga zmiany.
- **Fix**: Dopisać (a)–(c) do kontraktu i testów.
- **Decision**: FIX — importy .ts, stabilny snapshot, StrictMode, Standby off = enabled + note.

## Odpowiedzi na założenia dev

- **Hitbox 44 px**: akceptuję (F7).
- **4 s po dotyku**: za krótko dla Standby, zmienić (F6).
- **Usunięcie stałych akapitów**: akceptuję, zgodne z FR-019 i tabelą decyzji (F9d).
- **Kontrast tooltipu w dark**: `bg-foreground text-background` = ok. 12:1 w dark (`foreground` L 0,87 na `background` L 0,21) i ok. 9:1 w light; spełnia AA bez nowych tokenów. Jedyne ryzyko to wyciszona ikona (`opacity-50`), wyłączona z wymogów kontrastu, ale nośna dla informacji (F7).
- **Każda faza zielona osobno**: tak. Faza 2 nie psuje `astro check`, bo fixtures używają tylko `DrillConfigForm`; teksty opisów trzeba zaktualizować w fazie 2 (F8).
