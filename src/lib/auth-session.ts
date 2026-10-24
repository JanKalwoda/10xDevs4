import type { User } from "@supabase/supabase-js";

import { classifyAuthError, type AuthErrorReporter } from "./auth-errors.ts";

export type SessionState = { kind: "user"; user: User } | { kind: "guest" } | { kind: "unavailable" };

export interface SessionAuth {
    getUser(): Promise<{ data: { user: User | null }; error: unknown }>;
}

// A missing client is a configuration fault that repeats on every request; one report per isolate is enough.
let missingClientReported = false;

export function resetSessionReportStateForTests(): void {
    missingClientReported = false;
}

/**
 * Tells a guest from an outage. The middleware only calls this; a guest and a dead session stay guests without a report,
 * while an unreachable auth is `unavailable` so a protected page does not pretend the visitor signed out.
 */
export async function resolveSession(auth: SessionAuth | null, report: AuthErrorReporter): Promise<SessionState> {
    if (auth === null) {
        if (!missingClientReported) {
            missingClientReported = true;
            report("session", new Error("supabase client not configured"));
        }
        return { kind: "unavailable" };
    }

    const { data, error } = await auth.getUser();

    switch (classifyAuthError("session", error).kind) {
        case "unavailable":
            report("session", error);
            return { kind: "unavailable" };
        case "unexpected":
            report("session", error);
            return { kind: "guest" };
        case "expected":
            return { kind: "guest" };
        case "ok":
            return data.user ? { kind: "user", user: data.user } : { kind: "guest" };
    }
}
