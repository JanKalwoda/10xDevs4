import assert from "node:assert/strict";
import test from "node:test";

import { createDrillRunIdentityState } from "./drill-run-identity.ts";

void test("stale completion and repeated intent cannot retire a newer run", () => {
    const identityState = createDrillRunIdentityState();
    const first = identityState.begin();
    assert.equal(identityState.isCurrent(first), true);
    assert.equal(identityState.retire(first), true);

    const second = identityState.begin();
    assert.ok(second > first);
    let completions = 0;

    assert.equal(identityState.isCurrent(first), false);
    assert.equal(identityState.retire(first), false, "stale Cancel or Restart is rejected");
    assert.equal(
        identityState.complete(first, () => completions++),
        false,
    );
    assert.equal(completions, 0);
    assert.equal(identityState.isCurrent(second), true);
});

void test("completion retires the current run before calling back and only completes once", () => {
    const identityState = createDrillRunIdentityState();
    const identity = identityState.begin();
    let completions = 0;
    let currentInsideCallback = true;

    assert.equal(
        identityState.complete(identity, () => {
            completions++;
            currentInsideCallback = identityState.isCurrent(identity);
        }),
        true,
    );
    assert.equal(currentInsideCallback, false);
    assert.equal(identityState.isCurrent(identity), false);
    assert.equal(
        identityState.complete(identity, () => completions++),
        false,
    );
    assert.equal(completions, 1);
});

void test("Restart followed by Cancel rejects a late completion from the cancelled replacement", () => {
    const identityState = createDrillRunIdentityState();
    const first = identityState.begin();
    assert.equal(identityState.retire(first), true);

    const replacement = identityState.begin();
    assert.equal(identityState.retire(replacement), true);

    let completions = 0;
    assert.equal(
        identityState.complete(replacement, () => completions++),
        false,
    );
    assert.equal(identityState.retire(replacement), false);
    assert.equal(completions, 0);
});
