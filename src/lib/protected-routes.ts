import { signInUrlForProtectedPath } from "./email-auth.ts";

export const PROTECTED_ROUTES = ["/dashboard", "/create"] as const;

// The router matches the decoded path and ignores repeated or trailing slashes, so match on that form:
// "/%63reate", "//create" and "/create/" must not slip past the guard, while "/created" is not protected.
function routerPath(pathname: string): string {
    let decoded = pathname;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        // A malformed escape cannot reach a page; keep the raw path.
    }
    return decoded.replace(/\/{2,}/g, "/");
}

const SAVED_DRILL_PATH = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

// S-11: a saved timer lives at /{uuid}. Only that exact shape needs a session; any other single segment
// stays public and renders the same 404 for everyone, so the guard is not an oracle for which paths exist.
export function isSavedDrillPath(pathname: string): boolean {
    return SAVED_DRILL_PATH.test(routerPath(pathname));
}

export function isProtectedPath(pathname: string): boolean {
    const path = routerPath(pathname);
    return PROTECTED_ROUTES.some((route) => path === route || path.startsWith(route + "/")) || isSavedDrillPath(pathname);
}

// Guest redirect for a protected path; never cacheable, like every response of a protected page.
export function guestRedirectResponse(requestedPath: string): Response {
    return new Response(null, {
        status: 302,
        headers: { Location: signInUrlForProtectedPath(requestedPath), "Cache-Control": "private, no-store" },
    });
}
