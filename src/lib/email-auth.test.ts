import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspect } from "node:util";

import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import type { AuthStep } from "./auth-errors.ts";
import {
    EMAIL_LINK_PAGE_HEADERS,
    EMAIL_LINK_MESSAGE,
    EMAIL_LINK_RETRY_MESSAGE,
    EMAIL_LINK_UNAVAILABLE_MESSAGE,
    EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE,
    buildEmailRedirectTo,
    emailLinkCallbackPageState,
    emailLinkCallbackSchema,
    emailLinkRequestSchema,
    forwardAuthCookies,
    handleEmailLinkCallback,
    handleEmailLinkRequest,
    isSafeNextPath,
    legacySignupRedirectUrl,
    requestEmailLink,
    setEmailLinkPageSecurityHeaders,
    signInUrlForProtectedPath,
    verifyEmailLink,
} from "./email-auth.ts";

const callbackInput = {
    token_hash: "valid-token-hash",
    type: "email",
    next: "/dashboard?tab=drill",
};

function recordingReporter() {
    const reports: { step: AuthStep; error: unknown }[] = [];
    return {
        reports,
        report: (step: AuthStep, error: unknown) => {
            reports.push({ step, error });
        },
    };
}

const SIGN_IN_URL = "https://drill.example/api/auth/signin";
const outage = () => new AuthRetryableFetchError("fetch failed", 0);

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
        next: "/timers",
    });
    assert.equal(emailLinkRequestSchema.safeParse({ email: "not-an-email" }).success, false);
    assert.equal(emailLinkCallbackSchema.safeParse({ token_hash: "token", type: "magiclink" }).success, false);
    assert.equal(emailLinkCallbackSchema.safeParse({ token_hash: "", type: "email" }).success, false);
    assert.deepEqual(emailLinkCallbackSchema.parse({ ...callbackInput, next: undefined }).next, "/timers");
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

void test("safe next rejects anything that is not a string without throwing", () => {
    for (const next of [undefined, null, 42, true, {}, ["/dashboard"]]) {
        assert.equal(isSafeNextPath(next), false, inspect(next) + " should be rejected");
    }
});

void test("safe next rejects a very long path and accepts an ordinary one with a medium query", () => {
    assert.equal(isSafeNextPath("/" + "a".repeat(10_000)), false);
    assert.equal(isSafeNextPath("/timers?q=" + "a".repeat(200)), true);
});

void test("safe next rejects whitespace at either edge", () => {
    for (const next of ["/dashboard ", " /dashboard", "/dashboard\u00a0", "\u00a0/dashboard"]) {
        assert.equal(isSafeNextPath(next), false, JSON.stringify(next) + " should be rejected");
    }
});

