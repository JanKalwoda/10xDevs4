import assert from "node:assert/strict";
import test from "node:test";

import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthUnknownError } from "@supabase/supabase-js";

import { authErrorTags, classifyAuthError, safeAuthErrorFields, type AuthStep } from "./auth-errors.ts";

const api = (status: number, code?: string) => new AuthApiError("provider said no for user@example.com", status, code);

interface Row {
    name: string;
    step: AuthStep;
    error: unknown;
    kind: "ok" | "expected" | "unavailable" | "unexpected";
}

const ROWS: Row[] = [
    { name: "null error is ok (session)", step: "session", error: null, kind: "ok" },
    { name: "undefined error is ok (callback)", step: "callback", error: undefined, kind: "ok" },

    { name: "session: retryable fetch error", step: "session", error: new AuthRetryableFetchError("fetch failed", 0), kind: "unavailable" },
    { name: "session: 503 retryable", step: "session", error: new AuthRetryableFetchError("down", 503), kind: "unavailable" },
    { name: "session: unknown error", step: "session", error: new AuthUnknownError("boom", new Error("x")), kind: "unavailable" },
    { name: "session: non-AuthError object", step: "session", error: new TypeError("fetch failed"), kind: "unavailable" },
    { name: "session: missing session is a guest", step: "session", error: new AuthSessionMissingError(), kind: "expected" },
    ...["refresh_token_not_found", "refresh_token_already_used", "session_expired", "session_not_found", "bad_jwt", "user_not_found", "user_banned"].map((code): Row => ({
        name: `session: dead session ${code}`,
        step: "session",
        error: api(401, code),
        kind: "expected",
    })),
    { name: "session: other AuthApiError is unexpected", step: "session", error: api(500, "unexpected_failure"), kind: "unexpected" },
    { name: "session: AuthApiError without code is unexpected", step: "session", error: api(401), kind: "unexpected" },

    { name: "sign_in: 429 is expected", step: "sign_in", error: api(429), kind: "expected" },
    ...["over_email_send_rate_limit", "over_request_rate_limit", "email_address_invalid", "validation_failed"].map((code): Row => ({
        name: `sign_in: ${code} is expected`,
        step: "sign_in",
        error: api(400, code),
        kind: "expected",
    })),
    ...["email_provider_disabled", "otp_disabled", "signup_disabled"].map((code): Row => ({
        name: `sign_in: ${code} (configuration fault) is unavailable`,
        step: "sign_in",
        error: api(422, code),
        kind: "unavailable",
    })),
    // Other 4xx may depend on the address or the account: reported, but never a different status for that visitor.
    ...["email_address_not_authorized", "user_banned", "unexpected_failure"].map((code): Row => ({
        name: `sign_in: ${code} is unexpected`,
        step: "sign_in",
        error: api(422, code),
        kind: "unexpected",
    })),
    { name: "sign_in: 401 without code is unexpected", step: "sign_in", error: api(401), kind: "unexpected" },
    { name: "sign_in: retryable is unavailable", step: "sign_in", error: new AuthRetryableFetchError("down", 0), kind: "unavailable" },
    { name: "sign_in: non-AuthError object", step: "sign_in", error: new Error("thrown"), kind: "unavailable" },

    { name: "callback: otp_expired 403 is expected", step: "callback", error: api(403, "otp_expired"), kind: "expected" },
    { name: "callback: 429 is expected", step: "callback", error: api(429), kind: "expected" },
    { name: "callback: any AuthApiError is expected", step: "callback", error: api(500, "unexpected_failure"), kind: "expected" },
    { name: "callback: retryable is unavailable", step: "callback", error: new AuthRetryableFetchError("down", 502), kind: "unavailable" },
    { name: "callback: unknown error is unavailable", step: "callback", error: new AuthUnknownError("boom", new Error("x")), kind: "unavailable" },

    { name: "sign_out: AuthApiError is unexpected", step: "sign_out", error: api(500, "unexpected_failure"), kind: "unexpected" },
    { name: "sign_out: missing session is expected", step: "sign_out", error: new AuthSessionMissingError(), kind: "expected" },
    ...["refresh_token_not_found", "refresh_token_already_used", "session_expired", "session_not_found", "bad_jwt", "user_not_found", "user_banned"].map((code): Row => ({
        name: `sign_out: dead session ${code} is expected`,
        step: "sign_out",
        error: api(400, code),
        kind: "expected",
    })),
    { name: "sign_out: retryable is unavailable", step: "sign_out", error: new AuthRetryableFetchError("down", 0), kind: "unavailable" },
];

for (const row of ROWS) {
    void test(`classifyAuthError: ${row.name}`, () => {
        assert.deepEqual(classifyAuthError(row.step, row.error), { kind: row.kind });
    });
}

void test("safeAuthErrorFields never carries the provider message of an AuthApiError", () => {
    const fields = safeAuthErrorFields(new AuthApiError("Email user@example.com is invalid", 400, "email_address_invalid"));
    assert.deepEqual(fields, { name: "AuthApiError", status: 400, code: "email_address_invalid" });
    assert.equal("message" in fields, false);
});

void test("safeAuthErrorFields keeps the message of a retryable fetch error", () => {
    const fields = safeAuthErrorFields(new AuthRetryableFetchError("fetch failed", 0));
    assert.deepEqual(fields, { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" });
});

void test("safeAuthErrorFields drops the message of a retryable 5xx, which the provider wrote", () => {
    const fields = safeAuthErrorFields(new AuthRetryableFetchError("SMTP failed for user@example.com", 500));
    assert.deepEqual(fields, { name: "AuthRetryableFetchError", status: 500 });
    assert.equal("message" in fields, false);
});

void test("safeAuthErrorFields tolerates values that are not errors", () => {
    assert.deepEqual(safeAuthErrorFields("user@example.com"), { name: "UnknownError" });
    assert.deepEqual(safeAuthErrorFields(null), { name: "UnknownError" });
});

void test("safeAuthErrorFields names a plain Error without its message", () => {
    assert.deepEqual(safeAuthErrorFields(new TypeError("token_hash=abc")), { name: "TypeError" });
});

void test("authErrorTags leaves out status and code that do not exist", () => {
    assert.deepEqual(authErrorTags("sign_in", { name: "TypeError" }), { "auth.step": "sign_in", "auth.error": "TypeError" });
    assert.deepEqual(authErrorTags("session", { name: "AuthApiError", status: 401, code: "bad_jwt" }), {
        "auth.step": "session",
        "auth.error": "AuthApiError",
        "auth.status": "401",
        "auth.code": "bad_jwt",
    });
});
