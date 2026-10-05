import assert from "node:assert/strict";
import test from "node:test";

import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "./drill-audio.ts";
import { DrillRun, type DrillClock, type DrillDisplay } from "./drill-run.ts";
import type { DrillConfiguration } from "../types.ts";

const configuration: DrillConfiguration = {
    preparationSeconds: 0,
    exerciseSeconds: 4,
    restSeconds: 2,
    repetitions: 3,
    randomStartEnabled: true,
};

class FakeClock implements DrillClock {
    time = 0;
    callbacks = new Map<number, () => void>();
    nextId = 0;
    now() {
        return this.time;
    }
    setWake(callback: () => void) {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
    }
    clearWake(handle: unknown) {
        this.callbacks.delete(handle as number);
    }
    advance(to: number) {
        this.time = to;
    }
    fireStale(callback: () => void) {
        callback();
    }
}

class FakeAudio implements DrillAudioPort {
    available = true;
    cues: { cue: DrillCue; at: number; end: number }[] = [];
    cancelled = 0;
    closed = 0;
    pending: { cue: DrillCue; at: number; end: number }[] = [];
    handler: (() => void) | undefined;
    get scheduleEvidence() {
        return this.cues.map(({ cue, at }) => ({ cue, expectedStart: at, scheduledStart: at, deviationSeconds: 0 }));
    }
    schedule(cue: DrillCue, at: number): ScheduledCue {
        if (!this.available) throw new Error("Audio unavailable");
        const end = at + CUE_DURATION[cue];
        this.cues.push({ cue, at, end });
        this.pending.push({ cue, at, end });
        return { start: at, end };
    }
    cancel() {
        this.cancelled++;
        this.pending = [];
    }
    close() {
        this.closed++;
        this.available = false;
    }
    onUnavailable(handler: () => void) {
        this.handler = handler;
    }
    fail() {
        this.available = false;
        this.handler?.();
    }
}

function make(config = configuration, random: () => number = () => 0) {
    const clock = new FakeClock();
    const audio = new FakeAudio();
    const run = new DrillRun(config, clock, audio, random);
    run.start();
    return { clock, audio, run };
}

void test("stop cancels scheduled audio and wakes without publishing a false completion", () => {
    const config = { ...configuration, restSeconds: 0, repetitions: 1, randomStartEnabled: false };
    const { clock, audio, run } = make(config);
    const displays: DrillDisplay[] = [];
    run.subscribe((display) => displays.push(display));
    const staleWake = [...clock.callbacks.values()][0];
    const scheduledCues = audio.cues.length;

    assert.ok(staleWake);
    assert.ok(scheduledCues > 0);
    run.stop();

    assert.ok(audio.cancelled > 0);
    assert.equal(audio.closed, 1);
    assert.equal(audio.pending.length, 0);
    assert.equal(clock.callbacks.size, 0);
    clock.advance(100);
    staleWake();

    assert.equal(audio.cues.length, scheduledCues);
    assert.equal(displays.length, 1);
    assert.ok(displays.every(({ phase }) => phase !== null));
});

void test("scheduled cues keep exact boundaries and a full wait after the second Standby sound", () => {
    const { audio, clock, run } = make();
    assert.deepEqual(
        audio.cues.slice(0, 4).map(({ cue }) => cue),
        ["standby-first", "standby-second", "exercise", "rest"],
    );
    assert.equal(audio.cues[0].at, 0);
    assert.equal(audio.cues[1].at, audio.cues[0].end);
    assert.equal(audio.cues[0].end, 0.3);
    assert.ok(Math.abs(audio.cues[1].end - 0.45) < 0.001);
    assert.ok(Math.abs(audio.cues[2].at - (audio.cues[1].end + 1)) < 0.2);
    assert.equal(audio.cues[3].at, audio.cues[2].at + 4);
    assert.ok(Math.abs(audio.cues[3].end - audio.cues[3].at - 0.35) < 0.001);
    clock.advance(5.8); // One callback crosses Standby and exercise boundaries.
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "rest", durationSeconds: 2, repetition: 1 });
    assert.ok(Math.abs(audio.cues[3].at - 5.45) <= 0.2);
    clock.advance(7.45);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "standby", repetition: 2 });
    assert.equal(audio.cues.filter(({ cue }) => cue === "standby-first").length, 2);
    // This compares requested Web Audio times, not physical speaker emission.
});

