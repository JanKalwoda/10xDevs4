import type { APIRoute } from "astro";

import { createSupabaseDrillStore, handleUpdateDrillRequest } from "@/lib/services/drill-configurations";

export const prerender = false;

export const PUT: APIRoute = async ({ request, locals, params }) => {
    // Same client reuse as POST /api/drills: the middleware already resolved the session for this request.
    return handleUpdateDrillRequest(request, {
        id: params.id ?? "",
        userId: locals.user?.id ?? null,
        store: locals.supabase ? createSupabaseDrillStore(locals.supabase) : null,
    });
};
