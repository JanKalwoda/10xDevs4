import { firstDrillPhase, nextDrillPhase, sampleRandomStartCentiseconds } from "./drill-timer.ts";
import { STANDBY_SECOND_OFFSET, type DrillAudioPort, type DrillScheduleEvidence } from "./drill-audio.ts";
import type { DrillConfiguration, DrillPhase } from "../types.ts";

const AUDIO_LOOKAHEAD_SECONDS = 5;

export interface DrillClock {
    now(): number;
    setWake(callback: () => void, delayMilliseconds: number): unknown;
    clearWake(handle: unknown): void;
}

export const browserDrillClock: DrillClock = {
    now: () => performance.now() / 1000,
    setWake: (callback, delay) => window.setTimeout(callback, delay),
    clearWake: (handle) => {
        window.clearTimeout(handle as number);
    },
};

export interface DrillDisplay {
    phase: DrillPhase | null;
    remainingSeconds: number | null;
    paused: boolean;
    audioAvailable: boolean;
}

interface Segment {
    phase: DrillPhase;
    start: number;
    end: number;
    secondSoundEnd?: number;
    sampledWait?: number;
}

interface PausedAt {
    phase: DrillPhase;
    remaining: number;
    remainingWait?: number;
    beforeSecondSound?: boolean;
}

/** Private timeline owns random waits and audio deadlines; display gets neither. */
export class DrillRun {
    private readonly configuration: Readonly<DrillConfiguration>;
    private readonly clock: DrillClock;
    private audio: DrillAudioPort | null;
    private readonly random: () => number;
    private segments: Segment[] = [];
    private generation = 0;
    private wake: unknown;
    private pausedAt: PausedAt | null = null;
    private finished = false;
    private silent: boolean;
    private listener: (display: DrillDisplay) => void;
    private resumeTarget: DrillPhase | null = null;
    private recoveryGeneration = 0;
    private recovering = false;
    private readonly previousScheduleEvidence: DrillScheduleEvidence[] = [];

    constructor(
        configuration: Readonly<DrillConfiguration>,
        clock: DrillClock,
        audio: DrillAudioPort | null,
        random: () => number = Math.random,
        listener: (display: DrillDisplay) => void = () => undefined,
    ) {
        this.configuration = configuration;
        this.clock = clock;
        this.audio = audio;
        this.random = random;
        this.listener = listener;
        this.silent = !audio?.available;
        audio?.onUnavailable(() => {
            if (this.audio === audio) this.audioFailed();
        });
    }

    start() {
        this.rebuild(firstDrillPhase(this.configuration), this.clock.now());
    }

    get scheduleEvidence(): readonly DrillScheduleEvidence[] {
        return [...this.previousScheduleEvidence, ...(this.audio?.scheduleEvidence ?? [])];
    }

    get display(): DrillDisplay {
        if (this.pausedAt)
            return {
                phase: this.pausedAt.phase,
                remainingSeconds: this.pausedAt.phase.kind === "standby" ? null : Math.ceil(this.pausedAt.remaining),
                paused: true,
                audioAvailable: !this.silent,
            };
        const now = this.clock.now();
        const current = this.segments.find((segment) => now < segment.end);
        return {
            phase: current?.phase ?? null,
            remainingSeconds: current && current.phase.kind !== "standby" ? Math.max(0, Math.ceil(current.end - now)) : null,
            paused: false,
            audioAvailable: !this.silent,
        };
    }

    subscribe(listener: (display: DrillDisplay) => void) {
        this.listener = listener;
        listener(this.display);
    }

    tick() {
        if (this.pausedAt || this.finished) return;
        const now = this.clock.now();
        while (this.segments.length && now >= this.segments[0].end) {
            const completed = this.segments.shift();
            if (!completed) break;
            const next = completed.phase.kind === "preparation" && this.resumeTarget ? this.resumeTarget : nextDrillPhase(this.configuration, completed.phase);
            if (completed.phase.kind === "preparation") this.resumeTarget = null;
            if (this.segments.length) continue;
            if (next) this.rebuild(next, completed.end, undefined, undefined, completed.end >= now - 0.001);
            else this.finished = true;
        }
        if (!this.silent) this.appendLookahead();
        this.listener(this.display);
        this.armWake();
    }

