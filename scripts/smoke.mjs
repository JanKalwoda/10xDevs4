// Smoke test for a local Supabase/Mailpit stack or credential-free public routes.
// Run with SMOKE_MODE=local|remote and BASE_URL pointing at the app preview.

import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { URL } from "node:url";

const mode = process.env.SMOKE_MODE ?? "local";
if (!["local", "remote"].includes(mode)) throw new Error("SMOKE_MODE must be local or remote");
if (mode === "remote" && !process.env.BASE_URL) throw new Error("Remote smoke requires BASE_URL");

const baseUrl = new URL(process.env.BASE_URL ?? "http://localhost:4321");
if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("BASE_URL must be a public app origin");
}
const appOrigin = baseUrl.origin;
const localAppOrigins = ["http://localhost:4321", "http://localhost:4323"];
if (mode === "local" && !localAppOrigins.includes(appOrigin)) {
    throw new Error("Local smoke requires a configured localhost app origin");
}
const mailpitUrl = new URL(process.env.MAILPIT_URL ?? "http://localhost:55324");
if (
    mode === "local" &&
    (mailpitUrl.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(mailpitUrl.hostname) ||
        mailpitUrl.username ||
        mailpitUrl.password ||
        mailpitUrl.search ||
        mailpitUrl.hash)
) {
    throw new Error("Local smoke requires a local Mailpit URL");
}

const NEUTRAL_MESSAGE = "If an account can use this email, a sign-in link will arrive shortly.";
const RETRY_MESSAGE = "This sign-in link is invalid or expired. Request a new link.";
const EMAIL_SUBJECT = "Your Drill Me sign-in link";
const cookieJar = new Map();
const receivedMessageIds = new Set();
let activeStep = "smoke setup";

function ensure(condition) {
    if (!condition) throw new Error("verification failed");
}

function cookieHeader() {
    return [...cookieJar.entries()].map(([name, value]) => name + "=" + value).join("; ");
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

        if (expiredByAge || expiredByDate) cookieJar.delete(name);
        else cookieJar.set(name, value);
    }
}

async function appRequest(path, { method = "GET", form } = {}) {
    const target = new URL(path, appOrigin);
    if (target.origin !== appOrigin) throw new Error("app origin mismatch");

    let response;
    try {
        response = await fetch(target, {
            method,
            redirect: "manual",
            headers: {
                Cookie: cookieHeader(),
                Origin: appOrigin,
                ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
            },
            body: form ? new URLSearchParams(form).toString() : undefined,
        });
    } catch {
        throw new Error("app request failed");
    }

    storeCookies(response);
    return response;
}

async function mailpitJson(path) {
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

function recipientsContain(message, email) {
    return Array.isArray(message.To) && message.To.some((recipient) => (recipient?.Address ?? recipient?.Email)?.toLowerCase() === email.toLowerCase());
}

async function waitForEmail(email) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        const messages = await mailpitJson("/api/v1/messages?limit=50");
        const summary = (messages.messages ?? []).find((message) => message.ID && !receivedMessageIds.has(message.ID) && recipientsContain(message, email));
        if (summary) {
            receivedMessageIds.add(summary.ID);
            const message = await mailpitJson("/api/v1/message/" + encodeURIComponent(summary.ID));
            ensure(message.Subject === EMAIL_SUBJECT);
            ensure(typeof message.HTML === "string");
            ensure(message.HTML.includes("Use this one-time link to sign in to Drill Me:"));
            ensure(message.HTML.includes("Continue to Drill Me"));
            return message;
        }
        await setTimeout(250);
    }
    throw new Error("email was not received");
}

function decodeHtmlAttribute(value) {
    return value
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function callbackFromMessage(message) {
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
    ensure(next === "/" || next === "/dashboard");

    return { path: callback.pathname + callback.search, tokenHash, next };
}

function accountNavLinks(markup) {
    const accountNav = [...markup.matchAll(/<nav\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/nav>/gi)].find(([, attributes]) => {
        const ariaLabel = attributes.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1];
        return ariaLabel === "Account";
    });
    if (!accountNav) return [];

    return [...accountNav[2].matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => {
        const href = attributes.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
        const text = decodeHtmlAttribute(
            content
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;/gi, " "),
        )
            .replace(/\s+/g, " ")
            .trim();
        return { href, text };
    });
}

