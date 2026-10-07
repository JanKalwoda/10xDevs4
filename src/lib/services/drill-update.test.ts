import assert from "node:assert/strict";
import test from "node:test";

import {
    DUPLICATE_NAME_INDEX,
    LIMIT_REACHED_MESSAGE,
    MAX_DRILL_NAME_LENGTH,
    OPEN_DRILL_MESSAGES,
    SAVE_DRILL_MESSAGES,
    handleUpdateDrillRequest,
    methodNotAllowedResponse,
    updateDrillConfiguration,
    type DrillConfigurationStore,
    type DrillConfigurationUpdate,
    type FindResult,
    type SavedDrillRow,
} from "./drill-configurations.ts";
import type { SaveDrillResponse } from "../../types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

const validRequest = { name: "Evening draw", preparation: "0:10", exercise: "0:03", rest: "0:07", repetitions: "4", randomStartEnabled: false };

const updatedRow: SavedDrillRow = {
    id: ID,
    name: "Evening draw",
    preparation_seconds: 10,
    exercise_seconds: 3,
    rest_seconds: 7,
    repetitions: 4,
    random_start_enabled: false,
    created_at: "2026-10-07T10:00:00+00:00",
    updated_at: "2026-10-07T11:00:00+00:00",
};

interface Call {
    id: string;
    userId: string;
    fields: DrillConfigurationUpdate;
}

function storeReturning(result: FindResult, calls: Call[] = []): DrillConfigurationStore {
    return {
        insert: () => Promise.reject(new Error("insert is not used when updating")),
        list: () => Promise.reject(new Error("list is not used when updating")),
        findById: () => Promise.reject(new Error("findById is not used when updating")),
        update: (id, userId, fields) => {
            calls.push({ id, userId, fields });
            return Promise.resolve(result);
        },
    };
}

function putRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(`http://localhost/api/drills/${ID}`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

void test("a successful update sends only the six user-owned columns and maps the row", async () => {
    const calls: Call[] = [];
    const result = await updateDrillConfiguration(storeReturning({ data: updatedRow, error: null }, calls), USER_ID, ID, validRequest);

    assert.equal(result.status, 200);
    assert.deepEqual(calls, [
        {
            id: ID,
            userId: USER_ID,
            fields: { name: "Evening draw", preparation_seconds: 10, exercise_seconds: 3, rest_seconds: 7, repetitions: 4, random_start_enabled: false },
        },
    ]);
    assert.ok(result.body.ok);
    assert.equal(result.body.drill.id, ID);
    assert.equal(result.body.drill.name, "Evening draw");
    assert.deepEqual(result.body.drill.configuration, { preparationSeconds: 10, exerciseSeconds: 3, restSeconds: 7, repetitions: 4, randomStartEnabled: false });
    assert.equal(result.body.drill.updatedAt, updatedRow.updated_at);
});

void test("the id is lower-cased before the query", async () => {
    const calls: Call[] = [];
    await updateDrillConfiguration(storeReturning({ data: updatedRow, error: null }, calls), USER_ID, ID.toUpperCase(), validRequest);
    assert.equal(calls[0]?.id, ID);
});

void test("name rules are the save rules: 200 code points pass, 201 fail, NFD collapses, control characters fail", async () => {
    const calls: Call[] = [];
    const store = storeReturning({ data: updatedRow, error: null }, calls);

    const max = await updateDrillConfiguration(store, USER_ID, ID, { ...validRequest, name: "a".repeat(MAX_DRILL_NAME_LENGTH) });
    const nfd = await updateDrillConfiguration(store, USER_ID, ID, { ...validRequest, name: "Café" });
    assert.equal(max.status, 200);
    assert.equal(nfd.status, 200);
    assert.equal(calls[1]?.fields.name, "Café");

    const before = calls.length;
    for (const name of ["a".repeat(MAX_DRILL_NAME_LENGTH + 1), "Run\n", "   "]) {
        const rejected = await updateDrillConfiguration(store, USER_ID, ID, { ...validRequest, name });
        assert.equal(rejected.status, 400);
        assert.equal(!rejected.body.ok && rejected.body.fieldErrors?.name, SAVE_DRILL_MESSAGES.name);
    }
    assert.equal(calls.length, before);
});

void test("parameter ranges and unknown fields are rejected without touching the store", async () => {
    const calls: Call[] = [];
    const store = storeReturning({ data: updatedRow, error: null }, calls);

    for (const bad of [{ exercise: "0:00" }, { rest: "99:99" }, { repetitions: "0" }, { repetitions: "101" }, { preparation: "10:01" }, { randomStartEnabled: "yes" }]) {
        const result = await updateDrillConfiguration(store, USER_ID, ID, { ...validRequest, ...bad });
        assert.equal(result.status, 400, JSON.stringify(bad));
    }
    for (const extra of ["id", "user_id", "created_at"]) {
        const result = await updateDrillConfiguration(store, USER_ID, ID, { ...validRequest, [extra]: "x" });
        assert.equal(result.status, 400, extra);
    }
    assert.equal((await updateDrillConfiguration(store, USER_ID, ID, "text")).status, 400);
    assert.deepEqual(calls, []);
});

void test("zero rows (foreign or missing) is the same 404 for every id", async () => {
    const store = storeReturning({ data: null, error: null });
    const foreign = await updateDrillConfiguration(store, USER_ID, ID, validRequest);
    const missing = await updateDrillConfiguration(store, USER_ID, OTHER_ID, validRequest);

    assert.equal(foreign.status, 404);
    assert.deepEqual(foreign, missing);
    assert.deepEqual(foreign.body, { ok: false, code: "not_found", message: OPEN_DRILL_MESSAGES.notFound });
    assert.equal(JSON.stringify(foreign).includes(ID), false);
});

void test("a non-UUID id is the same 404 and never reaches the store", async () => {
    const calls: Call[] = [];
    const store = storeReturning({ data: updatedRow, error: null }, calls);
    const reference = await updateDrillConfiguration(storeReturning({ data: null, error: null }), USER_ID, ID, validRequest);

    for (const id of ["not-a-uuid", "", ` ${ID}`, `${ID} `, `${ID}/`, `{${ID}}`, ID.replaceAll("-", "")]) {
        assert.deepEqual(await updateDrillConfiguration(store, USER_ID, id, validRequest), reference, JSON.stringify(id));
    }
    assert.deepEqual(calls, []);
});

void test("store errors: duplicate name is 409, outage 503, unauthorized 401, a limit error is unexpected, logs carry only the code", async () => {
    const logged: string[] = [];
    const secret = "Top secret name";
    const run = (error: NonNullable<FindResult["error"]>, status?: number) =>
        updateDrillConfiguration(storeReturning({ data: null, error, status }), USER_ID, ID, { ...validRequest, name: secret }, (code) => logged.push(code));

    const duplicate = await run({ code: "23505", message: `duplicate key value violates unique constraint "${DUPLICATE_NAME_INDEX}"` });
    const otherUnique = await run({ code: "23505", message: 'violates unique constraint "something_else"' });
    const outage = await run({ code: "PGRST205" });
    const unauthorized = await run({ code: "PGRST301" });
    const unauthorizedStatus = await run({ message: "jwt" }, 401);
    const limit = await run({ code: "54000", message: LIMIT_REACHED_MESSAGE });
    const unknown = await run({ code: "XX000", message: `failed on ${secret}` });

    assert.equal(duplicate.status, 409);
    assert.deepEqual(duplicate.body, { ok: false, code: "duplicate_name", message: SAVE_DRILL_MESSAGES.duplicate_name, fieldErrors: { name: SAVE_DRILL_MESSAGES.duplicate_name } });
    assert.equal(otherUnique.status, 500);
    assert.equal(outage.status, 503);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorizedStatus.status, 401);
    assert.equal(limit.status, 500);
    assert.equal(unknown.status, 500);
    assert.equal(JSON.stringify(logged).includes(secret), false);
    assert.deepEqual(logged, ["23505", "PGRST205", "54000", "XX000"]);
});

