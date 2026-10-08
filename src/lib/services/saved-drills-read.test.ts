import assert from "node:assert/strict";
import test from "node:test";

import {
    OPEN_DRILL_MESSAGES,
    getSavedDrill,
    isDrillId,
    listSavedDrills,
    normalizeDrillId,
    resolveTimersPage,
    resolveSavedDrillPage,
    type DrillConfigurationStore,
    type FindResult,
    type ListResult,
    type SavedDrillRow,
} from "./drill-configurations.ts";
import { signInUrlForProtectedPath } from "../email-auth.ts";
import { describeDrillConfiguration } from "../saved-drill-summary.ts";

const ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const row: SavedDrillRow = {
    id: ID,
    name: "Morning draw",
    preparation_seconds: 5,
    exercise_seconds: 4,
    rest_seconds: 2,
    repetitions: 3,
    random_start_enabled: true,
    created_at: "2026-10-07T10:00:00+00:00",
    updated_at: "2026-10-07T10:00:00+00:00",
};

interface Calls {
    list: number;
    find: string[];
}

function store(list: () => PromiseLike<ListResult>, find: (id: string) => PromiseLike<FindResult>, calls: Calls = { list: 0, find: [] }): DrillConfigurationStore {
    return {
        insert: () => Promise.reject(new Error("insert is not used when reading")),
        list: () => {
            calls.list += 1;
            return list();
        },
        findById: (id) => {
            calls.find.push(id);
            return find(id);
        },
        update: () => Promise.reject(new Error("update is not used when reading")),
        delete: () => Promise.reject(new Error("delete is not used when reading")),
    };
}

const noRows = () => Promise.resolve<FindResult>({ data: null, error: null });
const emptyList = () => Promise.resolve<ListResult>({ data: [], error: null });

void test("isDrillId accepts only the strict 8-4-4-4-12 hex shape, in any case", () => {
    assert.equal(isDrillId(ID), true);
    assert.equal(isDrillId(ID.toUpperCase()), true);
    assert.equal(normalizeDrillId(ID.toUpperCase()), ID);

    for (const value of [
        `{${ID}}`,
        ` ${ID}`,
        `${ID} `,
        `${ID}\n`,
        `${ID}%2F`,
        `${ID}/`,
        ID.slice(1),
        `${ID}0`,
        ID.replace("2222-4222", "zzzz-4222"),
        ID.replaceAll("-", ""),
        "",
        "abc",
        null,
        undefined,
        42,
    ]) {
        assert.equal(isDrillId(value), false, String(value));
    }
});

void test("listSavedDrills maps rows to saved drills and keeps the order it was given", async () => {
    const second: SavedDrillRow = { ...row, id: "33333333-3333-4333-8333-333333333333", name: "Older" };
    const result = await listSavedDrills(store(() => Promise.resolve({ data: [row, second], error: null }), noRows));

    assert.equal(result.kind, "ok");
    assert.deepEqual(
        result.drills.map((drill) => drill.name),
        ["Morning draw", "Older"],
    );
    assert.deepEqual(result.drills[0]?.configuration, { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: true });
});

void test("an empty list is ok only for a clean array response", async () => {
    assert.deepEqual(await listSavedDrills(store(emptyList, noRows)), { kind: "ok", drills: [] });
});

void test("read failures never become an empty list", async () => {
    const logged: string[] = [];
    const log = (code: string) => logged.push(code);
    const failures: [string, () => PromiseLike<ListResult>][] = [
        ["error 42501", () => Promise.resolve({ data: null, error: { code: "42501" }, status: 403 })],
        ["missing table", () => Promise.resolve({ data: null, error: { code: "PGRST205" }, status: 404 })],
        ["unknown error", () => Promise.resolve({ data: null, error: { code: "XX000" }, status: 500 })],
        ["data null without error", () => Promise.resolve({ data: null, error: null })],
        ["thrown exception", () => Promise.reject(new Error("network down"))],
    ];

    for (const [label, list] of failures) {
        assert.deepEqual(await listSavedDrills(store(list, noRows), log), { kind: "unavailable" }, label);
    }
    assert.deepEqual(logged, ["42501", "PGRST205", "XX000", "empty_result", "store_exception"]);
});

void test("an expired session is unauthorized, not unavailable", async () => {
    const jwt = () => Promise.resolve<ListResult>({ data: null, error: { code: "PGRST301" }, status: 401 });
    assert.deepEqual(await listSavedDrills(store(jwt, noRows)), { kind: "unauthorized" });
    assert.deepEqual(
        await getSavedDrill(
            store(emptyList, () => Promise.resolve({ data: null, error: { code: "PGRST303" } })),
            ID,
        ),
        { kind: "unauthorized" },
    );
});

void test("getSavedDrill opens an own row and normalizes the id it queries", async () => {
    const calls: Calls = { list: 0, find: [] };
    const result = await getSavedDrill(
        store(emptyList, () => Promise.resolve({ data: row, error: null }), calls),
        ID.toUpperCase(),
    );

    assert.equal(result.kind, "ok");
    assert.equal(result.drill.id, ID);
    assert.deepEqual(calls.find, [ID]);
});

void test("zero rows is not_found, the same for a foreign and a random id", async () => {
    const foreign = await getSavedDrill(store(emptyList, noRows), ID);
    const random = await getSavedDrill(store(emptyList, noRows), "99999999-9999-4999-8999-999999999999");
    assert.deepEqual(foreign, { kind: "not_found" });
    assert.deepEqual(random, foreign);
});

