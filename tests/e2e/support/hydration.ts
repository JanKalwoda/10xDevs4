import type { Page } from "@playwright/test";

// A React island drops input typed before it hydrates. Astro removes the `ssr` attribute from every
// <astro-island> once it has hydrated, so this resolves when the page is interactive.
// Use it before the first input of a non-idempotent submit (it creates data or sends an email),
// where retrying fill + submit is not safe. The one DOM query of the suite lives here, not in specs.
export async function waitForHydration(page: Page): Promise<void> {
    await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}
