// Shared HTTP client for scripts/smoke.mjs and tests/integration/*.test.mjs:
// an app client with its own cookie jar, a Mailpit reader and the magic-link sign-in.

import { setTimeout } from "node:timers/promises";
import { URL } from "node:url";

export const NEUTRAL_MESSAGE = "If an account can use this email, a sign-in link will arrive shortly.";
export const RETRY_MESSAGE = "This sign-in link is invalid or expired. Request a new link.";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DRILL_DEFAULTS = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false };

const EMAIL_SUBJECT = "Your Drill Me sign-in link";
const LOCAL_APP_ORIGINS = ["http://localhost:4321", "http://localhost:4323"];
const SNAPSHOT_HEADERS = ["cache-control", "content-type", "referrer-policy"];

export const AUTH_LIMIT_MESSAGE =
    "Sign-in failed (no email / link rejected). Most likely the local Supabase auth limit (30 sign-ins or verifications per 5 min per IP) was hit, not an app bug: wait 5 minutes and run again before debugging.";

// A sign-in failure whose message is safe to print (no address, token or cookie).
export class SignInError extends Error {
    constructor(message = AUTH_LIMIT_MESSAGE) {
        super(message);
        this.name = "SignInError";
    }
}

export function ensure(condition) {
    if (!condition) throw new Error("verification failed");
}

export function parseAppOrigin(raw) {
    const baseUrl = new URL(raw ?? "http://localhost:4321");
    if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
        throw new Error("BASE_URL must be a public app origin");
    }
    return baseUrl.origin;
}

// Local runs only: the app must be a configured localhost origin and Mailpit a plain local http URL.
export function resolveLocalTargets(env = process.env) {
    const appOrigin = parseAppOrigin(env.BASE_URL);
    if (!LOCAL_APP_ORIGINS.includes(appOrigin)) {
        throw new Error("Local runs require BASE_URL to be a configured localhost app origin (" + LOCAL_APP_ORIGINS.join(", ") + ")");
    }
    const mailpitUrl = new URL(env.MAILPIT_URL ?? "http://localhost:55324");
    if (
        mailpitUrl.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(mailpitUrl.hostname) ||
        mailpitUrl.username ||
        mailpitUrl.password ||
        mailpitUrl.search ||
        mailpitUrl.hash
    ) {
        throw new Error("Local runs require MAILPIT_URL to be a local Mailpit URL");
    }
    return { appOrigin, mailpitUrl };
}

