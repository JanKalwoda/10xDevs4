import { z } from "zod";

export const EMAIL_LINK_MESSAGE = "If an account can use this email, a sign-in link will arrive shortly.";
export const EMAIL_LINK_RETRY_MESSAGE = "This sign-in link is invalid or expired. Request a new link.";
export const EMAIL_LINK_PAGE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
} as const;

const LOCAL_PATH_ORIGIN = "https://local.invalid";
const SAFE_RESPONSE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
};

function hasControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 0x1f || code === 0x7f;
    });
}

export function isSafeNextPath(value: unknown): value is string {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 2048 ||
        value !== value.trim() ||
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\") ||
        hasControlCharacters(value) ||
        /%(?![0-9a-f]{2})/i.test(value)
    ) {
        return false;
    }

    const pathname = value.split(/[?#]/, 1)[0] ?? "";
    if (/%(?:2f|5c)/i.test(pathname)) {
        return false;
    }

    try {
        const destination = new URL(value, LOCAL_PATH_ORIGIN);
        return destination.origin === LOCAL_PATH_ORIGIN && destination.username === "" && destination.password === "";
    } catch {
        return false;
    }
}

const safeNextPathSchema = z.string().refine(isSafeNextPath, "Enter a local path").default("/");

export const emailLinkRequestSchema = z.object({
    email: z.string().trim().max(320).pipe(z.email()),
    next: safeNextPathSchema,
});

export const emailLinkCallbackSchema = z.object({
    token_hash: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .refine((value) => !/\s/.test(value) && !hasControlCharacters(value)),
    type: z.literal("email"),
    next: safeNextPathSchema,
});

export type EmailLinkCallbackPageState = { kind: "confirm"; tokenHash: string; next: string } | { kind: "retry"; message: string; next: string };

export function setEmailLinkPageSecurityHeaders(headers: Headers): void {
    for (const [name, value] of Object.entries(EMAIL_LINK_PAGE_HEADERS)) {
        headers.set(name, value);
    }
}

export function emailLinkCallbackPageState(url: string): EmailLinkCallbackPageState {
    try {
        const callbackUrl = new URL(url);
        const requestedNext = callbackUrl.searchParams.get("next");
        const next = isSafeNextPath(requestedNext) ? requestedNext : "/";

        if (callbackUrl.searchParams.has("error") || (callbackUrl.searchParams.has("next") && !isSafeNextPath(requestedNext))) {
            return { kind: "retry", message: EMAIL_LINK_RETRY_MESSAGE, next };
        }

        const parsed = emailLinkCallbackSchema.safeParse({
            token_hash: callbackUrl.searchParams.get("token_hash"),
            type: callbackUrl.searchParams.get("type"),
            next: callbackUrl.searchParams.has("next") ? requestedNext : undefined,
        });
        if (!parsed.success) {
            return { kind: "retry", message: EMAIL_LINK_RETRY_MESSAGE, next };
        }

        return { kind: "confirm", tokenHash: parsed.data.token_hash, next: parsed.data.next };
    } catch {
        return { kind: "retry", message: EMAIL_LINK_RETRY_MESSAGE, next: "/" };
    }
}

export function legacySignupRedirectUrl(next: unknown): string {
    return isSafeNextPath(next) ? "/auth/signin?next=" + encodeURIComponent(next) : "/auth/signin";
}

export interface EmailLinkRequest {
    email: string;
    options: {
        shouldCreateUser: true;
        emailRedirectTo: string;
    };
}

export interface EmailLinkVerification {
    token_hash: string;
    type: "email";
}

export interface EmailLinkAuthPort {
    signInWithOtp(input: EmailLinkRequest): Promise<{ error: unknown }>;
    verifyOtp(input: EmailLinkVerification): Promise<{ error: unknown }>;
}

export interface EmailCookieToWrite<Options> {
    name: string;
    value: string;
    options: Options;
}

export function forwardAuthCookies<Options>(cookiesToSet: readonly EmailCookieToWrite<Options>[], setCookie: (name: string, value: string, options: Options) => unknown): void {
    for (const cookie of cookiesToSet) {
        setCookie(cookie.name, cookie.value, cookie.options);
    }
}

export function signInUrlForProtectedPath(path: string): string {
    const next = isSafeNextPath(path) ? path : "/dashboard";
    return "/auth/signin?next=" + encodeURIComponent(next);
}

export function buildEmailRedirectTo(requestUrl: string, next: string): string | null {
    if (!isSafeNextPath(next)) {
        return null;
    }

    try {
        const request = new URL(requestUrl);
        if (request.protocol !== "http:" && request.protocol !== "https:") {
            return null;
        }
        const callback = new URL("/auth/callback", request.origin);
        callback.searchParams.set("next", next);
        return callback.href;
    } catch {
        return null;
    }
}
export type EmailLinkRequestResult = { ok: true; status: 200; message: string } | { ok: false; status: 400; message: string };

export async function requestEmailLink(input: unknown, requestUrl: string, auth: Pick<EmailLinkAuthPort, "signInWithOtp"> | null): Promise<EmailLinkRequestResult> {
    const parsed = emailLinkRequestSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, status: 400, message: "Enter a valid email address." };
    }

    const emailRedirectTo = buildEmailRedirectTo(requestUrl, parsed.data.next);
    if (!emailRedirectTo) {
        return { ok: false, status: 400, message: "Enter a valid email address." };
    }

    if (auth) {
        try {
            await auth.signInWithOtp({
                email: parsed.data.email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo,
                },
            });
        } catch {
            // Keep provider failures account-neutral; the response must not reveal account state.
        }
    }

    return { ok: true, status: 200, message: EMAIL_LINK_MESSAGE };
}

