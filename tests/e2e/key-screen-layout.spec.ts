// risk: test-plan.md #7 — facet: layout and tap targets
// seed: tests/e2e/seed.spec.ts
// Oracle: PRD §NFR (no horizontal scroll, touch-proof controls), FR-020 (44 px coarse arrows), CLAUDE.md run bar; 24 px = WCAG 2.5.8; literals only
// Runs in two projects: `chromium` (1280 px, fine pointer) and `mobile-coarse` (390 px, touch is the primary pointer).
// Worst-case data: a 200-character name with an unbroken run and boundary values. Thresholds: 44 px for the run bar
// (Cancel, Restart, Pause/Resume) and the stepper arrows on a coarse pointer, 24 px (WCAG 2.5.8) for the other buttons.
import { test, expect, type Page, type TestInfo } from "@playwright/test";

import { expectCoarsePointer, expectNoHorizontalScroll, expectTarget } from "./support/layout";
import { waitForHydration } from "./support/hydration";
import { parseRunView } from "./support/run-view";

const TOUCH_TARGET = 44;
const MIN_TARGET = 24;
const FIELDS = ["Preparation", "Exercise", "Rest", "Repetitions"] as const;

const BOUNDARY = { preparation: "10:00", exercise: "10:00", rest: "10:00", repetitions: "100" };
const SHORT_RUN = { preparation: "0:01", exercise: "0:30", rest: "0:00", repetitions: "1" };

const createdIds: string[] = [];

function isCoarse(testInfo: TestInfo): boolean {
    return testInfo.project.name === "mobile-coarse";
}

// Exactly 200 characters: a unique stamp, one 70-character run without spaces and filler words.
function longName(label: string): string {
    let name = `E2E layout ${label} ${String(Date.now())} ${"W".repeat(70)} `;
    while (name.length + 16 <= 200) name += "long timer name ";
    return name.padEnd(200, "x");
}

async function createTimer(page: Page, baseURL: string | undefined, name: string, data: Record<string, string | boolean>): Promise<string> {
    test.info().annotations.push({ type: "test-data", description: name });
    const created = await page.request.post("/api/drills", { headers: { Origin: new URL(baseURL ?? "").origin }, data: { name, randomStartEnabled: false, ...data } });
    expect(created.status(), "setup: the timer is created through the API").toBe(201);
    const id = ((await created.json()) as { drill: { id: string } }).drill.id;
    createdIds.push(id);
    return id;
}

test.afterEach(async ({ page, baseURL }) => {
    // Cleanup must not fail silently: every created timer is deleted with the app Origin and each DELETE must succeed.
    for (const id of createdIds.splice(0)) {
        const response = await page.request.delete(`/api/drills/${id}`, { headers: { Origin: new URL(baseURL ?? "").origin } });
        await expect(response).toBeOK();
    }
});

async function expectArrows(page: Page, coarse: boolean): Promise<void> {
    // An arrow at its limit is aria-disabled, and Playwright's actionability treats that as not enabled (no cover check
    // possible), so the arrows are measured one step inside the bounds, where both directions are enabled.
    await fillValues(page, "9:59", "99");
    for (const field of FIELDS) {
        const unit = field === "Repetitions" ? "" : " second";
        for (const direction of ["Increase", "Decrease"]) {
            const arrow = page.getByRole("button", { name: `${direction} ${field.toLowerCase()} by 1${unit}` });
            // A fine-pointer arrow is about 21 px (WCAG 2.5.8 "Equivalent" exception): only window and cover are measured.
            await expectTarget(page, arrow, { minSize: coarse ? TOUCH_TARGET : 0, coarse });
        }
    }
}

async function fillValues(page: Page, time: string, repetitions: string): Promise<void> {
    for (const field of ["Preparation", "Exercise", "Rest"]) await page.getByRole("textbox", { name: field }).fill(time);
    await page.getByRole("textbox", { name: "Repetitions" }).fill(repetitions);
}

async function fillBoundaryValues(page: Page): Promise<void> {
    await fillValues(page, "10:00", "100");
}

async function expectFieldsInWindow(page: Page, coarse: boolean): Promise<void> {
    for (const field of FIELDS) await expectTarget(page, page.getByRole("textbox", { name: field }), { minSize: 0, coarse });
}

