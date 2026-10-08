---
project: "DryFire Drill Timer"
type: ux-fixes-plan
created: 2026-10-08
status: ready
related: roadmap.md (S-16–S-20), prd.md (FR-011, FR-015–FR-019)
---

# Plan: poprawki UX po kolejce S-03…S-13

## Kontekst

Po zamknięciu kolejki S-03…S-13 użytkownik zgłosił 14 poprawek UX. Dotyczą powłoki aplikacji (brak paska konta, „Sign in" nachodzi na timer na telefonie), tras (osobny ekran listy timerów, /dashboard jako dane konta, po zapisie przejście na /{id}), układu widoku biegu oraz przycisków odsłuchu sygnałów. Dokument jest źródłem prawdy dla slice'ów S-16…S-20; każdy slice jest planowany osobno (`/10x-new` → `/10x-plan`), a ten plik podaje ustalone decyzje i założenia, żeby nie wracać do nich przy implementacji.

## Decyzje i rozstrzygnięte założenia

| Obszar | Decyzja |
|---|---|
| Top bar: zasięg | Na wszystkich stronach poza stronami logowania (`/auth/signin`, `/auth/confirm-email`, `/auth/callback`). 404 ma pasek. |
| Top bar: zawartość (zalogowany) | Email (link do `/dashboard`), link „Timers" (do `/timers`), przełącznik motywu, „Sign out". Na telefonie email jest skracany (truncate), linki zostają. |
| Top bar: zawartość (gość) | „Sign in" i przełącznik motywu. |
| Przełączniki motywu w kartach | Usunąć (nagłówki kart timera, `/create`, `/{id}/edit`, dashboard); jedyny przełącznik jest w pasku. |
| Cel po zalogowaniu | Domyślne `next` = `/timers` (zamiast `/`). |
| Etykieta przycisku na stronie callback | „Continue to your timers" (zamiast „Continue to account"). „Back to the timer" jest przyciskiem (`buttonVariants`), nie linkiem. |
| `/dashboard` | Strona danych konta (na razie email, link do `/timers`, Sign out); bez zapytań do bazy. |
| `/timers` | Nowy ekran listy zapisanych timerów (przeniesiony z `/dashboard`), strona startowa zalogowanego po wejściu i odświeżeniu; chroniony, `private, no-store`. |
| Po zapisie nowego timera | Przejście na `/{id}` zapisanego timera (zamiast pozostania na `/create` z komunikatem). Edycja zostaje na `/{id}/edit` z komunikatem „Saved". |
| Linki „Back to dashboard" | Zmiana na „Back to timers" → `/timers`. Przekierowanie po usunięciu → `/timers`. |
| Widok biegu | Czas odliczany wyżej; „Repetition X of N" bezpośrednio pod czasem; okienko Current: nazwa fazy w pierwszej linii, czas w osobnej, bez numeru powtórzenia; okienko Next: większy napis „Next", nazwa i czas następnej fazy w osobnej linii poniżej. |
| Preparation | Pod czasem „Repetition X of N", gdzie X to numer nadchodzącego powtórzenia (także po wznowieniu przygotowania). |
| Odsłuch sygnałów | Sama ikona głośnika na końcu wiersza z inputem; opis jako tooltip. Mobile: dotknięcie ikony odtwarza dźwięk i pokazuje ten sam opis na kilka sekund (live region), powód wyłączenia (np. Rest 0:00) pokazuje dotknięcie wyłączonej ikony (`aria-disabled`). |
| Usuwanie konta (RODO) | Osobny slice `proposed` (S-20), bez implementacji; otwarte pytania poniżej. |
| PRD / roadmapa | Zaktualizowane (FR-011, FR-015–FR-019, S-16–S-20). |

## Mapowanie uwag na slice'y

| Slice | Change ID | Uwagi użytkownika |
|---|---|---|
| S-16 | app-top-bar | sticky top bar (email, Sign in / Sign out, motyw), nachodzenie „Sign in" na telefonie, „Back to the timer" jako przycisk, motyw także w pasku |
| S-17 | timers-list-and-account | osobny ekran listy zapisanych timerów, /dashboard jako informacje o użytkowniku, „Continue" prowadzi do listy, po zapisie widok zapisanego timera |
| S-18 | run-view-layout | czas wyżej, powtórzenie pod czasem, okienko Next, okienko Current |
| S-19 | signal-preview-icon | ikona głośnika na końcu wiersza, tekst jako tooltip, wariant mobile |
| S-20 | account-deletion (proposed) | usuwanie konta z miesięcznym przetrzymaniem (RODO) |

Kolejność: **S-16 → S-17 → S-18 → S-19**; S-20 tylko w roadmapie. S-16 nie zmienia tras; domyślne `next=/timers` wymaga istniejącej trasy, więc należy do S-17.

## Slice'y: zakres techniczny

### S-16 app-top-bar
- Komponent paska (Astro + wyspa React dla `ThemeToggle`) w `src/layouts/Layout.astro` z opcją wyłączenia na stronach auth. Tylko tokeny semantyczne (`bg-background`, `border-border`…), `sticky top-0 z-50`, bez wartości arbitralnych i palet.
- Usunąć stałą nawigację `fixed` z `src/pages/index.astro` (przyczyna nachodzenia na telefonie). Usunąć `ThemeToggle` z kart: `DrillApp.tsx`, `DrillCreateApp.tsx`, `DrillEditApp.tsx`, `dashboard.astro`. Reuse: `src/components/timer/ThemeToggle.tsx`, `src/components/hooks/useTimerTheme.ts`.
- `src/pages/auth/callback.astro`: „Back to the timer" jako `buttonVariants` (jak w `confirm-email.astro`).
- Email trafia do HTML stron z paskiem: `Cache-Control: private, no-store` na `/` i na wspólnym 404 (pozostałe strony już mają).
- Lint: nowe pliki do globów `eslint.config.js` i testów kontraktu (`scripts/eslint-rules/*.test.mjs`); smoke (`scripts/smoke.mjs`: helpery `accountNavLinks`/`hasHomeAccountLink`) dopasować do nowego paska; fixtures i screenshoty 1280/390 w obu motywach; `AGENTS.md` (sekcja Account-entry UI).
- Ryzyka: wyciek emaila przez cache, `min-h-screen` + sticky pasek (dodatkowy scroll), hydratacja motywu (`theme` null na pierwszym renderze).
- Recenzent: Opus 5.5 (medium).

