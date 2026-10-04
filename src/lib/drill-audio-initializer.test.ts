import assert from "node:assert/strict";
import test from "node:test";

import type { DrillAudioPort } from "./drill-audio.ts";
import { observeDrillAudioInitialization } from "./drill-audio-initializer.ts";

class FakeAudio implements DrillAudioPort {
    available = true;
    closed = 0;
    cancelled = 0;
    unavailableHandler: (() => void) | undefined;
    get scheduleEvidence() {
        return [];
    }
    schedule() {
        return { start: 0, end: 0 };
    }
    cancel() {
        this.cancelled++;
    }
    close() {
        this.closed++;
        this.available = false;
    }
    onUnavailable(handler: () => void) {
        this.unavailableHandler = handler;
    }
}

void test("unmount during initial audio setup closes a late grant without starting the run", async () => {
    let resolveAudio!: (audio: DrillAudioPort) => void;
    const pending = new Promise<DrillAudioPort>((resolve) => {
        resolveAudio = resolve;
    });
    let onReadyCalls = 0;
    const dispose = observeDrillAudioInitialization(pending, () => {
        onReadyCalls++;
    });

    dispose();
    const lateAudio = new FakeAudio();
    resolveAudio(lateAudio);
    await pending;
    await Promise.resolve();

    assert.equal(onReadyCalls, 0);
    assert.equal(lateAudio.closed, 1);
});

void test("a rejected initial audio setup after unmount is ignored", async () => {
    let rejectAudio!: (reason: Error) => void;
    const pending = new Promise<DrillAudioPort | null>((_resolve, reject) => {
        rejectAudio = reject;
    });
    let onReadyCalls = 0;
    const dispose = observeDrillAudioInitialization(pending, () => {
        onReadyCalls++;
    });

    dispose();
    rejectAudio(new Error("audio setup failed"));
    await Promise.resolve();

    assert.equal(onReadyCalls, 0);
});
