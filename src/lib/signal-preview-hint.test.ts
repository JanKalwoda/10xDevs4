import assert from "node:assert/strict";
import test from "node:test";
import { ANNOUNCE_DELAY_MS, createSignalAnnouncer, createSignalHint, decidePress, HINT_DURATION_MS } from "./signal-preview-hint.ts";

function harness() {
    let now = 0;
    let nextHandle = 1;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const hint = createSignalHint({
        setTimer: (callback, milliseconds) => {
            const handle = nextHandle++;
            timers.set(handle, { at: now + milliseconds, callback });
            return handle;
        },
        clearTimer: (handle) => {
            timers.delete(handle as number);
        },
    });
    function advance(milliseconds: number) {
        now += milliseconds;
        for (const [handle, timer] of [...timers]) {
            if (timer.at <= now) {
                timers.delete(handle);
                timer.callback();
            }
        }
    }
    return { hint, advance, pending: () => timers.size };
}

void test("opens on showFor and closes after 8 s", () => {
    const { hint, advance } = harness();
    assert.equal(HINT_DURATION_MS, 8000);
    assert.equal(hint.getSnapshot().open, false);
    hint.showFor();
    assert.equal(hint.getSnapshot().open, true);
    advance(7999);
    assert.equal(hint.getSnapshot().open, true);
    advance(1);
    assert.equal(hint.getSnapshot().open, false);
});

void test("restarts the countdown on a second touch", () => {
    const { hint, advance, pending } = harness();
    hint.showFor();
    advance(5000);
    hint.showFor();
    assert.equal(pending(), 1);
    advance(5000);
    assert.equal(hint.getSnapshot().open, true);
    advance(3000);
    assert.equal(hint.getSnapshot().open, false);
});

void test("hide closes immediately and clears the timer", () => {
    const { hint, pending } = harness();
    hint.showFor();
    hint.hide();
    assert.equal(hint.getSnapshot().open, false);
    assert.equal(pending(), 0);
});

void test("returns a stable snapshot and notifies only on change", () => {
    const { hint } = harness();
    let calls = 0;
    hint.subscribe(() => {
        calls += 1;
    });
    const closed = hint.getSnapshot();
    hint.hide();
    assert.equal(hint.getSnapshot(), closed);
    assert.equal(calls, 0);
    hint.showFor();
    const open = hint.getSnapshot();
    hint.showFor();
    assert.equal(hint.getSnapshot(), open);
    assert.equal(calls, 1);
});

void test("unsubscribes and survives hide before remount (StrictMode)", () => {
    const { hint, advance } = harness();
    let calls = 0;
    const unsubscribe = hint.subscribe(() => {
        calls += 1;
    });
    hint.hide();
    hint.showFor();
    unsubscribe();
    advance(HINT_DURATION_MS);
    assert.equal(calls, 1);
    hint.showFor();
    assert.equal(hint.getSnapshot().open, true);
});

void test("dispose clears the timer and the listeners", () => {
    const { hint, pending } = harness();
    let calls = 0;
    hint.subscribe(() => {
        calls += 1;
    });
    hint.showFor();
    hint.dispose();
    assert.equal(pending(), 0);
    assert.equal(hint.getSnapshot().open, false);
    hint.showFor();
    assert.equal(calls, 2);
});

void test("plays and shows the hint for an enabled touch", () => {
    assert.deepEqual(decidePress({ enabled: true, pointerType: "touch" }), { play: true, showHint: true, announce: null });
});

void test("plays without forcing the hint for mouse, pen, keyboard and an empty pointer type", () => {
    for (const pointerType of ["mouse", "pen", "", "keyboard"]) {
        assert.deepEqual(decidePress({ enabled: true, pointerType }), { play: true, showHint: false, announce: null }, pointerType);
    }
});

void test("never plays a disabled icon and announces the reason for every pointer", () => {
    for (const pointerType of ["touch", "mouse", "pen", ""]) {
        assert.deepEqual(decidePress({ enabled: false, pointerType, note: "Rest is 0:00, so there is no rest signal." }), {
            play: false,
            showHint: true,
            announce: "Rest is 0:00, so there is no rest signal.",
        });
    }
});

void test("announces nothing for a disabled icon without a note", () => {
    assert.equal(decidePress({ enabled: false, pointerType: "" }).announce, null);
});

void test("plays Standby with Random start off (enabled with a note) and keeps the note out of the announcement", () => {
    const decision = decidePress({ enabled: true, pointerType: "touch", note: "Random start is off, so Standby does not play during the drill." });
    assert.equal(decision.play, true);
    assert.equal(decision.announce, null);
});

function announcerHarness() {
    let now = 0;
    let nextHandle = 1;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const announcer = createSignalAnnouncer({
        setTimer: (callback, milliseconds) => {
            const handle = nextHandle++;
            timers.set(handle, { at: now + milliseconds, callback });
            return handle;
        },
        clearTimer: (handle) => {
            timers.delete(handle as number);
        },
    });
    function advance(milliseconds: number) {
        now += milliseconds;
        for (const [handle, timer] of [...timers]) {
            if (timer.at <= now) {
                timers.delete(handle);
                timer.callback();
            }
        }
    }
    return { announcer, advance, pending: () => timers.size };
}

void test("announcer sets the text after the delay and clears it after 8 s", () => {
    const { announcer, advance, pending } = announcerHarness();
    announcer.announce("Rest is 0:00");
    assert.equal(announcer.getSnapshot(), "");
    advance(ANNOUNCE_DELAY_MS);
    assert.equal(announcer.getSnapshot(), "Rest is 0:00");
    advance(HINT_DURATION_MS - 1);
    assert.equal(announcer.getSnapshot(), "Rest is 0:00");
    advance(1);
    assert.equal(announcer.getSnapshot(), "");
    assert.equal(pending(), 0);
});

void test("announcer clear removes the text and pending timers (availability changed)", () => {
    const { announcer, advance, pending } = announcerHarness();
    announcer.announce("Rest is 0:00");
    advance(ANNOUNCE_DELAY_MS);
    announcer.clear();
    assert.equal(announcer.getSnapshot(), "");
    assert.equal(pending(), 0);
});

void test("announcer repeats the same text by clearing first and restarting the countdown", () => {
    const { announcer, advance, pending } = announcerHarness();
    const seen: string[] = [];
    announcer.subscribe(() => seen.push(announcer.getSnapshot()));
    announcer.announce("same");
    advance(ANNOUNCE_DELAY_MS);
    advance(5000);
    announcer.announce("same");
    assert.equal(announcer.getSnapshot(), "");
    advance(ANNOUNCE_DELAY_MS);
    assert.equal(announcer.getSnapshot(), "same");
    advance(5000);
    assert.equal(announcer.getSnapshot(), "same");
    assert.equal(pending(), 1);
    assert.deepEqual(seen, ["same", "", "same"]);
});

void test("announcer dispose stops timers", () => {
    const { announcer, pending } = announcerHarness();
    announcer.announce("x");
    announcer.dispose();
    assert.equal(pending(), 0);
});
