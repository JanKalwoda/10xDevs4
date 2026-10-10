/** Pause before a held step repeats, and the constant interval between repeats. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 100;

export interface StepRepeater {
    /** Runs `step` now, then repeats it while held; `step` returns false at a bound, which stops the repeat. */
    start: (step: () => boolean) => void;
    stop: () => void;
    dispose: () => void;
}

interface StepRepeaterOptions {
    setTimer: (callback: () => void, milliseconds: number) => unknown;
    clearTimer: (handle: unknown) => void;
    setIntervalTimer?: (callback: () => void, milliseconds: number) => unknown;
    clearIntervalTimer?: (handle: unknown) => void;
    delayMs?: number;
    intervalMs?: number;
}

export function createStepRepeater({
    setTimer,
    clearTimer,
    setIntervalTimer = setTimer,
    clearIntervalTimer = clearTimer,
    delayMs = REPEAT_DELAY_MS,
    intervalMs = REPEAT_INTERVAL_MS,
}: StepRepeaterOptions): StepRepeater {
    let delayHandle: unknown;
    let hasDelay = false;
    let intervalHandle: unknown;
    let hasInterval = false;
    let disposed = false;

    function stop() {
        if (hasDelay) {
            clearTimer(delayHandle);
            hasDelay = false;
        }
        if (hasInterval) {
            clearIntervalTimer(intervalHandle);
            hasInterval = false;
        }
    }

    return {
        start(step) {
            stop();
            if (disposed || !step()) return;
            delayHandle = setTimer(() => {
                hasDelay = false;
                intervalHandle = setIntervalTimer(() => {
                    if (!step()) stop();
                }, intervalMs);
                hasInterval = true;
            }, delayMs);
            hasDelay = true;
        },
        stop,
        dispose() {
            disposed = true;
            stop();
        },
    };
}
