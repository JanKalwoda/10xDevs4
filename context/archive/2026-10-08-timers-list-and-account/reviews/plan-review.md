<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Timers list screen and account page (S-17)

- **Plan**: context/changes/timers-list-and-account/plan.md
- **Mode**: Deep
- **Date**: 2026-10-09
- **Verdict**: REVISE (lekkie, ukierunkowane poprawki; architektura i zakres w porządku)
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (`protected-routes.ts`, `app-top-bar.ts`, `email-auth.ts`, `dashboard.astro`, `drill-create-controller.ts`, `drill-delete-controller.ts`, `useDrillCreate.ts`, `CreateDrillFixtures.tsx`, `scripts/smoke.mjs`; także `CODEX.md`, `src/AGENTS.md`, wszystkie wymienione testy), 6/6 symbols ✓ (`PROTECTED_ROUTES`, `TIMERS_HREF`, `safeNextPathSchema`, `signInUrlForProtectedPath`, `resolveDashboardPage`/`DashboardPage`, `DASHBOARD_HREF`, `isSaveDrillResponse`), Progress↔Phase ✓ (4/4 fazy, numeracja kryteriów zgodna), brief↔plan ✓.

Weryfikacja wskazanych obszarów:

- **Trasy chronione / redirect gościa `/timers`**: ✓ `isProtectedPath` to prefiks po zdekodowaniu i zredukowaniu `//` (`protected-routes.ts:46-49`), middleware zwraca 302 z `next=pathname+search` przed renderem (`middleware.ts:21-26`); statyczne `timers.astro` wygrywa z `[id].astro`. Testy w planie (`/timers/`, `/%74imers`, `//timers`, `/timersx`) są właściwe.
- **Walidacja `next` / open redirect**: ✓ plan nie zmienia `isSafeNextPath`, tylko wartość domyślną, z jednej stałej `DEFAULT_NEXT_PATH`. Nawigacja po create to `"/" + encodeURIComponent(drill.id)` – `//evil` staje się `/%2F%2Fevil`, więc nie ma przekierowania poza origin. Pominięty jeden fallback – F6.
- **Brak wycieku danych na `/dashboard`**: ✓ w kodzie (tylko `locals.user`, `no-store`), ale smoke nie sprawdza tego, gdy istnieją timery – F3.
- **Identyczny 404 dla obcych id**: ✓ plan nie zmienia `[id].astro`/`[id]/edit.astro` ani API poza tekstem i href linków.
- **Nawigacja po create**: ✓ synchroniczny latch `saving` (`drill-create-controller.ts:89`) blokuje podwójny submit; plan zostawia `saving` po sukcesie i wywołuje `navigate` raz (wzorzec delete). Zakres resetu bfcache – F4.
- **Smoke i fazy zielone osobno**: ✗ – F1, F2.
- **Glob lint nowych plików**: ✓ `timers.astro` i `AccountDetails.astro` trafiają do bloku timer-ui; `timer-ui-contract.test.mjs:94` już wylicza pliki S-16, więc „if the contract test enumerates” oznacza: rozszerz go (drobne, mieści się w Phase 1).
- **Decyzje koordynatora**: Q1 (Sign out zostaje na `/dashboard`) – odzwierciedlone (Phase 1 §3, brief, Manual Testing 4). Q2 (h1 `Account`) – odzwierciedlone (Phase 1 §3, Phase 4 smoke, brief „Open Risks”). Q3 („tak”) – plan nie ma otwartego pytania sprzecznego z żadną z decyzji ux-fixes-plan; wszystkie wiersze tabeli decyzji dla S-17 mają odpowiednik w fazach.

## Findings

