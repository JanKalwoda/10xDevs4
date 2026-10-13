<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs - Moduł 3, Lekcja 3 (10xDevs 4.0 Hooks)

Traktuj hook jako **bramkę jakości uruchamianą przez harness dla agenta**, a nie skrypt, który według ciebie agent zauważy. Hooki działają poza modelem, więc przetrwają kompresję kontekstu i zapomniane instrukcje — ale tylko hook, którego sygnał faktycznie dociera do agenta, zamyka pętlę:

```
test-plan.md "Quality Gates" -> pick the moment per gate -> /10x-configure-hook -> prove with sample JSON -> watch the agent fix a deliberate error
```

### Router zadań - Od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| `/10x-configure-hook` | Przekształcasz bramki z `context/foundation/test-plan.md` w hooki agenta, naprawiasz hooki, które się uruchamiają, ale agent nigdy nie reaguje, albo audytujesz istniejącą konfigurację hooków. Wykrywa harness na podstawie repozytorium i zawiera datowane referencje dla każdego harness. |
| `/10x-test-plan --status` | Odczytujesz aktualne bramki i stan wdrożenia. Zmiana tego, które bramki istnieją, należy do Lekcji 1, nie tutaj. |
| `/10x-new` -> `/10x-research` -> `/10x-plan` -> `/10x-implement` | Hook ujawnił awarię, której agent nie może naprawić trywialną korektą (błędna logika biznesowa, niestabilna integracja). Otwórz zmianę zamiast zapętlać hook. |

### Cykl życia hooka

1. **Wyzwalacz** — zdarzenie w harness: narzędzie zakończyło edycję pliku, agent zaraz zakończy swoją turę.
2. **Matcher** — zawęża, na które wywołania narzędzi lub pliki reaguje hook. Nie każdy harness obsługuje matchery w ten sam sposób.
3. **Handler** — zwykle polecenie powłoki lub skrypt, który odczytuje ładunek zdarzenia jako JSON ze standardowego wejścia.
4. **Sygnał** — co zwraca hook. Kod wyjścia, stderr, stdout i pola JSON oznaczają różne rzeczy w różnych harness, a tylko jeden kanał na zdarzenie faktycznie dociera do agenta. **Kanał sygnału różni się zależnie od harness — przed napisaniem lub przeglądem hooka sprawdź referencje umiejętności.**

Hook, który się uruchamia, ale wysyła komunikat niewłaściwym kanałem, jest najczęstszą awarią: użytkownik widzi „hook error”, agent nie widzi niczego i kontynuuje.

### Momenty i warstwy

Im wolniejsza kontrola, tym rzadszy moment:

| Moment | Typowe kontrole | Dociera do agenta? |
| --- | --- | --- |
| Przy każdej edycji | Lint/formatowanie **tylko edytowanego pliku**; powiązane testy, jeśli są szybkie | Tak, w trakcie pracy |
| Koniec tury (Stop lub odpowiednik) | Lint + testy dla każdego pliku zmienionego w tej turze, typecheck całego projektu | Tak, zanim agent przekaże wynik |
| Pre-commit (git) | Lint + testy dla plików w stagingu; wyłapuje edycje wykonane bez agenta | Nie — blokuje commit |
| Pre-push (git) | Cięższe zestawy, e2e uruchamiane lokalnie | Nie — blokuje push |
| CI | Integracja, współdzielony stan, infrastruktura niedostępna lokalnie | Nie — feedback dla PR |

Lokalne warstwy nie zastępują CI; każda z nich oszczędza jeden cykl zwrotny CI. Zacznij od jednego hooka lint przy każdej edycji i jednego typechecka na koniec tury, a następnie dodawaj warstwy, gdy zobaczysz, co się przedostaje.

### Kontrakt

