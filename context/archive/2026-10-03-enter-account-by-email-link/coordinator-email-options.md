# Free email delivery options — coordinator research

Date: 2026-10-04. The user explicitly deferred S09 deployment and rejected a Supabase plan upgrade. No SMTP provider has been selected or configured. PR #31 must stay unmerged until the hosted email/configuration gate is resolved and deployment is authorized again.

## Why the default provider blocks this change

[Supabase's 2026-06-03 policy](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) restricts template edits for new free-tier projects using its default email provider. Free-tier projects with custom SMTP may customize templates. A hosted SMTP service satisfies that requirement; operating an email server is unnecessary.

The actual project rejected the narrow template update with HTTP 400. The required explicit-POST token consumption contract must be preserved. Default GET-consuming templates are not a substitute.

## Options

| Option | Current free allowance | Setup and limitations |
|--------|------------------------|-----------------------|
| Resend | 3,000 emails/month, 100/day | Own verified sending domain required for recipients other than the account's own test address. DNS verification and SMTP credentials/integration are needed. Recommended if the user owns a domain. |
| Brevo | 300 emails/day; SMTP included | Account and sender verification required. Without an authenticated domain, Brevo temporarily substitutes a provider-domain sender address; this is explicitly a stopgap. |
| Gmail SMTP | Personal Gmail account, no separate service subscription | A possible small course-MVP route using a dedicated account, two-step verification and an app password where the account supports it. Google publishes sending limits and may block sending when those limits or delivery restrictions are hit. Not the preferred growing production-mail service. |

Sources checked:

- [Resend limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Resend/Supabase setup and domain ownership](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase)
- [Resend test-domain recipient restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Brevo transactional SMTP/free allowance](https://www.brevo.com/products/transactional-email/)
- [Brevo sender substitution and domain requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)
- [Google app passwords and account restrictions](https://support.google.com/mail/answer/185833?hl=pl)
- [Google personal Gmail sending limits](https://support.google.com/mail/answer/22839?hl=en)

SMTP2GO also has a free plan, but its [signup guide](https://support.smtp2go.com/hc/en-gb/articles/12747932085145-Quick-Start-Guide) requires a work/own-domain registration address and rejects shared domains such as Gmail. Its single-sender feature does not eliminate that signup requirement, so it was not recommended as the easiest no-domain option.

## Next decision

The coordinator asked whether the user owns a domain and has DNS access. This is preparation only; it does not revoke the user's deployment deferral. The coordinator can prepare technical settings and guide account/sender verification after the user chooses a route. No SMTP password/API key should be committed or included in this research.
