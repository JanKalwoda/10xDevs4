# Research — account entry by email link

## Scope and confirmed decisions

S-09 / FR-009 replaces the split password sign-in/sign-up experience with one email-only magic-link flow for new and existing accounts. Keep guest access to `/`, the existing SSR cookie session, protected dashboard, and sign-out. No timer component or engine changes are in scope.

The coordinator confirmed direct `zod` dependency ownership; GET confirmation before token use; `GET /auth/callback` must not consume `token_hash`; an explicit POST performs `verifyOtp`; callback responses are `no-store` and `no-referrer`, with no third-party resources or application logs containing tokens. Remote smoke is public-route/dashboard-guard only and does not send email or use `SMOKE_PASSWORD`. The user will manually verify a real production link before S-09 is called complete. The three planning decisions are settled; there is no remaining design question.

## Architecture insights

- `src/lib/supabase.ts:5-20` constructs the SSR client from server-only Astro env fields and persists refreshed auth cookies through `AstroCookies`. Reuse this adapter for both OTP request and verification; do not introduce a browser-side Supabase key or service-role flow.
- `src/middleware.ts:4-23` loads `context.locals.user` and protects `/dashboard`, but its sign-in redirect currently drops the requested destination. Carry a validated local `next` through the email request and return there only after successful verification.
- `src/pages/api/auth/signin.ts:4-21` currently calls `signInWithPassword`; `src/pages/api/auth/signup.ts:4-20` calls `signUp` with a password. `src/components/auth/SignInForm.tsx:43-85` renders email and password, while `src/pages/auth/signup.astro` is a separate form. Retire password registration and route legacy signup entry to the same email-only flow.
- `src/pages/index.astro:6-8` renders only the guest-capable timer. `src/components/Topbar.astro:1-33` already reads the middleware user but offers separate sign-in/sign-up links and uses palette classes. Add only the account entry affordance in the Astro shell as authorized; leave timer components untouched and use repository tokens from `src/styles/global.css` plus components from `src/components/ui/`.
- `src/pages/auth/confirm-email.astro` is an existing post-signup screen and can become the account-neutral “check your email” result. There is no callback confirmation route yet.
- `scripts/smoke.mjs:8-10,44-59` currently requires an email and password in both modes and tests password auth. `.github/workflows/ci.yml:38-54` excludes `mailpit` while starting Supabase; its deploy job also passes password smoke secrets at lines 81-89. `.github/workflows/production-smoke.yml:22-25` does the same. Local end-to-end coverage therefore needs Mailpit enabled; remote coverage must become credential-free and explicitly limited to public routes and the dashboard guard.
- `supabase/config.toml:99-102` configures the local email testing server on port `55324`; `[auth.email]` and template examples are at lines 202-238. `package.json` already provides Node’s test runner (`npm test`), lint, build, and smoke scripts; use the existing test stack.

## Charges

1. **No account entry on the first screen** — `src/pages/index.astro:6-8` renders the timer only. A guest can use the timer, but has no direct path into the account flow. Address this with a small Astro-shell navigation affordance, without changing timer behavior.
2. **The current form asks users to choose an account state and maintain a password** — `src/components/auth/SignInForm.tsx:43-85` and `src/pages/auth/signup.astro` expose distinct password flows. Replace them with one email form and a neutral result shared by new and existing accounts.
3. **The old password smoke does not prove email authentication** — `scripts/smoke.mjs:8-10,56-59` and both smoke workflows require `SMOKE_PASSWORD`. Cover actual delivery and token exchange locally through Mailpit; make production automation verify only public routes and dashboard protection, leaving real production link verification manual.

## External contracts

- Supabase documents `{{ .TokenHash }}` and `{{ .RedirectTo }}` for custom email links and server-side `verifyOtp`; use the app-provided callback redirect, which carries a validated `next`: [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).
- Supabase documents wildcard redirect allowlist patterns. The production callback entry to prepare for the coordinator is `https://drill-me.twincoder.workers.dev/auth/callback*`; `*` covers the callback query containing `next`: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Environment preflight

- Worktree: `D:/Dev/10xDevs4-enter-account-by-email-link`, branch `feature/enter-account-by-email-link`, based on `2cb10d0f96e4cc53df0c07ec42fc2bc70d873679`.
- Node `v24.21.0` matches `.nvmrc`; npm `11.0.0`; Docker daemon available at `27.3.1`.
- `npm ci` completed successfully (725 packages). npm reported 10 existing dependency audit findings (4 moderate, 6 high); no audit fix or dependency upgrade was run.
- No tests, Supabase services, production settings, or remote secrets were accessed in this planning stage.

## Deferred gates

- Before merge, the coordinator must apply/confirm the production Magic Link template and callback redirect allowlist described verbatim in `plan.md`; no remote mutation is included in this stage.
- After deployment, the user must manually open a real production email link and complete the explicit confirmation POST. The credential-free remote smoke is not evidence that email delivery or auth exchange works.
