# Cloudflare Workers + Supabase Deployment Plan

## Summary

Deploy `drill-me` as an Astro 7 SSR Worker with static assets, backed by a new Supabase project in Central EU (Frankfurt). Production initially uses `workers.dev`, Supabase’s built-in SMTP, and Cloudflare/GitHub free-tier capabilities.

Pull requests run isolated CI with local Supabase. Production deploys run from `main` only after CI passes. The first publication remains a manual human gate; subsequent merges deploy automatically.

## Phase Checklist

### Phase 0 — Repository and credential safety

- [ ] Open and merge the existing `feature/m1l5` branch into `main`, preserving `infrastructure.md`.
- [ ] Create `feature/cloudflare-deployment` from the updated `main`.
- [ ] Save this approved checklist as `context/deployment/deploy-plan.md`; update its indicators during execution.
- [ ] Unstage `.env.local` without deleting the developer’s local copy; add `.env.local` and `.env.*.local` to the root `.gitignore`.
- [ ] Confirm no environment or credential file is tracked using `git ls-files` and a secret scan.
- [ ] Treat the currently staged non-local Supabase key as exposed. If it belongs to any live project, rotate/disable it there. The unreachable local commit does not appear on `main` or the remote feature branch, so no remote history rewrite is planned.
- [ ] Use Node `22.14.0` from `.nvmrc`, not the currently active Node 24 runtime.

### Phase 1 — Deployment configuration