function hasHomeAccountLink(markup, label, href) {
    return accountNavLinks(markup).some((link) => link.href === href && link.text === label);
}

function responseLocation(response) {
    const location = response.headers.get("location");
    if (!location) return null;
    try {
        const url = new URL(location, appOrigin);
        return url.origin === appOrigin ? url : null;
    } catch {
        return null;
    }
}

async function runStep(name, action) {
    activeStep = name;
    const result = await action();
    console.log("PASS  " + name);
    return result;
}

async function requestEmailLink(email, next) {
    const response = await appRequest("/api/auth/signin", {
        method: "POST",
        form: { email, next },
    });
    ensure(response.status === 200);
    const body = await response.json().catch(() => null);
    ensure(body?.ok === true && body.message === NEUTRAL_MESSAGE);
}

async function confirmLink(link) {
    const page = await appRequest(link.path);
    ensure(page.status === 200);
    ensure(page.headers.get("cache-control")?.includes("no-store"));
    ensure(page.headers.get("referrer-policy") === "no-referrer");
    const markup = await page.text();
    ensure(markup.includes('id="email-link-confirmation"'));
    ensure(markup.includes("Continue to account"));

    const response = await appRequest("/api/auth/callback", {
        method: "POST",
        form: { token_hash: link.tokenHash, type: "email", next: link.next },
    });
    ensure(response.status === 303);
    const location = responseLocation(response);
    ensure(location?.pathname === link.next);
    ensure(cookieJar.size > 0);
}

async function verifyDashboardAndSignOut() {
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    const markup = await dashboard.text();
    ensure(markup.includes("Dashboard"));
    ensure(markup.includes("Sign out"));

    const signout = await appRequest("/api/auth/signout", { method: "POST", form: {} });
    ensure(signout.status === 302);
    ensure(responseLocation(signout)?.pathname === "/");

    const protectedAfterSignOut = await appRequest("/dashboard");
    const location = responseLocation(protectedAfterSignOut);
    ensure(protectedAfterSignOut.status === 302);
    ensure(location?.pathname === "/auth/signin");
}

async function neutralRetryForCallback(location) {
    ensure(location?.pathname === "/auth/callback");
    ensure(location.searchParams.get("error") === "invalid");
    const retryPage = await appRequest(location.pathname + location.search);
    ensure(retryPage.status === 200);
    const markup = await retryPage.text();
    ensure(markup.includes("Sign-in link unavailable"));
    ensure(markup.includes(RETRY_MESSAGE));
}

async function runRemoteSmoke() {
    console.log("Remote smoke checks public routes and anonymous dashboard protection only; it does not test email delivery or authentication exchange.");

    await runStep("public home route", async () => {
        const response = await appRequest("/");
        ensure(response.status === 200);
    });

    await runStep("public sign-in route", async () => {
        const response = await appRequest("/auth/signin");
        ensure(response.status === 200);
    });

    await runStep("public callback retry route", async () => {
        const response = await appRequest("/auth/callback");
        ensure(response.status === 200);
        ensure(response.headers.get("cache-control")?.includes("no-store"));
        ensure(response.headers.get("referrer-policy") === "no-referrer");
        const markup = await response.text();
        ensure(markup.includes("Sign-in link unavailable"));
        ensure(markup.includes(RETRY_MESSAGE));
    });

    await runStep("anonymous dashboard redirects to sign-in", async () => {
        const response = await appRequest("/dashboard");
        const location = responseLocation(response);
        ensure(response.status === 302);
        ensure(location?.pathname === "/auth/signin");
        ensure(location.searchParams.get("next") === "/dashboard");
    });
}