void test("next repetition cues are queued before rest ends and survive a delayed callback", () => {
    const { audio, clock, run } = make();
    clock.advance(5.45);
    run.tick();
    const nextStandby = audio.cues.filter(({ cue }) => cue === "standby-first")[1];
    const nextExercise = audio.cues.filter(({ cue }) => cue === "exercise")[1];
    const nextRest = audio.cues.filter(({ cue }) => cue === "rest")[1];
    assert.ok(nextStandby);
    assert.ok(nextExercise);
    assert.ok(nextRest);
    assert.ok(Math.abs(nextStandby.at - 7.45) < 0.001);
    assert.ok(Math.abs(nextExercise.at - (audio.cues.filter(({ cue }) => cue === "standby-second")[1].end + 1)) < 0.001);
    assert.ok(Math.abs(nextRest.at - (nextExercise.at + 4)) < 0.001);
    clock.advance(8);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "standby", repetition: 2 });
    assert.equal(audio.cues.filter(({ cue }) => cue === "standby-first").length, 2);
});

void test("the first exercise and rest cues are queued before preparation ends", () => {
    const { audio, clock, run } = make({ ...configuration, preparationSeconds: 5, randomStartEnabled: false });
    assert.deepEqual(
        audio.cues.map(({ cue, at }) => ({ cue, at })),
        [
            { cue: "exercise", at: 5 },
            { cue: "rest", at: 9 },
        ],
    );
    clock.advance(5.3);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "exercise", durationSeconds: 4, repetition: 1 });
    assert.equal(audio.cues.filter(({ cue }) => cue === "exercise").length, 1);
});

void test("each repetition receives a fresh centisecond sample", () => {
    let index = 0;
    const samples = [0, 0.5, 1 - Number.EPSILON];
    const { audio, clock, run } = make(configuration, () => samples[index++]);
    assert.equal(index, 1);
    clock.advance(7.45);
    run.tick();
    assert.equal(index, 2);
    clock.advance(audio.cues.filter(({ cue }) => cue === "rest")[1].at + 2);
    run.tick();
    assert.equal(index, 3);
    const standbyEnds = audio.cues.filter(({ cue }) => cue === "standby-second").map(({ end }) => end);
    const exerciseStarts = audio.cues.filter(({ cue }) => cue === "exercise").map(({ at }) => at);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(exerciseStarts[i] - standbyEnds[i] - [1, 3, 5][i]) < 0.2);
});

void test("zero preparation and rest schedule no rest cues; positive final rest stays", () => {
    const withoutRest = make({ ...configuration, restSeconds: 0, repetitions: 1 });
    assert.equal(withoutRest.audio.cues.filter(({ cue }) => cue === "rest").length, 0);
    const withRest = make({ ...configuration, repetitions: 1 });
    assert.equal(withRest.audio.cues.filter(({ cue }) => cue === "rest").length, 1);
    const finalCue = withRest.audio.cues.at(-1);
    assert.ok(finalCue);
    withRest.clock.advance(finalCue.at + 2);
    withRest.run.tick();
    assert.equal(withRest.run.display.phase, null);
});

void test("audio failure before and after the second sound preserves the correct wait", () => {
    const early = make();
    early.clock.advance(0.2);
    early.audio.fail();
    assert.deepEqual(early.run.display.phase, { kind: "standby", repetition: 1 });
    early.clock.advance(1.19);
    early.run.tick();
    assert.deepEqual(early.run.display.phase, { kind: "standby", repetition: 1 });
    early.clock.advance(1.2);
    early.run.tick();
    assert.equal(early.run.display.phase.kind, "exercise");

    const late = make();
    late.clock.advance(0.8);
    late.audio.fail();
    late.clock.advance(1.45);
    late.run.tick();
    assert.equal(late.run.display.phase?.kind, "exercise");
    assert.ok(late.audio.cancelled > 0);
});

void test("exercise and rest failure retain their remaining duration", () => {
    for (const at of [2, 5.5]) {
        const { clock, audio, run } = make();
        const before = run.display;
        clock.advance(at);
        run.tick();
        const phase = run.display.phase;
        audio.fail();
        assert.deepEqual(run.display.phase, phase);
        const remaining = run.display.remainingSeconds;
        assert.ok(remaining !== null && remaining <= (phase?.kind === "rest" ? 2 : 4));
        assert.notDeepEqual(before.phase, phase);
    }
});

void test("hide cancels cues, freezes, and resume from repetition 2 or final keeps target", () => {
    for (const repetition of [2, 3]) {
        const { clock, audio, run } = make({ ...configuration, preparationSeconds: 2 });
        clock.advance(2);
        run.tick();
        while (audio.cues.filter(({ cue }) => cue === "exercise").length < repetition) {
            const lastRest = audio.cues.filter(({ cue }) => cue === "rest").at(-1);
            assert.ok(lastRest);
            clock.advance(lastRest.at + 2);
            run.tick();
        }
        const target = audio.cues.filter(({ cue }) => cue === "exercise")[repetition - 1];
        clock.advance(target.at + 0.5);
        run.tick();
        const stale = [...clock.callbacks.values()][0];
        run.hide();
        assert.equal(run.display.paused, true);
        assert.ok(audio.cancelled > 0);
        assert.equal(audio.pending.length, 0);
        clock.advance(100);
        assert.ok(stale);
        clock.fireStale(stale);
        assert.equal(run.display.phase && "repetition" in run.display.phase ? run.display.phase.repetition : null, repetition);
        run.resume();
        assert.equal(run.display.phase?.kind, "preparation");
        clock.advance(102);
        run.tick();
        assert.deepEqual(run.display.phase, { kind: "standby", repetition });
    }
});

