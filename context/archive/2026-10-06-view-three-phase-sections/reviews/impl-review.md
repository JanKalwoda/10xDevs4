<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: View three phase sections (S-04)

- **Plan**: context/changes/view-three-phase-sections/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION (po poprawkach: F1, F3, F6 naprawione; F4, F5 zaakceptowane; F2 czeka na człowieka)
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Gates uruchomione przy przeglądzie: `npm test` 100/100, `npm run lint` 0 błędów, `npx astro check` 0 błędów. Sprawdzono też: pliki zmienione względem planu (8 plików src, wszystkie z planu), brak zmian poza zakresem, `next` liczone w jednym helperze `nextAfter` dla obu gałęzi `display`, `resumeTarget` zerowany po ukończeniu przygotowania (`drill-run.ts:126`), `next` po pauzie/wznowieniu zgodne z `tick()` (`:125`) i `rebuild()` (`:284`). Brak wycieku losowego Standby: `DrillPhase` dla standby ma tylko `repetition`, a widok i model nie dotykają `Segment`/`sampledWait`. Testy różnicowe (1 s vs 5 s) i test zestawu kluczy `display` pokrywają ten przypadek.

## Findings

### F1 — Redundantne „Standby · Standby” w sekcji bieżącej

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/timer/PhaseSections.tsx:25-28, src/lib/drill-phase-sections.ts:56
- **Detail**: Dla Standby nagłówek sekcji bieżącej renderuje nazwę fazy „Standby” i, w miejscu czasu, słowo „Standby” (`current.time = phaseTime(phase) ?? "Standby"`). Zrzuty (`standby-exercise-*-390.png`) pokazują „Standby · Standby”, a pod spodem jeszcze „Repetition 1 of 3” i wielkie „Standby” w sekcji głównej, czyli słowo trzy razy na ekranie. FR-013 mówi „dla Standby zamiast czasu widoczny jest napis Standby”. Gdy nazwą fazy jest już samo „Standby”, wymaganie jest spełnione przez nagłówek, a wstawianie drugiego słowa tylko je powtarza. Czytnik ekranu odczyta „Standby · Standby”. Plan pierwotnie przewidywał `current.time: string | null`; zmiana na `string` z „Standby” (decyzja koordynatora) dała tę redundancję.
- **Fix**: W sekcji bieżącej nie renderuj sufiksu czasu dla Standby: przywróć `current.time: string | null` (null dla Standby) i pokaż `Standby` + linię `Repetition X of N`.
  - Rekomendowane sformułowanie: nagłówek **„Standby”**, linia pod spodem **„Repetition 1 of 3”**; sekcja główna zostaje z wielkim **„Standby”**; „Next: Standby” bez zmian. To zgodne z FR-005 (napis „Standby” w obszarze bieżącej fazy, bez odliczania) i FR-013 (słowo zastępuje czas, nie liczbę), bez dublowania. Nie dodawaj tekstu typu „random start”/„wait for the signal”: nie ma go w PRD, a drugi wariant „Standby — get ready” zmieniałby język fazy.
  - Zmiany: `drill-phase-sections.ts` (`time: phaseTime(phase)`), `PhaseSections.tsx` (renderuj `· {time}` tylko gdy `time`), aktualizacja asercji w `drill-phase-sections.test.ts` i skryptu Playwright; odśwież zrzuty `standby-*`.
- **Decision**: FIXED — `current.time: string | null` (null dla Standby); nagłówek „Standby” + „Repetition X of N” bez sufiksu czasu; main i „Next: Standby” bez zmian. Testy i zrzuty `standby-*` odświeżone (gate: 424 checks, 0 failed).

