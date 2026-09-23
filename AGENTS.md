<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs - Moduł 2, Lekcja 1

Przejdź od konfiguracji sprint-zero do orkiestracji projektu za pomocą **łańcucha roadmapy**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` jest głównym tematem lekcji. `/10x-new` jest celowo wprowadzane w Module 2, Lesson 2, gdy wybrany element roadmapy staje się folderem zmiany implementacyjnej.

### Router zadań - Od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Roadmapa (główny temat lekcji)** | |
| `/10x-roadmap` | Masz `context/foundation/prd.md` oraz bazę projektu ze szkieletem i potrzebujesz roadmapy MVP z podejściem vertical-first. Umiejętność odczytuje PRD, sprawdza bazę kodu, korzysta z dostępnych dokumentów fundamentowych, takich jak `tech-stack.md`, `infrastructure.md` i `deploy-plan.md`, a następnie zapisuje `context/foundation/roadmap.md`. Użyj jej PRZED tworzeniem folderów dla poszczególnych zmian lub planów implementacji. |
| **Ponownie uruchom wcześniejsze kroki, jeśli to konieczne** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Zebrane z Module 1, aby kontrakty fundamentowe można było poprawić przed sekwencjonowaniem roadmapy. Jeśli generowanie roadmapy ujawni lukę w PRD, popraw PRD, zanim uznasz, że backlog jest gotowy. |

### Jak łańcuch przekazuje dalej

- `/10x-roadmap` łączy produkt z implementacją. Nie wybiera frameworków, nie projektuje schematów ani nie pisze planu implementacji dla poszczególnych zmian.
- Wynikiem jest `context/foundation/roadmap.md`: uporządkowane kamienie milowe, vertical slices, ograniczone fundamenty, zależności, niewiadome, ryzyko oraz pola przekazania do backlogu.
- Elementy roadmapy powinny otrzymać stabilne, czytelne dla człowieka identyfikatory w narzędziach backlogu. Właściwy folder `context/changes/<change-id>/` jest tworzony w Lesson 2 za pomocą `/10x-new`.

### Granice roadmapy

- Domyślnie stosuj vertical slices: widoczne dla użytkownika rezultaty obejmujące UI, dane, logikę biznesową i integracje.
- Praca horyzontalna jest dozwolona wyłącznie jako ograniczony enabler, który wskazuje odblokowywany przez siebie późniejszy pionowy kamień milowy.
- Unikaj osieroconej pracy horyzontalnej, takiej jak „zbuduj całą bazę danych”, „zbuduj wszystkie endpointy API” lub „zaprojektuj całe UI” przed pierwszym widocznym dla użytkownika przepływem.
- Roadmapa nie jest estymacją kalendarzową. Nie wymyślaj dat, story points ani velocity sprintu, chyba że użytkownik wyraźnie prosi o osobny artefakt planistyczny.

### Ścieżki fundamentów używane przez tę lekcję

- `context/foundation/prd.md` - wejście
- `context/foundation/tech-stack.md` - opcjonalne wejście
- `context/foundation/infrastructure.md` - opcjonalne wejście
- `context/deployment/deploy-plan.md` - opcjonalne wejście
- `context/foundation/roadmap.md` - wyjście
- `context/foundation/lessons.md` - powtarzające się reguły i pułapki
- `docs/reference/contract-surfaces.md` - rejestr kluczowych nazw

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozstrzygnięta ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->

# Rules for AI

## Security & Configuration

Never commit `.env` or `.dev.vars`. `SUPABASE_URL` and `SUPABASE_KEY` are server-only Astro environment fields; provide them locally and as CI/Cloudflare secrets. New Supabase tables require timestamped migrations in `supabase/migrations/` with RLS and granular policies.

## Git Workflow

For each change:

1. Create a dedicated branch from `main`.
2. Implement and verify the change.
3. Commit the changes on that branch.
4. Open a pull request targeting `main`.
5. Merge the pull request after review and passing CI.

Do not commit changes directly to `main`.

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
- Protected page example: `src/pages/dashboard.astro`

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
