import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import * as Sentry from "@sentry/cloudflare";
import { wrapRequestHandler } from "@sentry/cloudflare/request";

import { withPrivateNoStoreForHtml } from "@/lib/html-cache-control";
import { createClient } from "@/lib/supabase";
import { guestRedirectResponse, isProtectedPath } from "@/lib/protected-routes";

// wrapRequestHandler (unlike withSentry) does not install an async context strategy, so install it once at module load.
Sentry.setAsyncLocalStorageAsyncContextStrategy();

type SentryOptions = Parameters<typeof wrapRequestHandler>[0]["options"];

const baseSentryOptions: SentryOptions = {
    // An empty or missing DSN disables Sentry (CI overrides it with an empty value in .dev.vars).
    dsn: env.PUBLIC_SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
};

const sentryOptions: SentryOptions = {
    ...baseSentryOptions,
    // nodejs_compat is enabled, so take the full default set instead of the reduced one.
    defaultIntegrations: Sentry.getDefaultIntegrations(baseSentryOptions),
    // Forward console.warn / console.error to Sentry as events.
    integrations: (defaults) => [...defaults, Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
};

export const onRequest = defineMiddleware((context, next) =>
    // A separate scope per request, so events never mix between requests.
    Sentry.withScope(() =>
        wrapRequestHandler({ options: sentryOptions, request: context.request, context: context.locals.cfContext }, async () => {
            const supabase = createClient(context.request.headers, context.cookies);

            context.locals.supabase = supabase;

            if (supabase) {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                context.locals.user = user ?? null;
            } else {
                context.locals.user = null;
            }

            if (isProtectedPath(context.url.pathname)) {
                if (!context.locals.user) {
                    const requestedPath = context.url.pathname + context.url.search;
                    return guestRedirectResponse(requestedPath);
                }
            }

            return withPrivateNoStoreForHtml(await next());
        }),
    ),
);
