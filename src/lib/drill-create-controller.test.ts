import assert from "node:assert/strict";
import test from "node:test";

import { createDrillCreateController, postSaveDrill, putSaveDrill, type SaveDrillPort } from "./drill-create-controller.ts";
import { SAVE_DRILL_MESSAGES } from "./services/drill-configurations.ts";
import type { DrillConfigInput } from "./drill-timer.ts";
import type { SaveDrillRequest, SaveDrillResponse, SavedDrill } from "../types";

const VALUES: DrillConfigInput = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false };

function drill(name: string): SavedDrill {
    return {
        id: "id-1",
        name,
        configuration: { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: false },
        createdAt: "2026-10-07T12:00:00Z",
        updatedAt: "2026-10-07T12:00:00Z",
    };
}

function deferredPort() {
    const requests: SaveDrillRequest[] = [];
    const resolvers: ((response: SaveDrillResponse) => void)[] = [];
    const port: SaveDrillPort = (request) => {
        requests.push(request);
        return new Promise((resolve) => resolvers.push(resolve));
    };
    return { port, requests, resolve: (response: SaveDrillResponse) => resolvers.shift()?.(response) };
}

function requestWithBody(request: SaveDrillRequest, body: unknown): Promise<SaveDrillResponse> {
    return postSaveDrill(request, () => Promise.resolve(new Response(JSON.stringify(body), { status: 201 })));
}

function createWithNavigation(port: SaveDrillPort) {
    const navigations: string[] = [];
    const controller = createDrillCreateController(port, { navigate: (href) => navigations.push(href) });
    return { controller, navigations };
}

function okPort(requests: SaveDrillRequest[] = []): SaveDrillPort {
    return (request) => {
        requests.push(request);
        return Promise.resolve({ ok: true, drill: drill(request.name) });
    };
}

void test("a valid create sends the trimmed NFC name with the form values, navigates once to /{id} and stays locked", async () => {
    const requests: SaveDrillRequest[] = [];
    const { controller, navigations } = createWithNavigation(okPort(requests));
    controller.setName("  Café drill  ");
    await controller.save(VALUES);

    assert.deepEqual(requests, [{ ...VALUES, name: "Café drill" }]);
    assert.deepEqual(navigations, ["/id-1"]);
    assert.deepEqual(controller.getSnapshot(), { name: "  Café drill  ", nameError: null, status: "saving", failure: null, savedName: null });
});

void test("the redirect target encodes the id so it can never leave the origin", async () => {
    const { controller, navigations } = createWithNavigation(() => Promise.resolve({ ok: true, drill: { ...drill("Run"), id: "//evil.example/?x#y" } }));
    controller.setName("Run");
    await controller.save(VALUES);
    assert.deepEqual(navigations, ["/%2F%2Fevil.example%2F%3Fx%23y"]);
});

void test("create without a navigate option never publishes saved", async () => {
    const controller = createDrillCreateController(okPort());
    controller.setName("Run");
    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().status, "saving");
    assert.equal(controller.getSnapshot().savedName, null);
});

void test("create: a reply without a usable drill.id is unexpected and never navigates", async () => {
    for (const id of [undefined, "", 7, null]) {
        const body = { ok: true, drill: { ...drill("Run"), id } };
        const navigations: string[] = [];
        const controller = createDrillCreateController((req) => requestWithBody(req, body), { navigate: (href) => navigations.push(href) });
        controller.setName("Run");
        await controller.save(VALUES);
        assert.equal(controller.getSnapshot().failure?.code, "unexpected", String(id));
        assert.equal(controller.getSnapshot().status, "error", String(id));
        assert.deepEqual(navigations, [], String(id));
    }
});

void test("create: an edit of the parameters during the request still navigates to the saved timer", async () => {
    const port = deferredPort();
    const { controller, navigations } = createWithNavigation(port.port);
    controller.setName("Run");
    const pending = controller.save(VALUES);
    controller.markEdited();
    port.resolve({ ok: true, drill: drill("Run") });
    await pending;
    assert.deepEqual(navigations, ["/id-1"]);
    assert.equal(controller.getSnapshot().status, "saving");
});

