import assert from "node:assert/strict";
import test from "node:test";
import { canStep, STEPPER_LIMITS, stepFieldValue, type StepperField } from "./drill-stepper.ts";

void test("steps time fields by one second and keeps the m:ss format", () => {
    assert.equal(stepFieldValue("exercise", "0:05", 1), "0:06");
    assert.equal(stepFieldValue("exercise", "0:05", -1), "0:04");
    assert.equal(stepFieldValue("rest", "1:05", 0), "1:05");
    assert.equal(stepFieldValue("exercise", "0:01", 1), "0:02");
    assert.equal(stepFieldValue("preparation", "0:59", 1), "1:00");
    assert.equal(stepFieldValue("rest", "1:00", -1), "0:59");
    assert.equal(stepFieldValue("rest", "9:59", 1), "10:00");
});

void test("steps repetitions as a whole number", () => {
    assert.equal(stepFieldValue("repetitions", "5", 1), "6");
    assert.equal(stepFieldValue("repetitions", "5", -1), "4");
    assert.equal(stepFieldValue("repetitions", "99", 1), "100");
});

void test("clamps to the field range on every bound", () => {
    assert.equal(stepFieldValue("exercise", "0:01", -1), "0:01");
    assert.equal(stepFieldValue("preparation", "0:00", -1), "0:00");
    assert.equal(stepFieldValue("rest", "0:00", -1), "0:00");
    for (const field of ["preparation", "exercise", "rest"] as const) {
        assert.equal(stepFieldValue(field, "10:00", 1), "10:00");
    }
    assert.equal(stepFieldValue("repetitions", "1", -1), "1");
    assert.equal(stepFieldValue("repetitions", "100", 1), "100");
});

void test("a step of ten is clamped to the range", () => {
    assert.equal(stepFieldValue("exercise", "0:05", -10), "0:01");
    assert.equal(stepFieldValue("rest", "0:05", -10), "0:00");
    assert.equal(stepFieldValue("rest", "9:55", 10), "10:00");
    assert.equal(stepFieldValue("rest", "0:30", 10), "0:40");
    assert.equal(stepFieldValue("repetitions", "95", 10), "100");
    assert.equal(stepFieldValue("repetitions", "5", -10), "1");
});

void test("an empty or malformed value starts from the field minimum in both directions", () => {
    for (const bad of ["", "abc", "0:5", "5", "1:60", "-1", " 0:05"]) {
        for (const delta of [1, -1, 10, -10]) {
            assert.equal(stepFieldValue("exercise", bad, delta), "0:01", `exercise ${JSON.stringify(bad)} ${String(delta)}`);
            assert.equal(stepFieldValue("preparation", bad, delta), "0:00");
            assert.equal(stepFieldValue("rest", bad, delta), "0:00");
        }
    }
    for (const bad of ["", "abc", "0", "1.5", "0:05", "-3"]) {
        assert.equal(stepFieldValue("repetitions", bad, 1), "1");
        assert.equal(stepFieldValue("repetitions", bad, -1), "1");
    }
});

void test("an out-of-range valid value snaps to the nearest bound", () => {
    assert.equal(stepFieldValue("rest", "12:00", 1), "10:00");
    assert.equal(stepFieldValue("rest", "12:00", -1), "10:00");
    assert.equal(stepFieldValue("exercise", "0:00", 1), "0:01");
    assert.equal(stepFieldValue("exercise", "0:00", -1), "0:01");
    assert.equal(stepFieldValue("repetitions", "250", 1), "100");
    assert.equal(stepFieldValue("repetitions", "250", -1), "100");
});

void test("canStep is false only for a valid value on the bound in that direction", () => {
    assert.equal(canStep("exercise", "0:01", "down"), false);
    assert.equal(canStep("exercise", "0:01", "up"), true);
    assert.equal(canStep("preparation", "0:00", "down"), false);
    assert.equal(canStep("rest", "0:00", "down"), false);
    for (const field of ["preparation", "exercise", "rest"] as const) {
        assert.equal(canStep(field, "10:00", "up"), false);
        assert.equal(canStep(field, "10:00", "down"), true);
    }
    assert.equal(canStep("repetitions", "1", "down"), false);
    assert.equal(canStep("repetitions", "100", "up"), false);
    assert.equal(canStep("repetitions", "100", "down"), true);
});

void test("canStep enables both arrows for a malformed value", () => {
    for (const field of Object.keys(STEPPER_LIMITS) as StepperField[]) {
        assert.equal(canStep(field, "", "up"), true);
        assert.equal(canStep(field, "abc", "down"), true);
    }
});
