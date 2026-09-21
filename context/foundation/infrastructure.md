---
project: "DryFire Drill Timer"
researched_at: 2026-09-20
recommended_platform: "Cloudflare Workers"
runner_up: "Railway"
context_type: mvp
tech_stack:
  language: "TypeScript"
  framework: "Astro 7 SSR + React 19"
  runtime: "Cloudflare Workers"
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare is the only candidate that runs the repository's existing `@astrojs/cloudflare` adapter and `wrangler.jsonc` without changing the runtime contract. It received Pass in all five agent-friendly criteria, and the expected 10,000–100,000 monthly requests fit comfortably within the Workers Free allowance. Supabase remains an external service: the preference for co-located data cannot be met without replacing the database and auth stack, which is outside this deployment decision.

The interview constraints were: persistent connections unknown, minimum cost as the highest priority, no existing platform familiarity, one region sufficient, and co-location preferred. The application currently has no realtime or background-job requirements, so the serverless runtime is not disqualified.

## Platform Comparison

| Platform | CLI-first | Managed / serverless | Agent-readable docs | Stable deployment API | MCP / integration | Overall | MVP cost and fit |
|---|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5/5 | Free allowance fits expected traffic; existing adapter and config |
| Railway | Pass | Pass | Pass | Pass | Pass | 5/5 | Minimum about $5/month; strong co-location and persistent processes, but requires Node adapter |
| Netlify | Pass | Pass | Pass | Pass | Pass | 5/5 | About $5/month on Personal; serverless-only and requires its own adapter |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4.5/5 | Hobby is restricted to personal/non-commercial use; MCP is Beta |
| Render | Partial | Pass | Pass | Pass | Pass | 4.5/5 | Free services sleep and are not recommended for production MVPs |
| Fly.io | Pass | Partial | Pass | Pass | Pass | 4.5/5 | Small VM is inexpensive, but introduces containers and more operations |

Cloudflare has complete Wrangler flows for deploy, rollback, versions, secrets, and logs. Its documentation is directly readable as Markdown and it provides official remote MCP servers. Workers Free includes 100,000 requests per day, although each free invocation has a 10 ms CPU limit. The platform also offers D1, R2, KV, Durable Objects, and Queues, but those do not make the existing Supabase PostgreSQL/Auth deployment co-located.

Netlify has a capable CLI, atomic application deploys, readable documentation, an official Astro adapter, and an official remote MCP without a beta or preview label as checked on 2026-09-20. Moving there requires replacing `@astrojs/cloudflare` with `@astrojs/netlify` and revalidating server environment access and cookies. Its credit model can cover a small MVP but is less predictable because production deploys, bandwidth, requests, and compute share the allowance. It cannot provide a permanently running server process.

Railway provides persistent Node processes, WebSockets, Postgres, Redis, RabbitMQ, volumes, private networking, cron, and workers in one project. It requires replacing the Cloudflare adapter with `@astrojs/node`, configuring a standalone Node server, and revalidating the runtime. Rollback to a retained deployment image is exposed through deployment history rather than a dedicated rollback CLI command, and image retention depends on the plan. Its official MCP is not marked beta, but the minimum Hobby spend conflicts with the cost-first preference. Replacing Supabase would still require a separate architecture decision because Railway Postgres does not replace Supabase Auth automatically.

Vercel supports Astro SSR using its own adapter and has excellent CLI, API, preview, and documentation flows. The free Hobby plan is limited to personal, non-commercial use; a commercial MVP may need Pro. Vercel MCP and Queues are Beta as checked on 2026-09-20. Native WebSocket support is bounded by function lifetime, and Postgres is supplied through external Marketplace providers.

Render supports Astro as a persistent Node web service after replacing the adapter. Its free instance sleeps after inactivity and can take about a minute to wake; free Postgres expires after 30 days, so the free tier is unsuitable for this production MVP. The infrastructure MCP is available, while the separate documentation-search MCP is Experimental as checked on 2026-09-20.

