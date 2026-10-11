import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isProtectedPath } from "./protected-routes.ts";

// Oracle: PRD Access Control. This list is written by hand, not derived from the guard:
// a new page file fails here until someone decides whether it is public or protected.
const SAMPLE_ID = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

const PUBLIC_PAGES = ["/", "/404", "/auth/signin", "/auth/signup", "/auth/confirm-email", "/auth/callback", "/dev/timer-ui"];
const PUBLIC_API = ["/api/auth/callback", "/api/auth/signin", "/api/auth/signout", "/api/auth/signup"];
// These answer 401 themselves when there is no session; the middleware does not guard them.
const SELF_GUARDED_API = ["/api/drills", "/api/drills/" + SAMPLE_ID];
const PROTECTED_PAGES = ["/dashboard", "/create", "/timers", "/" + SAMPLE_ID, "/" + SAMPLE_ID + "/edit"];

const PAGES_DIRECTORY = fileURLToPath(new URL("../pages/", import.meta.url));

function routeOf(file: string): string {
    const withoutExtension = file.replace(/\.(astro|ts)$/, "");
    const segments = withoutExtension.split("/").map((segment) => (segment === "[id]" ? SAMPLE_ID : segment));
    if (segments.at(-1) === "index") segments.pop();
    return "/" + segments.join("/");
}

async function pageFiles(): Promise<string[]> {
    const entries = await readdir(PAGES_DIRECTORY, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(PAGES_DIRECTORY, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .sort();
}

void test("every file in src/pages belongs to exactly one explicit class", async () => {
    const classes = [PUBLIC_PAGES, PUBLIC_API, SELF_GUARDED_API, PROTECTED_PAGES];
    const files = await pageFiles();
    assert.ok(files.length > 0);

    for (const file of files) {
        const route = routeOf(file);
        const matches = classes.filter((routes) => routes.includes(route));
        assert.equal(matches.length, 1, "src/pages/" + file + " (" + route + ") must be classified in exactly one class of route-inventory.test.ts");
    }
});

void test("every classified route has a page file", async () => {
    const routes = new Set((await pageFiles()).map(routeOf));

    for (const route of [...PUBLIC_PAGES, ...PUBLIC_API, ...SELF_GUARDED_API, ...PROTECTED_PAGES]) {
        assert.ok(routes.has(route), route + " is classified but has no file in src/pages");
    }
});

void test("protected pages need a session", () => {
    for (const route of PROTECTED_PAGES) {
        assert.equal(isProtectedPath(route), true, route + " must be protected");
    }
});

void test("public pages and the API stay outside the middleware guard", () => {
    for (const route of [...PUBLIC_PAGES, ...PUBLIC_API, ...SELF_GUARDED_API]) {
        assert.equal(isProtectedPath(route), false, route + " must not be guarded by the middleware");
    }
});
