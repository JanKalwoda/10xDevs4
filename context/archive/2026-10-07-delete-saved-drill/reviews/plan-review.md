<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Delete a saved timer (S-13)

- **Plan**: context/changes/delete-saved-drill/plan.md
- **Mode**: Deep (weryfikacja kodu własna, bez sub-agenta)
- **Date**: 2026-10-07
- **Verdict**: REVISE → all findings ACCEPTED (coordinator), plan updated
- **Findings**: 0 critical, 7 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓, 7/7 symbols ✓ (isDrillId, normalizeDrillId, failure, toResponse, classifyStoreError, methodNotAllowedResponse, delete_own policy), brief↔plan ✓, Progress↔Phase ✓ (3 fazy, 1.1–1.8 / 2.1–2.8 / 3.1–3.7, zgodne z Success Criteria).

Potwierdzone w kodzie (bez ustaleń): grant `select, delete` + polityka `drill_configurations_delete_own` (migracja :100,:119) wystarczają dla `.delete().eq(id).eq(user_id).select("id").maybeSingle()` (RETURNING wymaga polityki SELECT, jest); obcy wiersz = 0 rows (RLS), więc 404 bez oracle; trigger limitu jest INSERT-only; kolejność 401 → 503 → 404 jak w PUT; brak migracji jest poprawny; testy `drill-delete.test.ts` i `drill-delete-controller.test.ts` łapie `npm test` (`src/lib/*.test.ts`, `src/lib/services/*.test.ts`).

## Findings

### F1 — Radix AlertDialogAction sam zamyka dialog

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — #1 Dialog primitive, #3 Delete component
- **Detail**: Plan zakłada, że po błędzie dialog zostaje otwarty z retry, a `Delete` ma stan `Deleting…`. `AlertDialogAction` to `Dialog.Close`: kliknięcie woła `onOpenChange(false)` zaraz po handlerze `onClick`. Przy sterowanym `open` stan kontrolera w momencie zamknięcia jest jeszcze `idle` (zamknięcie nie jest ignorowane), więc dialog zniknie w trakcie requestu, a błąd 5xx pojawi się w nieistniejącym dialogu. Plan mówi tylko, że „close jest ignorowane gdy deleting”, nie opisuje tej pułapki.
- **Fix**: W `DeleteDrillDialog` wywołaj `event.preventDefault()` w `onClick` `AlertDialogAction` (Radix pomija wewnętrzne zamknięcie przy `defaultPrevented`) albo użyj zwykłego `Button` zamiast `AlertDialogAction`; zamykaj tylko przez `Cancel`/Esc, gdy kontroler nie jest `deleting`. Dodaj to do Contract i do skryptowego testu w przeglądarce (błąd → dialog nadal otwarty).
- **Decision**: ACCEPTED

### F2 — Overlay click nie zamyka Radix AlertDialog, plan twierdzi że zamyka

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State; Phase 2 Manual 2.6; Manual Testing Steps 1
- **Detail**: „Esc, overlay click and Cancel close it without any request”. `AlertDialogContent` w Radix blokuje `onPointerDownOutside`/`onInteractOutside` (celowo, to alertdialog). Kliknięcie w overlay nic nie robi, więc krok 2.6 („overlay send no request and return focus”) jest nie do wykonania tak, jak opisano.
- **Fix**: Zmień tekst: overlay jest bezczynny (bezpieczniejsze dla operacji destrukcyjnej), zamykają Cancel i Esc; w 2.6 sprawdzaj, że klik w overlay nie zamyka i nie wysyła requestu.
- **Decision**: ACCEPTED

### F3 — Zwrot fokusu: brak AlertDialogTrigger, disabled gubi fokus

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — #1 exports, #3 Delete component
- **Detail**: Lista eksportów nie zawiera `AlertDialogTrigger`, a plan obiecuje „Focus returns to the trigger on Cancel/Esc”. Radix zwraca fokus do triggera z kontekstu; przy sterowanym dialogu z samym `Button` poza `AlertDialogTrigger` `onCloseAutoFocus` nie ma do czego wrócić (fokus ląduje na `body`). Dodatkowo `Delete` z atrybutem `disabled` w trakcie requestu traci fokus, a po błędzie nikt go nie przywraca.
- **Fix**: Dodaj `AlertDialogTrigger asChild` do eksportów i użyj go dla `Delete timer`; w stanie `deleting` użyj `aria-disabled` + blokady w handlerze zamiast `disabled` (fokus zostaje w dialogu), albo przenieś fokus na `Cancel`/alert po błędzie.
- **Decision**: ACCEPTED