void test("a non-UUID id never touches the store", async () => {
    const calls: Calls = { list: 0, find: [] };
    for (const id of ["abc", "", `${ID}%2F`, `{${ID}}`]) {
        assert.deepEqual(await getSavedDrill(store(emptyList, noRows, calls), id), { kind: "not_found" }, id);
    }
    assert.deepEqual(calls.find, []);
});

void test("getSavedDrill read errors and exceptions are unavailable and log only the code", async () => {
    const logged: string[] = [];
    const log = (code: string) => logged.push(code);
    const secret = "secret-name";

    const denied = await getSavedDrill(
        store(emptyList, () => Promise.resolve({ data: null, error: { code: "42501", message: secret } })),
        ID,
        log,
    );
    const thrown = await getSavedDrill(
        store(emptyList, () => Promise.reject(new Error(secret))),
        ID,
        log,
    );
    const malformed = await getSavedDrill(
        store(emptyList, () => Promise.resolve({ data: undefined as unknown as null, error: null })),
        ID,
        log,
    );

    assert.deepEqual([denied, thrown, malformed], [{ kind: "unavailable" }, { kind: "unavailable" }, { kind: "unavailable" }]);
    assert.deepEqual(logged, ["42501", "store_exception", "empty_result"]);
    assert.equal(logged.join().includes(secret), false);
});

void test("the /{id} decision: non-UUID first, then session, then store, then result", async () => {
    const calls: Calls = { list: 0, find: [] };
    const reading = store(emptyList, () => Promise.resolve({ data: row, error: null }), calls);

    assert.deepEqual(await resolveSavedDrillPage(USER_ID, "abc", reading), { kind: "not_found" });
    assert.deepEqual(await resolveSavedDrillPage(null, "abc", reading), { kind: "not_found" }, "a guest on a random path gets the same 404, not a redirect");
    assert.deepEqual(await resolveSavedDrillPage(null, ID, reading), { kind: "sign_in" });
    assert.deepEqual(calls.find, [], "no store access without a user or a UUID");
    assert.deepEqual(await resolveSavedDrillPage(USER_ID, ID, null), { kind: "unavailable" });
    assert.deepEqual(await resolveSavedDrillPage(USER_ID, ID, store(emptyList, noRows)), { kind: "not_found" });
    assert.deepEqual(
        await resolveSavedDrillPage(
            USER_ID,
            ID,
            store(emptyList, () => Promise.resolve({ data: null, error: { code: "PGRST301" } })),
        ),
        { kind: "sign_in" },
    );
    assert.deepEqual(
        await resolveSavedDrillPage(
            USER_ID,
            ID,
            store(emptyList, () => Promise.resolve({ data: null, error: { code: "XX000" } }), calls),
            () => undefined,
        ),
        { kind: "unavailable" },
    );

    const ok = await resolveSavedDrillPage(USER_ID, ID, reading);
    assert.equal(ok.kind, "ok");
});

void test("the timers page decision: sign in, unavailable, ok, never an empty list on failure", async () => {
    const calls: Calls = { list: 0, find: [] };

    assert.deepEqual(await resolveTimersPage(null, store(emptyList, noRows, calls)), { kind: "sign_in" });
    assert.equal(calls.list, 0);
    assert.deepEqual(await resolveTimersPage(USER_ID, null), { kind: "unavailable" });
    assert.deepEqual(await resolveTimersPage(USER_ID, store(emptyList, noRows)), { kind: "ok", drills: [] });
    assert.deepEqual(
        await resolveTimersPage(
            USER_ID,
            store(() => Promise.resolve({ data: null, error: { code: "PGRST301" }, status: 401 }), noRows),
        ),
        { kind: "sign_in" },
    );
    assert.deepEqual(
        await resolveTimersPage(
            USER_ID,
            store(() => Promise.resolve({ data: null, error: null }), noRows),
            () => undefined,
        ),
        { kind: "unavailable" },
    );
});

void test("the empty and unavailable messages are different texts", () => {
    assert.equal(OPEN_DRILL_MESSAGES.empty, "You have no saved timers yet.");
    assert.notEqual(OPEN_DRILL_MESSAGES.empty, OPEN_DRILL_MESSAGES.unavailable);
});

void test("a saved timer path is a safe sign-in next value", () => {
    assert.equal(signInUrlForProtectedPath(`/${ID}`), `/auth/signin?next=${encodeURIComponent(`/${ID}`)}`);
    assert.equal(signInUrlForProtectedPath(`//${ID}`), "/auth/signin?next=%2Ftimers");
});

void test("describeDrillConfiguration lists the parameters, with 1 rep and optional random start", () => {
    const base = { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: false };
    assert.deepEqual(describeDrillConfiguration(base), ["Prep 0:05", "Exercise 0:04", "Rest 0:02", "3 reps"]);
    assert.deepEqual(describeDrillConfiguration({ ...base, preparationSeconds: 0, exerciseSeconds: 600, restSeconds: 65, repetitions: 1, randomStartEnabled: true }), [
        "Prep 0:00",
        "Exercise 10:00",
        "Rest 1:05",
        "1 rep",
        "Random start",
    ]);
});
