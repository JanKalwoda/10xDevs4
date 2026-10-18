---
date: 2026-10-18T16:05:36+02:00
researcher: Claude Opus 5.5 (Claude Code), dla Jan Kalwoda
git_commit: b1c8cdb6b6134bc0cdecc84ba62699f871079c33
branch: fix/double-tap-run-controls
repository: JanKalwoda/10xDevs4
topic: "Dlaczego podwójne kliknięcie/dotknięcie Restart i Pause wykonuje dwie akcje i jak to naprawić bez łamania kontraktu paska biegu"
tags: [research, timer, run-controls, double-tap, DrillTimer, DrillApp, DrillTimerView, e2e]
status: complete
last_updated: 2026-10-18
last_updated_by: Claude Opus 5.5 (Claude Code)
---

# Research: podwójne kliknięcie/dotknięcie Restart i Pause

**Date**: 2026-10-18T16:05:36+02:00
**Researcher**: Claude Opus 5.5 (Claude Code), dla Jan Kalwoda
**Git Commit**: b1c8cdb6b6134bc0cdecc84ba62699f871079c33
**Branch**: fix/double-tap-run-controls
**Repository**: JanKalwoda/10xDevs4

## Research Question

`/10x-research fix-double-tap-run-controls`: według `change.md` podwójny klik (projekt `chromium`) i dwa dotknięcia w jednym punkcie (projekt `mobile-coarse`) na Restart drill tworzą dwa nowe biegi, a na Pause drill wstrzymują i od razu wznawiają bieg. Ustalić mechanizm w kodzie, dlaczego Start/Save/Delete są odporne, jakie są ograniczenia (kontrakt paska biegu w CLAUDE.md, istniejące testy) oraz które podejścia do naprawy są wykonalne.

## Summary

1. **Mechanizm (potwierdzony w kodzie).** Oba błędy biorą się z tego samego: drugi klik/dotknięcie trafia w **inny, nowo wyrenderowany przycisk w tym samym miejscu**, który ma własną, poprawną obsługę pojedynczej akcji.
    - Restart: pierwszy klik wycofuje bieg (`retireIntent`, `src/components/timer/DrillTimer.tsx:125-140`) i `DrillApp.restart` tworzy nowy bieg z nową tożsamością (`src/components/timer/DrillApp.tsx:107-111`). `DrillTimer` ma `key={activeRun.identity}` (`DrillApp.tsx:131`), więc montuje się nowa instancja z **świeżym** `retiredIntentRef = false` (`DrillTimer.tsx:38`) i nowym przyciskiem Restart w tym samym slocie (`DrillTimerView.tsx:47-51`). Drugi klik jest więc legalnym, pierwszym Restartem nowego biegu. Zatrzask `retireIntent` i `identityState.retire` (`src/lib/drill-run-identity.ts:22-26`) działają poprawnie, ale dla starego biegu.
    - Pause: `pause()` nie ma zatrzasku i ustawia bieg w pauzę (`DrillTimer.tsx:142-148`). Prawy slot renderuje wtedy przycisk Resume w tym samym miejscu (`DrillTimerView.tsx:52-73`), a drugi klik wywołuje `resume()` (`DrillTimer.tsx:150-168`).
