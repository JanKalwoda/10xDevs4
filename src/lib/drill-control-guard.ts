import type { DrillClock } from "./drill-run.ts";

/** How long Restart and Pause/Resume ignore a second activation after the previous one (a double click or tap). */
export const DRILL_CONTROL_GUARD_WINDOW_SECONDS = 0.5;

export interface DrillControlGuard {
    /** Opens the window and returns true, or returns false (changing nothing) while the window is open. */
    tryActivate: () => boolean;
    /** Opens the window from now on, even when one is already open (Start). */
    arm: () => void;
    isLocked: () => boolean;
    subscribe: (listener: () => void) => () => void;
    /** Closes the window and clears its wake; the guard stays usable (effect cleanup runs again on the same instance). */
    reset: () => void;
}

export const unlockedDrillControlGuard: DrillControlGuard = {
    tryActivate: () => true,
    arm: () => undefined,
    isLocked: () => false,
    subscribe: () => () => undefined,
    reset: () => undefined,
};

export function createDrillControlGuard(clock: DrillClock): DrillControlGuard {
    const listeners = new Set<() => void>();
    let locked = false;
    let wake: unknown;
    let hasWake = false;

    function notify() {
        for (const listener of [...listeners]) listener();
    }

    function clearWake() {
        if (!hasWake) return;
        clock.clearWake(wake);
        hasWake = false;
    }

    function arm() {
        clearWake();
        const changed = !locked;
        locked = true;
        wake = clock.setWake(() => {
            hasWake = false;
            if (!locked) return;
            locked = false;
            notify();
        }, DRILL_CONTROL_GUARD_WINDOW_SECONDS * 1000);
        hasWake = true;
        if (changed) notify();
    }

    return {
        tryActivate() {
            if (locked) return false;
            arm();
            return true;
        },
        arm,
        isLocked: () => locked,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        reset() {
            clearWake();
            if (!locked) return;
            locked = false;
            notify();
        },
    };
}