### F1 — Fazy 1–3 łamią smoke; „each leaving main-quality state” jest nieprawdziwe

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1, 2, 3 vs Phase 4 §1
- **Detail**: Plan deklaruje, że każda faza zostawia stan jakości `main`, ale wszystkie zmiany `scripts/smoke.mjs` są w Phase 4. Po Phase 1 smoke jest czerwony: `smoke.mjs:210-211` oczekuje `Timers` → `/dashboard`, `:276` szuka `Dashboard` na `/dashboard`, `:317-321`, `:391-398`, `:432-435`, `:559-565`, `:596-599` czytają listę z `/dashboard`. Po Phase 2: `:260` oczekuje `Continue to account`. Lokalnie smoke nie działa (brak Mailpit), więc regresja wyjdzie dopiero w CI po Phase 4, a jej źródło nie będzie przypisane do fazy. Kryteria Phase 1–3 nie obejmują smoke, więc formalnie „zielone” fazy mają czerwony smoke.
- **Fix A ⭐ Recommended**: Przenieść zmiany smoke do faz, które łamią asercje (Phase 1: bar `Timers`→`/timers`, lista na `/timers`, krok konta + guest `/timers` + no-store; Phase 2: `Continue to your timers`, `next`; Phase 3: krok create→`/{id}`) i dodać do kryteriów każdej fazy `node --check scripts/smoke.mjs` oraz grep martwych asercji (`grep -n '"/dashboard"\|Continue to account' scripts/smoke.mjs`). Phase 4 zostaje dla docs, screenshotów i CI.
  - Strength: Każdy commit jest spójny ze smoke; regresja ma właściciela-fazę; zgodne z prośbą koordynatora „fazy zielone osobno”.
  - Tradeoff: Smoke edytowany w trzech commitach; nadal bez lokalnego uruchomienia (CI jest jedynym potwierdzeniem).
  - Confidence: HIGH — wszystkie łamane asercje są wyliczone powyżej z numerami linii.
  - Blind spot: Bez Mailpit lokalnie pozostaje statyczna kontrola zamiast wykonania.
- **Fix B**: Zostawić smoke w Phase 4, ale usunąć zdanie „each leaving `main`-quality state” i zapisać, że smoke jest zielony dopiero po Phase 4 (PR nie wcześniej).
  - Strength: Zero zmian struktury planu.
  - Tradeoff: Fazy pośrednie nie są niezależnie weryfikowalne; sprzeczne z oczekiwaniem koordynatora.
  - Confidence: HIGH — trywialna edycja.
  - Blind spot: None significant.
- **Decision**: FIX — Fix A: smoke edits moved into phases 1-3; each phase checks `node --check` and dead-assertion greps; phase 4 only re-reads and confirms CI.

### F2 — Domyślne `next=/timers` nie jest pokryte przez smoke; asercja `:171` odrzuci `/timers`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 Manual 2.5 („checked in CI smoke”), Phase 4 §1
- **Detail**: Każde żądanie linku w smoke podaje jawne `next` (`requestEmailLink(email, "/dashboard")`, linie ~675 i ~756 pliku), więc wartość domyślna nigdy nie jest testowana end-to-end, a `callbackFromMessage` sprawdza `next === "/" || next === "/dashboard"` (`smoke.mjs:171`) – gdy plan zmieni `next` smoke na `/timers`, ta asercja padnie. Kryterium 2.5 twierdzi, że CI to sprawdza, ale plan nie definiuje takiego kroku.
- **Fix**: W Phase 4 (lub 2 przy Fix A z F1) dodać jedno żądanie linku bez `next` i asercję, że `next` w callbacku to `/timers`; rozszerzyć `:171` o `/timers`.
- **Decision**: FIX — Fixed: phase 2 smoke sends a link request without `next` and asserts `next=/timers`; L171 accepts `/timers`.

### F3 — Smoke nie dowodzi braku wycieku listy na `/dashboard`, gdy timery istnieją

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 („the account step asserts … no list”)
- **Detail**: „No list” bez konkretu da się spełnić asercją sprawdzającą pusty stan albo brak nagłówka. Krok `verifyDashboardAndSignOut` biegnie po utworzeniu timerów (w tym 50 z testu limitu), więc to właściwe miejsce na dowód, że strona konta nie renderuje danych z bazy.
- **Fix**: W kroku konta (lub zaraz po `verifyOwnSavedDrillPages`) asercja: `/dashboard` 200, `no-store`, zawiera `Account` i email, link `href="/timers"`, i NIE zawiera `savedDrill.id`, `savedDrill.name`, `Saved timers` ani `You have no saved timers yet.`.
- **Decision**: FIX — Fixed: phase 1 account step asserts absence of saved timer id/name, `Saved timers` and the empty text on `/dashboard`.

