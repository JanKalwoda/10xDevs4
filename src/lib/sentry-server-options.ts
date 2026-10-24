import * as Sentry from "@sentry/cloudflare";
import type { CloudflareOptions } from "@sentry/cloudflare";

interface SentryServerOptionsInput {
    dsn: string | undefined;
    release: string | undefined;
}

export function buildSentryServerOptions({ dsn, release }: SentryServerOptionsInput): CloudflareOptions {
    const baseOptions: CloudflareOptions = {
        // An empty or missing DSN disables Sentry (CI overrides it with an empty value in .dev.vars).
        dsn,
        release,
    };

    return {
        ...baseOptions,
        // nodejs_compat is enabled, so take the full default set instead of the reduced one.
        defaultIntegrations: Sentry.getDefaultIntegrations(baseOptions),
        integrations: (defaults) => [
            // The default HttpServer integration attaches POST/PUT bodies (up to 10 KB) to events, which would carry the
            // email or token_hash of /api/auth/* and timer names. Replace it with one that attaches none.
            ...defaults.filter((integration) => integration.name !== "HttpServer"),
            Sentry.httpServerIntegration({ maxRequestBodySize: "none" }),
            // Forward console.warn / console.error to Sentry as events.
            Sentry.captureConsoleIntegration({ levels: ["warn", "error"] }),
        ],
    };
}