async function startSavedRun(page: Page, id: string, name: string): Promise<void> {
    await page.goto(`/${id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    // Start is inert before the island hydrates and its effect is not retried: wait once.
    await waitForHydration(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
}

async function expectRunBar(page: Page, coarse: boolean, toggleName: "Pause drill" | "Resume drill"): Promise<void> {
    const minSize = coarse ? TOUCH_TARGET : MIN_TARGET;
    for (const name of ["Cancel drill", "Restart drill", toggleName]) await expectTarget(page, page.getByRole("button", { name }), { minSize, coarse });
}

test("the config form at / fits the window with boundary values", async ({ page }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await page.goto("/");
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);

    await fillBoundaryValues(page);
    await expectNoHorizontalScroll(page);
    await expectFieldsInWindow(page, coarse);
    await expectArrows(page, coarse);
    for (const signal of ["Exercise", "Rest"]) await expectTarget(page, page.getByRole("button", { name: `Play ${signal} signal` }), { minSize: 0, coarse });
    await expectTarget(page, page.getByRole("button", { name: "Start", exact: true }), { minSize: MIN_TARGET, coarse });
});

test("/create fits the window with the longest name", async ({ page }, testInfo) => {
    const coarse = isCoarse(testInfo);
    await page.goto("/create");
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);

    await page.getByRole("textbox", { name: "Name" }).fill(longName("create"));
    await fillBoundaryValues(page);
    await expectNoHorizontalScroll(page);
    await expectTarget(page, page.getByRole("button", { name: "Save timer" }), { minSize: MIN_TARGET, coarse });
});

test("the saved timer page fits the window with the longest name", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = longName("saved");
    const id = await createTimer(page, baseURL, name, BOUNDARY);

    await page.goto(`/${id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);

    await expectNoHorizontalScroll(page);
    await expectTarget(page, page.getByRole("button", { name: "Start", exact: true }), { minSize: MIN_TARGET, coarse });
    await expectTarget(page, page.getByRole("link", { name: "Edit timer" }), { minSize: MIN_TARGET, coarse });
    await expectTarget(page, page.getByRole("button", { name: "Delete timer" }), { minSize: MIN_TARGET, coarse });
});

test("the delete dialog fits the window", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const id = await createTimer(page, baseURL, longName("dialog"), BOUNDARY);

    await page.goto(`/${id}`);
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);
    await page.getByRole("button", { name: "Delete timer" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Delete timer?" });
    await expect(dialog).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTarget(page, dialog.getByRole("button", { name: "Delete", exact: true }), { minSize: MIN_TARGET, coarse });
    await expectTarget(page, dialog.getByRole("button", { name: "Cancel" }), { minSize: MIN_TARGET, coarse });
});

test("the edit page fits the window with the longest name", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const id = await createTimer(page, baseURL, longName("edit"), BOUNDARY);

    await page.goto(`/${id}/edit`);
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);

    await expectNoHorizontalScroll(page);
    await expectFieldsInWindow(page, coarse);
    await expectArrows(page, coarse);
    await expectTarget(page, page.getByRole("button", { name: "Save changes" }), { minSize: MIN_TARGET, coarse });
});

test("the timers list fits the window with the longest name", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = longName("list");
    await createTimer(page, baseURL, name, BOUNDARY);

    await page.goto("/timers");
    await waitForHydration(page);
    await expectCoarsePointer(page, coarse);

    // The stamp (4th word) is unique per run, so the card is found by it.
    const card = page.getByRole("link", { name: new RegExp(name.split(" ")[3]) });
    await expect(card).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTarget(page, card, { minSize: MIN_TARGET, coarse });
});

test("the run bar in Preparation fits the window", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = longName("prep");
    const id = await createTimer(page, baseURL, name, BOUNDARY);

    await startSavedRun(page, id, name);
    await expectCoarsePointer(page, coarse);
    await expect(page.getByRole("button", { name: "Pause drill" })).toBeVisible();

    await expectNoHorizontalScroll(page);
    await expectRunBar(page, coarse, "Pause drill");
});

test("the run bar in Exercise and in pause fits the window", async ({ page, baseURL }, testInfo) => {
    const coarse = isCoarse(testInfo);
    const name = longName("run");
    const id = await createTimer(page, baseURL, name, SHORT_RUN);

    await startSavedRun(page, id, name);
    await expectCoarsePointer(page, coarse);

    // Wait for Exercise through the accessibility tree: the 1 s preparation is sampled, not slept.
    const main = page.getByRole("main");
    await expect.poll(async () => parseRunView(await main.ariaSnapshot()).current?.split(" · ")[0] ?? null, { intervals: [100], timeout: 15_000 }).toBe("Exercise");
    await expectNoHorizontalScroll(page);
    await expectRunBar(page, coarse, "Pause drill");

    await page.getByRole("button", { name: "Pause drill" }).click();
    await expect(page.getByRole("button", { name: "Resume drill" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectRunBar(page, coarse, "Resume drill");
});
