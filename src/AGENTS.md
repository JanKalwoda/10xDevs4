# Repository Guidelines

This repository is an Astro 7 SSR application using React 19 islands, Tailwind CSS 4, Supabase authentication, shadcn/ui, and Cloudflare Workers. Treat `@README.md`, `@package.json`, and `@.github/workflows/ci.yml` as the canonical operational references.

## Critical Rules

- Never commit `.env` or `.dev.vars`; keep `SUPABASE_URL` and `SUPABASE_KEY` in local, CI, or Cloudflare secret storage.
- Add database changes as timestamped files under `supabase/migrations/` (for example, `20260920143000_add_profiles.sql`). Enable RLS on every new table and define granular policies by role and operation.
- Keep pages server-rendered by default. API routes must export `const prerender = false`.

## Project Structure

- `src/pages/` contains Astro pages and API endpoints; auth endpoints live in `src/pages/api/auth/`.
- `src/components/ui/` contains shadcn/ui components; interactive React components belong under `src/components/`, with hooks in `src/components/hooks/`.
- `src/lib/` contains helpers and services. Put shared entities and DTOs in `src/types.ts`.
- `src/middleware.ts` resolves Supabase sessions and protects configured routes. Use `src/pages/dashboard.astro` as the protected-page example.
- `supabase/migrations/` contains database migrations. CI configuration lives in `.github/workflows/`.

## Development and Verification

Use the npm scripts declared in `@package.json`; do not bypass project wrappers with direct tool invocations. Common workflows are `npm run dev` for local development and `npm run build` for the production build. Run the repository’s lint and test scripts before opening a PR. Local Supabase requires Docker and starts with `npx supabase start`; Cloudflare deployment uses `npx wrangler deploy`.

## Coding Conventions

Use the `@/*` alias for `src/*`. Prefer Astro components for static rendering and React only for interactivity; do not add Next.js directives such as `"use client"`. Use `cn()` from `@/lib/utils` for conditional Tailwind classes. API handlers export uppercase methods such as `GET` and `POST` and validate request input with Zod.
Run the formatting and type-check scripts declared in @package.json; do not override @tsconfig.json locally.

## Tests, Commits, and Pull Requests

“Place tests beside the tested module using the filename pattern already present in that directory; if no neighboring test exists, follow the location configured by the repository test runner.
Run the exact CI checks from `@.github/workflows/ci.yml`;
no coverage threshold is documented here.
Use the commit prefix and imperative subject style found in the latest 30 commits; do not combine migrations, UI changes, and unrelated refactors in one commit.
PRs should describe behavior changes, link the relevant issue, identify migrations or secret changes, and include screenshots for UI work. Ensure the production-preview CI flow passes with local Supabase.