### F4 — Reset bfcache w współdzielonym `useDrillCreate` przeładuje też stronę edycji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 (Hook)
- **Detail**: `useDrillCreate` obsługuje i `/create`, i `/{id}/edit` (`DrillEditApp.tsx:29`). Plan dodaje w hooku `pageshow` z `reset()` + `window.location.reload()` „like `useDrillDelete`”. Na edycji przywrócenie z bfcache wyrzuci niezapisane zmiany, choć nic tam nie utknęło w `saving`. Kontrolerowy `reset()` też nie ma zdefiniowanej semantyki dla edycji.
- **Fix**: Rejestrować `pageshow` tylko w trybie create (bez `keepAfterSave`) i tylko gdy nastąpiła nawigacja (np. `reset()` zwraca, czy był stan „leaving”, a reload tylko wtedy); dodać test kontrolera „edit: reset nie zmienia stanu”.
- **Decision**: FIX — Fixed: `pageshow` reset/reload only in create mode after a navigation; edit unchanged; `reset()` no-op in edit with a test.

### F5 — Kryterium 2.4 (grep) jest nieprawdziwe w zapisanej formie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Automated Verification (2.4)
- **Detail**: `grep -rn "Back to dashboard\|\"/dashboard\"" src` po Phase 2 nadal zwróci: `PROTECTED_ROUTES` (`protected-routes.ts:3`), redirect w `dashboard.astro`, link email w `AppTopBar.astro:25` oraz testy z jawnym `next=/dashboard` (`email-auth.test.ts`, `protected-routes.test.ts`). Opis „returns only the bar email link and the account page route” nie przejdzie dosłownie, więc implementujący będzie zgadywał.
- **Fix**: Zawęzić do `grep -rn "Back to dashboard\|href=\"/dashboard\"" src --include=*.tsx --include=*.astro` z oczekiwanym wynikiem „tylko `AppTopBar.astro`” albo wypisać pełną listę dozwolonych trafień.
- **Decision**: FIX — Fixed: grep narrowed to `*.tsx`/`*.astro` with only `AppTopBar.astro` expected.

### F6 — Pominięty fallback `"/"` w `verifyEmailLink`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis / Phase 2 §1
- **Detail**: Plan wylicza fallbacki `email-auth.ts:51, :81, :98, :137`, ale `verifyEmailLink` ma też `next: "/"` w `:193`. Bez zmiany ścieżka błędu weryfikacji zostawi stary cel.
- **Fix**: Dodać `:193` do listy miejsc używających `DEFAULT_NEXT_PATH` i dodać do kryteriów Phase 2: `grep -n '"/"' src/lib/email-auth.ts` nie zwraca żadnego fallbacku `next`.
- **Decision**: FIX — Fixed: `email-auth.ts:193` uses `DEFAULT_NEXT_PATH`; added grep criterion 2.6.

### F7 — Fixture `redirecting` dubluje `saving`; `drill.id` walidowane tylko jako niepusty string

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 §1, §3
- **Detail**: W create `redirecting` renderuje dokładnie te propsy co istniejący scenariusz `saving` (`CreateDrillFixtures.tsx:65`), więc jest wizualnym duplikatem. `isSaveDrillResponse` sprawdzający tylko niepusty string jest bezpieczny dzięki `encodeURIComponent`, ale id spoza UUID zaprowadzi na 404.
- **Fix**: Usunąć scenariusz `saved` z create bez dodawania `redirecting` (albo opisać `saving` jako „also the redirect state”); opcjonalnie walidować `drill.id` tym samym wzorcem UUID co `isSavedDrillPath`.
- **Decision**: FIX — Fixed: no `redirecting` fixture; `saving` doubles as the redirect state. `drill.id` stays a non-empty string (encodeURIComponent keeps it safe).
