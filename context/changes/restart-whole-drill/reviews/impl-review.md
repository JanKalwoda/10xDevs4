<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Restart the Whole Drill Implementation Plan

- **Plan**: context/changes/restart-whole-drill/plan.md
- **Scope**: Full plan (fazy z kompletną implementacją; 2.2 częściowo oczekuje na post-push CI koordynatora)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations (F1, F3, F4 naprawione; F2 zaakceptowane/udokumentowane)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence summary

- Lokalne bramki uruchomione ponownie w trakcie przeglądu (HEAD a3a7d01): `npx astro sync`, `npm run lint`, `npm test` (74/74), testy reguł ESLint (4/4), `npx astro check` (0 errors / 0 warnings / 0 hints), `npm run build` — wszystkie PASS.
- Plan ↔ diff: wszystkie pliki z „Changes Required” obecne (`DrillTimerView`, `DrillTimer`, `DrillApp`, `drill-run-identity.ts` + test, `drill-run.test.ts`, `TimerUiPreview`, `drill-visibility.ts`, testy lifecycle, `AGENTS.md`, screenshoty phase-1/phase-2). `drill-timer.test.ts` i `drill-wake-lock.test.ts` nie zmienione — dozwolone przez plan („only where not already covered” / „retain existing tests”). `timer-ui.astro` nie zmieniony — zgodnie z warunkiem planu.
- Izolacja runów: `key={activeRun.identity}` wymusza nową instancję `DrillTimer` (nowe refy, `DrillRun`, resume-pending state, subskrypcja widoczności, interval). Cancel/Restart dzielą `retireIntent` (synchroniczny latch + idempotentny `disposeRef`), rodzic odrzuca wycofaną tożsamość przez `identityState.retire`, completion przez `identityState.complete`. Zasoby (audio + Wake Lock) tworzone synchronicznie w geście przez wspólne `createActiveRun`. Stary wake/tick, późne audio, późny grant Wake Lock i hidden po wymianie pokryte testami Node i fixture held-mounted.
- Kontrakt UI: Restart to współdzielony `Button` outline `size="icon"` `size-12`, `RotateCcw` `aria-hidden`, `aria-label="Restart drill"`; brak literałów kolorów/arbitralnych wymiarów (lint z regułą timer-ui-contract PASS).

## Findings

### F1 — DrillApp omija nowy DrillVisibilityPort

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/timer/DrillApp.tsx:66-77
- **Detail**: `createActiveRun` nadal czyta `document.hidden` i ręcznie subskrybuje `visibilitychange` dla `createDrillWakeLockSession`, choć faza 2 wprowadziła `browserDrillVisibility`, a nowa reguła AGENTS.md mówi „Timer visibility reads go through the `DrillVisibilityPort` … not `document.hidden`”. Fixture (`createHeldTimerHarness`) już składa sesję Wake Lock z portu, więc produkcja i preview używają dwóch różnych ścieżek widoczności dla tej samej sesji. Funkcjonalnie poprawne (te same zdarzenia), ale łamie świeżo zapisaną regułę i duplikuje adapter.
- **Fix**: W `createActiveRun` użyć `browserDrillVisibility` (`() => !browserDrillVisibility.isHidden()` oraz `browserDrillVisibility.subscribe(() => { if (browserDrillVisibility.isHidden()) onHidden(); })`), identycznie jak w fixture.
- **Decision**: FIXED — `createActiveRun` używa `browserDrillVisibility` (isHidden/subscribe), jak fixture.

### F2 — Ręczne pozycje Progress odhaczone na podstawie automatu, nie człowieka

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/restart-whole-drill/plan.md:226-239
- **Detail**: 1.3, 1.4, 2.3, 2.4 są `[x]` z adnotacją „zweryfikowane skryptem Playwright … (nie człowiek)”. Handoff fazy 1 wprost mówił, że wymagają potwierdzenia człowieka; lessons.md („Oznaczaj potwierdzone kroki weryfikacji jako wykonane”) wiąże odhaczenie z potwierdzeniem użytkownika. Dowody (screenshoty, README, liczby asercji) istnieją, więc to nie jest pozorne odhaczenie, ale status odbiega od reguły.
- **Fix**: Przed merge uzyskać potwierdzenie człowieka dla 1.3/1.4/2.3/2.4 (lub jawnie zaakceptować weryfikację automatem w handoff/Progress).
- **Decision**: ACCEPTED — zostaje udokumentowane (weryfikacja automatem, nie człowiekiem; opisane w Progress, handoff i PR).

### F3 — fireCapturedWake zawsze zwraca true

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/TimerUiPreview.tsx (FixtureClock.fireCapturedWake)
- **Detail**: Plan: „fireCapturedWake(handle) must return true exactly when that captured callback was invoked”. Implementacja bezwarunkowo wywołuje callback i zwraca `true`, a licznik `staleWakeFires` jest inkrementowany przez `RestartLab`, nie przez sam callback. Spełnia to literę kontraktu (callback zawsze jest wywoływany), ale sygnał jest tautologiczny — nie dowodzi, że callback faktycznie dotarł do `DrillRun` (to dowodzą testy Node w `drill-run.test.ts`).
- **Fix**: Opakować przechwycony callback licznikiem wywołań w `captureActiveWake` i zwracać/raportować rzeczywistą liczbę wywołań.
- **Decision**: FIXED — `captureActiveWake` opakowuje callback licznikiem `invocations`; `fireCapturedWake` zwraca `true` tylko gdy licznik realnie wzrósł (asercja `stale-wake-fires` w skrypcie Playwright S2 przechodzi).

### F4 — Inicjalizacja identity state przez mutację refa w renderze

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/timer/DrillApp.tsx:57-59
- **Detail**: `identityStateRef.current ??= createDrillRunIdentityState()` w ciele renderu. Działa (idempotentne, także w StrictMode), ale preview używa idiomu `useState(() => new RestartLab())`, który jest prostszy i nie zapisuje refa w renderze.
- **Fix**: `const [identityState] = useState(createDrillRunIdentityState);`
- **Decision**: FIXED — `useState(createDrillRunIdentityState)` zamiast mutacji refa w renderze.
