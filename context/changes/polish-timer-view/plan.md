# Dopracowanie widoku głównego timera — Implementation Plan

## Overview

Dopracować istniejący widok pod `/`: konfigurację, uruchamianie, przebieg, automatyczną pauzę i zakończenie. Ujednolicić go z systemem Tailwind 4 + shadcn/ui, zachowując angielskie UI i obecną logikę ćwiczenia. Dodać wybór jasnego/ciemnego motywu z zapamiętaniem preferencji; bez zapisanej preferencji korzystać z wyglądu urządzenia.

## Current State Analysis

`DrillApp` przełącza konfigurację, przebieg i zakończenie oraz zachowuje ostatnie wartości formularza. Formularz ma cztery pola, checkbox Random start i walidację. `DrillTimer` pokazuje jedną fazę, czas poza Standby, powtórzenie, ostrzeżenie audio i Resume po ukryciu strony. Silnik faz i harmonogram audio mają testy Node.

Audyt `research.md` wskazuje 22 wystąpienia klas palety w plikach timera, zero bezpośrednich klas semantycznych kolorów oraz dwa importy wspólnego Button. Tokeny light/dark istnieją, ale nie ma przełącznika. W katalogu UI są tylko Button i LibBadge. Nie ma runnera zrzutów ani testów interakcji React; smoke sprawdza stronę główną wyłącznie przez HTTP 200.

Start odblokowuje Web Audio w gesturze użytkownika, lecz faktyczny przebieg rusza dopiero po rozwiązaniu obietnicy audio. W oczekiwaniu ekran pokazuje nieruchomy czas pierwszej fazy. Layout zawsze pokazuje brak konfiguracji Supabase, mimo że timer gościa od niej nie zależy.

| Zarzut | Obsługa w planie |
| --- | --- |
| C1: palety omijają tokeny | Faza 2 ustala wartości i role; faza 3 podłącza widok; faza 4 zabezpiecza kontrakt. |
| C2: osobne pola i checkbox | Faza 1 dostarcza prymitywy; faza 3 zachowuje kontrakt formularza przy ich użyciu. |
| C3: osobny Resume | Faza 3 zastępuje go istniejącym Button. |
| C4: nieczytelne uruchamianie audio | Faza 3 pokazuje status w miejscu licznika do rzeczywistego startu. |
| C5: ostrzeżenie konta na timerze | Faza 3 wyłącza je na `/`, zachowując domyślne zachowanie stron konta. |

Żaden zarzut nie jest odroczony. Ocena MEDIUM; po rozszerzeniu wywiadu użytkownik rozstrzygnął pięć pytań. Polecenie kontynuacji przyjęto jako akceptację przedstawionych czterech faz.

## Desired End State

Timer ma spokojny, neutralny wygląd. Formularz pozostaje w jednej kolumnie na telefonie i komputerze. Czytelność opiera się na hierarchii typografii, odstępach i powierzchniach, nie na nowych kolorach faz. Start, Resume i Return to configuration używają wspólnego Button; pola i komunikaty korzystają z prymitywów repozytorium.

Przy pierwszym wejściu strona używa aktualnego motywu urządzenia. Ręczny wybór jasnego lub ciemnego motywu zostaje zapisany lokalnie i ma pierwszeństwo po odświeżeniu. Dopóki nie ma ręcznego wyboru, zmiana preferencji systemowej aktualizuje wygląd. Ta zmiana nie dodaje osobnej opcji resetowania preferencji.

Po Start widoczny jest dostępny status „Starting timer…” z dyskretnym wskaźnikiem w przestrzeni przeznaczonej na licznik. Po inicjalizacji rozpoczyna się dotychczasowy przebieg; niedostępne audio nadal oznacza ćwiczenie w ciszy z komunikatem. Bez Supabase publiczny timer nie pokazuje ostrzeżenia o koncie.

### Key Discoveries:

