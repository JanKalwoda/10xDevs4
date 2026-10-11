// Smoke test for a local Supabase/Mailpit stack or credential-free public routes.
// Local mode covers the sign-in flow only; routes, ownership and API validation live in tests/integration/ (npm run test:integration).
// Run with SMOKE_MODE=local|remote and BASE_URL pointing at the app preview.

import { randomUUID } from "node:crypto";
import {
    DRILL_DEFAULTS,
    RETRY_MESSAGE,
    SignInError,
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
} from "./lib/app-client.mjs";

const mode = process.env.SMOKE_MODE ?? "local";
if (!["local", "remote"].includes(mode)) throw new Error("SMOKE_MODE must be local or remote");
if (mode === "remote" && !process.env.BASE_URL) throw new Error("Remote smoke requires BASE_URL");

const { appOrigin, mailpitUrl } = mode === "local" ? resolveLocalTargets(process.env) : { appOrigin: parseAppOrigin(process.env.BASE_URL), mailpitUrl: null };
const client = createAppClient(appOrigin);
const mailpit = mailpitUrl ? createMailpit(mailpitUrl) : null;
const appRequest = client.request;
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

async function deleteDrillRequest(id, options = {}) {
    return appRequest("/api/drills/" + id, { method: "DELETE", ...options });
}

async function verifyGuestDelete(id) {
    const response = await deleteDrillRequest(id);
    ensure(response.status === 401 && response.headers.get("cache-control")?.includes("no-store"));
    const body = await response.json().catch(() => null);
    ensure(body?.ok === false && body.code === "unauthorized");
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
    await runStep("sign-out clears the new-account session", verifyDashboardAndSignOut);
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
