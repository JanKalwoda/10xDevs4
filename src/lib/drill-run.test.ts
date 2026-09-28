import assert from "node:assert/strict";
import test from "node:test";

import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "./drill-audio.ts";
import { DrillRun, type DrillClock } from "./drill-run.ts";
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
    pending: { cue: DrillCue; at: number; end: number }[] = [];
    handler: (() => void) | undefined;
    schedule(cue: DrillCue, at: number): ScheduledCue {
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
