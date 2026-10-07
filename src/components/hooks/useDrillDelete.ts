import { useEffect, useState, useSyncExternalStore } from "react";
import { createDrillDeleteController, type DeleteDrillPort, type DrillDeleteSnapshot } from "@/lib/drill-delete-controller";

export interface DrillDeleteApi extends DrillDeleteSnapshot {
    confirm: () => void;
    cancel: () => void;
}

/** `deleteDrill` and `navigate` are read once, when the dialog mounts. */
export function useDrillDelete(deleteDrill: DeleteDrillPort, navigate: (href: string) => void): DrillDeleteApi {
    const [controller] = useState(() => createDrillDeleteController(deleteDrill, navigate));
    const snapshot = useSyncExternalStore(
        (listener) => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );

    useEffect(() => {
        // A bfcache restore of a page that already left: the timer is gone, so show no stuck "Deleting…" dialog.
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            controller.reset();
            window.location.reload();
        };
        window.addEventListener("pageshow", onPageShow);
        return () => {
            window.removeEventListener("pageshow", onPageShow);
        };
    }, [controller]);

    return {
        ...snapshot,
        confirm: () => {
            void controller.confirm();
        },
        cancel: () => {
            controller.cancel();
        },
    };
}
