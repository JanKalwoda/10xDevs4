// risk: test-plan.md #5 — facet: from the timers list into a saved timer, its edit page and back, every link and
// "Save changes" end on the right address; saving a new timer and deleting one are covered by seed.spec.ts.
// seed: tests/e2e/seed.spec.ts
// Oracle: roadmap S-17 (the list is /timers, a saved timer is /{id}, back links lead to /timers), S-12 edit scope
// (/{id}/edit saves in place and links back to /{id}), S-21 ("Back to timers" on /create leads to /timers).
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let timerId: string | undefined;

test.afterEach(async ({ page, baseURL }) => {
    // Cleanup must not fail silently: the timer id is required and the DELETE (sent with the app Origin, as a browser
    // would, or Astro answers 403) must succeed.
    expect(timerId, "the test created its timer").toBeTruthy();
    const response = await page.request.delete(`/api/drills/${timerId}`, { headers: { Origin: new URL(baseURL ?? "").origin } });
    await expect(response).toBeOK();
    timerId = undefined;
});

test("from the timers list into a saved timer, its edit page and back, every link lands on the right page", async ({ page, baseURL }) => {
    // Unique per run, so parallel runs and reruns on the shared test user never collide.
    const timerName = `E2E nav ${Date.now()}`;
    const renamed = `${timerName} renamed`;
    test.info().annotations.push({ type: "test-data", description: timerName });

    // Setup: the timer to navigate comes from the API, not from the flow under test.
    const created = await page.request.post("/api/drills", {
        headers: { Origin: new URL(baseURL ?? "").origin },
        data: { name: timerName, preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false },
    });
    expect(created.status()).toBe(201);
    timerId = ((await created.json()) as { drill: { id: string } }).drill.id;
    const timerPath = `/${timerId}`;

    // The timers list opens the saved timer.
    await page.goto("/timers");
    await page.getByRole("link", { name: new RegExp(`^${escapeRegExp(timerName)} `) }).click();
    await expect(page).toHaveURL(timerPath);
    await expect(page.getByRole("heading", { level: 1, name: timerName })).toBeVisible();

    // "Edit timer" opens the edit page of this timer.
    await page.getByRole("link", { name: "Edit timer" }).click();
    await expect(page).toHaveURL(`${timerPath}/edit`);
    await expect(page.getByRole("heading", { level: 1, name: "Edit timer" })).toBeVisible();

    // "Save changes" saves in place: the user stays on the edit page with a confirmation.
    // Saving writes data, so the submit must not be retried: wait for the form island once.
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Name" }).fill(renamed);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Saved "${renamed}".` })).toBeVisible();
    await expect(page).toHaveURL(`${timerPath}/edit`);

    // "Back to timer" returns to the same saved timer, which shows the saved name.
    await page.getByRole("link", { name: "Back to timer", exact: true }).click();
    await expect(page).toHaveURL(timerPath);
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();

    // "Back to timers" on the saved timer returns to the list, which lists it under the new name.
    await page.getByRole("link", { name: "Back to timers" }).click();
    await expect(page).toHaveURL("/timers");
    await expect(page.getByRole("heading", { level: 1, name: "Timers" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`^${escapeRegExp(renamed)} `) })).toBeVisible();

    // "Create a timer" opens /create, and its "Back to timers" returns to the list.
    await page.getByRole("link", { name: "Create a timer" }).click();
    await expect(page).toHaveURL("/create");
    await page.getByRole("link", { name: "Back to timers" }).click();
    await expect(page).toHaveURL("/timers");
    await expect(page.getByRole("heading", { level: 1, name: "Timers" })).toBeVisible();
});
