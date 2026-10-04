# Coordinator: production auth preparation

Read-only check on 2026-10-04 against hosted project rgibmreadvellhhgqxpk, Supabase CLI 2.117.0.

- Hosted Site URL: https://drill-me.twincoder.workers.dev (correct).
- Hosted redirect allowlist currently: https://drill-me.twincoder.workers.dev/.
- Hosted email confirmations: true, independently verified by a temporary minimal config declaring false and observing remote=true. Preserve true.
- Required callback addition: https://drill-me.twincoder.workers.dev/auth/callback*.
- Current subjects: confirmation='Confirm your email address'; magic_link='Your sign-in link'. Both should become 'Your Drill Me sign-in link'.
- Both template bodies must be the approved supabase/templates/magic_link.html content.

An isolated minimal config has been prepared outside the repository at %TEMP%/10x-s09-production-config/supabase/config.toml. It declares only production Site URL, preserved redirect entry plus callback, unchanged confirmations=true, and two subjects/content_path values. Read-only diff reports exactly three comparable updates: redirect list and two subjects. All other remote properties are undeclared and hands-off. Template body content is loaded separately by config push and is not represented by config diff; a subject-only diff is not proof that bodies already match.

CLI source confirms config push groups only update/local_only declared paths; remote_only entries are never written. Auth encoder additionally writes only explicitly supplied template bodies when changed. The isolated config avoids the unrelated changes present in the full development config. The coordinator attempted the scoped update after code review and green PR CI; see the provider blocker below. The original plan describes a coordinator Dashboard action; this scoped CLI update is the equivalent restricted coordinator action.

## Production provider blocker

After code review and green GitHub Actions run 37194457446 at 7ae916f, the coordinator checked that the prepared template matches the committed template and that the only declared comparable updates are the callback allowlist and two subjects. The CLI additionally planned only the two declared email-template bodies.

Supabase rejected the Auth update with HTTP 400 (`LegacyConfigPushAuthUpdateStatusError`): "Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider."

The failed attempt was followed by read-only inspection; all three declared comparable updates remained pending. Subsequent attempts collected the same provider error without changing the intended scope. No successful hosted configuration update is claimed. No real production email was sent and no live logs or hosted secret values were inspected.

The coordinator asked the user to choose custom SMTP, a Supabase plan upgrade, or deferred S09 deployment. Keep PR #31 unmerged and Progress 3.4/3.5 pending until the provider restriction is resolved and the hosted templates/configuration are actually verified. Do not substitute a GET-consuming default template for the planned explicit-POST contract. S07/S08 can continue independently.

Source references:
- https://raw.githubusercontent.com/supabase/cli/v2.117.0/apps/cli/src/commands/config/push/push.plan.ts
- https://raw.githubusercontent.com/supabase/cli/v2.117.0/apps/cli/src/commands/config/push/push.auth-email-content.ts
- https://raw.githubusercontent.com/supabase/cli/v2.117.0/apps/cli/src/commands/config/push/push.encoders.ts

Production completion remains pending until deployment, credential-free route smoke and the user's real email-link/session check. Route smoke does not prove email delivery or token exchange.
