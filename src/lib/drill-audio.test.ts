import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { createDrillAudio, evaluateDrillSchedule, type DrillScheduleEvidence } from "./drill-audio.ts";

const cue = (name: DrillScheduleEvidence["cue"], at: number): DrillScheduleEvidence => ({
    cue: name,
    expectedStart: at,
    scheduledStart: at,
    deviationSeconds: 0,
});

void test("schedule evidence fails when a cue is missing despite exact timestamps", () => {
    const cues = [cue("exercise", 0), cue("rest", 4), cue("rest", 10)];
    const result = evaluateDrillSchedule(cues, 2, false, true, true);
    assert.equal(result.allExpectedCuesScheduled, false);
    assert.equal(result.withinTolerance, false);
});

void test("complete programmed cues pass only within the timing bound", () => {
    const cues = [cue("standby-first", 0), cue("standby-second", 0.26), cue("exercise", 1.38), cue("rest", 5.38)];
    assert.equal(evaluateDrillSchedule(cues, 1, true, true, true).withinTolerance, true);
    assert.equal(evaluateDrillSchedule([{ ...cues[2], deviationSeconds: 0.21 }, ...cues.filter((_, index) => index !== 2)], 1, true, true, true).withinTolerance, false);
});

class FakeContext extends EventTarget {
    static instances: FakeContext[] = [];
    static stall = false;
    state = "suspended";
    currentTime = 0;
    destination = {};
    starts: number[] = [];
    closed = false;

    constructor() {
        super();
        FakeContext.instances.push(this);
    }

    resume() {
        if (FakeContext.stall) return new Promise<void>(() => undefined);
        this.state = "running";
        return Promise.resolve();
    }

    close() {
        this.closed = true;
        this.state = "closed";
        return Promise.resolve();
    }

    createOscillator() {
        return {
            frequency: { value: 0 },
            type: "sine",
            connect: (gain: ReturnType<FakeContext["createGain"]>) => gain,
            addEventListener: () => undefined,
            disconnect: () => undefined,
            start: (at: number) => this.starts.push(at),
            stop: () => undefined,
        };
    }

    createGain() {
        return {
            gain: {
                setValueAtTime: () => undefined,
                exponentialRampToValueAtTime: () => undefined,
            },
            connect: () => undefined,
            disconnect: () => undefined,
        };
    }
}

function installAudio(t: TestContext) {
    const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
    FakeContext.instances = [];
    FakeContext.stall = false;
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeContext });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, "AudioContext", original);
        else Reflect.deleteProperty(globalThis, "AudioContext");
    });
}

void test("fresh audio after interruption maps a cue to now rather than elapsed hidden time", async (t) => {
    installAudio(t);
    let wallMilliseconds = 0;
    t.mock.method(performance, "now", () => wallMilliseconds);
    const first = await createDrillAudio();
    assert.ok(first);
    let unavailable = false;
    first.onUnavailable(() => {
        unavailable = true;
    });
    wallMilliseconds = 5000;
    const firstContext = FakeContext.instances[0];
    firstContext.currentTime = 5;
    firstContext.state = "interrupted";
    firstContext.dispatchEvent(new Event("statechange"));
    assert.equal(first.available, false);
    assert.equal(unavailable, true);
    wallMilliseconds = 100000; // Audio time stayed at 5 while the phone was locked.
    const recovered = await createDrillAudio();
    assert.ok(recovered);
    const scheduled = recovered.schedule("exercise", 100);
    assert.equal(FakeContext.instances[1].starts[0], 0);
    assert.deepEqual(scheduled, { start: 100, end: 101 });
    assert.equal(recovered.scheduleEvidence?.[0].deviationSeconds, 0);
    first.close();
    recovered.close();
});

void test("audio initialization times out and closes a context with unresolved resume", async (t) => {
    installAudio(t);
    FakeContext.stall = true;
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = createDrillAudio();
    t.mock.timers.tick(1500);
    assert.equal(await pending, null);
    assert.equal(FakeContext.instances[0].closed, true);
});
