import assert from "node:assert/strict";
import test from "node:test";

import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";

import type { AuthStep } from "./auth-errors.ts";
import { handleSignOut } from "./auth-errors.ts";

function recordingReporter() {
    const reports: { step: AuthStep; error: unknown }[] = [];
    return {
        reports,
        report: (step: AuthStep, error: unknown) => {
            reports.push({ step, error });
        },
    };
}

void test("sign-out reports a failed signOut once", async () => {
    const { reports, report } = recordingReporter();
    const error = new AuthRetryableFetchError("fetch failed", 0);

    await handleSignOut({ signOut: () => Promise.resolve({ error }) }, report);

    assert.deepEqual(reports, [{ step: "sign_out", error }]);
});

void test("sign-out reports a thrown signOut once and does not rethrow", async () => {
    const { reports, report } = recordingReporter();

    await handleSignOut({ signOut: () => Promise.reject(new Error("boom")) }, report);

    assert.deepEqual(
        reports.map(({ step }) => step),
        ["sign_out"],
    );
});

void test("sign-out without an error or without a client reports nothing", async () => {
    const { reports, report } = recordingReporter();

    await handleSignOut({ signOut: () => Promise.resolve({ error: null }) }, report);
    await handleSignOut(null, report);

    assert.deepEqual(reports, []);
});

void test("sign-out with a dead session is expected and not reported", async () => {
    const { reports, report } = recordingReporter();

    await handleSignOut({ signOut: () => Promise.resolve({ error: new AuthSessionMissingError() }) }, report);
    await handleSignOut({ signOut: () => Promise.resolve({ error: new AuthApiError("gone", 400, "refresh_token_not_found") }) }, report);

    assert.deepEqual(reports, []);
});
