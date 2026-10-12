import assert from "node:assert/strict";
import test from "node:test";

import { buildPhaseSections, currentPhaseBody, nextPhaseBody } from "./drill-phase-sections.ts";
import { DrillRun, type DrillClock } from "./drill-run.ts";
import type { DrillConfiguration } from "../types.ts";

// Oracle: PRD US-01, US-02, FR-001, FR-002, FR-018 and the Standby guardrail. Every expectation below is a literal
// from the PRD (order of phases, full configured times, "Repetition X of N", Next preview), never read from the code.

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

/** Scripted draws taken from the ends of the PRD range: 0 gives a 1.00 s wait, 0.999 gives 5.00 s. */
const SHORT_WAIT = 0;
const LONG_WAIT = 0.999;

function scriptedRandom(values: number[]) {
    const state = { calls: 0 };
    const random = () => {
        const value = values[state.calls];
        state.calls++;
        assert.notEqual(value, undefined, `unexpected random draw #${state.calls}`);
        return value;
    };
    return { random, state };
}

function makeRun(configuration: DrillConfiguration, draws: number[] = []) {
    const clock = new FakeClock();
    const { random, state } = scriptedRandom(draws);
    const run = new DrillRun(configuration, clock, null, random);
    run.start();
    return { clock, run, draws: state };
}

/** Moves the fake clock in quarter-second ticks, like wake-ups would, so phase boundaries are never skipped. */
function goTo(clock: FakeClock, run: DrillRun, seconds: number) {
    while (clock.time < seconds) {
        clock.time = Math.min(seconds, clock.time + 0.25);
        run.tick();
    }
}

interface View {
    main: string;
    repetition: string | null;
    current: string;
    next: string;
}

function viewOf(run: DrillRun, repetitions: number): View | null {
    const sections = buildPhaseSections(run.display, repetitions);
    if (!sections) return null;
    return {
        main: sections.main.kind === "standby" ? "standby" : sections.main.text,
        repetition: sections.repetition,
        current: currentPhaseBody(sections.current),
        next: nextPhaseBody(sections.next),
    };
}

interface Sample extends View {
    at: number;
}

function runSamples(configuration: DrillConfiguration, draws: number[], samples: Sample[]) {
    const { clock, run, draws: drawState } = makeRun(configuration, draws);
    for (const { at, ...expected } of samples) {
        goTo(clock, run, at);
        assert.deepEqual(viewOf(run, configuration.repetitions), expected, `view at t=${at}s`);
    }
    return { clock, run, draws: drawState };
}

function kindOf(run: DrillRun): string | undefined {
    return run.display.phase?.kind;
}

function config(overrides: Partial<DrillConfiguration>): DrillConfiguration {
    return { preparationSeconds: 1, exerciseSeconds: 1, restSeconds: 1, repetitions: 2, randomStartEnabled: false, ...overrides };
}

void test("drill with random start runs Preparation once, then Standby, Exercise and Rest per repetition and ends after the last Rest", () => {
    const configuration = config({ randomStartEnabled: true });
    const done = runSamples(
        configuration,
        [SHORT_WAIT, LONG_WAIT],
        [
            { at: 0, main: "0:01", repetition: "Repetition 1 of 2", current: "Preparation · 0:01", next: "Standby" },
            { at: 1, main: "standby", repetition: "Repetition 1 of 2", current: "Standby", next: "Exercise · 0:01" },
            { at: 2, main: "0:01", repetition: "Repetition 1 of 2", current: "Exercise · 0:01", next: "Rest · 0:01" },
            { at: 3, main: "0:01", repetition: "Repetition 1 of 2", current: "Rest · 0:01", next: "Standby" },
            { at: 4, main: "standby", repetition: "Repetition 2 of 2", current: "Standby", next: "Exercise · 0:01" },
            { at: 5, main: "standby", repetition: "Repetition 2 of 2", current: "Standby", next: "Exercise · 0:01" },
            { at: 8, main: "standby", repetition: "Repetition 2 of 2", current: "Standby", next: "Exercise · 0:01" },
            { at: 9, main: "0:01", repetition: "Repetition 2 of 2", current: "Exercise · 0:01", next: "Rest · 0:01" },
            { at: 10, main: "0:01", repetition: "Repetition 2 of 2", current: "Rest · 0:01", next: "Drill complete" },
        ],
    );
    goTo(done.clock, done.run, 11);
    assert.equal(done.run.display.phase, null, "the drill ends right after the last Rest");
    assert.equal(viewOf(done.run, 2), null);
    assert.equal(done.draws.calls, 2, "one random wait per Standby, none for Preparation");
});