    hide() {
        this.recoveryGeneration++;
        this.recovering = false;
        if (this.pausedAt || this.finished) return;
        this.tick();
        const now = this.clock.now();
        const segment = this.segments.find((item) => now < item.end);
        if (!segment) {
            this.tick();
            return;
        }
        this.pausedAt = {
            phase: segment.phase,
            remaining: Math.max(0, segment.end - now),
            remainingWait: segment.phase.kind === "standby" ? Math.max(0, segment.end - Math.max(now, segment.secondSoundEnd ?? segment.start)) : undefined,
            beforeSecondSound: segment.phase.kind === "standby" && now < (segment.secondSoundEnd ?? segment.start),
        };
        this.invalidate();
        this.audio?.cancel();
        this.segments = [];
        this.listener(this.display);
    }

    /** Invoke directly from the Resume gesture to unlock a fresh audio context. */
    async resumeWithAudio(createAudio: () => Promise<DrillAudioPort | null>): Promise<void> {
        if (!this.pausedAt || this.finished || this.recovering) return;
        this.recovering = true;
        const generation = ++this.recoveryGeneration;
        let replacement: DrillAudioPort | null;
        try {
            replacement = await createAudio();
        } catch {
            replacement = null;
        }
        if (generation !== this.recoveryGeneration) {
            replacement?.close();
            return;
        }
        this.recovering = false;
        const previous = this.audio;
        this.previousScheduleEvidence.push(...(previous?.scheduleEvidence ?? []));
        this.audio = replacement;
        previous?.close();
        this.silent = !replacement?.available;
        replacement?.onUnavailable(() => {
            if (this.audio === replacement) this.audioFailed();
        });
        this.resume();
    }

    resume() {
        const paused = this.pausedAt;
        if (!paused) return;
        this.recoveryGeneration++;
        this.recovering = false;
        this.pausedAt = null;
        const now = this.clock.now();
        if ((paused.phase.kind === "standby" || paused.phase.kind === "exercise") && this.configuration.preparationSeconds > 0) {
            this.resumeTarget = this.configuration.randomStartEnabled
                ? { kind: "standby", repetition: paused.phase.repetition }
                : { kind: "exercise", durationSeconds: this.configuration.exerciseSeconds, repetition: paused.phase.repetition };
            this.rebuild({ kind: "preparation", durationSeconds: this.configuration.preparationSeconds }, now);
        } else if (paused.phase.kind === "standby" || paused.phase.kind === "exercise") {
            const target = this.configuration.randomStartEnabled
                ? { kind: "standby" as const, repetition: paused.phase.repetition }
                : { kind: "exercise" as const, durationSeconds: this.configuration.exerciseSeconds, repetition: paused.phase.repetition };
            this.rebuild(target, now);
        } else {
            this.rebuild(paused.phase, now, undefined, paused.remaining, false);
        }
    }

    audioFailed() {
        if (this.silent) return;
        const now = this.clock.now();
        this.silent = true;
        this.audio?.cancel();
        if (!this.pausedAt) this.tick();
        const current = this.segments.find((item) => now < item.end);
        if (this.pausedAt) {
            this.listener(this.display);
            return;
        }
        if (!current) {
            this.tick();
            return;
        }
        if (current.phase.kind === "standby") {
            const beforeSecondEnd = now < (current.secondSoundEnd ?? current.start);
            const wait = beforeSecondEnd ? (current.sampledWait ?? 0) : Math.max(0, current.end - now);
            this.rebuild(current.phase, now, undefined, wait, false);
        } else {
            this.rebuild(current.phase, now, undefined, Math.max(0, current.end - now), false);
        }
    }

    stop() {
        this.recoveryGeneration++;
        this.recovering = false;
        this.invalidate();
        this.audio?.cancel();
        this.audio?.close();
        this.segments = [];
        this.pausedAt = null;
        this.finished = true;
    }

    private invalidate() {
        this.generation++;
        if (this.wake !== undefined) this.clock.clearWake(this.wake);
        this.wake = undefined;
    }

