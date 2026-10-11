<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX fixes round 3 (S-22)

- **Plan**: context/changes/ux-fixes-round-3/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Weryfikacja (uruchomiona przez recenzenta na HEAD 9a4a412)

- `npx astro sync`, `npm run lint` (0 błędów), `npm test` (268/268), `node --test scripts/eslint-rules/*.test.mjs` (6/6), `npx astro check` (0 errors, 0 warnings, 1 hint), `npm run build` — wszystko zielone.
- Skrypty Playwright bramki wizualnej nie były uruchamiane ponownie (wymagają Playwright i lokalnego Supabase); przejrzano zapisane wyniki `ux-fixes-round-3-checks.json` i zrzuty w folderze zmiany.

## Analiza kluczowych obszarów

- **`drill-step-press.ts`**: jeden krok zawsze z `click`; `pointerdown` tylko uzbraja powtarzanie (`arm`, 400 ms), więc podwójny krok jest wykluczony niezależnie od opóźnienia `click`. Flaga `skipClick` jest kasowana przez `click`, nowy `pointerdown`, `blur` lub przerwanie gestu — nigdy timerem; `lostpointercapture` po `pointerup` jest no-opem (`pressed=false`), więc nie kasuje flagi przed `click` (zgodnie z kolejnością zdarzeń). Zgubiony krok z klawiatury/AT wykluczony: pominięcie dotyczy tylko `detail > 0` (`fromPointer`), a `click` z `detail 0` zawsze stepuje i kasuje flagę (także gdy po długim przytrzymaniu na dotyku przeglądarka nie wyśle `click`). Granica: `aria-disabled` + `canStep` w `pointerDown` i `click`. Sprzątanie: `useStepRepeat` woła `press.blur()` (stop repeatera) przy odmontowaniu, poprawnie dla StrictMode/Fast Refresh; `createStepRepeater.arm` anuluje pauzę i interwał w `stop`/`dispose`. Testy (`drill-step-press.test.ts`, `drill-step-repeat.test.ts`) pokrywają te ścieżki.
- **`input-group.tsx`**: tylko tokeny semantyczne (`border-input`, `ring-ring`, `destructive`), jedna ramka i jeden focus ring przez `has-[...]`, plik dodany do zakresu lintu timer-ui (`eslint.config.js`) i lint przechodzi.
- **Układ**: domyślnie kolumna (fine, także laptop dotykowy), `pointer-coarse:` — dwa przyciski 44 px (▼ ▲) z separatorem; wbudowane warianty Tailwinda, bez `@custom-variant` i bez `any-pointer`. Brak overflow 390 px potwierdzają zapisane checki (widoki `/`, `/create`, edit, run).
- **Current / Next**: ten sam `rounded-lg border px-4 py-3`, Current `border-transparent` bez tła — równa wysokość z konstrukcji; model i testy `drill-phase-sections` bez zmian.
- **Tooltip**: `md:max-w-md`, telefon bez zmian (`max-w-xs`).
- **Dokumentacja**: AGENTS.md (Current, tooltip, stepper, `drill-step-press.ts`, `input-group.tsx` w zakresie lintu, gate S-22), PRD FR-018/FR-020, roadmapa S-22, `ux-fixes-plan.md` zgodne z implementacją.

## Findings

### F1 — `input-group.tsx` to uproszczona, ręczna kopia rejestru shadcn

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/input-group.tsx:1
- **Detail**: Plan zakładał `npx shadcn@latest add input-group` (z `textarea.tsx`); wdrożono zredukowany plik (bez `InputGroupButton`, `InputGroupText`, `InputGroupTextarea`), co jest opisane w komentarzu nagłówkowym, a AGENTS.md nazywa go „shadcn". Kolejny `shadcn add input-group` nadpisze plik wersją niezgodną z kontraktem tokenów.
- **Fix**: Zostawić; ewentualnie dopisać w AGENTS.md, że plik jest świadomie zredukowany i po ponownej instalacji wymaga przywrócenia adaptacji.
- **Decision**: PENDING

### F2 — Niepodpisane `role="group"` na `InputGroup` i `InputGroupAddon`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/input-group.tsx:21,29
- **Detail**: Każde pole konfiguracji ma teraz dwa bezimienne landmarki `group` (ramka i dodatek ze strzałkami); czytnik ekranu zapowie „grupa" bez nazwy. Nie blokuje działania (pole ma `Label`, przyciski mają nazwy), ale to szum AT.
- **Fix**: Usunąć `role="group"` z `InputGroupAddon` (a z `InputGroup` także, jeśli nie ma `aria-label`).
- **Decision**: PENDING

### F3 — Nieplanowane zmiany: `h-auto whitespace-normal` w `TimerUiPreview` i `text-pretty` w tooltipie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/timer/TimerUiPreview.tsx:943, src/components/ui/tooltip.tsx:25
- **Detail**: Dwie drobne zmiany spoza listy „Changes Required" (prawdopodobnie poprawka overflow przycisków scenariuszy na 390 px i lepsze łamanie tooltipu). Nieszkodliwe, dev-only / kosmetyczne, bez wpływu na kontrakt.
- **Fix**: Zostawić; wspomnieć w opisie PR.
- **Decision**: PENDING

### F4 — Zamknięcie zmiany: `change.md` i wiersz 4.3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ux-fixes-round-3/plan.md (Progress 4.3)
- **Detail**: Wiersz 4.3 („Zrzuty przejrzane, dokumentacja zgodna z implementacją") pozostaje `[ ]`; po tym przeglądzie dokumentacja jest potwierdzona jako zgodna, zrzuty zostały pokazane w checks JSON. Roadmapa S-22 ma `in-progress` (poprawnie do merge). Smoke lokalny niedostępny — potwierdzi go CI.
- **Fix**: Koordynator odhacza 4.3 po decyzji o F1–F3, następnie PR do `main` i `/10x-archive` po merge.
- **Decision**: PENDING
