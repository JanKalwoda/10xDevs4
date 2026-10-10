<!-- PLAN-REVIEW-REPORT -->
# Plan Review: UX fixes round 2 Implementation Plan

- **Plan**: context/changes/ux-fixes-round-2/plan.md
- **Mode**: Deep
- **Date**: 2026-10-10
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓, 8/8 symbols ✓, brief↔plan ✓. Zweryfikowano: Tailwind 4.3.3 ma `pointer-coarse`/`pointer-fine` (oraz `any-pointer-*`, 6 trafień w `node_modules/tailwindcss/dist/lib.js`); `--spacing: 0.25rem` w `global.css`, więc `h-5.5` = 22 px jest na skali, a reguła `timer-ui-contract.mjs` łapie tylko `klasa-[...]`; Standby ma `time: null` w modelu (`drill-phase-sections.ts:9-13,60-64`), więc tajność długości zostaje nietknięta przez zmianę okienka Current (PASS, brak ustalenia). Format `m:ss` i zakresy zgodne z `drill-timer.ts:15-26`.

## Findings

### F1 — Regresja skryptu S-18 wymagana jako zielona, a faza 2 psuje jego asercje

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §2, Phase 5 kryterium 5.3
- **Detail**: Faza 2 usuwa `h2` z Current. `context/changes/run-view-layout/screenshots/run-view-visual-gate.mjs:58,70` wyszukuje `section.querySelector("h2")` i sprawdza kolejność `rep → h2 → group`. Faza 5 (5.3) wymaga, by ten skrypt kończył się kodem 0. Plan nigdzie nie aktualizuje skryptu S-18 (jest też na liście `globalIgnores`, więc edycja jest dozwolona). Wynik: 5.3 nie może przejść bez nieplanowanej edycji; implementujący będzie zgadywał.
- **Fix**: W fazie 2 dopisać aktualizację `run-view-visual-gate.mjs` (Current = `[role="group"][aria-label="Current phase"]`, kolejność `rep → current → next`, wysokość/linie jak w Next) i punkt w Progress 2.x; w 5.3 uruchamiać zaktualizowany skrypt.
- **Decision**: FIX. Faza 2 §4 aktualizuje `run-view-visual-gate.mjs`, nowy krok Progress 2.6.

### F2 — `pointer-coarse:` (główny wskaźnik) źle obsługuje laptopy z dotykiem

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 (kontrakt układu), Open Risks
- **Detail**: `pointer-coarse:`/`pointer-fine:` to `@media (pointer: …)`, czyli tylko główny wskaźnik. Laptop z ekranem dotykowym i myszą/touchpadem raportuje `pointer: fine`, więc dostaje cele 22 px, choć użytkownik dotyka palcem. iPad z klawiaturą/trackpadem raportuje zwykle `pointer: coarse` (OK). Plan akceptuje to jako „ryzyko", ale nie podaje mitygacji, a Tailwind ma gotowy `any-pointer-coarse:`.
- **Fix A ⭐ Recommended**: Układ duży przy `any-pointer-coarse:` (jeśli jakiekolwiek urządzenie wskazujące jest dotykowe), kompaktowy domyślnie.
  - Strength: hybrydy dostają cele 44 px; mysz na takim laptopie widzi tylko nieco większe, nadal poprawne przyciski (wiersz Exercise/Rest i tak 44 px).
  - Tradeoff: użytkownik myszy na laptopie z dotykiem nie dostaje układu „kolumna".
  - Confidence: MED — `any-pointer` występuje w `lib.js`, ale dokładne nazwy wariantów (`any-pointer-coarse`) potwierdzić w fazie 4 małym testem kompilacji.
  - Blind spot: Playwright `hasTouch` + `isMobile` ustawia też `any-pointer: coarse`; scenariusz „fine + dotyk" trzeba emulować osobno (kontekst bez `isMobile`, tylko `hasTouch`).
- **Fix B**: Zostawić `pointer-*` i opisać hybrydy jako znane ograniczenie.
  - Strength: zgodne z literą decyzji użytkownika.
  - Tradeoff: cele 22 px dla palca na hybrydach, WCAG 2.5.8 nie jest tam spełnione nawet wyjątkiem w sensie praktycznym.
  - Confidence: HIGH.
  - Blind spot: brak.
