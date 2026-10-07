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

// An unsafe request with a chosen Origin (or none): Astro checkOrigin must answer 403 before the handler runs.
async function originRequest(path, { method, origin }) {
    const target = new URL(path, appOrigin);
    if (target.origin !== appOrigin) throw new Error("app origin mismatch");
    let response;
    try {
        response = await fetch(target, { method, redirect: "manual", headers: { Cookie: cookieHeader(), ...(origin ? { Origin: origin } : {}) } });
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PARAMETER_LINE = "Prep 0:05 · Exercise 0:04 · Rest 0:02 · 3 reps";
// Set from the 201 response of POST /api/drills before the first user signs out.
let savedDrill = null;

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
    ensure(UUID_PATTERN.test(first.body.drill.id));
    savedDrill = { id: first.body.drill.id, name: first.body.drill.name };
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

// Two drills are already saved; fill up to 48 so exactly two of five concurrent distinct names fit under the limit of 50.
// The outcome is a regression signal only (it also holds if the requests happen to serialise);
// the advisory lock itself is proven by the pgTAP boundary tests.
const fillerIds = [];

async function verifyDrillLimit() {
    for (let index = 3; index <= 48; index += 1) {
        const filler = await saveDrill("Smoke filler " + index);
        ensure(filler.status === 201);
        fillerIds.push(filler.body.drill.id);
    }

    const results = await Promise.all(["A", "B", "C", "D", "E"].map((suffix) => saveDrill("Smoke concurrent " + suffix)));
    ensure(results.filter((result) => result.status === 201).length === 2);
    const refused = results.filter((result) => result.status === 409);
    ensure(refused.length === 3);
    ensure(refused.every((result) => result.body.code === "limit_reached"));

    const overLimit = await saveDrill("Smoke over the limit");
    ensure(overLimit.status === 409 && overLimit.body.code === "limit_reached");
}

function visibleText(markup) {
    return decodeHtmlAttribute(markup.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
}

async function snapshot(path) {
    const response = await appRequest(path);
    const raw = await response.text();
    return {
        status: response.status,
        raw,
        location: response.headers.get("location"),
        headers: ["cache-control", "content-type", "referrer-policy"].map((name) => response.headers.get(name)),
    };
}

async function verifyOwnSavedDrillPages() {
    ensure(savedDrill !== null);
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    ensure(dashboard.headers.get("cache-control")?.includes("no-store"));
    const dashboardMarkup = await dashboard.text();
    ensure(dashboardMarkup.includes('href="/' + savedDrill.id + '"'));
    const dashboardText = visibleText(dashboardMarkup);
    ensure(dashboardText.includes(savedDrill.name));
    ensure(dashboardText.includes(PARAMETER_LINE));

    const page = await appRequest("/" + savedDrill.id);
    ensure(page.status === 200);
    ensure(page.headers.get("cache-control")?.includes("no-store"));
    const markup = await page.text();
    ensure(/<meta name="robots" content="noindex"/.test(markup));
    const text = visibleText(markup);
    // The details list each parameter in its own <li>, the dashboard card joins them with a middle dot.
    ensure(text.includes(savedDrill.name));
    ensure(PARAMETER_LINE.split(" · ").every((part) => text.includes(part)));
    ensure(/>\s*Start\s*</.test(markup));
    // Server-rendered details, never a running timer view.
    ensure(!markup.includes("Cancel drill") && !markup.includes("Pause"));
}

const EDITED_LINE = "Prep 0:05 · Exercise 0:04 · Rest 0:03 · 4 reps · Random start";
const OTHER_LINE = "Prep 0:05 · Exercise 0:06 · Rest 0:02 · 3 reps";
// The second timer of the first user: edits of savedDrill must never touch it.
let otherDrill = null;

async function updateDrill(id, name, overrides = {}, options = {}) {
    const response = await appRequest("/api/drills/" + id, { method: "PUT", json: { name, ...DRILL_DEFAULTS, ...overrides }, ...options });
    ensure(response.headers.get("cache-control")?.includes("no-store"));
    const body = await response.json().catch(() => null);
    ensure(body !== null && typeof body === "object");
    return { status: response.status, body };
}

async function snapshotUpdate(id) {
    const response = await appRequest("/api/drills/" + id, { method: "PUT", json: { name: "Foreign edit", ...DRILL_DEFAULTS } });
    return { status: response.status, raw: await response.text(), headers: ["cache-control", "content-type", "referrer-policy"].map((name) => response.headers.get(name)) };
}

async function dashboardText() {
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    return visibleText(await dashboard.text());
}

async function verifyOwnerEdit() {
    ensure(savedDrill !== null);
    const other = await saveDrill("Smoke other drill", { exercise: "0:06" });
    ensure(other.status === 201 && UUID_PATTERN.test(other.body.drill.id));
    otherDrill = { id: other.body.drill.id, name: other.body.drill.name };

    const edited = await updateDrill(savedDrill.id, "Smoke drill edited", { rest: "0:03", repetitions: "4", randomStartEnabled: true });
    ensure(edited.status === 200 && edited.body.ok === true);
    ensure(edited.body.drill.id === savedDrill.id && edited.body.drill.name === "Smoke drill edited");
    const { configuration } = edited.body.drill;
    ensure(configuration.preparationSeconds === 5 && configuration.exerciseSeconds === 4 && configuration.restSeconds === 3);
    ensure(configuration.repetitions === 4 && configuration.randomStartEnabled === true);
    savedDrill.name = "Smoke drill edited";

    const text = await dashboardText();
    ensure(text.includes("Smoke drill edited") && text.includes(EDITED_LINE));
    ensure(text.includes("Smoke other drill") && text.includes(OTHER_LINE));

    const details = await appRequest("/" + savedDrill.id);
    ensure(details.status === 200);
    ensure((await details.text()).includes('href="/' + savedDrill.id + '/edit"'));

    const page = await appRequest("/" + savedDrill.id + "/edit");
    ensure(page.status === 200);
    ensure(page.headers.get("cache-control")?.includes("no-store"));
    const markup = await page.text();
    ensure(/<meta name="robots" content="noindex"/.test(markup));
    ensure(markup.includes('value="Smoke drill edited"') && markup.includes('value="0:03"') && markup.includes('value="4"'));
    const pageText = visibleText(markup);
    ensure(pageText.includes("Edit timer") && pageText.includes("Save changes") && pageText.includes("Back to timer"));
}

async function verifyEditRules() {
    ensure(savedDrill !== null && otherDrill !== null);
    const duplicate = await updateDrill(savedDrill.id, "SMOKE OTHER DRILL");
    ensure(duplicate.status === 409 && duplicate.body.code === "duplicate_name");
    ensure(typeof duplicate.body.fieldErrors?.name === "string");

    const caseOnly = await updateDrill(savedDrill.id, "SMOKE DRILL EDITED", { rest: "0:03", repetitions: "4", randomStartEnabled: true });
    ensure(caseOnly.status === 200 && caseOnly.body.drill.name === "SMOKE DRILL EDITED");

    const longest = await updateDrill(savedDrill.id, "x".repeat(200));
    ensure(longest.status === 200 && longest.body.drill.name.length === 200);
    const tooLong = await updateDrill(savedDrill.id, "x".repeat(201));
    ensure(tooLong.status === 400 && tooLong.body.code === "validation" && typeof tooLong.body.fieldErrors?.name === "string");

    const invalid = await updateDrill(savedDrill.id, "Smoke drill edited", { rest: "99:99" });
    ensure(invalid.status === 400 && invalid.body.code === "validation" && typeof invalid.body.fieldErrors?.rest === "string");
    const wrongType = await updateDrill(savedDrill.id, "Smoke drill edited", {}, { contentType: "text/plain" });
    ensure(wrongType.status === 415 && wrongType.body.code === "unsupported_media_type");

    // Refused edits changed nothing; the final name is restored with the edited parameters.
    const restored = await updateDrill(savedDrill.id, "Smoke drill edited", { rest: "0:03", repetitions: "4", randomStartEnabled: true });
    ensure(restored.status === 200);
    savedDrill.name = "Smoke drill edited";
    const text = await dashboardText();
    ensure(text.includes("Smoke drill edited") && text.includes(EDITED_LINE) && !text.includes("x".repeat(200)));
    ensure(text.includes("Smoke other drill") && text.includes(OTHER_LINE));
}

async function verifyEditAtLimit() {
    ensure(savedDrill !== null);
    const atLimit = await updateDrill(savedDrill.id, "Smoke drill at the limit", { rest: "0:03", repetitions: "4", randomStartEnabled: true });
    ensure(atLimit.status === 200 && atLimit.body.drill.name === "Smoke drill at the limit");
    savedDrill.name = "Smoke drill at the limit";
}

async function verifyGuestEdit(id) {
    const put = await appRequest("/api/drills/" + id, { method: "PUT", json: { name: "Guest edit", ...DRILL_DEFAULTS } });
    ensure(put.status === 401 && put.headers.get("cache-control")?.includes("no-store"));
    const body = await put.json().catch(() => null);
    ensure(body?.ok === false && body.code === "unauthorized");

    const page = await appRequest("/" + id + "/edit");
    const location = responseLocation(page);
    ensure(page.status === 302);
    ensure(location?.pathname === "/auth/signin");
    ensure(location.searchParams.get("next") === "/" + id + "/edit");

    const unknown = await snapshot("/not-a-uuid/edit");
    const plain = await snapshot("/not-a-uuid");
    ensure(unknown.status === 404 && unknown.location === null);
    ensure(unknown.raw === plain.raw && JSON.stringify(unknown.headers) === JSON.stringify(plain.headers));
}

async function verifyForeignEdit() {
    ensure(savedDrill !== null);
    const foreign = await snapshotUpdate(savedDrill.id);
    const random = await snapshotUpdate(randomUUID());
    const malformed = await snapshotUpdate("not-a-uuid");
    ensure(foreign.status === 404 && random.status === 404 && malformed.status === 404);
    ensure(foreign.raw === random.raw && foreign.raw === malformed.raw);
    ensure(JSON.stringify(foreign.headers) === JSON.stringify(random.headers) && JSON.stringify(foreign.headers) === JSON.stringify(malformed.headers));
    ensure(foreign.headers[0]?.includes("no-store"));
    ensure(!foreign.raw.includes(savedDrill.id));

    const foreignPage = await snapshot("/" + savedDrill.id + "/edit");
    const randomPage = await snapshot("/" + randomUUID() + "/edit");
    const malformedPage = await snapshot("/not-a-uuid/edit");
    ensure(foreignPage.status === 404 && randomPage.status === 404 && malformedPage.status === 404);
    ensure(foreignPage.raw === randomPage.raw && foreignPage.raw === malformedPage.raw);
    ensure(JSON.stringify(foreignPage.headers) === JSON.stringify(randomPage.headers));
    ensure(!foreignPage.raw.includes(savedDrill.id) && !foreignPage.raw.includes(savedDrill.name));
}

async function verifyForeignSavedDrillPages() {
    ensure(savedDrill !== null);
    const foreign = await snapshot("/" + savedDrill.id);
    const random = await snapshot("/" + randomUUID());
    ensure(foreign.status === 404 && random.status === 404);
    ensure(foreign.raw === random.raw);
    ensure(JSON.stringify(foreign.headers) === JSON.stringify(random.headers));
    ensure(foreign.headers[0]?.includes("no-store"));
    ensure(!foreign.raw.includes(savedDrill.id));
    for (const path of ["/not-a-uuid", "/abc/def"]) {
        const other = await snapshot(path);
        ensure(other.status === 404 && other.location === null);
        ensure(other.raw === foreign.raw);
        ensure(JSON.stringify(other.headers) === JSON.stringify(foreign.headers));
    }

    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    const dashboardMarkup = await dashboard.text();
    ensure(!dashboardMarkup.includes(savedDrill.id));
    const dashboardText = visibleText(dashboardMarkup);
    ensure(!dashboardText.includes(savedDrill.name));
    ensure(dashboardText.includes("You have no saved timers yet."));
}

async function verifyGuestSavedDrillRouting() {
    ensure(savedDrill !== null);
    const guest = await appRequest("/" + savedDrill.id);
    const location = responseLocation(guest);
    ensure(guest.status === 302);
    ensure(location?.pathname === "/auth/signin");
    ensure(location.searchParams.get("next") === "/" + savedDrill.id);

    const unknown = await appRequest("/not-a-uuid");
    ensure(unknown.status === 404 && !unknown.headers.get("location"));
}

async function verifyFirstUserTimersUnchanged() {
    ensure(savedDrill !== null && otherDrill !== null);
    const text = await dashboardText();
    ensure(text.includes(savedDrill.name) && text.includes(EDITED_LINE));
    ensure(text.includes(otherDrill.name) && text.includes(OTHER_LINE));
}

async function deleteDrillRequest(id, options = {}) {
    return appRequest("/api/drills/" + id, { method: "DELETE", ...options });
}

async function snapshotDelete(id) {
    const response = await deleteDrillRequest(id);
    return { status: response.status, raw: await response.text(), headers: ["cache-control", "content-type", "referrer-policy"].map((name) => response.headers.get(name)) };
}

async function dashboardMarkup() {
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    return dashboard.text();
}

// Runs at the 50-timer limit, signed in as the first user.
async function verifyOwnerDelete() {
    ensure(savedDrill !== null && otherDrill !== null && fillerIds.length >= 3);
    const [first, second] = fillerIds;

    // Cross-origin protection: a foreign or missing Origin never reaches the handler and the timer survives.
    const foreignOrigin = await originRequest("/api/drills/" + first, { method: "DELETE", origin: "https://evil.example" });
    ensure(foreignOrigin.status === 403);
    const noOrigin = await originRequest("/api/drills/" + first, { method: "DELETE" });
    ensure(noOrigin.status === 403);
    ensure((await appRequest("/" + first)).status === 200);

    // The method list advertises DELETE and the other methods stay refused.
    for (const method of ["GET", "POST", "PATCH"]) {
        const refused = await appRequest("/api/drills/" + first, { method });
        ensure(refused.status === 405 && refused.headers.get("allow") === "PUT, DELETE");
    }

    const removed = await deleteDrillRequest(first);
    ensure(removed.status === 204);
    ensure((await removed.text()) === "");
    ensure(removed.headers.get("cache-control")?.includes("no-store"));
    ensure((await appRequest("/" + first)).status === 404);
    ensure(!(await dashboardMarkup()).includes(first));

    // Double delete is the same 404 as a foreign, random or malformed id.
    const repeated = await snapshotDelete(first);
    const random = await snapshotDelete(randomUUID());
    const malformed = await snapshotDelete("not-a-uuid");
    ensure(repeated.status === 404 && random.status === 404 && malformed.status === 404);
    ensure(repeated.raw === random.raw && repeated.raw === malformed.raw);
    ensure(JSON.stringify(repeated.headers) === JSON.stringify(random.headers) && JSON.stringify(repeated.headers) === JSON.stringify(malformed.headers));
    ensure(repeated.headers[0]?.includes("no-store") && !repeated.raw.includes(first));

    // A freed slot at the limit takes exactly one save, and the deleted name is reusable.
    const refill = await saveDrill("Smoke filler 3");
    ensure(refill.status === 201);
    const full = await saveDrill("Smoke after refill");
    ensure(full.status === 409 && full.body.code === "limit_reached");

    // Deleting one timer leaves the others alone.
    const gone = await deleteDrillRequest(second);
    ensure(gone.status === 204);
    const markup = await dashboardMarkup();
    ensure(!markup.includes(second) && markup.includes(refill.body.drill.id) && markup.includes(savedDrill.id) && markup.includes(otherDrill.id));
    const after = await saveDrill("Smoke filler 4");
    ensure(after.status === 201);
    const text = visibleText(markup);
    ensure(text.includes(savedDrill.name) && text.includes(otherDrill.name));
}

async function verifyGuestDelete(id) {
    const response = await deleteDrillRequest(id);
    ensure(response.status === 401 && response.headers.get("cache-control")?.includes("no-store"));
    const body = await response.json().catch(() => null);
    ensure(body?.ok === false && body.code === "unauthorized");
}

async function verifyForeignDelete() {
    ensure(savedDrill !== null && otherDrill !== null);
    const foreign = await snapshotDelete(savedDrill.id);
    const random = await snapshotDelete(randomUUID());
    const malformed = await snapshotDelete("not-a-uuid");
    ensure(foreign.status === 404 && random.status === 404 && malformed.status === 404);
    ensure(foreign.raw === random.raw && foreign.raw === malformed.raw);
    ensure(JSON.stringify(foreign.headers) === JSON.stringify(random.headers) && JSON.stringify(foreign.headers) === JSON.stringify(malformed.headers));
    ensure(foreign.headers[0]?.includes("no-store") && !foreign.raw.includes(savedDrill.id));
    // The foreign attempt matches the 404 of PUT byte for byte.
    const put = await snapshotUpdate(savedDrill.id);
    ensure(foreign.raw === put.raw);
}

async function signInNewAccount(email) {
    await requestEmailLink(email, "/dashboard");
    const link = callbackFromMessage(await waitForEmail(email));
    await confirmLink(link);
    return link;
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

    await runStep("anonymous /{uuid} redirects to sign-in and a non-UUID path is a plain 404", async () => {
        const guest = await appRequest("/" + randomUUID());
        const location = responseLocation(guest);
        ensure(guest.status === 302);
        ensure(location?.pathname === "/auth/signin");
        const unknown = await appRequest("/not-a-uuid");
        ensure(unknown.status === 404 && !unknown.headers.get("location"));
    });

    await runStep("anonymous PUT /api/drills/{id} answers 401 and /{uuid}/edit redirects to sign-in", () => verifyGuestEdit(randomUUID()));
    await runStep("anonymous DELETE /api/drills/{id} answers 401", () => verifyGuestDelete(randomUUID()));
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
    await runStep("dashboard lists the saved timer and /{id} shows its details (noindex, no-store, no running view)", verifyOwnSavedDrillPages);
    await runStep("owner edits a timer: PUT 200, dashboard and /{id}/edit show the new values, the other timer is untouched", verifyOwnerEdit);
    await runStep("edit rules: duplicate 409, case-only rename 200, 200/201 characters, invalid 400, wrong type 415", verifyEditRules);
    await runStep("the 50-timer limit refuses the 51st save, also for concurrent requests", verifyDrillLimit);
    await runStep("a timer can still be edited at the 50-timer limit", verifyEditAtLimit);
    await runStep(
        "owner deletes at the limit: 403 without the app Origin, 405 Allow, 204, repeat is the same 404 as a foreign id, a freed slot takes one save, the other timers stay",
        verifyOwnerDelete,
    );
    await runStep("sign-out clears the new-account session", verifyDashboardAndSignOut);
    await runStep("anonymous /{id} redirects to sign-in with next and a non-UUID path is a plain 404", verifyGuestSavedDrillRouting);
    await runStep("anonymous PUT is 401, /{id}/edit redirects with next, /not-a-uuid/edit is the plain 404", () => verifyGuestEdit(savedDrill.id));
    await runStep("anonymous DELETE is 401", () => verifyGuestDelete(savedDrill.id));

    const otherEmail = "smoke-other-" + Date.now() + "-" + randomUUID() + "@example.com";
    await runStep("a second, distinct account signs in", () => signInNewAccount(otherEmail));
    await runStep("second account gets identical 404s for a foreign and a random id and sees none of the first user's timers", verifyForeignSavedDrillPages);
    await runStep("second account's PUT and /edit page give identical 404s for a foreign, a random and a malformed id", verifyForeignEdit);
    await runStep("second account DELETE gives identical 404s for a foreign, a random and a malformed id", verifyForeignDelete);
    await runStep("sign-out clears the second account session", verifyDashboardAndSignOut);

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
    await runStep("the first account's timers are unchanged after the second account's attempts", verifyFirstUserTimersUnchanged);
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