export function decodeHtmlAttribute(value) {
    return value
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

export function visibleText(markup) {
    return decodeHtmlAttribute(markup.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
}

// The redirect target as an in-app URL, or null when there is none or it leaves the app origin.
export function responseLocation(response, appOrigin) {
    const location = response.headers.get("location");
    if (!location) return null;
    try {
        const url = new URL(location, appOrigin);
        return url.origin === appOrigin ? url : null;
    } catch {
        return null;
    }
}

// Every client owns its cookie jar, so one test file can hold accounts A, B and a guest at once.
export function createAppClient(appOrigin, initialCookies = {}) {
    const jar = new Map(Object.entries(initialCookies));

    function cookieHeader() {
        return [...jar.entries()].map(([name, value]) => name + "=" + value).join("; ");
    }

    function storeCookies(response) {
        for (const raw of response.headers.getSetCookie()) {
            const [pair, ...attrs] = raw.split(";");
            const separator = pair.indexOf("=");
            if (separator < 1) continue;

            const name = pair.slice(0, separator).trim();
            const value = pair.slice(separator + 1);
            const expiredByAge = attrs.some((attr) => /^max-age=0$/i.test(attr.trim()));
            const expiresAttribute = attrs.find((attr) => /^expires=/i.test(attr.trim()));
            const expiredByDate = expiresAttribute && Date.parse(expiresAttribute.slice(expiresAttribute.indexOf("=") + 1)) <= Date.now();

            if (expiredByAge || expiredByDate) jar.delete(name);
            else jar.set(name, value);
        }
    }

    async function send(target, init) {
        let response;
        try {
            response = await fetch(target, { redirect: "manual", ...init });
        } catch {
            throw new Error("app request failed");
        }
        storeCookies(response);
        return response;
    }

    async function request(path, { method = "GET", form, json, contentType, headers } = {}) {
        const target = new URL(path, appOrigin);
        if (target.origin !== appOrigin) throw new Error("app origin mismatch");

        return send(target, {
            method,
            headers: {
                Cookie: cookieHeader(),
                Origin: appOrigin,
                ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
                ...(json !== undefined ? { "Content-Type": contentType ?? "application/json" } : {}),
                ...headers,
            },
            body: form ? new URLSearchParams(form).toString() : json !== undefined ? JSON.stringify(json) : undefined,
        });
    }

    // For path variants such as "//timers" or "/%63reate": the URL parser must not rewrite them into another origin.
    async function rawRequest(rawUrl, { method = "GET", form, headers } = {}) {
        if (new URL(rawUrl).origin !== appOrigin) throw new Error("app origin mismatch");

        return send(rawUrl, {
            method,
            headers: {
                Cookie: cookieHeader(),
                Origin: appOrigin,
                ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
                ...headers,
            },
            body: form ? new URLSearchParams(form).toString() : undefined,
        });
    }

    // An unsafe request with a chosen Origin (or none): Astro checkOrigin must answer 403 before the handler runs.
    async function originRequest(path, { method, origin }) {
        const target = new URL(path, appOrigin);
        if (target.origin !== appOrigin) throw new Error("app origin mismatch");

        return send(target, { method, headers: { Cookie: cookieHeader(), ...(origin ? { Origin: origin } : {}) } });
    }

    async function snapshot(path) {
        const response = await request(path);
        const raw = await response.text();
        return {
            status: response.status,
            raw,
            location: response.headers.get("location"),
            headers: SNAPSHOT_HEADERS.map((name) => response.headers.get(name)),
        };
    }

    return {
        appOrigin,
        request,
        rawRequest,
        originRequest,
        snapshot,
        cookieNames: () => [...jar.keys()],
        cookies: () => Object.fromEntries(jar),
        // A new client with its own jar seeded from the given cookies (a copy of an account's session, or a forged one).
        withCookies: (cookies) => createAppClient(appOrigin, cookies),
    };
}

export function createMailpit(mailpitUrl, { timeoutMs = 20_000 } = {}) {
    const receivedMessageIds = new Set();

    function recipientsContain(message, email) {
        return Array.isArray(message.To) && message.To.some((recipient) => (recipient?.Address ?? recipient?.Email)?.toLowerCase() === email.toLowerCase());
    }

    async function json(path) {
        let response;
        try {
            response = await fetch(new URL(path, mailpitUrl), { redirect: "error" });
        } catch {
            throw new Error("Mailpit request failed");
        }
        ensure(response.ok);

        try {
            return await response.json();
        } catch {
            throw new Error("Mailpit response was invalid");
        }
    }

    async function waitForEmail(email) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const messages = await json("/api/v1/messages?limit=50");
            const summary = (messages.messages ?? []).find((message) => message.ID && !receivedMessageIds.has(message.ID) && recipientsContain(message, email));
            if (summary) {
                receivedMessageIds.add(summary.ID);
                const message = await json("/api/v1/message/" + encodeURIComponent(summary.ID));
                ensure(message.Subject === EMAIL_SUBJECT);
                ensure(typeof message.HTML === "string");
                ensure(message.HTML.includes("Use this one-time link to sign in to Drill Me:"));
                ensure(message.HTML.includes("Continue to Drill Me"));
                return message;
            }
            await setTimeout(250);
        }
        // A missing mail is the usual face of the local auth rate limit: the app hides provider errors.
        throw new SignInError();
    }

    return { waitForEmail };
}

export async function requestEmailLink(client, email, next) {
    const response = await client.request("/api/auth/signin", {
        method: "POST",
        form: next === undefined ? { email } : { email, next },
    });
    ensure(response.status === 200);
    const body = await response.json().catch(() => null);
    ensure(body?.ok === true && body.message === NEUTRAL_MESSAGE);
}

export function callbackFromMessage(message, appOrigin) {
    const links = [...message.HTML.matchAll(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)].map((match) => decodeHtmlAttribute(match[1] ?? match[2]));
    const href = links.find((value) => value.includes("/auth/callback"));
    ensure(href);

    let callback;
    try {
        callback = new URL(href);
    } catch {
        throw new Error("email callback link was invalid");
    }
    ensure(callback.origin === appOrigin);
    ensure(callback.pathname === "/auth/callback");
    ensure(callback.searchParams.get("type") === "email");

    const tokenHash = callback.searchParams.get("token_hash");
    const next = callback.searchParams.get("next") ?? "/";
    ensure(tokenHash && !/\s/.test(tokenHash));
    ensure(next === "/" || next === "/dashboard" || next === "/timers");

    return { path: callback.pathname + callback.search, tokenHash, next };
}

export async function confirmLink(client, link) {
    const page = await client.request(link.path);
    ensure(page.status === 200);
    ensure(page.headers.get("cache-control")?.includes("no-store"));
    ensure(page.headers.get("referrer-policy") === "no-referrer");
    const markup = await page.text();
    ensure(markup.includes('id="email-link-confirmation"'));
    ensure(markup.includes("Continue to your timers"));

    const response = await client.request("/api/auth/callback", {
        method: "POST",
        form: { token_hash: link.tokenHash, type: "email", next: link.next },
    });
    ensure(response.status === 303);
    const location = responseLocation(response, client.appOrigin);
    // A rejected token (rate limit, expired) comes back as the neutral retry redirect.
    if (location?.searchParams.get("error") === "invalid") throw new SignInError();
    ensure(location?.pathname === link.next);
    ensure(client.cookieNames().length > 0);
}

// Magic-link sign-in of a fresh account; returns the link that was consumed.
export async function signIn(client, mailpit, email, next = "/timers") {
    await requestEmailLink(client, email, next);
    const link = callbackFromMessage(await mailpit.waitForEmail(email), client.appOrigin);
    await confirmLink(client, link);
    return link;
}
