// Risk #1 (ownership), #2 (forged session, guest on a real id) and #5 (links in the server-rendered pages).
// Oracle: PRD Guardrails and the NFR "available only to the owner": user B cannot tell a timer of user A from a missing one
// on any surface, A's data never changes, and the owner's pages link back to the PRD/roadmap addresses (S-12, S-17).
// Two accounts per run (A and B, shared by the whole file); every test creates its own timers with unique names.

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { DRILL_DEFAULTS, UUID_PATTERN, createAppClient, createMailpit, resolveLocalTargets, signIn, visibleText } from "../../scripts/lib/app-client.mjs";

const { appOrigin, mailpitUrl } = resolveLocalTargets(process.env);
const mailpit = createMailpit(mailpitUrl);
const a = createAppClient(appOrigin);
const b = createAppClient(appOrigin);
const emailA = "ownership-a-" + randomUUID() + "@example.com";
const emailB = "ownership-b-" + randomUUID() + "@example.com";

const PARAMETER_LINE = "Prep 0:05 · Exercise 0:04 · Rest 0:02 · 3 reps";
const EDITED = { rest: "0:03", repetitions: "4", randomStartEnabled: true };
const EDITED_LINE = "Prep 0:05 · Exercise 0:04 · Rest 0:03 · 4 reps · Random start";
const OTHER = { exercise: "0:06" };
const OTHER_LINE = "Prep 0:05 · Exercise 0:06 · Rest 0:02 · 3 reps";
const ACCOUNT_HEADING = /<h1[^>]*>\s*Account\s*<\/h1>/;
const HEADER_NAMES = ["cache-control", "content-type", "referrer-policy"];

before(async () => {
    await signIn(a, mailpit, emailA);
    await signIn(b, mailpit, emailB);
});

function uniqueName(label) {
    return label + "-" + randomUUID();
}

async function createTimer(client, label, overrides = {}) {
    const name = uniqueName(label);
    const response = await client.request("/api/drills", { method: "POST", json: { name, ...DRILL_DEFAULTS, ...overrides } });
    assert.equal(response.status, 201, "create timer " + label);
    const body = await response.json();
    assert.ok(body.ok === true && UUID_PATTERN.test(body.drill.id), "create timer " + label + " returns an id");
    return { id: body.drill.id, name };
}

async function updateTimer(client, id, name, overrides = {}) {
    const response = await client.request("/api/drills/" + id, { method: "PUT", json: { name, ...DRILL_DEFAULTS, ...overrides } });
    return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
}

// The whole response, so two answers can be compared byte for byte (bodies are compared, never printed).
async function capture(response) {
    return { status: response.status, raw: await response.text(), headers: HEADER_NAMES.map((name) => response.headers.get(name)), location: response.headers.get("location") };
}

function assertSameAnswer(actual, expected, label) {
    assert.equal(actual.status, expected.status, label + ": status");
    assert.ok(actual.raw === expected.raw, label + ": body differs");
    assert.deepEqual(actual.headers, expected.headers, label + ": headers");
    assert.equal(actual.location, expected.location, label + ": location");
}

function anchors(markup) {
    return [...markup.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => ({
        href: attributes.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1] ?? null,
        text: visibleText(content).trim(),
    }));
}

function assertLink(markup, href, text, label) {
    assert.ok(
        anchors(markup).some((link) => link.href === href && link.text === text),
        label + ": link '" + text + "' to " + href,
    );
}

async function page(client, path) {
    const response = await client.request(path);
    return { response, markup: await response.text() };
}

// The text of one card in the timers list (name and parameter line), or null when the timer is not listed.
async function listEntry(client, id) {
    const { response, markup } = await page(client, "/timers");
    assert.equal(response.status, 200, "timers list");
    return anchors(markup).find((link) => link.href === "/" + id)?.text ?? null;
}

async function assertGuestRedirect(client, path) {
    const response = await client.request(path);
    assert.equal(response.status, 302, "guest " + path.replace(/[0-9a-f-]{36}/, "<uuid>"));
    assert.equal(response.headers.get("location"), "/auth/signin?next=" + encodeURIComponent(path), "guest next for " + path.replace(/[0-9a-f-]{36}/, "<uuid>"));
}

