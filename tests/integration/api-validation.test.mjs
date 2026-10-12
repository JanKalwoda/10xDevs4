// Risk #6: the save and edit API accepts only a valid configuration, whatever client sends it.
// Oracle: PRD FR-001 and roadmap S-10 (name 1-200 characters, exercise at least 0:01, repetitions 1-100, rest 0-600 s (at most 10:00),
// unique name per user, at most 50 timers per user). The boundary matrix stays in the unit tests (drill-configurations.test.ts,
// drill-update.test.ts); here one HTTP case per error class proves the route really calls the validator and that a refusal leaves no trace.
// Two accounts per run (V for validation, L for the limit); every test creates its own timers with unique names.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { DRILL_DEFAULTS, UUID_PATTERN, createAppClient, createMailpit, resolveLocalTargets, signIn, visibleText } from "../../scripts/lib/app-client.mjs";

const { appOrigin, mailpitUrl } = resolveLocalTargets(process.env);
const mailpit = createMailpit(mailpitUrl);
const v = createAppClient(appOrigin);
const l = createAppClient(appOrigin);
const emailV = "validation-v-" + randomUUID() + "@example.com";
const emailL = "validation-l-" + randomUUID() + "@example.com";

const PARAMETER_PARTS = ["Prep 0:05", "Exercise 0:04", "Rest 0:02", "3 reps"];
const LIMIT = 50;

// One entry per error class: the fields it overrides and the field the answer must name (null: no field, an unknown key).
const INVALID_CLASSES = [
    { label: "empty name", fields: { name: "" }, field: "name" },
    { label: "201-character name", fields: { name: "x".repeat(201) }, field: "name" },
    { label: "exercise 0:00", fields: { exercise: "0:00" }, field: "exercise" },
    { label: "repetitions 0", fields: { repetitions: "0" }, field: "repetitions" },
    { label: "repetitions 101", fields: { repetitions: "101" }, field: "repetitions" },
    { label: "rest 99:99", fields: { rest: "99:99" }, field: "rest" },
    { label: "unknown field user_id", fields: { user_id: randomUUID() }, field: null },
];

before(async () => {
    await signIn(v, mailpit, emailV);
    await signIn(l, mailpit, emailL);
});

function uniqueName(label) {
    return label + "-" + randomUUID();
}

// Every answer of the save and edit API carries user data or a refusal about it, so none may be cached (smoke checked it on each one).
async function send(client, path, { method, body, contentType }) {
    const response = await client.request(path, { method, json: body, contentType });
    assert.ok(
        response.headers.get("cache-control")?.includes("no-store"),
        method + " " + path.replace(/[0-9a-f-]{36}/, "<uuid>") + " -> " + String(response.status) + " must be no-store",
    );
    return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
}

function save(client, name, overrides = {}, options = {}) {
    return send(client, "/api/drills", { method: "POST", body: { name, ...DRILL_DEFAULTS, ...overrides }, ...options });
}

function update(client, id, name, overrides = {}, options = {}) {
    return send(client, "/api/drills/" + id, { method: "PUT", body: { name, ...DRILL_DEFAULTS, ...overrides }, ...options });
}

async function createTimer(client, label, overrides = {}) {
    const name = uniqueName(label);
    const result = await save(client, name, overrides);
    assert.equal(result.status, 201, "create timer " + label);
    assert.ok(result.body.ok === true && UUID_PATTERN.test(result.body.drill.id), "create timer " + label + " returns an id");
    return { id: result.body.drill.id, name };
}