### F2 — Kroki ręczne 2.3 i 3.3 nadal otwarte, a zmiana oznaczona `implementing`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/view-three-phase-sections/plan.md:225, :236
- **Detail**: 2.3 (prawdziwy przebieg na `/` przy 390/1280 px, jasny/ciemny) i 3.3 (ludzki przegląd zrzutów) są `[ ]`. Zrzuty i `gate-results.json` zrobił skrypt, nie człowiek (README to ujawnia). Prawdziwy przebieg na `/` nie został wykonany nawet skryptem: fixture `/dev/timer-ui` nie dowodzi, że `DrillTimer` na `/` poprawnie przekazuje `next` po żywym wznowieniu. Obecny przegląd (ocena zrzutów) częściowo realizuje 3.3, ale potwierdzenie należy do człowieka (zgodnie z `lessons.md` oznacz po potwierdzeniu).
- **Fix**: Wykonać 2.3 ręcznie (plan Manual Testing Steps 1-4) i oznaczyć 2.3/3.3 po potwierdzeniu; dopiero potem PR.
- **Decision**: DEFERRED-TO-HUMAN — kroki 2.3 i 3.3 zostają otwarte; opisane w handoff.md i w opisie PR.

### F3 — Plan i PRD nieaktualne względem zaimplementowanych decyzji

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md:75, context/foundation/prd.md:67
- **Detail**: Plan nadal opisuje `current.time: string | null`, a kod ma `string` (zmieni się z F1). PRD US-02 pisze „Next: Rest — 2 s”, a UI pokazuje „Next: Rest — 0:02”; odchylenie jest zapisane w planie jako zatwierdzone, ale PRD nie ma adnotacji.
- **Fix**: Po F1 zsynchronizować plan (typ `current.time`) i dodać krótką adnotację o formacie `m:ss` przy US-02/FR-013.
- **Decision**: FIXED — plan.md zsynchronizowany (brak sufiksu czasu dla Standby; jawne odstępstwo `m:ss` od „2 s” z PRD). `prd.md` celowo nie edytowany.

### F4 — Przygotowanie po wznowieniu nie mówi, które to powtórzenie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/drill-phase-sections.ts:57
- **Detail**: Podczas przygotowania po wznowieniu sekcja bieżąca pokazuje „Preparing”, a następna „Next: Exercise — 0:04” bez numeru powtórzenia; „to samo powtórzenie” (FR-006) widać tylko w testach. Logika `next` jest poprawna (zweryfikowana w kodzie i testach), więc to kwestia czytelności, nie błąd. README zrzutów to przyznaje.
- **Fix**: Opcjonalnie dodać do `detail` przy wznowieniu „Preparing · repetition 2” (wymaga wystawienia numeru z `next`, bez ruszania sampledWait). Można też świadomie pominąć jako poza zakresem S-04.
  - Strength: użytkownik widzi, które powtórzenie się zaczyna. Tradeoff: odstępstwo od planowanego „Preparing”, dodatkowy test. Confidence: MED. Blind spot: nie sprawdzono, czy PRD tego oczekuje (FR-013 tego nie wymaga).
- **Decision**: ACCEPTED-AS-IS — FR-013 nie wymaga numeru powtórzenia w przygotowaniu po wznowieniu, a logika `next` jest pokryta testami; dodanie go byłoby odstępstwem od planu poza zakresem S-04.

### F5 — Brak komunikatu dla czytników ekranu o zmianie fazy / następnej fazie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/timer/PhaseSections.tsx:30
- **Detail**: Grupa „Next phase” ma etykietę, ale brak live region; zmiana nazwy fazy (`h2`) nie jest ogłaszana (stan sprzed zmiany też tego nie miał, więc nie regres). `role="timer"` ma domyślnie `aria-live="off"`. Kontrasty wynikają z tokenów motywu (zrzuty czytelne w jasnym i ciemnym).
- **Fix**: Opcjonalnie wspólny `role="status"` z tekstem „<Phase>. Next: …” aktualizowany tylko przy zmianie fazy; można odłożyć do S-05/ścieżki dostępności.
- **Decision**: ACCEPTED-AS-IS — live region ogłaszający co sekundę odliczanie (lub zmiany fazy razem z odliczaniem) byłby uciążliwy dla użytkownika czytnika ekranu; stan sprzed zmiany też go nie miał, więc nie regres. Dostępność do ewentualnego osobnego kroku.

### F6 — Zbędne `cn()` z jednym statycznym łańcuchem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/timer/PhaseSections.tsx:30
- **Detail**: `cn("bg-muted border-border rounded-lg border px-4 py-3")` nie scala niczego; import `cn` jest zbędny.
- **Fix**: Zamienić na zwykły `className="..."` i usunąć import.
- **Decision**: FIXED — usunięto zbędne `cn()` i import.