void test("create: a failed save never navigates and the form is usable again", async () => {
    const navigations: string[] = [];
    const controller = createDrillCreateController(() => Promise.resolve({ ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable }), {
        navigate: (href) => navigations.push(href),
    });
    controller.setName("Run");
    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().status, "error");
    assert.deepEqual(navigations, []);
    assert.equal(controller.reset(), false);
    assert.equal(controller.getSnapshot().status, "error");
});

void test("create: reset after the redirect (bfcache restore) returns to idle once and keeps the typed name", async () => {
    const { controller, navigations } = createWithNavigation(okPort());
    controller.setName("Run");
    await controller.save(VALUES);
    assert.equal(controller.reset(), true);
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "idle", failure: null, savedName: null });
    assert.equal(controller.reset(), false);
    assert.equal(navigations.length, 1);
});

void test("an invalid name never reaches the port and shows the name error", async () => {
    const requests: SaveDrillRequest[] = [];
    const controller = createDrillCreateController(okPort(requests));
    for (const name of ["", "   ", "Run\n", "\tRun", "x\u0085y"]) {
        controller.setName(name);
        await controller.save(VALUES);
        assert.equal(controller.getSnapshot().nameError, SAVE_DRILL_MESSAGES.name, JSON.stringify(name));
        assert.equal(controller.getSnapshot().status, "idle");
    }
    assert.equal(requests.length, 0);
});

void test("the name limit counts code points: 200 astral characters pass, 201 fail", async () => {
    const requests: SaveDrillRequest[] = [];
    const controller = createDrillCreateController(okPort(requests));

    controller.setName("\u{1f3af}".repeat(200));
    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().status, "saving");
    assert.equal(requests.length, 1);

    // The create form stays locked after a redirect, so the 201 case uses a fresh form.
    const second = createDrillCreateController(okPort(requests));
    second.setName("\u{1f3af}".repeat(201));
    await second.save(VALUES);
    assert.equal(second.getSnapshot().nameError, SAVE_DRILL_MESSAGES.name);
    assert.equal(requests.length, 1);
});

void test("submitAttempt shows the name error before the parameters are validated and clears it for a valid name", () => {
    const controller = createDrillCreateController(okPort());
    controller.submitAttempt();
    assert.equal(controller.getSnapshot().nameError, SAVE_DRILL_MESSAGES.name);

    controller.setName("Run");
    controller.submitAttempt();
    assert.equal(controller.getSnapshot().nameError, null);
});

void test("double submit before the first response sends one request and ignores name edits while saving", async () => {
    const { port, requests, resolve } = deferredPort();
    const { controller, navigations } = createWithNavigation(port);
    controller.setName("Run");

    const first = controller.save(VALUES);
    const second = controller.save(VALUES);
    controller.setName("late keystroke");
    assert.equal(controller.getSnapshot().status, "saving");
    assert.equal(controller.getSnapshot().name, "Run");
    assert.equal(requests.length, 1);

    resolve({ ok: true, drill: drill("Run") });
    await Promise.all([first, second]);
    assert.deepEqual(navigations, ["/id-1"]);
    assert.equal(controller.getSnapshot().name, "Run");
    assert.equal(controller.getSnapshot().status, "saving");
});

void test("duplicate_name sits on the name field and keeps the typed name", async () => {
    const controller = createDrillCreateController(() =>
        Promise.resolve({ ok: false, code: "duplicate_name", message: SAVE_DRILL_MESSAGES.duplicate_name, fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name } }),
    );
    controller.setName("run");
    await controller.save(VALUES);

    assert.deepEqual(controller.getSnapshot(), { name: "run", nameError: SAVE_DRILL_MESSAGES.duplicate_name, status: "error", failure: null, savedName: null });
});

void test("limit, unavailable, unexpected and unauthorized become alert-level failures and the name stays", async () => {
    for (const code of ["limit_reached", "unavailable", "unexpected", "unauthorized"] as const) {
        const controller = createDrillCreateController(() => Promise.resolve({ ok: false, code, message: SAVE_DRILL_MESSAGES[code] }));
        controller.setName("Run");
        await controller.save(VALUES);
        assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "error", failure: { code, message: SAVE_DRILL_MESSAGES[code] }, savedName: null }, code);
    }
});

