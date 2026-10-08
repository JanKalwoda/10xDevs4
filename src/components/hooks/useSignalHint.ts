import { useEffect, useState, useSyncExternalStore } from "react";
import { createSignalHint, type SignalHint } from "@/lib/signal-preview-hint";

export function useSignalHint(): { open: boolean; hint: SignalHint } {
    const [hint] = useState(() =>
        createSignalHint({
            setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
            clearTimer: (handle) => {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            },
        }),
    );
    const snapshot = useSyncExternalStore(hint.subscribe, hint.getSnapshot, hint.getSnapshot);

    useEffect(
        () => () => {
            hint.hide();
        },
        [hint],
    );

    return { open: snapshot.open, hint };
}
