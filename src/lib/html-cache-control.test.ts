import assert from "node:assert/strict";
import test from "node:test";

import { withPrivateNoStoreForHtml } from "./html-cache-control.ts";

function html(headers: Record<string, string> = {}) {
    return new Response("<p>x</p>", { headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
}

void test("HTML without Cache-Control becomes private, no-store", () => {
    assert.equal(withPrivateNoStoreForHtml(html()).headers.get("Cache-Control"), "private, no-store");
});

void test("HTML that already has Cache-Control keeps it", () => {
    assert.equal(withPrivateNoStoreForHtml(html({ "Cache-Control": "max-age=60" })).headers.get("Cache-Control"), "max-age=60");
});

void test("non-HTML responses are untouched", () => {
    assert.equal(withPrivateNoStoreForHtml(Response.json({ ok: true })).headers.has("Cache-Control"), false);
    assert.equal(withPrivateNoStoreForHtml(new Response(null, { status: 204 })).headers.has("Cache-Control"), false);
});

void test("immutable headers do not throw", () => {
    const response = {
        headers: {
            has: () => false,
            get: () => "text/html",
            set: () => {
                throw new TypeError("immutable");
            },
        },
    } as unknown as Response;
    assert.equal(withPrivateNoStoreForHtml(response), response);
});
