import assert from "node:assert/strict";
import test from "node:test";

import { SAVE_DRILL_MESSAGES, deleteDrillConfiguration, handleDeleteDrillRequest, type DeleteResult, type DrillConfigurationStore } from "./drill-configurations.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

interface Call {
    id: string;
    userId: string;
}

function storeReturning(result: DeleteResult, calls: Call[] = []): DrillConfigurationStore {
    return {
        insert: () => Promise.reject(new Error("insert is not used when deleting")),
        list: () => Promise.reject(new Error("list is not used when deleting")),
        findById: () => Promise.reject(new Error("findById is not used when deleting")),
        update: () => Promise.reject(new Error("update is not used when deleting")),
        delete: (id, userId) => {
            calls.push({ id, userId });
            return Promise.resolve(result);
        },
    };
}

function deleteRequest(init: RequestInit = {}): Request {
    return new Request(`http://localhost/api/drills/${ID}`, { method: "DELETE", ...init });
}

const deleted: DeleteResult = { data: { id: ID }, error: null };
const noRow: DeleteResult = { data: null, error: null };

void test("an own timer is deleted: 204, empty body, no-store, and the store gets the lower-cased id and the user", async () => {
    const calls: Call[] = [];
    const response = await handleDeleteDrillRequest(deleteRequest(), { id: ID.toUpperCase(), userId: USER_ID, store: storeReturning(deleted, calls) });

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls, [{ id: ID, userId: USER_ID }]);
});

void test("a request body or a text/plain content type on DELETE is ignored", async () => {
    const calls: Call[] = [];
    const store = storeReturning(deleted, calls);
    const withBody = await handleDeleteDrillRequest(deleteRequest({ headers: { "content-type": "text/plain" }, body: "whatever" }), { id: ID, userId: USER_ID, store });
    const withJson = await handleDeleteDrillRequest(deleteRequest({ headers: { "content-type": "application/json" }, body: "{not json" }), { id: ID, userId: USER_ID, store });

    assert.equal(withBody.status, 204);
    assert.equal(withJson.status, 204);
    assert.equal(calls.length, 2);
});

void test("foreign, missing, already deleted and non-UUID ids give the same bytes: status, body, cache-control, content-type", async () => {
    const calls: Call[] = [];
    const context = { userId: USER_ID, store: storeReturning(noRow, calls) };

    const foreign = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: OTHER_ID });
    const second = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: ID });
    const malformed = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: "not-a-uuid" });
    const braces = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: `{${ID}}` });
    const trailing = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: `${ID}/` });

    const bytes = async (response: Response) => ({
        status: response.status,
        body: await response.text(),
        cache: response.headers.get("cache-control"),
        type: response.headers.get("content-type"),
    });
    const expected = await bytes(foreign);

    assert.equal(expected.status, 404);
    assert.equal((JSON.parse(expected.body) as { message: string }).message, SAVE_DRILL_MESSAGES.not_found);
    assert.equal(expected.body.includes(OTHER_ID), false);
    for (const other of [second, malformed, braces, trailing]) assert.deepEqual(await bytes(other), expected);
    // Only the two well-formed ids reached the store.
    assert.deepEqual(
        calls.map((call) => call.id),
        [OTHER_ID, ID],
    );
});

void test("handler order: 401, then 503, then 404 for a bad id (store untouched)", async () => {
    const calls: Call[] = [];
    const context = { id: ID, userId: USER_ID, store: storeReturning(deleted, calls) };

    const anonymous = await handleDeleteDrillRequest(deleteRequest(), { ...context, userId: null });
    const anonymousBadId = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: "nope", userId: null });
    const noStore = await handleDeleteDrillRequest(deleteRequest(), { ...context, store: null });
    const badId = await handleDeleteDrillRequest(deleteRequest(), { ...context, id: "nope" });

    assert.equal(anonymous.status, 401);
    assert.equal(anonymousBadId.status, 401);
    assert.equal(noStore.status, 503);
    assert.equal(badId.status, 404);
    assert.equal(anonymous.headers.get("cache-control"), "no-store");
    assert.equal(calls.length, 0);
});

void test("a non-UUID id never reaches the store", async () => {
    const calls: Call[] = [];
    const outcome = await deleteDrillConfiguration(storeReturning(deleted, calls), USER_ID, "not-a-uuid");

    assert.ok(outcome.kind === "failed");
    assert.equal(outcome.result.status, 404);
    assert.equal(calls.length, 0);
});

void test("a double delete: the first answers 204, the second (zero rows) 404", async () => {
    let remaining = true;
    const store: DrillConfigurationStore = {
        ...storeReturning(noRow),
        delete: () => {
            const result = remaining ? deleted : noRow;
            remaining = false;
            return Promise.resolve(result);
        },
    };
    const context = { id: ID, userId: USER_ID, store };

    assert.equal((await handleDeleteDrillRequest(deleteRequest(), context)).status, 204);
    assert.equal((await handleDeleteDrillRequest(deleteRequest(), context)).status, 404);
});

void test("store errors: outage 503, expired session 401, anything else 500, only codes are logged", async () => {
    const secret = "Secret timer name";
    const logged: string[] = [];
    const run = (error: DeleteResult["error"], status?: number) =>
        deleteDrillConfiguration(storeReturning({ data: null, error, status }), USER_ID, ID, (code) => logged.push(code));
    const statusOf = (outcome: Awaited<ReturnType<typeof run>>) => (outcome.kind === "failed" ? outcome.result.status : 204);

    const outage = await run({ code: "PGRST205", message: secret });
    const missingTable = await run({ code: "42P01", message: secret });
    const unauthorized = await run({ code: "PGRST301", message: secret });
    const unauthorizedStatus = await run({ message: secret }, 401);
    const unknown = await run({ code: "XX000", message: secret });
    const duplicateShaped = await run({ code: "23505", message: secret });

    assert.equal(statusOf(outage), 503);
    assert.equal(statusOf(missingTable), 503);
    assert.equal(statusOf(unauthorized), 401);
    assert.equal(statusOf(unauthorizedStatus), 401);
    assert.equal(statusOf(unknown), 500);
    assert.equal(statusOf(duplicateShaped), 500);
    assert.deepEqual(logged, ["PGRST205", "42P01", "XX000", "23505"]);
    assert.equal(JSON.stringify(logged).includes(secret), false);
});

void test("a throwing store is unexpected (500) and only the marker is logged", async () => {
    const logged: string[] = [];
    const store: DrillConfigurationStore = { ...storeReturning(noRow), delete: () => Promise.reject(new Error("network down")) };
    const response = await handleDeleteDrillRequest(deleteRequest(), { id: ID, userId: USER_ID, store, log: (code) => logged.push(code) });

    assert.equal(response.status, 500);
    assert.deepEqual(logged, ["store_exception"]);
});
