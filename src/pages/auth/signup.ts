import type { APIRoute } from "astro";

import { legacySignupRedirectUrl } from "@/lib/email-auth";

export const prerender = false;

export const GET: APIRoute = ({ url }) =>
    new Response(null, {
        status: 302,
        headers: {
            Location: legacySignupRedirectUrl(url.searchParams.get("next")),
        },
    });
