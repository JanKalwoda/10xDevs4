import assert from "node:assert/strict";
import test from "node:test";

import {
    EMAIL_LINK_MESSAGE,
    EMAIL_LINK_RETRY_MESSAGE,
    buildEmailRedirectTo,
    emailLinkCallbackSchema,
    emailLinkRequestSchema,
    forwardAuthCookies,
    handleEmailLinkCallback,
    handleEmailLinkRequest,
    isSafeNextPath,
    requestEmailLink,
    signInUrlForProtectedPath,
    verifyEmailLink,
} from "./email-auth.ts";

const callbackInput = {
    token_hash: "valid-token-hash",
    type: "email",
    next: "/dashboard?tab=drill",
};

function createFormRequest(url: string, values: Record<string, string>): Request {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) {
        form.set(key, value);
    }
    return new Request(url, { method: "POST", body: form });
}

void test("email and callback schemas validate required fields and default next", () => {
    assert.deepEqual(emailLinkRequestSchema.parse({ email: " user@example.com " }), {
        email: "user@example.com",
        next: "/",
    });
    assert.equal(emailLinkRequestSchema.safeParse({ email: "not-an-email" }).success, false);
    assert.equal(emailLinkCallbackSchema.safeParse({ token_hash: "token", type: "magiclink" }).success, false);
    assert.equal(emailLinkCallbackSchema.safeParse({ token_hash: "", type: "email" }).success, false);
    assert.deepEqual(emailLinkCallbackSchema.parse({ ...callbackInput, next: undefined }).next, "/");
});

void test("safe next accepts local paths and rejects absolute, scheme-relative, backslash, and malformed paths", () => {
    for (const next of ["/", "/dashboard", "/dashboard?tab=drill", "/settings#profile"]) {
        assert.equal(isSafeNextPath(next), true, next + " should be safe");
    }

    for (const next of [
        "https://example.com",
        "//example.com",
        "/\\example.com",
        "/dashboard\\@example.com",
        "dashboard",
        " /dashboard",
        "/bad%",
        "/%2f%2fexample.com",
        "/%5cexample.com",
        "/dashboard\n",
    ]) {
        assert.equal(isSafeNextPath(next), false, JSON.stringify(next) + " should be rejected");
    }
});

void test("email redirect carries only a validated next on the request origin", () => {
    const redirectTo = buildEmailRedirectTo("https://drill.example/api/auth/signin", "/dashboard?tab=drill");
    assert.ok(redirectTo);
    const callback = new URL(redirectTo);
    assert.equal(callback.origin, "https://drill.example");
    assert.equal(callback.pathname, "/auth/callback");
    assert.equal(callback.searchParams.get("next"), "/dashboard?tab=drill");
    assert.equal(buildEmailRedirectTo("https://drill.example/api/auth/signin", "//evil.example"), null);
    assert.equal(buildEmailRedirectTo("javascript:alert(1)", "/dashboard"), null);
});

void test("protected route sign-in URL preserves its safe local path", () => {
    assert.equal(signInUrlForProtectedPath("/dashboard?tab=drill"), "/auth/signin?next=%2Fdashboard%3Ftab%3Ddrill");
    assert.equal(signInUrlForProtectedPath("//evil.example"), "/auth/signin?next=%2Fdashboard");
});

void test("new and existing account requests have the same neutral response and provider contract", async () => {
    const accountStates = ["new", "existing"] as const;
    const calls: { accountState: (typeof accountStates)[number]; request: unknown }[] = [];
    const results = await Promise.all(
        accountStates.map(async (accountState) => {
            const result = await requestEmailLink({ email: "person@example.com", next: "/dashboard" }, "https://drill.example/api/auth/signin", {
                signInWithOtp: (input) => {
                    calls.push({ accountState, request: input });
                    return Promise.resolve({ error: null });
                },
            });
            return result;
        }),
    );

    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[0], { ok: true, status: 200, message: EMAIL_LINK_MESSAGE });
    assert.equal(calls.length, 2);
    assert.deepEqual(
        calls.map(({ accountState }) => accountState),
        accountStates,
    );
    assert.deepEqual(calls[0]?.request, calls[1]?.request);
    for (const { request } of calls) {
        assert.deepEqual(request, {
            email: "person@example.com",
            options: {
                shouldCreateUser: true,
                emailRedirectTo: "https://drill.example/auth/callback?next=%2Fdashboard",
            },
        });
    }
});

