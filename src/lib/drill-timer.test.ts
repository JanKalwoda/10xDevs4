import assert from "node:assert/strict";
import test from "node:test";

import { firstDrillPhase, nextDrillPhase, parseDrillConfig } from "./drill-timer.ts";
import type { DrillConfiguration, DrillPhase } from "../types";

const defaults: DrillConfiguration = {
    preparationSeconds: 5,
    exerciseSeconds: 4,
    restSeconds: 2,
    repetitions: 3,
};

function phases(configuration: DrillConfiguration): DrillPhase[] {
    const result: DrillPhase[] = [];
    let phase: DrillPhase | null = firstDrillPhase(configuration);
    while (phase !== null) {
        result.push(phase);
        phase = nextDrillPhase(configuration, phase);
    }
    return result;
}

void test("preparation happens once and the final positive rest completes the run", () => {
    assert.deepEqual(phases(defaults), [
        { kind: "preparation", durationSeconds: 5 },
        { kind: "exercise", durationSeconds: 4, repetition: 1 },
        { kind: "rest", durationSeconds: 2, repetition: 1 },
        { kind: "exercise", durationSeconds: 4, repetition: 2 },
        { kind: "rest", durationSeconds: 2, repetition: 2 },
        { kind: "exercise", durationSeconds: 4, repetition: 3 },
        { kind: "rest", durationSeconds: 2, repetition: 3 },
    ]);
});

void test("zero preparation and rest skip directly through exercise phases", () => {
    assert.deepEqual(phases({ ...defaults, preparationSeconds: 0, restSeconds: 0 }), [
        { kind: "exercise", durationSeconds: 4, repetition: 1 },
        { kind: "exercise", durationSeconds: 4, repetition: 2 },
        { kind: "exercise", durationSeconds: 4, repetition: 3 },
    ]);
});

void test("one repetition completes after its exercise or its positive rest", () => {
    assert.deepEqual(phases({ ...defaults, preparationSeconds: 0, restSeconds: 0, repetitions: 1 }), [{ kind: "exercise", durationSeconds: 4, repetition: 1 }]);
    assert.deepEqual(phases({ ...defaults, preparationSeconds: 0, repetitions: 1 }), [
        { kind: "exercise", durationSeconds: 4, repetition: 1 },
        { kind: "rest", durationSeconds: 2, repetition: 1 },
    ]);
});

void test("100 repetitions end at repetition 100", () => {
    const withoutRest = phases({ ...defaults, preparationSeconds: 0, restSeconds: 0, repetitions: 100 });
    assert.equal(withoutRest.length, 100);
    assert.deepEqual(withoutRest.at(-1), { kind: "exercise", durationSeconds: 4, repetition: 100 });

    const withRest = phases({ ...defaults, preparationSeconds: 0, repetitions: 100 });
    assert.equal(withRest.length, 200);
    assert.deepEqual(withRest.at(-1), { kind: "rest", durationSeconds: 2, repetition: 100 });
});

void test("valid m:ss boundaries parse into whole seconds", () => {
    assert.deepEqual(parseDrillConfig({ preparation: "0:00", exercise: "0:01", rest: "10:00", repetitions: "100" }), {
        valid: true,
        configuration: {
            preparationSeconds: 0,
            exerciseSeconds: 1,
            restSeconds: 600,
            repetitions: 100,
        },
    });
    assert.deepEqual(parseDrillConfig({ preparation: "10:00", exercise: "10:00", rest: "0:00", repetitions: "1" }), {
        valid: true,
        configuration: {
            preparationSeconds: 600,
            exerciseSeconds: 600,
            restSeconds: 0,
            repetitions: 1,
        },
    });
});

void test("invalid fields produce their own errors without coercion", () => {
    const validInput = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3" };
    const invalidTimes = ["", "5", "3:5", "0:60", "10:01", "-1:00", "1.5:00", "abc", "01:00"];

    for (const field of ["preparation", "exercise", "rest"] as const) {
        for (const value of invalidTimes) {
            const result = parseDrillConfig({ ...validInput, [field]: value });
            assert.equal(result.valid, false, `${field} accepted ${JSON.stringify(value)}`);
            assert.ok(result.errors[field]);
        }
    }

    const zeroExercise = parseDrillConfig({ ...validInput, exercise: "0:00" });
    assert.equal(zeroExercise.valid, false);
    assert.ok(zeroExercise.errors.exercise);

    for (const repetitions of ["", "0", "101", "-1", "1.5", "abc", "1e2", "01"]) {
        const result = parseDrillConfig({ ...validInput, repetitions });
        assert.equal(result.valid, false, `repetitions accepted ${JSON.stringify(repetitions)}`);
        assert.ok(result.errors.repetitions);
    }
});
