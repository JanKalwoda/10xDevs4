// Risk #2: a guest must never get content or change data on a protected route.
// Oracle: PRD Access Control and research Decisions 4 (any method on a protected page is a 302 to sign-in, no body).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { URL } from "node:url";
import { createAppClient, resolveLocalTargets, visibleText } from "../../scripts/lib/app-client.mjs";

const { appOrigin } = resolveLocalTargets(process.env);
const guest = createAppClient(appOrigin);
const id = randomUUID();

const PROTECTED_PATHS = ["/dashboard", "/create", "/timers", "/timers?x=1", "/" + id, "/" + id + "/edit"];
const METHODS = ["GET", "POST", "HEAD"];
// Text only the timers list and the create page show, and the heading of the public home page (what a guest may see).
const PROTECTED_PAGE_MARKERS = ["Saved timers", "Create a timer", "Save timer"];
const TIMERS_HEADING = /<h1[^>]*>\s*Timers\s*<\/h1>/;
const HOME_MARKER = "Drill timer";

function failure(method, path, response) {
    return method + " " + path + " -> " + String(response.status);
}

async function guestResponse(method, path) {
    const response = await guest.request(path, { method });
    return { response, text: await response.text() };
}

function assertSignInRedirect(method, path, response, text) {
    assert.equal(response.status, 302, failure(method, path, response));
    assert.equal(response.headers.get("location"), "/auth/signin?next=" + encodeURIComponent(path), failure(method, path, response));
    assert.equal(text, "", failure(method, path, response) + " must have no body");
    const cacheControl = response.headers.get("cache-control") ?? "";
    assert.ok(cacheControl.includes("private") && cacheControl.includes("no-store"), failure(method, path, response) + " must be private, no-store");
}

test("a guest is redirected to sign-in on every protected page, for every method", async (t) => {
    for (const path of PROTECTED_PATHS) {
        for (const method of METHODS) {
            await t.test(method + " " + path.replace(id, "<uuid>"), async () => {
                const { response, text } = await guestResponse(method, path);
                assertSignInRedirect(method, path, response, text);
            });
        }
    }
});

test("path variants cannot slip past the guard in the runtime", async (t) => {
    const variants = ["/%63reate", "/%74imers", "/timers/", "/dashboard/", "/" + id.toUpperCase(), "/" + id + "/edit/"];

    for (const variant of variants) {
        await t.test(variant.replace(id.toUpperCase(), "<UUID>").replace(id, "<uuid>"), async () => {
            const response = await guest.rawRequest(appOrigin + variant);
            const text = await response.text();

            assert.equal(response.status, 302, variant + " -> " + String(response.status));
            const location = response.headers.get("location") ?? "";
            assert.ok(location.startsWith("/auth/signin"), variant + " must redirect to sign-in");
            assert.equal(text, "", variant + " must have no body");

            const next = new URL(location, appOrigin).searchParams.get("next");
            if (next !== null) assert.ok(next.startsWith("/") && !next.startsWith("//"), variant + " must keep a local next path");
        });
    }

    // "//timers" is not a path the runtime router maps to the timers page: the preview serves the public home page for it
    // (probably it reads the string as a URL with the host "timers"), while a front that normalises it answers with the sign-in redirect.
    // The oracle (PRD Access Control) is "a guest gets no protected content", so both answers are accepted and nothing else.
    await t.test("//timers gives a guest the sign-in redirect or only the public home page", async () => {
        // Built from the raw string: new URL("//timers", origin) would turn it into a host.
        const response = await guest.rawRequest(appOrigin + "//timers");
        const text = await response.text();

        if (response.status === 302) {
            assert.ok((response.headers.get("location") ?? "").startsWith("/auth/signin"), "//timers must redirect to sign-in");
            assert.equal(text, "", "//timers must have no body");
            return;
        }

        assert.equal(response.status, 200, "//timers must be the sign-in redirect or the public page");
        const visible = visibleText(text);
        for (const marker of PROTECTED_PAGE_MARKERS) assert.ok(!visible.includes(marker), "//timers must not show '" + marker + "'");
        assert.ok(!TIMERS_HEADING.test(text), "//timers must not render the timers heading");
        assert.ok(visible.includes(HOME_MARKER), "//timers must be the public home page");
    });
});

test("the API refuses a guest with 401 and no-store", async (t) => {
    const cases = [
        { method: "POST", path: "/api/drills", json: { name: "guest", ...{ preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false } } },
        { method: "PUT", path: "/api/drills/" + id, json: { name: "guest" } },
        { method: "DELETE", path: "/api/drills/" + id },
    ];

    for (const { method, path, json } of cases) {
        await t.test(method + " " + path.replace(id, "<uuid>"), async () => {
            const response = await guest.request(path, { method, json });
            assert.equal(response.status, 401);
            assert.equal(response.headers.get("cache-control"), "no-store");
            const body = await response.json();
            assert.equal(body.ok, false);
            assert.equal(body.code, "unauthorized");
        });
    }
});

test("a malformed id is a plain 404 for a guest, identical on the page and the edit page", async () => {
    const page = await guest.snapshot("/not-a-uuid");
    const edit = await guest.snapshot("/not-a-uuid/edit");

    assert.equal(page.status, 404);
    assert.equal(page.location, null);
    assert.deepEqual(edit, page);
});

test("/service-unavailable without an outage is the same 404 as an unknown path", async () => {
    const page = await guest.snapshot("/service-unavailable");
    const unknown = await guest.snapshot("/not-a-uuid");

    assert.equal(page.status, 404);
    assert.equal(page.location, null);
    assert.deepEqual(page, unknown);
});
