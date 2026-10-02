---
date: 2026-09-30T21:03:33+02:00
researcher: Codex
git_commit: 4c8f5f6626f1f3f0444950b6af9d2f78b8b929c4
branch: feature/m2l5
repository: 10xDevs4
topic: "Konfiguracja stylów, klasy kolorów i prymitywy UI widoku timera"
tags: [research, codebase, styles, timer, ui]
status: complete
last_updated: 2026-09-30
last_updated_by: Codex
last_updated_note: "Uzupełnienie istniejących badań o audyt 10x-ui, pomiary i zarzuty dla S-15."
---

# Research: style i klasy widoku timera

**Data:** 2026-09-30T21:03:33+02:00  
**Badacz:** Codex  
**Commit:** `4c8f5f6626f1f3f0444950b6af9d2f78b8b929c4`  
**Gałąź:** `feature/m2l5`

## Pytanie badawcze

Gdzie znajduje się główny arkusz stylów, jakie zmienne definiuje i publikuje, jakie pliki UI istnieją, gdzie w `src` występują dosłowne klasy kolorów oraz których wspólnych prymitywów brakuje dla docelowego widoku?

## Podsumowanie

Główny arkusz to `D:\Dev\10xDevs4\src\styles\global.css`; importuje go layout, a konfiguracja shadcn wskazuje ten sam plik (`src/layouts/Layout.astro:2`, `components.json:8`). W sprawdzonym arkuszu `:root` definiuje 32 zmienne, `.dark` nadpisuje 31 kolorów, a `@theme inline` publikuje 31 par kolorów i cztery rozmiary promienia (`src/styles/global.css:6-111`). W sprawdzonym katalogu `src/components/ui` znajdują się dwa pliki: `button.tsx` i `LibBadge.astro` (`src/components/ui/button.tsx:1`, `src/components/ui/LibBadge.astro:1`). Przeszukanie plików tekstowych `src` wykazało 16 plików z dosłownymi klasami kolorów; lista z kotwicami jest poniżej.

## Szczegółowe ustalenia

### Arkusz, zmienne i publikacja w Tailwind

W `:root` są zdefiniowane następujące zmienne (dokładny zbiór w `src/styles/global.css:6-39`):

| Grupa | Zmienne |
| --- | --- |
| Promień | `--radius` |
| Tło i tekst | `--background`, `--foreground` |
| Powierzchnie | `--card`, `--card-foreground`, `--popover`, `--popover-foreground` |
| Akcje | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--accent`, `--accent-foreground` |
| Treść pomocnicza i stan | `--muted`, `--muted-foreground`, `--destructive` |
| Obramowanie i fokus | `--border`, `--input`, `--ring` |
| Wykresy | `--chart-1`, `--chart-2`, `--chart-3`, `--chart-4`, `--chart-5` |
| Panel boczny | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` |

W `.dark` znajduje się dokładnie ten sam zbiór 31 zmiennych kolorystycznych; `--radius` nie jest tam nadpisany (`src/styles/global.css:41-73`). Ich wartości dla obu trybów są zapisane bezpośrednio w tych blokach.

W `@theme inline` każda z wymienionych 31 zmiennych kolorystycznych jest publikowana jako `--color-<nazwa>: var(--<nazwa>)`; przykładowo `--color-primary`, `--color-muted-foreground`, `--color-chart-1` i `--color-sidebar-ring` udostępniają odpowiednie klasy semantyczne Tailwind (`src/styles/global.css:80-110`). `--radius` jest źródłem dla `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` (`src/styles/global.css:75-79`). W sprawdzonym `src/styles/global.css` nie występuje osobny blok `@theme`; publikacja jest w `@theme inline` (`src/styles/global.css:75-111`). To ustalenie dotyczy deklaracji w źródle, bez pomiaru wyglądu w przeglądarce.

### Pliki obecne fizycznie w `src/components/ui`

