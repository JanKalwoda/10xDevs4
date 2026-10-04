import { defineMiddleware } from "astro:middleware";

import { createClient } from "@/lib/supabase";
import { signInUrlForProtectedPath } from "@/lib/email-auth";

const PROTECTED_ROUTES = ["/dashboard"];

export const onRequest = defineMiddleware(async (context, next) => {
    const supabase = createClient(context.request.headers, context.cookies);

    if (supabase) {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        context.locals.user = user ?? null;
    } else {
        context.locals.user = null;
    }

    if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
        if (!context.locals.user) {
            const requestedPath = context.url.pathname + context.url.search;
            return context.redirect(signInUrlForProtectedPath(requestedPath));
        }
    }

    return next();
});
