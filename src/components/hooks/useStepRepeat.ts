import { useEffect, useLayoutEffect, useState } from "react";
import { createStepRepeater } from "@/lib/drill-step-repeat";
import { createStepPress } from "@/lib/drill-step-press";
import { canStep, stepFieldValue, type StepDirection, type StepperField } from "@/lib/drill-stepper";

/**
 * Stepping of one field by a button: a click steps once, a long press repeats (see `createStepPress`). After every
 * render the press is bound to the newest `value` and `onStep`, so a held button never steps from a stale copy; the
 * repeat stops at the bound and on unmount.
 */
export function useStepRepeat(field: StepperField, value: string, onStep: (next: string) => void) {
    const [press] = useState(() =>
        createStepPress({
            repeater: createStepRepeater({
                setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
                clearTimer: (handle) => {
                    clearTimeout(handle as ReturnType<typeof setTimeout>);
                },
                setIntervalTimer: (callback, milliseconds) => setInterval(callback, milliseconds),
                clearIntervalTimer: (handle) => {
                    clearInterval(handle as ReturnType<typeof setInterval>);
                },
            }),
            step: () => false,
            canStep: () => false,
        }),
    );

    useLayoutEffect(() => {
        // The value a repeat has reached before the next render commits it, so repeats keep moving on.
        let current = value;
        press.bind({
            canStep: (direction: StepDirection) => canStep(field, current, direction),
            step: (direction: StepDirection) => {
                if (!canStep(field, current, direction)) return false;
                current = stepFieldValue(field, current, direction === "up" ? 1 : -1);
                onStep(current);
                return canStep(field, current, direction);
            },
        });
    });

    useEffect(
        () => () => {
            // blur(), not a one-way dispose: the effect runs again on the same instance after StrictMode / Fast Refresh.
            press.blur();
        },
        [press],
    );

    return press;
}
