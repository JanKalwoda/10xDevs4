import type { DrillAudioPort } from "./drill-audio.ts";

/** Closes a late initial audio grant if the owning timer unmounts first. */
export function observeDrillAudioInitialization(audio: Promise<DrillAudioPort | null>, onReady: (audio: DrillAudioPort | null) => void): () => void {
    let disposed = false;

    void audio.then(
        (audioPort) => {
            if (disposed) {
                audioPort?.close();
                return;
            }
            onReady(audioPort);
        },
        () => {
            if (!disposed) onReady(null);
        },
    );

    return () => {
        disposed = true;
    };
}