Wynik `rg --files src/components/ui` zawiera dokładnie `src/components/ui/button.tsx` oraz `src/components/ui/LibBadge.astro`. `button.tsx` eksportuje `Button` i warianty (`src/components/ui/button.tsx:8-57`); `LibBadge.astro` renderuje etykietę z opcjonalną wersją (`src/components/ui/LibBadge.astro:1-13`).

### Pliki z dosłownymi klasami kolorów

Poniższy zbiór dotyczy statycznych klas kolorów Tailwind znalezionych w plikach tekstowych pod `src`; `text-sm`, `bg-clip-text`, `text-transparent` i klasy semantyczne nie są tu liczone. `bg-cosmic` jest nazwaną własną utility, choć jej definicja zawiera dosłowne wartości hex (`src/styles/global.css:113-115`).

| Plik | Przykłady klas i kotwice |
| --- | --- |
| `src/components/Welcome.astro` | `text-purple-*`, `text-blue-*`, `bg-blue-*`, `via-purple-*` (`:7-9,22,29,35,44,55,61`) |
| `src/components/Topbar.astro` | `text-white`, `text-blue-*`, `hover:text-purple-*` (`:5,8,10`) |
| `src/pages/dashboard.astro` | `border-white/*`, `bg-white/*`, `from-blue-*`, `to-purple-*`, `text-blue-*` (`:9-16`) |
| `src/pages/auth/signin.astro` | `border-white/*`, `bg-white/*`, `text-blue-*`, `text-purple-*` (`:10-15`) |
| `src/pages/auth/signup.astro` | `border-white/*`, `bg-white/*`, `text-blue-*`, `text-purple-*` (`:10-15`) |
| `src/pages/auth/confirm-email.astro` | `border-white/*`, `bg-white/*`, `text-blue-*`, `text-purple-*` (`:23-27`) |
| `src/components/ui/LibBadge.astro` | `bg-blue-900/50`, `text-blue-200`, `bg-purple-500/30` (`:10-12`) |
| `src/components/ui/button.tsx` | `text-white` w wariancie destructive; pozostałe warianty korzystają głównie z tokenów (`:14-22`) |
| `src/components/auth/FormField.tsx` | `bg-white/10`, `text-blue-100/80`, `border-red-400/60`, `focus:ring-purple-400` (`:5,24,28,38,43`) |
| `src/components/auth/PasswordToggle.tsx` | `text-white/*` (`:13`) |
| `src/components/auth/SubmitButton.tsx` | `bg-purple-*`, `text-white` (`:15,18`) |
| `src/components/auth/SignUpForm.tsx` | `text-blue-*` (`:59`) |
| `src/components/auth/ServerError.tsx` | `border-red-500/30`, `bg-red-900/30`, `text-red-300` (`:11`) |
| `src/components/timer/DrillApp.tsx` | `bg-slate-100`, `text-slate-900`, `bg-white` (`:38-39`) |
| `src/components/timer/DrillConfigForm.tsx` | `border-slate-400`, `bg-white`, `text-slate-*`, `outline-blue-600`, `text-red-700`, `accent-blue-600` (`:42,44,48,79,111,115`) |
| `src/components/timer/DrillTimer.tsx` | `bg-amber-100`, `bg-blue-50`, `bg-blue-700`, `text-white`, `text-slate-*` (`:82,87,91,100,102,106`) |

Poza klasami, `src/components/Banner.astro:28-40` zawiera dosłowne kolory CSS, a `src/styles/global.css:113-115` zawiera hex w `bg-cosmic`. Nie należą one do powyższej listy klas. W przeszukanych plikach `src` nie znaleziono klas arbitralnych kolorów w postaci `bg-[#...]`; `ring-[3px]` w `src/components/ui/button.tsx:8` określa szerokość.

### Brakujące prymitywy dla docelowego widoku

