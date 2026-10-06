import assert from "node:assert/strict";
import test from "node:test";

import { buildPhaseSections, formatPhaseTime, initialDrillDisplay } from "./drill-phase-sections.ts";
import { DrillRun, type DrillClock, type DrillDisplay } from "./drill-run.ts";
import type { DrillConfiguration, DrillPhase } from "../types.ts";

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

const MSS = /\d+:\d\d/;

function config(overrides: Partial<DrillConfiguration> = {}): DrillConfiguration {
    return { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: false, ...overrides };
}

function makeRun(configuration: DrillConfiguration, random: () => number = () => 0.5) {
    const clock = new FakeClock();
    const run = new DrillRun(configuration, clock, null, random);
    run.start();
    return { clock, run };
}

function advance(clock: FakeClock, run: DrillRun, seconds: number) {
    const end = clock.time + seconds;
    while (clock.time < end - 1e-9) {
        clock.time = Math.min(end, clock.time + 0.05);
        run.tick();
    }
}

function phaseOf(run: DrillRun): DrillPhase | null {
    return run.display.phase;
}

function key(phase: DrillPhase): string {
    return "repetition" in phase ? `${phase.kind}#${phase.repetition}` : phase.kind;
}

function same(a: DrillPhase | null, b: DrillPhase | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

void test("sections follow the PRD example: exercise 4 s with rest 2 s next", () => {
    const display: DrillDisplay = {
        phase: { kind: "exercise", durationSeconds: 4, repetition: 1 },
        remainingSeconds: 3,
        next: { kind: "rest", durationSeconds: 2, repetition: 1 },
        paused: false,
        audioAvailable: true,
    };
    const sections = buildPhaseSections(display, 3);
    assert.deepEqual(sections, {
        main: { kind: "time", text: "0:03" },
        current: { name: "Exercise", time: "0:04", detail: "Repetition 1 of 3" },
        next: { kind: "phase", name: "Rest", time: "0:02" },
    });
    assert.equal(buildPhaseSections({ ...display, remainingSeconds: 1 }, 3)?.current.time, "0:04", "current time is fixed while the main countdown moves");
});

void test("sections for every current → next pair", () => {
    const exercise: DrillPhase = { kind: "exercise", durationSeconds: 90, repetition: 2 };
    const base = { remainingSeconds: 10, paused: false, audioAvailable: true };
    assert.deepEqual(buildPhaseSections({ ...base, phase: { kind: "preparation", durationSeconds: 5 }, next: { kind: "standby", repetition: 1 } }, 3), {
        main: { kind: "time", text: "0:10" },
        current: { name: "Preparation", time: "0:05", detail: "Preparing" },
        next: { kind: "phase", name: "Standby", time: null },
    });
    assert.deepEqual(buildPhaseSections({ ...base, phase: { kind: "standby", repetition: 2 }, remainingSeconds: null, next: exercise }, 3), {
        main: { kind: "standby" },
        current: { name: "Standby", time: "Standby", detail: "Repetition 2 of 3" },
        next: { kind: "phase", name: "Exercise", time: "1:30" },
    });
    assert.deepEqual(buildPhaseSections({ ...base, phase: { kind: "rest", durationSeconds: 2, repetition: 3 }, next: null }, 3)?.next, { kind: "end" });
    assert.equal(buildPhaseSections({ ...base, phase: null, next: null }, 3), null);
    assert.equal(formatPhaseTime(600), "10:00");
});

void test("initial display shows the first real phase and its successor", () => {
    assert.deepEqual(initialDrillDisplay(config()).next, { kind: "exercise", durationSeconds: 4, repetition: 1 });
    assert.deepEqual(initialDrillDisplay(config({ preparationSeconds: 0 })).phase, { kind: "exercise", durationSeconds: 4, repetition: 1 });
    assert.deepEqual(initialDrillDisplay(config({ randomStartEnabled: true })).next, { kind: "standby", repetition: 1 });
    const standbyFirst = initialDrillDisplay(config({ preparationSeconds: 0, randomStartEnabled: true }));
    assert.deepEqual(standbyFirst.phase, { kind: "standby", repetition: 1 });
    assert.equal(standbyFirst.remainingSeconds, null);
    assert.deepEqual(standbyFirst.next, { kind: "exercise", durationSeconds: 4, repetition: 1 });
    assert.equal(initialDrillDisplay(config({ preparationSeconds: 0, repetitions: 1, restSeconds: 0 })).next, null);
});

void test("next equals the phase a real DrillRun shows afterwards, for every combination", () => {
    for (const preparationSeconds of [0, 3])
        for (const restSeconds of [0, 2])
            for (const randomStartEnabled of [false, true])
                for (const repetitions of [1, 3]) {
                    const label = JSON.stringify({ preparationSeconds, restSeconds, randomStartEnabled, repetitions });
                    const { clock, run } = makeRun(config({ preparationSeconds, restSeconds, randomStartEnabled, repetitions }));
                    const seen: { phase: DrillPhase; next: DrillPhase | null }[] = [];
                    while (run.display.phase && clock.time < 600) {
                        const { phase, next } = run.display;
                        if (!seen.length || key(seen[seen.length - 1].phase) !== key(phase)) seen.push({ phase, next });
                        advance(clock, run, 0.05);
                    }
                    assert.ok(seen.length >= repetitions, label);
                    seen.forEach((entry, index) => {
                        const following = seen[index + 1]?.phase ?? null;
                        assert.ok(same(entry.next, following), `${label}: after ${key(entry.phase)} expected ${JSON.stringify(following)}, got ${JSON.stringify(entry.next)}`);
                    });
                    const kinds = seen.map(({ phase }) => phase.kind);
                    assert.equal(kinds.includes("preparation"), preparationSeconds > 0, label);
                    assert.equal(kinds.includes("rest"), restSeconds > 0, label);
                    assert.equal(kinds.includes("standby"), randomStartEnabled, label);
                    assert.equal(seen[seen.length - 1].next, null, label);
                }
});

void test("after pause and resume the resume preparation points at the resumed repetition", () => {
    for (const randomStartEnabled of [false, true]) {
        const { clock, run } = makeRun(config({ randomStartEnabled }));
        advance(clock, run, 5); // preparation ends
        advance(clock, run, 1); // inside the first Standby or exercise
        run.hide();
        const target: DrillPhase = randomStartEnabled ? { kind: "standby", repetition: 1 } : { kind: "exercise", durationSeconds: 4, repetition: 1 };
        assert.ok(run.display.paused);
        run.resume();
        assert.deepEqual(run.display.phase, { kind: "preparation", durationSeconds: 5 });
        assert.ok(same(run.display.next, target), "resume preparation announces the resumed repetition");
        advance(clock, run, 2);
        run.hide(); // pause again during the resume preparation
        assert.ok(same(run.display.next, target), "paused resume preparation keeps the target");
        run.resume();
        assert.ok(same(run.display.next, target));
        advance(clock, run, 5.1);
        const resumed = phaseOf(run);
        assert.equal(key(resumed ?? target), key(target));
        assert.ok(resumed && "repetition" in resumed && resumed.repetition === 1);
    }
});

void test("resume keeps the repetition after earlier repetitions completed", () => {
    const { clock, run } = makeRun(config({ preparationSeconds: 2, restSeconds: 1, repetitions: 3 }));
    advance(clock, run, 2 + 4 + 1 + 1); // prep, exercise 1, rest 1, one second into exercise 2
    assert.equal(run.display.phase?.kind, "exercise");
    run.hide();
    run.resume();
    assert.deepEqual(run.display.next, { kind: "exercise", durationSeconds: 4, repetition: 2 });
});

void test("pause in rest or preparation, and resume without preparation, leave next correct", () => {
    const first = makeRun(config({ preparationSeconds: 0, restSeconds: 2 }));
    advance(first.clock, first.run, 4.5); // inside rest 1
    assert.equal(first.run.display.phase?.kind, "rest");
    const before = first.run.display.next;
    first.run.hide();
    assert.ok(same(first.run.display.next, before));
    assert.deepEqual(before, { kind: "exercise", durationSeconds: 4, repetition: 2 });
    first.run.resume();
    assert.ok(same(first.run.display.next, before));

    const prep = makeRun(config({ preparationSeconds: 5 }));
    advance(prep.clock, prep.run, 1);
    prep.run.hide();
    assert.deepEqual(prep.run.display.next, { kind: "exercise", durationSeconds: 4, repetition: 1 });
    prep.run.resume();
    assert.deepEqual(prep.run.display.next, { kind: "exercise", durationSeconds: 4, repetition: 1 });

    const noPrep = makeRun(config({ preparationSeconds: 0, randomStartEnabled: true }), () => 0.5);
    advance(noPrep.clock, noPrep.run, 1); // inside the first Standby wait
    assert.equal(noPrep.run.display.phase?.kind, "standby");
    noPrep.run.hide();
    noPrep.run.resume();
    assert.deepEqual(noPrep.run.display.phase, { kind: "standby", repetition: 1 });
    assert.deepEqual(noPrep.run.display.next, { kind: "exercise", durationSeconds: 4, repetition: 1 });
});

void test("Standby shows no time and display keys cannot carry the wait", () => {
    const { clock, run } = makeRun(config({ preparationSeconds: 0, randomStartEnabled: true }));
    advance(clock, run, 0.5);
    const display = run.display;
    assert.deepEqual(Object.keys(display).sort(), ["audioAvailable", "next", "paused", "phase", "remainingSeconds"]);
    assert.deepEqual(Object.keys(display.phase ?? {}).sort(), ["kind", "repetition"]);
    const sections = buildPhaseSections(display, 3);
    assert.ok(sections);
    assert.deepEqual(sections.main, { kind: "standby" });
    assert.equal(sections.current.time, "Standby");
    assert.ok(!MSS.test(`${sections.main.kind} ${sections.current.name} ${sections.current.time}`));
    const nextStandby = buildPhaseSections(initialDrillDisplay(config({ randomStartEnabled: true })), 3);
    assert.deepEqual(nextStandby?.next, { kind: "phase", name: "Standby", time: null });
});

void test("a 1 s and a 5 s Standby wait produce identical views until the wait ends", () => {
    const short = makeRun(config({ preparationSeconds: 0, randomStartEnabled: true }), () => 0);
    const long = makeRun(config({ preparationSeconds: 0, randomStartEnabled: true }), () => 1);
    for (let step = 0; step < 19; step++) {
        const a = short.run.display;
        const b = long.run.display;
        assert.equal(a.phase?.kind, "standby");
        assert.equal(JSON.stringify(a), JSON.stringify(b));
        assert.equal(JSON.stringify(buildPhaseSections(a, 3)), JSON.stringify(buildPhaseSections(b, 3)));
        advance(short.clock, short.run, 0.05);
        advance(long.clock, long.run, 0.05);
    }
    advance(short.clock, short.run, 0.2);
    advance(long.clock, long.run, 0.2);
    assert.equal(short.run.display.phase?.kind, "exercise", "the shorter wait ended");
    assert.equal(long.run.display.phase?.kind, "standby", "the longer wait is still running");
});
