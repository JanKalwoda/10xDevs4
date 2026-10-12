import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { createDrillAudio } from "./drill-audio.ts";
import { DrillRun, type DrillClock } from "./drill-run.ts";
import type { DrillConfiguration } from "../types.ts";

// Oracle: PRD FR-004 (two short Standby sounds in a different tonality than the long Exercise sound, one short Rest
// sound), FR-002 (the wait counts from the end of the second Standby sound), NFR (cue moment error <= 0.2 s) and FR-006
// (resume re-arms the signals; Preparation and Rest are not re-announced). Sounds are read from the fake Web Audio
// oscillators, so the test sees what reaches Web Audio, not module constants.

class FakeClock implements DrillClock {
    time = 0;
    now() {
        return this.time;
    }
    setWake() {
        return 0;
    }
    clearWake() {
        return undefined;
    }
}

interface FakeOscillator {
    frequency: { value: number };
    type: string;
    owner: FakeContext;
    startAt: number | undefined;
    stopAt: number | undefined;
    cancelled: boolean;
    connect: (gain: unknown) => unknown;
    addEventListener: () => void;
    disconnect: () => void;
    start: (at: number) => void;
    stop: (at?: number) => void;
}

/** Audio time starts at 0 when the context is created and then follows the shared fake clock. */
class FakeContext extends EventTarget {
    static instances: FakeContext[] = [];
    static clock = new FakeClock();
    static resumeState = "running";
    state = "suspended";
    destination = {};
    closed = false;
    bornAt = FakeContext.clock.time;
    oscillators: FakeOscillator[] = [];

    constructor() {
        super();
        FakeContext.instances.push(this);
    }

    get currentTime() {
        return FakeContext.clock.time - this.bornAt;
    }

    resume() {
        this.state = FakeContext.resumeState;
        return Promise.resolve();
    }

    close() {
        this.closed = true;
        this.state = "closed";
        return Promise.resolve();
    }

    createOscillator() {
        const oscillator: FakeOscillator = {
            frequency: { value: 0 },
            type: "sine",
            owner: this,
            startAt: undefined,
            stopAt: undefined,
            cancelled: false,
            connect: (gain) => gain,
            addEventListener: () => undefined,
            disconnect: () => undefined,
            start: (at) => {
                oscillator.startAt = at;
            },
            stop: (at) => {
                if (at === undefined) oscillator.cancelled = true;
                else oscillator.stopAt = at;
            },
        };
        this.oscillators.push(oscillator);
        return oscillator;
    }

    createGain() {
        return {
            gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
            connect: () => undefined,
            disconnect: () => undefined,
        };
    }
}

function installAudio(t: TestContext, clock: FakeClock) {
    const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
    FakeContext.instances = [];
    FakeContext.clock = clock;
    FakeContext.resumeState = "running";
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeContext });
    t.mock.method(performance, "now", () => clock.time * 1000);
    t.after(() => {
        if (original) Object.defineProperty(globalThis, "AudioContext", original);
        else Reflect.deleteProperty(globalThis, "AudioContext");
    });
}

interface Sound {
    start: number;
    end: number;
    length: number;
    pitch: number;
    cancelled: boolean;
}

/** Sounds of one context on the shared (wall clock) axis, in the order they play. */
function soundsOf(context: FakeContext): Sound[] {
    return context.oscillators
        .map((oscillator) => {
            const start = (oscillator.startAt ?? Number.NaN) + context.bornAt;
            const end = (oscillator.stopAt ?? Number.NaN) + context.bornAt;
            return { start, end, length: end - start, pitch: oscillator.frequency.value, cancelled: oscillator.cancelled };
        })
        .sort((a, b) => a.start - b.start);
}

function near(actual: number, expected: number, tolerance: number, message: string) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

const SHORT_WAIT = 0; // 1.00 s
const LONG_WAIT = 0.999; // 5.00 s

function scriptedRandom(first: number[], then: number) {
    let calls = 0;
    return () => first[calls++] ?? then;
}

function goTo(clock: FakeClock, run: DrillRun, seconds: number) {
    while (clock.time < seconds) {
        clock.time = Math.min(seconds, clock.time + 0.25);
        run.tick();
    }
}

function config(overrides: Partial<DrillConfiguration>): DrillConfiguration {
    return { preparationSeconds: 1, exerciseSeconds: 3, restSeconds: 2, repetitions: 2, randomStartEnabled: true, ...overrides };
}

