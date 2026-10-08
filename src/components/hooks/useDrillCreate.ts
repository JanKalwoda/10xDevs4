import { useEffect, useState, useSyncExternalStore } from "react";
import { createDrillCreateController, postSaveDrill, type DrillCreateOptions, type DrillCreateSnapshot, type SaveDrillPort } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";

export interface DrillCreateApi extends DrillCreateSnapshot {
    setName: (name: string) => void;
    submitAttempt: () => void;
    save: (values: DrillConfigInput) => void;
    markEdited: () => void;
}

/** `saveDrill` and `options` are read once, when the form mounts. Create mode (no `keepAfterSave`) redirects to `/{id}` with `options.navigate`, by default a full page navigation. */
export function useDrillCreate(saveDrill: SaveDrillPort = postSaveDrill, options?: DrillCreateOptions): DrillCreateApi {
    const [controller] = useState(() =>
        createDrillCreateController(saveDrill, {
            ...options,
            navigate:
                options?.navigate ??
                ((href) => {
                    window.location.assign(href);
                }),
        }),
    );
    const redirects = !options?.keepAfterSave;
    const snapshot = useSyncExternalStore(
        (listener) => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );

    useEffect(() => {
        // Create only: a bfcache restore of a page that already left must not show a stuck "Saving…" form.
        // The edit page registers nothing, so unsaved changes survive a restore there.
        if (!redirects) return;
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            if (controller.reset()) window.location.reload();
        };
        window.addEventListener("pageshow", onPageShow);
        return () => {
            window.removeEventListener("pageshow", onPageShow);
        };
    }, [controller, redirects]);

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
