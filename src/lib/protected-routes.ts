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

export function isProtectedPath(pathname: string): boolean {
    const path = routerPath(pathname);
    return PROTECTED_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
}