### S-17 timers-list-and-account
- `src/pages/timers.astro` (z `dashboard.astro`: `resolveDashboardPage`, `SavedDrillList`, „Create a timer", przekierowanie gościa); `/timers` do `PROTECTED_ROUTES` (`src/lib/protected-routes.ts`) + testy, glob lint, link „Timers" w pasku.
- `src/pages/dashboard.astro` → dane konta z `locals.user`.
- `drill-create-controller.ts`: po `response.ok` wstrzykiwane `navigate("/" + response.drill.id)` (wzór: `drill-delete-controller.ts`); usunąć stan `saved` i alert w trybie create; `isSaveDrillResponse` waliduje `drill.id`; `CreateDrillFixtures.tsx` i testy.
- Domyślne `next=/timers`: `src/lib/email-auth.ts` (`safeNextPathSchema`, `signInUrlForProtectedPath`), `signin.astro`, `confirm-email.astro`; etykieta „Continue to your timers"; testy `email-auth.test.ts`, `saved-drills-read.test.ts`.
- Linki „Back to timers" w `SavedDrillDetails.tsx`, `DrillEditApp.tsx`, `DrillCreateForm.tsx`, `[id].astro`, `[id]/edit.astro`; `DASHBOARD_HREF` w `drill-delete-controller.ts` → `/timers` (+ testy).
- Smoke: kroki listy z `/dashboard` na `/timers`, redirect gościa dla `/timers`, krok „po create ląduję na `/{id}`"; README (tabela tras), `AGENTS.md`, `src/AGENTS.md`.
- Recenzent: Opus 5.5 (medium).

### S-18 run-view-layout
- `src/lib/drill-phase-sections.ts`: `detail` („Repetition X of N") przechodzi do sekcji głównej (także Standby i Preparation z numerem nadchodzącego powtórzenia — zweryfikować, że `DrillDisplay` go dostarcza), `current` = `{name, time}` bez powtórzenia, `next` rozdzielone na etykietę i treść („Next" + nazwa/czas w osobnej linii; koniec = „Drill complete"). Zachować tajność długości losowego Standby (testy różnicowe 1 s vs 5 s).
- `PhaseSections.tsx`: nowa kolejność; `role="timer"` zostaje na liczbie, powtórzenie poza elementem timera. `DrillTimerView.tsx`: slot `min-h-20` na ostrzeżenia nad `PhaseSections` przesuwa czas w dół — przenieść/zminimalizować bez przesuwania przycisków paska.
- Testy `drill-phase-sections.test.ts`, fixtures (`PhaseSectionsFixtures.tsx`, `TimerUiPreview.tsx`), screenshoty.
- Recenzent: Sonnet 5.5 (medium).

### S-19 signal-preview-icon
- shadcn `tooltip` (`npx shadcn@latest add tooltip`), `src/components/ui/tooltip.tsx` objąć lintem (`eslint.config.js` + test kontraktu), sprawdzić klasy pod kątem tokenów.
- `SignalPreviewControl.tsx`, `DrillConfigForm.tsx`: `ConfigField` z wierszem `flex items-center gap-2` (input + przycisk-ikona `Volume2` na końcu; Standby przy wierszu checkboxa Random start). `aria-label` („Play exercise signal"), `aria-disabled` zamiast `disabled`, opis w tooltipie i `aria-describedby`; błąd audio jako widoczny `Alert` pod wierszem.
- Fixtures i screenshoty (`SignalPreviewFixtures.tsx`, `CreateDrillFixtures.tsx`, `EditDrillFixtures.tsx`, `TimerUiPreview.tsx`); brak overflow przy 390 px.
- Recenzent: Sonnet 5.5 (medium).

### S-20 account-deletion (proposed)
Tylko wpis w roadmapie. Otwarte pytania: soft-delete 30 dni czy natychmiast, klucz service role po stronie serwera (dziś brak), mechanizm czyszczący (job), eksport danych, treść informacyjna dla użytkownika.

## Proces realizacji
Ten sam workflow co S-03…S-13: agent `dev` (Sonnet 5.5, medium) w panelu Herdr, worktree `10xDevs4-{change-id}`, branch `feature/{change-id}`, `/10x-new` → `/10x-plan` → review planu → fazy (osobny commit, `/clear` po fazie) → review implementacji → poprawki → PR → CI (`ci`, `smoke`) → merge przez koordynatora. Brak migracji w S-16…S-19. Archiwizacja i lista testów ręcznych dopiero po całej kolejce (decyzja użytkownika).

## Weryfikacja (każdy slice)
`npx astro sync`, `npm run lint`, `npm test`, `node --test scripts/eslint-rules/*.test.mjs`, `npx astro check`, `npm run build`; wizualna bramka `/dev/timer-ui` (stany, jasny/ciemny, 1280/390, screenshoty w folderze zmiany); smoke w CI; po wdrożeniu kontrola produkcji (`/` 200, `/dev/timer-ui` 404, `/timers` i `/dashboard` 302 dla gościa).
