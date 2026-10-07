import { useState, useSyncExternalStore } from "react";
import { createDrillCreateController, postSaveDrill, type DrillCreateSnapshot, type SaveDrillPort } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";

export interface DrillCreateApi extends DrillCreateSnapshot {
    setName: (name: string) => void;
    submitAttempt: () => void;
    save: (values: DrillConfigInput) => void;
}

/** `saveDrill` is read once, when the form mounts. */
export function useDrillCreate(saveDrill: SaveDrillPort = postSaveDrill): DrillCreateApi {
    const [controller] = useState(() => createDrillCreateController(saveDrill));
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
    };
}
