import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createStepRepeater } from "@/lib/drill-step-repeat";
import { canStep, stepFieldValue, type StepDirection, type StepperField } from "@/lib/drill-stepper";

interface Latest {
    value: string;
    onStep: (next: string) => void;
}

/**
 * Press-and-hold stepping of one field. The repeat reads `value` and `onStep` from a ref refreshed after every
 * render, so a held button never steps from a stale copy; it stops at the bound and on unmount.
 */
export function useStepRepeat(field: StepperField, value: string, onStep: (next: string) => void) {
    const latest = useRef<Latest>({ value, onStep });
    useLayoutEffect(() => {
        latest.current = { value, onStep };
    });

    const [repeater] = useState(() =>
        createStepRepeater({
            setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
            clearTimer: (handle) => {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            },
            setIntervalTimer: (callback, milliseconds) => setInterval(callback, milliseconds),
            clearIntervalTimer: (handle) => {
                clearInterval(handle as ReturnType<typeof setInterval>);
            },
        }),
    );

    useEffect(
        () => () => {
            // stop(), not dispose(): the effect runs again on the same instance after StrictMode / Fast Refresh.
            repeater.stop();
        },
        [repeater],
    );

    const start = useCallback(
        (direction: StepDirection) => {
            repeater.start(() => {
                const current = latest.current;
                if (!canStep(field, current.value, direction)) return false;
                const next = stepFieldValue(field, current.value, direction === "up" ? 1 : -1);
                // Keep the ref in step so the next repeat before a re-render still moves on.
                latest.current = { ...current, value: next };
                current.onStep(next);
                return canStep(field, next, direction);
            });
        },
        [field, repeater],
    );

    const stop = useCallback(() => {
        repeater.stop();
    }, [repeater]);

    return { start, stop };
}
