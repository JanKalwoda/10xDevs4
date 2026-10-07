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
    not_found: "This timer does not exist or is not yours.",
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
    not_found: 404,
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

export type DrillConfigurationUpdate = Omit<DrillConfigurationInsert, "user_id">;

export interface DrillConfigurationRow extends DrillConfigurationInsert {
    id: string;
    created_at: string;
    updated_at: string;
}

// What the read queries select: every column except user_id (the pages never need it).
export type SavedDrillRow = Omit<DrillConfigurationRow, "user_id">;

export const SAVED_DRILL_COLUMNS = "id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled, created_at, updated_at";

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

export interface ListResult {
    data: SavedDrillRow[] | null;
    error: StoreError | null;
    status?: number;
}

export interface FindResult {
    data: SavedDrillRow | null;
    error: StoreError | null;
    status?: number;
}

export interface DrillConfigurationStore {
    insert(row: DrillConfigurationInsert): PromiseLike<StoreResult>;
    list(): PromiseLike<ListResult>;
    findById(id: string): PromiseLike<FindResult>;
    /** Zero matching rows (foreign, missing) is `data: null` without an error. */
    update(id: string, userId: string, fields: DrillConfigurationUpdate): PromiseLike<FindResult>;
}

export function createSupabaseDrillStore(client: SupabaseClient): DrillConfigurationStore {
    return {
        insert: (row) => client.from("drill_configurations").insert(row).select().single<DrillConfigurationRow>(),
        // RLS limits both reads to the caller's own rows; a foreign id is simply zero rows.
        list: () =>
            client
                .from("drill_configurations")
                .select(SAVED_DRILL_COLUMNS)
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .limit(MAX_SAVED_DRILLS)
                .overrideTypes<SavedDrillRow[], { merge: false }>(),
        findById: (id) => client.from("drill_configurations").select(SAVED_DRILL_COLUMNS).eq("id", id).maybeSingle<SavedDrillRow>(),
        // RLS already limits the update to the caller's rows; the user_id filter is defense in depth.
        // Only the six user-owned columns are sent (the column grant refuses the rest).
        update: (id, userId, fields) =>
            client.from("drill_configurations").update(fields).eq("id", id).eq("user_id", userId).select(SAVED_DRILL_COLUMNS).maybeSingle<SavedDrillRow>(),
    };
}