async function startRun(t: TestContext, configuration: DrillConfiguration, random: () => number) {
    const clock = new FakeClock();
    installAudio(t, clock);
    const audio = await createDrillAudio();
    assert.ok(audio, "audio starts in the Start gesture");
    const run = new DrillRun(configuration, clock, audio, random);
    run.start();
    return { clock, run };
}

interface RepetitionExpectation {
    random: boolean;
    /** Standby wait in seconds after the second Standby sound; PRD range 1.00-5.00. */
    wait?: number;
    exerciseSeconds: number;
    rest: boolean;
}

/** Checks the PRD relations of one repetition starting at `sounds[index]`; returns where the next one starts. */
function checkRepetition(sounds: Sound[], index: number, expected: RepetitionExpectation) {
    let cursor = index;
    const standby = expected.random ? [sounds[cursor++], sounds[cursor++]] : [];
    const exercise = sounds[cursor++];
    const rest = expected.rest ? sounds[cursor++] : undefined;
    assert.ok(exercise, `exercise sound of the repetition at sound #${index}`);
    if (expected.random) {
        const [first, second] = standby;
        assert.equal(standby.length, 2, "two Standby sounds");
        assert.ok(second.start >= first.end - 0.001, "second Standby sound follows the first");
        near(exercise.start - second.end, expected.wait ?? Number.NaN, 0.001, "wait counted from the end of the second Standby sound");
        assert.notEqual(first.pitch, exercise.pitch, "Standby tonality differs from the Exercise sound");
        assert.notEqual(second.pitch, exercise.pitch, "Standby tonality differs from the Exercise sound");
        assert.ok(exercise.length > first.length && exercise.length > second.length, "the Exercise sound is longer than the Standby sounds");
    }
    if (expected.rest) {
        assert.ok(rest, "Rest sound");
        near(rest.start - exercise.start, expected.exerciseSeconds, 0.001, "Rest sound at the end of the Exercise");
        assert.ok(exercise.length > rest.length, "the Exercise sound is longer than the Rest sound");
    }
    return { next: cursor, exercise, rest, first: standby[0] ?? exercise };
}

void test("random start: no sound in Preparation, two Standby sounds then the Exercise sound after the full wait, Rest sound at the end, every repetition", async (t) => {
    const { clock, run } = await startRun(t, config({}), scriptedRandom([SHORT_WAIT, LONG_WAIT], LONG_WAIT));
    goTo(clock, run, 20);
    const sounds = soundsOf(FakeContext.instances[0]);
    assert.equal(sounds.length, 8, "4 sounds per repetition, none for Preparation");
    near(sounds[0].start, 1, 0.2, "first Standby sound at the end of Preparation");
    const first = checkRepetition(sounds, 0, { random: true, wait: 1, exerciseSeconds: 3, rest: true });
    const second = checkRepetition(sounds, first.next, { random: true, wait: 5, exerciseSeconds: 3, rest: true });
    assert.ok(first.rest);
    near(second.first.start - first.rest.start, 2, 0.001, "next Standby starts when the Rest time is over");
    assert.equal(second.next, 8);
});

void test("Preparation 0 s and Rest 0 s: Standby sounds at the very start, no Rest sound at all", async (t) => {
    const { clock, run } = await startRun(t, config({ preparationSeconds: 0, restSeconds: 0, exerciseSeconds: 2 }), scriptedRandom([LONG_WAIT, SHORT_WAIT], SHORT_WAIT));
    goTo(clock, run, 20);
    const sounds = soundsOf(FakeContext.instances[0]);
    assert.equal(sounds.length, 6, "3 sounds per repetition: no Preparation and no Rest sound");
    near(sounds[0].start, 0, 0.2, "first Standby sound at the Start");
    const first = checkRepetition(sounds, 0, { random: true, wait: 5, exerciseSeconds: 2, rest: false });
    const second = checkRepetition(sounds, first.next, { random: true, wait: 1, exerciseSeconds: 2, rest: false });
    near(second.first.start - first.exercise.start, 2, 0.001, "next Standby starts when the Exercise time is over");
});

void test("no random start: only Exercise and Rest sounds, the first at the end of Preparation", async (t) => {
    const { clock, run } = await startRun(t, config({ randomStartEnabled: false, repetitions: 1, exerciseSeconds: 2 }), () => 0);
    goTo(clock, run, 20);
    const sounds = soundsOf(FakeContext.instances[0]);
    assert.equal(sounds.length, 2);
    near(sounds[0].start, 1, 0.2, "Exercise sound at the end of Preparation");
    checkRepetition(sounds, 0, { random: false, exerciseSeconds: 2, rest: true });
});