void test("hidden Standby resumes through preparation to the same repetition", () => {
    const { clock, audio, run } = make({ ...configuration, preparationSeconds: 2 });
    clock.advance(2);
    run.tick();
    const firstRest = audio.cues.find(({ cue }) => cue === "rest");
    assert.ok(firstRest);
    clock.advance(firstRest.at + 2);
    run.tick();
    const target = audio.cues.filter(({ cue }) => cue === "standby-first")[1];
    clock.advance(target.at + 0.1);
    run.tick();
    run.hide();
    run.resume();
    assert.deepEqual(run.display.phase, { kind: "preparation", durationSeconds: 2 });
    clock.advance(target.at + 2.1);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "standby", repetition: 2 });
});

void test("interrupted preparation and rest retain remaining time without replaying a cue", () => {
    const { clock, audio, run } = make({ ...configuration, preparationSeconds: 2 });
    clock.advance(0.75);
    run.hide();
    clock.advance(20);
    run.resume();
    assert.equal(run.display.phase?.kind, "preparation");
    clock.advance(21.24);
    run.tick();
    assert.equal(run.display.phase.kind, "preparation");
    clock.advance(21.25);
    run.tick();
    assert.equal(run.display.phase.kind, "standby");

    const restCue = audio.cues.filter(({ cue }) => cue === "rest").at(-1);
    assert.ok(restCue);
    const restStart = restCue.at;
    clock.advance(restStart + 0.5);
    run.tick();
    run.hide();
    clock.advance(100);
    const resumeAt = clock.now();
    run.resume();
    assert.deepEqual(run.display.phase, { kind: "rest", durationSeconds: 2, repetition: 1 });
    assert.equal(audio.cues.filter(({ cue, at }) => cue === "rest" && at === resumeAt).length, 0);
    clock.advance(101.49);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "rest", durationSeconds: 2, repetition: 1 });
    clock.advance(101.5);
    run.tick();
    assert.deepEqual(run.display.phase, { kind: "standby", repetition: 2 });
});

void test("100 repetitions do not sample or schedule beyond the current repetition", () => {
    let samples = 0;
    const { audio } = make({ ...configuration, repetitions: 100 }, () => {
        samples++;
        return 0;
    });
    assert.equal(samples, 1);
    assert.equal(audio.cues.length, 4);
});

void test("Resume restores cues after audio interruption in either visibility event order", async () => {
    for (const audioFailsFirst of [true, false]) {
        const { clock, audio, run } = make({ ...configuration, preparationSeconds: 2 });
        clock.advance(4);
        run.tick();
        if (audioFailsFirst) audio.fail();
        run.hide();
        if (!audioFailsFirst) audio.fail();
        assert.equal(run.display.audioAvailable, false);
        clock.advance(100);
        const recovered = new FakeAudio();
        let called = false;
        const recovery = run.resumeWithAudio(() => {
            called = true;
            return Promise.resolve(recovered);
        });
        assert.equal(called, true, "audio creation starts in the gesture call stack");
        assert.equal(run.display.paused, true, "wait for audio before advancing the timeline");
        await recovery;
        assert.equal(run.display.audioAvailable, true);
        assert.equal(run.display.paused, false);
        assert.equal(audio.closed, 1);
        assert.equal(recovered.cues[0].cue, "standby-first");
        assert.equal(recovered.cues[0].at, 102);
        clock.advance(102);
        run.tick();
        assert.deepEqual(run.display.phase, { kind: "standby", repetition: 1 });
        audio.fail();
        assert.equal(run.display.audioAvailable, true, "retired context notifications cannot silence replacement");
        run.stop();
    }
});

void test("repeated lock and Resume replace audio each time", async () => {
    const { clock, run } = make();
    for (const at of [100, 200, 300]) {
        run.hide();
        clock.advance(at);
        const replacement = new FakeAudio();
        await run.resumeWithAudio(() => Promise.resolve(replacement));
        assert.equal(run.display.audioAvailable, true);
        assert.equal(replacement.cues[0].at, at);
        assert.equal(replacement.cues[0].cue, "standby-first");
    }
    run.stop();
});

