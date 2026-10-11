// Risk #5: the return parameter never leads outside the app.
// Oracle: PRD FR-017 (the default landing page is the timers list) and research risk #5.
// Every consumer also gets a positive control, so a consumer that ignores `next` altogether would fail.

import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { URL } from "node:url";
import { createAppClient, resolveLocalTargets } from "../../scripts/lib/app-client.mjs";

const { appOrigin, mailpitUrl } = resolveLocalTargets(process.env);
const client = createAppClient(appOrigin);

const FOREIGN_NEXT = ["https://evil.example/x", "//evil.example", "/\\evil.example", "/%2F%2Fevil.example", "javascript:alert(1)"];
const CALLBACK_QUERY = "token_hash=x&type=email";

function hiddenNext(markup) {
    const input = markup.match(/<input[^>]*name="next"[^>]*>/)?.[0];
    return input?.match(/value="([^"]*)"/)?.[1] ?? null;
}

async function mailTo(address) {
    const response = await fetch(new URL("/api/v1/search?query=" + encodeURIComponent("to:" + address), mailpitUrl));
    assert.equal(response.status, 200);
    return (await response.json()).messages_count ?? 0;
}

test("POST /api/auth/signin rejects a foreign next and sends no mail", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const email = "redirects-" + randomUUID() + "@example.com";
            const response = await client.request("/api/auth/signin", { method: "POST", form: { email, next } });

            assert.equal(response.status, 400);
            assert.equal((await response.json()).ok, false);
            await setTimeout(2000);
            assert.equal(await mailTo(email), 0);
        });
    }
});

test("POST /api/auth/callback with a foreign next goes to the neutral retry page", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const response = await client.request("/api/auth/callback", { method: "POST", form: { token_hash: "x", type: "email", next } });

            assert.equal(response.status, 303);
            assert.equal(response.headers.get("location"), "/auth/callback?error=invalid&next=%2Ftimers");
        });
    }

    await t.test("positive control: a safe next is kept on the retry page", async () => {
        const response = await client.request("/api/auth/callback", { method: "POST", form: { token_hash: "x", type: "email", next: "/create" } });

        assert.equal(response.status, 303);
        assert.equal(response.headers.get("location"), "/auth/callback?error=invalid&next=%2Fcreate");
    });
});

test("GET /auth/callback with a foreign next shows the retry state, not the confirmation form", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const response = await client.request("/auth/callback?" + CALLBACK_QUERY + "&next=" + encodeURIComponent(next));
            const markup = await response.text();

            assert.equal(response.status, 200);
            assert.ok(markup.includes("Sign-in link unavailable"));
            assert.ok(!markup.includes('<form id="email-link-confirmation"'));
        });
    }

    await t.test("positive control: a safe next keeps the confirmation form and carries next", async () => {
        const response = await client.request("/auth/callback?" + CALLBACK_QUERY + "&next=%2Fcreate");
        const markup = await response.text();

        assert.equal(response.status, 200);
        assert.ok(markup.includes('<form id="email-link-confirmation"'));
        assert.equal(hiddenNext(markup), "/create");
    });
});

test("GET /auth/signin pins the hidden next field to a local path", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const response = await client.request("/auth/signin?next=" + encodeURIComponent(next));
            const markup = await response.text();

            assert.equal(response.status, 200);
            assert.equal(hiddenNext(markup), "/timers");
        });
    }

    await t.test("positive control: /create is carried through", async () => {
        const markup = await (await client.request("/auth/signin?next=%2Fcreate")).text();
        assert.equal(hiddenNext(markup), "/create");
    });
});

test("GET /auth/signup (legacy) redirects to sign-in without a foreign next", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const response = await client.request("/auth/signup?next=" + encodeURIComponent(next));

            assert.equal(response.status, 302);
            assert.equal(response.headers.get("location"), "/auth/signin");
        });
    }

    await t.test("positive control: /create is carried through", async () => {
        const response = await client.request("/auth/signup?next=%2Fcreate");

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "/auth/signin?next=%2Fcreate");
    });
});

test("GET /auth/confirm-email links back to a plain sign-in for a foreign next", async (t) => {
    for (const next of FOREIGN_NEXT) {
        await t.test(next, async () => {
            const response = await client.request("/auth/confirm-email?next=" + encodeURIComponent(next));
            const markup = await response.text();

            assert.equal(response.status, 200);
            assert.match(markup, /<a href="\/auth\/signin"[^<]*>\s*Use a different email address/);
        });
    }

    await t.test("positive control: /create is carried through", async () => {
        const markup = await (await client.request("/auth/confirm-email?next=%2Fcreate")).text();
        assert.match(markup, /<a href="\/auth\/signin\?next=%2Fcreate"[^<]*>\s*Use a different email address/);
    });
});

test("POST /api/auth/signin positive control: a safe next is accepted", async () => {
    const email = "redirects-" + randomUUID() + "@example.com";
    const response = await client.request("/api/auth/signin", { method: "POST", form: { email, next: "/create" } });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
});