void test("return from a hidden tab in Exercise: old sounds are stopped, a fresh running context plays the same repetition after a full Preparation and a new wait", async (t) => {
    const configuration = config({ exerciseSeconds: 4 });
    const { clock, run } = await startRun(t, configuration, scriptedRandom([SHORT_WAIT], LONG_WAIT));
    goTo(clock, run, 3); // inside Exercise repetition 1
    assert.equal(run.display.phase?.kind, "exercise");
    run.hide();
    const old = FakeContext.instances[0];
    const oldSounds = soundsOf(old);
    assert.ok(
        oldSounds.some(({ start }) => start > 3),
        "later sounds had been queued",
    );
    assert.ok(
        oldSounds.filter(({ start }) => start > 3).every(({ cancelled }) => cancelled),
        "future sounds of the old context are stopped",
    );
    clock.time = 10; // seven seconds hidden
    await run.resumeWithAudio(() => createDrillAudio());
    assert.equal(FakeContext.instances.length, 2);
    assert.equal(FakeContext.instances[1].state, "running");
    assert.equal(old.closed, true, "the old context is closed");
    assert.equal(run.display.audioAvailable, true);
    const sounds = soundsOf(FakeContext.instances[1]);
    near(sounds[0].start, 11, 0.2, "Standby sounds right after the full 1 s Preparation");
    const repetition = checkRepetition(sounds, 0, { random: true, wait: 5, exerciseSeconds: 4, rest: true });
    assert.equal(repetition.exercise.cancelled, false);
});

void test("return from a hidden tab in Rest: Rest is not announced again, the next Standby comes after the remaining Rest time", async (t) => {
    const configuration = config({ exerciseSeconds: 2, restSeconds: 3 });
    const { clock, run } = await startRun(t, configuration, () => SHORT_WAIT);
    const oldSounds = soundsOf(FakeContext.instances[0]);
    const restStart = oldSounds[3].start; // Standby x2, Exercise, Rest
    goTo(clock, run, restStart + 0.5);
    assert.equal(run.display.phase?.kind, "rest");
    run.hide();
    clock.time = 30;
    await run.resumeWithAudio(() => createDrillAudio());
    const sounds = soundsOf(FakeContext.instances[1]);
    assert.ok(sounds.length > 0);
    near(sounds[0].start, 30 + 2.5, 0.2, "the next sound is Standby after the remaining 2.5 s of Rest");
    assert.equal(sounds[0].pitch, oldSounds[0].pitch, "it is the first Standby sound, not a second Rest sound");
    assert.notEqual(sounds[0].pitch, oldSounds[3].pitch);
});

void test("a context that never reaches running gives no audio: the drill runs silently, and a later Pause and Resume brings the sounds back", async (t) => {
    const clock = new FakeClock();
    installAudio(t, clock);
    FakeContext.resumeState = "suspended";
    assert.equal(await createDrillAudio(), null);
    assert.equal(FakeContext.instances[0].closed, true);
    const run = new DrillRun(config({ randomStartEnabled: false, exerciseSeconds: 4 }), clock, null, () => 0);
    run.start();
    assert.equal(run.display.audioAvailable, false);
    goTo(clock, run, 1.5);
    assert.deepEqual(run.display.phase, { kind: "exercise", durationSeconds: 4, repetition: 1 }, "the timeline is intact without audio");
    run.hide();
    clock.time = 5;
    FakeContext.resumeState = "running";
    await run.resumeWithAudio(() => createDrillAudio());
    assert.equal(run.display.audioAvailable, true);
    const sounds = soundsOf(FakeContext.instances[1]);
    assert.ok(sounds.length >= 2, "Exercise and Rest sounds are scheduled again");
    near(sounds[0].start, 6, 0.2, "Exercise sound after the full 1 s Preparation");
});

void test("without Web Audio the drill runs through every phase on time and without sound", async (t) => {
    const clock = new FakeClock();
    installAudio(t, clock);
    Reflect.deleteProperty(globalThis, "AudioContext");
    const audio = await createDrillAudio();
    assert.equal(audio, null);
    const run = new DrillRun(config({ randomStartEnabled: false, exerciseSeconds: 2, restSeconds: 1, repetitions: 1 }), clock, audio, () => 0);
    run.start();
    const seen: string[] = [];
    while (clock.time < 6) {
        const phase = run.display.phase;
        const key = phase ? phase.kind : "end";
        if (seen[seen.length - 1] !== key) seen.push(key);
        goTo(clock, run, clock.time + 0.25);
    }
    assert.deepEqual(seen, ["preparation", "exercise", "rest", "end"]);
    assert.equal(run.display.audioAvailable, false);
});
