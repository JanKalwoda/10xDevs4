import assert from "node:assert/strict";
import test from "node:test";
import { createStepRepeater, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "./drill-step-repeat.ts";
import { createStepPress } from "./drill-step-press.ts";

function harness(limit = Infinity) {
    let now = 0;
    let nextHandle = 1;
    const timers = new Map<number, { at: number; every?: number; callback: () => void }>();
    const repeater = createStepRepeater({
        setTimer: (callback, ms) => {
            const handle = nextHandle++;
            timers.set(handle, { at: now + ms, callback });
            return handle;
        },
        clearTimer: (handle) => {
            timers.delete(handle as number);
        },
        setIntervalTimer: (callback, ms) => {
            const handle = nextHandle++;
            timers.set(handle, { at: now + ms, every: ms, callback });
            return handle;
        },
        clearIntervalTimer: (handle) => {
            timers.delete(handle as number);
        },
    });
    const state = { steps: 0 };
    const press = createStepPress({
        repeater,
        step: () => {
            state.steps += 1;
            return state.steps < limit;
        },
        canStep: () => state.steps < limit,
    });
    function advance(ms: number) {
        const end = now + ms;
        while (now < end) {
            now += 1;
            for (const [handle, timer] of [...timers]) {
                if (!timers.has(handle) || timer.at > now) continue;
                if (timer.every === undefined) timers.delete(handle);
                else timer.at += timer.every;
                timer.callback();
            }
        }
    }
    return { press, state, advance, pending: () => timers.size };
}

void test("a plain click steps exactly once", () => {
    const { press, state } = harness();
    press.pointerDown("up");
    press.pointerUp(true);
    press.click("up", true);
    assert.equal(state.steps, 1);
});

void test("a click long after the pointer was released still steps exactly once", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(50);
    press.pointerUp(true);
    advance(1000);
    press.click("up", true);
    assert.equal(state.steps, 1);
});

void test("the press itself never steps; only the click does", () => {
    const { press, state } = harness();
    press.pointerDown("up");
    assert.equal(state.steps, 0);
    press.pointerUp(true);
    assert.equal(state.steps, 0);
});

void test("holding repeats after the delay and the click after release adds no step", () => {
    const { press, state, advance, pending } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS - 1);
    assert.equal(state.steps, 0);
    advance(1);
    assert.equal(state.steps, 1);
    advance(REPEAT_INTERVAL_MS * 3);
    assert.equal(state.steps, 4);
    press.pointerUp(true);
    assert.equal(pending(), 0);
    advance(1000);
    press.click("up", true);
    assert.equal(state.steps, 4);
    press.click("up", true);
    assert.equal(state.steps, 5);
});

void test("a hold that ends outside the button clears the flag, so a later key click steps", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    const held = state.steps;
    press.pointerUp(false);
    press.click("up", false);
    assert.equal(state.steps, held + 1);
});

void test("a click without a pointer always steps, even when a hold left the flag", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS);
    const held = state.steps;
    press.pointerUp(true);
    press.click("up", false);
    assert.equal(state.steps, held + 1);
    press.click("up", true);
    assert.equal(state.steps, held + 2);
});

void test("a new press clears a leftover flag", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS);
    press.pointerUp(true);
    const held = state.steps;
    press.pointerDown("down");
    press.pointerUp(true);
    press.click("down", true);
    assert.equal(state.steps, held + 1);
});

void test("an abort after the release keeps the flag (pointerup, lostpointercapture, click)", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS);
    const held = state.steps;
    press.pointerUp(true);
    press.pointerAbort();
    press.click("up", true);
    assert.equal(state.steps, held);
});

void test("an abort during the press stops the repeat and clears the flag; a second abort is harmless", () => {
    const { press, state, advance, pending } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    const held = state.steps;
    press.pointerAbort();
    press.pointerAbort();
    assert.equal(pending(), 0);
    advance(1000);
    assert.equal(state.steps, held);
    press.click("up", true);
    assert.equal(state.steps, held + 1);
});

void test("a pointer release without a press is ignored", () => {
    const { press, state } = harness();
    press.pointerUp(true);
    press.click("up", true);
    assert.equal(state.steps, 1);
});

void test("a second press restarts the hold", () => {
    const { press, state, advance } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS - 10);
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS - 10);
    assert.equal(state.steps, 0);
    advance(10);
    assert.equal(state.steps, 1);
});

void test("blur during a hold stops it and clears the flag", () => {
    const { press, state, advance, pending } = harness();
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    const held = state.steps;
    press.blur();
    assert.equal(pending(), 0);
    press.click("up", true);
    assert.equal(state.steps, held + 1);
});

void test("the repeat stops at the bound and a hold released later adds nothing", () => {
    const { press, state, advance, pending } = harness(3);
    press.pointerDown("up");
    advance(5000);
    assert.equal(state.steps, 3);
    assert.equal(pending(), 0);
    press.pointerUp(true);
    press.click("up", true);
    assert.equal(state.steps, 3);
});

void test("a press on a bound arms nothing and its click does not step", () => {
    const { press, state, pending } = harness(0);
    press.pointerDown("up");
    assert.equal(pending(), 0);
    press.pointerUp(true);
    press.click("up", true);
    assert.equal(state.steps, 0);
});

void test("a hold whose first repeat step hits the bound still skips the click", () => {
    const { press, state, advance } = harness(1);
    press.pointerDown("up");
    advance(REPEAT_DELAY_MS);
    assert.equal(state.steps, 1);
    press.pointerUp(true);
    press.click("up", true);
    assert.equal(state.steps, 1);
});