- `src/styles/global.css:6-111` — istniejące wartości w `:root` / `.dark`, publikacja w `@theme inline`; rozszerzać ten kontrakt.
- `src/components/ui/button.tsx:8-22` — wspólne warianty hover, focus i disabled; nie tworzyć drugiego przycisku.
- `src/components/timer/DrillConfigForm.tsx:26-51,60-75` — powiązania etykiet, podpowiedzi i błędów oraz zamrożony snapshot konfiguracji.
- `src/components/timer/DrillApp.tsx:29-34` oraz `src/lib/drill-audio.ts:58-77` — inicjalizacja audio musi pozostać w gesturze Start.
- `src/components/timer/DrillTimer.tsx:24-73` i `src/lib/drill-run.ts:76-100` — początek przebiegu, subskrypcja i cleanup.
- `src/layouts/Layout.astro:6-10,22-35` — wspólny layout wymaga jawnego opt-in/opt-out dla funkcji timera.
- `package.json:6-14,58-64`, `eslint.config.js:42-71`, `.github/workflows/ci.yml:19-22` — dostępne weryfikacje i hook; CI obecnie nie uruchamia `npm test`.

## What We're NOT Doing

- Trzy sekcje aktualnej i następnej fazy, wybór kolorów faz, nowe sterowanie pause/cancel/restart, odsłuch sygnałów i zapis konfiguracji.
- Zmiana reguł losowania, długości sygnałów, kolejności faz, pomijania zerowych czasów lub synchronizacji Bluetooth.
- Rebranding stron konta i dashboardu, drugi system projektowy, `shadcn init`, Storybook lub instalacja runnera screenshotów.
- Nowy model danych, endpointy, migracje Supabase lub zależność timera od logowania.
- Publiczna strona demonstracyjna, produkcyjne przełączanie fikcyjnych stanów ani sztuczne opóźnienie Start.

## Implementation Approach

Kolejność: minimalne wspólne komponenty → tokeny i motyw → jeden widok → stany, bramka i zabezpieczenie. Dodać przez istniejącą ścieżkę shadcn tylko Input, Label, Checkbox, Card i Alert, które ten widok wykorzysta. Dane i logika pozostają w dotychczasowych komponentach; wydzielić prezentację przebiegu tylko w zakresie potrzebnym do renderowania rzeczywistych komponentów ze stabilnymi fixture'ami.

Bramką będzie lokalna strona `/dev/timer-ui`, dostępna wyłącznie w development, prezentująca wspólne komponenty i stany widoku bez działających zegarów lub dźwięku. Zrzuty i opis oceny trafiają do folderu zmiany. Korzystać z dostępnej przeglądarki lub ręcznego wykonania zrzutów; brak automatyzacji nie zwalnia z bramki i nie uzasadnia instalacji runnera.

## Critical Implementation Details

### Timing & lifecycle

`createDrillAudio()` musi zostać wywołane w handlerze Start przed przejściem widoku, a nie w późniejszym efekcie. Status uruchamiania kończy się dopiero po rozpoczęciu `DrillRun` i otrzymaniu początkowego display. Zachować zamknięcie portu rozwiązanego po unmount, sprzątanie interwału/listenera i brak automatycznego wznowienia po powrocie z tła.

### State sequencing

Ustawienie klasy motywu musi nastąpić przed pierwszym malowaniem strony; stan kontrolki React musi następnie odpowiadać tej samej preferencji. SSR nie ma dostępu do localStorage. Brak lub awaria magazynu oznacza bezpieczny fallback do systemu; ręczny wybór nadal działa w bieżącej karcie. Tokeny nie mogą być duplikowane w skrypcie lub komponentach.

## Phase 1: Wspólne komponenty

### Overview

Uzupełnić istniejącą bibliotekę wyłącznie o prymitywy wykorzystywane w tej zmianie i przygotować lokalne miejsce przeglądu.

### Changes Required:

#### 1. Prymitywy formularza i powierzchni

**Files**: `src/components/ui/{input,label,checkbox,card,alert}.tsx`, `package.json`, `package-lock.json`.

**Intent**: Dodać brakujące prymitywy przez `npx shadcn@latest add input label checkbox card alert`; zachować istniejącą konfigurację new-york i źródło CSS. Zweryfikować zmiany zależności i nie nadpisywać Button ani reszty konfiguracji.

**Contract**: Komponenty są importowalne z `@/components/ui`, korzystają z tokenów i `cn()`, wspierają dostępne nazwy, błędy, fokus i disabled. Checkbox przekazuje do konfiguracji wyłącznie boolean; stan indeterminate nie trafia do modelu timera.

#### 2. Lokalny podgląd kontrolek

**Files**: `src/pages/dev/timer-ui.astro`, `src/components/timer/TimerUiPreview.tsx`.

