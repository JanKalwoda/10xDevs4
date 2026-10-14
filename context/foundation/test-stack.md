# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.64.1
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/<name>.spec.ts
- full-suite command: npx playwright test
- base URL: http://localhost:3333
- port: 3333 (E2E_PORT from .env.e2e; detected default 4321 from `astro preview` — astro.config.mjs and the preview script set none; the local Supabase allows magic-link callbacks on 3333 via additional_redirect_urls in supabase/config.toml)
- web server command: npm run build && npm run preview -- --port $E2E_PORT (ASTRO_PREVIEW_BACKGROUND=1 keeps the Astro 7 preview in the foreground); reuseExistingServer outside CI
- auth setup project: setup (tests/e2e/auth.setup.ts), magic-link sign-in (no password) through the UI and the local Mailpit inbox; credentials from E2E_USERNAME (+ MAILPIT_URL, default http://127.0.0.1:55324) in .env.e2e — never .env, which may hold production Supabase values; the preview reads the local stack from .dev.vars; needs `npx supabase start`
- storageState: playwright/.auth/user.json (gitignored)
- seed: tests/e2e/seed.spec.ts — protects #5 (after saving the user lands on the saved timer `/{id}`, after deleting back on `/timers`)
- browser CLI: playwright-cli (session `-s=10xDevs4`), command skill at .claude/skills/playwright-cli/SKILL.md
- updated: 2026-10-14