- [ ] Change the Worker name from `10x-astro-starter` to `drill-me`.
- [ ] Keep Workers + Static Assets as the sole target; do not introduce Cloudflare Pages commands.
- [ ] Keep the tested compatibility date and `nodejs_compat`; update it only in a separately tested maintenance change.
- [ ] Declare `SUPABASE_URL` and `SUPABASE_KEY` under Wrangler’s required secrets so deploys fail before publication when either is missing.
- [ ] Set the Astro Cloudflare image service to compile-time optimization. The current application does not need runtime Cloudflare Images, avoiding an unnecessary binding and its 5,000-transformation free-tier boundary. [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- [ ] Retain the automatically provisioned `SESSION` KV binding and existing `ASSETS` binding. No manual KV creation is required. [Astro Cloudflare sessions](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [ ] Preserve `public/.assetsignore` and validate that the generated Wrangler redirect points at `dist/server/wrangler.json`.
- [ ] Once the account’s Workers subdomain is known, set Astro’s `site` to `https://drill-me.<account-subdomain>.workers.dev` so sitemap generation no longer warns.
- [ ] Update README instructions to use the Supabase publishable key, not the legacy `anon` key. Keep the environment name `SUPABASE_KEY` for compatibility, but its value must be `sb_publishable_*`, never `sb_secret_*` or `service_role`. Supabase plans to deprecate legacy keys by the end of 2026. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

### Phase 2 — Local CLI and Supabase prerequisites

- [ ] Install dependencies with `npm ci`; verify `node --version`, `npx wrangler --version`, `npx supabase --version`, and Docker availability.
- [ ] Use `.dev.vars` as the single local secret file:
  - `SUPABASE_URL=http://127.0.0.1:54321`
  - `SUPABASE_KEY=<PUBLISHABLE_KEY from npx supabase status -o env>`
- [ ] Run `npx supabase start`; keep the local stack bound to localhost and never expose it publicly. [Supabase local development](https://supabase.com/docs/guides/local-development)
- [ ] Run the local full-auth smoke test while local email confirmations remain disabled.
- [ ] Authenticate Cloudflare interactively with `npx wrangler login`, then verify the account with `npx wrangler whoami`.
- [ ] Confirm or create the account’s `workers.dev` subdomain.
- [ ] Create a Cloudflare API token using “Edit Cloudflare Workers,” restricted to the selected account; enable MFA on the account. Store neither token nor account ID in repository files.
- [ ] Create a new Supabase Free project in Central EU (Frankfurt), enable account MFA, and wait until its services report healthy. [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [ ] Authenticate with `npx supabase login` and link using `npx supabase link --project-ref <project-ref>`.
- [ ] Do not run `supabase db push`: the repository has no migrations and currently uses only built-in Auth.
- [ ] Obtain the Project URL and publishable key from the Supabase Connect dialog.
- [ ] Configure Supabase Auth:
  - Site URL: exact production `workers.dev` URL.
  - Redirect allow-list: exact production URL only; keep localhost only in local CLI configuration.
  - Email confirmations: enabled.
  - SMTP: built-in Supabase SMTP, acknowledging its two-auth-emails-per-hour limit.
  - Password policy and OTP expiry: retain at least the repository requirements and an expiry of no more than one hour.
- [ ] Run Supabase Security Advisor and confirm no public tables exist without RLS.

### Phase 3 — CI/CD and secret boundaries

- [ ] Keep pull-request CI isolated: lint, `astro check`, build, and full smoke test against local Supabase. PRs must not receive Cloudflare or production Supabase credentials.
- [ ] Extend the smoke script with two explicit modes:
  - `local`: current signup/signin/signout flow with local confirmation disabled.
  - `remote`: use a previously verified, non-privileged smoke account; do not create a new account on every deploy.
- [ ] Add a production deployment job that:
  - runs only for pushes to `main`;
  - depends on both CI jobs;
  - uses `concurrency` to prevent overlapping production deploys;
  - checks the `PRODUCTION_DEPLOY_ENABLED` repository variable;
  - runs `npm ci`, `npm run build`, and the repository-pinned Wrangler deploy;
  - runs the remote smoke test and records the deployed version.
- [ ] Create a GitHub `production` environment restricted to `main`.
- [ ] Store `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SMOKE_EMAIL`, and `SMOKE_PASSWORD` as production-environment secrets.
- [ ] Keep Supabase application credentials only in Cloudflare Worker secrets, avoiding a second copy in GitHub.
- [ ] Leave `PRODUCTION_DEPLOY_ENABLED` unset/false until the first manual deployment succeeds.
- [ ] Do not create public PR preview deployments until a separate preview Supabase project exists. Version preview URLs are public unless protected with Cloudflare Access. [Cloudflare preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)

### Phase 4 — Verification and pull request

- [ ] Run:
  - `npm run lint`
  - `npx astro check`
  - `npm run build`
  - `npx wrangler deploy --dry-run`
  - `npm run smoke` against local Supabase
- [ ] Confirm the dry run contains `ASSETS` and `SESSION`, does not contain `IMAGES`, and uses the generated `dist/server` configuration.
- [ ] Confirm no tracked file or Git diff contains a credential value.
- [ ] Commit on `feature/cloudflare-deployment`, open a PR to `main`, and wait for all CI checks and review.
- [ ] Merge only after CI passes.

### Phase 5 — First production publication

- [ ] From the reviewed and merged `main`, rebuild with Node 22 and `npm ci`.
- [ ] Human gate: create a temporary secret file outside the repository containing only `SUPABASE_URL` and the publishable `SUPABASE_KEY`.
- [ ] Run the first atomic deployment with `npx wrangler deploy --secrets-file <absolute-temporary-path>`.
- [ ] Immediately delete the temporary file and verify that it never entered Git history, shell history, logs, or the workspace.
- [ ] Verify the resulting `https://drill-me.<account-subdomain>.workers.dev` URL and update Supabase Site URL if the actual subdomain differs.
- [ ] Register and confirm one dedicated smoke account, then store its low-privilege credentials in the GitHub production environment.
- [ ] Execute the remote smoke mode:
  - home returns 200;
  - anonymous dashboard request redirects to sign-in;
  - verified user can sign in;
  - protected dashboard returns 200;
  - sign-out clears the session;
  - subsequent dashboard access redirects again.
- [ ] Inspect errors with `npx wrangler tail drill-me --format json --status error`.
- [ ] Record `npx wrangler versions list` and `npx wrangler deployments list` output identifiers in the deployment artifact, without copying secrets or user data.
- [ ] Set `PRODUCTION_DEPLOY_ENABLED=true`; future merges to `main` deploy automatically after CI.

## Interfaces and Operational Contract

- Worker: `drill-me`; endpoint: `workers.dev`; no custom domain in this release.
- Runtime secrets: `SUPABASE_URL`, `SUPABASE_KEY` where the latter is a publishable key.
- CI credentials: scoped Cloudflare token/account ID and a dedicated smoke-user login.
- Local credentials: `.dev.vars` only; never commit `.env`, `.env.local`, or `.dev.vars`.
- Deployment command: `npm run build` followed by `npx wrangler deploy`; Pages commands are prohibited.
- Database changes remain migration-only with RLS. No production schema command is needed for this release.
- Rollback: inspect versions, then run `npx wrangler rollback <VERSION_ID> --message "rollback: <reason>"`. This restores Worker code/configuration, not Supabase state. [Wrangler rollback](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## Edge-Case Support and Acceptance

- [ ] Missing Worker secret: deployment must fail through `secrets.required`; restore it manually rather than weakening validation.
- [ ] Cloudflare authentication failure: verify token account scope, account ID, token expiry, and `wrangler whoami`; never replace it with a global API key.
- [ ] Supabase confirmation link returns to localhost: correct Site URL and exact redirect allow-list, then request a fresh email.
- [ ] Built-in SMTP hits its two-email/hour limit: wait for reset or configure custom SMTP; do not disable confirmations as a production workaround. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [ ] Remote smoke user cannot sign in: verify that the account is confirmed, reset only that user’s password, and inspect Supabase Auth logs without printing tokens.
- [ ] Worker 1101/runtime error: inspect Wrangler tail, reproduce with `astro preview`, confirm Workers compatibility of the failing dependency, then roll back.
- [ ] Supabase latency is excessive: verify Frankfurt project placement, measure authenticated route latency, and remove sequential database requests before considering a platform change.
- [ ] Free Workers CPU/request limits are approached: record CPU and request usage in the Cloudflare dashboard and define Workers Paid as the first scaling step.
- [ ] Future custom-domain migration: add the Cloudflare custom domain, update Astro `site` and Supabase Site URL/redirects atomically, redeploy, and repeat the complete auth smoke test.
- [ ] Deployment is accepted only when CI is green, the production auth flow passes, Workers logs contain no new errors, required secrets are present, and rollback identifiers are recorded.
