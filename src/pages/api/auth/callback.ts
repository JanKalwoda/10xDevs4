import type { APIRoute } from "astro";

import { createClient } from "@/lib/supabase";
import { handleEmailLinkCallback } from "@/lib/email-auth";

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const supabase = createClient(context.request.headers, context.cookies);
    return handleEmailLinkCallback(context.request, supabase?.auth ?? null);
};
