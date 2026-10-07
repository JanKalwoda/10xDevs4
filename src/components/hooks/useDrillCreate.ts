import { useState, useSyncExternalStore } from "react";
import { createDrillCreateController, postSaveDrill, type DrillCreateOptions, type DrillCreateSnapshot, type SaveDrillPort } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";

export interface DrillCreateApi extends DrillCreateSnapshot {
    setName: (name: string) => void;
    submitAttempt: () => void;
    save: (values: DrillConfigInput) => void;
    markEdited: () => void;
}

/** `saveDrill` and `options` are read once, when the form mounts. */
export function useDrillCreate(saveDrill: SaveDrillPort = postSaveDrill, options?: DrillCreateOptions): DrillCreateApi {
    const [controller] = useState(() => createDrillCreateController(saveDrill, options));
    const snapshot = useSyncExternalStore(
        (listener) => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );

    return {
        ...snapshot,
        setName: (name) => {
            controller.setName(name);
        },
        submitAttempt: () => {
            controller.submitAttempt();
        },
        save: (values) => {
            void controller.save(values);
        },
        markEdited: () => {
            controller.markEdited();
        },
    };
}
