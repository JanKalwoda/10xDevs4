import type { DrillWakeLockController, WakeLockStatus } from "./drill-wake-lock.ts";

export interface DrillWakeLockSession {
    getStatus(): WakeLockStatus;
    wasHidden(): boolean;
    subscribe(listener: (status: WakeLockStatus) => void): () => void;
    requestForVisibleGesture(): Promise<void>;
    release(): Promise<void>;
    dispose(): Promise<void>;
}

export type HiddenVisibilitySubscription = (onHidden: () => void) => () => void;

/** Scopes best-effort screen locking to explicit, visible run gestures. */
export function createDrillWakeLockSession(controller: DrillWakeLockController, isVisible: () => boolean, subscribeToHidden?: HiddenVisibilitySubscription): DrillWakeLockSession {
    let disposed = false;
    let hidden = false;
    const unsubscribeHidden = subscribeToHidden?.(() => {
        hidden = true;
        void controller.release();
    });

    return {
        getStatus: () => controller.getStatus(),
        wasHidden: () => hidden,
        subscribe: (listener) => controller.subscribe(listener),
        requestForVisibleGesture() {
            if (disposed) return Promise.resolve();
            try {
                if (!isVisible()) return Promise.resolve();
            } catch {
                return Promise.resolve();
            }
            return controller.request();
        },
        release: () => controller.release(),
        async dispose() {
            if (disposed) return;
            disposed = true;
            unsubscribeHidden?.();
            await controller.release();
        },
    };
}