**Intent**: Zapewnić jeden podgląd wspólnych prymitywów do porównania light/dark i dalszego rozwijania w fazie 4.

**Contract**: Trasa `/dev/timer-ui` odpowiada 404 poza development. Podgląd renderuje prawdziwe importy z UI, nie kopie ich stylów; obejmuje etykiety, podpowiedzi, błąd, disabled i działający checkbox.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run astro -- sync`, `npm run astro -- check` i `npm run build` przechodzą po dodaniu komponentów.
- Produkcyjny preview zwraca 404 dla `/dev/timer-ui`.

#### Manual Verification:

- W podglądzie wszystkie kontrolki mają nazwy, widoczny fokus klawiatury i poprawny stan disabled; checkbox działa klawiaturą.
- Zapisano i oceniono zrzuty podglądu przy 1280 px i 390 px w light/dark oraz skan widoku nie zwiększa bazowych 22 wystąpień klas palety.

**Implementation Note**: Po automatycznej weryfikacji uzyskać potwierdzenie ręcznych kryteriów przed kolejną fazą. Stan wykonania zapisywać tylko w Progress.

## Phase 2: Tokeny i motyw

### Overview

Ustalić neutralne wartości i role istniejącego kontraktu oraz wdrożyć wybór motywu zgodnie z preferencją użytkownika.

### Changes Required:

#### 1. Role i źródło wartości

**Files**: `src/styles/global.css`, `context/changes/polish-timer-view/theme-values.md`.

**Intent**: Zdeponować używane surowe wartości light/dark i ich źródło; przede wszystkim wykorzystać obecny neutralny motyw shadcn. Korygować wartości wyłącznie dla czytelności, w szczególności fokusu i błędów, dokumentując zmianę.

**Contract**: Widok korzysta z background/foreground, card/card-foreground, primary/primary-foreground, muted/muted-foreground, border/input/ring i destructive. Pauza i informacja o audio korzystają z neutralnej powierzchni i tekstu; nie dodawać kolorów faz. Wartości są w `:root` / `.dark`, a mapowania w `@theme inline` odnoszą się do zmiennych. Obok zmienionego bloku wskazać `theme-values.md`; odstępy, typografia i radius korzystają z istniejącej skali.

#### 2. Preferencja motywu i kontrolka

**Files**: `src/layouts/Layout.astro`, `src/components/ThemeInit.astro`, `src/components/timer/ThemeToggle.tsx`, `src/components/hooks/useTimerTheme.ts`, `src/components/timer/DrillApp.tsx`.

**Intent**: Zastosować motyw przed malowaniem oraz zapewnić ręczne przełączanie i trwałość wyboru. Obsługę motywu timera włączyć jawnie na stronie głównej, aby nie zmieniać przy okazji wyglądu konta.

**Contract**: Layout otrzymuje opcjonalne `enableTimerTheme?: boolean`, domyślnie false. Klucz localStorage `drill-timer-theme` przyjmuje `light` lub `dark`; brak/niepoprawna wartość oznacza aktualną preferencję urządzenia. Poprawny zapis ma pierwszeństwo. Systemowe zmiany obserwować tylko bez ręcznego wyboru; listener sprzątać. Kontrolka używa Button, ma dostępną nazwę opisującą akcję i stan oraz nie powoduje błędu hydratacji. Odczyt/zapis magazynu może zawieść bez zablokowania timera.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run astro -- check` i `npm run build` przechodzą po zmianach motywu.

#### Manual Verification:

- Bez zapisanej preferencji pierwsze malowanie i późniejsze zmiany wyglądu urządzenia dają właściwy motyw; ręczny wybór wygrywa po odświeżeniu, a zablokowany magazyn nie blokuje ćwiczenia.
- Przełącznik działa klawiaturą, ma czytelną nazwę i stan, a oba motywy zachowują kontrast tekstu co najmniej 4,5:1 dla zwykłego i 3:1 dla dużego tekstu oraz widoczny fokus.
- Zapisano i oceniono zrzuty przy 1280 px i 390 px w light/dark; skan widoku nie zwiększa liczby literałów, a strony konta zachowują dotychczasową prezentację.

**Implementation Note**: Po automatycznej weryfikacji uzyskać potwierdzenie ręcznych kryteriów przed kolejną fazą. Stan wykonania zapisywać tylko w Progress.

## Phase 3: Widok timera

### Overview

