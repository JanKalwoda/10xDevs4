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
    /**
     * The parameters changed: a stale `Saved "…"` or alert is dropped. The typed name and any name error stay.
     * While saving it only remembers the change, so the reply of that save does not report the edited values as saved.
     */
    markEdited(): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): DrillCreateSnapshot;
}

export type SaveDrillPort = (request: SaveDrillRequest) => Promise<SaveDrillResponse>;

export interface DrillCreateOptions {
    /** Prefilled name (edit). */
    initialName?: string;
    /** Edit: the saved name stays in the field after a successful save instead of being cleared for the next timer. */
    keepAfterSave?: boolean;
}

function failureFrom(response: Extract<SaveDrillResponse, { ok: false }>): Pick<DrillCreateSnapshot, "nameError" | "failure"> {
    const nameError = response.fieldErrors?.name ?? (response.code === "duplicate_name" ? response.message : null);
    if (nameError) return { nameError, failure: null };

    const otherFieldErrors = Object.values(response.fieldErrors ?? {}).filter((message): message is string => typeof message === "string");
    const message = response.code === "validation" && otherFieldErrors.length > 0 ? otherFieldErrors.join(" ") : response.message;
    return { nameError: null, failure: { code: response.code, message } };
}

export function createDrillCreateController(saveDrill: SaveDrillPort, options: DrillCreateOptions = {}): DrillCreateController {
    const listeners = new Set<() => void>();
    let snapshot: DrillCreateSnapshot = { name: options.initialName ?? "", nameError: null, status: "idle", failure: null, savedName: null };
    // The parameters changed after the request left: its reply describes values the form no longer shows.
    let editedDuringSave = false;

    // A function so the flag read after the `await` is not narrowed to the `false` assigned before it.
    function takeEditedDuringSave(): boolean {
        const edited = editedDuringSave;
        editedDuringSave = false;
        return edited;
    }

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

            editedDuringSave = false;
            publish({ ...snapshot, nameError: null, status: "saving", failure: null, savedName: null });

            let response: SaveDrillResponse;
            try {
                response = await saveDrill({ ...values, name });
            } catch {
                response = { ok: false, code: "unexpected", message: SAVE_DRILL_MESSAGES.unexpected };
            }

            // Edited during the request: drop the outcome the way `markEdited` does after a reply, so neither `Saved "…"` nor an alert refers to the old values.
            const stale = takeEditedDuringSave();

            if (response.ok) {
                const name = options.keepAfterSave ? response.drill.name : "";
                publish(
                    stale
                        ? { name, nameError: null, status: "idle", failure: null, savedName: null }
                        : { name, nameError: null, status: "saved", failure: null, savedName: response.drill.name },
                );
                return;
            }
            const failure = failureFrom(response);
            publish({ ...snapshot, savedName: null, ...failure, status: stale ? "idle" : "error", failure: stale ? null : failure.failure });
        },

        markEdited() {
            if (snapshot.status === "saving") {
                editedDuringSave = true;
                return;
            }
            if (snapshot.status !== "saved" && snapshot.status !== "error") return;
            publish({ ...snapshot, status: "idle", failure: null, savedName: null });
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

type StatusCodes = Partial<Record<number, SaveDrillErrorCode>>;

// Used only when the reply body is unreadable; a readable server body always wins.
const POST_STATUS_CODES: StatusCodes = {
    400: "validation",
    401: "unauthorized",
    409: "limit_reached",
    413: "payload_too_large",
    415: "unsupported_media_type",
    503: "unavailable",
};

// On update a 409 is the name collision (the limit applies to inserts only) and a 404 is a vanished or foreign row.
const PUT_STATUS_CODES: StatusCodes = {
    ...POST_STATUS_CODES,
    404: "not_found",
    409: "duplicate_name",
};

function isSaveDrillResponse(value: unknown): value is SaveDrillResponse {
    if (typeof value !== "object" || value === null || !("ok" in value)) return false;
    if (value.ok === true) return "drill" in value && typeof value.drill === "object" && value.drill !== null && "name" in value.drill && typeof value.drill.name === "string";
    return value.ok === false && "code" in value && typeof value.code === "string" && "message" in value && typeof value.message === "string";
}

/** A network failure or an unreadable reply never throws. */
async function requestSaveDrill(method: "POST" | "PUT", url: string, statusCodes: StatusCodes, request: SaveDrillRequest, fetchImpl: typeof fetch): Promise<SaveDrillResponse> {
    let response: Response;
    try {
        response = await fetchImpl(url, {
            method,
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

    const code = statusCodes[response.status] ?? "unexpected";
    return { ok: false, code, message: SAVE_DRILL_MESSAGES[code] };
}

/** Default port of `/create`: posts the request as JSON. */
export function postSaveDrill(request: SaveDrillRequest, fetchImpl: typeof fetch = fetch): Promise<SaveDrillResponse> {
    return requestSaveDrill("POST", "/api/drills", POST_STATUS_CODES, request, fetchImpl);
}

/** Port of the edit page: puts the full request to the one saved timer. */
export function putSaveDrill(id: string, fetchImpl: typeof fetch = fetch): SaveDrillPort {
    return (request) => requestSaveDrill("PUT", `/api/drills/${encodeURIComponent(id)}`, PUT_STATUS_CODES, request, fetchImpl);
}
