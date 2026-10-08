/** How long a hint opened by a touch stays visible; a touch user has no hover to keep it open. */
export const HINT_DURATION_MS = 8000;

export interface SignalHintSnapshot {
    open: boolean;
}

export interface SignalHint {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => SignalHintSnapshot;
    /** Opens the hint and restarts the countdown. */
    showFor: () => void;
    hide: () => void;
    dispose: () => void;
}

interface SignalHintOptions {
    setTimer: (callback: () => void, milliseconds: number) => unknown;
    clearTimer: (handle: unknown) => void;
    durationMs?: number;
}

const OPEN: SignalHintSnapshot = { open: true };
const CLOSED: SignalHintSnapshot = { open: false };

export function createSignalHint({ setTimer, clearTimer, durationMs = HINT_DURATION_MS }: SignalHintOptions): SignalHint {
    const listeners = new Set<() => void>();
    let snapshot = CLOSED;
    let timer: unknown;
    let hasTimer = false;

    function stopTimer() {
        if (!hasTimer) return;
        clearTimer(timer);
        hasTimer = false;
    }

    function publish(next: SignalHintSnapshot) {
        if (next === snapshot) return;
        snapshot = next;
        listeners.forEach((listener) => {
            listener();
        });
    }

    function hide() {
        stopTimer();
        publish(CLOSED);
    }

    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => snapshot,
        showFor() {
            stopTimer();
            publish(OPEN);
            timer = setTimer(() => {
                hasTimer = false;
                publish(CLOSED);
            }, durationMs);
            hasTimer = true;
        },
        hide,
        dispose() {
            hide();
            listeners.clear();
        },
    };
}

export interface PressDecision {
    play: boolean;
    /** Opens the hint for the touch timeout. */
    showHint: boolean;
    /** Text for the live region, or null when the status text already covers it. */
    announce: string | null;
}

/**
 * What a click on the preview icon does. A disabled icon keeps focus (aria-disabled), so it never plays
 * and always explains itself, whatever the pointer; hover and focus open the tooltip for the other pointers.
 * `pointerType` is "" for keyboard and assistive-technology clicks.
 */
export function decidePress({ enabled, pointerType, note }: { enabled: boolean; pointerType: string; note?: string }): PressDecision {
    if (!enabled) return { play: false, showHint: true, announce: note ?? null };
    return { play: true, showHint: pointerType === "touch", announce: null };
}
