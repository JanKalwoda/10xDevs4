import { useEffect, useState, useSyncExternalStore } from "react";
import { createSignalAnnouncer, type SignalAnnouncer } from "@/lib/signal-preview-hint";

export function useSignalAnnouncer(): { text: string; announcer: SignalAnnouncer } {
    const [announcer] = useState(() =>
        createSignalAnnouncer({
            setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
            clearTimer: (handle) => {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            },
        }),
    );
    const text = useSyncExternalStore(announcer.subscribe, announcer.getSnapshot, announcer.getSnapshot);

    useEffect(
        () => () => {
            announcer.clear();
        },
        [announcer],
    );

    return { text, announcer };
}