void test("safe next rejects an incomplete or non-hex percent escape and accepts a valid one", () => {
    for (const next of ["/bad%1", "/bad%1z", "/bad%zz", "/a?q=%zz"]) {
        assert.equal(isSafeNextPath(next), false, next + " should be rejected");
    }
    for (const next of ["/caf%C3%A9", "/a%20b?x=%41"]) {
        assert.equal(isSafeNextPath(next), true, next + " should be safe");
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
    assert.equal(signInUrlForProtectedPath("/"), "/auth/signin?next=%2F");
    assert.equal(signInUrlForProtectedPath("//evil.example"), "/auth/signin?next=%2Ftimers");
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

void test("provider outage, configuration fault and missing auth answer 503 with one message and a report", async () => {
    const { reports, report } = recordingReporter();
    const retryable = await requestEmailLink({ email: "person@example.com" }, SIGN_IN_URL, { signInWithOtp: () => Promise.resolve({ error: outage() }) }, report);
    const providerDisabled = await requestEmailLink(
        { email: "person@example.com" },
        SIGN_IN_URL,
        { signInWithOtp: () => Promise.resolve({ error: new AuthApiError("detail for person@example.com", 422, "email_provider_disabled") }) },
        report,
    );
    const thrown = await requestEmailLink({ email: "person@example.com" }, SIGN_IN_URL, { signInWithOtp: () => Promise.reject(new Error("provider detail")) }, report);
    const unavailable = await requestEmailLink({ email: "person@example.com" }, SIGN_IN_URL, null, report);

    const expected = { ok: false, status: 503, message: EMAIL_LINK_UNAVAILABLE_MESSAGE };
    assert.deepEqual(retryable, expected);
    assert.deepEqual(providerDisabled, expected);
    assert.deepEqual(thrown, expected);
    assert.deepEqual(unavailable, expected);
    assert.equal(EMAIL_LINK_UNAVAILABLE_MESSAGE, "We couldn't send a sign-in link right now. Please try again in a moment.");
    // The missing client is reported once per isolate by the session middleware, so it is not reported here.
    assert.deepEqual(
        reports.map(({ step }) => step),
        ["sign_in", "sign_in", "sign_in"],
    );
});

void test("an address-dependent provider rejection stays a neutral 200 for every address and is reported", async () => {
    const { reports, report } = recordingReporter();
    const results = await Promise.all(
        ["new@example.com", "blocked@example.com"].map((email) =>
            requestEmailLink(
                { email },
                SIGN_IN_URL,
                { signInWithOtp: () => Promise.resolve({ error: new AuthApiError(`detail for ${email}`, 422, "email_address_not_authorized") }) },
                report,
            ),
        ),
    );

    for (const result of results) {
        assert.deepEqual(result, { ok: true, status: 200, message: EMAIL_LINK_MESSAGE });
    }
    assert.deepEqual(
        reports.map(({ step }) => step),
        ["sign_in", "sign_in"],
    );
});

void test("an outage gives a new and an existing account the same response", async () => {
    const { report } = recordingReporter();
    const responses = await Promise.all(
        ["new@example.com", "existing@example.com"].map((email) => requestEmailLink({ email }, SIGN_IN_URL, { signInWithOtp: () => Promise.resolve({ error: outage() }) }, report)),
    );

    assert.deepEqual(responses[0], responses[1]);
    assert.equal(responses[0]?.status, 503);
});

void test("throttling and invalid-address outcomes stay neutral and are not reported", async () => {
    const { reports, report } = recordingReporter();
    const errors = [
        new AuthApiError("slow down", 429, undefined),
        new AuthApiError("too many", 429, "over_email_send_rate_limit"),
        new AuthApiError("bad", 400, "email_address_invalid"),
        new AuthApiError("bad", 422, "validation_failed"),
    ];

    for (const error of errors) {
        const result = await requestEmailLink({ email: "person@example.com" }, SIGN_IN_URL, { signInWithOtp: () => Promise.resolve({ error }) }, report);
        assert.deepEqual(result, { ok: true, status: 200, message: EMAIL_LINK_MESSAGE });
    }
    assert.deepEqual(reports, []);
});

void test("request POST adapter returns 503 without provider details on an outage", async () => {
    const { reports, report } = recordingReporter();
    const post = (email: string) =>
        handleEmailLinkRequest(
            createFormRequest(SIGN_IN_URL, { email, next: "/dashboard" }),
            { signInWithOtp: () => Promise.resolve({ error: new AuthRetryableFetchError("fetch failed for " + email, 0) }) },
            report,
        );
    const first = await post("one@example.com");
    const second = await post("two@example.com");

    assert.equal(first.status, 503);
    assert.deepEqual(await first.json(), { ok: false, message: EMAIL_LINK_UNAVAILABLE_MESSAGE });
    assert.deepEqual(await second.json(), { ok: false, message: EMAIL_LINK_UNAVAILABLE_MESSAGE });
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.equal(first.headers.get("referrer-policy"), "no-referrer");
    assert.equal(reports.length, 2);
});

void test("request POST adapter keeps the neutral 200 for an expected provider outcome", async () => {
    const request = createFormRequest(SIGN_IN_URL, {
        email: "person@example.com",
        next: "/dashboard",
    });
    const response = await handleEmailLinkRequest(request, {
        signInWithOtp: () => Promise.resolve({ error: new AuthApiError("account-specific provider detail", 429, undefined) }),
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
            verifyOtp: () => Promise.resolve({ error: new AuthApiError("expired or already used", 403, "otp_expired") }),
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
    assert.equal(invalidType.headers.get("location"), "/auth/callback?error=invalid&next=%2Ftimers");
    assert.equal(EMAIL_LINK_RETRY_MESSAGE, "This sign-in link is invalid or expired. Request a new link.");
});

void test("callback verifier normalizes malformed tokens and answers an outage as unavailable", async () => {
    const { reports, report } = recordingReporter();
    const thrown = await verifyEmailLink(callbackInput, { verifyOtp: () => Promise.reject(new Error("sensitive provider detail")) }, report);
    const malformed = await verifyEmailLink(
        { ...callbackInput, token_hash: "" },
        {
            verifyOtp: () => {
                assert.fail("invalid input must not reach Supabase");
            },
        },
        report,
    );
    const noAuth = await verifyEmailLink(callbackInput, null, report);

    assert.deepEqual(thrown, { ok: false, reason: "unavailable", next: "/dashboard?tab=drill", message: EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE });
    assert.deepEqual(noAuth, thrown);
    assert.deepEqual(malformed, { ok: false, reason: "invalid", next: "/timers", message: EMAIL_LINK_RETRY_MESSAGE });
    assert.equal(EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE, "We couldn't confirm this link right now. Please try again in a moment.");
    // The missing client is reported once per isolate by the session middleware.
    assert.deepEqual(
        reports.map(({ step }) => step),
        ["callback"],
    );
});

void test("callback POST redirects an outage to error=unavailable and reports it without the token", async () => {
    const { reports, report } = recordingReporter();
    const response = await handleEmailLinkCallback(
        createFormRequest("https://drill.example/api/auth/callback", callbackInput),
        { verifyOtp: () => Promise.resolve({ error: outage() }) },
        report,
    );

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/auth/callback?error=unavailable&next=%2Fdashboard%3Ftab%3Ddrill");
    assert.equal(response.headers.get("location")?.includes("valid-token-hash"), false);
    assert.deepEqual(
        reports.map(({ step }) => step),
        ["callback"],
    );
});

void test("an expired or throttled callback link is invalid and is not reported", async () => {
    const { reports, report } = recordingReporter();
    for (const error of [new AuthApiError("expired", 403, "otp_expired"), new AuthApiError("slow down", 429, undefined)]) {
        const response = await handleEmailLinkCallback(
            createFormRequest("https://drill.example/api/auth/callback", callbackInput),
            { verifyOtp: () => Promise.resolve({ error }) },
            report,
        );
        assert.equal(response.headers.get("location"), "/auth/callback?error=invalid&next=%2Fdashboard%3Ftab%3Ddrill");
    }
    assert.deepEqual(reports, []);
});

void test("callback page state recognizes error=unavailable and keeps next safe", () => {
    const state = emailLinkCallbackPageState("https://drill.example/auth/callback?error=unavailable&next=%2Ftimers");
    assert.deepEqual(state, { kind: "unavailable", message: EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE, next: "/timers" });

    const unsafe = emailLinkCallbackPageState("https://drill.example/auth/callback?error=unavailable&next=%2F%2Fevil.example");
    assert.deepEqual(unsafe, { kind: "unavailable", message: EMAIL_LINK_UNAVAILABLE_RETRY_MESSAGE, next: "/timers" });

    const invalid = emailLinkCallbackPageState("https://drill.example/auth/callback?error=invalid&next=%2Ftimers");
    assert.equal(invalid.kind, "retry");
});

void test("callback GET prepares safe confirmation values and leaves verification to POST", async () => {
    const state = emailLinkCallbackPageState("https://drill.example/auth/callback?token_hash=opaque-token%26value&type=email&next=%2Fdashboard%3Ftab%3Ddrill");
    assert.deepEqual(state, {
        kind: "confirm",
        tokenHash: "opaque-token&value",
        next: "/dashboard?tab=drill",
    });

    const callbackPage = await readFile(new URL("../pages/auth/callback.astro", import.meta.url), "utf8");
    assert.ok(callbackPage.includes("emailLinkCallbackPageState(Astro.url.href)"));
    assert.ok(callbackPage.includes('method="POST" action="/api/auth/callback"'));
    assert.ok(callbackPage.includes('name="token_hash" value={state.tokenHash}'));
    assert.ok(callbackPage.includes('name="next" value={state.next}'));
    assert.ok(callbackPage.includes("event.preventDefault()"));
    assert.ok(callbackPage.includes("new FormData(form)"));
    assert.ok(callbackPage.includes("window.location.assign(destination.pathname + destination.search + destination.hash)"));
    assert.equal(/\b(?:verifyOtp|handleEmailLinkCallback|createClient)\b/.test(callbackPage), false);

    const postRoute = await readFile(new URL("../pages/api/auth/callback.ts", import.meta.url), "utf8");
    assert.ok(postRoute.includes("export const POST"));
    assert.equal(postRoute.includes("export const GET"), false);
});

void test("callback page applies no-store and no-referrer headers", () => {
    const headers = new Headers();
    setEmailLinkPageSecurityHeaders(headers);

    assert.deepEqual(EMAIL_LINK_PAGE_HEADERS, {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
    });
    assert.equal(headers.get("cache-control"), "no-store");
    assert.equal(headers.get("referrer-policy"), "no-referrer");
});

void test("invalid and unsafe callback values produce the same neutral retry state", () => {
    const invalidStates = [
        emailLinkCallbackPageState("https://drill.example/auth/callback"),
        emailLinkCallbackPageState("https://drill.example/auth/callback?token_hash=token&type=recovery"),
        emailLinkCallbackPageState("https://drill.example/auth/callback?token_hash=token&type=email&next=%2F%2Fevil.example"),
        emailLinkCallbackPageState("https://drill.example/auth/callback?error=invalid&next=%2Fdashboard"),
    ];

    const retryStates = invalidStates.map((state) => {
        assert.ok(state.kind === "retry");
        return state;
    });
    assert.deepEqual(
        retryStates.map((state) => state.message),
        invalidStates.map(() => EMAIL_LINK_RETRY_MESSAGE),
    );
    const unsafeNext = retryStates[2];
    const callbackError = retryStates[3];
    assert.ok(unsafeNext);
    assert.ok(callbackError);
    assert.equal(unsafeNext.next, "/timers");
    assert.equal(callbackError.next, "/dashboard");
});

void test("legacy signup redirects preserve only a safe local next path", () => {
    assert.equal(legacySignupRedirectUrl("/dashboard?tab=drill"), "/auth/signin?next=%2Fdashboard%3Ftab%3Ddrill");
    assert.equal(legacySignupRedirectUrl("//evil.example"), "/auth/signin");
    assert.equal(legacySignupRedirectUrl("https://evil.example"), "/auth/signin");
});

void test("local confirmation and magic-link templates share the callback contract", async () => {
    const config = await readFile(new URL("../../supabase/config.toml", import.meta.url), "utf8");
    const template = await readFile(new URL("../../supabase/templates/magic_link.html", import.meta.url), "utf8");
    const authSection = config.split("[auth]")[1]?.split("[auth.rate_limit]")[0] ?? "";
    const emailSection = config.split("[auth.email]")[1]?.split("[auth.email.template.confirmation]")[0] ?? "";

    assert.ok(authSection.includes("http://localhost:4321/auth/callback*"));
    assert.ok(authSection.includes("http://localhost:4323/auth/callback*"));
    assert.ok(emailSection.includes("enable_confirmations = true"));
    for (const templateName of ["confirmation", "magic_link"]) {
        const header = "[auth.email.template." + templateName + "]";
        const section = config.split(header)[1]?.split("\n[")[0] ?? "";
        assert.ok(section.includes('subject = "Your Drill Me sign-in link"'));
        assert.ok(section.includes('content_path = "./supabase/templates/magic_link.html"'));
    }
    assert.ok(template.includes("{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email"));
});