void test("failed audio recovery still resumes silently", async () => {
    for (const createAudio of [() => Promise.resolve(null), () => Promise.reject(new Error("blocked"))]) {
        const { audio, run } = make();
        run.hide();
        await run.resumeWithAudio(createAudio);
        assert.equal(run.display.paused, false);
        assert.equal(run.display.audioAvailable, false);
        assert.equal(audio.closed, 1);
        run.stop();
    }
});

void test("duplicate Resume actions only create one context", async () => {
    const { run } = make();
    run.hide();
    const recovered = new FakeAudio();
    let resolveAudio!: (audio: DrillAudioPort) => void;
    const pending = new Promise<DrillAudioPort>((resolve) => {
        resolveAudio = resolve;
    });
    const first = run.resumeWithAudio(() => pending);
    await run.resumeWithAudio(() => {
        assert.fail("duplicate recovery must not acquire audio");
    });
    resolveAudio(recovered);
    await first;
    assert.equal(run.display.paused, false);
    run.stop();
});

void test("hide or stop during recovery closes late audio without resuming", async () => {
    for (const action of ["hide", "stop"] as const) {
        const { run } = make();
        run.hide();
        let resolveAudio!: (audio: DrillAudioPort) => void;
        const pending = new Promise<DrillAudioPort>((resolve) => {
            resolveAudio = resolve;
        });
        const recovery = run.resumeWithAudio(() => pending);
        run[action]();
        const late = new FakeAudio();
        resolveAudio(late);
        await recovery;
        assert.equal(late.closed, 1);
        assert.equal(late.cues.length, 0);
        if (action === "hide") {
            assert.equal(run.display.paused, true);
            await run.resumeWithAudio(() => Promise.resolve(new FakeAudio()));
            assert.equal(run.display.paused, false);
        }
        run.stop();
    }
});

void test("a newer recovery survives an older result arriving last", async () => {
    const { run } = make();
    run.hide();
    let resolveOld!: (audio: DrillAudioPort) => void;
    const oldAttempt = run.resumeWithAudio(
        () =>
            new Promise<DrillAudioPort>((resolve) => {
                resolveOld = resolve;
            }),
    );
    run.hide();
    const current = new FakeAudio();
    await run.resumeWithAudio(() => Promise.resolve(current));
    const old = new FakeAudio();
    resolveOld(old);
    await oldAttempt;
    assert.equal(old.closed, 1);
    assert.equal(current.closed, 0);
    assert.equal(run.display.audioAvailable, true);
    run.stop();
});

void test("rest recovery keeps remaining time and does not replay rest cue", async () => {
    const { clock, audio, run } = make();
    const rest = audio.cues.find(({ cue }) => cue === "rest");
    assert.ok(rest);
    clock.advance(rest.at + 0.5);
    run.tick();
    run.hide();
    audio.fail();
    clock.advance(100);
    const recovered = new FakeAudio();
    await run.resumeWithAudio(() => Promise.resolve(recovered));
    assert.equal(run.display.phase?.kind, "rest");
    assert.equal(
        recovered.cues.some(({ cue, at }) => cue === "rest" && at === 100),
        false,
    );
    assert.equal(recovered.cues[0].cue, "standby-first");
    assert.equal(recovered.cues[0].at, 101.5);
    run.stop();
});

void test("schedule evidence includes original and successive recovered ports", async () => {
    const { audio, clock, run } = make();
    const ports = [audio];
    for (const at of [100, 200]) {
        run.hide();
        clock.advance(at);
        const recovered = new FakeAudio();
        await run.resumeWithAudio(() => Promise.resolve(recovered));
        ports.push(recovered);
        assert.deepEqual(
            run.scheduleEvidence,
            ports.flatMap((port) => port.scheduleEvidence),
        );
    }
    run.stop();
});

void test("pause and resume never publish phase:null as a false completion", () => {
    for (const randomStartEnabled of [false, true]) {
        const clock = new FakeClock();
        const audio = new FakeAudio();
        const displays: DrillDisplay[] = [];
        const run = new DrillRun(
            { ...configuration, randomStartEnabled },
            clock,
            audio,
            () => 0,
            (display) => displays.push(display),
        );
        run.start();
        clock.advance(randomStartEnabled ? 0.1 : 1);
        run.tick();
        const activePhase = run.display.phase;
        assert.ok(activePhase);
        displays.length = 0;

        run.hide();
        assert.equal(run.display.paused, true);
        assert.deepEqual(run.display.phase, activePhase);
        assert.equal(
            displays.some(({ phase }) => phase === null),
            false,
        );

        run.resume();
        assert.ok(run.display.phase);
        run.stop();
    }
});