### F4 — Fixtures: wiele otwartych modali na jednej stronie i brak wstrzykiwanych portów

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — #1 Fixtures; Phase 2 — #3 (props)
- **Detail**: Plan chce kart „default (open), long, emoji, deleting, error, unauthorized” z produkcyjnym `DeleteDrillDialog` na `/dev/timer-ui`. Modalny Radix dialog renderuje się w portalu, ustawia `aria-hidden` na reszcie strony, blokuje scroll i przechwytuje fokus. Dwa jednocześnie otwarte dialogi na jednej stronie nie dadzą się zrzucić ani przetestować, a otwarty dialog zasłoni pozostałe fixtures. Do tego `DeleteDrillDialog` ma props tylko `{ drill }`, więc fixtures nie mogą wstrzyknąć portów (`deleting` = nigdy nie rozwiązany fetch, `error`, 401) ani wymusić `open`.
- **Fix A ⭐ Recommended (chosen)**: Dodaj do `DeleteDrillDialog` opcjonalne `deleteDrill`/`navigate` (domyślnie produkcyjne) i `defaultOpen`; w preview pokazuj jeden stan naraz (przełącznik lub `?state=`), a skrypt zrzutów iteruje po stanach.
  - Strength: Zachowuje zasadę „produkcyjny komponent w fixtures”; spójne z `useDrillCreate(saveDrill)`.
  - Tradeoff: Skrypt zrzutów musi sterować stanami, a nie robić jednego zrzutu strony.
  - Confidence: MED — wzorzec z `CreateDrillFixtures` (wstrzyknięty port) zweryfikowany, wymuszony `open` i selektor stanów nie.
  - Blind spot: Czy `/dev/timer-ui` ma już mechanizm wyboru stanu (nie sprawdzałem `TimerUiPreview`).
- **Fix B**: Wydziel prezentacyjny `DeleteDrillDialogBody` bez portalu (używany przez dialog i statycznie w fixtures).
  - Strength: Wiele stanów obok siebie, bez modala.
  - Tradeoff: Fixtures nie ćwiczą focus trap/Esc/overlay, czyli właśnie ryzyk tej zmiany.
  - Confidence: MED — oparte na zasadzie Radix, bez próby.
  - Blind spot: Jaka część wyglądu (overlay, portal) wypada z bramki wizualnej.
- **Decision**: ACCEPTED

### F5 — Zakres lintu nie obejmuje alert-dialog.tsx; wariant destructive używa text-white

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — #1 Dialog primitive, #3 Delete component
- **Detail**: `eslint.config.js:113` wymienia w zakresie reguły timer-ui tylko `src/components/ui/{input,label,checkbox,card,alert}.tsx`. Po dodaniu `alert-dialog.tsx` poprawka `bg-black/50` → token nie jest egzekwowana przez `npm run lint` (plan: „lint stays clean” nic nie dowodzi). Ponadto `button.tsx` (też poza zakresem) ma wariant `destructive` z `text-white` i `dark:bg-destructive/60`; w trybie ciemnym `--destructive` jest jasny (0.74) i ma parę `--destructive-foreground` (ciemny, 0.2077), więc biały tekst na rozjaśnionym tle ma ryzyko słabego kontrastu. AGENTS.md: „Never use hardcoded color values”, „Preserve … validation red”.
- **Fix**: Dodaj `alert-dialog.tsx` do globu w `eslint.config.js` (i do asercji w `timer-ui-contract.test.mjs`), dodaj token `--overlay` (light/dark) + `--color-overlay` w `@theme inline`, dla przycisku `Delete` użyj tokenów (`text-destructive-foreground` zamiast `text-white`, bez `/60`, albo outline z `text-destructive`) i dodaj pomiar kontrastu light/dark do 2.6/3.5. Zmiana wariantu w `button.tsx` dotyka innych użytkowników: sprawdź, że `destructive` nigdzie indziej nie jest używany.
- **Decision**: ACCEPTED

### F6 — 204 przez toResponse się nie uda; wymaga osobnej ścieżki

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — #1 Store and service
- **Detail**: `toResponse` (`drill-configurations.ts:323`) to `Response.json(result.body, { status, headers })`. `Response.json` ze `status: 204` rzuca `TypeError` (null body status). Plan mówi o „HandlerResult-compatible outcome” i „204 empty body”, ale nie rozstrzyga, jak ten wynik dotrze do `Response`. Implementujący musi zgadnąć.
- **Fix**: W Contract wskaż jawnie: `handleDeleteDrillRequest` zwraca `new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })` dla sukcesu, a błędy przechodzą przez `toResponse(failure(...))`; test sprawdza status 204, pusty body i `cache-control`.
- **Decision**: ACCEPTED

