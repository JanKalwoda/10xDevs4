import { defineMiddleware } from "astro:middleware";

import { withPrivateNoStoreForHtml } from "@/lib/html-cache-control";
import { createClient } from "@/lib/supabase";
import { guestRedirectResponse, isProtectedPath } from "@/lib/protected-routes";

export const onRequest = defineMiddleware(async (context, next) => {
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
});