export function savedDrillFromRow(row: SavedDrillRow): SavedDrill {
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

type JsonRequest = { ok: true; input: unknown } | { ok: false; response: Response };

// Shared by POST and PUT: JSON content type only (anything else, including the CORS-simple types, is 415 before
// the body is read or the store is touched; with the preflight a JSON PUT forces, this is the CSRF protection),
// then the size limit, then the JSON parse.
async function readJsonRequest(request: Request): Promise<JsonRequest> {
    if (!isJsonMediaType(request.headers.get("content-type"))) {
        return { ok: false, response: toResponse(failure("unsupported_media_type", SAVE_DRILL_MESSAGES.unsupported_media_type)) };
    }

    const body = await readLimitedText(request);
    if (!body.ok) {
        return {
            ok: false,
            response:
                body.reason === "too_large"
                    ? toResponse(failure("payload_too_large", SAVE_DRILL_MESSAGES.payload_too_large))
                    : toResponse(failure("validation", SAVE_DRILL_MESSAGES.notJson)),
        };
    }

    try {
        return { ok: true, input: JSON.parse(body.text) as unknown };
    } catch {
        return { ok: false, response: toResponse(failure("validation", SAVE_DRILL_MESSAGES.notJson)) };
    }
}

// The whole POST /api/drills pipeline, kept free of Astro and Supabase so it can be tested with plain Requests.
export async function handleSaveDrillRequest(request: Request, context: SaveDrillRequestContext): Promise<Response> {
    if (context.userId === null) return toResponse(failure("unauthorized", SAVE_DRILL_MESSAGES.unauthorized));
    if (context.store === null) return toResponse(failure("unavailable", SAVE_DRILL_MESSAGES.unavailable));

    const json = await readJsonRequest(request);
    if (!json.ok) return json.response;

    return toResponse(await saveDrillConfiguration(context.store, context.userId, json.input, context.log));
}

export async function updateDrillConfiguration(
    store: DrillConfigurationStore,
    userId: string,
    id: string,
    input: unknown,
    log: DrillSaveLogger = defaultLogger,
): Promise<HandlerResult> {
    // A non-UUID id never reaches the database and cannot be told apart from a missing or foreign one.
    if (!isDrillId(id)) return failure("not_found", SAVE_DRILL_MESSAGES.not_found);

    const validated = validateSaveDrillRequest(input);
    if (!validated.valid) return failure("validation", validated.message, validated.fieldErrors);

    let result: FindResult;
    try {
        result = await store.update(normalizeDrillId(id), userId, {
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
        // The limit trigger is INSERT-only; a limit error here would be a database change nobody planned.
        const mapped = code === "limit_reached" ? "unexpected" : code;
        if (mapped === "unexpected" || mapped === "unavailable") log(result.error.code ?? "unknown");
        const fieldErrors = mapped === "duplicate_name" ? { name: SAVE_DRILL_MESSAGES.duplicate_name } : undefined;
        return failure(mapped, SAVE_DRILL_MESSAGES[mapped], fieldErrors);
    }

    // maybeSingle answers null for zero rows (RLS hides foreign rows, so foreign and missing look the same).
    if (result.data === null) return failure("not_found", SAVE_DRILL_MESSAGES.not_found);
    if (typeof result.data !== "object") {
        log("empty_result");
        return failure("unexpected", SAVE_DRILL_MESSAGES.unexpected);
    }

    return { status: 200, body: { ok: true, drill: savedDrillFromRow(result.data) } };
}

export interface UpdateDrillRequestContext extends SaveDrillRequestContext {
    id: string;
}

// The whole PUT /api/drills/{id} pipeline. Same order as POST, with the id guard before the body is read.
export async function handleUpdateDrillRequest(request: Request, context: UpdateDrillRequestContext): Promise<Response> {
    if (context.userId === null) return toResponse(failure("unauthorized", SAVE_DRILL_MESSAGES.unauthorized));
    if (context.store === null) return toResponse(failure("unavailable", SAVE_DRILL_MESSAGES.unavailable));
    if (!isDrillId(context.id)) return toResponse(failure("not_found", SAVE_DRILL_MESSAGES.not_found));

    const json = await readJsonRequest(request);
    if (!json.ok) return json.response;

    return toResponse(await updateDrillConfiguration(context.store, context.userId, context.id, json.input, context.log));
}

// Any method but PUT on /api/drills/{id}: no session, id or store is read, so the answer reveals nothing about ownership.
// DELETE is reserved for S-13 and is 405 until then.
export function methodNotAllowedResponse(): Response {
    return new Response(null, { status: 405, headers: { Allow: "PUT", "Cache-Control": "no-store" } });
}

export const OPEN_DRILL_MESSAGES = {
    unavailable: "Your saved timers are temporarily unavailable. Please try again later.",
    empty: "You have no saved timers yet.",
    notFound: SAVE_DRILL_MESSAGES.not_found,
} as const;

const DRILL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strict 8-4-4-4-12 hex only: no braces, no whitespace, no trailing slash or encoded separators.
export function isDrillId(value: unknown): value is string {
    return typeof value === "string" && DRILL_ID.test(value);
}

export function normalizeDrillId(value: string): string {
    return value.toLowerCase();
}

export type ListSavedDrillsResult = { kind: "ok"; drills: SavedDrill[] } | { kind: "unavailable" } | { kind: "unauthorized" };
export type GetSavedDrillResult = { kind: "ok"; drill: SavedDrill } | { kind: "not_found" } | { kind: "unavailable" } | { kind: "unauthorized" };

function readFailure(error: StoreError, status: number | undefined, log: DrillSaveLogger): "unavailable" | "unauthorized" {
    if (classifyStoreError(error, status) === "unauthorized") return "unauthorized";
    log(error.code ?? "unknown");
    return "unavailable";
}

// An empty list is only ever returned for a clean response with an array; every other shape is an outage,
// so a failure can never be shown as "you have no saved timers".
export async function listSavedDrills(store: DrillConfigurationStore, log: DrillSaveLogger = defaultLogger): Promise<ListSavedDrillsResult> {
    let result: ListResult;
    try {
        result = await store.list();
    } catch {
        log("store_exception");
        return { kind: "unavailable" };
    }

    if (result.error) return { kind: readFailure(result.error, result.status, log) };
    if (!Array.isArray(result.data)) {
        log("empty_result");
        return { kind: "unavailable" };
    }
    return { kind: "ok", drills: result.data.map(savedDrillFromRow) };
}

export async function getSavedDrill(store: DrillConfigurationStore, id: string, log: DrillSaveLogger = defaultLogger): Promise<GetSavedDrillResult> {
    // A non-UUID id never reaches the database (and cannot be told apart from a missing one).
    if (!isDrillId(id)) return { kind: "not_found" };

    let result: FindResult;
    try {
        result = await store.findById(normalizeDrillId(id));
    } catch {
        log("store_exception");
        return { kind: "unavailable" };
    }

    if (result.error) return { kind: readFailure(result.error, result.status, log) };
    // maybeSingle answers null for zero rows; anything that is not a row object is a malformed reply.
    if (result.data === null) return { kind: "not_found" };
    if (typeof result.data !== "object") {
        log("empty_result");
        return { kind: "unavailable" };
    }
    return { kind: "ok", drill: savedDrillFromRow(result.data) };
}

export type SavedDrillPage = { kind: "ok"; drill: SavedDrill } | { kind: "not_found" } | { kind: "unavailable" } | { kind: "sign_in" };

// The decision behind /{id}. A non-UUID comes first so a guest on a random path gets the same 404 as everyone
// (no redirect oracle); a missing user redirects before the store is touched, even if the middleware let it through.
export async function resolveSavedDrillPage(userId: string | null, id: string, store: DrillConfigurationStore | null, log?: DrillSaveLogger): Promise<SavedDrillPage> {
    if (!isDrillId(id)) return { kind: "not_found" };
    if (userId === null) return { kind: "sign_in" };
    if (store === null) return { kind: "unavailable" };

    const result = await getSavedDrill(store, id, log);
    return result.kind === "unauthorized" ? { kind: "sign_in" } : result;
}

export type DashboardPage = { kind: "ok"; drills: SavedDrill[] } | { kind: "unavailable" } | { kind: "sign_in" };

export async function resolveDashboardPage(userId: string | null, store: DrillConfigurationStore | null, log?: DrillSaveLogger): Promise<DashboardPage> {
    if (userId === null) return { kind: "sign_in" };
    if (store === null) return { kind: "unavailable" };

    const result = await listSavedDrills(store, log);
    return result.kind === "unauthorized" ? { kind: "sign_in" } : result;
}