Fly.io supports persistent processes and WebSockets through Machines, but requires the Node adapter, a Docker image, and additional operational ownership. Rollback means redeploying a retained image and does not atomically restore configuration, secrets, volumes, or databases. `flyctl` includes an official MCP server without a beta or preview label as checked on 2026-09-20.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare wins because it preserves the locked runtime and adapter, has the lowest expected cost, and provides the strongest combined CLI, documentation, deployment API, observability, and agent integration. The repository already contains Wrangler 4.131.1 and a Workers configuration compatible with the Astro 7 Cloudflare adapter.

#### 2. Railway

Railway is the strongest fallback if persistent processes or provider-managed co-location become hard requirements. It offers an excellent operational surface and integrated data services, but adds a monthly baseline cost, changes the runtime from Workers to Node, and would require a separate stack decision before replacing Supabase.

#### 3. Netlify

Netlify is the strongest low-cost serverless fallback. It offers a polished Astro workflow, safe draft deploys, atomic deploy restoration, and an official MCP, but requires an adapter migration, has a shared-credit billing model, and does not provide a permanently running process or co-locate the existing Supabase service.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. Workers Free permits only 10 ms CPU per invocation. Heavier SSR, validation, or dependency initialization may require the paid plan even at low request volume.
2. Supabase runs outside Cloudflare. Sequential database calls to one Supabase region can dominate latency and erase the practical benefit of edge execution.
3. `nodejs_compat` is not a complete Node.js environment. A future dependency can pass local tests and still fail or behave differently in Workers.
4. `wrangler rollback` restores Worker code, not Supabase migrations, secrets, KV/R2 data, or other external state.
5. The earlier foundation document names Cloudflare Pages, while the current Astro adapter and Wrangler configuration implement Workers with static assets. Mixing Pages and Workers commands would create divergent deployments.

### Pre-Mortem — How This Could Fail

Six months after launch, the team discovers that it treated Astro's Cloudflare support as proof that every Node dependency would work unchanged. The initial release succeeded, but a later library used an API that `nodejs_compat` did not fully reproduce, causing failures only in the deployed Worker. At the same time, several sequential calls from the edge to a single Supabase region made authenticated pages slower than expected, but the absence of latency budgets and alerting hid the regression. A schema migration was then released together with a new Worker version. When the code failed, `wrangler rollback` restored the old bundle but could not restore the database schema, leaving production incompatible with both releases. Finally, automation copied an obsolete Pages command even though Astro 7 and the current adapter emitted a Workers application with static assets. Two deployment paths began using different secrets and project state. Cloudflare itself remained available; the failure came from untested runtime assumptions, remote-data latency, non-atomic application/database rollback, and confusion between the Pages and Workers deployment models.

### Unknown Unknowns

- Since Astro 6, the Cloudflare environment is selected during the build. Each target environment must be built separately; `wrangler deploy --env` alone no longer switches an already-built Astro artifact.
- The project declares `@astrojs/cloudflare` as `^14.3.1`, while the checked documentation describes 14.3.2. Reinstalling without the lockfile could change adapter behavior.
- With the current adapter, `astro dev` already uses the Cloudflare Vite integration. Old guidance based on `wrangler preview` is obsolete, and a separate `wrangler dev` loop is not the canonical Astro workflow.
- The Workers Free request allowance does not override the per-invocation CPU ceiling. Low traffic can still fail because an individual request is too expensive.
- A Worker rollback and a Supabase database rollback are separate operational procedures and must be designed as such.

## Operational Story

