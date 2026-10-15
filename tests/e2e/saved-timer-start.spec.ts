// risk: test-plan.md #5 — facet: Start on a saved timer runs its saved configuration, not the form defaults.
// seed: tests/e2e/seed.spec.ts
// Oracle (PRD FR-011 "uruchomić wybraną konfigurację", FR-003 phase order), written as literals: a timer saved with
// preparation 0:01, exercise 0:07, 2 repetitions and no random start runs "Repetition 1 of 2", a Preparation
// that announces Exercise · 0:07 next, then an Exercise whose countdown starts at the full 0:07.
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";
import { parseRunView } from "./support/run-view";

let timerId: string | undefined;

test.afterEach(async ({ page, baseURL }) => {
    // Cleanup must not fail silently: the timer id is required and the DELETE (sent with the app Origin, as a browser
    // would, or Astro answers 403) must succeed.
    expect(timerId, "the test created its timer").toBeTruthy();
    const response = await page.request.delete(`/api/drills/${timerId}`, { headers: { Origin: new URL(baseURL ?? "").origin } });
    await expect(response).toBeOK();
    timerId = undefined;
});

test("Start on a saved timer runs the saved parameters", async ({ page, baseURL }) => {
    // Unique per run, so parallel runs and reruns on the shared test user never collide.
    const timerName = `E2E start ${Date.now()}`;
    test.info().annotations.push({ type: "test-data", description: timerName });

    // Setup: values that differ from the form defaults come from the API, not from the flow under test.
    const created = await page.request.post("/api/drills", {
        headers: { Origin: new URL(baseURL ?? "").origin },
        data: { name: timerName, preparation: "0:01", exercise: "0:07", rest: "0:00", repetitions: "2", randomStartEnabled: false },
    });
    expect(created.status()).toBe(201);
    timerId = ((await created.json()) as { drill: { id: string } }).drill.id;

    await page.goto(`/${timerId}`);
    await expect(page.getByRole("heading", { level: 1, name: timerName })).toBeVisible();
    // Start is inert before the island hydrates and a retried click would be wrong: wait once.
    await waitForHydration(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();

    const main = page.getByRole("main");
    // Sample every 100 ms and keep the view that matched, so the 1 s preparation cannot slip between two reads.
    let seen = parseRunView("");
    async function viewOf(phase: string) {
        await expect
            .poll(
                async () => {
                    seen = parseRunView(await main.ariaSnapshot());
                    return seen.current?.split(" · ")[0] ?? null;
                },
                { intervals: [100], timeout: 15_000 },
            )
            .toBe(phase);
        return seen;
    }

    // Preparation of repetition 1 of 2 announces the saved exercise next (no Standby: random start is off).
    const preparation = await viewOf("Preparation");
    expect(preparation.current).toBe("Preparation · 0:01");
    expect(preparation.repetition).toBe("Repetition 1 of 2");
    expect(preparation.next).toBe("Exercise · 0:07");

    // The exercise shows its saved time and its countdown starts at that full time.
    const exercise = await viewOf("Exercise");
    expect(exercise.current).toBe("Exercise · 0:07");
    expect(exercise.countdown).toBe("0:07");
    expect(exercise.repetition).toBe("Repetition 1 of 2");

    // Leave the run: Cancel returns to the saved timer.
    await page.getByRole("button", { name: "Cancel drill" }).click();
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
});
