// Smoke test for a local Supabase/Mailpit stack or credential-free public routes.
// Run with SMOKE_MODE=local|remote and BASE_URL pointing at the app preview.

import { randomUUID } from "node:crypto";
import {
    DRILL_DEFAULTS,
    RETRY_MESSAGE,
    SignInError,
    UUID_PATTERN,
    callbackFromMessage,
    confirmLink as confirmLinkWith,
    createAppClient,
    createMailpit,
    decodeHtmlAttribute,
    ensure,
    parseAppOrigin,
    requestEmailLink as requestEmailLinkWith,
    resolveLocalTargets,
    responseLocation as responseLocationOf,
    signIn,
    visibleText,
} from "./lib/app-client.mjs";

const mode = process.env.SMOKE_MODE ?? "local";
if (!["local", "remote"].includes(mode)) throw new Error("SMOKE_MODE must be local or remote");
if (mode === "remote" && !process.env.BASE_URL) throw new Error("Remote smoke requires BASE_URL");

const { appOrigin, mailpitUrl } = mode === "local" ? resolveLocalTargets(process.env) : { appOrigin: parseAppOrigin(process.env.BASE_URL), mailpitUrl: null };
const client = createAppClient(appOrigin);
const mailpit = mailpitUrl ? createMailpit(mailpitUrl) : null;
const appRequest = client.request;
const originRequest = client.originRequest;
const snapshot = client.snapshot;
const responseLocation = (response) => responseLocationOf(response, appOrigin);
const requestEmailLink = (email, next) => requestEmailLinkWith(client, email, next);
const confirmLink = (link) => confirmLinkWith(client, link);
const waitForEmail = (email) => mailpit.waitForEmail(email);
let activeStep = "smoke setup";

function accountNavMarkup(markup) {
    const accountNav = [...markup.matchAll(/<nav\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/nav>/gi)].find(([, attributes]) => {
        const ariaLabel = attributes.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1];
        return ariaLabel === "Account";
    });
    return accountNav?.[2] ?? null;
}

