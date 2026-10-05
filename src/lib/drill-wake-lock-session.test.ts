import assert from "node:assert/strict";
import test from "node:test";

import { createDrillWakeLockController, type WakeLockSentinelPort } from "./drill-wake-lock.ts";
import { createDrillWakeLockSession } from "./drill-wake-lock-session.ts";

class FakeWakeLockSentinel implements WakeLockSentinelPort {
    releaseCalls = 0;
    listeners = new Set<() => void>();

    release() {
        this.releaseCalls++;
        return Promise.resolve();
    }

    addEventListener(_type: "release", listener: () => void) {
        this.listeners.add(listener);
    }

    removeEventListener(_type: "release", listener: () => void) {
        this.listeners.delete(listener);
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

void test("only visible explicit gestures request or retry; release and visibility return do not", async () => {
    let visible = true;
    let requestCalls = 0;
    const sentinels = [new FakeWakeLockSentinel(), new FakeWakeLockSentinel()];
    const controller = createDrillWakeLockController({
        request: () => Promise.resolve(sentinels[requestCalls++]),
    });
    const session = createDrillWakeLockSession(controller, () => visible);

    await session.requestForVisibleGesture();
    assert.equal(requestCalls, 1);
    assert.equal(session.getStatus(), "held");

    visible = false;
    await session.release();
    assert.equal(session.getStatus(), "idle");
    visible = true;
    assert.equal(requestCalls, 1, "visibility return alone never reacquires");

    await session.requestForVisibleGesture();
    assert.equal(requestCalls, 2, "a visible explicit Resume may retry");
    assert.equal(session.getStatus(), "held");
    await session.dispose();
});

void test("hidden or disposed sessions reject gesture requests without reaching the provider", async () => {
    let visible = false;
    let requestCalls = 0;
    const controller = createDrillWakeLockController({
        request: () => {
            requestCalls++;
            return Promise.resolve(new FakeWakeLockSentinel());
        },
    });
    const session = createDrillWakeLockSession(controller, () => visible);

    await session.requestForVisibleGesture();
    assert.equal(requestCalls, 0);
    visible = true;
    await session.dispose();
    await session.requestForVisibleGesture();
    assert.equal(requestCalls, 0);
    assert.equal(session.getStatus(), "idle");
});

void test("release during initialization invalidates and cleans a late grant", async () => {
    let visible = true;
    let reportHidden!: () => void;
    const pending = deferred<WakeLockSentinelPort>();
    const sentinel = new FakeWakeLockSentinel();
    let requestCalls = 0;
    const controller = createDrillWakeLockController({
        request: () => {
            requestCalls++;
            return pending.promise;
        },
    });
    const session = createDrillWakeLockSession(
        controller,
        () => visible,
        (onHidden) => {
            reportHidden = onHidden;
            return () => {
                reportHidden = () => undefined;
            };
        },
    );

    const request = session.requestForVisibleGesture();
    visible = false;
    reportHidden();
    pending.resolve(sentinel);
    await request;

    assert.equal(session.wasHidden(), true, "hidden must be remembered before the timer subscribes");
    assert.equal(requestCalls, 1);
    assert.equal(sentinel.releaseCalls, 1);
    assert.equal(session.getStatus(), "idle");
    await session.dispose();
});

void test("a disposed run's late grant and hidden event never touch the replacement session", async () => {
    const hiddenListeners = new Set<() => void>();
    const subscribeToHidden = (onHidden: () => void) => {
        hiddenListeners.add(onHidden);
        return () => {
            hiddenListeners.delete(onHidden);
        };
    };
    const oldPending = deferred<WakeLockSentinelPort>();
    const oldSentinel = new FakeWakeLockSentinel();
    const newSentinel = new FakeWakeLockSentinel();
    const oldSession = createDrillWakeLockSession(createDrillWakeLockController({ request: () => oldPending.promise }), () => true, subscribeToHidden);
    const oldRequest = oldSession.requestForVisibleGesture();

    await oldSession.dispose();
    const newSession = createDrillWakeLockSession(createDrillWakeLockController({ request: () => Promise.resolve(newSentinel) }), () => true, subscribeToHidden);
    await newSession.requestForVisibleGesture();
    assert.equal(hiddenListeners.size, 1, "only the replacement stays subscribed to hidden events");

    oldPending.resolve(oldSentinel);
    await oldRequest;

    assert.equal(oldSentinel.releaseCalls, 1, "the late old grant is released by its own session");
    assert.equal(newSentinel.releaseCalls, 0);
    assert.equal(newSession.getStatus(), "held");
    assert.equal(oldSession.getStatus(), "idle");
    await newSession.dispose();
    assert.equal(newSentinel.releaseCalls, 1);
});

void test("hiding while a replacement grant is pending releases it and show alone never reacquires", async () => {
    let visible = true;
    let reportHidden!: () => void;
    let requests = 0;
    const pending = deferred<WakeLockSentinelPort>();
    const sentinel = new FakeWakeLockSentinel();
    const session = createDrillWakeLockSession(
        createDrillWakeLockController({
            request: () => {
                requests++;
                return pending.promise;
            },
        }),
        () => visible,
        (onHidden) => {
            reportHidden = onHidden;
            return () => undefined;
        },
    );
    const request = session.requestForVisibleGesture();

    visible = false;
    reportHidden();
    pending.resolve(sentinel);
    await request;
    visible = true;

    assert.equal(sentinel.releaseCalls, 1);
    assert.equal(requests, 1, "becoming visible does not request again");
    assert.equal(session.getStatus(), "idle");
    await session.dispose();
});
