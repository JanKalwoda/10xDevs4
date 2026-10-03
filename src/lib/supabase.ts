import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

import { forwardAuthCookies } from "./email-auth";

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return null;
    }
    return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
            getAll() {
                return parseCookieHeader(requestHeaders.get("Cookie") ?? "");
            },
            setAll(cookiesToSet) {
                forwardAuthCookies(cookiesToSet, (name, value, options) => {
                    cookies.set(name, value, options);
                });
            },
        },
    });
}
