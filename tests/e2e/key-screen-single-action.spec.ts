// risk: test-plan.md #7 — facet: one click or tap is one action
// seed: tests/e2e/seed.spec.ts
// Oracle: PRD §NFR (touch-proof controls: one click or tap triggers exactly one action); literals only
// Runs in two projects: `chromium` (mouse: click, dblclick) and `mobile-coarse` (touch: tap, two taps at one point).
// A double click or tap must not run an action twice. On the run bar, Restart and Pause/Resume are blocked for 500 ms
// after each activation (src/lib/drill-control-guard.ts); Cancel never is.
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { waitForHydration } from "./support/hydration";
import { installAudioSpy, readAudioContexts } from "./support/audio-spy";

const RUN = { preparation: "10:00", exercise: "0:30", rest: "0:00", repetitions: "2" };
const UUID_PATH = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createdIds: string[] = [];

function isCoarse(testInfo: TestInfo): boolean {
    return testInfo.project.name === "mobile-coarse";
}

async function createTimer(page: Page, baseURL: string | undefined, label: string): Promise<{ id: string; name: string }> {
    const name = `E2E single ${label} ${String(Date.now())}`;
    test.info().annotations.push({ type: "test-data", description: name });
    const created = await page.request.post("/api/drills", { headers: { Origin: new URL(baseURL ?? "").origin }, data: { name, randomStartEnabled: false, ...RUN } });
    expect(created.status(), "setup: the timer is created through the API").toBe(201);
    const id = ((await created.json()) as { drill: { id: string } }).drill.id;
    createdIds.push(id);
    return { id, name };
}

test.afterEach(async ({ page, baseURL }) => {
    // Cleanup must not fail silently: every created timer is deleted with the app Origin and each DELETE must succeed.
    for (const id of createdIds.splice(0)) {
        const response = await page.request.delete(`/api/drills/${id}`, { headers: { Origin: new URL(baseURL ?? "").origin } });
        await expect(response).toBeOK();
    }
});

/** Collects the matching requests the page sends; read it at a settle point, never through a poll on the count. */
function trackRequests(page: Page, method: string, path: RegExp): string[] {
    const seen: string[] = [];
    page.on("request", (request) => {
        if (request.method() === method && path.test(new URL(request.url()).pathname)) seen.push(request.url());
    });
    return seen;
}

async function act(locator: Locator, coarse: boolean): Promise<void> {
    if (coarse) await locator.tap();
    else await locator.click();
}

/** Two clicks (mouse) or two taps (touch) at one point; the locator is resolved once, so a changed name cannot make it wait. */
async function actTwice(page: Page, locator: Locator, coarse: boolean): Promise<void> {
    if (!coarse) {
        await locator.dblclick();
        return;
    }
    // touchscreen.tap skips the actionability wait that click() does: the run bar is aria-disabled for 500 ms after Start.
    await expect(locator).toBeEnabled();
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box, "the control has a box").not.toBeNull();
    const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
    await page.touchscreen.tap(x + width / 2, y + height / 2);
    await page.touchscreen.tap(x + width / 2, y + height / 2);
}