void test("PRD example: 3 s into a 5 s Preparation the countdown shows 0:02 while Current stays 0:05 and Next is Exercise 0:04", () => {
    const configuration = config({ preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 2 });
    // [phase start, duration, current body, next body, repetition label]
    const phases = [
        { start: 0, duration: 5, current: "Preparation · 0:05", next: "Exercise · 0:04", repetition: "Repetition 1 of 2" },
        { start: 5, duration: 4, current: "Exercise · 0:04", next: "Rest · 0:02", repetition: "Repetition 1 of 2" },
        { start: 9, duration: 2, current: "Rest · 0:02", next: "Exercise · 0:04", repetition: "Repetition 1 of 2" },
        { start: 11, duration: 4, current: "Exercise · 0:04", next: "Rest · 0:02", repetition: "Repetition 2 of 2" },
        { start: 15, duration: 2, current: "Rest · 0:02", next: "Drill complete", repetition: "Repetition 2 of 2" },
    ];
    const { clock, run } = makeRun(configuration);
    for (const phase of phases)
        for (let offset = 0; offset < phase.duration; offset++) {
            goTo(clock, run, phase.start + offset);
            const remaining = phase.duration - offset;
            assert.deepEqual(viewOf(run, 2), { main: `0:0${remaining}`, repetition: phase.repetition, current: phase.current, next: phase.next }, `t=${phase.start + offset}s`);
        }
    goTo(clock, run, 17);
    assert.equal(run.display.phase, null);
});

void test("Preparation 0 s and Rest 0 s are skipped: the drill is Exercise after Exercise and the last Exercise announces the end", () => {
    const configuration = config({ preparationSeconds: 0, restSeconds: 0, exerciseSeconds: 2 });
    const { clock, run } = runSamples(
        configuration,
        [],
        [
            { at: 0, main: "0:02", repetition: "Repetition 1 of 2", current: "Exercise · 0:02", next: "Exercise · 0:02" },
            { at: 1, main: "0:01", repetition: "Repetition 1 of 2", current: "Exercise · 0:02", next: "Exercise · 0:02" },
            { at: 2, main: "0:02", repetition: "Repetition 2 of 2", current: "Exercise · 0:02", next: "Drill complete" },
            { at: 3, main: "0:01", repetition: "Repetition 2 of 2", current: "Exercise · 0:02", next: "Drill complete" },
        ],
    );
    goTo(clock, run, 4);
    assert.equal(run.display.phase, null);
});

void test("Rest 0 s with random start: Standby follows each Exercise and the last Exercise announces the end", () => {
    const configuration = config({ preparationSeconds: 0, restSeconds: 0, exerciseSeconds: 2, randomStartEnabled: true });
    const done = runSamples(
        configuration,
        [SHORT_WAIT, LONG_WAIT],
        [
            { at: 0, main: "standby", repetition: "Repetition 1 of 2", current: "Standby", next: "Exercise · 0:02" },
            { at: 1, main: "0:02", repetition: "Repetition 1 of 2", current: "Exercise · 0:02", next: "Standby" },
            { at: 2, main: "0:01", repetition: "Repetition 1 of 2", current: "Exercise · 0:02", next: "Standby" },
            { at: 3, main: "standby", repetition: "Repetition 2 of 2", current: "Standby", next: "Exercise · 0:02" },
            { at: 7, main: "standby", repetition: "Repetition 2 of 2", current: "Standby", next: "Exercise · 0:02" },
            { at: 8, main: "0:02", repetition: "Repetition 2 of 2", current: "Exercise · 0:02", next: "Drill complete" },
            { at: 9, main: "0:01", repetition: "Repetition 2 of 2", current: "Exercise · 0:02", next: "Drill complete" },
        ],
    );
    goTo(done.clock, done.run, 10);
    assert.equal(done.run.display.phase, null);
    assert.equal(done.draws.calls, 2);
});

void test("Exercise always lasts its full time whatever the Standby wait was", () => {
    for (const wait of [SHORT_WAIT, LONG_WAIT]) {
        const { clock, run } = makeRun(config({ preparationSeconds: 0, exerciseSeconds: 3, randomStartEnabled: true }), [wait, wait]);
        const exerciseStart = wait === SHORT_WAIT ? 1 : 5;
        goTo(clock, run, exerciseStart - 0.25);
        assert.equal(kindOf(run), "standby");
        goTo(clock, run, exerciseStart);
        assert.equal(viewOf(run, 2)?.main, "0:03", `wait ${wait}`);
        goTo(clock, run, exerciseStart + 2.75);
        assert.equal(kindOf(run), "exercise", `wait ${wait}`);
        goTo(clock, run, exerciseStart + 3);
        assert.equal(kindOf(run), "rest", `wait ${wait}`);
    }
});

