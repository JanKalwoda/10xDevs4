import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { parseDrillConfig } from "../drill-timer.ts";
import type { DrillConfiguration, SaveDrillErrorCode, SaveDrillFieldErrors, SaveDrillRequest, SaveDrillResponse, SavedDrill } from "../../types";

// The database enforces the same bounds (see 20261007120000_create_drill_configurations.sql);
// a unit test reads the migration and fails when these constants and the CHECKs drift apart.
export const MAX_SAVED_DRILLS = 50;
export const MAX_DRILL_NAME_LENGTH = 200;
export const MAX_REQUEST_BODY_BYTES = 4096;
export const DUPLICATE_NAME_INDEX = "drill_configurations_user_name_key";
export const LIMIT_REACHED_MESSAGE = "drill_configuration_limit_reached";

export const SAVE_DRILL_MESSAGES = {
    name: "Enter a name of 1 to 200 characters.",
    randomStartEnabled: "Choose whether the start is random.",
    validation: "Check the highlighted fields.",
    notJson: "Send a valid JSON body.",
    notObject: "Send the timer details as a JSON object.",
    unknownFields: "Remove unknown fields from the request.",
    duplicate_name: "You already have a timer with this name.",
    limit_reached: `You can save up to ${String(MAX_SAVED_DRILLS)} timers. Delete one to save another.`,
    unauthorized: "Sign in to save a timer.",
    unsupported_media_type: "Send the request as JSON.",
    payload_too_large: "The request is too large.",
    unavailable: "Saving timers is temporarily unavailable. Please try again later.",
    unexpected: "Something went wrong. Please try again.",
} as const;

const STATUS_BY_CODE: Record<SaveDrillErrorCode, number> = {
    validation: 400,
    unauthorized: 401,
    duplicate_name: 409,
    limit_reached: 409,
    payload_too_large: 413,
    unsupported_media_type: 415,
    unexpected: 500,
    unavailable: 503,
};

const requestShape = z.strictObject({
    name: z.string(),
    preparation: z.string(),
    exercise: z.string(),
    rest: z.string(),
    repetitions: z.string(),
    randomStartEnabled: z.boolean(),
});

const FIELD_KEYS = ["name", "preparation", "exercise", "rest", "repetitions", "randomStartEnabled"] as const;
const CONTROL_CHARACTER = /\p{Cc}/u;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function isFieldKey(value: unknown): value is keyof SaveDrillRequest {
    return typeof value === "string" && (FIELD_KEYS as readonly string[]).includes(value);
}

export type ValidatedSaveDrill = { valid: true; name: string; configuration: DrillConfiguration } | { valid: false; message: string; fieldErrors: SaveDrillFieldErrors };

// NFC first (so NFC and NFD forms of one text collapse to one name), control characters are rejected
// before trimming (so "Run\n" is an error, not "Run"), then trim; length counts code points like the database.
export function normalizeDrillName(value: string): string | null {
    const nfc = value.normalize("NFC");
    if (CONTROL_CHARACTER.test(nfc) || LONE_SURROGATE.test(nfc)) return null;

    const name = nfc.trim();
    let length = 0;
    for (const _codePoint of name) length += 1;
    return length >= 1 && length <= MAX_DRILL_NAME_LENGTH ? name : null;
}

function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

export function validateSaveDrillRequest(input: unknown): ValidatedSaveDrill {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return { valid: false, message: SAVE_DRILL_MESSAGES.notObject, fieldErrors: {} };
    }

    const record = input as Record<string, unknown>;
    const shape = requestShape.safeParse(input);
    const unknownFields = !shape.success && shape.error.issues.some((issue) => issue.code === "unrecognized_keys");

    const fieldErrors: SaveDrillFieldErrors = {};
    const name = normalizeDrillName(text(record.name));
    if (name === null) fieldErrors.name = SAVE_DRILL_MESSAGES.name;

    const config = parseDrillConfig({
        preparation: text(record.preparation),
        exercise: text(record.exercise),
        rest: text(record.rest),
        repetitions: text(record.repetitions),
        randomStartEnabled: record.randomStartEnabled === true,
    });
    if (!config.valid) Object.assign(fieldErrors, config.errors);

    if (!shape.success) {
        for (const issue of shape.error.issues) {
            const key = issue.path[0];
            if (key === "randomStartEnabled") fieldErrors.randomStartEnabled = SAVE_DRILL_MESSAGES.randomStartEnabled;
            else if (isFieldKey(key) && fieldErrors[key] === undefined) fieldErrors[key] = SAVE_DRILL_MESSAGES.validation;
        }
    }

    if (shape.success && name !== null && config.valid) {
        return { valid: true, name, configuration: config.configuration };
    }

    if (unknownFields && Object.keys(fieldErrors).length === 0) {
        return { valid: false, message: SAVE_DRILL_MESSAGES.unknownFields, fieldErrors };
    }
    return { valid: false, message: SAVE_DRILL_MESSAGES.validation, fieldErrors };
}

export interface DrillConfigurationInsert {
    user_id: string;
    name: string;
    preparation_seconds: number;
    exercise_seconds: number;
    rest_seconds: number;
    repetitions: number;
    random_start_enabled: boolean;
}

export interface DrillConfigurationRow extends DrillConfigurationInsert {
    id: string;
    created_at: string;
    updated_at: string;
}

export interface StoreError {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
}

// The supabase-js response shape, so the adapter below can hand the result through untouched.
export interface StoreResult {
    data: DrillConfigurationRow | null;
    error: StoreError | null;
    status?: number;
}

export interface DrillConfigurationStore {
    insert(row: DrillConfigurationInsert): PromiseLike<StoreResult>;
}