test("owner save: 201 with the stored configuration, then /{id} shows the timer", async () => {
    const name = uniqueName("save");
    const response = await a.request("/api/drills", { method: "POST", json: { name, ...DRILL_DEFAULTS, preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3" } });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.drill.name, name);
    assert.match(body.drill.id, UUID_PATTERN);
    const { configuration } = body.drill;
    assert.deepEqual(
        [configuration.preparationSeconds, configuration.exerciseSeconds, configuration.restSeconds, configuration.repetitions, configuration.randomStartEnabled],
        [5, 4, 2, 3, false],
    );

    // Server half of the redirect after saving (FR-017): the form sends the browser to /{id} of the id in this reply.
    const { response: created, markup } = await page(a, "/" + body.drill.id);
    assert.equal(created.status, 200);
    assert.ok(created.headers.get("cache-control")?.includes("no-store"), "/{id} is no-store");
    assert.ok(visibleText(markup).includes(name), "/{id} shows the saved name");
});

test("owner details: the list card and /{id} show the timer, with Start and no running view", async () => {
    const { id, name } = await createTimer(a, "details");

    const entry = await listEntry(a, id);
    assert.ok(entry?.includes(name) && entry.includes(PARAMETER_LINE), "list card shows name and parameter line");

    const { response, markup } = await page(a, "/" + id);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control")?.includes("no-store"), "/{id} is no-store");
    assert.ok(/<meta name="robots" content="noindex"/.test(markup), "/{id} is noindex");
    const text = visibleText(markup);
    assert.ok(text.includes(name), "/{id} shows the name");
    for (const part of PARAMETER_LINE.split(" · ")) assert.ok(text.includes(part), "/{id} shows " + part);
    assert.ok(/>\s*Start\s*</.test(markup), "/{id} has Start");
    // Server-rendered details, never a running timer view.
    assert.ok(!markup.includes("Cancel drill") && !markup.includes("Pause"), "/{id} renders no running view");
});

test("owner navigation links: the lists, /create, /{id} and /{id}/edit link where the roadmap and S-12 say", async () => {
    const { id } = await createTimer(a, "links");

    const timers = await page(a, "/timers");
    assertLink(timers.markup, "/create", "Create a timer", "/timers");

    const create = await page(a, "/create");
    assert.equal(create.response.status, 200);
    assertLink(create.markup, "/timers", "Back to timers", "/create");
    assert.ok(!visibleText(create.markup).includes("Back to the timer"), "/create has no link to the default timer");

    const details = await page(a, "/" + id);
    assertLink(details.markup, "/" + id + "/edit", "Edit timer", "/{id}");
    assertLink(details.markup, "/timers", "Back to timers", "/{id}");

    const edit = await page(a, "/" + id + "/edit");
    assert.equal(edit.response.status, 200);
    assertLink(edit.markup, "/" + id, "Back to timer", "/{id}/edit");
    assertLink(edit.markup, "/timers", "Back to timers", "/{id}/edit");
});

test("account page lists no timers: no ids, names or list text", async () => {
    const { id, name } = await createTimer(a, "account");

    const { response, markup } = await page(a, "/dashboard");
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control")?.includes("no-store"), "/dashboard is no-store");
    const text = visibleText(markup);
    assert.ok(ACCOUNT_HEADING.test(markup), "account heading");
    assert.ok(text.includes("Signed in as") && text.toLowerCase().includes(emailA.toLowerCase()), "shows the signed-in account");
    assert.ok(/href="\/timers"/.test(markup), "links to /timers");
    assert.ok(text.includes("Sign out"), "has Sign out");
    assert.ok(!markup.includes(id), "no timer id");
    assert.ok(!text.includes(name), "no timer name");
    assert.ok(!text.includes("Saved timers") && !text.includes("You have no saved timers yet."), "no list text");
});

test("owner edit: PUT 200, the list, /{id} and /{id}/edit show the new values, the other timer is untouched", async () => {
    const first = await createTimer(a, "edit");
    const other = await createTimer(a, "edit-other", OTHER);
    const newName = uniqueName("edited");

    const edited = await updateTimer(a, first.id, newName, EDITED);
    assert.equal(edited.status, 200);
    assert.ok(edited.headers.get("cache-control")?.includes("no-store"), "PUT is no-store");
    assert.equal(edited.body.ok, true);
    assert.equal(edited.body.drill.id, first.id);
    assert.equal(edited.body.drill.name, newName);
    const { configuration } = edited.body.drill;
    assert.deepEqual(
        [configuration.preparationSeconds, configuration.exerciseSeconds, configuration.restSeconds, configuration.repetitions, configuration.randomStartEnabled],
        [5, 4, 3, 4, true],
    );

    const entry = await listEntry(a, first.id);
    assert.ok(entry?.includes(newName) && entry.includes(EDITED_LINE), "list card shows the new values");
    const otherEntry = await listEntry(a, other.id);
    assert.ok(otherEntry?.includes(other.name) && otherEntry.includes(OTHER_LINE), "the other timer is untouched");

    // The edit stays true whether the form stays on the page or navigates to /{id} afterwards.
    const details = await page(a, "/" + first.id);
    assert.equal(details.response.status, 200);
    const detailsText = visibleText(details.markup);
    assert.ok(detailsText.includes(newName), "/{id} shows the new name");
    for (const part of EDITED_LINE.split(" · ")) assert.ok(detailsText.includes(part), "/{id} shows " + part);

    const edit = await page(a, "/" + first.id + "/edit");
    assert.equal(edit.response.status, 200);
    assert.ok(edit.response.headers.get("cache-control")?.includes("no-store"), "/{id}/edit is no-store");
    assert.ok(/<meta name="robots" content="noindex"/.test(edit.markup), "/{id}/edit is noindex");
    assert.ok(
        edit.markup.includes('value="' + newName + '"') && edit.markup.includes('value="0:03"') && edit.markup.includes('value="4"'),
        "edit form is prefilled with the new values",
    );
    const editText = visibleText(edit.markup);
    assert.ok(editText.includes("Edit timer") && editText.includes("Save changes"), "edit form heading and submit");
});

test("owner delete: Origin guard, method list, 204, then the same 404 as a missing id; other timers stay", async () => {
    const target = await createTimer(a, "delete");
    const sibling = await createTimer(a, "delete-sibling");

    // Cross-origin protection: a foreign or missing Origin never reaches the handler and the timer survives.
    const foreignOrigin = await a.originRequest("/api/drills/" + target.id, { method: "DELETE", origin: "https://evil.example" });
    assert.equal(foreignOrigin.status, 403, "DELETE with a foreign Origin");
    const noOrigin = await a.originRequest("/api/drills/" + target.id, { method: "DELETE" });
    assert.equal(noOrigin.status, 403, "DELETE without Origin");
    assert.equal((await a.request("/" + target.id)).status, 200, "the timer survives refused deletes");

    // The method list advertises PUT and DELETE; the other methods stay refused.
    for (const method of ["GET", "POST", "PATCH"]) {
        const refused = await a.request("/api/drills/" + target.id, { method });
        assert.equal(refused.status, 405, method + " is refused");
        assert.equal(refused.headers.get("allow"), "PUT, DELETE", method + " lists the allowed methods");
    }

    const removed = await a.request("/api/drills/" + target.id, { method: "DELETE" });
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), "");
    assert.ok(removed.headers.get("cache-control")?.includes("no-store"), "204 is no-store");
    assert.equal((await a.request("/" + target.id)).status, 404, "/{id} is gone");
    assert.equal(await listEntry(a, target.id), null, "the timer left the list");

    // A repeated delete is the same 404 as a random or malformed id.
    const repeated = await capture(await a.request("/api/drills/" + target.id, { method: "DELETE" }));
    const random = await capture(await a.request("/api/drills/" + randomUUID(), { method: "DELETE" }));
    const malformed = await capture(await a.request("/api/drills/not-a-uuid", { method: "DELETE" }));
    assert.equal(repeated.status, 404);
    assertSameAnswer(repeated, random, "repeated vs random");
    assertSameAnswer(repeated, malformed, "repeated vs malformed");
    assert.ok(repeated.headers[0]?.includes("no-store") && !repeated.raw.includes(target.id), "404 is no-store and does not echo the id");

    // Deleting one timer leaves the others alone.
    const siblingEntry = await listEntry(a, sibling.id);
    assert.ok(siblingEntry?.includes(sibling.name), "the sibling timer stays");
});

test("foreign details page: B gets the same 404 for A's timer as for a random, malformed or nested path", async () => {
    const mine = await createTimer(a, "foreign-page");

    const foreign = await capture(await b.request("/" + mine.id));
    const random = await capture(await b.request("/" + randomUUID()));
    assert.equal(foreign.status, 404);
    assertSameAnswer(foreign, random, "foreign vs random");
    assert.ok(foreign.headers[0]?.includes("no-store"), "404 is no-store");
    assert.ok(!foreign.raw.includes(mine.id), "404 does not echo the id");
    for (const path of ["/not-a-uuid", "/abc/def"]) {
        const other = await capture(await b.request(path));
        assert.equal(other.status, 404, path);
        assertSameAnswer(other, foreign, "foreign vs " + path);
    }

    const { response, markup } = await page(b, "/timers");
    assert.equal(response.status, 200);
    assert.ok(!markup.includes(mine.id), "B's list has no id of A");
    const text = visibleText(markup);
    assert.ok(!text.includes(mine.name), "B's list has no name of A");
    assert.ok(text.includes("You have no saved timers yet."), "B's list is empty");
});

test("foreign edit: B's PUT and edit page for A's timer equal the answers for a random and a malformed id", async () => {
    const mine = await createTimer(a, "foreign-edit");
    const attempt = async (id) => capture(await b.request("/api/drills/" + id, { method: "PUT", json: { name: "Foreign edit", ...DRILL_DEFAULTS } }));

    const foreign = await attempt(mine.id);
    const random = await attempt(randomUUID());
    const malformed = await attempt("not-a-uuid");
    assert.equal(foreign.status, 404);
    assertSameAnswer(foreign, random, "PUT foreign vs random");
    assertSameAnswer(foreign, malformed, "PUT foreign vs malformed");
    assert.ok(foreign.headers[0]?.includes("no-store"), "PUT 404 is no-store");
    assert.ok(!foreign.raw.includes(mine.id), "PUT 404 does not echo the id");

    const foreignPage = await capture(await b.request("/" + mine.id + "/edit"));
    const randomPage = await capture(await b.request("/" + randomUUID() + "/edit"));
    const malformedPage = await capture(await b.request("/not-a-uuid/edit"));
    assert.equal(foreignPage.status, 404);
    assertSameAnswer(foreignPage, randomPage, "edit page foreign vs random");
    assertSameAnswer(foreignPage, malformedPage, "edit page foreign vs malformed");
    assert.ok(!foreignPage.raw.includes(mine.id) && !foreignPage.raw.includes(mine.name), "edit page 404 reveals nothing of the timer");

    assert.ok((await listEntry(a, mine.id))?.includes(mine.name), "A's timer is unchanged");
});

test("foreign delete: B's DELETE of A's timer equals the answers for a random and a malformed id and the 404 of PUT", async () => {
    const mine = await createTimer(a, "foreign-delete");
    const attempt = async (id) => capture(await b.request("/api/drills/" + id, { method: "DELETE" }));

    const foreign = await attempt(mine.id);
    const random = await attempt(randomUUID());
    const malformed = await attempt("not-a-uuid");
    assert.equal(foreign.status, 404);
    assertSameAnswer(foreign, random, "DELETE foreign vs random");
    assertSameAnswer(foreign, malformed, "DELETE foreign vs malformed");
    assert.ok(foreign.headers[0]?.includes("no-store") && !foreign.raw.includes(mine.id), "404 is no-store and does not echo the id");

    // The answer matches the 404 of PUT byte for byte.
    const put = await capture(await b.request("/api/drills/" + mine.id, { method: "PUT", json: { name: "Foreign edit", ...DRILL_DEFAULTS } }));
    assert.ok(foreign.raw === put.raw, "DELETE 404 body equals PUT 404 body");

    assert.equal((await a.request("/" + mine.id)).status, 200, "A's timer survives");
});

test("owner data unchanged: after B's attempts on every surface A's timers show the same name and parameters", async () => {
    const first = await createTimer(a, "unchanged");
    const second = await createTimer(a, "unchanged-other", OTHER);
    const before = [await listEntry(a, first.id), await listEntry(a, second.id)];
    assert.ok(before[0]?.includes(first.name) && before[0].includes(PARAMETER_LINE), "first timer is listed");
    assert.ok(before[1]?.includes(second.name) && before[1].includes(OTHER_LINE), "second timer is listed");

    for (const timer of [first, second]) {
        await b.request("/" + timer.id);
        await b.request("/" + timer.id + "/edit");
        await b.request("/api/drills/" + timer.id, { method: "PUT", json: { name: "Foreign edit", ...DRILL_DEFAULTS, ...EDITED } });
        await b.request("/api/drills/" + timer.id, { method: "DELETE" });
    }

    assert.deepEqual([await listEntry(a, first.id), await listEntry(a, second.id)], before);
});

test("guest on a real id: sign-in redirects and 401 from a client without a session, and A's timer is unchanged", async () => {
    const mine = await createTimer(a, "guest-real");
    const guest = createAppClient(appOrigin);
    const before = await listEntry(a, mine.id);

    for (const path of ["/" + mine.id, "/" + mine.id + "/edit"]) await assertGuestRedirect(guest, path);

    const put = await guest.request("/api/drills/" + mine.id, { method: "PUT", json: { name: "Guest edit", ...DRILL_DEFAULTS } });
    assert.equal(put.status, 401);
    assert.ok(put.headers.get("cache-control")?.includes("no-store"), "PUT 401 is no-store");
    assert.deepEqual({ ok: (await put.json()).ok }, { ok: false });

    const del = await guest.request("/api/drills/" + mine.id, { method: "DELETE" });
    assert.equal(del.status, 401);
    assert.ok(del.headers.get("cache-control")?.includes("no-store"), "DELETE 401 is no-store");
    assert.equal((await del.json()).code, "unauthorized");

    assert.equal(await listEntry(a, mine.id), before, "A's timer is unchanged");
    assert.equal((await a.request("/" + mine.id)).status, 200);
});

// A copy of A's session with one character of the access token's signature changed.
// The session cookie is one cookie or numbered chunks (".0", ".1"); the copy carries it as one cookie.
function tamperedSession(cookies) {
    const base = Object.keys(cookies)
        .map((cookie) => cookie.match(/^(.*-auth-token)(\.\d+)?$/)?.[1])
        .find(Boolean);
    assert.ok(base, "A has a session cookie");
    const chunks = Object.keys(cookies)
        .filter((cookie) => cookie === base || cookie.startsWith(base + "."))
        .sort((left, right) => Number(left.slice(base.length + 1) || 0) - Number(right.slice(base.length + 1) || 0));
    const value = chunks.map((cookie) => cookies[cookie]).join("");
    assert.ok(value.startsWith("base64-"), "A's session cookie has the expected shape");

    const session = JSON.parse(Buffer.from(value.slice("base64-".length), "base64url").toString("utf8"));
    const token = session.access_token;
    const position = token.length - 10;
    session.access_token = token.slice(0, position) + (token[position] === "A" ? "B" : "A") + token.slice(position + 1);

    const rest = Object.fromEntries(Object.entries(cookies).filter(([cookie]) => !chunks.includes(cookie)));
    return { ...rest, [base]: "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url") };
}

