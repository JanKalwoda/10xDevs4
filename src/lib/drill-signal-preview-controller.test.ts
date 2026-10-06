import assert from "node:assert/strict";
import test from "node:test";

import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "./drill-audio.ts";
import { createSignalPreviewController } from "./drill-signal-preview-controller.ts";

class FakeAudio implements DrillAudioPort {
    available = true;
    cues: DrillCue[] = [];
    cancelled = 0;
    closed = 0;
    handler: (() => void) | undefined;
    schedule(cue: DrillCue, at: number): ScheduledCue {
        this.cues.push(cue);
        return { start: at, end: at + CUE_DURATION[cue] };
    }
    cancel() {
        this.cancelled++;
    }
    close() {
        this.closed++;
        this.available = false;
    }
    onUnavailable(handler: () => void) {
        this.handler = handler;
    }
}

function setup() {
    const state = { time: 100, creates: 0, timers: new Map<number, { cb: () => void; ms: number }>(), nextTimer: 0 };
    const pending: { resolve: (audio: DrillAudioPort | null) => void; reject: (error: unknown) => void }[] = [];
    const controller = createSignalPreviewController({
        createAudio: () => {
            state.creates++;
            return new Promise<DrillAudioPort | null>((resolve, reject) => {
                pending.push({ resolve, reject });
            });
        },
        now: () => state.time,
        setTimer: (cb, ms) => {
            const id = ++state.nextTimer;
            state.timers.set(id, { cb, ms });
            return id;
        },
        clearTimer: (handle) => {
            state.timers.delete(handle as number);
        },
    });
    const fire = () => {
        const [id, timer] = [...state.timers.entries()][0];
        state.timers.delete(id);
        timer.cb();
    };
    return { state, pending, controller, fire };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

void test("createAudio is called synchronously in the click and a second click while initializing is ignored", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    assert.equal(state.creates, 1);
    assert.deepEqual(controller.getSnapshot(), { status: "initializing", signal: "exercise" });
    controller.play("rest");
    assert.equal(state.creates, 1);
    const audio = new FakeAudio();
    pending[0].resolve(audio);
    await flush();
    assert.deepEqual(audio.cues, ["exercise"]);
    assert.deepEqual(controller.getSnapshot(), { status: "playing", signal: "exercise" });
});

void test("playing clears at the real end of the last cue", async () => {
    const { state, pending, controller, fire } = setup();
    controller.play("standby");
    pending[0].resolve(new FakeAudio());
    await flush();
    assert.equal(controller.getSnapshot().status, "playing");
    const [{ ms }] = [...state.timers.values()];
    assert.ok(Math.abs(ms - (CUE_DURATION["standby-first"] + CUE_DURATION["standby-second"]) * 1000) < 1e-6);
    fire();
    assert.deepEqual(controller.getSnapshot(), { status: "idle", signal: null });
});

void test("a late grant after release is closed and nothing plays", async () => {
    const { pending, controller } = setup();
    controller.play("exercise");
    controller.release();
    const audio = new FakeAudio();
    pending[0].resolve(audio);
    await flush();
    assert.equal(audio.closed, 1);
    assert.deepEqual(audio.cues, []);
    assert.equal(controller.getSnapshot().status, "idle");
});

void test("a live port is reused and a new play cancels the previous sound", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    const audio = new FakeAudio();
    pending[0].resolve(audio);
    await flush();
    const cancelledBefore = audio.cancelled;
    controller.play("rest");
    assert.equal(state.creates, 1);
    assert.equal(audio.cancelled, cancelledBefore + 1);
    assert.equal(state.timers.size, 1);
    assert.deepEqual(controller.getSnapshot(), { status: "playing", signal: "rest" });
});

void test("a dead port is closed and replaced inside the next click", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    const dead = new FakeAudio();
    pending[0].resolve(dead);
    await flush();
    dead.available = false;
    controller.play("exercise");
    assert.equal(state.creates, 2);
    assert.equal(dead.closed, 1);
    assert.equal(controller.getSnapshot().status, "initializing");
});

void test("null or rejected audio is unavailable and the next click retries", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    pending[0].resolve(null);
    await flush();
    assert.deepEqual(controller.getSnapshot(), { status: "unavailable", signal: null });
    controller.play("exercise");
    assert.equal(state.creates, 2);
    pending[1].reject(new Error("blocked"));
    await flush();
    assert.equal(controller.getSnapshot().status, "unavailable");
    controller.play("exercise");
    assert.equal(state.creates, 3);
});

void test("port onUnavailable moves a playing preview to unavailable and stops the timer", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    const audio = new FakeAudio();
    pending[0].resolve(audio);
    await flush();
    audio.handler?.();
    assert.equal(controller.getSnapshot().status, "unavailable");
    assert.equal(audio.closed, 1);
    assert.equal(state.timers.size, 0);
});

void test("release is idempotent, closes the port and clears the timer", async () => {
    const { state, pending, controller } = setup();
    controller.play("exercise");
    const audio = new FakeAudio();
    pending[0].resolve(audio);
    await flush();
    controller.release();
    controller.release();
    assert.equal(audio.closed, 1);
    assert.equal(state.timers.size, 0);
    assert.deepEqual(controller.getSnapshot(), { status: "idle", signal: null });
});

void test("subscribers are notified and can unsubscribe", async () => {
    const { pending, controller } = setup();
    let calls = 0;
    const unsubscribe = controller.subscribe(() => calls++);
    controller.play("exercise");
    assert.equal(calls, 1);
    unsubscribe();
    pending[0].resolve(new FakeAudio());
    await flush();
    assert.equal(calls, 1);
});
