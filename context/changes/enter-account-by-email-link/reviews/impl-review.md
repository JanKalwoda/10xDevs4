<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Entry by Email Link

- **Plan**: context/changes/enter-account-by-email-link/plan.md
- **Scope**: Completed phases 1 and 2, plus explicitly requested review of implemented Phase 3; external release gates remain pending.
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-04
- **Reviewed code**: ba41520, with review fixes verified at 7ae916f.
- **Verdict**: APPROVED for implemented code; completion and release remain gated below.
- **Findings**: 0 critical, 1 warning, 2 observations; all three fixed.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS after F1 fix |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS after F2 fix |
| Success Criteria | PASS for implemented/local gates; external release gates pending |

## Findings

### F1 — Local smoke permits unconfigured callback origins

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Plan Adherence
- **Location**: scripts/smoke.mjs:17
- **Detail**: The app-origin guard accepted IPv4/IPv6 loopback and arbitrary app ports although the declared callback origins are localhost:4321 and localhost:4323. Such a smoke run could time out after the account-neutral provider result.
- **Fix**: Restrict the local app origin to the two configured origins; preserve loopback/custom-port Mailpit support for the isolated stack.
- **Decision**: FIXED in 7ae916f. Four unsupported origins were rejected before network access. The independent safety reviewer verified the fix.

### F2 — Account-entry rule tests are missing from CI

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Pattern Consistency
- **Location**: .github/workflows/ci.yml:22
- **Detail**: Lint applied the new guard, but CI ran only the timer guard regression tests. The account-entry guard suite was verified locally only.
- **Fix**: Run both guard suites in the existing CI step.
- **Decision**: FIXED in 7ae916f. Both suites passed 4/4 locally and GitHub CI passed at that commit. The independent safety reviewer verified the fix.

### F3 — Combined timer and account navigation needs visual evidence

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Success Criteria
- **Location**: context/changes/enter-account-by-email-link/screenshots/README.md:3
- **Detail**: The Phase 2 captures predate the S-06 merge and show the root configuration state. No source conflict was found, but the fixed account navigation needs a post-merge check beside the running and paused timer.
- **Fix**: Save and inspect post-merge running/paused root captures at 1280/390 px in light/dark.
- **Decision**: FIXED — eight post-merge running/paused root captures and their contact sheet are saved in `screenshots/integration/`. The native agent inspected the captures and the coordinator independently inspected the contact sheet: light/dark applied correctly, navigation does not overlap the timer, and there is no horizontal overflow at either width. Controlled browser run reports no runtime errors or external requests.

## Evidence and integration

Two independent GPT-6-Luna xHigh read-only reviewers inspected plan drift and safety/patterns. Neither found a critical auth defect. GET prepares confirmation without token consumption; explicit POST verifies through the existing SSR client. Safe return paths, neutral errors, callback security headers, remote GET-only smoke, local templates, and Worker query redaction follow the plan. The account UI guard reuses the timer contract. No S09 timer-component or shared CSS/Layout change was made.

The coordinator merged origin/main containing S-06 4160aca into the feature branch at ba41520 without conflicts or rewriting phase commits. The native integrated verification reports 61/61 unit tests, lint, both guard suites 4/4, Astro check of 66 files with no errors, and build passing at 7ae916f. Full local Mailpit re-verification and remote-mode checks against the local production preview passed. F3 captures are saved and inspected. The integrated checkpoint confirms the generated Wrangler config retains both observability fields and records cleanup of only the owned preview, isolated Supabase project and generated local artifacts; the pre-existing Supabase stack remains running.

GitHub Actions [37194457446](https://github.com/JanKalwoda/10xDevs4/actions/runs/37194457446) passed CI and full local Mailpit production-preview smoke at 7ae916f. Deploy was skipped for the pull request, as intended. Draft PR is [#31](https://github.com/JanKalwoda/10xDevs4/pull/31). Later documentation changes require final-head CI before merge.

## Remaining gates

- Integrated verification, generated-config check and scoped cleanup are recorded in handoff.md; no additional runtime verification is outstanding locally.
- Pass final-head PR CI/smoke after checkpoint/review documentation.
- Coordinator applies and verifies only the hosted callback allowlist and two approved email templates while preserving hosted confirmations and Site URL. The scoped update is blocked by Supabase HTTP 400: free-tier projects using the default email provider cannot modify email templates. A read-only check still shows the redirect/subject changes pending. The user explicitly deferred deployment and rejected a plan upgrade; free SMTP alternatives are documented in `coordinator-email-options.md`. Do not merge while this gate is unresolved or the user's deployment deferral remains in force.
- Deploy the merged code and pass both credential-free production route-smoke workflows.
- User manually verifies a real production magic link, explicit confirmation, session and dashboard. S09 remains incomplete until the user confirms this gate.

Production route smoke does not establish email delivery or authentication exchange. Browser history remains a callback-token limitation; query redaction does not remove browser history. No live logs, hosted secret values or real production email were inspected by this review.

## Release gate update

The user authorized continuation after configuring Brevo. Hosted SMTP enabled/host/port, Site URL, preserved confirmations=true, callback allowlist, both subjects and both template bodies were verified with the isolated scoped config and an idempotent auth up_to_date push. The earlier provider blocker and user deferral are historical and resolved. CI and full Mailpit smoke passed at edede35 (run 37228476962); this documentation checkpoint requires final-head CI before merge. Production deploy, both remote route checks and user real-email verification remain pending.

## Production completion — 2026-10-04

S-09 is complete. PR #31 merged as 3117e5132d24b4af22753e295819d9be954ba184 after final-head CI and Mailpit smoke passed in run 37231391340. Main run 37231557734 passed CI, full local Mailpit smoke, Cloudflare Worker deployment and production public-route/dashboard-guard smoke. Separate production-smoke run 37231757622 also passed at the same merge commit.

The user explicitly reported that all requested manual test steps passed: login request, receipt of the magic-link email, opening the link and reaching the timer, authenticated dashboard access, and sign-out. This closes Progress 3.5 based on the user's observation; no token, callback URL or mailbox access was collected. The user did not separately identify the tested mailbox/account states, so this record does not invent a second mailbox or account-creation test. New/existing account paths are independently covered by the full local Mailpit E2E.

Hosted Brevo SMTP and both scoped templates/callback settings were verified before merge; generated Wrangler query-string redaction evidence remains in the integration checkpoint. All Progress gates are complete, implementation review covers phases 1, 2, 3 and all findings are fixed. No further S-09 implementation or verification is pending. S-07/S-08 are separate ongoing changes.

Evidence:
- https://github.com/JanKalwoda/10xDevs4/pull/31
- https://github.com/JanKalwoda/10xDevs4/actions/runs/37231391340
- https://github.com/JanKalwoda/10xDevs4/actions/runs/37231557734
- https://github.com/JanKalwoda/10xDevs4/actions/runs/37231757622