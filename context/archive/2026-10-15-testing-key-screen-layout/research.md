---
date: 2026-10-15T00:00:00+02:00
researcher: Claude Opus 5.5 (dla Jan Kalwoda)
git_commit: 72df662
branch: feature/m3l4
repository: JanKalwoda/10xDevs4
topic: "Ryzyko #7 (test-plan Phase 4): overflow, pola trafienia, przykrycie i jedno kliknięcie = jedna akcja na kluczowych ekranach przy 1280/390 px; które bramki §5 domknąć w CI"
tags: [research, e2e, playwright, layout, tap-targets, ci, quality-gates]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude Opus 5.5
---

# Research: ryzyko #7 i domknięcie bramek CI (Phase 4)

**Date**: 2026-10-15 (czas lokalny, +02:00; godzina nieznana)
**Researcher**: Claude Opus 5.5 (dla Jan Kalwoda)
**Git Commit**: 72df662 (drzewo z niezacommitowaną zmianą `context/foundation/test-plan.md` — wiersz §3 Phase 4 → `change opened`)
**Branch**: feature/m3l4
**Repository**: JanKalwoda/10xDevs4

## Research Question

Zweryfikuj ryzyko #7 z `context/foundation/test-plan.md` (Phase 4): brak poziomego scrolla i mieszczenie się pól/przycisków przy 1280 i 390 px, pole trafienia ≥ 44 px przy coarse pointer, brak przykrycia, jedno kliknięcie = jedna akcja dla Start, Pause/Resume, Cancel, Restart, strzałek, Save, Delete; ustal, które bramki z §5 trzeba domknąć w CI.

## Summary

1. **Overflow (1280/390):** w kodzie nie znaleziono konstrukcji, która dziś wymusza poziomy scroll na sprawdzonych ekranach; ostatni ręczny przebieg bramki S-22 (2026-10-11) zmierzył `scrollWidth == clientWidth == 390` na `/`, `/create`, `/{id}/edit`, `/{id}`, `/timers` i w widoku biegu (tylko Preparation), przy 390 px i pointerach fine/coarse. **Szerokość 1280 px na widokach produkcyjnych nie była nigdy mierzona** (tylko fixtures `/dev/timer-ui`). Żaden pomiar nie działa w CI.
2. **Pole trafienia ≥ 44 px przy coarse:** spełniają je tylko pasek biegu (Cancel, Restart, Pause/Resume: 48×48), strzałki przy coarse (44×44), ikony głośnika (44×44), ramki pól (44 px) i karty listy `/timers`. **Start (na `/` i `/{id}`), Save timer, Save changes, Edit timer, Delete timer, przyciski Delete/Cancel w dialogu mają 36 px** (`size: default` = `h-9`, `src/components/ui/button.tsx:21`) i żaden wariant nie ma klasy `pointer-coarse:`. Test zgodny z wyrocznią §2 #7 będzie dziś **czerwony** dla tych 6 kontrolek (+ Start na drugim ekranie) — to sygnał, a nie powód do osłabiania asercji (CLAUDE.md).
3. **Przykrycie:** nigdzie nie jest sprawdzane (brak `elementFromPoint` w `context/` i `tests/`). Potencjalne źródła: sticky top bar `z-50`, tooltip głośnika (otwarty 8 s po tapnięciu), overlay dialogu. Playwright daje gotowy sprawdzian: `click/tap({ trial: true })` wykonuje tylko kontrole actionability, w tym „Receives Events” (`context/docs/playwright.md`).
4. **Jedno kliknięcie = jedna akcja:** pojedyncze kliknięcie każdej z wymienionych kontrolek wywołuje jedną akcję wg kodu; strzałki są już pokryte w e2e (fine) i w ręcznej bramce (coarse). Natomiast **szybki podwójny klik/tap** daje dwie akcje dla Start (brak stanu pending), Restart (nowy bieg ma przycisk w tym samym miejscu) i Pause (drugi klik trafia w Resume). Save, Save changes, Delete confirm, Cancel i Resume mają blokadę. Czy podwójne dotknięcie mieści się w ryzyku #7 („odporne na przypadkowe dotknięcia”, PRD §NFR) — decyzja produktowa dla planu.
5. **Bramki §5:** do domknięcia jest wiersz „layout i tap targets (1280 / 390 px), CI on PR, required after Phase 4” — dziś niepodłączony nigdzie. Dodatkowo: (a) **ruleset gałęzi `main` nie wymaga żadnego status checku** (tylko PR i brak force-push), więc „required” w §5 jest dziś konwencją, nie wymuszeniem; (b) hook po edycji jest podłączony (§5 można zmienić na „wired”); (c) README opisuje pre-push, który jest wyłączony; (d) dwa kroki CI (testy reguł ESLint + dowód hooków, kontrola 404 `/dev/timer-ui`) nie mają wiersza w §5.