Podłączyć jeden widok do kontraktu i usunąć pięć zarzutów bez zmiany zasad ćwiczenia.

### Changes Required:

#### 1. Konfiguracja i zakończenie

**Files**: `src/components/timer/DrillApp.tsx`, `src/components/timer/DrillConfigForm.tsx`.

**Intent**: Zastąpić lokalne palety i kontenery prymitywami, zachowując spokojną hierarchię i pionowy formularz. Główne działania i komunikat ukończenia mają być czytelne także na telefonie.

**Contract**: Cztery pola pozostają w jednej kolumnie. Zachować inputMode, identyfikatory, powiązania label/hint/error, aria-invalid, komunikaty walidacji, kasowanie błędu edytowanego pola, zamrożony snapshot Start i ostatnie wartości po powrocie. Random start pozostaje boolean. Układ używa Card i skali systemu; wszystkie działania używają Button, bez nowych akcji biznesowych.

#### 2. Przebieg, pauza i uruchamianie

**Files**: `src/components/timer/DrillTimer.tsx`, `src/components/timer/DrillTimerView.tsx`.

**Intent**: Ujednolicić prezentację przebiegu i komunikatów oraz wyjaśnić oczekiwanie na audio. Wydzielić prezentację potrzebną do stabilnych fixture'ów, bez przenoszenia do niej silnika.

**Contract**: Prezentacja przyjmuje display, liczbę powtórzeń, stan inicjalizacji i callback Resume; nie posiada zegara ani audio. „Starting timer…” ze wskaźnikiem zajmuje miejsce licznika do rzeczywistego startu. Po rozwiązaniu audio do null przebieg startuje w ciszy; nieoczekiwane odrzucenie obietnicy obsłużyć tym samym bezpiecznym fallbackiem, bez nowego timeoutu. Resume używa Button i zachowuje guard `!document.hidden`. Standby nie ujawnia odliczania ani losowego czasu. Przygotowanie, numer powtórzenia, zakończenie, oznaczenie roli timer i cleanup zachowują semantykę. Nie dodawać sztucznego opóźnienia ani ciągłych ogłoszeń czasu przez aria-live; status uruchamiania jest dostępny jako status.

#### 3. Publiczny punkt wejścia

**Files**: `src/layouts/Layout.astro`, `src/pages/index.astro`.

**Intent**: Oddzielić komunikat konfiguracji konta od działającego ćwiczenia gościa i włączyć obsługę motywu na timerze.

