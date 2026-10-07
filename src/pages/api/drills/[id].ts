import type { APIRoute } from "astro";

import { createSupabaseDrillStore, handleDeleteDrillRequest, handleUpdateDrillRequest, methodNotAllowedResponse } from "@/lib/services/drill-configurations";

export const prerender = false;

export const PUT: APIRoute = async ({ request, locals, params }) => {
    // Same client reuse as POST /api/drills: the middleware already resolved the session for this request.
    return handleUpdateDrillRequest(request, {
        id: params.id ?? "",
        userId: locals.user?.id ?? null,
        store: locals.supabase ? createSupabaseDrillStore(locals.supabase) : null,
    });
};

export const DELETE: APIRoute = async ({ request, locals, params }) => {
    return handleDeleteDrillRequest(request, {
        id: params.id ?? "",
        userId: locals.user?.id ?? null,
        store: locals.supabase ? createSupabaseDrillStore(locals.supabase) : null,
    });
};

// Astro would answer an unexported method with an empty 404; a 405 with `Allow` is the honest answer (PUT and DELETE take precedence over ALL).
export const ALL: APIRoute = () => methodNotAllowedResponse();
