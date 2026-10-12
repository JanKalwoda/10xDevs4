import assert from "node:assert/strict";
import test from "node:test";

import { parseDrillConfig, type DrillConfigInput } from "./drill-timer.ts";
import { canStep, stepFieldValue, type StepperField } from "./drill-stepper.ts";

// Oracle: PRD FR-001 (Preparation and Rest 0-600 s, Exercise 1-600 s, whole seconds, Repetitions 1-100) and FR-020
// (step of 1 s or 1, arrow inactive on the bound, an empty or malformed value starts from the field minimum).
// The bounds below are PRD literals, never read from STEPPER_LIMITS or MAX_*. The accepting side is the shared parser,
// the same one the API uses.

interface FieldSpec {
    field: StepperField;
    min: string;
    max: string;
    belowMin?: string;
    aboveMax: string;
    /** Number of single steps from the minimum to the maximum. */
    steps: number;
    /** What the parser returns for a valid value of this field. */
    read: (value: string) => number | undefined;
}

const VALID: DrillConfigInput = { preparation: "0:05", exercise: "0:30", rest: "0:10", repetitions: "3", randomStartEnabled: false };

function parsed(field: StepperField, value: string): number | undefined {
    const result = parseDrillConfig({ ...VALID, [field]: value });
    if (!result.valid) return undefined;
    const { configuration } = result;
    return { preparation: configuration.preparationSeconds, exercise: configuration.exerciseSeconds, rest: configuration.restSeconds, repetitions: configuration.repetitions }[
        field
    ];
}

const fields: FieldSpec[] = [
    { field: "preparation", min: "0:00", max: "10:00", aboveMax: "10:01", steps: 600, read: (value) => parsed("preparation", value) },
    { field: "exercise", min: "0:01", max: "10:00", belowMin: "0:00", aboveMax: "10:01", steps: 599, read: (value) => parsed("exercise", value) },
    { field: "rest", min: "0:00", max: "10:00", aboveMax: "10:01", steps: 600, read: (value) => parsed("rest", value) },
    { field: "repetitions", min: "1", max: "100", belowMin: "0", aboveMax: "101", steps: 99, read: (value) => parsed("repetitions", value) },
];

for (const spec of fields)
    void test(`${spec.field}: every arrow step is accepted by the parser and moves by exactly 1, from the PRD minimum to the PRD maximum and back`, () => {
        assert.notEqual(spec.read(spec.min), undefined, "the PRD minimum is valid");
        assert.notEqual(spec.read(spec.max), undefined, "the PRD maximum is valid");
        assert.equal(spec.read(spec.aboveMax), undefined, "one above the PRD maximum is invalid");
        if (spec.belowMin) assert.equal(spec.read(spec.belowMin), undefined, "one below the PRD minimum is invalid");

        let value = spec.min;
        let steps = 0;
        assert.equal(canStep(spec.field, value, "down"), false, "down is inactive on the minimum");
        while (canStep(spec.field, value, "up")) {
            const next = stepFieldValue(spec.field, value, 1);
            const before = spec.read(value);
            const after = spec.read(next);
            assert.ok(before !== undefined && after !== undefined, `${value} -> ${next} must both be accepted`);
            assert.equal(after - before, 1, `${value} -> ${next}`);
            value = next;
            steps++;
            assert.ok(steps <= spec.steps, "the arrow must stop at the PRD maximum");
        }
        assert.equal(steps, spec.steps);
        assert.equal(value, spec.max);
        assert.equal(stepFieldValue(spec.field, spec.max, 1), spec.max, "a step past the maximum changes nothing");

        let down = 0;
        while (canStep(spec.field, value, "down")) {
            const next = stepFieldValue(spec.field, value, -1);
            const before = spec.read(value);
            const after = spec.read(next);
            assert.ok(before !== undefined && after !== undefined, `${value} -> ${next} must both be accepted`);
            assert.equal(before - after, 1, `${value} -> ${next}`);
            value = next;
            down++;
            assert.ok(down <= spec.steps, "the arrow must stop at the PRD minimum");
        }
        assert.equal(down, spec.steps);
        assert.equal(value, spec.min);
        assert.equal(stepFieldValue(spec.field, spec.min, -1), spec.min, "a step past the minimum changes nothing");
        assert.equal(canStep(spec.field, spec.max, "up"), false, "up is inactive on the maximum");
    });

void test("an empty or malformed value starts from the PRD minimum of the field in both directions, and the arrows stay active", () => {
    const minimum: Record<StepperField, string> = { preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1" };
    for (const field of Object.keys(minimum) as StepperField[])
        for (const value of ["", "abc", "1:5", "-1", "0:60"])
            for (const delta of [1, -1]) {
                assert.equal(stepFieldValue(field, value, delta), minimum[field], `${field} "${value}" ${delta}`);
                assert.equal(canStep(field, value, delta > 0 ? "up" : "down"), true, `${field} "${value}"`);
            }
});

void test("minute rollovers stay valid: 0:59 -> 1:00 and 9:59 -> 10:00 in every time field", () => {
    for (const field of ["preparation", "exercise", "rest"] as const) {
        assert.equal(stepFieldValue(field, "0:59", 1), "1:00");
        assert.equal(stepFieldValue(field, "1:00", -1), "0:59");
        assert.equal(stepFieldValue(field, "9:59", 1), "10:00");
        assert.equal(stepFieldValue(field, "10:00", -1), "9:59");
    }
});

void test("a Shift step of 10 is clamped to the PRD range instead of leaving it", () => {
    assert.equal(stepFieldValue("exercise", "0:05", -10), "0:01");
    assert.equal(stepFieldValue("preparation", "0:05", -10), "0:00");
    assert.equal(stepFieldValue("rest", "9:55", 10), "10:00");
    assert.equal(stepFieldValue("repetitions", "95", 10), "100");
    assert.equal(stepFieldValue("repetitions", "5", -10), "1");
});