export function createSupabaseDrillStore(client: SupabaseClient): DrillConfigurationStore {
    return {
        insert: (row) => client.from("drill_configurations").insert(row).select().single<DrillConfigurationRow>(),
    };
}

export function savedDrillFromRow(row: DrillConfigurationRow): SavedDrill {
    return {
        id: row.id,
        name: row.name,
        configuration: {
            preparationSeconds: row.preparation_seconds,
            exerciseSeconds: row.exercise_seconds,
            restSeconds: row.rest_seconds,
            repetitions: row.repetitions,
            randomStartEnabled: row.random_start_enabled,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// Only the error code is ever logged, never the payload or the database message (they can echo the name).
export type DrillSaveLogger = (code: string) => void;

const defaultLogger: DrillSaveLogger = (code) => {
    // eslint-disable-next-line no-console
    console.error("drill save failed", code);
};

function failure(code: SaveDrillErrorCode, message: string, fieldErrors?: SaveDrillFieldErrors): HandlerResult {
    return { status: STATUS_BY_CODE[code], body: { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}

export interface HandlerResult {
    status: number;
    body: SaveDrillResponse;
}

export function classifyStoreError(error: StoreError, status?: number): SaveDrillErrorCode {
    const code = error.code ?? "";
    if (code === "23505" && `${error.message ?? ""} ${error.details ?? ""}`.includes(DUPLICATE_NAME_INDEX)) return "duplicate_name";
    // 54000 is the generic program_limit_exceeded class; only the limit trigger's own message counts as "limit reached".
    if (code === "54000" && `${error.message ?? ""} ${error.hint ?? ""}`.includes(LIMIT_REACHED_MESSAGE)) return "limit_reached";
    if (code === "PGRST301" || code === "PGRST303" || status === 401) return "unauthorized";
    if (code === "PGRST205" || code === "42P01") return "unavailable";
    return "unexpected";
}

export async function saveDrillConfiguration(store: DrillConfigurationStore, userId: string, input: unknown, log: DrillSaveLogger = defaultLogger): Promise<HandlerResult> {
    const validated = validateSaveDrillRequest(input);
    if (!validated.valid) return failure("validation", validated.message, validated.fieldErrors);

    let result: StoreResult;
    try {
        result = await store.insert({
            user_id: userId,
            name: validated.name,
            preparation_seconds: validated.configuration.preparationSeconds,
            exercise_seconds: validated.configuration.exerciseSeconds,
            rest_seconds: validated.configuration.restSeconds,
            repetitions: validated.configuration.repetitions,
            random_start_enabled: validated.configuration.randomStartEnabled,
        });
    } catch {
        log("store_exception");
        return failure("unexpected", SAVE_DRILL_MESSAGES.unexpected);
    }

    if (result.error) {
        const code = classifyStoreError(result.error, result.status);
        if (code === "unexpected" || code === "unavailable") log(result.error.code ?? "unknown");
        const fieldErrors = code === "duplicate_name" ? { name: SAVE_DRILL_MESSAGES.duplicate_name } : undefined;
        return failure(code, SAVE_DRILL_MESSAGES[code], fieldErrors);
    }

    if (!result.data) {
        log("empty_result");
        return failure("unexpected", SAVE_DRILL_MESSAGES.unexpected);
    }

    return { status: 201, body: { ok: true, drill: savedDrillFromRow(result.data) } };
}

export function isJsonMediaType(contentType: string | null): boolean {
    return (contentType ?? "").split(";")[0]?.trim().toLowerCase() === "application/json";
}

export type LimitedBody = { ok: true; text: string } | { ok: false; reason: "too_large" | "invalid_encoding" };

// Rejects from Content-Length when it is declared, and while streaming when it is not (or lies),
// so an oversized body is never buffered whole.
export async function readLimitedText(request: Request, maxBytes: number = MAX_REQUEST_BODY_BYTES): Promise<LimitedBody> {
    const declared = request.headers.get("content-length")?.trim();
    if (declared !== undefined && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
        return { ok: false, reason: "too_large" };
    }
    if (!request.body) return { ok: true, text: "" };

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return { ok: false, reason: "too_large" };
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch {
        return { ok: false, reason: "invalid_encoding" };
    }
}

export interface SaveDrillRequestContext {
    userId: string | null;
    store: DrillConfigurationStore | null;
    log?: DrillSaveLogger;
}

function toResponse(result: HandlerResult): Response {
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

// The whole POST /api/drills pipeline, kept free of Astro and Supabase so it can be tested with plain Requests.
export async function handleSaveDrillRequest(request: Request, context: SaveDrillRequestContext): Promise<Response> {
    if (context.userId === null) return toResponse(failure("unauthorized", SAVE_DRILL_MESSAGES.unauthorized));
    if (context.store === null) return toResponse(failure("unavailable", SAVE_DRILL_MESSAGES.unavailable));
    if (!isJsonMediaType(request.headers.get("content-type"))) {
        return toResponse(failure("unsupported_media_type", SAVE_DRILL_MESSAGES.unsupported_media_type));
    }

    const body = await readLimitedText(request);
    if (!body.ok) {
        return body.reason === "too_large"
            ? toResponse(failure("payload_too_large", SAVE_DRILL_MESSAGES.payload_too_large))
            : toResponse(failure("validation", SAVE_DRILL_MESSAGES.notJson));
    }

    let input: unknown;
    try {
        input = JSON.parse(body.text);
    } catch {
        return toResponse(failure("validation", SAVE_DRILL_MESSAGES.notJson));
    }

    return toResponse(await saveDrillConfiguration(context.store, context.userId, input, context.log));
}