## Detailed Findings

### A. Wyrocznia (PRD, test-plan)

- PRD §NFR: „bez konieczności przewijania w poziomie … sterowanie jest wygodne w użyciu i odporne na przypadkowe dotknięcia … sterowanie jest łatwo dostępne” (`context/foundation/prd.md:166`); testy odbiorowe w jednej przeglądarce komputera i jednej telefonu (`prd.md:165`).
- PRD podaje literał 44 px tylko dla strzałek: coarse — dwa przyciski 44 px obok siebie (▼ ▲); komputer — kolumna ▲ nad ▼ o wysokości wiersza 44 px; jedno kliknięcie lub dotknięcie = dokładnie 1 (FR-020, `prd.md:153`).
- Próg „≥ 44 px przy dotyku” dla Start, Pause/Resume, Cancel, Restart, strzałek, Save, Delete pochodzi z test-planu (§2 Risk Response #7, `context/foundation/test-plan.md:62`), nie z PRD. CLAUDE.md ustala 48 px (size-12) dla trzech przycisków paska biegu.
- Wyjątek udokumentowany: strzałki przy fine pointer mają ok. 21 px i korzystają z wyjątku „Equivalent” WCAG 2.5.8 (CLAUDE.md, sekcja Config stepper; `context/archive/2026-10-11-ux-fixes-round-3/plan.md:30`). Test 44 px musi więc emulować coarse primary pointer.

### B. Kontrolki, nazwy dostępne i rozmiary (stan kodu)

Rozmiary przycisku: `default` `h-9` = 36 px, `sm` `h-8` = 32 px, `lg` `h-10` = 40 px, `icon` `size-9` = 36 px (`src/components/ui/button.tsx:20-25`); baza ma `whitespace-nowrap` (`button.tsx:8`).

| Ekran        | Kontrolka                                  | Nazwa dostępna (lokator)                                                                                                                                | Fine      | Coarse                                  | ≥ 44 coarse? |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- | ------------ |
| `/`          | Pola Preparation/Exercise/Rest/Repetitions | `getByLabel("Preparation")` itd.; ramka `InputGroup h-11` (`src/components/timer/DrillConfigForm.tsx:72`)                                               | 44        | 44                                      | tak          |
| `/`          | Strzałki                                   | `button` „Increase exercise by 1 second”, „Decrease repetitions by 1” (`src/components/timer/ConfigStepper.tsx:81`), `aria-disabled` na granicy (`:83`) | ok. 32×21 | 44×44 (`pointer-coarse:size-11`, `:21`) | tak          |
| `/`          | Głośnik                                    | „Play exercise signal” itd. (`src/components/timer/SignalPreviewControl.tsx:80`), `size-11` (`:79`)                                                     | 44        | 44                                      | tak          |
| `/`          | Start                                      | `button` „Start” (`DrillConfigForm.tsx:247`), `w-full`, `disabled={pending}`                                                                            | 36        | 36                                      | **nie**      |
| bieg         | Cancel / Restart / Pause↔Resume            | „Cancel drill”, „Restart drill”, „Pause drill” / „Resume drill” (`src/components/timer/DrillTimerView.tsx:43,48,66,70`), `size-12`                      | 48        | 48                                      | tak          |
| `/create`    | Save                                       | „Save timer” → „Saving…” (`src/components/timer/DrillCreateForm.tsx:45,118`)                                                                            | 36        | 36                                      | **nie**      |
| `/{id}`      | Start, Edit timer (link), Delete timer     | `src/components/timer/SavedDrillDetails.tsx:23-34`, `src/components/timer/DeleteDrillDialog.tsx:59`                                                     | 36        | 36                                      | **nie**      |
| dialog       | Delete / Cancel                            | `alertdialog` „Delete timer?” (`DeleteDrillDialog.tsx:65`), przyciski `:86,101`                                                                         | 36        | 36                                      | **nie**      |
| `/{id}/edit` | Save changes                               | „Save changes” (`src/components/timer/DrillEditApp.tsx:54`)                                                                                             | 36        | 36                                      | **nie**      |
| `/timers`    | karty timerów (linki)                      | nazwa + parametry (`src/components/timer/SavedDrillList.tsx:26-31`), `p-4`                                                                              | ok. 78    | ok. 78                                  | tak          |

Poza listą z pytania (informacyjnie): checkbox „Random start” 16 px (`src/components/ui/checkbox.tsx:11`), linki „Back to …”, „Create a timer” i przełącznik motywu 36 px, linki top baru 32 px (`src/components/AppTopBar.astro:25-52`).

### C. Jedno kliknięcie = jedna akcja

- **Strzałki:** krok tylko z `click`, `pointerdown` uzbraja powtarzanie, klik po powtarzaniu jest pomijany (`ConfigStepper.tsx:55-58`, `src/lib/drill-step-press.ts`). Pokrycie: e2e `tests/e2e/config-form-stepper.spec.ts` (fine), ręczna bramka S-22 (fine, coarse, fine + touch; `context/archive/2026-10-11-ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs:107-173`). **Coarse/tap nie jest w CI** (odłożone z Phase 3: `context/changes/testing-critical-path-browser-smoke/plan.md:31`).
- **Start (`/`, `/{id}`):** `handleSubmit` wywołuje `submitDrillConfig` bez stanu pending (`DrillConfigForm.tsx:165-170`); `start` w `DrillApp` od razu tworzy bieg (`src/components/timer/DrillApp.tsx:113-116`). Pojedynczy klik = jeden bieg. Drugi klik podwójnego kliknięcia trafia w to, co pojawi się pod wskaźnikiem (karta jest wyśrodkowana, `DrillApp.tsx:119`) — nie zweryfikowano w przeglądarce, które to przyciski.
- **Cancel / Restart:** synchroniczny zatrzask `retireIntent` (`src/components/timer/DrillTimer.tsx:124-139`) + `identityState.retire` (`DrillApp.tsx:100-111`). Drugi klik na wycofanym biegu jest ignorowany; ale Restart montuje nowy bieg z kluczem (`DrillApp.tsx:131`), którego przycisk Restart jest w tym samym miejscu — podwójny klik = dwa restarty (wnioskowanie z kodu, nie zaobserwowane).
- **Pause / Resume:** ten sam slot (`DrillTimerView.tsx:52-73`); `pause` nie ma zatrzasku (`DrillTimer.tsx:141-147`), więc podwójny klik = pauza + wznowienie (wnioskowanie). `resume` synchronicznie ustawia pending (`DrillTimer.tsx:149-155`), co renderuje wyłączony przycisk „Resume is loading”.
- **Save / Save changes:** kontroler ignoruje drugi zapis w trakcie (`src/lib/drill-create-controller.ts:95`), przycisk `disabled` + `aria-busy` (`DrillConfigForm.tsx:247`).
- **Delete confirm:** `if (deleting) return` (`DeleteDrillDialog.tsx:97`), kontroler (`src/lib/drill-delete-controller.ts:52`), `aria-disabled` + `pointer-events-none` (`DeleteDrillDialog.tsx:92-93`).

### D. Przykrycie

- Sticky top bar `sticky top-0 z-50` (`AppTopBar.astro:21`), ok. 53 px wysokości: element przewinięty pod górną krawędź może być przykryty.
- Tooltip głośnika w portalu `z-50` (`src/components/ui/tooltip.tsx:25`), po tapnięciu otwarty 8 s (`SignalPreviewControl.tsx:71,93-99`, `src/lib/signal-preview-hint.ts`) — może przykryć pole nad wierszem.
- Overlay dialogu `fixed inset-0 z-50` (`src/components/ui/alert-dialog.tsx:24`) — zamierzone przykrycie strony; przyciski dialogu muszą być trafialne.
- Slot ostrzeżeń `min-h-20` i wiersz statusu `min-h-10` są pod paskiem (`DrillTimerView.tsx:76,91`), nie nachodzą na niego.
- Mechanizm sprawdzenia bez CSS: `locator.click({ trial: true })` / `tap({ trial: true })` sprawdza „Receives Events” (czy inny element nie przejmie kliknięcia w punkcie akcji) bez wykonania akcji; `toBeInViewport({ ratio: 1 })` — cały element w oknie (`context/docs/playwright.md`).

### E. Overflow przy 390 px — konstrukcje

- Budżet szerokości: `px-4` main + `max-w-md` karta + `px-6` treść ≈ 310 px; wiersz pola: grupa `flex-1 min-w-0` + 8 px + 44 px slot (`DrillConfigForm.tsx:71-105`).
- Długie nazwy obsłużone: nagłówek `/{id}` `wrap-anywhere` (`DrillApp.tsx:55`), dialog (`DeleteDrillDialog.tsx:67`), karty `break-words` (`SavedDrillList.tsx:30`), e-mail w top barze `truncate` (`AppTopBar.astro:18,26`), parametry `flex-wrap` (`SavedDrillDetails.tsx:18`).
- Nieobsłużone wprost: alert `Saved "{name}".` bez klasy zawijania (`DrillCreateForm.tsx:107-111`; `src/components/ui/alert.tsx` nie ma `wrap`/`break`). Czy ten stan jest osiągalny po przekierowaniu zapisu na `/{id}` — nie sprawdzono.

### F. Istniejące ręczne bramki — co można przenieść do CI

- Cztery skrypty (S-18 `run-view-visual-gate.mjs`, S-19 `signal-preview-visual-gate.mjs`, S-21 `ux-fixes-round-2-visual-gate.mjs`, S-22 `ux-fixes-round-3-visual-gate.mjs`) działają na `npm run dev`, ładują Playwright z `PLAYWRIGHT_PATH` i nie są w CI.
- Do przeniesienia: predykat strony `documentElement.scrollWidth <= clientWidth` (S-22 `:81, 305`), lista winowajców `rect.right > vw + 0.5` przy błędzie (`:450-457`), macierz wskaźników fine / coarse (`hasTouch` + `isMobile`) / fine + touch (CDP) z kontrolą `matchMedia("(pointer: fine)")` (`:34-38, 91-96`), tolerancja 0,5 px.
- Do zastąpienia: logowanie przez `generate_link` z kluczem service-role (zastąpić projektem `setup` i `storageState`), `waitForTimeout(1500)` i oczekiwanie na `__reactProps*` (zastąpić `waitForHydration` i stanami), selektory CSS/XPath/testid (`input[name=…]`, `ancestor::*[@data-slot='input-group']`, `[data-testid=stepper-*]`) — zakazane w e2e.
- Luki ręcznych bramek: brak pomiaru przykrycia, brak rozmiaru Cancel/Restart/Pause i Save/Delete, brak 1280 px na widokach produkcyjnych, widok biegu tylko w Preparation, dialog Delete nigdy nie otwierany.

### G. Konfiguracja Playwright i CI

- `playwright.config.ts:26-33`: projekty `setup` i `chromium` (`devices["Desktop Chrome"]`, viewport 1280×720 wg deskryptora), `retries` 2 w CI, `workers` 1 w CI (`:18-19`); brak projektu 390/coarse. W `tests/e2e/` brak `boundingBox`, `viewport`, `hasTouch`, `isMobile`.
- Projekt coarse: `viewport {390, 844}`, `hasTouch: true`, `isMobile: true` + `storageState` i `dependencies: ["setup"]`, zawężony `testMatch` do specyfikacji geometrii (inaczej cały zestaw biegnie dwa razy przy `workers: 1`). W Chromium `hasTouch` daje coarse primary pointer (CLAUDE.md, Config stepper). Wariantu „fine primary + touch” nie da się ustawić opcją projektu (S-22 używa CDP).
- Logowanie: dodatkowe projekty korzystają z jednego `storageState` z `setup` — bez dodatkowej poczty (budżet 30/5 min).
- Czas: ostatni zmierzony krok e2e w CI to `5 passed (50.5s)` (`context/changes/testing-critical-path-browser-smoke/research.md:28,43`); job `smoke` ma `timeout-minutes: 30` (`.github/workflows/ci.yml:28`).

### H. Bramki §5 — stan

| Bramka §5                         | Gdzie                                                                            | Stan                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| lint + `astro check`              | `ci.yml:20,23`                                                                   | wired                                                                        |
| unit / run-level (`npm test`)     | `ci.yml:21`                                                                      | wired                                                                        |
| pgTAP                             | `ci.yml:45-51`                                                                   | wired                                                                        |
| HTTP smoke auth                   | `ci.yml:64-66`                                                                   | wired                                                                        |
| integration                       | `ci.yml:67-69`                                                                   | wired                                                                        |
| e2e krytyczne przepływy           | `ci.yml:82-92`, raport `:93-101`                                                 | wired                                                                        |
| **layout i tap targets 1280/390** | —                                                                                | **brak — do domknięcia w Phase 4**                                           |
| multimodal review                 | —                                                                                | optional, poza CI (zgodnie z §5)                                             |
| post-edit hook                    | `.claude/settings.json` (`PostToolUse` lint + related tests, `Stop` end-of-turn) | podłączony; §5 mówi „recommended after Phase 2” → do aktualizacji na „wired” |
| mutation                          | lokalnie                                                                         | optional (zgodnie z §5)                                                      |
| pre-prod smoke                    | `ci.yml:128-132`                                                                 | wired                                                                        |

Dodatkowe ustalenia:

- **Wymuszenie bramek na PR:** gałąź `main` nie ma branch protection (`gh api …/branches/main/protection` → 404 „Branch not protected”); jedyny ruleset „Disable direct commits to main” (id 23709389) zawiera reguły `non_fast_forward` i `pull_request` z `required_approving_review_count: 0`, **bez `required_status_checks`** (odczyt `gh api …/rulesets/23709389`, 2026-10-15). Czerwony `ci`/`smoke` nie blokuje dziś merge'a.
- Kroki CI bez wiersza w §5: `node --test scripts/eslint-rules/*.test.mjs scripts/agent-hooks.test.mjs` (`ci.yml:22`) oraz kontrola 404 `/dev/timer-ui` na podglądzie (`ci.yml:70-72`).
- `.husky/pre-push` ma obie linie zakomentowane (`.husky/pre-push:1-2`, commit a9eb5ee), a README nadal opisuje pre-push z `astro check` i `test:hooks` (`README.md:67`) — rozbieżność dokumentacji; nie jest bramką CI.
- Wpisy test-planu do uzupełnienia po fazie: wiersz stosu „layout / tap targets — none yet” (`test-plan.md:94`), §6.5 „TBD” (`:225`), §6.6 notatka fazy.

## Code References

- `src/components/ui/button.tsx:8,20-25` — warianty rozmiaru (36/32/40/36 px), brak `pointer-coarse:`
- `src/components/timer/ConfigStepper.tsx:21,55-58,81,83` — strzałki 44 px przy coarse, krok z `click`, nazwy, `aria-disabled`
- `src/components/timer/DrillConfigForm.tsx:72,165-170,247` — ramka 44 px, submit bez pending, przycisk Start/Save
- `src/components/timer/DrillTimerView.tsx:43-73,76,91` — pasek 48 px, slot Pause/Resume, wiersze statusu i ostrzeżeń
- `src/components/timer/DrillTimer.tsx:124-155` — zatrzask Cancel/Restart, Pause bez zatrzasku, Resume pending
- `src/components/timer/DrillApp.tsx:100-119,131` — retire/restart/start, karta wyśrodkowana, keyed run
- `src/components/timer/DeleteDrillDialog.tsx:51,59,65,86-101` — dialog, potrójna ochrona Delete
- `src/lib/drill-create-controller.ts:95`, `src/lib/drill-delete-controller.ts:52` — ochrona zapisu i usunięcia
- `src/components/AppTopBar.astro:21` — sticky `z-50`
- `playwright.config.ts:18-33` — retries/workers, projekty
- `.github/workflows/ci.yml:20-23,45-101,128-132` — kroki bramek
- `context/archive/2026-10-11-ux-fixes-round-3/screenshots/ux-fixes-round-3-visual-gate.mjs:34-38,81,91-96,107-173,305,450-457` — techniki pomiaru do przeniesienia

## Architecture Insights

- Warstwą najtańszą z realnym sygnałem jest e2e Playwright na podglądzie produkcyjnym (geometria wymaga prawdziwego silnika layoutu); `node --test` nie ma DOM (§6.3). Pomiary deterministyczne (`boundingBox`, `scrollWidth`, `trial` actionability) wystarczają; snapshot pikselowy i model wizyjny nie są potrzebne do overflow/rozmiaru/przykrycia (zgodnie z §2 #7 „Anti-pattern”).
- Lokatory: wszystkie kontrolki z pytania mają unikalne nazwy dostępne (tabela B), więc pomiar per kontrolka obejdzie się bez CSS. Pomiar strony (`scrollWidth`) to `page.evaluate` na `document.documentElement` — nie jest selektorem DOM, ale plan powinien to nazwać jako wyjątek od reguły lokatorów.
- Koszt: jeden nowy projekt coarse ograniczony `testMatch` + 1280 w istniejącym `chromium`; bez nowych logowań.

## Historical Context (from prior changes)

- `context/archive/2026-10-11-ux-fixes-round-3/` — S-22: 0 z 1551 kontroli nieudanych na 2026-10-11 (`ux-fixes-round-3-checks.json`); obecny stan potwierdzony dla 390 px na widokach produkcyjnych (supported). Twierdzenie o 1280 px na widokach produkcyjnych — brak pomiaru (not covered).
- `context/archive/2026-10-10-ux-fixes-round-2/` — wcześniejsza macierz `mouse-touch` (`hasTouch` bez `isMobile`) daje coarse primary w Chromium; dlatego S-22 przeszedł na CDP dla fine + touch (supported przez CLAUDE.md).
- `context/changes/testing-critical-path-browser-smoke/plan.md:31`, `plan-brief.md:24,42`, `research.md:131` — coarse/touch i geometria strzałek odłożone do Phase 4.
- `context/changes/testing-critical-path-browser-smoke/reviews/impl-review.md` F2 (flake 1 s preparation w `saved-timer-start.spec.ts`) — naprawiony w c84eaa4 (supported).

## Related Research

- `context/changes/testing-critical-path-browser-smoke/research.md`
- `context/docs/playwright.md` (pobrane w tej zmianie)

## Open Questions

1. **Próg 44 px dla Start/Save/Delete (decyzja produktowa).** Wyrocznia §2 #7 wymaga ≥ 44 px przy dotyku; kod daje 36 px dla 6 kontrolek. Plan musi wybrać: (a) zmiana UI w tej fazie (np. większy rozmiar przy `pointer-coarse:`, z bramką wizualną `/dev/timer-ui` wg CLAUDE.md) i test zielony po poprawce, (b) test czerwony jako znany błąd z osobną zmianą naprawczą (Lekcja 5). Osłabienie asercji jest niedozwolone.
2. **Podwójne dotknięcie** Start, Restart i Pause — czy mieści się w ryzyku #7 („odporne na przypadkowe dotknięcia”)? Jeśli tak, test podwójnego kliknięcia będzie czerwony (wnioskowanie z kodu, niezweryfikowane w przeglądarce).
3. **Wymuszenie checków na PR:** dodanie `required_status_checks` (`ci`, `smoke`) do rulesetu `main` to zmiana ustawień repozytorium na GitHubie — wymaga zgody użytkownika.
4. **Zakres stanów biegu** do pomiaru (Preparation / Exercise / Rest / Standby / pauza / ukończony) i **wariant fine + touch** (CDP) w CI — czy potrzebny, skoro PRD wiąże układ z głównym wskaźnikiem.
5. Osiągalność alertu `Saved "{name}".` z długą nazwą bez spacji (możliwy overflow) — niesprawdzone.