void test("a throwing store and a malformed reply are unexpected", async () => {
    const logged: string[] = [];
    const throwing: DrillConfigurationStore = { ...storeReturning({ data: null, error: null }), update: () => Promise.reject(new Error("network down")) };
    const thrown = await updateDrillConfiguration(throwing, USER_ID, ID, validRequest, (code) => logged.push(code));
    const malformed = await updateDrillConfiguration(storeReturning({ data: "oops" as unknown as SavedDrillRow, error: null }), USER_ID, ID, validRequest, (code) =>
        logged.push(code),
    );

    assert.equal(thrown.status, 500);
    assert.equal(malformed.status, 500);
    assert.deepEqual(logged, ["store_exception", "empty_result"]);
});

void test("handler order: 401, then 503, then 404 for a bad id, then 415, 413, 400 (store untouched until valid)", async () => {
    const calls: Call[] = [];
    const store = storeReturning({ data: updatedRow, error: null }, calls);
    const context = { id: ID, userId: USER_ID, store };

    const anonymous = await handleUpdateDrillRequest(putRequest(validRequest), { ...context, userId: null });
    const noStore = await handleUpdateDrillRequest(putRequest(validRequest), { ...context, store: null });
    const badId = await handleUpdateDrillRequest(putRequest(validRequest), { ...context, id: "nope" });
    const anonymousBadId = await handleUpdateDrillRequest(putRequest(validRequest), { ...context, id: "nope", userId: null });
    assert.equal(anonymous.status, 401);
    assert.equal(noStore.status, 503);
    assert.equal(badId.status, 404);
    assert.equal(anonymousBadId.status, 401);
    assert.equal(anonymous.headers.get("cache-control"), "no-store");

    assert.equal((await handleUpdateDrillRequest(putRequest("{not json"), context)).status, 400);
    assert.equal((await handleUpdateDrillRequest(putRequest({ ...validRequest, rest: "99:99" }), context)).status, 400);
    assert.equal((await handleUpdateDrillRequest(putRequest({ ...validRequest, name: "a".repeat(5000) }), context)).status, 413);
    assert.deepEqual(calls, []);

    const ok = await handleUpdateDrillRequest(putRequest(validRequest, { "content-type": "application/json; charset=utf-8" }), context);
    assert.equal(ok.status, 200);
    assert.equal(calls.length, 1);
});

void test("CSRF assumption: only JSON is accepted; text/plain and form bodies are 415 without a store call", async () => {
    const calls: Call[] = [];
    const context = { id: ID, userId: USER_ID, store: storeReturning({ data: updatedRow, error: null }, calls) };
    const body = JSON.stringify(validRequest);

    for (const contentType of ["text/plain", "text/plain;charset=UTF-8", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "application/jsonp", ""]) {
        const response = await handleUpdateDrillRequest(
            new Request(`http://localhost/api/drills/${ID}`, { method: "PUT", headers: { "content-type": contentType }, body }),
            context,
        );
        assert.equal(response.status, 415, contentType);
    }
    const form = new Request(`http://localhost/api/drills/${ID}`, { method: "PUT", body: new URLSearchParams({ name: "x" }) });
    assert.equal((await handleUpdateDrillRequest(form, context)).status, 415);
    assert.deepEqual(calls, []);
});

void test("a foreign row, a missing row and a non-UUID give byte-identical responses through the handler", async () => {
    const run = async (id: string) => {
        const response = await handleUpdateDrillRequest(putRequest(validRequest), { id, userId: USER_ID, store: storeReturning({ data: null, error: null }) });
        return { status: response.status, body: await response.text(), cache: response.headers.get("cache-control"), type: response.headers.get("content-type") };
    };
    const foreign = await run(ID);
    const missing = await run(OTHER_ID);
    const nonUuid = await run("not-a-uuid");

    assert.equal(foreign.status, 404);
    assert.deepEqual(missing, foreign);
    assert.deepEqual(nonUuid, foreign);
    assert.equal(foreign.body.includes(ID), false);
});

void test("the success body is the saved drill and is never cached", async () => {
    const response = await handleUpdateDrillRequest(putRequest(validRequest), { id: ID, userId: USER_ID, store: storeReturning({ data: updatedRow, error: null }) });
    const body = (await response.json()) as SaveDrillResponse;

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.ok && body.drill.name, "Evening draw");
});

void test("the answer for methods other than PUT is a bodiless 405 with Allow: PUT and no-store", async () => {
    const response = methodNotAllowedResponse();
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "PUT");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
});
