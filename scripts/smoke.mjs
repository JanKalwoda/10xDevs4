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

async function appRequest(path, { method = "GET", form, json, contentType } = {}) {
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
                ...(json !== undefined ? { "Content-Type": contentType ?? "application/json" } : {}),
            },
            body: form ? new URLSearchParams(form).toString() : json !== undefined ? JSON.stringify(json) : undefined,
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

const DRILL_DEFAULTS = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false };

async function saveDrill(name, overrides = {}, options = {}) {
    const response = await appRequest("/api/drills", { method: "POST", json: { name, ...DRILL_DEFAULTS, ...overrides }, ...options });
    ensure(response.headers.get("cache-control")?.includes("no-store"));
    const body = await response.json().catch(() => null);
    ensure(body !== null && typeof body === "object");
    return { status: response.status, body };
}

async function verifyAnonymousDrillApi() {
    const save = await saveDrill("Anonymous drill");
    ensure(save.status === 401);
    ensure(save.body.ok === false && save.body.code === "unauthorized");

    const page = await appRequest("/create");
    const location = responseLocation(page);
    ensure(page.status === 302);
    ensure(location?.pathname === "/auth/signin");
    ensure(location.searchParams.get("next") === "/create");
}

async function verifyCreatePage() {
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    const dashboardMarkup = await dashboard.text();
    // Tailwind classes such as has-[>svg] contain ">", so the link is matched lazily up to its label instead of by attribute.
    ensure(/<a href="\/create"[\s\S]*?>\s*Create a timer\s*<\/a>/.test(dashboardMarkup));

    const page = await appRequest("/create");
    ensure(page.status === 200);
    const markup = await page.text();
    ensure(markup.includes("Create a timer"));
    ensure(markup.includes("Save timer"));
}

async function verifySavedDrillApi() {
    const first = await saveDrill("Smoke drill");
    ensure(first.status === 201 && first.body.ok === true);
    ensure(first.body.drill.name === "Smoke drill");
    ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(first.body.drill.id));
    const { configuration } = first.body.drill;
    ensure(configuration.preparationSeconds === 5 && configuration.exerciseSeconds === 4 && configuration.restSeconds === 2);
    ensure(configuration.repetitions === 3 && configuration.randomStartEnabled === false);

    const duplicate = await saveDrill("SMOKE DRILL");
    ensure(duplicate.status === 409 && duplicate.body.code === "duplicate_name");
    ensure(typeof duplicate.body.fieldErrors?.name === "string");

    const invalid = await saveDrill("Invalid drill", { rest: "99:99" });
    ensure(invalid.status === 400 && invalid.body.code === "validation");
    ensure(typeof invalid.body.fieldErrors?.rest === "string");

    const wrongType = await saveDrill("Wrong type drill", {}, { contentType: "text/plain" });
    ensure(wrongType.status === 415 && wrongType.body.code === "unsupported_media_type");
}

// One drill is already saved; fill up to 48 so exactly two of five concurrent distinct names fit under the limit of 50.
// The outcome is a regression signal only (it also holds if the requests happen to serialise);
// the advisory lock itself is proven by the pgTAP boundary tests.
async function verifyDrillLimit() {
    for (let index = 2; index <= 48; index += 1) {
        const filler = await saveDrill("Smoke filler " + index);
        ensure(filler.status === 201);
    }

    const results = await Promise.all(["A", "B", "C", "D", "E"].map((suffix) => saveDrill("Smoke concurrent " + suffix)));
    ensure(results.filter((result) => result.status === 201).length === 2);
    const refused = results.filter((result) => result.status === 409);
    ensure(refused.length === 3);
    ensure(refused.every((result) => result.body.code === "limit_reached"));

    const overLimit = await saveDrill("Smoke over the limit");
    ensure(overLimit.status === 409 && overLimit.body.code === "limit_reached");
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

    await runStep("anonymous drill API answers 401 and /create redirects to sign-in", verifyAnonymousDrillApi);
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

    await runStep("anonymous drill API answers 401 and /create redirects to sign-in", verifyAnonymousDrillApi);

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
    await runStep("signed-in user reaches /create and the dashboard links to it", verifyCreatePage);
    await runStep("signed-in user saves, duplicates, invalid and wrong-type requests get stable API answers", verifySavedDrillApi);
    await runStep("the 50-timer limit refuses the 51st save, also for concurrent requests", verifyDrillLimit);
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