void test("Standby shows no time anywhere, and a 1.00 s and a 5.00 s wait look identical until the short one ends", () => {
    const MSS = /\d+:\d\d/;
    const configuration = config({ preparationSeconds: 1, randomStartEnabled: true });
    const short = makeRun(configuration, [SHORT_WAIT, SHORT_WAIT]);
    const long = makeRun(configuration, [LONG_WAIT, LONG_WAIT]);
    for (const offset of [0, 0.25, 0.5, 0.75]) {
        for (const { clock, run } of [short, long]) goTo(clock, run, 1 + offset);
        for (const { run } of [short, long]) {
            assert.equal(kindOf(run), "standby", `offset ${offset}`);
            assert.equal(run.display.remainingSeconds, null, `offset ${offset}`);
            const view = viewOf(run, 2);
            assert.ok(view);
            assert.equal(view.main, "standby");
            assert.equal(view.current, "Standby");
            assert.ok(!MSS.test(view.current), "no time in Current");
        }
        assert.equal(JSON.stringify(short.run.display), JSON.stringify(long.run.display), `offset ${offset}`);
        assert.deepEqual(viewOf(short.run, 2), viewOf(long.run, 2), `offset ${offset}`);
    }
    for (const { clock, run } of [short, long]) goTo(clock, run, 2);
    assert.equal(kindOf(short.run), "exercise", "the 1.00 s wait ended");
    assert.equal(kindOf(long.run), "standby", "the 5.00 s wait is still running");
});

// Phase 2 oracle: PRD FR-006 and Business Logic. Resuming from Standby or Exercise adds a full Preparation and restarts
// the same repetition with a new random draw; Preparation and Rest continue with their remaining time.

function keyOf(run: DrillRun): string {
    const phase = run.display.phase;
    if (!phase) return "end";
    return "repetition" in phase ? `${phase.kind}#${phase.repetition}` : phase.kind;
}

/** Ticks in quarter seconds up to `until` and appends every change of phase to `seen`. */
function drive(clock: FakeClock, run: DrillRun, until: number, seen: string[]) {
    const note = () => {
        const key = keyOf(run);
        if (seen[seen.length - 1] !== key) seen.push(key);
    };
    note();
    while (clock.time < until) {
        clock.time = Math.min(until, clock.time + 0.25);
        run.tick();
        note();
    }
}

interface PauseCase {
    name: string;
    configuration: DrillConfiguration;
    draws: number[];
    pauseAt: number;
    /** Phase and view the paused run must keep showing. */
    paused: { key: string; main: string };
    sequence: string[];
    drawsTotal: number;
}

const pauseCases: PauseCase[] = [
    {
        name: "pause in Exercise repetition 2 restarts it after a full Preparation with a new Standby draw",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 3, randomStartEnabled: true }),
        draws: [SHORT_WAIT, SHORT_WAIT, LONG_WAIT, SHORT_WAIT],
        pauseAt: 10,
        paused: { key: "exercise#2", main: "0:02" },
        sequence: [
            "preparation",
            "standby#1",
            "exercise#1",
            "rest#1",
            "standby#2",
            "exercise#2",
            "preparation",
            "standby#2",
            "exercise#2",
            "rest#2",
            "standby#3",
            "exercise#3",
            "rest#3",
            "end",
        ],
        drawsTotal: 4,
    },
    {
        name: "pause in Standby repetition 2 restarts it after a full Preparation with a new Standby draw",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 3, randomStartEnabled: true }),
        draws: [SHORT_WAIT, SHORT_WAIT, LONG_WAIT, SHORT_WAIT],
        pauseAt: 8.5,
        paused: { key: "standby#2", main: "standby" },
        sequence: ["preparation", "standby#1", "exercise#1", "rest#1", "standby#2", "preparation", "standby#2", "exercise#2", "rest#2", "standby#3", "exercise#3", "rest#3", "end"],
        drawsTotal: 4,
    },
    {
        name: "pause in Exercise repetition 2 without random start restarts the same Exercise after a full Preparation",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 3 }),
        draws: [],
        pauseAt: 8,
        paused: { key: "exercise#2", main: "0:02" },
        sequence: ["preparation", "exercise#1", "rest#1", "exercise#2", "preparation", "exercise#2", "rest#2", "exercise#3", "rest#3", "end"],
        drawsTotal: 0,
    },
    {
        name: "pause in the last Exercise keeps the finished repetitions and ends after the last Rest",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 2 }),
        draws: [],
        pauseAt: 8,
        paused: { key: "exercise#2", main: "0:02" },
        sequence: ["preparation", "exercise#1", "rest#1", "exercise#2", "preparation", "exercise#2", "rest#2", "end"],
        drawsTotal: 0,
    },
    {
        name: "Preparation 0 s: pause in Exercise repetition 2 without random start resumes straight into the full Exercise",
        configuration: config({ preparationSeconds: 0, exerciseSeconds: 3, restSeconds: 2, repetitions: 2 }),
        draws: [],
        pauseAt: 6,
        paused: { key: "exercise#2", main: "0:02" },
        sequence: ["exercise#1", "rest#1", "exercise#2", "rest#2", "end"],
        drawsTotal: 0,
    },
    {
        name: "Preparation 0 s: pause in Exercise repetition 2 with random start resumes into a Standby with a new draw",
        configuration: config({ preparationSeconds: 0, exerciseSeconds: 3, restSeconds: 2, repetitions: 2, randomStartEnabled: true }),
        draws: [SHORT_WAIT, SHORT_WAIT, LONG_WAIT],
        pauseAt: 8,
        paused: { key: "exercise#2", main: "0:02" },
        sequence: ["standby#1", "exercise#1", "rest#1", "standby#2", "exercise#2", "standby#2", "exercise#2", "rest#2", "end"],
        drawsTotal: 3,
    },
    {
        name: "pause in Rest keeps the remaining Rest time and then continues with the next repetition",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 2 }),
        draws: [],
        pauseAt: 6,
        paused: { key: "rest#1", main: "0:01" },
        sequence: ["preparation", "exercise#1", "rest#1", "exercise#2", "rest#2", "end"],
        drawsTotal: 0,
    },
    {
        name: "pause in Preparation keeps the remaining Preparation time",
        configuration: config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 2 }),
        draws: [],
        pauseAt: 1,
        paused: { key: "preparation", main: "0:01" },
        sequence: ["preparation", "exercise#1", "rest#1", "exercise#2", "rest#2", "end"],
        drawsTotal: 0,
    },
];

