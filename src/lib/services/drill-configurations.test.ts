import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    DUPLICATE_NAME_INDEX,
    LIMIT_REACHED_MESSAGE,
    MAX_DRILL_NAME_LENGTH,
    MAX_REQUEST_BODY_BYTES,
    MAX_SAVED_DRILLS,
    SAVE_DRILL_MESSAGES,
    classifyStoreError,
    handleSaveDrillRequest,
    isJsonMediaType,
    normalizeDrillName,
    readLimitedText,
    saveDrillConfiguration,
    savedDrillFromRow,
    validateSaveDrillRequest,
    type DrillConfigurationInsert,
    type DrillConfigurationRow,
    type DrillConfigurationStore,
    type StoreResult,
} from "./drill-configurations.ts";
import { MAX_DRILL_SECONDS, MAX_REPETITIONS, parseDrillConfig } from "../drill-timer.ts";
import type { SaveDrillResponse } from "../../types";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const validRequest = {
    name: "Morning draw",
    preparation: "0:05",
    exercise: "0:04",
    rest: "0:02",
    repetitions: "3",
    randomStartEnabled: true,
};

const storedRow: DrillConfigurationRow = {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: USER_ID,
    name: "Morning draw",
    preparation_seconds: 5,
    exercise_seconds: 4,
    rest_seconds: 2,
    repetitions: 3,
    random_start_enabled: true,
    created_at: "2026-10-07T10:00:00+00:00",
    updated_at: "2026-10-07T10:00:00+00:00",
};

const ASTRAL = String.fromCodePoint(0x1f3af);

function storeReturning(result: StoreResult, inserted: DrillConfigurationInsert[] = []): DrillConfigurationStore {
    return {
        insert: (row) => {
            inserted.push(row);
            return Promise.resolve(result);
        },
        list: () => Promise.resolve({ data: [], error: null }),
        findById: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.reject(new Error("update is not used when saving")),
        delete: () => Promise.reject(new Error("delete is not used when saving")),
    };
}