function accountNavLinks(markup) {
    const navMarkup = accountNavMarkup(markup);
    if (navMarkup === null) return [];

    return [...navMarkup.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => {
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

// The top bar: a signed-in session shows the email (link to the /dashboard account page), Timers (TIMERS_HREF = /timers) and a sign-out form.
function hasSignedInTopBar(markup, accountEmail) {
    const links = accountNavLinks(markup);
    return (
        links.some((link) => link.href === "/dashboard" && link.text.toLowerCase() === accountEmail.toLowerCase()) &&
        links.some((link) => link.href === "/timers" && link.text === "Timers") &&
        /<form\b[^>]*action\s*=\s*["']\/api\/auth\/signout["']/i.test(accountNavMarkup(markup) ?? "")
    );
}

// Every HTML page with the bar carries the account email, so none of them may be cacheable.
async function verifyBarredPagesNoStore() {
    for (const path of ["/", "/create", "/dashboard", "/timers", "/abc/def"]) {
        const response = await appRequest(path);
        ensure(response.headers.get("cache-control")?.includes("no-store"));
        await response.arrayBuffer();
    }
}

async function runStep(name, action) {
    activeStep = name;
    const result = await action();
    console.log("PASS  " + name);
    return result;
}

// The h1 of AccountDetails: the top bar has <nav aria-label="Account"> and the <title>, so a bare "Account" proves nothing.
const ACCOUNT_HEADING = /<h1[^>]*>\s*Account\s*<\/h1>/;

async function verifyDashboardAndSignOut() {
    const dashboard = await appRequest("/dashboard");
    ensure(dashboard.status === 200);
    const markup = await dashboard.text();
    ensure(ACCOUNT_HEADING.test(markup));
    ensure(markup.includes("Signed in as"));
    ensure(markup.includes("Sign out"));
    ensure(!markup.includes("Saved timers"));

    const signout = await appRequest("/api/auth/signout", { method: "POST", form: {} });
    ensure(signout.status === 302);
    ensure(responseLocation(signout)?.pathname === "/");

    const protectedAfterSignOut = await appRequest("/dashboard");
    const location = responseLocation(protectedAfterSignOut);
    ensure(protectedAfterSignOut.status === 302);
    ensure(location?.pathname === "/auth/signin");

    const timersAfterSignOut = await appRequest("/timers");
    const timersLocation = responseLocation(timersAfterSignOut);
    ensure(timersAfterSignOut.status === 302);
    ensure(timersLocation?.pathname === "/auth/signin");
    ensure(timersLocation.searchParams.get("next") === "/timers");
}

// The account page reads no timers: with saved timers in the database it shows the account data only.
async function verifyAccountPageHasNoList(accountEmail) {
    ensure(savedDrill !== null);
    const account = await appRequest("/dashboard");
    ensure(account.status === 200);
    ensure(account.headers.get("cache-control")?.includes("no-store"));
    const markup = await account.text();
    const text = visibleText(markup);
    ensure(ACCOUNT_HEADING.test(markup));
    ensure(text.includes("Signed in as"));
    ensure(text.toLowerCase().includes(accountEmail.toLowerCase()));
    ensure(/href="\/timers"/.test(markup));
    ensure(text.includes("Sign out"));
    ensure(!markup.includes(savedDrill.id));
    ensure(!text.includes(savedDrill.name));
    ensure(!text.includes("Saved timers"));
    ensure(!text.includes("You have no saved timers yet."));
}

const PARAMETER_LINE = "Prep 0:05 · Exercise 0:04 · Rest 0:02 · 3 reps";
// Set from the 201 response of POST /api/drills before the first user signs out.
let savedDrill = null;

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
    const timers = await appRequest("/timers");
    ensure(timers.status === 200);
    const timersMarkup = await timers.text();
    // Tailwind classes such as has-[>svg] contain ">", so the link is matched lazily up to its label instead of by attribute.
    ensure(/<a href="\/create"[\s\S]*?>\s*Create a timer\s*<\/a>/.test(timersMarkup));

    const page = await appRequest("/create");
    ensure(page.status === 200);
    const markup = await page.text();
    ensure(markup.includes("Create a timer"));
    ensure(markup.includes("Save timer"));
    // The back link leads to the timers list, not to the default timer.
    ensure(/<a href="\/timers"[\s\S]*?>\s*Back to timers\s*<\/a>/.test(markup));
    ensure(!markup.includes("Back to the timer"));
}

async function verifySavedDrillApi() {
    const first = await saveDrill("Smoke drill");
    ensure(first.status === 201 && first.body.ok === true);
    ensure(first.body.drill.name === "Smoke drill");
    ensure(UUID_PATTERN.test(first.body.drill.id));
    savedDrill = { id: first.body.drill.id, name: first.body.drill.name };
    // Server half of the create redirect: the form sends the browser to /{id} of the id in this reply.
    const created = await appRequest("/" + encodeURIComponent(first.body.drill.id));
    ensure(created.status === 200);
    ensure(created.headers.get("cache-control")?.includes("no-store"));
    ensure(visibleText(await created.text()).includes(first.body.drill.name));
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

async function verifyOwnSavedDrillPages() {
    ensure(savedDrill !== null);
    const timers = await appRequest("/timers");
    ensure(timers.status === 200);
    ensure(timers.headers.get("cache-control")?.includes("no-store"));
    const timersMarkup = await timers.text();
    ensure(timersMarkup.includes('href="/' + savedDrill.id + '"'));
    const timersText = visibleText(timersMarkup);
    ensure(timersText.includes(savedDrill.name));
    ensure(timersText.includes(PARAMETER_LINE));

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

async function timersText() {
    const timers = await appRequest("/timers");
    ensure(timers.status === 200);
    return visibleText(await timers.text());
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

    const text = await timersText();
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
    const text = await timersText();
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

    const timers = await appRequest("/timers");
    ensure(timers.status === 200);
    const timersMarkup = await timers.text();
    ensure(!timersMarkup.includes(savedDrill.id));
    const timersText = visibleText(timersMarkup);
    ensure(!timersText.includes(savedDrill.name));
    ensure(timersText.includes("You have no saved timers yet."));
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
    const text = await timersText();
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

async function timersMarkup() {
    const timers = await appRequest("/timers");
    ensure(timers.status === 200);
    return timers.text();
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
    ensure(!(await timersMarkup()).includes(first));

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
    const markup = await timersMarkup();
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
        ensure(accountNavLinks(await response.text()).length === 0);
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

    await runStep("anonymous timers list redirects to sign-in", async () => {
        const response = await appRequest("/timers");
        const location = responseLocation(response);
        ensure(response.status === 302);
        ensure(location?.pathname === "/auth/signin");
        ensure(location.searchParams.get("next") === "/timers");
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

    await runStep("anonymous timers list redirects to sign-in", async () => {
        const response = await appRequest("/timers");
        const location = responseLocation(response);
        ensure(response.status === 302);
        ensure(location?.pathname === "/auth/signin");
        ensure(location.searchParams.get("next") === "/timers");
    });

    await runStep("anonymous drill API answers 401 and /create redirects to sign-in", verifyAnonymousDrillApi);

    // No `next` on purpose: the default target must be /timers (asserted on the callback below).
    await runStep("new-account email request without next returns a neutral result", () => requestEmailLink(email));

    const newAccountLink = await runStep("Mailpit receives the new-account confirmation email", async () => {
        const message = await waitForEmail(email);
        const link = callbackFromMessage(message, appOrigin);
        ensure(link.next === "/timers");
        return link;
    });

    await runStep("confirmation GET prepares the explicit POST without consuming the link", async () => {
        const page = await appRequest(newAccountLink.path);
        ensure(page.status === 200);
        ensure(page.headers.get("cache-control")?.includes("no-store"));
        ensure(page.headers.get("referrer-policy") === "no-referrer");
        const markup = await page.text();
        ensure(markup.includes('id="email-link-confirmation"'));
        ensure(markup.includes("Continue to your timers"));
    });

    await runStep("explicit POST establishes the SSR session from the new-account link", () => confirmLink(newAccountLink));
    await runStep("authenticated SSR top bar shows the email, Timers and Sign out, and barred pages are no-store", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasSignedInTopBar(markup, email));
        await verifyBarredPagesNoStore();
    });
    await runStep("SSR cookies authorize the dashboard after new-account confirmation", async () => {
        const dashboard = await appRequest("/dashboard");
        ensure(dashboard.status === 200);
        const markup = await dashboard.text();
        ensure(ACCOUNT_HEADING.test(markup));
        ensure(markup.includes("Signed in as"));
        ensure(markup.includes("Sign out"));
    });
    await runStep("signed-in user reaches /create and the timers list links to it", verifyCreatePage);
    await runStep("signed-in user saves, duplicates, invalid and wrong-type requests get stable API answers", verifySavedDrillApi);
    await runStep("timers list shows the saved timer and /{id} shows its details (noindex, no-store, no running view)", verifyOwnSavedDrillPages);
    await runStep("account page shows the account only: no timer ids, names or list text", () => verifyAccountPageHasNoList(email));
    await runStep("owner edits a timer: PUT 200, the timers list and /{id}/edit show the new values, the other timer is untouched", verifyOwnerEdit);
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
    await runStep("a second, distinct account signs in", () => signIn(client, mailpit, otherEmail));
    await runStep("second account gets identical 404s for a foreign and a random id and sees none of the first user's timers", verifyForeignSavedDrillPages);
    await runStep("second account's PUT and /edit page give identical 404s for a foreign, a random and a malformed id", verifyForeignEdit);
    await runStep("second account DELETE gives identical 404s for a foreign, a random and a malformed id", verifyForeignDelete);
    await runStep("sign-out clears the second account session", verifyDashboardAndSignOut);

    await runStep("signed-out SSR home shell links Sign in to the sign-in page", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasHomeAccountLink(markup, "Sign in", "/auth/signin"));
        ensure(!markup.toLowerCase().includes(email.toLowerCase()));
        ensure(home.headers.get("cache-control")?.includes("no-store"));
    });

    await runStep("existing-account email request returns the same neutral result", () => requestEmailLink(email, "/"));
    const existingAccountLink = await runStep("Mailpit receives the existing-account magic-link email", async () => {
        const message = await waitForEmail(email);
        return callbackFromMessage(message, appOrigin);
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
    await runStep("existing-account SSR top bar shows the email, Timers and Sign out, and barred pages are no-store", async () => {
        const home = await appRequest("/");
        const markup = await home.text();
        ensure(home.status === 200);
        ensure(hasSignedInTopBar(markup, email));
        await verifyBarredPagesNoStore();
    });
    await runStep("SSR cookies authorize the dashboard after existing-account sign-in", async () => {
        const dashboard = await appRequest("/dashboard");
        ensure(dashboard.status === 200);
        const markup = await dashboard.text();
        ensure(ACCOUNT_HEADING.test(markup));
        ensure(markup.includes("Signed in as"));
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
} catch (error) {
    // Only a SignInError carries a message that is safe to print; every other detail stays suppressed.
    console.log("FAIL  " + activeStep + (error instanceof SignInError ? ": " + error.message : " (details suppressed to protect email and token data)"));
    process.exitCode = 1;
}
