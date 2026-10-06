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

void test("a malformed escape does not throw and is judged on the raw path", () => {
    assert.equal(isProtectedPath("/create%"), false);
    assert.equal(isProtectedPath("/create/%E0%A4%A"), true);
});