function failingStore(error: StoreResult["error"], status?: number): DrillConfigurationStore {
    return storeReturning({ data: null, error, status });
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/drills", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

async function bodyOf(response: Response): Promise<SaveDrillResponse> {
    return (await response.json()) as SaveDrillResponse;
}

function invalidFields(input: unknown): string[] {
    const result = validateSaveDrillRequest(input);
    assert.ok(!result.valid);
    return Object.keys(result.fieldErrors).sort();
}

void test("a valid request yields the trimmed name and the seconds configuration", () => {
    const result = validateSaveDrillRequest({ ...validRequest, name: "  Morning draw  " });
    assert.deepEqual(result, {
        valid: true,
        name: "Morning draw",
        configuration: { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: true },
    });
});

void test("name edge cases: empty, whitespace-only, 200 vs 201 code points", () => {
    assert.deepEqual(invalidFields({ ...validRequest, name: "" }), ["name"]);
    assert.deepEqual(invalidFields({ ...validRequest, name: "   " }), ["name"]);
    assert.equal(normalizeDrillName("a".repeat(MAX_DRILL_NAME_LENGTH)), "a".repeat(MAX_DRILL_NAME_LENGTH));
    assert.equal(normalizeDrillName("a".repeat(MAX_DRILL_NAME_LENGTH + 1)), null);

    // Astral characters are two UTF-16 units but one code point, like char_length in Postgres.
    const astral200 = ASTRAL.repeat(MAX_DRILL_NAME_LENGTH);
    assert.equal(astral200.length, MAX_DRILL_NAME_LENGTH * 2);
    assert.equal(normalizeDrillName(astral200), astral200);
    assert.equal(normalizeDrillName(astral200 + ASTRAL), null);

    const result = validateSaveDrillRequest({ ...validRequest, name: "" });
    assert.equal(!result.valid && result.fieldErrors.name, SAVE_DRILL_MESSAGES.name);
});

void test("NFC and NFD spellings normalise to one stored name", () => {
    const nfc = "Café";
    const nfd = "Café";
    assert.notEqual(nfc, nfd);
    assert.equal(normalizeDrillName(nfd), nfc);
    assert.equal(normalizeDrillName(nfc), nfc);
});

void test("control characters and lone surrogates are rejected, also at the edges", () => {
    for (const name of ["Run\tfast", "Run\nfast", "Run\n", "\tRun", "Run\u0000", "Run\u007f", "Run\u0085", "Run\u009f", "Run\ud800", "\udc00Run"]) {
        assert.equal(normalizeDrillName(name), null, JSON.stringify(name));
    }
    assert.equal(normalizeDrillName("  Run fast  "), "Run fast");
});

void test("every parameter bound agrees with parseDrillConfig and reports all errors at once", () => {
    const base = { preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1", randomStartEnabled: false };
    const max = `${String(Math.floor(MAX_DRILL_SECONDS / 60))}:00`;
    const over = `${String(Math.floor(MAX_DRILL_SECONDS / 60))}:01`;

    for (const input of [{ ...base, preparation: max, exercise: max, rest: max, repetitions: String(MAX_REPETITIONS) }, base]) {
        assert.equal(parseDrillConfig(input).valid, true);
        assert.equal(validateSaveDrillRequest({ name: "x", ...input }).valid, true);
    }
    for (const field of ["preparation", "exercise", "rest"] as const) {
        const input = { ...base, [field]: over };
        assert.equal(parseDrillConfig(input).valid, false);
        assert.deepEqual(invalidFields({ name: "x", ...input }), [field]);
    }
    assert.deepEqual(invalidFields({ name: "x", ...base, exercise: "0:00" }), ["exercise"]);
    assert.deepEqual(invalidFields({ name: "x", ...base, repetitions: "0" }), ["repetitions"]);
    assert.deepEqual(invalidFields({ name: "x", ...base, repetitions: String(MAX_REPETITIONS + 1) }), ["repetitions"]);

    assert.deepEqual(invalidFields({ name: "", preparation: "x", exercise: "x", rest: "x", repetitions: "x", randomStartEnabled: false }), [
        "exercise",
        "name",
        "preparation",
        "repetitions",
        "rest",
    ]);
});

void test("wrong types, missing fields, unknown keys and non-objects are validation errors", () => {
    assert.deepEqual(invalidFields({ ...validRequest, randomStartEnabled: "yes" }), ["randomStartEnabled"]);
    assert.deepEqual(invalidFields({ ...validRequest, repetitions: 3 }), ["repetitions"]);
    assert.deepEqual(invalidFields({ ...validRequest, name: 42 }), ["name"]);
    assert.deepEqual(invalidFields({ name: "x" }), ["exercise", "preparation", "randomStartEnabled", "repetitions", "rest"]);

    const unknown = validateSaveDrillRequest({ ...validRequest, user_id: USER_ID });
    assert.deepEqual(unknown, { valid: false, message: SAVE_DRILL_MESSAGES.unknownFields, fieldErrors: {} });

    for (const input of [null, "text", 7, [], undefined]) {
        assert.deepEqual(validateSaveDrillRequest(input), { valid: false, message: SAVE_DRILL_MESSAGES.notObject, fieldErrors: {} });
    }
});

void test("a successful save sends seconds and the session user, and returns the DTO", async () => {
    const inserted: DrillConfigurationInsert[] = [];
    const result = await saveDrillConfiguration(storeReturning({ data: storedRow, error: null }, inserted), USER_ID, { ...validRequest, name: " Morning draw " });

    assert.equal(result.status, 201);
    assert.deepEqual(inserted, [
        {
            user_id: USER_ID,
            name: "Morning draw",
            preparation_seconds: 5,
            exercise_seconds: 4,
            rest_seconds: 2,
            repetitions: 3,
            random_start_enabled: true,
        },
    ]);
    assert.deepEqual(result.body, {
        ok: true,
        drill: {
            id: storedRow.id,
            name: "Morning draw",
            configuration: { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: true },
            createdAt: storedRow.created_at,
            updatedAt: storedRow.updated_at,
        },
    });
});

void test("a client-supplied user_id or id never reaches the store", async () => {
    const inserted: DrillConfigurationInsert[] = [];
    const result = await saveDrillConfiguration(storeReturning({ data: storedRow, error: null }, inserted), USER_ID, { ...validRequest, user_id: "x", id: "y" });
    assert.equal(result.status, 400);
    assert.deepEqual(inserted, []);
});

void test("savedDrillFromRow maps snake_case rows", () => {
    assert.deepEqual(savedDrillFromRow({ ...storedRow, random_start_enabled: false, repetitions: 9 }).configuration, {
        preparationSeconds: 5,
        exerciseSeconds: 4,
        restSeconds: 2,
        repetitions: 9,
        randomStartEnabled: false,
    });
});

void test("store errors map to stable codes, statuses and English messages", async () => {
    const unavailable = "Saving timers is temporarily unavailable. Please try again later.";
    const unauthorized = "Sign in to save a timer.";
    const cases: { error: StoreResult["error"]; status?: number; http: number; code: string; message: string }[] = [
        {
            error: { code: "23505", message: `duplicate key value violates unique constraint "${DUPLICATE_NAME_INDEX}"` },
            http: 409,
            code: "duplicate_name",
            message: "You already have a timer with this name.",
        },
        {
            error: { code: "54000", message: "drill_configuration_limit_reached" },
            http: 409,
            code: "limit_reached",
            message: "You can save up to 50 timers. Delete one to save another.",
        },
        { error: { code: "PGRST301", message: "JWT expired" }, status: 401, http: 401, code: "unauthorized", message: unauthorized },
        { error: { code: "PGRST303", message: "JWT invalid" }, http: 401, code: "unauthorized", message: unauthorized },
        { error: { code: "", message: "Unauthorized" }, status: 401, http: 401, code: "unauthorized", message: unauthorized },
        { error: { code: "PGRST205", message: "Could not find the table" }, http: 503, code: "unavailable", message: unavailable },
        { error: { code: "42P01", message: 'relation "drill_configurations" does not exist' }, http: 503, code: "unavailable", message: unavailable },
        {
            error: { code: "23505", message: 'duplicate key value violates unique constraint "drill_configurations_pkey"' },
            http: 500,
            code: "unexpected",
            message: "Something went wrong. Please try again.",
        },
        { error: { code: "XX000", message: "boom" }, http: 500, code: "unexpected", message: "Something went wrong. Please try again." },
    ];

    for (const { error, status, http, code, message } of cases) {
        const result = await saveDrillConfiguration(failingStore(error, status), USER_ID, validRequest, () => undefined);
        assert.equal(result.status, http, code);
        assert.equal(!result.body.ok && result.body.code, code);
        assert.equal(!result.body.ok && result.body.message, message);
    }
});

void test("duplicate_name puts the error on the name field", async () => {
    const result = await saveDrillConfiguration(failingStore({ code: "23505", message: `violates unique constraint "${DUPLICATE_NAME_INDEX}"` }), USER_ID, validRequest);
    assert.deepEqual(!result.body.ok && result.body.fieldErrors, { name: "You already have a timer with this name." });
});

void test("54000 is the limit only when it carries the limit trigger's message", async () => {
    assert.equal(classifyStoreError({ code: "54000", message: LIMIT_REACHED_MESSAGE }), "limit_reached");
    assert.equal(classifyStoreError({ code: "54000", message: "", hint: LIMIT_REACHED_MESSAGE }), "limit_reached");
    assert.equal(classifyStoreError({ code: "54000", message: "index row size exceeds maximum" }), "unexpected");
    assert.equal(classifyStoreError({ code: "54000" }), "unexpected");
    assert.equal(classifyStoreError({ code: "23505", message: LIMIT_REACHED_MESSAGE }), "unexpected");

    const logged: string[] = [];
    const result = await saveDrillConfiguration(failingStore({ code: "54000", message: "some other limit" }), USER_ID, validRequest, (code) => logged.push(code));
    assert.equal(result.status, 500);
    assert.equal(!result.body.ok && result.body.code, "unexpected");
    assert.deepEqual(logged, ["54000"]);
});

void test("classifyStoreError reads the 401 status without a code", () => {
    assert.equal(classifyStoreError({}, 401), "unauthorized");
    assert.equal(classifyStoreError({}, 500), "unexpected");
});

void test("an empty result and a throwing store are unexpected, and logs carry the code only", async () => {
    const logged: string[] = [];
    const secretName = "Top secret drill name";
    const request = { ...validRequest, name: secretName };

    const empty = await saveDrillConfiguration(storeReturning({ data: null, error: null }), USER_ID, request, (code) => logged.push(code));
    const throwing = { ...storeReturning({ data: null, error: null }), insert: () => Promise.reject(new Error(`network down for ${secretName}`)) };
    const thrown = await saveDrillConfiguration(throwing, USER_ID, request, (code) => logged.push(code));
    const db = await saveDrillConfiguration(failingStore({ code: "XX000", message: `failed on ${secretName}` }), USER_ID, request, (code) => logged.push(code));

    assert.equal(empty.status, 500);
    assert.equal(thrown.status, 500);
    assert.equal(db.status, 500);
    assert.deepEqual(logged, ["empty_result", "store_exception", "XX000"]);
    assert.equal(JSON.stringify(logged).includes(secretName), false);
    assert.equal(JSON.stringify([empty, thrown, db]).includes(secretName), false);
});

void test("expected business errors are not logged", async () => {
    const logged: string[] = [];
    await saveDrillConfiguration(failingStore({ code: "54000", message: LIMIT_REACHED_MESSAGE }), USER_ID, validRequest, (code) => logged.push(code));
    await saveDrillConfiguration(failingStore({ code: "PGRST301" }), USER_ID, validRequest, (code) => logged.push(code));
    assert.deepEqual(logged, []);
});

void test("media type: charset parameters pass, look-alikes and CORS simple types fail", () => {
    assert.equal(isJsonMediaType("application/json"), true);
    assert.equal(isJsonMediaType("application/json; charset=utf-8"), true);
    assert.equal(isJsonMediaType("Application/JSON ;charset=UTF-8"), true);
    for (const value of [null, "", "text/plain", "application/jsonx", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "text/json", "x/application/json"]) {
        assert.equal(isJsonMediaType(value), false, String(value));
    }
});

void test("the body reader accepts the cap and rejects one byte more, declared or streamed", async () => {
    const exact = "a".repeat(MAX_REQUEST_BODY_BYTES);
    assert.deepEqual(await readLimitedText(new Request("http://localhost/", { method: "POST", body: exact })), { ok: true, text: exact });
    assert.deepEqual(await readLimitedText(new Request("http://localhost/", { method: "POST", body: exact + "a" })), { ok: false, reason: "too_large" });

    // Content-Length rejects before any read, even when the actual body is small.
    const lying = new Request("http://localhost/", { method: "POST", body: "{}", headers: { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) } });
    assert.deepEqual(await readLimitedText(lying), { ok: false, reason: "too_large" });

    // No Content-Length (chunked): the stream is cut off at the cap and not drained.
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            pulled += 1;
            controller.enqueue(new Uint8Array(1024));
            if (pulled > 100) controller.close();
        },
    });
    const chunked = new Request("http://localhost/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    assert.deepEqual(await readLimitedText(chunked), { ok: false, reason: "too_large" });
    assert.ok(pulled <= 10, `the stream was pulled ${String(pulled)} times`);

    // The cap is in bytes, not characters.
    const multibyte = ASTRAL.repeat(MAX_REQUEST_BODY_BYTES / 4 + 1);
    assert.deepEqual(await readLimitedText(new Request("http://localhost/", { method: "POST", body: multibyte })), { ok: false, reason: "too_large" });

    assert.deepEqual(await readLimitedText(new Request("http://localhost/", { method: "POST", body: new Uint8Array([0xff, 0xfe]) })), { ok: false, reason: "invalid_encoding" });
});

