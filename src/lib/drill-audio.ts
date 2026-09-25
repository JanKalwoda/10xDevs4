export type DrillCue = "standby-first" | "standby-second" | "exercise" | "rest";

export interface ScheduledCue {
    start: number;
    end: number;
}

export interface DrillAudioPort {
    readonly available: boolean;
    schedule(cue: DrillCue, at: number): ScheduledCue;
    cancel(): void;
    close(): void;
    onUnavailable(handler: () => void): void;
}

// Times are seconds. The Standby pair occupies 0.38 s: 0.12 s sounds
// separated by 0.14 s of silence. Exercise lasts 0.60 s; rest 0.12 s.
export const CUE_DURATION: Readonly<Record<DrillCue, number>> = {
    "standby-first": 0.12,
    "standby-second": 0.12,
    exercise: 0.6,
    rest: 0.12,
};
export const STANDBY_SECOND_OFFSET = 0.26;

const CUE_PITCH: Readonly<Record<DrillCue, number>> = {
    "standby-first": 660,
    "standby-second": 660,
    exercise: 880,
    rest: 440,
};

/** Call during the user Start action so the browser may unlock audio. */
export async function createDrillAudio(): Promise<DrillAudioPort | null> {
    if (typeof AudioContext === "undefined") return null;
    let context: AudioContext;
    try {
        context = new AudioContext();
        await context.resume();
        if (context.state !== "running") {
            await context.close();
            return null;
        }
    } catch {
        return null;
    }

    const sources = new Set<OscillatorNode>();
    let unavailableHandler: (() => void) | undefined;
    let closed = false;
    const anchor = performance.now() / 1000 - context.currentTime;

    function cancel() {
        for (const source of sources) {
            try {
                source.stop();
            } catch {
                /* A source may have already ended. */
            }
            source.disconnect();
        }
        sources.clear();
    }

    context.addEventListener("statechange", () => {
        if (!closed && context.state !== "running") unavailableHandler?.();
    });

    return {
        get available() {
            return !closed && context.state === "running";
        },
        schedule(cue, at) {
            if (closed || context.state !== "running") throw new Error("Drill audio unavailable");
            const start = Math.max(at - anchor, context.currentTime);
            const end = start + CUE_DURATION[cue];
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = CUE_PITCH[cue];
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);
            oscillator.connect(gain).connect(context.destination);
            oscillator.addEventListener("ended", () => {
                sources.delete(oscillator);
                oscillator.disconnect();
                gain.disconnect();
            });
            sources.add(oscillator);
            oscillator.start(start);
            oscillator.stop(end);
            return { start: start + anchor, end: end + anchor };
        },
        cancel,
        close() {
            closed = true;
            cancel();
            void context.close();
        },
        onUnavailable(handler) {
            unavailableHandler = handler;
        },
    };
}