**Contract**: Layout otrzymuje `showConfigWarnings?: boolean`, domyślnie true. `/` przekazuje false i włącza `enableTimerTheme`. Strony konta zachowują ostrzeżenia; `config-status.ts`, middleware i autoryzacja pozostają zgodne z obecnym kontraktem.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm test`, `npm run astro -- check` i `npm run build` przechodzą; testy faz, losowania, audio i wznowienia zachowują dotychczasowe wyniki.
- Skan plików widoku, wydzielonej prezentacji i przełącznika wykazuje zero klas palety, literałów kolorów i arbitralnych wymiarów; obejmuje także prefiks accent.

#### Manual Verification:

- Konfiguracja, błędy, poprawny Start i Return to configuration działają jak wcześniej; formularz pozostaje w jednej kolumnie przy 1280 px i 390 px bez poziomego przewijania.
- Pending audio pokazuje „Starting timer…” bez udawanego odliczania i skoku obszaru licznika; null/rejection przechodzi do przebiegu w ciszy z komunikatem, a rozwiązanie po unmount nie uruchamia ćwiczenia.
- Losowy przebieg ukrywa czas Standby, pauza po ukryciu nie wznawia się sama, Resume działa po powrocie, a końcowy odpoczynek i pomijanie czasów 0 s pozostają zgodne z silnikiem.
- Bez Supabase i bez logowania `/` pozwala ćwiczyć bez ostrzeżenia konta, podczas gdy strony konta nadal pokazują diagnostykę; zrzuty konfiguracji, przebiegu i zakończenia oceniono w obu motywach przy 1280 px i 390 px.

**Implementation Note**: Po automatycznej weryfikacji uzyskać potwierdzenie ręcznych kryteriów przed kolejną fazą. Stan wykonania zapisywać tylko w Progress.

## Phase 4: Weryfikacja i utrwalenie

### Overview

Zamknąć macierz stanów, utrwalić bramkę wizualną i zapewnić, że kolejne zmiany używają kontraktu.

### Changes Required:

#### 1. Pełny podgląd i dowód wizualny

**Files**: `src/pages/dev/timer-ui.astro`, `src/components/timer/TimerUiPreview.tsx`, `context/changes/polish-timer-view/ui-verification.md`, `context/changes/polish-timer-view/screenshots/`.

**Intent**: Rozszerzyć podgląd o stany prawdziwego formularza i prezentacji przebiegu. Utrwalić wyniki oględzin, w tym wyjaśnienie każdej zamierzonej różnicy.

**Contract**: Deterministyczne fixture'y bez zegara i emisji audio; reuse produkcyjnych komponentów. Default, hover, focus-visible, disabled, error i loading są pokazane; empty listy konfiguracji jest N/A, ponieważ lista nie istnieje, natomiast puste pola pokazują walidację. Pokazać również Standby, pauzę, brak audio i zakończenie. Rzeczywisty hover/fokus sprawdzić interakcją i utrwalić osobno, jeśli zbiorczy zrzut ich nie obejmuje. Dowody obejmują light/dark, 1280 px i 390 px oraz zrzuty po każdej fazie wizualnej. Demo nie trafia do produkcyjnego przepływu.

#### 2. Zabezpieczenie kontraktu

**Files**: `eslint.config.js`, `scripts/eslint-rules/timer-ui-contract.mjs`, `AGENTS.md`, `.github/workflows/ci.yml`.

**Intent**: Dodać lokalną kontrolę ESLint korzystającą z istniejącego lint/pre-commit/CI i krótko opisać źródło tokenów, komponenty oraz bramkę. Włączyć istniejące testy silnika do CI.

**Contract**: Kontrola obejmuje komponenty timera, `/`, kitchen sink i nowe prymitywy z tej zmiany; nie rozszerza zakresu na zastane palety stron konta ani źródło wartości global.css. Wykrywa palety, arbitralne kolory/wymiary i inline literal colors, dopuszcza klasy semantyczne, ich opacity i istniejącą skalę. Nie dodaje zależności lint. Nowe prymitywy registry dostosować do kontraktu, gdy zawierają literały; zastany Button nie jest objęty globalnym porządkowaniem wariantów. Reguła w AGENTS.md poza blokiem CLI wskazuje źródła, ścieżkę shadcn, zakaz literałów i `/dev/timer-ui`. CI uruchamia `npm test` obok istniejących kontroli. Zmodyfikowany wcześniej przez użytkownika AGENTS.md zachować i rozszerzać punktowo.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm test`, `npm run astro -- sync`, `npm run astro -- check` i `npm run build` przechodzą; CI zawiera uruchomienie istniejących testów.
- Kontrola kontraktu odrzuca próbne klasy palety, accent palety, arbitralne kolory/wymiary i inline kolory, dopuszcza semantyczne tokeny oraz skalę systemu; końcowy skan widoku ma zero trafień.
- `npm run smoke` przechodzi przeciw produkcyjnemu preview z lokalnym Supabase, a `/dev/timer-ui` zwraca w tym preview 404.

#### Manual Verification:

- Macierz siedmiu stanów jest udokumentowana wraz z uzasadnieniem empty N/A, a zrzuty obu motywów przy 1280 px i 390 px oceniono pod kątem czytelności, fokusu i kontrastu.
- Pełny przebieg sprawdzono w przeglądarce na komputerze i telefonie: walidacja, motyw, Start, Standby, pauza/Resume, brak audio, zakończenie i zachowanie konfiguracji.
- Przegląd `/10x-impl-review` przypisuje wynik każdemu C1–C5 i ustaleniu UI; poprawki przechodzą ponownie bramkę, a odroczenia mają uzasadnienie w dokumentacji.

**Implementation Note**: Po automatycznej weryfikacji uzyskać potwierdzenie ręcznych kryteriów. Nie zaznaczać wykonania bramki na podstawie samego zielonego CI.

## Verification handoff

2026-10-01: Fazy 3 i 4 mają ukończoną implementację, automatyczne bramki i przeglądy `10x-impl-review`; znalezione luki reguły ESLint zostały poprawione. Zgodnie z poleceniem użytkownika kryteria Manual pozostają do jego końcowego potwierdzenia. Dowody z przeglądarki, ocenione zrzuty i lista nieprzetestowanych warunków fizycznego urządzenia są w `ui-verification.md`. Nie oznaczać ich jako potwierdzone przez użytkownika na podstawie automatyzacji.

