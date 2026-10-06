import type { APIRoute } from "astro";

import { createSupabaseDrillStore, handleSaveDrillRequest } from "@/lib/services/drill-configurations";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
    // Reuse the client the middleware created: a second client would read the stale request cookies
    // and could refresh the session token twice.
    return handleSaveDrillRequest(request, {
        userId: locals.user?.id ?? null,
        store: locals.supabase ? createSupabaseDrillStore(locals.supabase) : null,
    });
};
