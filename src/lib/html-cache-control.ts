// The top bar puts the account email into the HTML of every page, so HTML must never be shared-cached.
// Pages that set their own Cache-Control keep it.
export function withPrivateNoStoreForHtml(response: Response): Response {
    if (response.headers.has("Cache-Control")) return response;
    if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("text/html")) return response;

    try {
        response.headers.set("Cache-Control", "private, no-store");
    } catch {
        // Immutable headers (e.g. a Response.redirect); leave the response as it is.
    }
    return response;
}