- **Decision**: Fix A. Duży układ przy `any-pointer-coarse:`, kompaktowy domyślnie; wariant potwierdzony w `lib.js`; osobny kontekst „mysz + dotyk” w skrypcie.

### F3 — Krok na `pointerdown` na dotyku: przewijanie strony i kliknięcia AT

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 (zdarzenia)
- **Detail**: (a) `touch-manipulation` NIE blokuje przewijania. Palec zaczynający gest przewijania na przycisku 44 px wykona krok na `pointerdown`, a dopiero potem przeglądarka wyśle `pointercancel`; po 400 ms bez ruchu zacznie się też powtarzanie. Wartość zmienia się przy zwykłym przewijaniu formularza. (b) Rozróżnianie klawiatury przez `click.detail === 0` jest kruche: kliknięcia z technologii asystujących (VoiceOver macOS, TalkBack, Voice Control, Switch Control) mają różne `detail` zależnie od przeglądarki; przy `detail > 0` bez wcześniejszego `pointerdown` krok się po prostu nie wykona (cisza, bez błędu). (c) Mysz: filtr „tylko przycisk główny" jest w planie, ale brak `setPointerCapture`/`lostpointercapture`; `pointerleave` przy implicit capture na dotyku odpala się dopiero po puszczeniu. (d) `onContextMenu` + `select-none` pokrywa długie przytrzymanie na Androidzie; na iOS dla `button` dodatkowo warto `-webkit-touch-callout` (nie ma klasy Tailwind — wystarczy `select-none`, brak działania do podjęcia, odnotować).
- **Fix A ⭐ Recommended**: (1) `touch-none` na przyciskach steppera (wyłącza gest przewijania z celu, więc brak `pointercancel` od scrolla i brak przypadkowych kroków); (2) zamiast `detail === 0` użyć flagi w refie: `pointerdown` ustawia `handledByPointer = true`, a `click` krok pomija, gdy flaga jest ustawiona (i ją zeruje), w przeciwnym razie krok wykonuje (klawiatura, AT, Voice Control); flaga zerowana także w `pointercancel`/`pointerleave`/`blur`; (3) dopisać `setPointerCapture` na `pointerdown` i `onLostPointerCapture` → `stop`.
  - Strength: niezależne od wartości `detail`, brak cichych porażek AT, brak kroków od przewijania.
  - Tradeoff: `touch-none` uniemożliwia rozpoczęcie przewijania palcem dokładnie na 44-pikselowym przycisku (akceptowalne, cel mały).
  - Confidence: MED — zachowanie VoiceOver/TalkBack do sprawdzenia na urządzeniu (plan i tak odkłada to na koniec kolejki); logika flagi jest testowalna Playwrightem (`locator.click()` vs `dispatchEvent('click')` z `detail 0/1`).
  - Blind spot: iOS Safari nie zawsze wysyła `pointerdown` przed `click` przy VO double-tap — flaga to obsłuży (krok na `click`).
- **Fix B**: Krok na `click`/`pointerup`, a powtarzanie tylko od `pointerdown` po opóźnieniu.
  - Strength: najprostsza semantyka, jeden krok = jedno aktywowanie.
  - Tradeoff: opóźnienie przy tapnięciu = krok dopiero po puszczeniu; powtarzanie wymaga uzgodnienia „czy puszczenie po powtórzeniach dodaje kolejny krok" (flaga `repeated`).
  - Confidence: MED.
  - Blind spot: scenariusze z przesuniętym wskaźnikiem.
- **Decision**: Fix A. `touch-none`, flaga `handledByPointer` w refie, `setPointerCapture` + `onLostPointerCapture` → stop.

