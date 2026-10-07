import assert from "node:assert/strict";
import test from "node:test";

import { createDrillDeleteController, deleteDrillRequest, DELETE_DRILL_MESSAGES, type DeleteDrillOutcome } from "./drill-delete-controller.ts";

function deferredPort() {
    let calls = 0;
    const resolvers: ((outcome: DeleteDrillOutcome) => void)[] = [];
    const port = () => {
        calls++;
        return new Promise<DeleteDrillOutcome>((resolve) => resolvers.push(resolve));
    };
    return { port, calls: () => calls, resolve: (outcome: DeleteDrillOutcome) => resolvers.shift()?.(outcome) };
}

void test("confirm while deleting is a no-op: a double click sends one request", async () => {
    const deferred = deferredPort();
    const navigated: string[] = [];
    const controller = createDrillDeleteController(deferred.port, (href) => navigated.push(href));

    const first = controller.confirm();
    void controller.confirm();
    assert.equal(deferred.calls(), 1);
    assert.equal(controller.getSnapshot().status, "deleting");

    deferred.resolve({ ok: true });
    await first;
    assert.deepEqual(navigated, ["/dashboard"]);
    assert.equal(deferred.calls(), 1);
});

void test("success navigates to the dashboard and stays deleting", async () => {
    const navigated: string[] = [];
    const controller = createDrillDeleteController(
        () => Promise.resolve({ ok: true }),
        (href) => navigated.push(href),
    );
    await controller.confirm();
    assert.deepEqual(navigated, ["/dashboard"]);
    assert.equal(controller.getSnapshot().status, "deleting");
});

void test("a 404 from the production port counts as done", async () => {
    const navigated: string[] = [];
    const port = deleteDrillRequest("3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b", () => Promise.resolve(new Response("{}", { status: 404 })));
    const controller = createDrillDeleteController(port, (href) => navigated.push(href));
    await controller.confirm();
    assert.deepEqual(navigated, ["/dashboard"]);
});

void test("production port sends DELETE to the encoded id and maps statuses", async () => {
    const calls: { url: string; method: string | undefined }[] = [];
    const reply = (status: number) => (input: URL | RequestInfo, init?: RequestInit) => {
        calls.push({ url: typeof input === "string" ? input : "", method: init?.method });
        return Promise.resolve(new Response(null, { status }));
    };
    assert.deepEqual(await deleteDrillRequest("a b", reply(204))(), { ok: true });
    assert.deepEqual(calls[0], { url: "/api/drills/a%20b", method: "DELETE" });
    assert.deepEqual(await deleteDrillRequest("x", reply(401))(), { ok: false, code: "unauthorized" });
    assert.deepEqual(await deleteDrillRequest("x", reply(503))(), { ok: false, code: "unavailable" });
    assert.deepEqual(await deleteDrillRequest("x", reply(500))(), { ok: false, code: "unexpected" });
    assert.deepEqual(await deleteDrillRequest("x", () => Promise.reject(new Error("offline")))(), { ok: false, code: "unavailable" });
});

void test("401 becomes an unauthorized alert and does not navigate", async () => {
    const navigated: string[] = [];
    const controller = createDrillDeleteController(
        () => Promise.resolve({ ok: false, code: "unauthorized" }),
        (href) => navigated.push(href),
    );
    await controller.confirm();
    assert.deepEqual(controller.getSnapshot(), { status: "error", failure: { code: "unauthorized", message: DELETE_DRILL_MESSAGES.unauthorized } });
    assert.deepEqual(navigated, []);
});

void test("a failure or a throwing port keeps the error and allows a retry", async () => {
    let attempt = 0;
    const navigated: string[] = [];
    const controller = createDrillDeleteController(
        () => {
            attempt++;
            if (attempt === 1) return Promise.reject(new Error("boom"));
            if (attempt === 2) return Promise.resolve({ ok: false, code: "unavailable" });
            return Promise.resolve({ ok: true });
        },
        (href) => navigated.push(href),
    );
    await controller.confirm();
    assert.equal(controller.getSnapshot().failure?.code, "unexpected");
    await controller.confirm();
    assert.equal(controller.getSnapshot().failure?.code, "unavailable");
    await controller.confirm();
    assert.deepEqual(navigated, ["/dashboard"]);
    assert.equal(attempt, 3);
});

void test("cancel is ignored while deleting and clears an error otherwise", async () => {
    const deferred = deferredPort();
    const controller = createDrillDeleteController(deferred.port, () => undefined);
    const pending = controller.confirm();
    controller.cancel();
    assert.equal(controller.getSnapshot().status, "deleting");

    deferred.resolve({ ok: false, code: "unexpected" });
    await pending;
    assert.equal(controller.getSnapshot().status, "error");
    controller.cancel();
    assert.deepEqual(controller.getSnapshot(), { status: "idle", failure: null });
});

void test("reset returns a stuck deleting state to idle (bfcache restore)", () => {
    const deferred = deferredPort();
    const controller = createDrillDeleteController(deferred.port, () => undefined);
    void controller.confirm();
    assert.equal(controller.getSnapshot().status, "deleting");
    controller.reset();
    assert.deepEqual(controller.getSnapshot(), { status: "idle", failure: null });
});

void test("subscribers are notified and can unsubscribe", async () => {
    const controller = createDrillDeleteController(
        () => Promise.resolve({ ok: false, code: "unexpected" }),
        () => undefined,
    );
    let notified = 0;
    const unsubscribe = controller.subscribe(() => notified++);
    await controller.confirm();
    assert.equal(notified, 2);
    controller.cancel();
    assert.equal(notified, 3);
    unsubscribe();
    await controller.confirm();
    assert.equal(notified, 3);
});
