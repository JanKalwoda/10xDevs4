import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import * as Sentry from "@sentry/cloudflare";
import { wrapRequestHandler } from "@sentry/cloudflare/request";

import { reportAuthError } from "@/lib/auth-errors";
import { resolveSession } from "@/lib/auth-session";
import { withPrivateNoStoreForHtml } from "@/lib/html-cache-control";
import { buildSentryServerOptions } from "@/lib/sentry-server-options";
import { createClient } from "@/lib/supabase";
import { guestRedirectResponse, isProtectedPath } from "@/lib/protected-routes";

// wrapRequestHandler (unlike withSentry) does not install an async context strategy, so install it once at module load.
Sentry.setAsyncLocalStorageAsyncContextStrategy();

const sentryOptions = buildSentryServerOptions({
    dsn: env.PUBLIC_SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
});

export const onRequest = defineMiddleware((context, next) =>
    // A separate scope per request, so events never mix between requests.
    Sentry.withScope(() =>
        wrapRequestHandler({ options: sentryOptions, request: context.request, context: context.locals.cfContext }, async () => {
            const supabase = createClient(context.request.headers, context.cookies);

            context.locals.supabase = supabase;

            const session = await resolveSession(supabase?.auth ?? null, reportAuthError);

            context.locals.user = session.kind === "user" ? session.user : null;
            context.locals.authUnavailable = session.kind === "unavailable";

            if (isProtectedPath(context.url.pathname)) {
                // An outage is not a sign-out: do not send the visitor to sign-in, say the service is down.
                if (context.locals.authUnavailable) return withPrivateNoStoreForHtml(await next("/service-unavailable"));

                if (!context.locals.user) {
                    const requestedPath = context.url.pathname + context.url.search;
                    return guestRedirectResponse(requestedPath);
                }
            }

            return withPrivateNoStoreForHtml(await next());
        }),
    ),
);
