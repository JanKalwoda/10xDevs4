import { test as setup, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";

const authFile = "playwright/.auth/user.json";

interface MailpitSummary {
    ID: string;
}

// Sign-in is a magic link (no password): request it through the real UI, read it from the local
// Mailpit inbox of the local Supabase stack, confirm it, and save the session for every other spec.
setup("sign in once by email link and save the session", async ({ page, request, baseURL }) => {
    const username = process.env.E2E_USERNAME;
    const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
    if (!username) {
        throw new Error("Set E2E_USERNAME in .env.e2e (see context/foundation/test-stack.md, ## E2E)");
    }
    const inbox = `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${username}"`)}&limit=50`;

    async function messageIds(): Promise<string[]> {
        const response = await request.get(inbox);
        expect(response.ok(), "local Mailpit must answer (npx supabase start)").toBe(true);
        const body = (await response.json()) as { messages?: MailpitSummary[] };
        return (body.messages ?? []).map((message) => message.ID);
    }

    // Links already in the inbox belong to earlier runs; only a new message counts.
    const earlier = new Set(await messageIds());

    await page.goto("/auth/signin");
    // Submitting twice would send two links, so wait for the island once instead of retrying the submit.
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Email address" }).fill(username);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.waitForURL("/auth/confirm-email?next=%2Ftimers");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    let messageId = "";
    await expect
        .poll(
            async () => {
                messageId = (await messageIds()).find((id) => !earlier.has(id)) ?? "";
                return messageId;
            },
            { message: "No sign-in email: most likely the local Supabase auth limit (wait 5 minutes and rerun)", timeout: 20_000 },
        )
        .not.toBe("");

    const message = (await (await request.get(`${mailpitUrl}/api/v1/message/${messageId}`)).json()) as { HTML: string };
    const link = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&")).find((href) => href.includes("/auth/callback"));
    if (!link || !baseURL) throw new Error("the sign-in email carries no /auth/callback link");
    expect(new URL(link).origin, "the link points at the app under test").toBe(new URL(baseURL).origin);

    await page.goto(link);
    await page.getByRole("button", { name: "Continue to your timers" }).click();
    await page.waitForURL("/timers");
    // Only a signed-in user sees their email in the top bar.
    await expect(page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: username })).toBeVisible();

    await page.context().storageState({ path: authFile });
});
