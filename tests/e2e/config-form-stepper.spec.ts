// risk: test-plan.md #6 — facet: arrow click and keyboard wiring (deferred from Phase 2)
// seed: tests/e2e/seed.spec.ts
// Oracle (test-plan §2 #6, PRD FR-001/FR-020, stepper contract): one click on an arrow changes the value by
// exactly one step; ↑/↓ in the field step by 1 and Shift+↑/↓ by 10. Expected values are literals.
// The step arithmetic and its limits are unit-tested (src/lib/drill-stepper.test.ts); this covers the wiring.
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";

// The form is guest-only and creates no data, so there is nothing to clean up.
test.use({ storageState: { cookies: [], origins: [] } });

test("the config form: one arrow click is one step, ↑/↓ step by 1 and Shift by 10", async ({ page }) => {
    await page.goto("/");
    // A click before hydration does nothing and Playwright does not retry clicks.
    await waitForHydration(page);

    const repetitions = page.getByRole("textbox", { name: "Repetitions" });
    const increase = page.getByRole("button", { name: "Increase repetitions by 1" });
    const decrease = page.getByRole("button", { name: "Decrease repetitions by 1" });

    // Start from a known value.
    await repetitions.fill("1");
    await expect(repetitions).toHaveValue("1");

    // One click on the up arrow is exactly one step.
    await increase.click();
    await expect(repetitions).toHaveValue("2");

    // ↑ in the field steps by 1.
    await repetitions.press("ArrowUp");
    await expect(repetitions).toHaveValue("3");

    // Shift+↑ steps by 10.
    await repetitions.press("Shift+ArrowUp");
    await expect(repetitions).toHaveValue("13");

    // One click on the down arrow is exactly one step.
    await decrease.click();
    await expect(repetitions).toHaveValue("12");

    // ↓ in the field steps by 1.
    await repetitions.press("ArrowDown");
    await expect(repetitions).toHaveValue("11");
});