## Testing Strategy

### Unit Tests:

- Uruchamiać istniejące testy `drill-timer`, `drill-run` i `drill-audio` przez `npm test`; nie dodawać testów kopiujących klasy CSS.
- Mechaniczną kontrolę nowej reguły przeprowadzić na małych wejściach poprawnych i błędnych; nie instalować frameworka komponentowego dla tej zmiany.

### Integration Tests:

- Zachować auth smoke przeciw preview i sprawdzenie 404 podglądu produkcyjnego.
- Hydratację, interakcje i lifecycle sprawdzić na rzeczywistym `/`; smoke HTTP ich nie pokrywa.

### Manual Testing Steps:

1. Usunąć zapisaną preferencję motywu i sprawdzić oba ustawienia urządzenia; wybrać motyw ręcznie i odświeżyć. Powtórzyć z niedostępnym localStorage.
2. Przejść Tab przez wszystkie kontrolki, uruchomić błędy pustych/niepoprawnych pól, poprawić wartości i sprawdzić checkbox.
3. Uruchomić krótki przebieg z przygotowaniem i odpoczynkiem dodatnim, a następnie z wartościami 0 s i z Random start. Zweryfikować ukrycie czasu Standby i końcowy odpoczynek.
4. Ukryć stronę w fazach, wrócić i wznowić ręcznie; zakończyć i wrócić do konfiguracji z tymi samymi wartościami.
5. W kontrolowanym środowisku opóźnić rozwiązanie audio, zwrócić null/odrzucenie i rozwiązać po unmount; ocenić status, silent fallback i cleanup. Nie dodawać produkcyjnych przełączników testowych.
6. Sprawdzić wejście gościa bez Supabase i diagnostykę konta; obejrzeć wszystkie fixture'y oraz zrzuty w dwóch motywach i szerokościach.

## Performance Considerations

Nie zmieniać interwału tick ani harmonogramu audio. Motyw inicjalizować małym skryptem bez żądań sieciowych; listener preferencji systemowej sprzątać. Kitchen sink ma stabilne fixture'y bez aktywnych przebiegów; wskaźnik loading respektuje ograniczenie animacji urządzenia.

## Migration Notes

Brak migracji danych. Jedyna nowa trwała preferencja to lokalny klucz motywu; brak/niepoprawna wartość nie wymaga migracji. Zależności nowych prymitywów i lockfile zapisuje faza 1. Wartości motywu mogą wpływać na współdzielone komponenty, więc porównać strony konta; nie wykonywać ich restyle. Wycofanie jest zwykłym cofnięciem commitów tej zmiany, bez operacji na Supabase.

Pracować na istniejącej gałęzi `feature/m2l5`. Planowanie pozostawia artefakty bez commita zgodnie z 10x-plan; pierwsza faza implementacji dołącza je do swojego commita. Po implementacji otworzyć PR do main, dołączyć dowody UI, przeprowadzić review i CI zgodnie z AGENTS.md.

## References

- `context/changes/polish-timer-view/change.md` — tożsamość i granice S-15.
- `context/changes/polish-timer-view/research.md` — audyt, pomiary i C1–C5.
- `context/foundation/roadmap.md` — S-15 oraz oddzielne S-04/S-05/S-06/S-14.
- `src/styles/global.css:6`, `components.json:1`, `src/components/ui/button.tsx:8` — kontrakt systemu projektowego.
- `src/components/timer/DrillApp.tsx:29`, `src/components/timer/DrillTimer.tsx:24`, `src/lib/drill-audio.ts:58` — gest Start i lifecycle.
- `src/lib/drill-run.test.ts:75`, `src/lib/drill-timer.test.ts:25`, `src/lib/drill-audio.test.ts:13` — istniejące regresje silnika.
- `.agents/skills/10x-ui/references/ui-quality-checklist.md` — bramka przeglądu UI.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wspólne komponenty

#### Automated

- [x] 1.1 `npm run lint`, `npm run astro -- sync`, `npm run astro -- check` i `npm run build` przechodzą po dodaniu komponentów. — c352124
- [x] 1.2 Produkcyjny preview zwraca 404 dla `/dev/timer-ui`. — c352124

#### Manual

