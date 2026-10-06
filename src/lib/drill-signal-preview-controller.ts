import type { DrillAudioPort } from "./drill-audio.ts";
import { observeDrillAudioInitialization } from "./drill-audio-initializer.ts";
import { playSignalPreview, type PreviewSignal } from "./drill-signal-preview.ts";

export type SignalPreviewStatus = "idle" | "initializing" | "playing" | "unavailable";

export interface SignalPreviewSnapshot {
    status: SignalPreviewStatus;
    signal: PreviewSignal | null;
}

export interface SignalPreviewDeps {
    createAudio: () => Promise<DrillAudioPort | null>;
    /** Seconds in the performance.now()/1000 domain used by DrillAudioPort. */
    now: () => number;
    setTimer: (callback: () => void, milliseconds: number) => unknown;
    clearTimer: (handle: unknown) => void;
}

export interface SignalPreviewController {
    play(signal: PreviewSignal): void;
    release(): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): SignalPreviewSnapshot;
}

const IDLE: SignalPreviewSnapshot = { status: "idle", signal: null };

export function createSignalPreviewController({ createAudio, now, setTimer, clearTimer }: SignalPreviewDeps): SignalPreviewController {
    const listeners = new Set<() => void>();
    let snapshot = IDLE;
    let port: DrillAudioPort | null = null;
    let timer: unknown;
    let hasTimer = false;
    let disposeInitialization: (() => void) | undefined;

    function publish(next: SignalPreviewSnapshot) {
        snapshot = next;
        for (const listener of [...listeners]) listener();
    }

    function stopTimer() {
        if (hasTimer) clearTimer(timer);
        hasTimer = false;
    }

    function dropPort() {
        const dead = port;
        port = null;
        dead?.close();
    }

    function fail() {
        stopTimer();
        dropPort();
        publish({ status: "unavailable", signal: null });
    }

    function start(audio: DrillAudioPort, signal: PreviewSignal) {
        stopTimer();
        try {
            audio.cancel();
            const { end } = playSignalPreview(audio, signal, now());
            publish({ status: "playing", signal });
            timer = setTimer(
                () => {
                    hasTimer = false;
                    if (port === audio) publish(IDLE);
                },
                Math.max(0, (end - now()) * 1000),
            );
            hasTimer = true;
        } catch {
            fail();
        }
    }

    function adopt(audio: DrillAudioPort, signal: PreviewSignal) {
        port = audio;
        audio.onUnavailable(() => {
            if (port === audio) fail();
        });
        start(audio, signal);
    }

    return {
        play(signal) {
            if (snapshot.status === "initializing") return;
            if (port?.available) {
                start(port, signal);
                return;
            }
            stopTimer();
            dropPort();
            publish({ status: "initializing", signal });
            let pending: Promise<DrillAudioPort | null>;
            try {
                // Called synchronously so the browser still sees the user gesture.
                pending = createAudio();
            } catch {
                fail();
                return;
            }
            disposeInitialization = observeDrillAudioInitialization(pending, (audio) => {
                disposeInitialization = undefined;
                if (audio) adopt(audio, signal);
                else fail();
            });
        },
        release() {
            disposeInitialization?.();
            disposeInitialization = undefined;
            stopTimer();
            dropPort();
            if (snapshot !== IDLE) publish(IDLE);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot() {
            return snapshot;
        },
    };
}