Aktywna zmiana S-15 obejmuje istniejące stany konfiguracji, przebiegu i zakończenia pod `/` (`context/changes/polish-timer-view/change.md:2-12`, `context/foundation/roadmap.md:115-125`, `src/pages/index.astro:6-7`). W `src/components/ui` nie ma osobnych plików `input`, `label`, `checkbox`, `alert` ani `card` — potwierdza to pełny wynik `rg --files src/components/ui` oraz dwa pliki wskazane wyżej. Potrzeby wspólnego kontraktu UI wynikają z istniejącego formularza pól z etykietami, podpowiedziami i błędami (`src/components/timer/DrillConfigForm.tsx:26-51,76-124`), komunikatów o niedostępnym dźwięku i pauzie (`src/components/timer/DrillTimer.tsx:80-99`) oraz kontenera trzech stanów (`src/components/timer/DrillApp.tsx:37-57`). Kandydaci do ujednolicenia to zatem `Input` z `Label`/komunikatem pola, `Checkbox`, `Alert` i powierzchnia typu `Card`.

Żaden z tych dodatkowych komponentów nie jest technicznie niezbędny do *samego wyświetlenia* danych S-15: bieżący widok renderuje formularz, licznik i komunikaty natywnymi elementami HTML (`src/components/timer/DrillConfigForm.tsx:26-51,100-117`, `src/components/timer/DrillTimer.tsx:80-109`). Osobny panel fazy/licznika może być prymitywem aplikacji, jeśli projekt S-15 będzie go powtarzał; zakres obecnego kodu nie przesądza takiej decyzji (`src/components/timer/DrillTimer.tsx:100-109`). Widok aktualnej i następnej fazy w trzech sekcjach należy do późniejszego S-04 i nie jest warunkiem S-15 (`context/foundation/roadmap.md:115-124,139-143`).

## Odniesienia do kodu

- `src/styles/global.css:6-111` — definicje w `:root` i `.dark` oraz mapowania w `@theme inline`.
- `src/layouts/Layout.astro:2` i `components.json:8` — wejście arkusza do aplikacji i konfiguracji shadcn.
- `src/components/timer/DrillApp.tsx:37-60` — trzy stany widoku.
- `src/components/timer/DrillConfigForm.tsx:26-124` — pola, checkbox, komunikaty walidacyjne.
- `src/components/timer/DrillTimer.tsx:80-109` — komunikaty i dane fazy.

## Kontekst architektoniczny i historyczny

W arkuszu tokeny kolorów są zdefiniowane niezależnie od użycia dosłownych palet w części komponentów (`src/styles/global.css:6-111`, lista powyżej). Istniejący `Button` korzysta zasadniczo z klas semantycznych (`src/components/ui/button.tsx:8-22`). Roadmapa wskazuje S-15 jako dopracowanie działającego widoku i oddziela je od S-04, które dodaje trzy sekcje (`context/foundation/roadmap.md:115-124,139-143`). To rozdzielenie jest poparte aktualną roadmapą; nie jest stwierdzeniem o technicznej niemożliwości wcześniejszej implementacji.

## Powiązane badania

Nie dotyczy tego pytania.

## Otwarte kwestie

W pierwotnym badaniu wybór konkretnych wspólnych komponentów i wyglądu S-15 pozostawiono do audytu oraz planu UI. Audyt kodu został uzupełniony poniżej; wybór rozwiązania pozostaje zadaniem planu. Badanie nie obejmowało renderowanego wyglądu ani testu kontrastu w przeglądarce.

## Audyt 10x-ui — zakres i pomiary

Audyt z 2026-09-30 rozszerza wcześniejsze badanie o jeden widok pod `/`: `src/pages/index.astro` oraz `DrillApp.tsx`, `DrillConfigForm.tsx`, `DrillTimer.tsx`. Nie zmienia wcześniejszych ustaleń o katalogu komponentów ani źródle tokenów. Poniższe liczby dotyczą statycznego kodu tych czterech plików, a nie elementów po renderowaniu.