    private rebuild(first: DrillPhase, start: number, resumeTarget?: DrillPhase, firstRemaining?: number, entryCue = true) {
        this.invalidate();
        this.audio?.cancel();
        this.finished = false;
        const segments: Segment[] = [];
        let phase: DrillPhase = first;
        let cursor = start;
        let firstSegment = true;
        let firstSampledWait: number | undefined;
        try {
            for (;;) {
                const current: DrillPhase = phase;
                let end: number;
                let secondSoundEnd: number | undefined;
                let sampledWait: number | undefined;
                if (current.kind === "standby") {
                    sampledWait = firstSegment && firstRemaining !== undefined ? firstRemaining : sampleRandomStartCentiseconds(this.random) / 100;
                    if (firstSegment) firstSampledWait = sampledWait;
                    if (!this.silent && this.audio && (!firstSegment || entryCue) && cursor >= this.clock.now() - 0.001) {
                        const firstSound = this.audio.schedule("standby-first", cursor);
                        const secondSound = this.audio.schedule("standby-second", firstSound.start + STANDBY_SECOND_OFFSET);
                        cursor = firstSound.start;
                        secondSoundEnd = secondSound.end;
                    }
                    end = (secondSoundEnd ?? cursor) + sampledWait;
                } else {
                    if (!this.silent && this.audio && current.kind !== "preparation" && (!firstSegment || entryCue) && cursor >= this.clock.now() - 0.001) {
                        const cue = this.audio.schedule(current.kind, cursor);
                        cursor = cue.start;
                    }
                    end = cursor + (firstSegment && firstRemaining !== undefined ? firstRemaining : current.durationSeconds);
                }
                segments.push({ phase: current, start: cursor, end, secondSoundEnd, sampledWait });
                cursor = end;
                if (current.kind === "preparation" || current.kind === "rest") break;
                const next: DrillPhase | null = firstSegment && resumeTarget ? resumeTarget : nextDrillPhase(this.configuration, current);
                if (!next || next.kind === "standby") break;
                phase = next;
                firstSegment = false;
            }
        } catch {
            this.silent = true;
            this.audio?.cancel();
            this.rebuild(first, start, resumeTarget, firstRemaining ?? firstSampledWait, false);
            return;
        }
        this.segments = segments;
        if (!this.silent) this.appendLookahead();
        this.listener(this.display);
        this.armWake();
    }

    private appendLookahead() {
        const now = this.clock.now();
        let finishCycle = false;
        try {
            while (this.segments.length) {
                const last = this.segments[this.segments.length - 1];
                if (!finishCycle && last.end > now + AUDIO_LOOKAHEAD_SECONDS) break;
                const phase = last.phase.kind === "preparation" && this.resumeTarget ? this.resumeTarget : nextDrillPhase(this.configuration, last.phase);
                if (!phase) break;
                let start = last.end;
                let secondSoundEnd: number | undefined;
                let sampledWait: number | undefined;
                let end: number;
                if (phase.kind === "standby") {
                    sampledWait = sampleRandomStartCentiseconds(this.random) / 100;
                    if (start >= now - 0.001 && this.audio) {
                        const firstSound = this.audio.schedule("standby-first", start);
                        const secondSound = this.audio.schedule("standby-second", firstSound.start + STANDBY_SECOND_OFFSET);
                        start = firstSound.start;
                        secondSoundEnd = secondSound.end;
                    }
                    end = (secondSoundEnd ?? start) + sampledWait;
                } else {
                    if (phase.kind !== "preparation" && start >= now - 0.001 && this.audio) {
                        const cue = this.audio.schedule(phase.kind, start);
                        start = cue.start;
                    }
                    end = start + phase.durationSeconds;
                }
                this.segments.push({ phase, start, end, secondSoundEnd, sampledWait });
                finishCycle = phase.kind === "standby" || (phase.kind === "exercise" && this.configuration.restSeconds > 0);
            }
        } catch {
            this.audioFailed();
        }
    }

    private armWake() {
        if (this.wake !== undefined) this.clock.clearWake(this.wake);
        const now = this.clock.now();
        const next = this.segments.find((segment) => segment.end > now);
        if (!next || this.pausedAt || this.finished) return;
        const last = this.segments[this.segments.length - 1];
        const fillAt = !this.silent && nextDrillPhase(this.configuration, last.phase) ? last.end - AUDIO_LOOKAHEAD_SECONDS : Number.POSITIVE_INFINITY;
        const wakeAt = Math.min(next.end, fillAt > now ? fillAt : next.end);
        const generation = this.generation;
        this.wake = this.clock.setWake(
            () => {
                if (generation !== this.generation) return;
                this.wake = undefined;
                this.tick();
            },
            Math.max(0, (wakeAt - now) * 1000),
        );
    }
}
