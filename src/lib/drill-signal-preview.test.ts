import assert from "node:assert/strict";
import test from "node:test";

import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "./drill-audio.ts";
import { DrillRun, type DrillClock } from "./drill-run.ts";
import { playSignalPreview, previewCueSequence, SIGNAL_MEANINGS, signalAvailability } from "./drill-signal-preview.ts";
import { RANDOM_START_MAX_CENTISECONDS, RANDOM_START_MIN_CENTISECONDS, type DrillConfigInput } from "./drill-timer.ts";

class RecordingAudio implements DrillAudioPort {
    available = true;
    cues: { cue: DrillCue; at: number }[] = [];
    startShift = 0;
    schedule(cue: DrillCue, at: number): ScheduledCue {
        this.cues.push({ cue, at });
        const start = at + this.startShift;
        return { start, end: start + CUE_DURATION[cue] };
    }
    cancel() {
        /* nothing scheduled to stop */
    }
    close() {
        this.available = false;
    }
    onUnavailable() {
        /* never becomes unavailable */
    }
}

const clock: DrillClock = {
    now: () => 0,
    setWake: () => 1,
    clearWake: () => undefined,
};

function drillCues(randomStartEnabled: boolean, kinds: DrillCue[]) {
    const audio = new RecordingAudio();
    new DrillRun({ preparationSeconds: 0, exerciseSeconds: 4, restSeconds: 2, repetitions: 1, randomStartEnabled }, clock, audio, () => 0).start();
    const picked = audio.cues.filter(({ cue }) => kinds.includes(cue));
    return picked.map(({ cue, at }) => ({ cue, offset: at - picked[0].at }));
}

void test("preview cue sequences equal the cues DrillRun schedules", () => {
    assert.deepEqual(previewCueSequence("exercise"), drillCues(false, ["exercise"]));
    assert.deepEqual(previewCueSequence("rest"), drillCues(false, ["rest"]));
    assert.deepEqual(previewCueSequence("standby"), drillCues(true, ["standby-first", "standby-second"]));
});

void test("preview ends at the last returned cue end, also when the start is shifted", () => {
    const audio = new RecordingAudio();
    audio.startShift = 0.5;
    const result = playSignalPreview(audio, "standby", 10);
    assert.deepEqual(audio.cues, [
        { cue: "standby-first", at: 10 },
        { cue: "standby-second", at: 10.5 + CUE_DURATION["standby-first"] },
    ]);
    assert.equal(result.start, 10.5);
    const secondStart = 10.5 + CUE_DURATION["standby-first"];
    assert.ok(Math.abs(result.end - (secondStart + 0.5 + CUE_DURATION["standby-second"])) < 1e-9);
    for (const signal of ["exercise", "rest"] as const) {
        assert.equal(playSignalPreview(new RecordingAudio(), signal, 3).end, 3 + CUE_DURATION[signal]);
    }
});

const values: DrillConfigInput = { preparation: "0:05", exercise: "0:30", rest: "0:10", repetitions: "3", randomStartEnabled: true };

void test("rest availability follows only the Rest field", () => {
    assert.deepEqual(signalAvailability(values, "rest"), { enabled: true });
    const zero = signalAvailability({ ...values, rest: "0:00" }, "rest");
    assert.equal(zero.enabled, false);
    assert.match(zero.note ?? "", /Rest is 0:00/);
    assert.deepEqual(signalAvailability({ ...values, rest: "0:02", exercise: "bad" }, "rest"), { enabled: true });
    for (const rest of ["abc", "11:00"]) {
        const invalid = signalAvailability({ ...values, rest }, "rest");
        assert.equal(invalid.enabled, false);
        assert.match(invalid.note ?? "", /valid Rest time/);
    }
});

void test("exercise and Standby are always playable; Standby notes when Random start is off", () => {
    assert.deepEqual(signalAvailability({ ...values, exercise: "bad" }, "exercise"), { enabled: true });
    assert.deepEqual(signalAvailability(values, "standby"), { enabled: true });
    const off = signalAvailability({ ...values, randomStartEnabled: false }, "standby");
    assert.equal(off.enabled, true);
    assert.match(off.note ?? "", /Random start is off/);
});

void test("Standby meaning derives its wait range from the random-start constants", () => {
    assert.match(SIGNAL_MEANINGS.standby, new RegExp(`${RANDOM_START_MIN_CENTISECONDS / 100}–${RANDOM_START_MAX_CENTISECONDS / 100} s`));
});