### F7 — Po sukcesie `deleting` zostaje na zawsze: bfcache i Back

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — #2 Controller (204/404 → navigate, „stay deleting”)
- **Detail**: Kontroler po 204/404 nawiguje i celowo zostaje w `deleting`. Jeśli przeglądarka przywróci `/{id}` z bfcache (Safari/Firefox; Chrome zwykle nie dla `no-store`), użytkownik zobaczy otwarty, zablokowany dialog „Deleting…” dla nieistniejącego timera, bez wyjścia (Cancel ignorowany w `deleting`). Plan zostawia to tylko ręcznemu 3.7. Dodatkowo `location.assign` zostawia usuniętą stronę w historii. Uwaga: 404 jako sukces opiera się wyłącznie na statusie, więc 404 z innego źródła (np. proxy) też da redirect; to akceptowalne, ale warto to odnotować.
- **Fix**: Nawiguj przez `location.replace("/dashboard")` (port `navigate`), a w hooku obsłuż `pageshow` z `event.persisted` (przeładowanie strony lub reset stanu); dodaj do testu kontrolera/hooka.
- **Decision**: ACCEPTED

### F8 — CSRF: wniosek poprawny, ale uzasadnienie w planie niedokładne i bez testu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Key Discoveries (cross-origin protection); Brief — CSRF
- **Detail**: Odpowiedź na pytanie: tak, wystarczy dla DELETE z ciasteczkiem sesji, bez 415. W Astro 7.3.2 (`node_modules/astro/dist/core/app/origin-check.js`) `isForbiddenCrossOriginRequest` dla metod niebezpiecznych bez `Content-Type` zwraca `!isSameOrigin`, czyli DELETE bez body i bez nagłówka `Origin` równego `url.origin` dostaje 403. Plan opisuje to słabiej („covers form-type requests”). Warstwy: (1) `checkOrigin` (403 bez zgodnego `Origin`), (2) DELETE nie jest „simple” i wymaga preflightu, którego aplikacja nie zatwierdza (`ALL` → 405 bez CORS), (3) ciasteczka `@supabase/ssr` z domyślnym `SameSite=Lax` (w `src/lib/supabase.ts` brak nadpisania) nie jadą w cross-site fetch DELETE. Konsekwencje: klienty bez `Origin` (curl, Node bez nagłówka) dostają 403; smoke już wysyła `Origin` (`scripts/smoke.mjs:77`), a testy jednostkowe handlera tej warstwy nie widzą. Brakuje testu przypinającego warstwę 1 dla DELETE.
- **Fix**: Popraw sformułowanie w planie/briefie i dodaj krok skryptowy (1.8 lub smoke): DELETE z obcym `Origin` oraz bez `Origin` → 403, a własny timer nadal istnieje; z `Origin` aplikacji → 204.
- **Decision**: ACCEPTED

### F9 — pgTAP: kształt zapytania adaptera i zakres planu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — #4 pgTAP
- **Detail**: Adapter wysyła `DELETE ... RETURNING id`, co wymaga polityki SELECT i grantu `select`. Zaplanowane przypadki sprawdzają `delete` bez `returning`. Dodatkowo plan twierdzi, że „freed limit slot” nie jest pokryty, a istniejące testy (`drill_configurations.test.sql` ~:451–457) już sprawdzają usunięcie jednego wiersza przy limicie i wstawienie kolejnego; nowe jest tylko „ale nie dwa”. Zachowanie PostgREST `maybeSingle()` dla 0 wierszy w DELETE potwierdzi dopiero skrypt w 1.8/smoke (testy jednostkowe używają fake'ów).
- **Fix**: Dodaj do pgTAP `delete ... where id = <obcy> returning id` jako B (0 wierszy) i `... = <własny> returning id` jako A (1 wiersz); zaznacz, że slot limitu rozszerza istniejący test; przelicz `plan(N)` (obecnie `plan(90)`).
- **Decision**: ACCEPTED

### F10 — Zachowania dostępności tylko ręcznie, bez automatycznej weryfikacji

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Manual 2.6–2.8; Testing Strategy
- **Detail**: Fokus startowy na Cancel, Esc, focus trap, zwrot fokusu, nazwa w `aria-describedby`, długa nazwa 200 znaków przy 390 px, dialog niezamykany w trakcie requestu: wszystko to jest w krokach manualnych, a repo nie ma testów DOM (`npm test` to czysty Node). W S-12 podobne wiersze wykonano skryptem Playwright i oznaczono „scripted, not human”; plan S-13 tego nie wymaga, a F1/F3 pokazują, że właśnie tu są pułapki.
- **Fix**: Dodaj do Phase 2 skryptowy Playwright (produkcyjny preview, dwóch użytkowników) z asercjami: `document.activeElement` = Cancel po otwarciu, Esc/Cancel bez requestu i fokus na triggerze, klik w overlay nie zamyka, po 500 dialog otwarty i retry działa, nazwa 200 znaków bez poziomego scrolla, jeden request przy podwójnym kliknięciu; wynik w README zrzutów jako „scripted”.
- **Decision**: ACCEPTED
