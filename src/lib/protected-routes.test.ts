import assert from "node:assert/strict";
import test from "node:test";

import { PROTECTED_ROUTES, isProtectedPath } from "./protected-routes.ts";

void test("dashboard and create are protected, including their sub-paths", () => {
    assert.deepEqual([...PROTECTED_ROUTES], ["/dashboard", "/create"]);
    for (const path of ["/dashboard", "/dashboard/", "/dashboard/settings", "/create", "/create/", "/create/draft"]) {
        assert.equal(isProtectedPath(path), true, path);
    }
});

void test("protection matches at a segment boundary only", () => {
    for (const path of ["/", "/created", "/creative", "/dashboards", "/api/drills", "/auth/signin", "/dev/timer-ui", "/x/create"]) {
        assert.equal(isProtectedPath(path), false, path);
    }
});

void test("encoded and repeated slashes cannot bypass the guard", () => {
    for (const path of ["/%63reate", "/%63reate/", "//create", "///dashboard", "/create%2Fx", "/%64ashboard"]) {
        assert.equal(isProtectedPath(path), true, path);
    }
});

const SAVED_ID = "22222222-2222-4222-8222-222222222222";

void test("a saved timer path /{uuid} is protected, in any case and with a trailing or doubled slash", () => {
    for (const path of [`/${SAVED_ID}`, `/${SAVED_ID}/`, `//${SAVED_ID}`, `/${SAVED_ID.toUpperCase()}`, `/${SAVED_ID}%2F`, `/%32${SAVED_ID.slice(1)}`]) {
        assert.equal(isProtectedPath(path), true, path);
    }
});

void test("other single segments stay public (they render the same 404 for everyone)", () => {
    for (const path of ["/abc", `/${SAVED_ID}x`, `/${SAVED_ID.slice(1)}`, `/{${SAVED_ID}}`, `/${SAVED_ID.replaceAll("-", "")}`, `/x/${SAVED_ID}`, `/${SAVED_ID}/x`]) {
        assert.equal(isProtectedPath(path), false, path);
    }
});

void test("an encoded separator after the uuid is not a saved timer path", () => {
    // The router decodes %2F into a second segment, which no page serves, so it is a plain 404.
    assert.equal(isProtectedPath(`/${SAVED_ID}%2Fx`), false);
});

void test("a malformed escape does not throw and is judged on the raw path", () => {
    assert.equal(isProtectedPath("/create%"), false);
    assert.equal(isProtectedPath("/create/%E0%A4%A"), true);
});
