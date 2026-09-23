# Cloudflare Workers + Supabase Deployment Plan

## Summary

Deploy `drill-me` as an Astro 7 SSR Worker with static assets, backed by a new Supabase project in Central EU (Frankfurt). Production initially uses `workers.dev`, Supabase’s built-in SMTP, and Cloudflare/GitHub free-tier capabilities.

Pull requests run isolated CI with local Supabase. Production deploys run from `main` only after CI passes. The first publication remains a manual human gate; subsequent merges deploy automatically.

## Phase Checklist

### Phase 0 — Accounts, CLIs, and local-service prerequisites

Complete these sections in order: Docker, Supabase, Cloudflare account, then Wrangler. Wrangler does not have a separate account; it authenticates against the Cloudflare account.

#### 0A — Docker Desktop for local Supabase

- [x] Confirm Windows virtualization is enabled and WSL 2 is installed and current with `wsl --status` and `wsl --update` from an elevated terminal if an update is required.
- [x] Install Docker Desktop for Windows from the [official installer](https://docs.docker.com/desktop/setup/install/windows-install/), select the WSL 2 backend, and restart Windows if the installer requests it.
- [x] Start Docker Desktop, accept its terms, and wait until the engine reports that it is running. Signing in to Docker Hub is not required for the local Supabase stack.
- [x] Allocate enough Docker Desktop memory for Supabase; target at least 7 GB available to the complete local stack. If resources are constrained, use the repository’s CI exclusion list only after confirming the omitted services are not needed locally.
- [x] Verify the engine from PowerShell:
  - `docker version` must show both Client and Server sections;
  - `docker info` must complete without a daemon connection error;
  - `docker ps` must run successfully.
- [x] If Docker cannot start, verify virtualization in Task Manager/BIOS, run `wsl --shutdown`, restart Docker Desktop, and check that no corporate policy or unsupported nested-virtualization environment blocks WSL 2.
- [x] Before starting Supabase, confirm ports `54321`–`54327` are not occupied. If they are, stop the conflicting process or deliberately update `supabase/config.toml`; do not expose these ports publicly.

#### 0B — Supabase account, hosted project, and CLI

- [x] Create or sign in to a [Supabase account](https://supabase.com/dashboard), verify the account email, enable MFA, and create/select the organization that will own production.
- [x] Create a new Free project:
  - project name: `drill-me`;
  - region: Central EU (Frankfurt), nearest to the initial Polish/EU audience;
  - database password: generate a unique password and store it in a password manager, never in the repository;
  - wait until Database, Auth, and API services are healthy. [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [x] In the project’s Connect/API Keys view, copy the Project URL and an `sb_publishable_*` key. Do not use an `sb_secret_*`, legacy `service_role`, or database password as `SUPABASE_KEY`.
- [x] Use the project-pinned CLI rather than installing another global copy:
  - `npm ci`
  - `npx supabase --version`
  - `npx supabase login` and complete the browser authorization flow
  - `npx supabase projects list` to confirm the intended project is visible
  - `npx supabase link --project-ref <project-ref>` to link this repository
- [x] Do not run `supabase db push`: the repository has no migrations and currently uses only built-in Auth. Future tables must be introduced through timestamped migrations with RLS and granular policies.
- [x] Configure hosted Auth in Authentication → URL Configuration and Providers:
  - Site URL: `https://drill-me.<account-subdomain>.workers.dev`;
  - Redirect allow-list: the same exact production origin/path patterns required by the application, without a broad production wildcard;
  - email/password provider: enabled;
  - email confirmations: enabled;
  - SMTP: built-in Supabase SMTP for this closed MVP, accepting its two-auth-emails-per-hour limit;
  - OTP expiry: no more than one hour;
  - password policy: at least the application’s current requirements.
- [x] Run Supabase Security Advisor, confirm there are no unexpected public tables, and verify that any future public-schema tables have RLS before launch.
- [x] Configure local Supabase separately from production:
  - start Docker Desktop first;
  - run `npx supabase start` from the repository root;
  - run `npx supabase status -o env` and map `API_URL` plus `PUBLISHABLE_KEY` into the untracked `.dev.vars` file as `SUPABASE_URL` and `SUPABASE_KEY`;
  - keep local email confirmations disabled as declared in `supabase/config.toml` so the full local smoke flow can sign in immediately;
  - verify Studio at `http://localhost:54323` and stop services with `npx supabase stop` when finished. [Supabase local development](https://supabase.com/docs/guides/local-development)
- [x] Run the local full-auth smoke test and confirm that it uses only local Supabase URLs and keys.

#### 0C — Cloudflare account and production access

- [x] Create or sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/), verify the account email, and enable MFA before creating production resources.
- [x] Select the account that will own `drill-me`. A Cloudflare-managed DNS zone is not required while production uses only `workers.dev`.
- [x] Open Workers & Pages and configure/confirm the account’s unique `workers.dev` subdomain. Record the resulting production URL as `https://drill-me.<account-subdomain>.workers.dev`.
- [x] Copy the Cloudflare Account ID from the dashboard and store it as the GitHub `production` environment secret `CLOUDFLARE_ACCOUNT_ID`; do not commit it to configuration files.
- [x] In My Profile → API Tokens, create a custom CI token from “Edit Cloudflare Workers,” restricted to the selected account and only the permissions needed to deploy and inspect this Worker.
- [x] Store the token once as the GitHub `production` environment secret `CLOUDFLARE_API_TOKEN`; do not place it in `.env`, `.dev.vars`, Wrangler configuration, chat, shell history, or deployment documentation.
- [x] Keep destructive account operations human-only: deleting the Worker, changing account ownership, rotating primary credentials, or modifying unrelated DNS/resources are not delegated to CI or an agent.

#### 0D — Wrangler CLI authentication and configuration

- [x] Use the Wrangler version pinned in `package-lock.json`; run it as `npx wrangler` instead of installing a global version.
- [x] Verify the local CLI with `npx wrangler --version` and confirm it matches the lockfile-supported major version.
- [x] Authenticate the developer workstation with `npx wrangler login`, complete the browser OAuth flow for the selected Cloudflare account, and verify it with `npx wrangler whoami`.
- [x] If browser login cannot open, copy the displayed authorization URL into a browser on the same workstation. For CI, never use interactive login; use only the scoped API token and Account ID.
- [x] Review `wrangler.jsonc` before any remote command and confirm:
  - Worker name is `drill-me`;
  - target is Workers + Static Assets, not Pages;
  - `nodejs_compat`, assets, observability, and required Supabase secret names are declared;
  - no credential values appear in the file.
- [x] Run `npm run build` before every Wrangler preview/deploy command because Astro generates `.wrangler/deploy/config.json` and the deployable `dist/server/wrangler.json` during the build.
- [x] Validate locally with `npx wrangler deploy --dry-run`; confirm it selects the generated configuration and does not contact production to publish a version.
- [x] For the first production publication, supply `SUPABASE_URL` and `SUPABASE_KEY` through the temporary out-of-repository secrets file described in Phase 5. For later deploys, Wrangler must preserve the existing encrypted Worker secrets.
- [x] If authentication fails, rerun `npx wrangler whoami`, confirm the intended account, remove stale local OAuth only through Wrangler’s logout flow, and reauthenticate. Do not fall back to a Global API Key.

Execution status (2026-09-23): Phase 0 was completed before this branch. Local Supabase uses ports `55321`–`55327` from `supabase/config.toml`; the original default-port examples above are superseded by that configuration. The Cloudflare account subdomain is `twincoder`, so the production origin is `https://drill-me.twincoder.workers.dev`.

### Phase 1 — Repository and credential safety

- [x] Open and merge the existing `feature/m1l5` branch into `main`, preserving `infrastructure.md`. PR #2 merged after both CI jobs passed.
- [x] Create `feature/cloudflare-deployment` from the updated `main`.
- [x] Save this approved checklist as `context/deployment/deploy-plan.md`; update its indicators during execution.

### Phase 2 — Deployment configuration

- [x] Change the Worker name from `10x-astro-starter` to `drill-me`.
- [x] Keep Workers + Static Assets as the sole target; do not introduce Cloudflare Pages commands.
- [x] Keep the tested compatibility date and `nodejs_compat`; update it only in a separately tested maintenance change.
- [x] Declare `SUPABASE_URL` and `SUPABASE_KEY` under Wrangler’s required secrets so deploys fail before publication when either is missing.
- [x] Set the Astro Cloudflare image service to compile-time optimization. The current application does not need runtime Cloudflare Images, avoiding an unnecessary binding and its 5,000-transformation free-tier boundary. [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- [x] Retain the automatically provisioned `SESSION` KV binding and existing `ASSETS` binding. No manual KV creation is required. [Astro Cloudflare sessions](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [x] Preserve `public/.assetsignore` and validate that the generated Wrangler redirect points at `dist/server/wrangler.json`.
- [x] Once the account’s Workers subdomain is known, set Astro’s `site` to `https://drill-me.twincoder.workers.dev` so sitemap generation no longer warns.
- [x] Update README instructions to use the Supabase publishable key, not the legacy `anon` key. Keep the environment name `SUPABASE_KEY` for compatibility, but its value must be `sb_publishable_*`, never `sb_secret_*` or `service_role`. Supabase plans to deprecate legacy keys by the end of 2026. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

### Phase 3 — CI/CD and secret boundaries

- [x] Keep pull-request CI isolated: lint, `astro check`, build, and full smoke test against local Supabase. PRs must not receive Cloudflare or production Supabase credentials.
- [x] Extend the smoke script with two explicit modes:
  - `local`: current signup/signin/signout flow with local confirmation disabled.
  - `remote`: use a previously verified, non-privileged smoke account; do not create a new account on every deploy.
- [x] Add a production deployment job that:
  - runs only for pushes to `main`;
  - depends on both CI jobs;
  - uses `concurrency` to prevent overlapping production deploys;
  - checks the `PRODUCTION_DEPLOY_ENABLED` repository variable;
  - runs `npm ci`, `npm run build`, and the repository-pinned Wrangler deploy;
  - runs the remote smoke test and records the deployed version.
- [x] Create a GitHub `production` environment restricted to `main`.
- [ ] Store `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SMOKE_EMAIL`, and `SMOKE_PASSWORD` as production-environment secrets.
- [x] Keep Supabase application credentials only in Cloudflare Worker secrets, avoiding a second copy in GitHub.
- [x] Leave `PRODUCTION_DEPLOY_ENABLED` unset/false until the first manual deployment succeeds.
- [x] Do not create public PR preview deployments until a separate preview Supabase project exists. Version preview URLs are public unless protected with Cloudflare Access. [Cloudflare preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)

### Phase 4 — Verification and pull request

- [x] Run:
  - `npm run lint`
  - `npx astro check`
  - `npm run build`
  - `npx wrangler deploy --dry-run`
  - `npm run smoke` against local Supabase
- [x] Confirm the dry run contains `ASSETS` and `SESSION`, does not contain `IMAGES`, and uses the generated `dist/server` configuration.
- [x] Confirm no tracked file or Git diff contains a credential value.
- [x] Commit on `feature/cloudflare-deployment`, open PR #3 to `main`, and wait for all CI checks and review.
- [x] Merge only after CI passes. PR #3 merged as `4b15d27`; both jobs also passed on the resulting `main` push in CI run `35897584300`. The gated deploy job skipped as intended.

### Phase 5 — First production publication

- [x] From the reviewed and merged `main`, install the locked dependencies with `npm ci` and rebuild the application. The generated Worker also passed `npx wrangler deploy --dry-run`.
- [x] Human gate: create a temporary secret file outside the repository containing only `SUPABASE_URL` and the publishable `SUPABASE_KEY`. The owner approved publication and provided the path without disclosing values in chat.
- [x] Run the first atomic deployment with `npx wrangler deploy --secrets-file <absolute-temporary-path>`. Deployed from `main` commit `4b15d27` on 2026-09-23.
- [x] Immediately delete the temporary file and verify that it never entered Git history, shell history, logs, or the workspace. The out-of-repository file was deleted and its absence verified; the repository worktree remained clean.
- [x] Verify the resulting `https://drill-me.twincoder.workers.dev` URL and update Supabase Site URL if the actual subdomain differs. The URL matched the planned subdomain; home returned 200 and anonymous dashboard redirected to sign-in.
- [ ] Register and confirm one dedicated smoke account, then store its low-privilege credentials in the GitHub production environment.
- [ ] Execute the remote smoke mode:
  - home returns 200;
  - anonymous dashboard request redirects to sign-in;
  - verified user can sign in;
  - protected dashboard returns 200;
  - sign-out clears the session;
  - subsequent dashboard access redirects again.
- [x] Inspect errors with `npx wrangler tail drill-me --format json --status error`. No error events appeared during the initial home and anonymous dashboard requests; repeat after authenticated smoke.
- [x] Record `npx wrangler versions list` and `npx wrangler deployments list` output identifiers in the deployment artifact, without copying secrets or user data. Both list version `4ff49a46-cffd-4eb8-8b03-f0bcc52d06e3` at 100% traffic, created 2026-09-23 17:52:09 UTC.
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
