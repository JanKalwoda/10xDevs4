<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Moduł 2, Lekcja 5 (10xDevs 4.0 UI)

**Do pracy nad interfejsem użytkownika w widoku, który już się renderuje, użyj `/10x-ui`.** Uruchamia ono wizualną
zmianę przez ten sam łańcuch co każdą inną zmianę (`/10x-new` → `/10x-research` →
`/10x-plan` → `/10x-implement` → `/10x-impl-review`) i uwzględnia zasady:
kiedy rozpocząć pracę i który widok wybrać, audyt obciążeń, kontrakt systemu projektowego w formie
zaimplementowanej w tym repozytorium, stany komponentów, bramkę zrzutów ekranu oraz zasadę, która
utrzymuje kolejnego agenta przy kontrakcie. W jego `references/` znajduje się lista kontrolna jakości.

Tworzenie widoku po raz pierwszy nie jest zadaniem dla `/10x-ui` — zbuduj go za pomocą
zwykłego łańcucha, a następnie wróć do niego z `/10x-ui`.

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
