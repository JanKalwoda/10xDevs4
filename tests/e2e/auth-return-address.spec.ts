// risk: test-plan.md #5 — facet: sign-in returns to the protected page that sent the guest (not to the default /timers).
// seed: tests/e2e/seed.spec.ts; the default landing on /timers is asserted in auth.setup.ts.
// Oracle: PRD §Access Control and FR-011/FR-017 (after sign-in the user returns to the protected page they asked for),
// roadmap S-17, test-plan §2 #5 (check the target, not only the redirect code).
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";
import { snapshotInbox } from "./support/mailpit";

// A guest: the saved session of the other specs must not skip the sign-in under test.
test.use({ storageState: { cookies: [], origins: [] } });

test("a guest sent to sign-in from /create comes back to /create after the email link", async ({ page, request, baseURL }) => {
    const username = process.env.E2E_USERNAME;
    const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
    if (!username) throw new Error("Set E2E_USERNAME in .env.e2e (see context/foundation/test-stack.md, ## E2E)");
    if (!baseURL) throw new Error("baseURL is not configured");

    // Only a message that arrives after this submit counts: the shared inbox holds links of other sign-ins.
    const waitForLink = await snapshotInbox(request, { username, mailpitUrl, baseURL });

    // A protected page sends the guest to sign-in and remembers where they wanted to go.
    await page.goto("/create");
    await expect(page).toHaveURL("/auth/signin?next=%2Fcreate");

    // Requesting a link sends an email, so wait for the form island once instead of retrying the submit.
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Email address" }).fill(username);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page).toHaveURL("/auth/confirm-email?next=%2Fcreate");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    // The link from the mail confirms the sign-in and must lead back to /create, not to /timers.
    await page.goto(await waitForLink());
    await page.getByRole("button", { name: "Continue to your timers" }).click();
    await expect(page).toHaveURL("/create");
    await expect(page.getByRole("heading", { level: 1, name: "Create a timer" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: username })).toBeVisible();
});