Skan według wyrażenia z umiejętności `10x-ui`, wykonany przez `rg -n -o`, wykazał **21 trafień na 13 liniach**: `DrillApp` — 3 na 2 liniach (`:38-39`), `DrillConfigForm` — 9 na 5 liniach (`:42,44,48,79,115`), `DrillTimer` — 9 na 6 liniach (`:82,87,91,100,102,106`), `index.astro` — 0. Są to klasy palety; w tym zakresie skan nie znalazł funkcji kolorów, hex ani arbitralnych wymiarów px/rem. Dodatkowe `accent-blue-600` w `DrillConfigForm.tsx:111` nie mieści się w prefiksach wyrażenia skilla: po jego uwzględnieniu jest **22 wystąpienia klas palety**.

W klasach tych czterech plików jest **0 bezpośrednich odwołań do semantycznych tokenów kolorów** z `global.css`; są **2 importy** z `src/components/ui`, oba importują `Button` (`DrillApp.tsx:2`, `DrillConfigForm.tsx:2`). `Button` odczytuje tokeny we własnym pliku (`src/components/ui/button.tsx:8-22`), więc system jest częściowo używany, a nie całkowicie martwy. Zwykłe klasy odstępów i typografii korzystają ze skali Tailwind.

Przeczytano `AGENTS.md`, `src/AGENTS.md` oraz `CODEX.md`. Root `AGENTS.md` już wskazuje tokeny i katalog komponentów (`AGENTS.md:44-46`); w tych sprawdzonych plikach nie znaleziono instrukcji zachęcającej do arbitralnych wartości. Wymagane przez 10x-ui wskazanie bramki wizualnej i zakaz arbitralnych wartości w widoku pozostają zadaniem fazy utrwalenia. Istnieje ESLint oraz konfiguracja lint-staged (`eslint.config.js:1`, `package.json:58-64`), opisana jako pre-commit w `CODEX.md:16`, więc plan powinien dodać kontrolę ograniczoną do oczyszczonego widoku.

## Charges

Poniższe zarzuty są wejściem do planu. Status **open** oznacza problem potwierdzony w kodzie, jeszcze niezaimplementowany; plan musi przypisać go do fazy albo oznaczyć **deferred** z uzasadnieniem.

| ID | Kategoria | Dowód: plik i linia | Wpływ na użytkownika | Kierunek poprawki / status |
| --- | --- | --- | --- | --- |
| C1 | Brakujące tokeny | `src/components/timer/DrillApp.tsx:38-39`; `DrillConfigForm.tsx:42,44,48,111`; `DrillTimer.tsx:82,87,91,100-106`; źródło: `src/styles/global.css:6-111` | Konfiguracja, komunikaty i przyciski mają niezależne palety, a zmiana motywu tokenów nie obejmuje powierzchni i tekstu timera. | **open** — podłączyć role background/card/foreground/muted/destructive/ring/primary; ewentualne nowe role komunikatów zdefiniować w tym samym źródle, zachować wartości w folderze zmiany. |
| C2 | Brakujący współdzielony komponent | `src/components/timer/DrillConfigForm.tsx:28-48,101-111`; katalog `src/components/ui` zawiera `button.tsx` i `LibBadge.astro` | Pola i checkbox mają osobno projektowany fokus i błędy, przez co sterowanie klawiaturą i stany walidacji odbiegają od wspólnego kontraktu kontrolek. | **open** — dobrać minimalne prymitywy pola/etykiety/checkboxa i dodać brakujące przez shadcn; zachować dostępne nazwy, opis błędu i istniejącą walidację. |
| C3 | Brakujący współdzielony komponent | `src/components/timer/DrillTimer.tsx:89-99`; istniejący `src/components/ui/button.tsx:8-22` | Resume ma inny kolor, hover i fokus niż Start oraz powrót do konfiguracji, mimo że użytkownik wykonuje tę samą klasę działań. | **open** — użyć istniejącego `Button`, zachowując handler wznowienia i jego warunek widoczności strony. |
| C4 | Przypadkowa architektura stanu uruchomienia | `src/components/timer/DrillApp.tsx:29-34`; `DrillTimer.tsx:22-35,80-109` | Po Start ekran pokazuje fazę i nieruchomy czas także podczas oczekiwania na inicjalizację audio, więc użytkownik nie rozpoznaje, czy timer już działa, czy nadal się uruchamia. | **open** — jawnie pokazać stan uruchamiania do rozstrzygnięcia obietnicy audio, bez przesunięcia początku rzeczywistego przebiegu; zachować miejsce na licznik i komunikat o niedostępnym dźwięku. |
| C5 | Przypadkowa architektura punktu wejścia | `src/layouts/Layout.astro:22-34`; `src/lib/config-status.ts:14-17`; wywołanie layoutu: `src/pages/index.astro:6` | Przy braku konfiguracji Supabase działający timer gościa poprzedza komunikat błędu uwierzytelniania z linkiem do instrukcji konfiguracji, sugerując problem blokujący ćwiczenie. | **open** — ustalić prezentację ostrzeżenia dla publicznego timera, zachowując diagnostykę na stronach, które korzystają z konta. |