- **Preview deploys**: Git-connected Workers Builds should create non-production versions for branches and pull requests; use the generated preview URL for smoke testing. Treat previews containing real Supabase credentials as sensitive and use a separate preview Supabase project or restricted preview secrets. Fork pull requests must not receive production secrets.
- **Secrets**: local Astro development uses an uncommitted `.env`; local Wrangler execution uses an uncommitted `.dev.vars`. Production values are stored as Workers secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`, or injected by CI from protected GitHub secrets. Tokens must be scoped to this Worker. Humans rotate primary Supabase and Cloudflare credentials; the agent may reference variable names but must not print values.
- **Rollback**: inspect versions with `npx wrangler versions list`, then run `npx wrangler rollback <VERSION_ID> --message "rollback: <reason>"`. The Worker switches immediately, normally within seconds. Database migrations and external state do not roll back; only use this path when the selected code version remains compatible with the live schema.
- **Approval**: an agent may build, lint, run smoke tests, create a preview, and read logs. A human approves the first production publication, production secret changes, database migrations, DNS changes, and any destructive action. Dropping data, deleting the Worker, or rotating a primary credential remains human-only.
- **Logs**: read live runtime logs with `npx wrangler tail 10x-astro-starter --format json`; inspect deployed versions with `npx wrangler versions list`. Prefer read-only OAuth or a project-scoped API token for diagnostics. CI/build logs remain in Workers Builds or GitHub Actions, depending on the selected deployment automation.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Free-plan 10 ms CPU limit is exceeded | Devil's advocate | M | M | Add an SSR smoke test and inspect CPU time before launch; move to the $5 paid plan if measured headroom is insufficient. |
| Supabase round trips dominate latency | Devil's advocate | M | M | Select the nearest Supabase region, avoid sequential queries, measure authenticated-route latency, and keep one consistent data region. |
| A Node-oriented dependency is incompatible with Workers | Devil's advocate | M | H | Run production-runtime smoke tests for dependency upgrades and verify Workers compatibility before merging. |
| Code rollback is incompatible with a migrated schema | Pre-mortem | M | H | Use backward-compatible expand/contract migrations and document a separate database recovery procedure. |
| Pages and Workers deployment commands are mixed | Pre-mortem | M | H | Declare Workers + Static Assets as the sole target and use only `astro build` followed by `wrangler deploy`. |
| Wrong environment is embedded during the Astro build | Unknown unknowns | M | H | Build separately per environment with `CLOUDFLARE_ENV` set before `astro build`; never reuse artifacts across environments. |
| Adapter behavior changes after dependency resolution | Unknown unknowns | L | M | Commit and use `package-lock.json`; run `npm ci`, tests, and a preview deployment before dependency upgrades reach production. |
| Production secrets leak into fork previews | Research finding | L | H | Do not expose secrets to fork workflows; use isolated preview credentials and protected CI environments. |
| Free-plan daily limit produces error responses | Research finding | L | M | Add request-volume monitoring and define the threshold for moving to Workers Paid before the daily allowance is exhausted. |

## Getting Started

1. Keep `@astrojs/cloudflare` and the existing `wrangler.jsonc`; do not add a Pages deployment command or replace the adapter.
2. Authenticate interactively as the human owner with `npx wrangler login`, then create a least-privilege project token for CI rather than reusing an account-wide key.
3. Store `SUPABASE_URL` and `SUPABASE_KEY` as scoped Workers secrets. Keep local values only in gitignored `.env` or `.dev.vars` files; never commit either file.
4. Verify the pinned project with `npm ci`, `npm run lint`, `npm run build`, and `npm run smoke`. For Astro 7 with `@astrojs/cloudflare` 14.x, the canonical local loop remains `npm run dev`.
5. Deploy the built Workers application with `npx wrangler deploy`, then validate the generated URL, authentication flow, protected routes, Supabase access, and runtime logs with `npx wrangler tail 10x-astro-starter --format json`.

## Evidence

- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Astro framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/)
- [Netlify Astro adapter](https://docs.astro.build/en/guides/integrations-guide/netlify/)
- [Railway Astro guide](https://docs.railway.com/guides/astro)
- [Vercel Astro support](https://vercel.com/docs/frameworks/frontend/astro)
- [Render Astro deployment](https://render.com/docs/deploy-astro)
- [Fly.io Astro guide](https://fly.io/docs/js/frameworks/astro/)

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
