export interface DrillVisibilityPort {
    isHidden(): boolean;
    subscribe(onChange: () => void): () => void;
}

/** Stable browser default; tests and the preview fixture inject a controllable port instead. */
export const browserDrillVisibility: DrillVisibilityPort = {
    isHidden: () => document.hidden,
    subscribe: (onChange) => {
        document.addEventListener("visibilitychange", onChange);
        return () => {
            document.removeEventListener("visibilitychange", onChange);
        };
    },
};
