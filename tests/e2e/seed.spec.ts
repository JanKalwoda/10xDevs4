// Risk #5 (context/foundation/test-plan.md §2): a redirect or link leads to the wrong place —
// after saving, the user does not land on the saved timer; after deleting, not back on the timers list.
// Seed of the E2E suite: every generated test copies its patterns (role locators, one self-contained
// setup → action → assertion → cleanup, waiting for state, a name tied to the risk).
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";

const SAVED_TIMER_PATH = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("saving a new timer opens its page and deleting it returns to the timers list", async ({ page }) => {
    // Unique per run, so parallel runs and reruns on the shared test user never collide.
    const timerName = `E2E seed ${Date.now()}`;

    await page.goto("/create");
    // Saving creates a record, so the submit must not be retried: wait for the form island once.
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Name" }).fill(timerName);
    await page.getByRole("button", { name: "Save timer" }).click();

    await page.waitForURL(SAVED_TIMER_PATH);
    await expect(page.getByRole("heading", { level: 1, name: timerName })).toBeVisible();

    // Cleanup is also the second transition of the risk, so it is asserted: a failed delete turns the run red.
    await page.getByRole("button", { name: "Delete timer" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete timer?" });
    await dialog.getByRole("button", { name: "Delete" }).click();

    await page.waitForURL("/timers");
    await expect(page.getByRole("heading", { level: 1, name: "Timers" })).toBeVisible();
    await expect(page.getByText(timerName)).toBeHidden();
});