void test("a server validation error without a name error is shown as an alert with the field messages", async () => {
    const controller = createDrillCreateController(() =>
        Promise.resolve({ ok: false, code: "validation", message: SAVE_DRILL_MESSAGES.validation, fieldErrors: { exercise: "Enter a time from 0:01 to 10:00." } }),
    );
    controller.setName("Run");
    await controller.save(VALUES);
    assert.deepEqual(controller.getSnapshot().failure, { code: "validation", message: "Enter a time from 0:01 to 10:00." });
});

void test("a rejecting port is reported as unexpected and the latch is released for a retry", async () => {
    let calls = 0;
    const controller = createDrillCreateController(() => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve({ ok: true, drill: drill("Run") });
    });
    controller.setName("Run");
    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().failure?.code, "unexpected");

    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().status, "saving");
    assert.equal(calls, 2);
});

void test("editing the name after an error returns to idle and drops the old messages", async () => {
    const controller = createDrillCreateController(() => Promise.resolve({ ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable }));
    controller.setName("Run");
    await controller.save(VALUES);
    assert.equal(controller.getSnapshot().status, "error");

    controller.setName("Run 2");
    assert.deepEqual(controller.getSnapshot(), { name: "Run 2", nameError: null, status: "idle", failure: null, savedName: null });
});

void test("subscribers are notified on every change and can unsubscribe", async () => {
    const controller = createDrillCreateController(okPort(), { keepAfterSave: true });
    let notifications = 0;
    const unsubscribe = controller.subscribe(() => {
        notifications += 1;
    });
    controller.setName("Run");
    await controller.save(VALUES);
    const seen = notifications;
    assert.ok(seen >= 3);

    unsubscribe();
    controller.setName("Other");
    assert.equal(notifications, seen);
});

const request: SaveDrillRequest = { ...VALUES, name: "Run" };

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

void test("postSaveDrill posts JSON to /api/drills and returns the server body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = ((url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Promise.resolve(jsonResponse(201, { ok: true, drill: drill("Run") }));
    }) as unknown as typeof fetch;

    const response = await postSaveDrill(request, fetchImpl);
    assert.equal(response.ok, true);
    assert.equal(calls[0]?.url, "/api/drills");
    assert.equal(calls[0]?.init.method, "POST");
    assert.deepEqual(calls[0]?.init.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), request);
});

void test("postSaveDrill maps a network failure to unavailable and never throws", async () => {
    const response = await postSaveDrill(request, () => Promise.reject(new TypeError("Failed to fetch")));
    assert.deepEqual(response, { ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable });
});

void test("postSaveDrill keeps the server error body and falls back to the status for an unreadable reply", async () => {
    const duplicate = { ok: false, code: "duplicate_name", message: SAVE_DRILL_MESSAGES.duplicate_name, fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name } };
    assert.deepEqual(await postSaveDrill(request, () => Promise.resolve(jsonResponse(409, duplicate))), duplicate);

    const cases: [number, string][] = [
        [401, "unauthorized"],
        [503, "unavailable"],
        [500, "unexpected"],
        [502, "unexpected"],
    ];
    for (const [status, code] of cases) {
        const response = await postSaveDrill(request, () => Promise.resolve(new Response("<html>", { status })));
        assert.ok(!response.ok, String(status));
        assert.equal(response.code, code, String(status));
    }
});

const EDIT = { initialName: "Run", keepAfterSave: true } as const;

void test("edit mode starts with the stored name and keeps the saved name after a successful save", async () => {
    const requests: SaveDrillRequest[] = [];
    const controller = createDrillCreateController(okPort(requests), EDIT);
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "idle", failure: null, savedName: null });

    controller.setName("  Run 2  ");
    await controller.save(VALUES);
    assert.deepEqual(requests, [{ ...VALUES, name: "Run 2" }]);
    assert.deepEqual(controller.getSnapshot(), { name: "Run 2", nameError: null, status: "saved", failure: null, savedName: "Run 2" });

    controller.setName("Run 3");
    assert.equal(controller.getSnapshot().status, "idle");
    assert.equal(controller.getSnapshot().savedName, null);
});