- Odczytaj bramki z sekcji „Quality Gates” w `context/foundation/test-plan.md` (według tytułu, nie numeru sekcji). Bramka, którą plan wyraźnie odkłada, pozostaje odłożona, chyba że użytkownik to zmieni — cytuj odroczenie, gdy pytasz.
- Hooki przy każdej edycji sprawdzają tylko edytowany plik. Nigdy nie uruchamiaj `--fix` ani lintera dla całego projektu przy każdej edycji.
- Hooki końca tury, które mogą odesłać agenta z powrotem, muszą zatrzymać się po jednej próbie ponowienia (flaga harness „already continued” lub odpowiednik), aby nienaprawialny błąd nie tworzył pętli.
- Hooki przy każdej edycji widzą tylko narzędzia edycji harness; plik nadpisany za pomocą polecenia powłoki je omija. Hook końca tury ponownie sprawdza każdy plik zmieniony w tej turze (`git diff`), więc stanowi zabezpieczenie dla tych edycji.
- Limity czasu są zwykle podawane w **sekundach**. Sprawdź jednostkę przed skopiowaniem liczby.
- Udowodnij działanie każdego hooka, zanim mu zaufasz: uruchom skrypt z przykładowym ładunkiem na celowo uszkodzonym pliku i na czystym, a następnie cofnij błąd.
- Nigdy nie nadpisuj po cichu istniejącej konfiguracji hooków. Przeprowadź audyt, nazwij defekty, scal i pokaż diff.

### Granice lekcji

- Nie zmieniaj strategii ryzyka ani definicji bramek — to Lekcja 1 (`/10x-test-plan`).
- Nie pisz tutaj nowych testów — hooki uruchamiają tylko testy utworzone w Lekcji 2.
- Nie pisz scenariuszy E2E ani weryfikacji w przeglądarce — to Lekcja 4.
- Nie twórz potoków CI ani nie instaluj bez pytania menedżerów git-hooków; rekomenduj bramki pre-commit/pre-push i pozwól użytkownikowi zdecydować.

<!-- END @przeprogramowani/10x-cli -->

# Rules for AI

## Security & Configuration

Never commit `.env` or `.dev.vars`. `SUPABASE_URL` and `SUPABASE_KEY` are server-only Astro environment fields; provide them locally and as CI/Cloudflare secrets. New Supabase tables require timestamped migrations in `supabase/migrations/` with RLS and granular policies.

## Git Workflow

For each change:

1. If you are on other branch than 'main' continue on it.
2. If you are on 'main' branch than create a dedicated branch from `main`.
3. Implement and verify the change.
4. Commit the changes on that branch.
5. Open a pull request targeting `main`.
6. Merge the pull request after review and passing CI.

Do not commit changes directly to `main`.

## Research

- Podczas `/10x-research` szukaj bibliotek i źródeł przez MCP exa; dokumentację bibliotek pobieraj skillem find-docs (Context7, `npx ctx7@latest`) i zapisuj ją jako `context/docs/<biblioteka>.md` (library ID, zapytania, data pobrania, link do źródła).
- Krótkie podsumowanie wyników researchu (odpowiedzi, decyzje, źródła) dopisuj do `## Notes` w `change.md` zmiany.

## UI

- Design tokens: `src/styles/global.css` (`:root`, `.dark`, `@theme inline`). Every new color must have its own token. Never use hardcoded color values.
- Theme: Ocean Breeze from `https://tweakcn.com/r/themes/ocean-breeze.json`; original values and contrast adaptations are documented in `context/changes/ocean-breeze-theme/`. Preserve the readable primary text, validation red and dark muted text when updating the preset.
- Components: `src/components/ui`. Before creating a new component, check this directory. If a component is missing, add it from the shadcn registry.
- Top bar: `src/components/AppTopBar.astro` (mounted by `src/layouts/Layout.astro` unless `showTopBar={false}`, which the three auth pages pass) is the only place with the light/dark `ThemeToggle`; never add a toggle to a card header. It is sticky, `Layout.astro` and `AppTopBar.astro` are in the timer-ui lint scope, and page mains use `flex-1` (not `min-h-screen`) under the `flex min-h-dvh flex-col` body. `src/middleware.ts` sets `Cache-Control: private, no-store` on every HTML response without its own `Cache-Control` (`src/lib/html-cache-control.ts`), because the bar puts the email in the HTML. `/dev/timer-ui` renders the bar with `fixture` (static toggle) for guest, signed in and long email; extend those fixtures when the bar changes. Screenshots: `context/archive/2026-10-08-app-top-bar/screenshots/`.
- Timer UI contract: use semantic tokens from `src/styles/global.css` and the Tailwind spacing/type/radius scale. No palette classes, inline literal colors or arbitrary colors/dimensions in timer components or their entry routes. Add missing primitives with `npx shadcn@latest add [name]`. `npm run lint` enforces this through `scripts/eslint-rules/timer-ui-contract.mjs`.
- Visual gate: `/dev/timer-ui` is development-only and reuses production components with deterministic fixtures. Inspect default, hover, focus-visible, disabled, error, empty (or justified N/A), and loading in light/dark at 1280/390 px; save and review screenshots in the change folder before accepting UI changes.

