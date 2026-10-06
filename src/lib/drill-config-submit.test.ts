import assert from "node:assert/strict";
import test from "node:test";

import { submitDrillConfig } from "./drill-config-submit.ts";
import type { DrillConfigInput } from "./drill-timer.ts";

const valid: DrillConfigInput = { preparation: "0:05", exercise: "0:30", rest: "0:10", repetitions: "3", randomStartEnabled: true };

void test("valid submit releases preview audio before onStart and passes a frozen configuration", () => {
    const calls: string[] = [];
    let started: unknown;
    const result = submitDrillConfig(valid, {
        releasePreview: () => calls.push("release"),
        onStart: (configuration) => {
            calls.push("start");
            started = configuration;
        },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(calls, ["release", "start"]);
    assert.ok(Object.isFrozen(started));
});

void test("invalid submit neither releases preview audio nor starts", () => {
    const calls: string[] = [];
    const result = submitDrillConfig({ ...valid, exercise: "bad" }, { releasePreview: () => calls.push("release"), onStart: () => calls.push("start") });
    assert.equal(result.valid, false);
    assert.deepEqual(calls, []);
});