2. **Start, Save i Delete są odporne z różnych powodów.** Save i Delete mają stan „w toku” (`saving`/`deleting`), który blokuje drugi klik. Delete dodatkowo używa `aria-disabled` i `pointer-events-none` (`src/components/timer/DeleteDrillDialog.tsx:86-101`). Start **nie ma** zatrzasku (`src/components/timer/DrillConfigForm.tsx:165-170`). Test „a double Start” jest zielony, bo formularz znika, a pod wskaźnikiem nie pojawia się Restart ani Pause (wnioskowanie z geometrii, niezweryfikowane pomiarem). To ochrona przypadkowa.
3. **`event.detail` nie wystarczy jako jedyny dyskryminator.** Dla myszy `click.detail` to licznik kliknięć (MDN). Dla dotyku iOS Safari ma zawsze `1` (WebKit bug 298652, mdn/browser-compat-data#30234), a emulacja dotyku w Chrome DevTools też zawsze `1` (Leaflet#7012). Projekt `mobile-coarse` używa właśnie emulacji dotyku Chromium (`playwright.config.ts:38`). Rozwiązanie musi opierać się na **czasie od poprzedniej akcji paska**, a nie na liczniku kliknięć.
4. **Ciche ignorowanie w oknie czasowym zepsułoby istniejące testy.** `tests/e2e/run-audio-signals.spec.ts:86-87` klika Pause, a zaraz potem `resume.click()`, bez oczekiwania na stan. Podobnie `key-screen-single-action.spec.ts:101-105` (Pause→Resume) i `:131` (Restart tuż po starcie). Jeśli drugi przycisk w oknie będzie widocznie zablokowany przez `aria-disabled="true"`, `locator.click()`/`tap()` poczeka, aż blokada minie (Playwright actionability → Enabled, `context/docs/playwright.md` zapytanie 5). Wtedy te testy nie wymagają zmian. Natomiast `page.touchscreen.tap` i drugi klik `dblclick()` nie czekają na Enabled, więc testy podwójnej akcji naprawdę sprawdzą blokadę.
5. **Kolizja z kontraktem CLAUDE.md wymaga decyzji produktowej.** „Keep Restart enabled during initialization, active, paused, and pending Resume” i „Keep Cancel enabled…”. Krótka blokada Restart nowego biegu tuż po jego utworzeniu formalnie łamie „enabled during initialization”. Cancel nie może być blokowany.

## Detailed Findings

### Restart: drugi klik trafia w nowy bieg

- `DrillTimer.restart` → `retireIntent()` ustawia `retiredIntentRef.current = true`, woła `disposeRef.current()` i dopiero potem `onRestart()` (`src/components/timer/DrillTimer.tsx:125-140`). Na tej instancji drugi `restart` zwraca od razu (`:126`).
- `DrillApp.restart` sprawdza `identityState.retire(activeRun.identity)` i tworzy `createActiveRun(activeRun.configuration)`, czyli nową tożsamość przez `identityState.begin()`, nowe audio i nowy Wake Lock w tym samym geście (`src/components/timer/DrillApp.tsx:74-91,107-111`).
- `<DrillTimer key={activeRun.identity} …>` (`DrillApp.tsx:130-138`) wymusza nowy montaż, a `retiredIntentRef` nowej instancji startuje od `false` (`DrillTimer.tsx:38`).
- Przycisk Restart jest zawsze renderowany w środkowym slocie siatki 3-kolumnowej (`src/components/timer/DrillTimerView.tsx:41,47-51`), także podczas inicjalizacji. Pozycja na ekranie się nie zmienia, bo pasek leży pod sekcjami o stałej wysokości (CLAUDE.md, „Run view layout”).
- Wniosek: przy 2 aktywacjach Restart w tym samym punkcie powstają 2 nowe biegi. Spec wykazuje 3 konteksty audio zamiast 2 (`tests/e2e/key-screen-single-action.spec.ts:214-228`, `change.md` Notes).

### Pause: drugi klik trafia w Resume

- `pause()` sprawdza tylko `retiredIntentRef`. Nie ma zatrzasku ani okna czasowego (`DrillTimer.tsx:142-148`). `runRef.current?.hide()` przełącza `display.paused`.
- Prawy slot: `initializing || resumePending` → wyłączony (`disabled`) loader; `display.paused` → Resume; w przeciwnym razie Pause (`DrillTimerView.tsx:52-73`). Pause i Resume są różnymi elementami w tym samym miejscu.
- `resume()` od razu ustawia `resumePending` (`DrillTimer.tsx:154-155`), więc **trzecie** kliknięcie trafia w wyłączony loader. Resume→Pause przy podwójnym kliku jest więc chronione przez stan pending, a Pause→Resume nie.

### Kontrolki odporne i dlaczego

| Kontrolka                 | Ochrona                                                                                   | Źródło                                                |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Save timer / Save changes | stan `saving` w kontrolerze („double submit before the first response sends one request”) | `src/lib/drill-create-controller.test.ts:161`         |
| Delete confirm            | `if (deleting) return` + `aria-disabled` + `aria-disabled:pointer-events-none`            | `src/components/timer/DeleteDrillDialog.tsx:86-101`   |
| Cancel                    | zatrzask `retireIntent`; po Cancel pasek znika, nowy bieg nie powstaje                    | `DrillTimer.tsx:132-135`, `DrillApp.tsx:100-105`      |
| Start                     | brak zatrzasku; drugi klik trafia w to, co pojawi się pod wskaźnikiem                     | `DrillConfigForm.tsx:165-170`, `DrillApp.tsx:113-116` |
| Strzałki                  | krok wyłącznie z `click`, pomijanie kliknięcia po przytrzymaniu, bez timera               | `src/lib/drill-step-press.ts:29-34`                   |

### Dyskryminator: licznik kliknięć a czas

- MDN `UIEvent.detail`: dla `click` to „the current click count”, licznik resetuje się po interwale zależnym od przeglądarki i ustawień dostępności. https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail, https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
- iOS Safari: `detail` nie rośnie przy kolejnych kliknięciach (mdn/browser-compat-data PR #30234, WebKit bug 298652; Leaflet#7012: „[UIEvent.detail] property of event is `1` always”). Chrome z emulacją dotyku w DevTools: „no `dblclick`. And [UIEvent.detail] is always `1`” (https://github.com/Leaflet/Leaflet/issues/7012).
- W repo `event.detail > 0` służy już do odróżnienia wskaźnika od klawiatury/AT (`src/components/timer/ConfigStepper.tsx:57`, `src/lib/drill-step-press.ts:12`). Ta konwencja pozwala ewentualnie zwolnić klawiaturę i AT (`detail === 0`) z okna czasowego.
- Wniosek: jedynym niezależnym od platformy sygnałem „to drugi klik podwójnego gestu” jest czas od poprzedniej aktywacji paska. Pozycja nic nie daje, bo testy pojedynczej akcji też trafiają w środek przycisku. Leaflet stosuje okno 300 ms dla `click` na iOS (ten sam wątek).

### Gdzie musi żyć stan blokady

- Restart: druga aktywacja trafia w **nową** instancję `DrillTimer`, więc stan żyjący tylko w instancji (`useRef`) nie przetrwa przemontowania (`DrillApp.tsx:131`). Czas ostatniej aktywacji musi trzymać właściciel `/`, czyli `DrillApp` (np. obok `identityState`, `DrillApp.tsx:62`). Można też przekazać go nowemu biegowi jako prop („blokada do chwili T”).
- Pause→Resume: obie aktywacje są w tej samej instancji `DrillTimer`, więc wystarczy stan w instancji. Spójniej jest jednak trzymać jeden „czas ostatniej akcji paska” u właściciela.
- Zegar: `DrillTimer` przyjmuje `clock?: DrillClock` z `now()` (`DrillTimer.tsx:20,32`, `src/lib/drill-run.ts:7-11`). Czystą logikę okna można więc umieścić w `src/lib/` i testować `node --test` z fałszywym zegarem, jak `drill-step-press.ts`, `drill-resume-pending.ts` i `drill-run-identity.ts`. W repo nie ma testów komponentów React; `src/lib/*.test.ts` testuje wyłącznie moduły czyste (lista w `package.json` `test`).

### Wpływ na istniejące testy e2e

Sprawdzone akcje na kontrolkach paska (`grep` po `"(Pause|Resume|Restart|Cancel) drill"` w `tests/e2e/*.ts`):

- `tests/e2e/run-audio-signals.spec.ts:86-87`: `Pause drill.click()`, a zaraz potem `resume.click()`. Bez blokady widocznej dla actionability ciche okno zignorowałoby Resume, a `expectSignalsAfterGesture(page, 2)` by padło (wnioskowanie; czas między kliknięciami niezmierzony, rzędu pojedynczych akcji Playwright).
- `tests/e2e/key-screen-single-action.spec.ts:101-105`: Pause, `expect(Resume).toBeVisible()`, Resume. `toBeVisible` przechodzi od razu po renderze, więc odstęp jest krótki.
- `key-screen-single-action.spec.ts:123-136`: Restart po `startRun` (czeka na „Repetition 1 of 2” i Pause, `:76-80`). Odstęp od Startu zależy od czasu inicjalizacji audio.
- `tests/e2e/run-phase-sequence.spec.ts:87,90`: Pause i Resume w kolejnych iteracjach `recordRunUntilCompleted`, przedzielone co najmniej jednym odczytem widoku.
- `tests/e2e/key-screen-layout.spec.ts:205`: Pause, potem tylko pomiary geometrii.
- `tests/e2e/saved-timer-start.spec.ts:70`: Cancel; Cancel nie może być blokowany.
- Playwright: `locator.click()`, `dblclick()` i `tap()` czekają na Enabled; element jest disabled m.in. gdy „it is a descendant of an element with `[aria-disabled=true]` attribute” (https://playwright.dev/docs/actionability, zapisane w `context/docs/playwright.md`, zapytanie 5). `page.touchscreen.tap()` nie robi sprawdzeń, a `dblclick()` sprawdza actionability raz przed obydwoma kliknięciami (`context/archive/2026-10-15-testing-key-screen-layout/plan.md:56`).
- Wniosek: blokada wystawiona jako `aria-disabled="true"` na przycisku (wzorzec repo: `aria-disabled`, nigdy `disabled`, CLAUDE.md „Signal preview” i „Config stepper”; `DeleteDrillDialog.tsx:86-93`) sprawia, że testy pojedynczej akcji czekają na stan, a testy podwójnej akcji trafiają w zablokowany przycisk. Nie trzeba `waitForTimeout` (zakazane w CLAUDE.md) ani zmian asercji. **Otwarte**: dokumentacja mówi „descendant of”; czy sam element z `aria-disabled` też jest disabled, trzeba sprawdzić (patrz Open Questions).

### Kontrakt paska biegu (CLAUDE.md, „Timer controls”)

- Cancel: „enabled and accessibly named during initialization, active, paused, and pending Resume”. **Wyklucza** blokowanie Cancel.
- Restart: „Keep Restart enabled during initialization, active, paused, and pending Resume. It shares Cancel's synchronous intent latch and idempotent disposal…”. Krótka blokada Restart po utworzeniu biegu to świadome odstępstwo do zatwierdzenia i zapisania w CLAUDE.md.
- Pause/Resume: „stay in a fixed hitbox”. `aria-disabled` nie zmienia geometrii, a styl `aria-disabled:opacity-50` jest już używany (`DeleteDrillDialog.tsx:86,93`).
- Fixtures: zmiana stanów kontrolek wymaga rozszerzenia `/dev/timer-ui` (w tym held-mounted Restart lifecycle gate, `src/components/timer/TimerUiPreview.tsx:699-766`) i bramki wizualnej siedmiu stanów (CLAUDE.md, „Extend the production-backed `/dev/timer-ui` fixtures…”).

## Code References

- `src/components/timer/DrillTimer.tsx:38` - `retiredIntentRef` per instancja
- `src/components/timer/DrillTimer.tsx:125-140` - `retireIntent`, `cancel`, `restart`
- `src/components/timer/DrillTimer.tsx:142-148` - `pause` bez zatrzasku
- `src/components/timer/DrillTimer.tsx:150-168` - `resume` z synchronicznym `resumePending`
- `src/components/timer/DrillApp.tsx:74-91` - `createActiveRun` (tożsamość, audio, Wake Lock w geście)
- `src/components/timer/DrillApp.tsx:107-111` - `restart` u właściciela
- `src/components/timer/DrillApp.tsx:130-138` - `DrillTimer` z `key={activeRun.identity}`
- `src/components/timer/DrillTimerView.tsx:41-75` - pasek: Cancel, Restart, slot Pause/Resume/loader
- `src/lib/drill-run-identity.ts:16-33` - `begin`/`retire`/`complete`
- `src/lib/drill-run.ts:7-11` - `DrillClock.now()`
- `src/components/timer/DeleteDrillDialog.tsx:86-101` - wzorzec `aria-disabled` + `pointer-events-none` + zatrzask
- `src/components/timer/ConfigStepper.tsx:57` - `event.detail > 0` jako „z wskaźnika”
- `tests/e2e/key-screen-single-action.spec.ts:214-242` - dwa testy z `test.fail()`
- `tests/e2e/run-audio-signals.spec.ts:86-87` - Pause, potem natychmiast Resume

## Architecture Insights

- Repo ma dwie konwencje odporności: **stan w toku** (Save, Delete, Resume pending) i **logika gestu bez timera** (strzałki, `drill-step-press.ts:29-34`). Restart i Pause nie mają stanu w toku, bo akcja jest natychmiastowa. Ich drugi klik trafia w kolejny legalny stan, więc potrzebne jest okno czasowe. To pierwszy timer decydujący o geście w repo, więc plan powinien uzasadnić wyjątek od zasady „never by a timer” (która w CLAUDE.md dotyczy tylko flagi pomijania kliknięcia strzałek).
- Tożsamość biegu (`drill-run-identity`) chroni przed starymi biegami, nie przed nowym. Blokada podwójnego gestu nie powinna rozszerzać tego guardu, tylko być osobnym, czystym modułem (np. `src/lib/drill-control-guard.ts`, nazwa do ustalenia w planie) używanym przez właściciela.
- Na prawy slot wpływają trzy stany (initializing, resumePending, paused). Okno blokady jest czwartym; plan musi określić priorytet (np. loader wygrywa z blokadą).

## Historical Context (from prior changes)

- `context/archive/2026-10-15-testing-key-screen-layout/research.md:31,65-67`: przewidział z kodu dwie akcje dla Start, Restart i Pause. **Restart i Pause**: potwierdzone w przeglądarce (`change.md` Notes). **Start**: niepotwierdzone, test „a double Start” jest zielony (`key-screen-single-action.spec.ts:201-212`), więc to twierdzenie jest częściowo sprzeczne z obserwacją.
- `context/archive/2026-10-15-testing-key-screen-layout/plan.md:40,150-159`: decyzja „nie naprawiamy w tej fazie”, `test.fail()` z odnośnikiem do tej zmiany, asercje bez zmian. Po naprawie `test.fail()` zrobi się czerwony („expected to fail but passed”), więc usunięcie obu `test.fail()` jest częścią naprawy.
- `context/archive/2026-10-15-testing-key-screen-layout/plan.md:56`: sposób podwójnego gestu w testach (`dblclick()` / dwa `page.touchscreen.tap` w środku `boundingBox()`, bez ponownego lokalizowania). Przy blokadzie przez `aria-disabled` to nadal prawdziwy podwójny gest.
- `context/archive/2026-10-05-restart-whole-drill/` i `context/archive/2026-10-04-cancel-current-drill/`: źródło kontraktu „Restart/Cancel enabled during initialization…” i wspólnego zatrzasku (CLAUDE.md). Nie czytano ich szczegółowo; kontrakt cytowany z CLAUDE.md.
- PRD §NFR: „Na telefonie sterowanie jest wygodne w użyciu i odporne na przypadkowe dotknięcia” (`context/foundation/prd.md:166`); test-plan §2 #7: „jedno kliknięcie lub dotknięcie wywołuje jedną akcję” (`context/foundation/test-plan.md:62`). PRD FR o Restart: decyzja „bez zmian” wobec przypadkowego restartu (`prd.md:128`) dotyczy braku potwierdzenia, nie podwójnego gestu.

## Related Research

- `context/archive/2026-10-15-testing-key-screen-layout/research.md` - ryzyko #7, jedna akcja na klik
- `context/docs/playwright.md` - actionability (zapytania 3 i 5)

## Open Questions

1. **Czy `aria-disabled="true"` na samym przycisku wstrzymuje `locator.click()`/`tap()`?** Dokumentacja mówi „descendant of an element with `[aria-disabled=true]`”. Plan powinien to potwierdzić małym eksperymentem albo w źródłach Playwright 1.64.1 przed oparciem na tym rozwiązania. Jeśli nie, trzeba dodać deterministyczne oczekiwanie na stan (`expect(button).not.toHaveAttribute("aria-disabled", "true")`) przed drugą akcją w trzech miejscach: `run-audio-signals.spec.ts:87`, `key-screen-single-action.spec.ts:105`, `:131`.
2. **Długość okna (decyzja produktowa).** Kandydaci: 300 ms (Leaflet, typowy timeout double-tap) albo ~500 ms (domyślny interwał podwójnego kliknięcia w Windows). Dłuższe okno lepiej chroni, ale opóźnia celowe Pause→Resume.
3. **Restart w oknie a kontrakt CLAUDE.md.** Czy zgadzamy się na krótkie `aria-disabled` Restart nowego biegu (zmiana zdania w CLAUDE.md), czy wolimy ciche ignorowanie Restart w oknie (zgodne literalnie z „enabled”, ale łamie `key-screen-single-action.spec.ts:131`, jeśli test nie poczeka na stan)?
4. **Zakres kontrolek.** Czy okno obejmuje Start→Restart (dziś odporne przypadkowo) i Resume→Pause (dziś chronione przez `resumePending`)? Cancel jest wyłączony z okna przez kontrakt.
5. **Klawiatura i AT.** Czy zwolnić z okna aktywacje z `event.detail === 0` (konwencja z `ConfigStepper.tsx:57`), żeby szybkie Enter/Space i czytniki ekranu działały bez opóźnienia?
