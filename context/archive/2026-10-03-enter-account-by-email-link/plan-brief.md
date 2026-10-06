# Account Entry by Email Link — Plan Brief

> Full plan: `context/changes/enter-account-by-email-link/plan.md`
> Research: `context/changes/enter-account-by-email-link/research.md`

## What & Why

S-09 replaces separate password login and registration with one email-only magic-link flow for new and existing accounts. Visitors can keep using the timer as guests, and authentication continues through the app’s SSR cookie session. Link GET only presents a confirmation form; a deliberate POST consumes the token.

## Starting Point

The app already has Supabase SSR cookies, middleware user resolution, a protected dashboard, and sign-out. Current auth pages and endpoints use passwords, `/` has no account link, local CI disables the email inbox, and both local and remote smoke require a password.

## Desired End State

People enter one email, get the same neutral response, and can confirm a one-time link to reach a validated same-origin destination. The local CI flow proves actual delivery, cookie persistence, dashboard access, sign-out, and bad/reused-link behavior. Production route smoke is credential-free and limited to public pages plus dashboard protection; the user manually verifies a real production link before S-09 is complete.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Input validation | Add direct Zod dependency | Server form and callback inputs share explicit validation | Coordinator approval |
| Account behavior | Same email-only flow for new/existing users; no password registration | Avoid a separate account-state choice and password form | FR-009 and coordinator approval |
| Token consumption | `GET /auth/callback` presents a page; explicit `POST /api/auth/callback` calls `verifyOtp` | Mail scanners must not consume links | Coordinator approval |
| Callback protections | `no-store`, `no-referrer`, no third-party resources, application diagnostics omit tokens and callback URLs | Protect the explicit confirmation flow while keeping the logging guarantee scoped to app code | Coordinator approval |
| Local auth proof | Enable local confirmations; confirmation and magic_link templates share the `type=email` callback; Mailpit E2E covers new and existing users plus actual SSR cookies | Exercise both Supabase email paths with the hosted confirmation policy preserved | Coordinator approval |
| Local callback origins | `http://localhost:4321/auth/callback*` for CI and `http://localhost:4323/auth/callback*` for auth dev; add 127.0.0.1 only if actually used | Keep `BASE_URL` and Supabase redirect allowlist aligned | Coordinator approval |
| Unit-test boundary | Pure injected service/adapter boundary under `node:test`; actual Astro SSR cookie roundtrip belongs to local E2E | Avoid unsupported claims about Node importing Astro routes or virtual modules | Coordinator approval |
| Existing-view UI gate | `/10x-ui` matrix at 1280/390 in light/dark for default, hover, focus-visible, disabled, error, empty/N/A with reason, and loading | Match repository UI guidance; coordinate shared CSS/Layout/components, leave timer components untouched | Coordinator approval |
| Phase gates | Local checks → phase commit → push/PR → CI/review → coordinator merge → production route smoke → user manual link test | CI requires a pushed phase commit; merge remains coordinator-owned | Coordinator approval |
| Query redaction | `wrangler.jsonc` keeps observability enabled and sets `redact_query_string=true`; app logs omit tokens; browser history remains a residual limitation | Redact request query strings in Worker logs/traces without disabling logs; inspect generated deployment config before merge, not live logs | Coordinator approval |
| Legacy signup routes | `POST /api/auth/signup` aliases the same email request/result; `/auth/signup` redirects to signin preserving safe `next` | Keep stale POST callers compatible without preserving password registration | Coordinator approval |
| Production automation | Public routes and anonymous dashboard redirect only; no mail/password | Avoid password-based false confidence and production email side effects | Coordinator approval |
| Production completion | User manually verifies a real link after deploy | Route-only smoke cannot prove email auth | User approval |
| Home integration | Account navigation in the Astro index shell; no timer component edits | Keep guest timer and isolate auth navigation from timer internals | Coordinator approval |

## Scope

**In scope:** server request/verify contracts, safe return paths, unified email UI, explicit confirmation screen, local confirmation and magic-link templates/config, callback allowlists, root-shell account navigation, Mailpit E2E, CI and public-only remote smoke, Wrangler query redaction plus generated-config pre-merge verification, production setup confirmation, and post-deploy manual auth check.

**Out of scope:** password registration, new database schema, OAuth, timer internals, production secret changes by the implementation agent, and automated production email delivery/authentication.

## Architecture / Approach

The form posts to the existing server auth boundary, which calls `signInWithOtp` and sets `emailRedirectTo` with a validated local `next`. Local Supabase enables confirmations and points both email templates to the shared `/auth/callback` contract; GET renders a no-store/no-referrer confirmation page and POST verifies through the existing cookie-backed SSR client. Local CI retrieves messages from the Supabase inbox and proves actual Astro cookie persistence. Worker observability remains enabled with query-string redaction; remote smoke has no credentials and never sends email.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server flow and contracts | Zod inputs, neutral OTP request, safe `next`, explicit verify POST, unit tests | Open redirects or account enumeration |
| 2. UI, routing, and email template | One form, confirmation/result pages, root navigation, local template, screenshots | Token leakage or accidental timer coupling |
| 3. Mailpit E2E, CI, and deploy smoke | Actual local email journey, CI coverage, public-only remote smoke | Local config and production manual setup drift |

**Prerequisites:** Node 24.21.0, Docker, and the existing local Supabase project; before merge the coordinator confirms hosted confirmation policy/templates/allowlist and reviews the generated Wrangler deployment configuration.
**Estimated effort:** Three isolated implementation phases, each with its own tests, commit, handoff, and fresh thread.

## Open Risks & Assumptions

- Hosted confirmation policy, both email templates, and redirect allowlist are external settings. The coordinator confirms their exact state before merge; no remote mutation is part of this plan.
- The production smoke intentionally does not prove email delivery or token exchange. S-09 remains incomplete until the user confirms a real post-deployment magic-link check.
- `next` must stay a same-origin path from request through email and callback. Application logging/error paths must not serialize tokens or callback URLs; `observability.redact_query_string=true` covers query strings in Worker logs/traces, while browser history remains an explicit residual limitation. Verify the generated deploy configuration before merge without inspecting live logs or secrets.

## Success Criteria (Summary)

- A new and an existing account complete the same email-only local flow through real Mailpit messages, SSR cookies, dashboard, and sign-out.
- Invalid, expired, or reused links do not create a session; GET alone never consumes the token.
- CI’s remote smoke verifies only public routes and dashboard protection without email/password secrets, and the user confirms the real production link manually.
