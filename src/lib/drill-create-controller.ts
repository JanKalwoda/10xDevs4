import type { DrillConfigInput } from "./drill-timer.ts";
import { normalizeDrillName, SAVE_DRILL_MESSAGES } from "./services/drill-configurations.ts";
import type { SaveDrillErrorCode, SaveDrillRequest, SaveDrillResponse } from "../types";

export type DrillCreateStatus = "idle" | "saving" | "saved" | "error";

/** An alert-level failure; a failure that belongs to the name field is `nameError` instead. */
export interface DrillCreateFailure {
    code: SaveDrillErrorCode;
    message: string;
}

export interface DrillCreateSnapshot {
    name: string;
    nameError: string | null;
    status: DrillCreateStatus;
    failure: DrillCreateFailure | null;
    savedName: string | null;
}

export interface DrillCreateController {
    setName(name: string): void;
    /** Validates the name at the start of a submit so its error shows together with parameter errors. */
    submitAttempt(): void;
    save(values: DrillConfigInput): Promise<void>;
    subscribe(listener: () => void): () => void;
    getSnapshot(): DrillCreateSnapshot;
}

export type SaveDrillPort = (request: SaveDrillRequest) => Promise<SaveDrillResponse>;

const INITIAL: DrillCreateSnapshot = { name: "", nameError: null, status: "idle", failure: null, savedName: null };

function failureFrom(response: Extract<SaveDrillResponse, { ok: false }>): Pick<DrillCreateSnapshot, "nameError" | "failure"> {
    const nameError = response.fieldErrors?.name ?? (response.code === "duplicate_name" ? response.message : null);
    if (nameError) return { nameError, failure: null };

    const otherFieldErrors = Object.values(response.fieldErrors ?? {}).filter((message): message is string => typeof message === "string");
    const message = response.code === "validation" && otherFieldErrors.length > 0 ? otherFieldErrors.join(" ") : response.message;
    return { nameError: null, failure: { code: response.code, message } };
}

export function createDrillCreateController(saveDrill: SaveDrillPort): DrillCreateController {
    const listeners = new Set<() => void>();
    let snapshot = INITIAL;

    function publish(next: DrillCreateSnapshot) {
        snapshot = next;
        for (const listener of [...listeners]) listener();
    }

    return {
        setName(name) {
            // The name field is read-only while saving; ignoring the change keeps a late keystroke from outliving the clear on success.
            if (snapshot.status === "saving") return;
            publish({ name, nameError: null, status: "idle", failure: null, savedName: null });
        },

        submitAttempt() {
            if (snapshot.status === "saving") return;
            const nameError = normalizeDrillName(snapshot.name) === null ? SAVE_DRILL_MESSAGES.name : null;
            if (nameError !== snapshot.nameError) publish({ ...snapshot, nameError });
        },

        async save(values) {
            // The latch is synchronous: a second submit before the first response never reaches the port.
            if (snapshot.status === "saving") return;

            const name = normalizeDrillName(snapshot.name);
            if (name === null) {
                publish({ ...snapshot, nameError: SAVE_DRILL_MESSAGES.name, status: "idle", failure: null, savedName: null });
                return;
            }

            publish({ ...snapshot, nameError: null, status: "saving", failure: null, savedName: null });

            let response: SaveDrillResponse;
            try {
                response = await saveDrill({ ...values, name });
            } catch {
                response = { ok: false, code: "unexpected", message: SAVE_DRILL_MESSAGES.unexpected };
            }

            if (response.ok) {
                publish({ name: "", nameError: null, status: "saved", failure: null, savedName: response.drill.name });
                return;
            }
            publish({ ...snapshot, status: "error", savedName: null, ...failureFrom(response) });
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

const STATUS_CODES: Partial<Record<number, SaveDrillErrorCode>> = {
    400: "validation",
    401: "unauthorized",
    409: "limit_reached",
    413: "payload_too_large",
    415: "unsupported_media_type",
    503: "unavailable",
};

function isSaveDrillResponse(value: unknown): value is SaveDrillResponse {
    if (typeof value !== "object" || value === null || !("ok" in value)) return false;
    if (value.ok === true) return "drill" in value && typeof value.drill === "object" && value.drill !== null && "name" in value.drill && typeof value.drill.name === "string";
    return value.ok === false && "code" in value && typeof value.code === "string" && "message" in value && typeof value.message === "string";
}

/** Default port: posts the request as JSON; a network failure or an unreadable reply never throws. */
export async function postSaveDrill(request: SaveDrillRequest, fetchImpl: typeof fetch = fetch): Promise<SaveDrillResponse> {
    let response: Response;
    try {
        response = await fetchImpl("/api/drills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        });
    } catch {
        return { ok: false, code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable };
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    if (isSaveDrillResponse(body)) return body;

    const code = STATUS_CODES[response.status] ?? "unexpected";
    return { ok: false, code, message: SAVE_DRILL_MESSAGES[code] };
}
