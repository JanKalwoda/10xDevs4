import assert from "node:assert/strict";
import test from "node:test";

import { browserDrillVisibility } from "./drill-visibility.ts";

void test("the browser visibility port reads document.hidden and removes exactly its listener", () => {
    const listeners = new Set<() => void>();
    const fakeDocument = {
        hidden: false,
        addEventListener: (type: string, listener: () => void) => {
            assert.equal(type, "visibilitychange");
            listeners.add(listener);
        },
        removeEventListener: (type: string, listener: () => void) => {
            assert.equal(type, "visibilitychange");
            listeners.delete(listener);
        },
    };
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { value: fakeDocument, configurable: true });
    try {
        let changes = 0;
        const unsubscribe = browserDrillVisibility.subscribe(() => {
            changes++;
        });
        assert.equal(browserDrillVisibility.isHidden(), false);
        fakeDocument.hidden = true;
        assert.equal(browserDrillVisibility.isHidden(), true);
        for (const listener of listeners) listener();
        assert.equal(changes, 1);

        unsubscribe();
        assert.equal(listeners.size, 0);
    } finally {
        if (original) Object.defineProperty(globalThis, "document", original);
        else Reflect.deleteProperty(globalThis, "document");
    }
});
