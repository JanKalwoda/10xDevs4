import assert from "node:assert/strict";
import test from "node:test";

import { parseDrillConfig } from "./drill-timer.ts";
import { configInputFromSavedDrill } from "./saved-drill-summary.ts";
import type { DrillConfiguration } from "../types";

void test("the edit prefill formats m:ss and round-trips through parseDrillConfig", () => {
    const configurations: DrillConfiguration[] = [
        { preparationSeconds: 0, exerciseSeconds: 1, restSeconds: 0, repetitions: 1, randomStartEnabled: false },
        { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: true },
        { preparationSeconds: 600, exerciseSeconds: 600, restSeconds: 600, repetitions: 100, randomStartEnabled: true },
        { preparationSeconds: 61, exerciseSeconds: 59, restSeconds: 60, repetitions: 12, randomStartEnabled: false },
    ];
    for (const configuration of configurations) {
        assert.deepEqual(parseDrillConfig(configInputFromSavedDrill(configuration)), { valid: true, configuration }, JSON.stringify(configuration));
    }
});

void test("the edit prefill uses the form's own text shape", () => {
    assert.deepEqual(configInputFromSavedDrill({ preparationSeconds: 0, exerciseSeconds: 600, restSeconds: 65, repetitions: 7, randomStartEnabled: true }), {
        preparation: "0:00",
        exercise: "10:00",
        rest: "1:05",
        repetitions: "7",
        randomStartEnabled: true,
    });
});
