import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDrillSchedule, type DrillScheduleEvidence } from "./drill-audio.ts";

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
