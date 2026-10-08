import { TIMERS_HREF } from "./app-top-bar.ts";

export type DrillDeleteStatus = "idle" | "deleting" | "error";

export type DrillDeleteErrorCode = "unauthorized" | "unavailable" | "unexpected";

export const DELETE_DRILL_MESSAGES: Record<DrillDeleteErrorCode, string> = {
    unauthorized: "Sign in to delete this timer.",
    unavailable: "Deleting timers is temporarily unavailable. Please try again later.",
    unexpected: "Something went wrong. Please try again.",
};

export interface DrillDeleteFailure {
    code: DrillDeleteErrorCode;
    message: string;
}

export interface DrillDeleteSnapshot {
    status: DrillDeleteStatus;
    failure: DrillDeleteFailure | null;
}

export type DeleteDrillOutcome = { ok: true } | { ok: false; code: DrillDeleteErrorCode };

/** Sends the delete; it never throws, but the controller also survives a port that does. */
export type DeleteDrillPort = () => Promise<DeleteDrillOutcome>;

export interface DrillDeleteController {
    confirm(): Promise<void>;
    /** The dialog was dismissed (Cancel, Esc). Ignored while the request is in flight. */
    cancel(): void;
    /** A page restored from the back/forward cache: the stuck `deleting` state returns to `idle`. */
    reset(): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): DrillDeleteSnapshot;
}

const IDLE: DrillDeleteSnapshot = { status: "idle", failure: null };

export function createDrillDeleteController(deleteDrill: DeleteDrillPort, navigate: (href: string) => void): DrillDeleteController {
    const listeners = new Set<() => void>();
    let snapshot: DrillDeleteSnapshot = IDLE;

    function publish(next: DrillDeleteSnapshot) {
        snapshot = next;
        for (const listener of [...listeners]) listener();
    }

    return {
        async confirm() {
            // The latch is synchronous: a second click before the reply never reaches the port.
            if (snapshot.status === "deleting") return;
            publish({ status: "deleting", failure: null });

            let outcome: DeleteDrillOutcome;
            try {
                outcome = await deleteDrill();
            } catch {
                outcome = { ok: false, code: "unexpected" };
            }

            if (outcome.ok) {
                // Stays `deleting`: the page is leaving, so the dialog must not flicker back to a usable state.
                navigate(TIMERS_HREF);
                return;
            }
            publish({ status: "error", failure: { code: outcome.code, message: DELETE_DRILL_MESSAGES[outcome.code] } });
        },

        cancel() {
            if (snapshot.status !== "error") return;
            publish(IDLE);
        },

        reset() {
            if (snapshot.status === "idle") return;
            publish(IDLE);
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        getSnapshot() {
            return snapshot;
        },
    };
}

/** Production port: the 404 of an already deleted timer counts as done, the goal state is reached either way. */
export function deleteDrillRequest(id: string, fetchImpl: typeof fetch = fetch): DeleteDrillPort {
    return async () => {
        let response: Response;
        try {
            response = await fetchImpl(`/api/drills/${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch {
            return { ok: false, code: "unavailable" };
        }
        if (response.status === 204 || response.status === 404) return { ok: true };
        if (response.status === 401) return { ok: false, code: "unauthorized" };
        if (response.status === 503) return { ok: false, code: "unavailable" };
        return { ok: false, code: "unexpected" };
    };
}
