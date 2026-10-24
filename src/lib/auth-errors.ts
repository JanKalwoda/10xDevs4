import * as Sentry from "@sentry/cloudflare";
import { isAuthApiError, isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";

export type AuthStep = "session" | "sign_in" | "callback" | "sign_out";

export type AuthErrorClass = { kind: "ok" } | { kind: "expected" } | { kind: "unavailable" } | { kind: "unexpected" };

export type AuthErrorReporter = (step: AuthStep, error: unknown) => void;

// Sessions that can never be refreshed (forged cookie, revoked or deleted user): the visitor is a guest, nothing is broken.
const DEAD_SESSION_CODES = new Set(["refresh_token_not_found", "refresh_token_already_used", "session_expired", "session_not_found", "bad_jwt", "user_not_found", "user_banned"]);

// Outcomes of sign-in that depend on the visitor's input or on throttling, not on the provider being broken.
const EXPECTED_SIGN_IN_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit", "email_address_invalid", "validation_failed"]);

// Configuration faults that hit every address alike; any other sign-in 4xx may depend on the address or the account, so it must not change the status.
const SIGN_IN_CONFIGURATION_CODES = new Set(["email_provider_disabled", "otp_disabled", "signup_disabled"]);

function isUnknownAuthError(error: unknown): boolean {
    return isAuthError(error) && error.name === "AuthUnknownError";
}

/**
 * Decides whether the `error` of a Supabase Auth call is an expected outcome or an outage. Uses the type guards and
 * `code`/`status`, never the `message`.
 */
export function classifyAuthError(step: AuthStep, error: unknown): AuthErrorClass {
    if (error == null) return { kind: "ok" };
    if (!isAuthError(error) || isAuthRetryableFetchError(error) || isUnknownAuthError(error)) return { kind: "unavailable" };

    switch (step) {
        case "session":
            if (isAuthSessionMissingError(error)) return { kind: "expected" };
            if (isAuthApiError(error) && error.code && DEAD_SESSION_CODES.has(error.code)) return { kind: "expected" };
            return { kind: "unexpected" };
        case "sign_in":
            if (isAuthApiError(error) && (error.status === 429 || (error.code && EXPECTED_SIGN_IN_CODES.has(error.code)))) {
                return { kind: "expected" };
            }
            if (isAuthApiError(error) && error.code && SIGN_IN_CONFIGURATION_CODES.has(error.code)) return { kind: "unavailable" };
            return { kind: "unexpected" };
        case "callback":
            return isAuthApiError(error) ? { kind: "expected" } : { kind: "unavailable" };
        case "sign_out":
            // Signing out a session that is already dead is what the visitor wanted.
            if (isAuthSessionMissingError(error)) return { kind: "expected" };
            if (isAuthApiError(error) && error.code && DEAD_SESSION_CODES.has(error.code)) return { kind: "expected" };
            return { kind: "unexpected" };
    }
}

export interface SafeAuthErrorFields {
    name: string;
    status?: number;
    code?: string;
    message?: string;
}

/** The only fields of an auth error that may leave the app: provider messages can echo the email or the token. */
export function safeAuthErrorFields(error: unknown): SafeAuthErrorFields {
    if (!(error instanceof Error)) return { name: "UnknownError" };

    const fields: SafeAuthErrorFields = { name: error.name };
    if (isAuthError(error)) {
        if (typeof error.status === "number") fields.status = error.status;
        if (typeof error.code === "string") fields.code = error.code;
    }
    // Status 0 is a transport failure ("fetch failed"); a retryable 5xx carries text the provider wrote, which may quote the email.
    if (isAuthRetryableFetchError(error) && error.status === 0) fields.message = error.message;
    return fields;
}

/** Sentry rejects or hides empty tag values, so a missing status or code is left out. */
export function authErrorTags(step: AuthStep, fields: SafeAuthErrorFields): Record<string, string> {
    const tags: Record<string, string> = { "auth.step": step, "auth.error": fields.name };
    if (fields.status !== undefined) tags["auth.status"] = String(fields.status);
    if (fields.code) tags["auth.code"] = fields.code;
    return tags;
}

export const reportAuthError: AuthErrorReporter = (step, error) => {
    const fields = safeAuthErrorFields(error);
    const { message } = fields;
    // The original error is deliberately not passed on: its message and stack may carry the email or the token.
    Sentry.captureException(new Error(`auth ${step} failed: ${fields.name}`), {
        level: "error",
        tags: authErrorTags(step, fields),
        extra: message ? { message } : undefined,
    });
};

export interface SignOutAuth {
    signOut(): Promise<{ error: unknown }>;
}

/** Signs the visitor out and reports a failure; the caller redirects either way, so a failed sign-out never shows an error page. */
export async function handleSignOut(auth: SignOutAuth | null, report: AuthErrorReporter): Promise<void> {
    if (!auth) return;

    let error: unknown;
    try {
        ({ error } = await auth.signOut());
    } catch (thrown) {
        error = thrown ?? new Error("signOut threw");
    }

    const { kind } = classifyAuthError("sign_out", error);
    if (kind === "unavailable" || kind === "unexpected") {
        report("sign_out", error);
    }
}