- [x] 1.3 W podglądzie wszystkie kontrolki mają nazwy, widoczny fokus klawiatury i poprawny stan disabled; checkbox działa klawiaturą. — c352124
- [x] 1.4 Zapisano i oceniono zrzuty podglądu przy 1280 px i 390 px w light/dark oraz skan widoku nie zwiększa bazowych 22 wystąpień klas palety. — c352124

### Phase 2: Tokeny i motyw

#### Automated

- [x] 2.1 `npm run lint`, `npm run astro -- check` i `npm run build` przechodzą po zmianach motywu. — 9ebd652

#### Manual

- [x] 2.2 Bez zapisanej preferencji pierwsze malowanie i późniejsze zmiany wyglądu urządzenia dają właściwy motyw; ręczny wybór wygrywa po odświeżeniu, a zablokowany magazyn nie blokuje ćwiczenia. — 9ebd652
- [x] 2.3 Przełącznik działa klawiaturą, ma czytelną nazwę i stan, a oba motywy zachowują kontrast tekstu co najmniej 4,5:1 dla zwykłego i 3:1 dla dużego tekstu oraz widoczny fokus. — 9ebd652
- [x] 2.4 Zapisano i oceniono zrzuty przy 1280 px i 390 px w light/dark; skan widoku nie zwiększa liczby literałów, a strony konta zachowują dotychczasową prezentację. — 9ebd652

### Phase 3: Widok timera

#### Automated

- [x] 3.1 `npm run lint`, `npm test`, `npm run astro -- check` i `npm run build` przechodzą; testy faz, losowania, audio i wznowienia zachowują dotychczasowe wyniki. — bb6c0fc
- [x] 3.2 Skan plików widoku, wydzielonej prezentacji i przełącznika wykazuje zero klas palety, literałów kolorów i arbitralnych wymiarów; obejmuje także prefiks accent. — bb6c0fc

#### Manual

- [ ] 3.3 Konfiguracja, błędy, poprawny Start i Return to configuration działają jak wcześniej; formularz pozostaje w jednej kolumnie przy 1280 px i 390 px bez poziomego przewijania.
- [ ] 3.4 Pending audio pokazuje „Starting timer…” bez udawanego odliczania i skoku obszaru licznika; null/rejection przechodzi do przebiegu w ciszy z komunikatem, a rozwiązanie po unmount nie uruchamia ćwiczenia.
- [ ] 3.5 Losowy przebieg ukrywa czas Standby, pauza po ukryciu nie wznawia się sama, Resume działa po powrocie, a końcowy odpoczynek i pomijanie czasów 0 s pozostają zgodne z silnikiem.
- [ ] 3.6 Bez Supabase i bez logowania `/` pozwala ćwiczyć bez ostrzeżenia konta, podczas gdy strony konta nadal pokazują diagnostykę; zrzuty konfiguracji, przebiegu i zakończenia oceniono w obu motywach przy 1280 px i 390 px.

### Phase 4: Weryfikacja i utrwalenie

#### Automated

- [x] 4.1 `npm run lint`, `npm test`, `npm run astro -- sync`, `npm run astro -- check` i `npm run build` przechodzą; CI zawiera uruchomienie istniejących testów.
- [x] 4.2 Kontrola kontraktu odrzuca próbne klasy palety, accent palety, arbitralne kolory/wymiary i inline kolory, dopuszcza semantyczne tokeny oraz skalę systemu; końcowy skan widoku ma zero trafień.
- [x] 4.3 `npm run smoke` przechodzi przeciw produkcyjnemu preview z lokalnym Supabase, a `/dev/timer-ui` zwraca w tym preview 404.

#### Manual

- [ ] 4.4 Macierz siedmiu stanów jest udokumentowana wraz z uzasadnieniem empty N/A, a zrzuty obu motywów przy 1280 px i 390 px oceniono pod kątem czytelności, fokusu i kontrastu.
- [ ] 4.5 Pełny przebieg sprawdzono w przeglądarce na komputerze i telefonie: walidacja, motyw, Start, Standby, pauza/Resume, brak audio, zakończenie i zachowanie konfiguracji.
- [ ] 4.6 Przegląd `/10x-impl-review` przypisuje wynik każdemu C1–C5 i ustaleniu UI; poprawki przechodzą ponownie bramkę, a odroczenia mają uzasadnienie w dokumentacji.
