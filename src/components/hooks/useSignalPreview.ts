import { useEffect, useState, useSyncExternalStore } from "react";
import { createDrillAudio, type DrillAudioPort } from "@/lib/drill-audio";
import { createSignalPreviewController, type SignalPreviewSnapshot } from "@/lib/drill-signal-preview-controller";
import type { PreviewSignal } from "@/lib/drill-signal-preview";

export interface SignalPreviewApi extends SignalPreviewSnapshot {
    play: (signal: PreviewSignal) => void;
    release: () => void;
}

/** `createAudio` is read once, when the form mounts. */
export function useSignalPreview(createAudio: () => Promise<DrillAudioPort | null> = createDrillAudio): SignalPreviewApi {
    const [controller] = useState(() =>
        createSignalPreviewController({
            createAudio,
            now: () => performance.now() / 1000,
            setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
            clearTimer: (handle) => {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            },
        }),
    );
    const snapshot = useSyncExternalStore(
        (listener) => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );

    useEffect(
        () => () => {
            controller.release();
        },
        [controller],
    );

    return {
        ...snapshot,
        play: (signal) => {
            controller.play(signal);
        },
        release: () => {
            controller.release();
        },
    };
}