### F4 — Wiersze Preparation i Repetitions rosną na komputerze (sprzeczne z wymaganiem)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 §2, Key Discoveries
- **Detail**: Wymaganie użytkownika: na komputerze „BEZ zwiększania obecnej wysokości wiersza". Preparation i Repetitions nie mają ikony głośnika i mają dziś 36 px (`Input` `h-9`). Kolumna 2 × 22 px = 44 px zwiększa je o 8 px; plan uznaje to za „nieuniknione także na dotyku" i „uzgodnione", ale zgoda dotyczy dotyku (tam cel musi mieć 44 px), a nie komputera. Efekt uboczny: zrzuty S-19/S-18 i skok układu formularza na `/`, `/create`, `/{id}/edit`.
- **Fix A ⭐ Recommended**: Zapytać użytkownika (jedno pytanie w `[PLAN-OK]`/`[Q]`): na komputerze dla Preparation/Repetitions (a) zaakceptować 44 px dla wszystkich czterech wierszy (spójne wiersze, plan jak jest) czy (b) kolumna 2 × 18 px = 36 px (`h-4.5`), wyłącznie w tych dwóch polach. Rekomendacja: (a), bo 18 px jest dalej od 24 px, a spójna wysokość wierszy daje równy rytm formularza.
  - Strength: decyzja udokumentowana; plan nie łamie wymagania po cichu.
  - Tradeoff: (a) odstępstwo od litery wymagania o 8 px w dwóch polach.
  - Confidence: HIGH.
  - Blind spot: brak.
- **Decision**: Decyzja użytkownika: wszystkie wiersze 44 px na komputerze (Preparation i Repetitions rosną).

