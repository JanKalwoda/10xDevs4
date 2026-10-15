import type { Page } from "@playwright/test";

// Headless Chromium under Playwright always reports the page as visible: another tab, another window
// or a minimised window does not change it. So switching to another app or locking the screen is
// emulated at the browser's own boundary: `document.hidden` / `visibilityState` change and the real
// `visibilitychange` event fires, and everything the app does from there on is production code.
export async function setPageHidden(page: Page, hidden: boolean): Promise<void> {
    await page.evaluate((isHidden) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => isHidden });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (isHidden ? "hidden" : "visible") });
        document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
}
