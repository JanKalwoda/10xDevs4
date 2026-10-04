export interface DrillResumePendingState {
    begin(): number;
    invalidate(): void;
    finish(attempt: number): boolean;
}

/** Keeps a stale Resume result from clearing the pending state of a newer attempt. */
export function createDrillResumePendingState(): DrillResumePendingState {
    let generation = 0;
    let pending = false;

    return {
        begin() {
            pending = true;
            return ++generation;
        },
        invalidate() {
            generation++;
            pending = false;
        },
        finish(attempt) {
            if (attempt !== generation || !pending) return false;
            pending = false;
            return true;
        },
    };
}
