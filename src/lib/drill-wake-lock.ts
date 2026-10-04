export type WakeLockStatus = "idle" | "requesting" | "held" | "unavailable";

export interface WakeLockSentinelPort {
    release(): Promise<void>;
    addEventListener(type: "release", listener: () => void): void;
    removeEventListener(type: "release", listener: () => void): void;
}

export interface WakeLockProvider {
    request(): Promise<WakeLockSentinelPort>;
}

export interface DrillWakeLockController {
    getStatus(): WakeLockStatus;
    subscribe(listener: (status: WakeLockStatus) => void): () => void;
    request(): Promise<void>;
    release(): Promise<void>;
}

interface HeldWakeLock {
    sentinel: WakeLockSentinelPort;
    listener: () => void;
    generation: number;
}

async function releaseBestEffort(sentinel: WakeLockSentinelPort): Promise<void> {
    try {
        await sentinel.release();
    } catch {
        // Wake Lock is best-effort and must not interrupt timer behavior.
    }
}

export function createDrillWakeLockController(provider: WakeLockProvider | null): DrillWakeLockController {
    let status: WakeLockStatus = "idle";
    let generation = 0;
    let held: HeldWakeLock | null = null;
    const listeners = new Set<(status: WakeLockStatus) => void>();

    function setStatus(next: WakeLockStatus) {
        if (status === next) return;
        status = next;
        for (const listener of [...listeners]) {
            try {
                listener(status);
            } catch {
                // A status observer must not interrupt timer behavior.
            }
        }
    }

    function detach(wakeLock: HeldWakeLock) {
        try {
            wakeLock.sentinel.removeEventListener("release", wakeLock.listener);
        } catch {
            // A detached sentinel is no longer owned by this controller.
        }
    }

    return {
        getStatus() {
            return status;
        },
        subscribe(listener) {
            listeners.add(listener);
            try {
                listener(status);
            } catch {
                // A status observer must not interrupt timer behavior.
            }
            let subscribed = true;
            return () => {
                if (!subscribed) return;
                subscribed = false;
                listeners.delete(listener);
            };
        },
        async request() {
            if (status === "requesting" || status === "held") return;

            const requestGeneration = ++generation;
            setStatus("requesting");
            if (!provider) {
                if (requestGeneration === generation) setStatus("unavailable");
                return;
            }

            let sentinel: WakeLockSentinelPort;
            try {
                sentinel = await provider.request();
            } catch {
                if (requestGeneration === generation) setStatus("unavailable");
                return;
            }

            if (requestGeneration !== generation) {
                await releaseBestEffort(sentinel);
                return;
            }

            const wakeLock: HeldWakeLock = {
                sentinel,
                generation: requestGeneration,
                listener: () => {
                    if (held !== wakeLock || generation !== requestGeneration) return;
                    held = null;
                    generation++;
                    detach(wakeLock);
                    setStatus("unavailable");
                },
            };
            held = wakeLock;
            try {
                sentinel.addEventListener("release", wakeLock.listener);
            } catch {
                if (held === wakeLock) held = null;
                detach(wakeLock);
                await releaseBestEffort(sentinel);
                if (requestGeneration === generation) setStatus("unavailable");
                return;
            }

            if (held === wakeLock && generation === requestGeneration) setStatus("held");
        },
        async release() {
            generation++;
            const wakeLock = held;
            held = null;
            if (wakeLock) detach(wakeLock);
            setStatus("idle");
            if (wakeLock) await releaseBestEffort(wakeLock.sentinel);
        },
    };
}
