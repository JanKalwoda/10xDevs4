import { expect, type APIRequestContext } from "@playwright/test";

interface MailpitSummary {
    ID: string;
}

export interface MailpitInbox {
    username: string;
    mailpitUrl: string;
    baseURL: string;
}

// Reads the local Mailpit inbox of the local Supabase stack. Links already in the inbox belong to earlier runs,
// so a caller snapshots the inbox before it requests a link and then waits for a message that is not in the snapshot.
export async function snapshotInbox(request: APIRequestContext, inbox: MailpitInbox): Promise<() => Promise<string>> {
    const search = `${inbox.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${inbox.username}"`)}&limit=50`;

    async function messageIds(): Promise<string[]> {
        const response = await request.get(search);
        expect(response.ok(), "local Mailpit must answer (npx supabase start)").toBe(true);
        const body = (await response.json()) as { messages?: MailpitSummary[] };
        return (body.messages ?? []).map((message) => message.ID);
    }

    const earlier = new Set(await messageIds());

    // Resolves to the same-origin /auth/callback link of the first message that arrived after the snapshot.
    return async () => {
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

        const message = (await (await request.get(`${inbox.mailpitUrl}/api/v1/message/${messageId}`)).json()) as { HTML: string };
        const link = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&")).find((href) => href.includes("/auth/callback"));
        if (!link) throw new Error("the sign-in email carries no /auth/callback link");
        expect(new URL(link).origin, "the link points at the app under test").toBe(new URL(inbox.baseURL).origin);
        return link;
    };
}