### Timer controls (Cancel, Restart, Pause/Resume)

- Keep Cancel enabled and accessibly named during initialization, active, paused, and pending Resume. Latch cancel intent synchronously and use the existing idempotent S06 teardown path before returning to configuration.
- Run view layout (`PhaseSections.tsx`, `DrillTimerView.tsx`, model `src/lib/drill-phase-sections.ts`): top to bottom time (or `Standby`), `Repetition X of N` (also in Preparation and Standby), Current and Next (two `role="group"` blocks with the same padding, height and text offsets: larger "Current" / "Next" label, then one `Name · time` line; Current has no frame and no fill, via a transparent border of the same width, while Next keeps its frame and `bg-muted` fill; Standby shows the bare name in Current and no time anywhere), the control bar, the status row, and warnings last in a fixed-height slot, so warnings never move the time or the bar. `role="timer"` stays on the number only; the Current/Next body lines and the repetition line keep a fixed height. The model derives everything from phase values, so Standby never leaks the wait. Fixtures: `PhaseSectionsFixtures.tsx` (including both warnings and the longest values); gate script and screenshots: `context/archive/2026-10-09-run-view-layout/screenshots/` (`run-view-visual-gate.mjs`, ignored by lint only as that one file). Playwright is not a dependency: run `npm run dev`, then `PLAYWRIGHT_PATH=<path to an installed playwright package> node context/archive/2026-10-09-run-view-layout/screenshots/run-view-visual-gate.mjs`; it is not part of CI.
- Keep the timer bar below time, count, and repetition: Cancel/X left, Restart (`RotateCcw`, "Restart drill") in the middle, and Pause/Resume in the same right slot. All three are shared outline icon `Button`s, size-12 (48 px hitbox), accessibly named, with semantic tokens only; Pause/Resume stay in a fixed hitbox.
- Keep Restart enabled during initialization, active, paused, and pending Resume. It shares Cancel's synchronous intent latch and idempotent disposal, then the `/` owner (`DrillApp`) starts a fresh keyed run with new audio and Wake Lock resources created in the same gesture. Accept completion and intents only through the tested `drill-run-identity` guard; never reuse a retired run's refs, `DrillRun`, resume target, sampled wait, visibility subscription or resources.
- Timer visibility reads go through the `DrillVisibilityPort` (`src/lib/drill-visibility.ts`), not `document.hidden`, so the preview can control them.
- Extend the production-backed `/dev/timer-ui` fixtures (including the held-mounted Restart lifecycle gate with per-run resource bundles) whenever timer states or controls change; preserve the seven-state light/dark visual gate and the held-mounted lifecycle scenarios.
- `/create` (save a named timer) follows the timer UI contract (`create.astro` is in the lint scope). Its production-backed fixtures are `src/components/timer/CreateDrillFixtures.tsx` in `/dev/timer-ui`; extend them whenever `DrillCreateForm` states change.
- `/timers` (saved timers list, the signed-in landing page), `/dashboard` (account page: email, `Timers` link, `Sign out`, rendered by `AccountDetails.astro`, no database read), `/{id}` (saved timer, UUID only) and the shared 404 (`NotFoundView.astro`) follow the timer UI contract (`timers.astro`, `dashboard.astro`, `AccountDetails.astro`, `[id].astro`, `404.astro` are in the lint scope). Their production-backed fixtures are `src/components/timer/SavedDrillFixtures.tsx` in `/dev/timer-ui`; extend them whenever `SavedDrillList` or `SavedDrillDetails` states change; `AccountDetails` fixtures (normal and long email) live in `src/pages/dev/timer-ui.astro`. Saving a new timer on `/create` redirects to `/{id}` (the `saving` fixture is also the redirect state). Screenshots: `context/archive/2026-10-07-open-saved-drill/screenshots/` and `context/archive/2026-10-08-timers-list-and-account/screenshots/` (`/timers`, `/dashboard`, create to `/{id}`, fixtures).
- `/{id}/edit` (edit one saved timer: the `/create` form prefilled, `PUT /api/drills/{id}`) follows the timer UI contract (`[id]/edit.astro` is in the lint scope; the `[id]` page files are listed as `src/pages/[[]id[]].astro` and `src/pages/[[]id[]]/edit.astro` because `[id]` is a minimatch character class, and `timer-ui-contract.test.mjs` pins that both files are linted). The `Edit timer` link lives in the `saved-drill-actions` slot of `SavedDrillDetails` (next to it the `Delete timer` action, see below). Production-backed fixtures: `src/components/timer/EditDrillFixtures.tsx` in `/dev/timer-ui` (edit form states and the `DrillEditApp` links) plus the details card in `SavedDrillFixtures.tsx`; extend them whenever `DrillCreateForm` edit props, `DrillEditApp` or the `Edit timer` action change. Foreign, unknown and non-UUID ids must stay one identical 404 on the page and in the API. Screenshots: `context/archive/2026-10-07-edit-saved-drill/screenshots/`.
- Delete (`DeleteDrillDialog` in the `saved-drill-actions` slot of `SavedDrillDetails`, `DELETE /api/drills/{id}`) follows the timer UI contract; `src/components/ui/alert-dialog.tsx` is in the lint scope and its overlay uses the `--overlay` token (never `bg-black/50`). The confirm button is the destructive `Button` with `text-destructive-foreground`, `dark:bg-destructive` and `dark:hover:bg-destructive/90` (the variant's `text-white` / `dark:bg-destructive/60` fail contrast in dark); the dialog is not dismissible by an outside click or while the request runs, and 404 counts as done. A Radix modal traps the page, so `/dev/timer-ui` shows one dialog state at a time: `DeleteDrillFixtures.tsx` (pick a state or load `?delete=<state>`; `SavedDrillDetails` takes inert `deletePorts` so the preview never deletes anything). Extend them whenever `DeleteDrillDialog` states change. A long saved-timer name must wrap in the `DrillApp` header (`SAVED_DRILL_HEADING_CLASS`). Screenshots: `context/archive/2026-10-07-delete-saved-drill/screenshots/`.
- Signal preview (Exercise, Rest and Standby/Random start in `DrillConfigForm`) is a `Volume2` icon button at the end of the field row with a shadcn `tooltip` (`src/components/ui/tooltip.tsx`, in the lint scope; `max-w-xs` below `md`, `md:max-w-md` from `md`, so desktop descriptions fit in 1-2 lines without an empty right part) for the description; it uses `aria-disabled`, never `disabled`, so the reason stays reachable by focus and touch, a tap plays and keeps the hint for 8 s (`src/lib/signal-preview-hint.ts`), and an audio error is a visible `Alert` under the row. Production-backed fixtures: `src/components/timer/SignalPreviewFixtures.tsx` in `/dev/timer-ui`; extend them whenever `SignalPreviewControl` states change. Gate script and screenshots: `context/archive/2026-10-09-signal-preview-icon/screenshots/` (`signal-preview-visual-gate.mjs`, ignored by lint only as that one file; run `npm run dev`, then `PLAYWRIGHT_PATH=<path to an installed playwright package> node ...`; not part of CI).
- Config stepper (▲/▼ arrows next to Preparation, Exercise, Rest and Repetitions in `DrillConfigForm`; `ConfigStepper.tsx`, pure logic in `src/lib/drill-stepper.ts`, `src/lib/drill-step-repeat.ts` and `src/lib/drill-step-press.ts`, hook `useStepRepeat`): the arrows are inside the frame of the field (`src/components/ui/input-group.tsx`, in the lint scope; a reduced hand-written copy of the shadcn registry component, because the installer does not run non-interactively: only `InputGroup`, `InputGroupAddon` and `InputGroupInput`, adapted to the token contract, so a later `npx shadcn@latest add input-group` overwrites it and the adaptation must be restored: `InputGroup` frame and one focus ring, `InputGroupInput` without its own border, the stepper in an `InputGroupAddon`; the invalid state colours the frame), the speaker icon stays outside it on the right. The layout follows the PRIMARY pointer, never `any-pointer-*` (a touch laptop has `any-pointer: coarse` but a mouse as primary): by default (fine) a column with ▲ above ▼ (about 21 px each inside the 44 px frame), under `pointer-coarse:` two 44 px buttons side by side (▼ ▲) with separators; Tailwind's built-in variants, no `@custom-variant`. One step always comes from `click` (mouse, touch, keyboard, screen reader and voice control alike), so a single press steps exactly once whatever the delay of the `click`; `pointerdown` only arms the repeat, which starts after a 400 ms pause (every 100 ms) and is stopped by release, leave, lost capture, blur or unmount; when the repeat has started, the one `click` that follows the release is skipped (the flag is cleared by that `click` or the next press, never by a timer; `src/lib/drill-step-press.ts`). Like the speaker icon, a boundary arrow is `aria-disabled`, never `disabled`. The arrows have `tabIndex={-1}`: the keyboard uses ↑/↓ in the field (Shift for 10) and an `sr-only` `role="status"` announces the value. The roughly 21 px height of a fine-pointer arrow is below WCAG 2.5.8 (24 px) and relies on its "Equivalent" exception: the same function is reachable through the text field and ↑/↓ (also on a touch laptop), and a coarse primary pointer gets 44 px targets. Production-backed fixtures: `src/components/timer/ConfigStepperFixtures.tsx` in `/dev/timer-ui`; extend them whenever `ConfigStepper` or the field rows change. Gate script and screenshots: `context/archive/2026-10-11-ux-fixes-round-3/screenshots/` (`ux-fixes-round-3-visual-gate.mjs`, ignored by lint only as that one file; run `npm run dev`, then `PLAYWRIGHT_PATH=<directory that contains node_modules/playwright> node ...`; it needs the local Supabase for the production-view overflow checks; it covers one click/tap = one step, the seven states in light/dark at 1280/390 for a fine, a coarse and a fine-primary + touch pointer (the last is a plain context with CDP touch events, because `hasTouch` makes Chromium report a coarse primary pointer), the tooltips, Current/Next and the overflow of `/`, `/create`, `/{id}/edit`, `/{id}`, `/timers` and the run view at 390 px; re-run the S-18, S-19 and `ux-fixes-round-2` gate scripts as a regression; not part of CI).

## Commands

@package.json
 after dependency upgrades; CI runs it against the production preview with a local Supabase.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

All pages are server-rendered by default. API routes must export `const prerender = false`.
@astro.config.mjs

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/timers.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

@.nvmrc
@README.md
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

@.github/workflows/ci.yml

`npx supabase test db` (pgTAP, `supabase/tests/database/`) covers table RLS, grants and constraints and runs in the `smoke` job; add a test there for every new table or policy.

`tests/integration/` (`npm run test:integration`, job `smoke`): trasy, ochrona, własność i walidacja API; dodaj przypadek dla każdej nowej trasy chronionej lub endpointu, używaj istniejących kont pliku i sklasyfikuj stronę w `src/lib/route-inventory.test.ts`; błąd logowania w zestawie oznacza zwykle limit auth: odczekaj 5 minut i uruchom ponownie (`context/foundation/test-plan.md` §6.2).

`npm run test:mutation` (StrykerJS, `stryker.config.json`): mutation testing lokalnie i na żądanie po fazie ryzyka, goły skrypt mutuje trzy moduły ryzyk z konfiguracji, inny moduł: `npm run test:mutation -- --mutate "src/lib/protected-routes.ts"`; nie jest bramką CI (przepis i reguły przeglądu: `context/foundation/test-plan.md` §6.7).

## Account-entry UI

- Account-entry pages and the account links in the top bar use semantic tokens from src/styles/global.css and existing primitives from src/components/ui; avoid palette classes, literal colors, and arbitrary dimensions. npm run lint enforces this on the auth views and root shell. Keep visual evidence in context/archive/2026-10-03-enter-account-by-email-link/screenshots/.
