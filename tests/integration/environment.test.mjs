// Guards of the integration suite: the target must be a local app and Mailpit, and the app must answer.
// A run against anything else fails loudly instead of skipping tests and leaving CI green.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createAppClient, resolveLocalTargets } from "../../scripts/lib/app-client.mjs";

const { appOrigin } = resolveLocalTargets(process.env);

test("the app under test answers on a local origin", async () => {
    const response = await createAppClient(appOrigin).request("/");
    assert.equal(response.status, 200);
});
