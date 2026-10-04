<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Account Entry by Email Link

- **Plan**: context/changes/enter-account-by-email-link/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: SOUND
- **Findings**: 7 reviewed; all coordinator dispositions are incorporated in the plan and brief; 0 unresolved.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 existing paths ✓, 4/4 current symbols ✓, brief↔plan ✓. Coordinator triage is incorporated in plan.md, plan-brief.md, and the updated handoff; implementation evidence remains a later phase gate.

## Findings

### F1 — New-account template path is not pinned

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Production Configuration; Phase 2 — Email Template; Phase 3 — Local email E2E
- **Detail**:
  The plan enables user creation through signInWithOtp but configures only the magic_link template. Supabase documents separate confirmation and magic_link templates: the former is used when a new signup needs email confirmation, while the latter is for passwordless sign-in. The checked-in local config has auth.email.enable_confirmations = false, but the hosted confirmation setting is unknown and the production instructions do not configure the confirmation template. If hosted email confirmation is enabled for first-time users, their link may take a different template/verification path from the planned GET confirmation page and explicit POST. The local Mailpit test with confirmations disabled would not prove that production branch. See [Supabase passwordless sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [Supabase local email template behavior](https://supabase.com/docs/guides/local-development/customizing-email-templates).
- **Fix A ⭐ Recommended**: Keep the hosted confirmation policy and configure the confirmation template to use the same callback, {{ .RedirectTo }}, {{ .TokenHash }}, and type=email; align local config and test a first-time account with confirmations enabled.
  - Strength: Both first-time and returning users reach the explicit app confirmation POST while retaining the project’s email-confirmation policy.
  - Tradeoff: Two templates and both provider paths must be maintained and covered.
  - Confidence: MED — Supabase documents distinct templates; the hosted setting and exact deployed behavior have not been inspected.
  - Blind spot: The coordinator must confirm the hosted setting without exposing project credentials.
- **Fix B**: Pin hosted email confirmations off and align local config, then prove the first-time signInWithOtp path delivers and verifies the same magic-link template.
  - Strength: One template and one callback path to operate.
  - Tradeoff: Requires an explicit hosted auth-setting decision and evidence that the new-user path remains email-verified through the OTP flow.
  - Confidence: MED — the current local config disables confirmations, but its full Mailpit journey has not yet been run.
  - Blind spot: Hosted/local auth settings must not drift.
- **Decision**: RESOLVED — Fix A selected. The plan enables local confirmations and configures both confirmation and magic_link templates for the same type=email callback; preserve hosted policy and coordinator confirms its exact setting before merge.

### F2 — Local callback allowlist does not name the CI origin

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Callback/template configuration; Phase 3 — Local email E2E
- **Detail**:
  supabase/config.toml currently allows https://127.0.0.1:3000, while CI runs the app preview at http://localhost:4321 (.github/workflows/ci.yml, production-preview smoke step). The plan says local callback origins will be allowlisted but never names the origin used by Mailpit smoke. Supabase validates emailRedirectTo against this list, so the phase 3 flow depends on an exact config change that is currently implicit. The production .../auth/callback* pattern can cover its query; wildcard matching is documented in [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- **Fix**: Name and add the callback allowlist entry matching the smoke BASE_URL (currently http://localhost:4321/auth/callback*) to the local Supabase config; keep dev and CI origins aligned.
- **Decision**: RESOLVED — allow localhost:4321 for CI and localhost:4323 for auth dev; include 127.0.0.1 only if actually used, with BASE_URL matched to an allowed origin.

### F3 — Node test boundary for Astro routes and SSR cookies is unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Shared email-link contracts and request/callback tests
- **Detail**:
  The current npm test command runs node --test src/lib/*.test.ts. A direct test import of an Astro route encounters the @/lib/supabase path alias, which native Node does not resolve, and src/lib/supabase.ts imports the Astro virtual module astro:env/server. A fake auth client can cover a pure service/helper, but it will not by itself prove the actual createServerClient cookie adapter writes Astro cookies. The plan requires both handler behavior and SSR cookie-write evidence without specifying an Astro test harness or an injection seam. Relevant current files: package.json, tsconfig.json, src/pages/api/auth/signin.ts, and src/lib/supabase.ts.
- **Fix A ⭐ Recommended**: Keep node:test at a pure, injected service/adapter boundary; state which cookie-adapter behavior that test proves, and use the phase 3 local Astro + Supabase E2E to prove the real SSR cookie roundtrip.
  - Strength: Fits the existing runner and keeps provider/session integration evidence in the real runtime.
  - Tradeoff: Phase 1 unit tests cannot claim to cover the entire Astro route/runtime boundary.
  - Confidence: HIGH — follows the current test script and import graph.
  - Blind spot: Ensure the adapter seam tests the same cookie options and request-cookie parsing used by createClient.
- **Fix B**: Add an Astro-backed route integration harness in Phase 1 for handler and cookie assertions.
  - Strength: Tests more of the actual route wiring before the full local E2E phase.
  - Tradeoff: Adds test infrastructure and aliases/virtual-module setup to a project that currently uses plain node:test.
  - Confidence: MED — feasible, but no such harness exists in the repository.
  - Blind spot: A harness still needs an isolated fake Supabase endpoint or adapter.
- **Decision**: RESOLVED — Fix A selected. Node tests cover the pure injected boundary and cookie-writer adapter contract; the local Astro/Supabase E2E proves the real SSR cookie roundtrip.

### F4 — Existing-view UI gate omits required states

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Root shell account navigation and visual evidence
- **Detail**:
  Phase 2 changes already-rendered /auth/signin and / views. Root AGENTS.md requires /10x-ui for work on an existing view and a visual matrix at 1280/390 px in light/dark covering default, hover, focus-visible, disabled, error, empty (or justified N/A), and loading. The plan captures both sizes/themes and mentions focus plus validation/sent states, but omits hover, disabled, loading, and an explicit empty/N/A decision; it also does not include the /10x-ui workflow. Shared CSS, Layout, and shared UI component edits require coordinator coordination; timer components remain outside this change.
- **Fix**: Apply the /10x-ui contract to the existing rendered view(s) in Phase 2 and make the complete required state/viewport/theme matrix the screenshot gate, marking genuinely inapplicable states N/A with a reason. Coordinate before changing global CSS, Layout.astro, or shared UI; leave timer components untouched.
  - Strength: Gives the account entry UI a reviewable gate that matches repository instructions across responsive layouts and themes.
  - Tradeoff: Adds screenshot capture and review work for states beyond the current focus/validation/sent subset.
  - Confidence: HIGH — the required matrix and workflow are explicit in AGENTS.md.
  - Blind spot: Document per-view N/A states so the matrix does not imply a missing interaction.
- **Decision**: RESOLVED — apply /10x-ui and cover the complete viewport/theme/state matrix, with reasoned N/A states; coordinate shared CSS/Layout/UI changes and leave timer components untouched.

### F5 — Phase 3 commit is ordered after CI that needs the commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Implementation Note
- **Detail**:
  The implementation note says to commit Phase 3 only after local E2E and CI pass. The CI workflow runs for pushes to main and pull requests targeting main; the PR CI result therefore requires a phase commit to be pushed first. This conflicts with the plan/checkpoint rule to commit each phase separately after its local checks.
- **Fix**: Set the gate order to local E2E and applicable local checks → separate Phase 3 commit → push/open PR → PR CI and review → coordinator merge → deploy/remote route smoke → manual production magic-link test.
- **Decision**: RESOLVED — use the approved order: local gates → phase commit → push/PR → CI/review → coordinator merge → production deploy/route smoke → user manual production magic-link test.

### F6 — Token confidentiality requires application and Worker log controls

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1/2 — Callback token handling
- **Detail**:
  The callback token remains in the query until the explicit POST, and no-store/no-referrer do not remove it from browser history. The existing wrangler.jsonc enables observability; installed node_modules/wrangler/config-schema.json around line 4010 defines observability.redact_query_string as a boolean, and the [Cloudflare Workers API](https://developers.cloudflare.com/api/resources/workers/) documents that query strings can be removed from request URLs in logs and traces. The [Workers Logs documentation](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) confirms that invocation logs include the Request URL. The coordinator approved setting redact_query_string=true without a dependency change. Application logging and error boundaries still must not serialize token or callback URL values; browser history remains a known residual limitation.
- **Fix**: Keep observability enabled and set observability.redact_query_string=true in wrangler.jsonc; keep token/callback URL data out of app logs and error serialization. Before merge, inspect generated deployment configuration only; do not inspect live logs or secrets. Record browser history as the remaining explicit limitation.
- **Decision**: RESOLVED — set Wrangler query-string redaction and keep application logs/errors free of tokens and callback URLs; browser history remains a residual limitation, and generated deployment config is checked before merge without inspecting live logs or secrets.

### F7 — Legacy signup POST has two incompatible behaviors

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Request, callback verification, and session routes
- **Detail**:
  The plan says /api/auth/signup may be a legacy alias “or redirect” to the new email-only contract. An alias can process the email POST and return the neutral result; a redirect may change POST semantics or leave stale clients on the old password form. The current SignUpForm posts to this endpoint, even though the planned /auth/signup page will redirect. The choice can be stated without preserving password creation.
- **Fix**: Choose one contract: alias the legacy POST to the same email-only request result, or retire it explicitly and update/remove every caller; do not leave both behaviors open.
- **Decision**: RESOLVED — POST /api/auth/signup aliases the email request handler/result; /auth/signup redirects to signin and preserves only safe next.
