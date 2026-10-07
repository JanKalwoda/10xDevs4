import { formatPhaseTime } from "./drill-phase-sections.ts";
import type { DrillConfiguration } from "../types";

// The parameter line of a saved timer; the list, the detail view and the fixtures all render these segments.
export function describeDrillConfiguration(configuration: DrillConfiguration): string[] {
    const parts = [
        `Prep ${formatPhaseTime(configuration.preparationSeconds)}`,
        `Exercise ${formatPhaseTime(configuration.exerciseSeconds)}`,
        `Rest ${formatPhaseTime(configuration.restSeconds)}`,
        configuration.repetitions === 1 ? "1 rep" : `${String(configuration.repetitions)} reps`,
    ];
    if (configuration.randomStartEnabled) parts.push("Random start");
    return parts;
}