for (const pauseCase of pauseCases)
    void test(pauseCase.name, () => {
        const { configuration } = pauseCase;
        const { clock, run, draws } = makeRun(configuration, pauseCase.draws);
        const seen: string[] = [];
        drive(clock, run, pauseCase.pauseAt, seen);
        run.hide();
        assert.equal(run.display.paused, true);
        assert.equal(keyOf(run), pauseCase.paused.key);
        assert.equal(viewOf(run, configuration.repetitions)?.main, pauseCase.paused.main);
        const drawsAtPause = draws.calls;
        clock.time = pauseCase.pauseAt + 40; // time spent paused counts for nothing
        run.tick();
        assert.equal(keyOf(run), pauseCase.paused.key, "nothing moves while paused");
        assert.equal(draws.calls, drawsAtPause, "no draw while paused");
        run.resume();
        assert.equal(run.display.paused, false);
        drive(clock, run, clock.time + 40, seen);
        assert.deepEqual(seen, pauseCase.sequence);
        assert.equal(draws.calls, pauseCase.drawsTotal);
    });

void test("after resume from Exercise: Preparation shows the resumed repetition, the new 5.00 s Standby shows no time, then the full Exercise", () => {
    const configuration = config({ preparationSeconds: 2, exerciseSeconds: 3, restSeconds: 2, repetitions: 3, randomStartEnabled: true });
    const { clock, run, draws } = makeRun(configuration, [SHORT_WAIT, SHORT_WAIT, LONG_WAIT, SHORT_WAIT]);
    goTo(clock, run, 10); // one second into Exercise repetition 2
    run.hide();
    clock.time = 14;
    run.resume();
    const at = (offset: number) => {
        goTo(clock, run, 14 + offset);
        return viewOf(run, 3);
    };
    assert.deepEqual(at(0), { main: "0:02", repetition: "Repetition 2 of 3", current: "Preparation · 0:02", next: "Standby" });
    assert.equal(draws.calls, 2, "the new draw happens when Standby starts, not at resume");
    for (const offset of [2, 3, 4, 5, 6])
        assert.deepEqual(at(offset), { main: "standby", repetition: "Repetition 2 of 3", current: "Standby", next: "Exercise · 0:03" }, `+${offset}s`);
    assert.equal(draws.calls, 3);
    assert.deepEqual(at(7), { main: "0:03", repetition: "Repetition 2 of 3", current: "Exercise · 0:03", next: "Rest · 0:02" });
    assert.deepEqual(at(9), { main: "0:01", repetition: "Repetition 2 of 3", current: "Exercise · 0:03", next: "Rest · 0:02" });
    assert.deepEqual(at(10), { main: "0:02", repetition: "Repetition 2 of 3", current: "Rest · 0:02", next: "Standby" });
});
