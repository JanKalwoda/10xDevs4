import assert from "node:assert/strict";
import test from "node:test";

import { createDrillResumePendingState } from "./drill-resume-pending.ts";

void test("an older Resume result cannot clear a newer attempt after hidden invalidation", async () => {
    const state = createDrillResumePendingState();
    let resolveOld!: () => void;
    let resolveCurrent!: () => void;
    const oldResult = new Promise<void>((resolve) => {
        resolveOld = resolve;
    });
    const currentResult = new Promise<void>((resolve) => {
        resolveCurrent = resolve;
    });

    const oldAttempt = state.begin();
    let oldClearedPending: boolean | undefined;
    const oldCompletion = oldResult.finally(() => {
        oldClearedPending = state.finish(oldAttempt);
    });

    state.invalidate();
    const currentAttempt = state.begin();
    let currentClearedPending: boolean | undefined;
    const currentCompletion = currentResult.finally(() => {
        currentClearedPending = state.finish(currentAttempt);
    });

    resolveOld();
    await oldCompletion;
    assert.equal(oldClearedPending, false);

    resolveCurrent();
    await currentCompletion;
    assert.equal(currentClearedPending, true);
});
