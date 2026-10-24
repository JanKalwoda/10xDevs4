import type { APIRoute } from "astro";

import { handleSignOut, reportAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const supabase = createClient(context.request.headers, context.cookies);
    await handleSignOut(supabase?.auth ?? null, reportAuthError);
    return context.redirect("/");
};