### Punkty wejścia i macierz stanów — dowody do planu

- **Bez logowania / bezpośredni link:** `/` renderuje `DrillApp`, a middleware chroni `/dashboard`, nie `/` (`src/pages/index.astro:6-7`, `src/middleware.ts:4,18-22`). Brak konta nie jest zarzutem wymagającym nowego guarda.
- **Bez zapisanych danych:** konfiguracja ma wartości początkowe zapisane lokalnie w komponencie (`DrillApp.tsx:9-15,23`); lista zapisanych konfiguracji nie istnieje w tym widoku. Stan empty listy może być N/A z tym uzasadnieniem; puste wartości pól wymagają pokazania walidacji (`DrillConfigForm.tsx:65-69`).
- **Default, hover, focus-visible, disabled:** default istnieje; `Button` definiuje hover/focus/disabled (`button.tsx:8-22`). Potrzebny jest dowód wizualny również dla pól i checkboxa oraz przykładu disabled w bramce, zamiast wprowadzać sztuczny stan biznesowy.
- **Error:** błędy pól istnieją (`DrillConfigForm.tsx:46-50`), a niedostępne audio ma komunikat tekstowy (`DrillTimer.tsx:81-85`). Wymagają spójnych tokenów i sprawdzenia w bramce.
- **Loading:** rzeczywiste oczekiwanie na audio nie ma odrębnej prezentacji — C4. Hydratacja React przy `client:load` jest osobnym momentem wejścia do sprawdzenia (`index.astro:7`).
- **Standby, pauza, zakończenie:** zachować ukrycie czasu Standby (`DrillTimer.tsx:101`), warunek ręcznego Resume (`:93`) i powrót z ostatnią konfiguracją (`DrillApp.tsx:44-55`).

### Przekazanie do planowania i ograniczenia audytu

Plan powinien zachować kolejność: środowisko/minimalne komponenty → tokeny → jeden widok → stany i bramka. C1–C5 wymagają jawnego przypisania lub odroczenia. Kryteria powinny obejmować desktop i jedną szerokość mobilną, oba zestawy tokenów light/dark, skan po każdej fazie wizualnej oraz utrwalenie reguły i kontroli lint. Zakres funkcji określa S-15 (`context/foundation/roadmap.md:115-125`), a trzy sekcje i kolory faz mają własne przekroje S-04/S-05.

Ten audyt potwierdza ścieżki kodu, nie renderowany kontrast, wysokości ani wygląd na urządzeniu. Nie wykonano zrzutów ani bramki wizualnej; pozostają wymaganiami implementacji. Nie znaleziono plików konfiguracji Playwright/Puppeteer w wynikach `rg --files` repozytorium z wyłączeniem `node_modules`; preferowana forma bramki pozostaje do wyboru przy planowaniu. Wybór wartości motywu i zestawu nowych prymitywów jest nadal decyzją planu, a nie ukończoną poprawką UI.
