# Signal preview icon Implementation Plan

## Overview

S-19 (FR-004, FR-019): odsłuch sygnału w formularzu konfiguracji to przycisk z samą ikoną głośnika (`Volume2`) na końcu wiersza pola czasu (Standby: na końcu wiersza opcji Random start). Opis znaczenia sygnału i powód wyłączenia są w tooltipie (nowy prymityw shadcn `tooltip`). Na dotyku dotknięcie ikony odtwarza dźwięk i na kilka sekund pokazuje ten sam opis; dotknięcie wyłączonej ikony pokazuje powód. Błąd audio jest widocznym `Alert` pod wierszem. Brak overflow przy 390 px.

## Current State Analysis

- `src/components/timer/SignalPreviewControl.tsx` — pełnowymiarowy `Button` „Play {label} signal" pod polem, z trzema stałymi akapitami (znaczenie, notatka, status) i `Alert` błędu; wyłączenie przez `disabled={!availability.enabled}` (wyłączony `button` nie przyjmuje fokusu ani dotyku, więc nie pokaże powodu).
- `src/components/timer/DrillConfigForm.tsx:36-66` — `ConfigField` układa `Label`, `Input`, podpowiedź, błąd i `children` w pionie; `previewControl(signal)` jest podawany jako `children` dla Exercise i Rest oraz pod blokiem Random start (`:150-152`, `:182`).
- `src/lib/drill-signal-preview.ts:6-14,24-35` — `SIGNAL_MEANINGS`, `REST_ZERO_NOTE`, `REST_INVALID_NOTE`, `STANDBY_OFF_NOTE`, `signalAvailability(values, signal)` → `{enabled, note?}`; teksty są już gotowe do użycia w tooltipie.
- `src/components/hooks/useSignalPreview.ts`, `src/lib/drill-signal-preview-controller.ts` — kontroler (`status`: idle/initializing/playing/unavailable, `signal`) bez zmian; po błędzie `signal` = null, dlatego formularz trzyma `lastSignal` (`DrillConfigForm.tsx:84,91`).
- `src/components/ui/` nie ma `tooltip.tsx`; `radix-ui` (`^1.6.7`) zawiera `@radix-ui/react-tooltip`. Wzorzec prymitywu pod lintem kontraktu: `alert-dialog.tsx` (token `bg-overlay`, glob w `eslint.config.js:117`, test `timer-ui-contract.test.mjs:52-58`).
- Fixtures: `SignalPreviewFixtures.tsx` (7 stanów w `TimerUiPreview.tsx:1196`), formularz używany też w `CreateDrillFixtures.tsx` / `EditDrillFixtures.tsx` przez `DrillCreateForm` → `DrillConfigForm`.
- Wzór bramki wizualnej: `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs` (Playwright z `PLAYWRIGHT_PATH`, nie w CI, wyjątek lintu zawężony do jednego pliku).

## Desired End State

