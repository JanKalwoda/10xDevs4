export type DrillCue = "standby-first" | "standby-second" | "exercise" | "rest";

export interface ScheduledCue {
    start: number;
    end: number;
}

export interface DrillScheduleEvidence {
    cue: DrillCue;
    expectedStart: number;
    scheduledStart: number;
    deviationSeconds: number;
}

export function evaluateDrillSchedule(cues: readonly DrillScheduleEvidence[], repetitions: number, randomStartEnabled: boolean, positiveRest: boolean, audioAvailable: boolean) {
    const count = (cue: DrillCue) => cues.filter((item) => item.cue === cue).length;
    const allExpectedCuesScheduled =
        count("exercise") >= repetitions &&
        count("rest") >= (positiveRest ? repetitions : 0) &&
        count("standby-first") >= (randomStartEnabled ? repetitions : 0) &&
        count("standby-second") >= (randomStartEnabled ? repetitions : 0);
    return {
        withinTolerance: audioAvailable && allExpectedCuesScheduled && cues.every(({ deviationSeconds }) => deviationSeconds <= 0.2),
        allExpectedCuesScheduled,
        toleranceSeconds: 0.2,
        physicalSpeakerOutputMeasured: false,
        cues,
    };
}

export interface DrillAudioPort {
    readonly available: boolean;
    schedule(cue: DrillCue, at: number): ScheduledCue;
    cancel(): void;
    close(): void;
    onUnavailable(handler: () => void): void;
    readonly scheduleEvidence?: readonly DrillScheduleEvidence[];
}

// Times are seconds. The Standby pair occupies 0.45 s: a 0.3 s sound
// followed immediately by a 0.15 s sound. Exercise lasts 1 s; rest 0.35 s.
export const CUE_DURATION: Readonly<Record<DrillCue, number>> = {
    "standby-first": 0.3,
    "standby-second": 0.15,
    exercise: 1,
    rest: 0.35,
};
export const STANDBY_SECOND_OFFSET = CUE_DURATION["standby-first"];

const CUE_PITCH: Readonly<Record<DrillCue, number>> = {
    "standby-first": 450,
    "standby-second": 750,
    exercise: 2640,
    rest: 980,
};

/** Call during the user Start or Resume action so the browser may unlock audio. */
export async function createDrillAudio(): Promise<DrillAudioPort | null> {
    if (typeof AudioContext === "undefined") return null;
    let context: AudioContext | undefined;
    let resumeTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
        context = new AudioContext();
        await Promise.race([
            context.resume(),
            new Promise<never>((_, reject) => {
                resumeTimeout = setTimeout(() => {
                    reject(new Error("Drill audio initialization timed out"));
                }, 1500);
            }),
        ]);
        if (context.state !== "running") {
            void context.close().catch(() => undefined);
            return null;
        }
    } catch {
        if (context) void context.close().catch(() => undefined);
        return null;
    } finally {
        clearTimeout(resumeTimeout);
    }

    const sources = new Set<OscillatorNode>();
    const scheduleEvidence: DrillScheduleEvidence[] = [];
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
        get scheduleEvidence() {
            return scheduleEvidence;
        },
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
            const volume = 0.2;
            gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
            gain.gain.setValueAtTime(volume, end - 0.04);
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
            scheduleEvidence.push({ cue, expectedStart: at, scheduledStart: start + anchor, deviationSeconds: Math.abs(start + anchor - at) });
            return { start: start + anchor, end: end + anchor };
        },
        cancel,
        close() {
            closed = true;
            cancel();
            void context.close().catch(() => undefined);
        },
        onUnavailable(handler) {
            unavailableHandler = handler;
        },
    };
}
