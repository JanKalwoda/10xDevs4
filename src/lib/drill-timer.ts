import type { DrillConfiguration, DrillPhase } from "../types";

export interface DrillConfigInput {
    preparation: string;
    exercise: string;
    rest: string;
    repetitions: string;
}

export type DrillConfigErrors = Partial<Record<keyof DrillConfigInput, string>>;

export type DrillConfigResult = { valid: true; configuration: DrillConfiguration } | { valid: false; errors: DrillConfigErrors };

const TIME_PATTERN = /^(0|[1-9]\d*):([0-5]\d)$/;
const REPETITIONS_PATTERN = /^[1-9]\d*$/;

function parseTime(value: string, allowZero: boolean): number | undefined {
    const match = TIME_PATTERN.exec(value);
    if (!match) return undefined;

    const seconds = Number(match[1]) * 60 + Number(match[2]);
    if (seconds > 600 || (!allowZero && seconds === 0)) return undefined;

    return seconds;
}

export function parseDrillConfig(input: DrillConfigInput): DrillConfigResult {
    const preparationSeconds = parseTime(input.preparation, true);
    const exerciseSeconds = parseTime(input.exercise, false);
    const restSeconds = parseTime(input.rest, true);
    const repetitions = REPETITIONS_PATTERN.test(input.repetitions) ? Number(input.repetitions) : undefined;

    const errors: DrillConfigErrors = {};
    if (preparationSeconds === undefined) {
        errors.preparation = "Enter a time from 0:00 to 10:00 in m:ss format.";
    }
    if (exerciseSeconds === undefined) {
        errors.exercise = "Enter a time from 0:01 to 10:00 in m:ss format.";
    }
    if (restSeconds === undefined) {
        errors.rest = "Enter a time from 0:00 to 10:00 in m:ss format.";
    }
    if (repetitions === undefined || repetitions < 1 || repetitions > 100) {
        errors.repetitions = "Enter a whole number from 1 to 100.";
    }

    if (preparationSeconds === undefined || exerciseSeconds === undefined || restSeconds === undefined || repetitions === undefined || repetitions < 1 || repetitions > 100) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        configuration: {
            preparationSeconds,
            exerciseSeconds,
            restSeconds,
            repetitions,
        },
    };
}

export function firstDrillPhase(configuration: DrillConfiguration): DrillPhase {
    if (configuration.preparationSeconds > 0) {
        return { kind: "preparation", durationSeconds: configuration.preparationSeconds };
    }

    return { kind: "exercise", durationSeconds: configuration.exerciseSeconds, repetition: 1 };
}

export function nextDrillPhase(configuration: DrillConfiguration, current: DrillPhase): DrillPhase | null {
    if (current.kind === "preparation") {
        return { kind: "exercise", durationSeconds: configuration.exerciseSeconds, repetition: 1 };
    }

    if (current.kind === "exercise") {
        if (configuration.restSeconds > 0) {
            return {
                kind: "rest",
                durationSeconds: configuration.restSeconds,
                repetition: current.repetition,
            };
        }
        if (current.repetition === configuration.repetitions) return null;
    } else if (current.repetition === configuration.repetitions) {
        return null;
    }

    return {
        kind: "exercise",
        durationSeconds: configuration.exerciseSeconds,
        repetition: current.repetition + 1,
    };
}