export type EmailLinkVerificationResult = { ok: true; next: string } | { ok: false; next: string; message: string };

export async function verifyEmailLink(input: unknown, auth: Pick<EmailLinkAuthPort, "verifyOtp"> | null): Promise<EmailLinkVerificationResult> {
    const parsed = emailLinkCallbackSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, next: "/", message: EMAIL_LINK_RETRY_MESSAGE };
    }
    if (!auth) {
        return { ok: false, next: parsed.data.next, message: EMAIL_LINK_RETRY_MESSAGE };
    }

    try {
        const { error } = await auth.verifyOtp({
            token_hash: parsed.data.token_hash,
            type: "email",
        });
        if (error) {
            return { ok: false, next: parsed.data.next, message: EMAIL_LINK_RETRY_MESSAGE };
        }
    } catch {
        return { ok: false, next: parsed.data.next, message: EMAIL_LINK_RETRY_MESSAGE };
    }

    return { ok: true, next: parsed.data.next };
}

function jsonResponse(body: unknown, status: number): Response {
    return Response.json(body, {
        status,
        headers: SAFE_RESPONSE_HEADERS,
    });
}

export async function handleEmailLinkRequest(request: Request, auth: Pick<EmailLinkAuthPort, "signInWithOtp"> | null): Promise<Response> {
    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return jsonResponse({ ok: false, message: "Enter a valid email address." }, 400);
    }

    const result = await requestEmailLink(
        {
            email: form.get("email"),
            next: form.get("next") ?? undefined,
        },
        request.url,
        auth,
    );

    return jsonResponse({ ok: result.ok, message: result.message }, result.status);
}

function callbackRedirect(path: string): Response {
    return new Response(null, {
        status: 303,
        headers: {
            ...SAFE_RESPONSE_HEADERS,
            Location: path,
        },
    });
}

export async function handleEmailLinkCallback(request: Request, auth: Pick<EmailLinkAuthPort, "verifyOtp"> | null): Promise<Response> {
    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return callbackRedirect("/auth/callback?error=invalid&next=%2F");
    }

    const input = {
        token_hash: form.get("token_hash"),
        type: form.get("type"),
        next: form.get("next") ?? undefined,
    };
    const result = await verifyEmailLink(input, auth);
    if (!result.ok) {
        const query = new URLSearchParams({ error: "invalid", next: result.next });
        return callbackRedirect("/auth/callback?" + query.toString());
    }

    return callbackRedirect(result.next);
}