void test("edit mode: a case-only rename of the own name is sent and saved", async () => {
    const requests: SaveDrillRequest[] = [];
    const controller = createDrillCreateController(okPort(requests), EDIT);
    controller.setName("RUN");
    await controller.save(VALUES);
    assert.deepEqual(requests, [{ ...VALUES, name: "RUN" }]);
    assert.equal(controller.getSnapshot().status, "saved");
    assert.equal(controller.getSnapshot().name, "RUN");
});

void test("edit mode keeps the typed name after duplicate_name, validation, not_found and unauthorized", async () => {
    const duplicate: SaveDrillResponse = {
        ok: false,
        code: "duplicate_name",
        message: SAVE_DRILL_MESSAGES.duplicate_name,
        fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name },
    };
    const controller = createDrillCreateController(() => Promise.resolve(duplicate), EDIT);
    controller.setName("Other");
    await controller.save(VALUES);
    assert.deepEqual(controller.getSnapshot(), { name: "Other", nameError: SAVE_DRILL_MESSAGES.duplicate_name, status: "error", failure: null, savedName: null });

    for (const code of ["not_found", "unauthorized", "validation"] as const) {
        const failing = createDrillCreateController(() => Promise.resolve({ ok: false, code, message: SAVE_DRILL_MESSAGES[code] }), EDIT);
        failing.setName("Other");
        await failing.save(VALUES);
        assert.deepEqual(failing.getSnapshot(), { name: "Other", nameError: null, status: "error", failure: { code, message: SAVE_DRILL_MESSAGES[code] }, savedName: null }, code);
    }
});

void test("edit mode never navigates and reset is a no-op there", async () => {
    const navigations: string[] = [];
    const controller = createDrillCreateController(okPort(), { ...EDIT, navigate: (href) => navigations.push(href) });
    await controller.save(VALUES);
    assert.deepEqual(navigations, []);
    const before = controller.getSnapshot();
    let notifications = 0;
    controller.subscribe(() => {
        notifications += 1;
    });
    assert.equal(controller.reset(), false);
    assert.equal(controller.getSnapshot(), before);
    assert.equal(notifications, 0);
});

void test("markEdited drops a stale confirmation or alert but keeps the typed name", async () => {
    const controller = createDrillCreateController(okPort(), EDIT);
    controller.setName("Run 2");
    await controller.save(VALUES);
    controller.markEdited();
    assert.deepEqual(controller.getSnapshot(), { name: "Run 2", nameError: null, status: "idle", failure: null, savedName: null });

    const failing = createDrillCreateController(() => Promise.resolve({ ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable }), EDIT);
    await failing.save(VALUES);
    assert.equal(failing.getSnapshot().status, "error");
    failing.markEdited();
    assert.deepEqual(failing.getSnapshot(), { name: "Run", nameError: null, status: "idle", failure: null, savedName: null });
});

void test("markEdited while saving does not change the snapshot or notify subscribers and while idle is a no-op", async () => {
    const port = deferredPort();
    const controller = createDrillCreateController(port.port, EDIT);
    let notifications = 0;
    controller.subscribe(() => {
        notifications += 1;
    });
    controller.markEdited();
    assert.equal(notifications, 0);

    const pending = controller.save(VALUES);
    const seen = notifications;
    controller.markEdited();
    assert.equal(controller.getSnapshot().status, "saving");
    assert.equal(notifications, seen);
    port.resolve({ ok: true, drill: drill("Run") });
    await pending;
});

void test("a parameter change during a successful save leaves no Saved confirmation behind", async () => {
    const port = deferredPort();
    const controller = createDrillCreateController(port.port, EDIT);
    const pending = controller.save(VALUES);
    controller.markEdited();
    assert.equal(controller.getSnapshot().status, "saving");
    port.resolve({ ok: true, drill: drill("Run") });
    await pending;
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "idle", failure: null, savedName: null });
});

