import assert from "node:assert/strict";
import test from "node:test";
import { createDrillControlGuard, unlockedDrillControlGuard } from "./drill-control-guard.ts";
import type { DrillClock } from "./drill-run.ts";

function harness() {
    let nowMs = 0;
    let nextHandle = 1;
    const wakes = new Map<number, { at: number; callback: () => void }>();
    const clock: DrillClock = {
        now: () => nowMs / 1000,
        setWake: (callback, delay) => {
            const handle = nextHandle++;
            wakes.set(handle, { at: nowMs + delay, callback });
            return handle;
        },
        clearWake: (handle) => {
            wakes.delete(handle as number);
        },
    };
    function advance(milliseconds: number) {
        const end = nowMs + milliseconds;
        while (nowMs < end) {
            nowMs += 1;
            for (const [handle, wake] of [...wakes]) {
                if (wake.at <= nowMs) {
                    wakes.delete(handle);
                    wake.callback();
                }
            }
        }
    }
    const guard = createDrillControlGuard(clock);
    let notifications = 0;
    guard.subscribe(() => {
        notifications += 1;
    });
    return { guard, advance, pending: () => wakes.size, notifications: () => notifications };
}

void test("the first activation passes and locks the guard", () => {
    const { guard } = harness();
    assert.equal(guard.isLocked(), false);
    assert.equal(guard.tryActivate(), true);
    assert.equal(guard.isLocked(), true);
});

void test("a second activation at +499 ms is rejected and does not move the window", () => {
    const { guard, advance } = harness();
    guard.tryActivate();
    advance(499);
    assert.equal(guard.tryActivate(), false);
    advance(1);
    assert.equal(guard.isLocked(), false);
});

void test("an activation at +500 ms passes and opens a new window", () => {
    const { guard, advance } = harness();
    guard.tryActivate();
    advance(500);
    assert.equal(guard.tryActivate(), true);
    advance(499);
    assert.equal(guard.isLocked(), true);
    advance(1);
    assert.equal(guard.isLocked(), false);
});

void test("the wake notifies subscribers about the unlock", () => {
    const { guard, advance, notifications } = harness();
    guard.tryActivate();
    assert.equal(notifications(), 1);
    advance(500);
    assert.equal(notifications(), 2);
    assert.equal(guard.isLocked(), false);
});

void test("isLocked stays true until the wake runs, it never computes time", () => {
    const clockState = { wakeCallback: null as (() => void) | null };
    const guard = createDrillControlGuard({
        now: () => 1000,
        setWake: (callback) => {
            clockState.wakeCallback = callback;
            return 1;
        },
        clearWake: () => undefined,
    });
    guard.tryActivate();
    assert.equal(guard.isLocked(), true);
    clockState.wakeCallback?.();
    assert.equal(guard.isLocked(), false);
});

void test("a rejected activation schedules no new wake and does not notify", () => {
    const { guard, pending, notifications } = harness();
    guard.tryActivate();
    const before = notifications();
    assert.equal(pending(), 1);
    guard.tryActivate();
    assert.equal(pending(), 1);
    assert.equal(notifications(), before);
});

void test("arm inside a running window moves its end to +500 ms from now", () => {
    const { guard, advance, pending } = harness();
    guard.tryActivate();
    advance(300);
    guard.arm();
    assert.equal(pending(), 1);
    advance(300);
    assert.equal(guard.isLocked(), true);
    advance(199);
    assert.equal(guard.isLocked(), true);
    advance(1);
    assert.equal(guard.isLocked(), false);
});

void test("subscribe returns an unsubscribe function", () => {
    const { guard, advance } = harness();
    let calls = 0;
    const unsubscribe = guard.subscribe(() => {
        calls += 1;
    });
    guard.tryActivate();
    assert.equal(calls, 1);
    unsubscribe();
    advance(500);
    assert.equal(calls, 1);
});

void test("reset clears the wake, unlocks, is idempotent and leaves the guard usable", () => {
    const { guard, advance, pending, notifications } = harness();
    guard.tryActivate();
    guard.reset();
    assert.equal(pending(), 0);
    assert.equal(guard.isLocked(), false);
    const afterReset = notifications();
    guard.reset();
    assert.equal(notifications(), afterReset);
    advance(1000);
    assert.equal(guard.tryActivate(), true);
    assert.equal(guard.isLocked(), true);
    assert.equal(pending(), 1);
    advance(500);
    assert.equal(guard.isLocked(), false);
});

void test("the unlocked guard never blocks", () => {
    assert.equal(unlockedDrillControlGuard.tryActivate(), true);
    assert.equal(unlockedDrillControlGuard.tryActivate(), true);
    unlockedDrillControlGuard.arm();
    assert.equal(unlockedDrillControlGuard.isLocked(), false);
    unlockedDrillControlGuard.reset();
    assert.equal(unlockedDrillControlGuard.isLocked(), false);
});