void test("the handler answers 401 before anything else and 503 without a store", async () => {
    const store = storeReturning({ data: storedRow, error: null });
    const anonymous = await handleSaveDrillRequest(jsonRequest(validRequest), { userId: null, store });
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await bodyOf(anonymous), { ok: false, code: "unauthorized", message: "Sign in to save a timer." });
    assert.equal(anonymous.headers.get("cache-control"), "no-store");

    const noStore = await handleSaveDrillRequest(jsonRequest(validRequest), { userId: USER_ID, store: null });
    assert.equal(noStore.status, 503);
    assert.equal((await bodyOf(noStore)).ok, false);
});

void test("the handler maps media type, size, JSON and validation failures", async () => {
    const inserted: DrillConfigurationInsert[] = [];
    const context = { userId: USER_ID, store: storeReturning({ data: storedRow, error: null }, inserted) };

    const textPlain = await handleSaveDrillRequest(jsonRequest(validRequest, { "content-type": "text/plain" }), context);
    assert.equal(textPlain.status, 415);
    assert.deepEqual(await bodyOf(textPlain), { ok: false, code: "unsupported_media_type", message: "Send the request as JSON." });

    const form = new Request("http://localhost/api/drills", { method: "POST", body: new URLSearchParams({ name: "x" }) });
    assert.equal((await handleSaveDrillRequest(form, context)).status, 415);

    const tooLarge = await handleSaveDrillRequest(jsonRequest({ ...validRequest, name: "a".repeat(MAX_REQUEST_BODY_BYTES) }), context);
    assert.equal(tooLarge.status, 413);
    const tooLargeBody = await bodyOf(tooLarge);
    assert.equal(!tooLargeBody.ok && tooLargeBody.code, "payload_too_large");

    const broken = await handleSaveDrillRequest(jsonRequest("{not json"), context);
    assert.equal(broken.status, 400);
    assert.deepEqual(await bodyOf(broken), { ok: false, code: "validation", message: "Send a valid JSON body." });

    const invalid = await handleSaveDrillRequest(jsonRequest({ ...validRequest, rest: "99:99" }), context);
    assert.equal(invalid.status, 400);
    const invalidBody = await bodyOf(invalid);
    assert.equal(!invalidBody.ok && invalidBody.code, "validation");
    assert.deepEqual(!invalidBody.ok && Object.keys(invalidBody.fieldErrors ?? {}), ["rest"]);

    assert.deepEqual(inserted, []);
});

