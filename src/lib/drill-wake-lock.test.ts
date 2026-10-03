import assert from "node:assert/strict";
import test from "node:test";

import { createDrillWakeLockController, type WakeLockProvider, type WakeLockSentinelPort, type WakeLockStatus } from "./drill-wake-lock.ts";

class FakeWakeLockSentinel implements WakeLockSentinelPort {
    listeners = new Set<() => void>();
    releaseCalls = 0;
    rejectRelease = false;

    release() {
        this.releaseCalls++;
        this.emitRelease();
        if (this.rejectRelease) return Promise.reject(new Error("release failed"));
        return Promise.resolve();
    }

    addEventListener(_type: "release", listener: () => void) {
        this.listeners.add(listener);
    }

    removeEventListener(_type: "release", listener: () => void) {
        this.listeners.delete(listener);
    }

    emitRelease() {
        for (const listener of [...this.listeners]) listener();
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

void test("unsupported and rejected requests report unavailable without throwing", async () => {
    const unsupported = createDrillWakeLockController(null);
    const unsupportedStatuses: WakeLockStatus[] = [];
    unsupported.subscribe((status) => unsupportedStatuses.push(status));
    await assert.doesNotReject(unsupported.request());
    assert.equal(unsupported.getStatus(), "unavailable");
    assert.deepEqual(unsupportedStatuses, ["idle", "requesting", "unavailable"]);

    const rejected = createDrillWakeLockController({ request: () => Promise.reject(new Error("denied")) });
    await assert.doesNotReject(rejected.request());
    assert.equal(rejected.getStatus(), "unavailable");
});

void test("requests are idempotent while pending and held; subscriptions report and unsubscribe once", async () => {
    const pending = deferred<WakeLockSentinelPort>();
    const sentinel = new FakeWakeLockSentinel();
    let requestCalls = 0;
    const provider: WakeLockProvider = {
        request: () => {
            requestCalls++;
            return pending.promise;
        },
    };
    const controller = createDrillWakeLockController(provider);
    const statuses: WakeLockStatus[] = [];
    const unsubscribe = controller.subscribe((status) => statuses.push(status));

    const firstRequest = controller.request();
    await controller.request();
    assert.equal(requestCalls, 1);
    assert.deepEqual(statuses, ["idle", "requesting"]);

    pending.resolve(sentinel);
    await firstRequest;
    await controller.request();
    assert.equal(requestCalls, 1);
    assert.equal(controller.getStatus(), "held");
    assert.deepEqual(statuses, ["idle", "requesting", "held"]);

    unsubscribe();
    unsubscribe();
    await controller.release();
    assert.equal(controller.getStatus(), "idle");
    assert.deepEqual(statuses, ["idle", "requesting", "held"]);
});

void test("a later explicit request can retry after an unavailable result", async () => {
    const sentinel = new FakeWakeLockSentinel();
    let requestCalls = 0;
    const controller = createDrillWakeLockController({
        request: () => {
            requestCalls++;
            return requestCalls === 1 ? Promise.reject(new Error("denied")) : Promise.resolve(sentinel);
        },
    });

    await controller.request();
    assert.equal(controller.getStatus(), "unavailable");
    await controller.request();
    assert.equal(requestCalls, 2);
    assert.equal(controller.getStatus(), "held");
});

void test("intentional release stays idle while browser release marks the lock unavailable", async () => {
    const sentinels = [new FakeWakeLockSentinel(), new FakeWakeLockSentinel()];
    let requestCalls = 0;
    const controller = createDrillWakeLockController({
        request: () => Promise.resolve(sentinels[requestCalls++]),
    });

    await controller.request();
    await controller.release();
    assert.equal(sentinels[0].releaseCalls, 1);
    assert.equal(controller.getStatus(), "idle");
    await controller.release();
    assert.equal(sentinels[0].releaseCalls, 1);

    await controller.request();
    sentinels[1].emitRelease();
    assert.equal(controller.getStatus(), "unavailable");
    sentinels[1].emitRelease();
    assert.equal(controller.getStatus(), "unavailable");
});

void test("release invalidates a pending request and releases its late grant", async () => {
    const pending = deferred<WakeLockSentinelPort>();
    const sentinel = new FakeWakeLockSentinel();
    const controller = createDrillWakeLockController({ request: () => pending.promise });
    const statuses: WakeLockStatus[] = [];
    controller.subscribe((status) => statuses.push(status));

    const request = controller.request();
    await controller.release();
    assert.equal(controller.getStatus(), "idle");
    pending.resolve(sentinel);
    await request;

    assert.equal(sentinel.releaseCalls, 1);
    assert.equal(controller.getStatus(), "idle");
    assert.equal(statuses.includes("held"), false);
});

void test("failed sentinel release is best-effort and does not throw", async () => {
    const sentinel = new FakeWakeLockSentinel();
    sentinel.rejectRelease = true;
    const controller = createDrillWakeLockController({ request: () => Promise.resolve(sentinel) });
    await controller.request();

    await assert.doesNotReject(controller.release());
    assert.equal(sentinel.releaseCalls, 1);
    assert.equal(controller.getStatus(), "idle");
});
