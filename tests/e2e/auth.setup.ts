import { test as setup, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";
import { snapshotInbox } from "./support/mailpit";

const authFile = "playwright/.auth/user.json";

// Sign-in is a magic link (no password): request it through the real UI, read it from the local
// Mailpit inbox of the local Supabase stack, confirm it, and save the session for every other spec.
setup("sign in once by email link and save the session", async ({ page, request, baseURL }) => {
    const username = process.env.E2E_USERNAME;
    const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
    if (!username) {
        throw new Error("Set E2E_USERNAME in .env.e2e (see context/foundation/test-stack.md, ## E2E)");
    }
    if (!baseURL) throw new Error("baseURL is not configured");

    // Links already in the inbox belong to earlier runs; only a new message counts.
    const waitForLink = await snapshotInbox(request, { username, mailpitUrl, baseURL });

    await page.goto("/auth/signin");
    // Submitting twice would send two links, so wait for the island once instead of retrying the submit.
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Email address" }).fill(username);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.waitForURL("/auth/confirm-email?next=%2Ftimers");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const link = await waitForLink();

    await page.goto(link);
    await page.getByRole("button", { name: "Continue to your timers" }).click();
    await page.waitForURL("/timers");
    // Only a signed-in user sees their email in the top bar.
    await expect(page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: username })).toBeVisible();

    await page.context().storageState({ path: authFile });
});
