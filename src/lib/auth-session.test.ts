import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, type User } from "@supabase/supabase-js";

import { resetSessionReportStateForTests, resolveSession } from "./auth-session.ts";
import type { AuthStep } from "./auth-errors.ts";

const USER = { id: "11111111-1111-4111-8111-111111111111" } as User;

interface GetUserResult {
    data: { user: User | null };
    error: unknown;
}

function authReturning(result: GetUserResult) {
    return { getUser: () => Promise.resolve(result) };
}

function reporter() {
    const calls: { step: AuthStep; error: unknown }[] = [];
    return { calls, report: (step: AuthStep, error: unknown) => void calls.push({ step, error }) };
}

beforeEach(() => {
    resetSessionReportStateForTests();
});

void test("a signed-in visitor is a user and nothing is reported", async () => {
    const { calls, report } = reporter();
    assert.deepEqual(await resolveSession(authReturning({ data: { user: USER }, error: null }), report), { kind: "user", user: USER });
    assert.equal(calls.length, 0);
});

void test("no user and no error is a guest", async () => {
    const { calls, report } = reporter();
    assert.deepEqual(await resolveSession(authReturning({ data: { user: null }, error: null }), report), { kind: "guest" });
    assert.equal(calls.length, 0);
});

void test("a missing session and a dead session are guests without a report", async () => {
    for (const error of [new AuthSessionMissingError(), new AuthApiError("bad", 401, "bad_jwt")]) {
        const { calls, report } = reporter();
        assert.deepEqual(await resolveSession(authReturning({ data: { user: null }, error }), report), { kind: "guest" });
        assert.equal(calls.length, 0);
    }
});

void test("an outage is unavailable and reported once per request", async () => {
    const { calls, report } = reporter();
    const error = new AuthRetryableFetchError("fetch failed", 0);
    assert.deepEqual(await resolveSession(authReturning({ data: { user: null }, error }), report), { kind: "unavailable" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.step, "session");
    assert.equal(calls[0]?.error, error);
});

void test("an unexpected API error is a guest and is reported", async () => {
    const { calls, report } = reporter();
    const error = new AuthApiError("odd", 500, "unexpected_failure");
    assert.deepEqual(await resolveSession(authReturning({ data: { user: null }, error }), report), { kind: "guest" });
    assert.equal(calls.length, 1);
});

void test("a missing client is unavailable and reported once per isolate", async () => {
    const { calls, report } = reporter();
    assert.deepEqual(await resolveSession(null, report), { kind: "unavailable" });
    assert.deepEqual(await resolveSession(null, report), { kind: "unavailable" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.step, "session");
    assert.ok(calls[0]?.error instanceof Error);
});
