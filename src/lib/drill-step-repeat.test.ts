import assert from "node:assert/strict";
import test from "node:test";
import { createStepRepeater, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "./drill-step-repeat.ts";

function harness() {
    let now = 0;
    let nextHandle = 1;
    const timeouts = new Map<number, { at: number; callback: () => void }>();
    const intervals = new Map<number, { next: number; every: number; callback: () => void }>();
    const repeater = createStepRepeater({
        setTimer: (callback, milliseconds) => {
            const handle = nextHandle++;
            timeouts.set(handle, { at: now + milliseconds, callback });
            return handle;
        },
        clearTimer: (handle) => {
            timeouts.delete(handle as number);
        },
        setIntervalTimer: (callback, milliseconds) => {
            const handle = nextHandle++;
            intervals.set(handle, { next: now + milliseconds, every: milliseconds, callback });
            return handle;
        },
        clearIntervalTimer: (handle) => {
            intervals.delete(handle as number);
        },
    });
    function advance(milliseconds: number) {
        const end = now + milliseconds;
        // Fire due timers in time order, one millisecond at a time keeps ordering exact for these tests.
        while (now < end) {
            now += 1;
            for (const [handle, timer] of [...timeouts]) {
                if (timer.at <= now) {
                    timeouts.delete(handle);
                    timer.callback();
                }
            }
            for (const timer of [...intervals.values()]) {
                if (timer.next <= now && [...intervals.values()].includes(timer)) {
                    timer.next += timer.every;
                    timer.callback();
                }
            }
        }
    }
    return { repeater, advance, pending: () => timeouts.size + intervals.size };
}

function counter(limit = Infinity) {
    const state = { steps: 0 };
    return {
        state,
        step: () => {
            state.steps += 1;
            return state.steps < limit;
        },
    };
}

void test("the first step runs immediately and nothing repeats before the delay", () => {
    const { repeater, advance } = harness();
    const { state, step } = counter();
    repeater.start(step);
    assert.equal(state.steps, 1);
    advance(REPEAT_DELAY_MS - 1);
    assert.equal(state.steps, 1);
});

void test("repeats every 100 ms after the 400 ms delay", () => {
    const { repeater, advance } = harness();
    const { state, step } = counter();
    repeater.start(step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    assert.equal(state.steps, 2);
    advance(REPEAT_INTERVAL_MS * 3);
    assert.equal(state.steps, 5);
});

void test("stops repeating when a step reports a bound", () => {
    const { repeater, advance, pending } = harness();
    const { state, step } = counter(3);
    repeater.start(step);
    advance(2000);
    assert.equal(state.steps, 3);
    assert.equal(pending(), 0);
});

void test("a first step that reports a bound never starts the repeat", () => {
    const { repeater, advance, pending } = harness();
    const { state, step } = counter(1);
    repeater.start(step);
    assert.equal(pending(), 0);
    advance(2000);
    assert.equal(state.steps, 1);
});

void test("stop clears the delay and the interval and is idempotent", () => {
    const { repeater, advance, pending } = harness();
    const { state, step } = counter();
    repeater.start(step);
    repeater.stop();
    repeater.stop();
    advance(1000);
    assert.equal(state.steps, 1);
    assert.equal(pending(), 0);

    repeater.start(step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    const before = state.steps;
    repeater.stop();
    advance(1000);
    assert.equal(state.steps, before);
    assert.equal(pending(), 0);
});

void test("a second start replaces the first repeat", () => {
    const { repeater, advance } = harness();
    const first = counter();
    const second = counter();
    repeater.start(first.step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    const firstSteps = first.state.steps;
    repeater.start(second.step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 2);
    assert.equal(first.state.steps, firstSteps);
    assert.equal(second.state.steps, 3);
});

void test("dispose stops the repeat and blocks later starts", () => {
    const { repeater, advance, pending } = harness();
    const { state, step } = counter();
    repeater.start(step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    repeater.dispose();
    repeater.dispose();
    const before = state.steps;
    advance(1000);
    repeater.start(step);
    advance(1000);
    assert.equal(state.steps, before);
    assert.equal(pending(), 0);
});

void test("stop on cleanup keeps the repeater usable when the effect runs again on the same instance", () => {
    const { repeater, advance, pending } = harness();
    const { state, step } = counter();
    repeater.start(step);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    repeater.stop();
    assert.equal(pending(), 0);
    const before = state.steps;
    repeater.start(step);
    assert.equal(state.steps, before + 1);
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    assert.equal(state.steps, before + 2);
});

void test("a step reading the latest value ends the repeat when the value changes outside", () => {
    const { repeater, advance, pending } = harness();
    const latest = { value: 3 };
    const seen: number[] = [];
    repeater.start(() => {
        if (latest.value >= 5) return false;
        latest.value += 1;
        seen.push(latest.value);
        return true;
    });
    advance(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS);
    latest.value = 9;
    advance(1000);
    assert.deepEqual(seen, [4, 5]);
    assert.equal(pending(), 0);
});