void test("the edited-during-save flag does not leak into the next save", async () => {
    const port = deferredPort();
    const controller = createDrillCreateController(port.port, EDIT);
    const first = controller.save(VALUES);
    controller.markEdited();
    port.resolve({ ok: true, drill: drill("Run") });
    await first;
    assert.equal(controller.getSnapshot().status, "idle");

    const second = controller.save(VALUES);
    port.resolve({ ok: true, drill: drill("Run") });
    await second;
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "saved", failure: null, savedName: "Run" });
});

void test("a parameter change during a failed save drops the alert but keeps a name error", async () => {
    const unavailable: SaveDrillResponse = { ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable };
    const alert = deferredPort();
    const controller = createDrillCreateController(alert.port, EDIT);
    const pending = controller.save(VALUES);
    controller.markEdited();
    alert.resolve(unavailable);
    await pending;
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: null, status: "idle", failure: null, savedName: null });

    const duplicate: SaveDrillResponse = {
        ok: false,
        code: "duplicate_name",
        message: SAVE_DRILL_MESSAGES.duplicate_name,
        fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name },
    };
    const named = deferredPort();
    const other = createDrillCreateController(named.port, EDIT);
    const second = other.save(VALUES);
    other.markEdited();
    named.resolve(duplicate);
    await second;
    assert.deepEqual(other.getSnapshot(), { name: "Run", nameError: SAVE_DRILL_MESSAGES.duplicate_name, status: "idle", failure: null, savedName: null });
});

void test("markEdited keeps a name error so the field stays flagged until the name changes", async () => {
    const duplicate: SaveDrillResponse = {
        ok: false,
        code: "duplicate_name",
        message: SAVE_DRILL_MESSAGES.duplicate_name,
        fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name },
    };
    const controller = createDrillCreateController(() => Promise.resolve(duplicate), EDIT);
    await controller.save(VALUES);
    controller.markEdited();
    assert.deepEqual(controller.getSnapshot(), { name: "Run", nameError: SAVE_DRILL_MESSAGES.duplicate_name, status: "idle", failure: null, savedName: null });
});

void test("putSaveDrill puts the full JSON body to /api/drills/{id}", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = ((url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Promise.resolve(jsonResponse(200, { ok: true, drill: drill("Run") }));
    }) as unknown as typeof fetch;

    const response = await putSaveDrill("3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b", fetchImpl)(request);
    assert.equal(response.ok, true);
    assert.equal(calls[0]?.url, "/api/drills/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b");
    assert.equal(calls[0]?.init.method, "PUT");
    assert.deepEqual(calls[0]?.init.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), request);
});

void test("putSaveDrill falls back by status: 409 is a duplicate name, 404 is not_found (POST keeps 409 as the limit)", async () => {
    const cases: [number, string][] = [
        [409, "duplicate_name"],
        [404, "not_found"],
        [401, "unauthorized"],
        [400, "validation"],
        [503, "unavailable"],
        [500, "unexpected"],
    ];
    for (const [status, code] of cases) {
        const response = await putSaveDrill("id-1", () => Promise.resolve(new Response("<html>", { status })))(request);
        assert.ok(!response.ok, String(status));
        assert.equal(response.code, code, String(status));
    }
    const post = await postSaveDrill(request, () => Promise.resolve(new Response("<html>", { status: 409 })));
    assert.ok(!post.ok);
    assert.equal(post.code, "limit_reached");
});

void test("putSaveDrill keeps the server body and maps a network failure to unavailable without throwing", async () => {
    const notFound = { ok: false, code: "not_found", message: SAVE_DRILL_MESSAGES.not_found };
    assert.deepEqual(await putSaveDrill("id-1", () => Promise.resolve(jsonResponse(404, notFound)))(request), notFound);
    assert.deepEqual(await putSaveDrill("id-1", () => Promise.reject(new TypeError("Failed to fetch")))(request), {
        ok: false,
        code: "unavailable",
        message: SAVE_DRILL_MESSAGES.unavailable,
    });
});