void test("the handler accepts a charset parameter and returns 201 with the DTO", async () => {
    const inserted: DrillConfigurationInsert[] = [];
    const response = await handleSaveDrillRequest(jsonRequest(validRequest, { "content-type": "application/json; charset=utf-8" }), {
        userId: USER_ID,
        store: storeReturning({ data: storedRow, error: null }, inserted),
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await bodyOf(response);
    assert.equal(body.ok && body.drill.name, "Morning draw");
    assert.equal(inserted[0]?.user_id, USER_ID);
});

void test("service constants match the CHECKs and the limit in the migration", async () => {
    const sql = await readFile(new URL("../../../supabase/migrations/20261007120000_create_drill_configurations.sql", import.meta.url), "utf8");

    assert.match(sql, new RegExp(`check \\(char_length\\(name\\) between 1 and ${String(MAX_DRILL_NAME_LENGTH)}\\)`));
    assert.match(sql, new RegExp(`preparation_range check \\(preparation_seconds between 0 and ${String(MAX_DRILL_SECONDS)}\\)`));
    assert.match(sql, new RegExp(`exercise_range check \\(exercise_seconds between 1 and ${String(MAX_DRILL_SECONDS)}\\)`));
    assert.match(sql, new RegExp(`rest_range check \\(rest_seconds between 0 and ${String(MAX_DRILL_SECONDS)}\\)`));
    assert.match(sql, new RegExp(`repetitions_range check \\(repetitions between 1 and ${String(MAX_REPETITIONS)}\\)`));
    assert.match(sql, new RegExp(`\\) >= ${String(MAX_SAVED_DRILLS)} then`));
    assert.match(sql, new RegExp(`create unique index ${DUPLICATE_NAME_INDEX} on`));
    assert.match(sql, /errcode = '54000'/);
    assert.ok(sql.includes(`raise exception '${LIMIT_REACHED_MESSAGE}'`));
});