Każde z pól Exercise i Rest ma wiersz `flex items-center gap-2`: `Input` (rozciągnięty) + przycisk-ikona `Volume2` na końcu; pod nim podpowiedź zakresu, błąd walidacji i (tylko w razie awarii audio) `Alert`. Wiersz Random start: checkbox + etykieta + ikona na końcu, pod nim podpowiedź i ewentualny `Alert`. Przycisk ma `aria-label` („Play exercise signal" / „Play rest signal" / „Play Standby signal"), `aria-describedby` wskazujące stały (sr-only) opis, `aria-disabled` zamiast `disabled`, `aria-busy` podczas inicjalizacji. Hover/fokus (klawiatura) otwiera tooltip z opisem (oraz powodem, gdy wyłączony). Dotyk: odtwarza i pokazuje opis na 8 s (komunikat w live region); wyłączona ikona po dotknięciu/Enter nie odtwarza, tylko pokazuje powód. Weryfikacja: testy jednostkowe nowej logiki podpowiedzi, lint, `astro check`, build i zrzuty `/dev/timer-ui` 1280/390 w obu motywach.

### Key Discoveries:

- Wyłączony natywny `button` nie dostaje fokusu ani zdarzeń dotyku → `aria-disabled` + ręczne zablokowanie `onClick` jest konieczne, by powód był osiągalny (`SignalPreviewControl.tsx:41`).
- Radix Tooltip nie otwiera się na dotyk (pointerType `touch`) → potrzebny sterowany `open` z własnym timerem (8 s); stan i timer wydzielone do czystego modułu w `src/lib`, bo `npm test` uruchamia tylko `src/lib/*.test.ts`.
- Treść tooltipu nie istnieje w DOM, dopóki nie jest otwarty → `aria-describedby` musi wskazywać stały element `sr-only` z tym samym tekstem.
- `ConfigField` (`DrillConfigForm.tsx:36`) jest współdzielony z polami bez podglądu (Preparation, Repetitions) — wiersz z akcją musi być opcjonalny.
- Istniejący kontrakt tokenów: tylko klasy semantyczne; tooltip z shadcn używa `bg-foreground text-background` i strzałki `fill-foreground` — sprawdzić kontrast w obu motywach.

## What We're NOT Doing

- Zmian w kontrolerze podglądu, `DrillAudioPort`, sygnałach i ich czasach (`drill-signal-preview*.ts` poza ewentualnym nowym modułem podpowiedzi).
- Ikony odsłuchu w widoku biegu ani zmian w Preparation (zostaje stała notatka „Preparation has no sound.").
- Nowych tokenów kolorów (używamy istniejących semantycznych).
- Naprawy znanego overflow 414 px w `TimerUiPreview` (poza zakresem).
- Archiwizacji i listy testów ręcznych (do końca kolejki).

## Implementation Approach

Trzy małe fazy, każda type-safe i z własnym commitem: (1) prymityw `tooltip` pod lintem kontraktu, (2) logika podpowiedzi + nowy wiersz pola z ikoną w produkcyjnym formularzu, (3) fixtures, bramka wizualna ze zrzutami i dokumentacja. Faza 2 zmienia `SignalPreviewControl` i `DrillConfigForm` razem, bo typy propsów muszą się zgadzać w `astro check`.

## Phase 1: Prymityw tooltip pod kontraktem UI

### Overview

Dodać `src/components/ui/tooltip.tsx` ze shadcn i objąć go lintem kontraktu timera, tak jak `alert-dialog.tsx`.

### Changes Required:

#### 1. Prymityw shadcn

**File**: `src/components/ui/tooltip.tsx`

**Intent**: Dodać komponent poleceniem `npx shadcn@latest add tooltip`, a potem dopasować klasy do kontraktu (bez palet, wartości arbitralnych i literalnych kolorów).

**Contract**: Eksporty `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` (z `radix-ui`, styl „new-york"); treść w portalu, `bg-foreground text-background`, strzałka na tokenach, `z-50`. `TooltipContent` przyjmuje `className` przez `cn()`, ma `max-w-xs`, `text-balance` i `collisionPadding` ≥ 8. Strzałka bez wartości arbitralnych (`rounded-[2px]` → `rounded-xs`, `translate-y-[calc(...)]` → klasa skali, np. `-translate-y-1/2`, albo rezygnacja ze strzałki). Test kontraktu dostaje regresyjny przypadek dla `tooltip.tsx`.

#### 2. Zakres lintu i test kontraktu

**File**: `eslint.config.js`, `scripts/eslint-rules/timer-ui-contract.test.mjs`

**Intent**: Dopisać `tooltip` do globu (`eslint.config.js:117`) `src/components/ui/{input,label,checkbox,card,alert,alert-dialog}.tsx` i do listy plików sprawdzanych testem „actual ESLint configuration enforces…".

**Contract**: `eslint.lintText` dla `src/components/ui/tooltip.tsx` z klasą `accent-blue-600` zwraca błąd `timer-ui/contract`; test jest zielony przy `node --test scripts/eslint-rules/*.test.mjs`.

### Success Criteria:

#### Automated Verification:

- Plik `src/components/ui/tooltip.tsx` istnieje i eksportuje `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`
- Lint przechodzi (z `tooltip.tsx` w zakresie kontraktu): `npm run lint`
- Testy kontraktu przechodzą: `node --test scripts/eslint-rules/*.test.mjs`
- Typy i build: `npx astro sync && npx astro check && npm run build`

#### Manual Verification:

- Klasy `tooltip.tsx` używają wyłącznie tokenów semantycznych (przegląd diffu)

**Implementation Note**: Po fazie i przejściu bramek zatrzymaj się na `[FAZA-1-OK]`.

---

## Phase 2: Wiersz z ikoną odsłuchu, tooltip i dotyk

### Overview

Zastąpić pełny przycisk „Play … signal" ikoną na końcu wiersza z tooltipem, `aria-disabled`, obsługą dotyku i widocznym `Alert` błędu.

### Changes Required:

#### 1. Logika podpowiedzi (czysta, testowalna)

**File**: `src/lib/signal-preview-hint.ts` (+ `src/lib/signal-preview-hint.test.ts`)

**Intent**: Wydzielić z komponentu decyzje, które muszą być przetestowane przez `npm test`: kiedy podpowiedź jest otwarta po dotyku, jak długo i co robi kliknięcie wyłączonej ikony.

**Contract**: `createSignalHint({ setTimer, clearTimer, durationMs = 8000 })` z `subscribe/getSnapshot` (`{ open: boolean }`) oraz `showFor()` (otwiera i restartuje timer), `hide()`, `dispose()`. Pomocnik `decidePress({ enabled, pointerType })` → `{ play: boolean, showHint: boolean, announce: string | null }`: włączona + `touch` → odtwórz i pokaż; włączona + mysz/klawiatura/pusty `pointerType` → odtwórz bez wymuszania (tooltip otwierają hover/fokus); wyłączona (dowolny wskaźnik, także `""`) → nie odtwarzaj, pokaż i ogłoś powód; Standby przy wyłączonym Random start ma `enabled: true` + `note` (gra, notatka w tooltipie). Importy w module z rozszerzeniem `.ts`; `getSnapshot` zwraca stabilny obiekt; instancja tworzona w `useState`, cleanup `hide()` (odporne na StrictMode). Testy: odliczanie 8 s zamyka, ponowne dotknięcie restartuje timer, `dispose` czyści timer, `decidePress` dla kombinacji enabled × (touch/mouse/keyboard/`""`) oraz Standby off.

#### 2. Przycisk-ikona z tooltipem

**File**: `src/components/timer/SignalPreviewControl.tsx`

**Intent**: Podzielić komponent na przycisk-ikonę (do wiersza) i część „feedback" (Alert błędu oraz live region), współdzielące wyprowadzone wartości (`label`, stan aktywny/inicjalizacja/odtwarzanie/awaria, tekst opisu).

**Contract**: Przycisk: `Button variant="outline" size="icon"` z klasą dającą hitbox 44 px (`size-11`), ikona `Volume2` `aria-hidden`, `aria-label="Play {label} signal"`, `aria-disabled={!enabled}` (bez `disabled`; `onClick` ignoruje odtwarzanie, gdy wyłączony), `aria-busy` w inicjalizacji, `aria-describedby` → stały `<span id class="sr-only">` z opisem (`SIGNAL_MEANINGS[signal]` + ewentualne `availability.note`). `Tooltip z tą samą treścią. Model `open`: `open = radixOpen || hint.open`; `onOpenChange(next)` zapisuje `radixOpen` (hover/fokus/Esc/klik poza), a `false` pochodzące z click na triggerze nie gasi `hint.open`; Esc i klik poza gaszą oba stany (`hint.hide()`). `onPointerDown` zapisuje `pointerType`. Zachowanie sprawdza skrypt Playwright z `hasTouch`: tap → tooltip widoczny po 500 ms i znika po ok. 8,5 s. Live region `role="status"` istnieje w DOM przed zmianą treści: ogłasza tylko stan („Starting sound…", „Playing … signal") oraz powód wyłączenia po kliknięciu wyłączonej ikony (niezależnie od `pointerType`); pełny opis zostaje w `aria-describedby`/tooltipie, bez trzeciej kopii. Powtórzone ogłoszenie czyści tekst i ustawia go w kolejnym ticku. Błąd: `Alert variant="destructive"` z „Sound is unavailable in this browser." jako element pod wierszem (nie w tooltipie). Wyłączona ikona: `aria-disabled:opacity-50`, bez hover bg (`aria-disabled:hover:bg-transparent` lub równoważnie); bez `pointer-events-auto`. Hitbox `size-11` (44 px) to świadomy wybór: 48 px z AGENTS.md dotyczy paska sterowania biegiem; tu ikona stoi obok `Input`, wyrównanie Input↔ikona sprawdzamy na zrzutach.

#### 3. Wiersz pola w formularzu

**File**: `src/components/timer/DrillConfigForm.tsx`

**Intent**: Dodać opcjonalną akcję do `ConfigField` i przenieść podgląd z `children` na koniec wiersza; Standby wstawić na koniec wiersza Random start.

**Contract**: `ConfigField` dostaje `action?: ReactNode` i `feedback?: ReactNode`; gdy `action` jest podane, `Input` i akcja są w `div.flex.items-center.gap-2` (`Input` z `flex-1 min-w-0`), a `feedback` (Alert) renderowany jest pod podpowiedzią i błędem. Wiersz Random start: `Checkbox` + `Label` po lewej, ikona po prawej (`justify-between`). `TooltipProvider` raz na poziomie formularza. Pola Preparation i Repetitions bez zmian (Preparation zachowuje `PREPARATION_NO_SOUND`).

### Success Criteria:

#### Automated Verification:

- Nowe testy logiki podpowiedzi i istniejące przechodzą: `npm test`
- Lint, typy, build: `npm run lint && npx astro check && npm run build`
- Testy kontraktu: `node --test scripts/eslint-rules/*.test.mjs`

#### Manual Verification:

- Na `/create` ikona jest na końcu wiersza Exercise/Rest/Random start, bez pełnych akapitów opisu pod polami
- Hover i fokus klawiaturą pokazują opis; wyłączona ikona (Rest 0:00 / niepoprawny) pokazuje powód i nie odtwarza

---

## Phase 3: Fixtures, bramka wizualna i dokumentacja

### Overview

Rozszerzyć produkcyjne fixtures o nowe stany i potwierdzić wygląd skryptem Playwright w 7 stanach, jasny/ciemny, 1280/390.

### Changes Required:

#### 1. Fixtures

**File**: `src/components/timer/SignalPreviewFixtures.tsx`, `src/components/timer/CreateDrillFixtures.tsx`, `src/components/timer/EditDrillFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Stany: default, hover, focus-visible, disabled (powód w tooltipie), error (Alert pod wierszem), loading, playing, a dodatkowo tooltip po dotyku i długi opis Standby przy 390 px; hover/focus/tap wymusza skrypt Playwright (bez propu otwierającego tooltip). Opisy w `SignalPreviewFixtures.tsx` (zdania o „Play button", „visible reason", „off note") aktualizowane już w fazie 2. Zachować `data-testid`/`data-visual-state` używane przez bramkę.

**Contract**: Bez zmian w komponentach produkcyjnych pod podgląd. Tekst opisu `Edit`/`Create` używa tego samego `DrillConfigForm`.

#### 2. Skrypt bramki wizualnej i zrzuty

**File**: `context/changes/signal-preview-icon/screenshots/signal-preview-visual-gate.mjs`, `eslint.config.js`

**Intent**: Skrypt Playwright wzorowany na `run-view-visual-gate.mjs` (`PLAYWRIGHT_PATH`), który robi zrzuty stanów w obu motywach i szerokościach 1280/390 oraz sprawdza: brak poziomego overflow (`scrollWidth <= clientWidth`), hitbox ≥ 44 px, `getBoundingClientRect()` otwartego tooltipu w viewport (`left >= 0`, `right <= innerWidth`) przy 390 px dla hover/focus i tap w obu motywach, oraz zachowanie przez `data-evidence="cues"`: klik i Enter/Space na ikonie Rest w `signal-disabled-zero` → `cues` zostaje `none` i tooltip pokazuje powód; klik na włączonej → `cues` rośnie; `aria-disabled="true"` bez `disabled`; `aria-describedby` wskazuje istniejący element z tekstem; tap na włączonej → tooltip widoczny po 500 ms.

**Contract**: Wyjątek lintu zawężony do tego jednego pliku (dopisany obok istniejącego w `globalIgnores`). Skrypt nie jest częścią CI.

#### 3. Dokumentacja reguły

**File**: `AGENTS.md`

**Intent**: Jedno zdanie w sekcji UI: odsłuch sygnału to ikona w wierszu z tooltipem (`aria-disabled`, nie `disabled`), fixtures `SignalPreviewFixtures.tsx`, zrzuty w `context/changes/signal-preview-icon/screenshots/`.

**Contract**: Bez zmian innych reguł; zachować EOL pliku.

### Success Criteria:

#### Automated Verification:

- Pełna bramka: `npx astro sync && npm run lint && npm test && node --test scripts/eslint-rules/*.test.mjs && npx astro check && npm run build`
- Skrypt wizualny kończy się kodem 0 (overflow, hitbox, tooltip w viewport, zachowanie wyłączonej ikony i dotyku): `npm run dev` + `PLAYWRIGHT_PATH=<path> node context/changes/signal-preview-icon/screenshots/signal-preview-visual-gate.mjs`

#### Manual Verification:

- Zrzuty 7 stanów × jasny/ciemny × 1280/390 zapisane w `context/changes/signal-preview-icon/screenshots/` i przejrzane (kontrast tooltipu w ciemnym motywie, brak przycięć)

---

## Testing Strategy

### Unit Tests:

- `signal-preview-hint.test.ts`: timer 8 s, restart, dispose, `decidePress` (włączona/wyłączona × touch/mouse/keyboard/pusty, Standby off).
- Istniejące `drill-signal-preview*.test.ts` bez zmian.

### Integration Tests:

- Test kontraktu lintu obejmuje `tooltip.tsx`.
- Smoke lokalny niemożliwy (brak Mailpit), potwierdza go CI.

### Manual Testing Steps:

1. `/create`: najechać i sfokusować ikonę, odczytać opis; wyłączyć Rest (0:00) i sprawdzić powód.
2. Emulacja dotyku 390 px: dotknięcie odtwarza i pokazuje opis 8 s; dotknięcie wyłączonej tylko pokazuje powód.
3. Wymusić błąd audio (fixture error): `Alert` widoczny pod wierszem.

## Performance Considerations

Brak istotnych; jeden `TooltipProvider` na formularz, timer czyszczony przy unmount.

## Migration Notes

Brak migracji bazy danych i zmian API.

## References

- Roadmap: `context/foundation/roadmap.md` (S-19), `context/foundation/ux-fixes-plan.md` (S-19)
- PRD: FR-004, FR-019 (`context/foundation/prd.md`)
- Wzór prymitywu pod lintem: `src/components/ui/alert-dialog.tsx`, `eslint.config.js:117`
- Wzór bramki wizualnej: `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prymityw tooltip pod kontraktem UI

#### Automated

- [ ] 1.1 `tooltip.tsx` istnieje i eksportuje cztery części
- [ ] 1.2 Lint przechodzi z `tooltip.tsx` w zakresie kontraktu
- [ ] 1.3 Testy kontraktu przechodzą
- [ ] 1.4 `astro sync`, `astro check` i build przechodzą

#### Manual

- [ ] 1.5 Klasy `tooltip.tsx` używają tylko tokenów semantycznych

### Phase 2: Wiersz z ikoną odsłuchu, tooltip i dotyk

#### Automated

- [ ] 2.1 Testy logiki podpowiedzi i istniejące testy przechodzą
- [ ] 2.2 Lint, typy i build przechodzą
- [ ] 2.3 Testy kontraktu przechodzą

#### Manual

- [ ] 2.4 Ikona jest na końcu wiersza Exercise/Rest/Random start, bez pełnych akapitów pod polami
- [ ] 2.5 Hover i fokus pokazują opis; wyłączona ikona pokazuje powód i nie odtwarza

### Phase 3: Fixtures, bramka wizualna i dokumentacja

#### Automated

- [ ] 3.1 Pełna bramka (sync, lint, test, kontrakt, check, build) przechodzi
- [ ] 3.2 Skrypt wizualny kończy się kodem 0

#### Manual

- [ ] 3.3 Zrzuty 7 stanów w obu motywach i szerokościach przejrzane
