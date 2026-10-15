import type { Page } from "@playwright/test";

// Reads the run view only through the accessibility tree (the same YAML `ariaSnapshot` a screen reader
// sees), so a test can follow every phase of a short drill without DOM queries or fixed sleeps.

export interface RunView {
    /** The countdown of the `timer` role, or null when there is none (Standby). */
    countdown: string | null;
    /** The first plain line of the region when it has no countdown, e.g. "Standby". */
    headline: string | null;
    repetition: string | null;
    current: string | null;
    next: string | null;
    paused: boolean;
    completed: boolean;
    /** The raw region snapshot, for leak checks that must look at everything the user can read. */
    raw: string;
}

function groupBody(snapshot: string, name: string): string | null {
    const match = new RegExp(`- group "${name}":\\n\\s+- paragraph: ${name}\\n\\s+- paragraph: (.+)`).exec(snapshot);
    return match ? match[1].trim() : null;
}

export function parseRunView(main: string): RunView {
    const start = main.indexOf('- region "Current drill phase":');
    const raw = start === -1 ? "" : main.slice(start);
    const countdown = /- timer "[^"]*": (\S+)/.exec(raw)?.[1] ?? null;
    const firstParagraph = /^ {4}- paragraph: (.+)$/m.exec(raw)?.[1].trim() ?? null;
    return {
        countdown,
        headline: countdown === null ? firstParagraph : null,
        repetition: /- paragraph: (Repetition \d+ of \d+)/.exec(raw)?.[1] ?? null,
        current: groupBody(raw, "Current"),
        next: groupBody(raw, "Next"),
        paused: raw.includes("- status: Drill paused."),
        completed: main.includes('- heading "Completed" [level=2]'),
        raw,
    };
}

/**
 * Samples the main landmark until the drill completes, keeping each distinct view in order.
 * `onView` may act on the page (Pause, Resume); it runs after the view is recorded. It returns true to stop
 * early (the run already diverged from the expectation), so the caller's assertion reports the divergence.
 */
export async function recordRunUntilCompleted(page: Page, onView: (view: RunView, views: readonly RunView[]) => Promise<boolean>, deadlineMs: number): Promise<RunView[]> {
    const main = page.getByRole("main");
    const views: RunView[] = [];
    const stopAt = Date.now() + deadlineMs;
    let last = "";
    while (Date.now() < stopAt) {
        const snapshot = await main.ariaSnapshot();
        if (snapshot === last) continue;
        last = snapshot;
        const view = parseRunView(snapshot);
        views.push(view);
        if (view.completed) return views;
        if (await onView(view, views)) return views;
    }
    throw new Error(`The drill did not complete within ${deadlineMs} ms; last view:\n${last}`);
}