async function openSavedTimer(page: Page, id: string, name: string): Promise<void> {
    await page.goto(`/${id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    // Start is inert before the island hydrates and its effect is not retried: wait once.
    await waitForHydration(page);
}

const start = (page: Page) => page.getByRole("button", { name: "Start", exact: true });

async function startRun(page: Page, coarse: boolean): Promise<void> {
    await act(start(page), coarse);
    await expect(page.getByText("Repetition 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
}

test("Start starts exactly one run", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await installAudioSpy(page);
    const { id, name } = await createTimer(page, baseURL, "start");
    await openSavedTimer(page, id, name);

    await act(start(page), coarse);

    await expect(page.getByText("Repetition 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
    expect(await readAudioContexts(page), "one run creates one audio context").toHaveLength(1);
});

test("Pause pauses and Resume resumes, once each", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "pause");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);

    await act(page.getByRole("button", { name: "Pause drill" }), coarse);
    await expect(page.getByRole("button", { name: "Resume drill" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toHaveCount(0);

    await act(page.getByRole("button", { name: "Resume drill" }), coarse);
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume drill" })).toHaveCount(0);
});

test("Cancel returns to the saved timer, no run is left", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "cancel");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);

    await act(page.getByRole("button", { name: "Cancel drill" }), coarse);

    await expect(start(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toHaveCount(0);
    await expect(page.getByText("Repetition 1 of 2")).toHaveCount(0);
});

test("Cancel stays enabled right after Pause", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "cancel-locked");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);

    await act(page.getByRole("button", { name: "Pause drill" }), coarse);
    // Pause opened the 500 ms window; Cancel must not be part of it (a click would not notice: it waits for Enabled).
    const cancel = page.getByRole("button", { name: "Cancel drill" });
    await expect(cancel).not.toHaveAttribute("aria-disabled", "true");
    await act(cancel, coarse);

    await expect(start(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toHaveCount(0);
    await expect(page.getByText("Repetition 1 of 2")).toHaveCount(0);
});

test("Restart starts exactly one new run on repetition 1", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await installAudioSpy(page);
    const { id, name } = await createTimer(page, baseURL, "restart");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);
    expect(await readAudioContexts(page), "the first run").toHaveLength(1);

    await act(page.getByRole("button", { name: "Restart drill" }), coarse);

    await expect(page.getByText("Repetition 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
    expect(await readAudioContexts(page), "Restart adds exactly one audio context").toHaveLength(2);
});

test("a stepper arrow changes the value by exactly one step", async ({ page }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await page.goto("/");
    await waitForHydration(page);
    const repetitions = page.getByRole("textbox", { name: "Repetitions" });
    await repetitions.fill("5");
    await expect(repetitions).toHaveValue("5");

    await act(page.getByRole("button", { name: "Increase repetitions by 1" }), coarse);
    await expect(repetitions).toHaveValue("6");

    await act(page.getByRole("button", { name: "Decrease repetitions by 1" }), coarse);
    await expect(repetitions).toHaveValue("5");
});

test("Save timer sends exactly one POST and lands on the saved timer", async ({ page }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = `E2E single save ${String(Date.now())}`;
    testInfo.annotations.push({ type: "test-data", description: name });
    const posts = trackRequests(page, "POST", /^\/api\/drills$/);
    await page.goto("/create");
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Name" }).fill(name);

    await act(page.getByRole("button", { name: "Save timer" }), coarse);

    await page.waitForURL((url) => UUID_PATH.test(url.pathname));
    createdIds.push(new URL(page.url()).pathname.slice(1));
    await waitForHydration(page);
    expect(posts, "one POST /api/drills").toHaveLength(1);
});

test("Save changes sends exactly one PUT", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "edit");
    const puts = trackRequests(page, "PUT", new RegExp(`^/api/drills/${id}$`));
    await page.goto(`/${id}/edit`);
    await waitForHydration(page);

    await act(page.getByRole("button", { name: "Save changes" }), coarse);

    await expect(page.getByRole("status").filter({ hasText: `Saved "${name}".` })).toBeVisible();
    expect(puts, "one PUT /api/drills/{id}").toHaveLength(1);
});

test("Delete confirm sends exactly one DELETE and lands on /timers", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "delete");
    const deletes = trackRequests(page, "DELETE", new RegExp(`^/api/drills/${id}$`));
    await openSavedTimer(page, id, name);
    await act(page.getByRole("button", { name: "Delete timer" }), coarse);
    const dialog = page.getByRole("alertdialog", { name: "Delete timer?" });
    await expect(dialog).toBeVisible();

    await act(dialog.getByRole("button", { name: "Delete", exact: true }), coarse);

    await page.waitForURL("**/timers");
    createdIds.splice(createdIds.indexOf(id), 1);
    expect(deletes, "one DELETE /api/drills/{id}").toHaveLength(1);
});

// Double click (mouse) or double tap (touch): the same action must not run twice.

test("a double Start still starts one run", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await installAudioSpy(page);
    const { id, name } = await createTimer(page, baseURL, "start2");
    await openSavedTimer(page, id, name);

    await actTwice(page, start(page), coarse);

    await expect(page.getByText("Repetition 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
    expect(await readAudioContexts(page), "one run, one audio context").toHaveLength(1);
});

test("a double Restart still starts one new run", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await installAudioSpy(page);
    const { id, name } = await createTimer(page, baseURL, "restart2");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);

    await actTwice(page, page.getByRole("button", { name: "Restart drill" }), coarse);

    await expect(page.getByText("Repetition 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();
    expect(await readAudioContexts(page), "start + one Restart = two audio contexts").toHaveLength(2);
});

test("a double Pause leaves the run paused", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "pause2");
    await openSavedTimer(page, id, name);
    await startRun(page, coarse);

    await actTwice(page, page.getByRole("button", { name: "Pause drill" }), coarse);

    await expect(page.getByRole("button", { name: "Resume drill" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause drill" })).toHaveCount(0);
});

test("a double Save timer still sends one POST", async ({ page }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = `E2E single save2 ${String(Date.now())}`;
    testInfo.annotations.push({ type: "test-data", description: name });
    const posts = trackRequests(page, "POST", /^\/api\/drills$/);
    await page.goto("/create");
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Name" }).fill(name);

    await actTwice(page, page.getByRole("button", { name: "Save timer" }), coarse);

    await page.waitForURL((url) => UUID_PATH.test(url.pathname));
    createdIds.push(new URL(page.url()).pathname.slice(1));
    await waitForHydration(page);
    expect(posts, "one POST /api/drills").toHaveLength(1);
});

test("a double Delete confirm still sends one DELETE", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const { id, name } = await createTimer(page, baseURL, "delete2");
    const deletes = trackRequests(page, "DELETE", new RegExp(`^/api/drills/${id}$`));
    await openSavedTimer(page, id, name);
    await act(page.getByRole("button", { name: "Delete timer" }), coarse);
    const dialog = page.getByRole("alertdialog", { name: "Delete timer?" });
    await expect(dialog).toBeVisible();

    await actTwice(page, dialog.getByRole("button", { name: "Delete", exact: true }), coarse);

    await page.waitForURL("**/timers");
    createdIds.splice(createdIds.indexOf(id), 1);
    expect(deletes, "one DELETE /api/drills/{id}").toHaveLength(1);
});