void test("provider errors and unavailable auth remain account-neutral", async () => {
    const providerError = await requestEmailLink({ email: "person@example.com" }, "https://drill.example/api/auth/signin", {
        signInWithOtp: () => Promise.resolve({ error: new Error("provider detail") }),
    });
    const thrownError = await requestEmailLink({ email: "person@example.com" }, "https://drill.example/api/auth/signin", {
        signInWithOtp: () => Promise.reject(new Error("provider detail")),
    });
    const unavailable = await requestEmailLink({ email: "person@example.com" }, "https://drill.example/api/auth/signin", null);

    assert.deepEqual(providerError, { ok: true, status: 200, message: EMAIL_LINK_MESSAGE });
    assert.deepEqual(thrownError, providerError);
    assert.deepEqual(unavailable, providerError);
});

void test("request POST adapter returns a neutral response without account details", async () => {
    const request = createFormRequest("https://drill.example/api/auth/signin", {
        email: "person@example.com",
        next: "/dashboard",
    });
    const response = await handleEmailLinkRequest(request, {
        signInWithOtp: () => Promise.resolve({ error: new Error("account-specific provider detail") }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, message: EMAIL_LINK_MESSAGE });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

void test("cookie writer adapter forwards each Supabase cookie name, value, and options", () => {
    const writes: [string, string, { httpOnly: boolean; sameSite: string }][] = [];
    const options = { httpOnly: true, sameSite: "lax" };
    forwardAuthCookies(
        [
            { name: "session-a", value: "value-a", options },
            { name: "session-b", value: "value-b", options },
        ],
        (name, value, cookieOptions) => {
            writes.push([name, value, cookieOptions]);
        },
    );

    assert.deepEqual(writes, [
        ["session-a", "value-a", options],
        ["session-b", "value-b", options],
    ]);
});

void test("explicit callback POST delegates only the email token contract and redirects after success", async () => {
    const calls: unknown[] = [];
    const response = await handleEmailLinkCallback(createFormRequest("https://drill.example/api/auth/callback", callbackInput), {
        verifyOtp: (input) => {
            calls.push(input);
            return Promise.resolve({ error: null });
        },
    });

    assert.deepEqual(calls, [{ token_hash: "valid-token-hash", type: "email" }]);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/dashboard?tab=drill");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

void test("invalid, expired, and reused callback tokens share a neutral retry response", async () => {
    const retryPost = () =>
        handleEmailLinkCallback(createFormRequest("https://drill.example/api/auth/callback", callbackInput), {
            verifyOtp: () => Promise.resolve({ error: new Error("expired or already used") }),
        });
    const first = await retryPost();
    const reused = await retryPost();

    assert.equal(first.status, 303);
    assert.equal(first.headers.get("location"), reused.headers.get("location"));
    assert.equal(first.headers.get("location"), "/auth/callback?error=invalid&next=%2Fdashboard%3Ftab%3Ddrill");
    assert.equal(first.headers.get("location")?.includes("valid-token-hash"), false);

    const invalidTypeCalls: unknown[] = [];
    const invalidType = await handleEmailLinkCallback(
        createFormRequest("https://drill.example/api/auth/callback", {
            token_hash: "valid-token-hash",
            type: "recovery",
            next: "/dashboard?tab=drill",
        }),
        {
            verifyOtp: (input) => {
                invalidTypeCalls.push(input);
                return Promise.resolve({ error: null });
            },
        },
    );
    assert.deepEqual(invalidTypeCalls, []);
    assert.equal(invalidType.headers.get("location"), "/auth/callback?error=invalid&next=%2F");
    assert.equal(EMAIL_LINK_RETRY_MESSAGE, "This sign-in link is invalid or expired. Request a new link.");
});

void test("callback verifier normalizes thrown and malformed-token failures", async () => {
    const thrown = await verifyEmailLink(callbackInput, {
        verifyOtp: () => Promise.reject(new Error("sensitive provider detail")),
    });
    const malformed = await verifyEmailLink(
        { ...callbackInput, token_hash: "" },
        {
            verifyOtp: () => {
                assert.fail("invalid input must not reach Supabase");
            },
        },
    );

    assert.deepEqual(thrown, {
        ok: false,
        next: "/dashboard?tab=drill",
        message: EMAIL_LINK_RETRY_MESSAGE,
    });
    assert.deepEqual(malformed, {
        ok: false,
        next: "/",
        message: EMAIL_LINK_RETRY_MESSAGE,
    });
});
