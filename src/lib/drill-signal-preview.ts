import { STANDBY_SECOND_OFFSET, type DrillAudioPort, type DrillCue, type ScheduledCue } from "./drill-audio.ts";
import { parseDrillTime, type DrillConfigInput } from "./drill-timer.ts";

export type PreviewSignal = "exercise" | "rest" | "standby";

export const SIGNAL_MEANINGS: Readonly<Record<PreviewSignal, string>> = {
    exercise: "One long high beep marks the start of each exercise.",
    rest: "One short beep marks the start of each rest.",
    standby: "Two short beeps (lower, then higher) mean Standby: the exercise starts after a hidden random wait of 1–5 s that begins once both beeps end.",
};

export const PREPARATION_NO_SOUND = "Preparation has no sound.";
export const REST_ZERO_NOTE = "Rest is 0:00, so there is no rest signal.";
export const REST_INVALID_NOTE = "Enter a valid Rest time to hear its signal.";
export const STANDBY_OFF_NOTE = "Random start is off, so Standby does not play during the drill.";

export interface PreviewCueStep {
    cue: DrillCue;
    offset: number;
}

/** The cues the drill itself schedules for a signal; offsets are seconds from the first cue's start. */
export function previewCueSequence(signal: PreviewSignal): readonly PreviewCueStep[] {
    if (signal === "standby") {
        return [
            { cue: "standby-first", offset: 0 },
            { cue: "standby-second", offset: STANDBY_SECOND_OFFSET },
        ];
    }
    return [{ cue: signal, offset: 0 }];
}

/** Schedules the signal like DrillRun does and returns the real end of the last cue. */
export function playSignalPreview(audio: DrillAudioPort, signal: PreviewSignal, startAt: number): ScheduledCue {
    const [first, ...rest] = previewCueSequence(signal);
    const firstCue = audio.schedule(first.cue, startAt);
    let end = firstCue.end;
    for (const step of rest) {
        end = audio.schedule(step.cue, firstCue.start + step.offset).end;
    }
    return { start: firstCue.start, end };
}

export function signalAvailability(values: DrillConfigInput, signal: PreviewSignal): { enabled: boolean; note?: string } {
    if (signal === "exercise") return { enabled: true };
    if (signal === "standby") return values.randomStartEnabled ? { enabled: true } : { enabled: true, note: STANDBY_OFF_NOTE };
    const restSeconds = parseDrillTime(values.rest, true);
    if (restSeconds === undefined) return { enabled: false, note: REST_INVALID_NOTE };
    if (restSeconds === 0) return { enabled: false, note: REST_ZERO_NOTE };
    return { enabled: true };
}