// The ids linked from the timers list: a refused request must not change this set.
async function listedIds(client) {
    const response = await client.request("/timers");
    assert.equal(response.status, 200, "timers list");
    const markup = await response.text();
    return [...markup.matchAll(/href="\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g)].map((match) => match[1]).sort();
}

function assertRefusal(result, field, label) {
    assert.equal(result.status, 400, label + ": status");
    assert.equal(result.body?.ok, false, label + ": ok");
    assert.equal(result.body?.code, "validation", label + ": code");
    assert.ok(result.headers.get("cache-control")?.includes("no-store"), label + ": no-store");
    if (field !== null) assert.equal(typeof result.body.fieldErrors?.[field], "string", label + ": fieldErrors." + field);
}

async function assertUnchanged(client, timer, label) {
    const response = await client.request("/" + timer.id);
    assert.equal(response.status, 200, label + ": /{id}");
    const text = visibleText(await response.text());
    assert.ok(text.includes(timer.name), label + ": name unchanged");
    for (const part of PARAMETER_PARTS) assert.ok(text.includes(part), label + ": " + part + " unchanged");
}

test("POST classes: every invalid class is refused with 400 and nothing is saved", async (t) => {
    for (const { label, fields, field } of INVALID_CLASSES) {
        await t.test(label, async () => {
            const before = await listedIds(v);
            const result = await save(v, "post-" + randomUUID(), fields);
            assertRefusal(result, field, "POST " + label);
            assert.deepEqual(await listedIds(v), before, "POST " + label + ": the timers list is unchanged");
        });
    }
});

test("PUT classes: every invalid class is refused with 400 and the timer is unchanged", async (t) => {
    const timer = await createTimer(v, "put-classes");

    for (const { label, fields, field } of INVALID_CLASSES) {
        await t.test(label, async () => {
            const before = await listedIds(v);
            const result = await update(v, timer.id, timer.name, fields);
            assertRefusal(result, field, "PUT " + label);
            await assertUnchanged(v, timer, "PUT " + label);
            assert.deepEqual(await listedIds(v), before, "PUT " + label + ": the timers list is unchanged");
        });
    }
});

test("POST rules: a name differing only in case is a duplicate, a wrong content type is 415", async () => {
    const timer = await createTimer(v, "post-rules");

    const duplicate = await save(v, timer.name.toUpperCase());
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "duplicate_name");
    assert.equal(typeof duplicate.body.fieldErrors?.name, "string");

    const before = await listedIds(v);
    const wrongType = await save(v, uniqueName("post-text"), {}, { contentType: "text/plain" });
    assert.equal(wrongType.status, 415);
    assert.equal(wrongType.body.code, "unsupported_media_type");
    assert.deepEqual(await listedIds(v), before, "a refused content type saves nothing");
});

test("PUT rules: duplicate 409, case-only rename 200, 200 and 201 characters, wrong content type 415", async () => {
    const timer = await createTimer(v, "put-rules");
    const other = await createTimer(v, "put-rules-other");

    const duplicate = await update(v, timer.id, other.name.toUpperCase());
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "duplicate_name");
    assert.equal(typeof duplicate.body.fieldErrors?.name, "string");

    // A timer may be renamed to the same name in another case: its own old name is not a conflict.
    const caseOnly = await update(v, timer.id, timer.name.toUpperCase());
    assert.equal(caseOnly.status, 200);
    assert.equal(caseOnly.body.drill.name, timer.name.toUpperCase());

    const longest = (randomUUID() + "-").padEnd(200, "x");
    const accepted = await update(v, timer.id, longest);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.drill.name.length, 200);

    const tooLong = await update(v, timer.id, longest + "x");
    assertRefusal(tooLong, "name", "PUT 201 characters");

    const wrongType = await update(v, timer.id, uniqueName("put-text"), {}, { contentType: "text/plain" });
    assert.equal(wrongType.status, 415);
    assert.equal(wrongType.body.code, "unsupported_media_type");

    await assertUnchanged(v, { id: timer.id, name: longest }, "after refused edits");
    await assertUnchanged(v, other, "the other timer");
});

// The advisory lock behind the limit is proven by the pgTAP boundary tests; the concurrent outcome here is a regression signal
// only (it also holds if the requests happen to serialise). Sequential steps in one test: each depends on the previous state.
test("limit 50: concurrent saves, the 51st, edit at the limit, freed slot", async (t) => {
    const saved = [];
    for (let index = 1; index <= 48; index += 1) {
        const name = uniqueName("filler-" + index);
        const result = await save(l, name);
        assert.equal(result.status, 201, "filler " + index);
        saved.push({ id: result.body.drill.id, name });
    }

    await t.test("two of five concurrent distinct names fit under the limit", async () => {
        const results = await Promise.all(["A", "B", "C", "D", "E"].map((suffix) => save(l, uniqueName("concurrent-" + suffix))));
        const created = results.filter((result) => result.status === 201);
        const refused = results.filter((result) => result.status === 409);
        assert.equal(created.length, 2, "exactly two saves fit");
        assert.equal(refused.length, 3, "the other three are refused");
        assert.ok(
            refused.every((result) => result.body.code === "limit_reached"),
            "refusals are limit_reached",
        );
        for (const result of created) saved.push({ id: result.body.drill.id, name: result.body.drill.name });
        assert.equal((await listedIds(l)).length, LIMIT, "the list holds exactly the limit");
    });

    await t.test("the 51st timer is refused", async () => {
        const result = await save(l, uniqueName("over-the-limit"));
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "limit_reached");
        assert.equal((await listedIds(l)).length, LIMIT, "nothing was saved");
    });

    await t.test("editing a timer at the limit still works", async () => {
        const target = saved[0];
        const renamed = uniqueName("edited-at-limit");
        const result = await update(l, target.id, renamed, { rest: "0:03" });
        assert.equal(result.status, 200);
        assert.equal(result.body.drill.name, renamed);
        target.name = renamed;
    });

    await t.test("deleting one timer frees exactly one slot and its name", async () => {
        const removed = saved.pop();
        const deleted = await l.request("/api/drills/" + removed.id, { method: "DELETE" });
        assert.equal(deleted.status, 204);

        const refill = await save(l, removed.name);
        assert.equal(refill.status, 201, "the deleted name is free again");
        const full = await save(l, uniqueName("after-refill"));
        assert.equal(full.status, 409);
        assert.equal(full.body.code, "limit_reached");
        assert.equal((await listedIds(l)).length, LIMIT, "the list is back at the limit");
    });
});
