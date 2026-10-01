<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dopracowanie widoku głównego timera

- **Plan**: context/changes/polish-timer-view/plan.md
- **Scope**: Phase 2 of 4
- **Reviewed phases**: 2
- **Date**: 2026-10-01
- **Commit**: 9ebd6524dfa4417920ac0a1e22ea5565d1f525f9
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Ciemny motyw obniża czytelność przebiegu i pauzy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Success Criteria
- **Location**: src/components/timer/DrillApp.tsx:40
- **Detail**: Faza 2 zmienia powierzchnię całej aplikacji na `bg-card text-card-foreground` i udostępnia dark mode również podczas ćwiczenia. Tymczasem `DrillTimer.tsx:100,102,106` nadal używa `text-slate-900`, `text-slate-950` i `text-slate-700`. Te ciemne teksty trafiają na ciemną kartę (`--card: oklch(0.205 0 0)`), przez co nazwa fazy, licznik i numer powtórzenia tracą czytelność. Komunikat pauzy w `DrillTimer.tsx:87–88` dziedziczy jasny tekst na jasnym `bg-blue-50`. Reprodukcja: wybrać dark mode, kliknąć Start, następnie ukryć i przywrócić stronę. Regresję wprowadza zmiana wspólnej powierzchni, choć sam DrillTimer nie był edytowany w tej fazie. Migracja prezentacji zaplanowana na fazę 3 nie zabezpiecza obecnego stanu.
- **Fix**: Podłączyć tekst fazy, licznika i powtórzenia oraz powierzchnię/tekst pauzy do tokenów; sprawdzić przebieg i pauzę w obu motywach przy 1280/390 px i uzupełnić pomiary kontrastu oraz zrzuty.
- **Decision**: PENDING

## Verification

- Ponownie uruchomiono `npm run lint`: PASS.
- Ponownie uruchomiono `npm run astro -- check`: PASS, 49 plików, 0 errors, 0 warnings, 0 hints.
- Ponownie uruchomiono `npm run build`: PASS, Cloudflare SSR build complete.
- Ręczne kryteria 2.2–2.4 są odhaczone i mają zapisane dowody w `ui-verification.md`, `p2-browser-results.json` i dziewięciu zrzutach. Podczas przeglądu obejrzano zrzut konfiguracji dark/390; nie powtarzano interakcji przeglądarkowych ani pomiarów kontrastu.
- Zapisane pomiary obejmują wyłącznie konfigurację. Dokumentacja jawnie wyłącza przyszłe stany przebiegu/błędów; nie dowodzi więc czytelności działającego timera po zmianie powierzchni. Kryterium 2.3 wymaga uzupełnienia o regresję F1.
- Zachowano istniejące wartości i mapowania global.css, a ich role i źródło opisano w theme-values.md. Brak zmienionego bloku CSS wymagającego komentarza.
- Wcześniejsze podłączenie motywu na index.astro i semantycznych kolorów tekstu formularza jest udokumentowane oraz potrzebne do weryfikacji rzeczywistego widoku; nie stanowi nieuzasadnionego rozszerzenia zakresu.
- Inicjalizacja przed malowaniem, walidacja zapisanej preferencji, fallback systemowy, obsługa błędów magazynu, dostępne nazwy i cleanup listenera odpowiadają planowi. Brak zmian w silniku, audio i autoryzacji.
- Przeprowadzono dwa niezależne przeglądy: zgodności z planem oraz jakości/bezpieczeństwa. Ustalenia skonsolidowano do F1.
- Istniejące niezacommitowane dopisanie SHA w Progress plan.md pozostawiono poza zakresem zapisu przeglądu.

## UI charges

C1: kontrakt tokenów opisany; pełne podłączenie widoku pozostaje w fazie 3, z regresją F1 do rozstrzygnięcia. C2–C5 nie należą do zakresu fazy 2 i nie otrzymują tutaj końcowej oceny.