test("forged session is a guest: garbage and tampered tokens get the sign-in redirect and 401, and A's timer is unchanged", async (t) => {
    const mine = await createTimer(a, "forged");
    const before = await listEntry(a, mine.id);
    const real = a.cookies();
    const garbage = Object.fromEntries(Object.keys(real).map((name) => [name, "garbage"]));

    // Positive control: an intact copy of A's cookies is signed in, so the guest answers below come from the forgery.
    await t.test("control: an intact copy of A's session is signed in", async () => {
        const copy = a.withCookies(real);
        assert.equal((await copy.request("/timers")).status, 200);
        assert.equal((await copy.request("/" + mine.id)).status, 200);
    });

    for (const [label, cookies] of [
        ["garbage token", garbage],
        ["token changed by one character", tamperedSession(real)],
    ]) {
        await t.test(label, async () => {
            const forged = a.withCookies(cookies);
            await assertGuestRedirect(forged, "/timers");
            await assertGuestRedirect(forged, "/" + mine.id);

            const put = await forged.request("/api/drills/" + mine.id, { method: "PUT", json: { name: "Forged edit", ...DRILL_DEFAULTS } });
            assert.equal(put.status, 401);
            assert.equal((await put.json()).code, "unauthorized");
        });
    }

    assert.equal(await listEntry(a, mine.id), before, "A's timer is unchanged");
});