### F5 — Zmiana wartości przez przyciski jest niema dla czytnika ekranu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1–2
- **Detail**: Fokus zostaje na przycisku, a zmienia się wartość w innym elemencie (`Input`). `aria-controls` nie powoduje odczytu nowej wartości, więc użytkownik NVDA/VoiceOver nie usłyszy `0:06`. Plan nie wprowadza live regionu (inaczej niż w odsłuchu, gdzie jest `sr-only` komunikat). Klawisze ↑/↓ w polu są nieodkrywalne (nigdzie podpowiedzi), a dodatkowo pole zostaje `type="text"` bez `role="spinbutton"` — czyli ↑/↓ nie są ogłaszane jako możliwe.
- **Fix**: Dodać do `ConfigStepper`/`ConfigField` `sr-only` region `role="status"` (aria-live polite) z komunikatem „Exercise 0:06" (przy powtarzaniu tylko ostatnia wartość, np. czyszczenie/aktualizacja z opóźnieniem ~300 ms po `stop`), oraz jednozdaniową wzmiankę „Use ↑ and ↓ to change the value, Shift for 10" w istniejącym akapicie wprowadzającym nad formularzem (`DrillConfigForm.tsx` „Enter times in m:ss format…") — nie nowa wartość arbitralna, nowy tekst. Zakres: testy w skrypcie (tekst regionu po kroku), 1 zdanie w AGENTS.md.
- **Decision**: FIX. `sr-only` `role="status"` z ostatnią wartością (~300 ms po stop) i zdanie o ↑/↓ i Shift w akapicie; Progress 4.5.

### F6 — Kolejność tabulatora vs kolejność wizualna; 8 dodatkowych przystanków

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §1 (kontrakt układu), Open Risks
- **Detail**: DOM `▲, ▼`; na dotyku `flex-row-reverse` pokazuje `▼ ▲`, więc Tab idzie w prawo-do-lewo (2.4.3/1.3.2 Focus Order). Odwrócenie DOM naprawi dotyk, ale zepsuje komputer (▲ nad ▼). Dodatkowo cztery pola × 2 = 8 przystanków, co wydłuża formularz dla klawiatury (formularz ma dziś ~8 kontrolek). Plan odnotowuje to tylko jako ryzyko.
- **Fix**: Dopuszczalne i rozsądne: `tabIndex={-1}` na obu przyciskach steppera (dostępne myszą/dotykiem/AT, a klawiatura ma ↑/↓ w polu, co spełnia „Equivalent" i znosi oba problemy: brak 8 przystanków, brak niezgodności fokusu). Wtedy przycisk nie musi być `aria-disabled` dla utrzymania fokusu, ale zostawić `aria-disabled` (prostsze, spójne z odsłuchem). Wymaga F5 (podpowiedź ↑/↓), bo użytkownik klawiatury inaczej nie odkryje funkcji. Jeśli jednak wymagana jest możliwość Tab: zachować DOM `▲, ▼` i udokumentować niezgodność na dotyku w AGENTS.md.
- **Decision**: FIX. `tabIndex={-1}` na przyciskach, `aria-disabled` zostaje; focus-visible w bramce dla pola, N/A dla strzałek (uzasadnione w fazie 5).

### F7 — Szczegóły stylu dwóch stykających się przycisków i ring fokusu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1
- **Detail**: Plan mówi „bez podwójnej ramki", ale nie podaje mechanizmu; `-mt-px` skróciłoby kolumnę do 43 px. Przycisk `outline` ma `border` + `shadow-xs` + `focus-visible:ring-[3px]` (ring jest przycinany/zakrywany przez sąsiada). `size-4` ikony mieści się w 22 px (20 px wewnątrz ramki), więc ok.
- **Fix**: Dolny przycisk `border-t-0` (kolumna dokładnie 44 px), oba `relative focus-visible:z-10`, `shadow-none` w układzie kolumnowym; asercja skryptu: `column.getBoundingClientRect().height === 44` i brak dwóch sąsiednich ramek 2 px.
- **Decision**: FIX. `border-t-0`, `relative focus-visible:z-10`, `shadow-none` w kolumnie, asercja wysokości 44 px.

### F8 — Najnowsza wartość i callbacki w powtarzaczu

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §3, Phase 4 §1
- **Detail**: Plan przewiduje ref na wartość, ale `step` w interwale zamyka też `handleChange` (który zamyka `values` z renderu) i `onStep`. Bez refów także na te callbacki powtarzanie nadpisze starą kopię `values` (zgubione zmiany innych pól jest mało prawdopodobne podczas przytrzymania, lecz przy zmianie `values` z zewnątrz, np. `DrillEditApp`, możliwe). Plan 'hook zwraca {start, stop}' nie mówi, jak krok dostaje świeże dane.
- **Fix**: Hook trzyma `latest` ref (aktualizowany w `useLayoutEffect`) z `{value, onStep}` i `start(stepFromLatest)`; test jednostkowy w `drill-step-repeat.test.ts` dla `step`, który zwraca `false` po zmianie wartości zewnętrznie.
- **Decision**: FIX. Ref `latest` `{value, onStep}` w hooku (`useLayoutEffect`) + test.

### F9 — Drobne niespójności w Current / etykietach

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §2
- **Detail**: `section` ma już `aria-label="Current drill phase"`, a pudełko dostaje `aria-label="Current phase"` — dwa zbliżone nazwy (screen reader czyta „Current drill phase … Current phase"). Po usunięciu `h2` zniknął jedyny nagłówek w widoku biegu poniżej `h1`; to akceptowalne (landmark ma etykietę), ale warto zapisać decyzję. Tajność Standby: plan prawidłowo zachowuje `time: null`; dodać do testu różnicowego asercję, że `currentPhaseBody` dla Standby 1 s i 5 s jest identyczny (już w planie) — brak zmian.
- **Fix**: Nazwać pudełko `aria-label="Current"` / „Next" lub zostawić „Next phase" i dać Current „Current phase" z `aria-labelledby` na widocznej etykiecie; odnotować brak `h2` w planie.
- **Decision**: FIX. `aria-labelledby` na widocznej etykiecie, brak `h2` odnotowany w planie.

## Ocena pozostałych punktów z zakresu review

- Tajność długości Standby po zmianie okienka Current: **OK** (model bez danych o oczekiwaniu, testy różnicowe zostają).
- Stałe wysokości / skoki paska: **OK** (Current w Standby nadal jedna linia z nazwą; pasek zależy tylko od nazwy i jednej linii). Dodać w skrypcie asercję pozycji paska między wszystkimi scenariuszami (jest w planie).
- `pointer-coarse:`/`pointer-fine:` istnieją w 4.3.3; `h-5.5` na skali: **potwierdzone**.
- Kontrakt UI (tokeny, brak `[...]`): **OK** (`h-5.5`, `w-8`, `size-11` na skali; `touch-none`/`touch-manipulation`/`select-none` nie są kolorami ani wartościami arbitralnymi).
- Format `m:ss`/walidacja: **OK** (`TIME_PATTERN`, zaciskanie, stałe z `drill-timer.ts`).
- Progress↔Phase: spójne (5 faz, kryteria 1:1).
- Każda faza zielona osobno: **OK** poza F1 (faza 2 psuje skrypt S-18, widoczne dopiero w fazie 5).
