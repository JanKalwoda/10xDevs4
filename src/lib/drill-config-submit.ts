import { parseDrillConfig, type DrillConfigInput, type DrillConfigResult } from "./drill-timer.ts";
import type { DrillConfiguration } from "../types";

interface SubmitHandlers {
    releasePreview: () => void;
    onStart: (configuration: Readonly<DrillConfiguration>) => void;
}

/** Validates the form; on success releases preview audio first, then starts the drill. */
export function submitDrillConfig(values: DrillConfigInput, { releasePreview, onStart }: SubmitHandlers): DrillConfigResult {
    const result = parseDrillConfig(values);
    if (!result.valid) return result;

    releasePreview();
    onStart(Object.freeze({ ...result.configuration }));
    return result;
}
