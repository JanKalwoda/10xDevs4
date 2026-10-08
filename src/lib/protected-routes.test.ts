import assert from "node:assert/strict";
import test from "node:test";

import { PROTECTED_ROUTES, guestRedirectResponse, isProtectedPath, isSavedDrillPath } from "./protected-routes.ts";

void test("dashboard, create and timers are protected, including their sub-paths", () => {
    assert.deepEqual([...PROTECTED_ROUTES], ["/dashboard", "/create", "/timers"]);
    for (const path of ["/dashboard", "/dashboard/", "/dashboard/settings", "/create", "/create/", "/create/draft", "/timers", "/timers/", "/timers/x"]) {
        assert.equal(isProtectedPath(path), true, path);
    }
});

void test("protection matches at a segment boundary only", () => {
    for (const path of ["/", "/created", "/creative", "/dashboards", "/timersx", "/x/timers", "/api/drills", "/auth/signin", "/dev/timer-ui", "/x/create"]) {
        assert.equal(isProtectedPath(path), false, path);
    }
});

void test("encoded and repeated slashes cannot bypass the guard", () => {
    for (const path of ["/%63reate", "/%63reate/", "//create", "///dashboard", "/create%2Fx", "/%64ashboard", "/%74imers", "//timers", "/timers%2Fx"]) {
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

void test("the edit path /{uuid}/edit is protected like /{uuid}: any case, trailing or doubled slash, encoded forms", () => {
    for (const path of [
        `/${SAVED_ID}/edit`,
        `/${SAVED_ID.toUpperCase()}/edit/`,
        `//${SAVED_ID}/edit`,
        `/${SAVED_ID}//edit`,
        `/${SAVED_ID}%2Fedit`,
        `/${SAVED_ID}/%65dit`,
        `/${SAVED_ID}/EDIT`,
        `/%32${SAVED_ID.slice(1)}/edit`,
    ]) {
        assert.equal(isProtectedPath(path), true, path);
    }
});

void test("near misses of the edit path stay public (the shared 404, no oracle for guests)", () => {
    for (const path of [
        `/${SAVED_ID}/edits`,
        `/${SAVED_ID}/edit/x`,
        `/${SAVED_ID}/edit/edit`,
        `/${SAVED_ID}/editx`,
        "/not-a-uuid/edit",
        "/edit",
        `/x/${SAVED_ID}/edit`,
        `/${SAVED_ID.slice(1)}/edit`,
    ]) {
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

void test("guest redirect goes to sign-in with next and is never cacheable", () => {
    const response = guestRedirectResponse("/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/auth/signin?next=%2F3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

void test("/timers is a page route, never a saved timer path", () => {
    assert.equal(isSavedDrillPath("/timers"), false);
    assert.equal(isProtectedPath("/timers"), true);
});