async function runLocalSmoke() {
    const email = "smoke-" + Date.now() + "-" + randomUUID() + "@example.com";

    await runStep("public home route", async () => {
        const response = await appRequest("/");
        ensure(response.status === 200);
    });

    await runStep("anonymous dashboard redirects to sign-in", async () => {
        const response = await appRequest("/dashboard");
        const location = responseLocation(response);
        ensure(response.status === 302);
        ensure(location?.pathname === "/auth/signin");
        ensure(location.searchParams.get("next") === "/dashboard");
    });

    await runStep("new-account email request returns a neutral result", () => requestEmailLink(email, "/dashboard"));

    const newAccountLink = await runStep("Mailpit receives the new-account confirmation email", async () => {
        const message = await waitForEmail(email);
        return callbackFromMessage(message);
    });

    await runStep("confirmation GET prepares the explicit POST without consuming the link", async () => {
        const page = await appRequest(newAccountLink.path);
        ensure(page.status === 200);
        ensure(page.headers.get("cache-control")?.includes("no-store"));
        ensure(page.headers.get("referrer-policy") === "no-referrer");
        const markup = await page.text();
        ensure(markup.includes('id="email-link-confirmation"'));
        ensure(markup.includes("Continue to account"));
    });

    await runStep("explicit POST establishes the SSR session from the new-account link", () => confirmLink(newAccountLink));
    await runStep("authenticated SSR home shell links Account to the dashboard", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasHomeAccountLink(markup, "Account", "/dashboard"));
    });
    await runStep("SSR cookies authorize the dashboard after new-account confirmation", async () => {
        const dashboard = await appRequest("/dashboard");
        ensure(dashboard.status === 200);
        const markup = await dashboard.text();
        ensure(markup.includes("Dashboard"));
        ensure(markup.includes("Sign out"));
    });
    await runStep("sign-out clears the new-account session", verifyDashboardAndSignOut);
    await runStep("signed-out SSR home shell links Sign in to the sign-in page", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasHomeAccountLink(markup, "Sign in", "/auth/signin"));
    });

    await runStep("existing-account email request returns the same neutral result", () => requestEmailLink(email, "/"));
    const existingAccountLink = await runStep("Mailpit receives the existing-account magic-link email", async () => {
        const message = await waitForEmail(email);
        return callbackFromMessage(message);
    });

    await runStep("existing-account confirmation GET leaves the link unconsumed", async () => {
        const page = await appRequest(existingAccountLink.path);
        ensure(page.status === 200);
        ensure(page.headers.get("cache-control")?.includes("no-store"));
        ensure(page.headers.get("referrer-policy") === "no-referrer");
        const markup = await page.text();
        ensure(markup.includes('id="email-link-confirmation"'));
    });
    await runStep("explicit POST establishes the SSR session from the existing-account link", () => confirmLink(existingAccountLink));
    await runStep("existing-account SSR home shell links Account to the dashboard", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasHomeAccountLink(markup, "Account", "/dashboard"));
    });
    await runStep("SSR cookies authorize the dashboard after existing-account sign-in", async () => {
        const dashboard = await appRequest("/dashboard");
        ensure(dashboard.status === 200);
        const markup = await dashboard.text();
        ensure(markup.includes("Dashboard"));
    });
    await runStep("sign-out clears the existing-account session", verifyDashboardAndSignOut);
    await runStep("signed-out SSR home shell links Sign in to the sign-in page again", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasHomeAccountLink(markup, "Sign in", "/auth/signin"));
    });

    await runStep("malformed link returns the neutral retry state", async () => {
        const response = await appRequest("/api/auth/callback", {
            method: "POST",
            form: { token_hash: "malformed-token", type: "email", next: "/" },
        });
        ensure(response.status === 303);
        await neutralRetryForCallback(responseLocation(response));
    });

    await runStep("consumed new-account link cannot be reused and returns the neutral retry state", async () => {
        const response = await appRequest("/api/auth/callback", {
            method: "POST",
            form: { token_hash: newAccountLink.tokenHash, type: "email", next: newAccountLink.next },
        });
        ensure(response.status === 303);
        await neutralRetryForCallback(responseLocation(response));
    });
}

try {
    if (mode === "remote") await runRemoteSmoke();
    else await runLocalSmoke();
    console.log("\nAll smoke steps passed.");
} catch {
    console.log("FAIL  " + activeStep + " (details suppressed to protect email and token data)");
    process.exitCode = 1;
}
