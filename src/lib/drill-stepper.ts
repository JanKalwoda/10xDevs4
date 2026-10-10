import { MAX_DRILL_SECONDS, MAX_REPETITIONS } from "./drill-timer.ts";
import { formatPhaseTime } from "./drill-phase-sections.ts";

export type StepperField = "preparation" | "exercise" | "rest" | "repetitions";
export type StepDirection = "up" | "down";

export interface StepperLimits {
    min: number;
    max: number;
    step: number;
    /** Time fields are shown as m:ss, repetitions as a whole number. */
    time: boolean;
}

export const STEPPER_LIMITS: Record<StepperField, StepperLimits> = {
    preparation: { min: 0, max: MAX_DRILL_SECONDS, step: 1, time: true },
    exercise: { min: 1, max: MAX_DRILL_SECONDS, step: 1, time: true },
    rest: { min: 0, max: MAX_DRILL_SECONDS, step: 1, time: true },
    repetitions: { min: 1, max: MAX_REPETITIONS, step: 1, time: false },
};

const REPETITIONS_TEXT = /^[1-9]\d*$/;
const TIME_SHAPE = /^(0|[1-9]\d*):([0-5]\d)$/;

/** The numeric value of a field text, or undefined when it is empty or malformed; may lie outside the range. */
function readValue(field: StepperField, value: string): number | undefined {
    if (!STEPPER_LIMITS[field].time) return REPETITIONS_TEXT.test(value) ? Number(value) : undefined;
    const match = TIME_SHAPE.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

function formatValue(field: StepperField, amount: number): string {
    return STEPPER_LIMITS[field].time ? formatPhaseTime(amount) : String(amount);
}

/**
 * The next text of a field after a step of `delta` (keys: ±1, Shift ±10; buttons: ±1). A valid value is moved
 * and clamped to the field range (an out-of-range one snaps to the nearest bound); an empty or malformed one
 * starts from the field minimum for both directions.
 */
export function stepFieldValue(field: StepperField, value: string, delta: number): string {
    const { min, max } = STEPPER_LIMITS[field];
    const current = readValue(field, value);
    if (current === undefined) return formatValue(field, min);
    return formatValue(field, Math.min(max, Math.max(min, current + delta)));
}

/** False only for a valid value that already sits on the bound in that direction; a malformed value enables both. */
export function canStep(field: StepperField, value: string, direction: StepDirection): boolean {
    const { min, max } = STEPPER_LIMITS[field];
    const current = readValue(field, value);
    if (current === undefined) return true;
    return direction === "up" ? current < max : current > min;
}
