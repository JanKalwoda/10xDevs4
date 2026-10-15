import { expect, type Locator, type Page } from "@playwright/test";

// Geometry assertions for the key-screen layout checks (test-plan #7). Specs stay on role locators; the few
// reads of the whole document (its width, the list of offenders) live here, like the one DOM query of
// `hydration.ts` — an exception to the locator rule of §6.4 that is confined to this helper.
//
// Boundary of the cover check: `click/tap({ trial: true })` runs only Playwright's actionability checks,
// including "receives events". Playwright retries a covered target with other scroll alignments, so the check
// proves "the target can be hit at some scroll position". It catches a permanent cover (a layer above the
// control) but not a cover by the sticky top bar at one scroll position.

const TOLERANCE = 0.5;

export async function expectCoarsePointer(page: Page, expected: boolean): Promise<void> {
    // Guard of the emulation: a project that does not report the pointer it names would measure the wrong layout.
    const coarse = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
    expect(coarse, `the project must report (pointer: coarse) = ${String(expected)}`).toBe(expected);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
    const { scrollWidth, clientWidth, offenders } = await page.evaluate((tolerance) => {
        const width = document.documentElement.clientWidth;
        const found: string[] = [];
        for (const element of document.body.querySelectorAll("*")) {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.right > width + tolerance) {
                const text = (element.getAttribute("aria-label") ?? element.textContent).trim().replace(/\s+/g, " ").slice(0, 40);
                found.push(`${element.tagName.toLowerCase()} "${text}" right=${String(Math.round(rect.right))}`);
            }
        }
        return { scrollWidth: document.documentElement.scrollWidth, clientWidth: width, offenders: found.slice(0, 8) };
    }, TOLERANCE);
    expect(scrollWidth, `horizontal scroll: document ${String(scrollWidth)} px > window ${String(clientWidth)} px; offenders: ${offenders.join(" | ")}`).toBeLessThanOrEqual(
        clientWidth,
    );
}

/**
 * The control lies fully inside the window, is at least `minSize` px wide and tall, and nothing covers it.
 * `coarse` selects `tap` (touch) or `click` for the cover check; both are trials and perform no action.
 */
export async function expectTarget(page: Page, locator: Locator, { minSize, coarse }: { minSize: number; coarse: boolean }): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeInViewport({ ratio: 1 });
    const box = await locator.boundingBox();
    expect(box, "the control has a box").not.toBeNull();
    const { x, width, height } = box ?? { x: 0, width: 0, height: 0 };
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(x, "left edge inside the window").toBeGreaterThanOrEqual(-TOLERANCE);
    expect(x + width, "right edge inside the window").toBeLessThanOrEqual(viewportWidth + TOLERANCE);
    expect(width, `width >= ${String(minSize)} px (was ${String(Math.round(width))} x ${String(Math.round(height))})`).toBeGreaterThanOrEqual(minSize - TOLERANCE);
    expect(height, `height >= ${String(minSize)} px (was ${String(Math.round(width))} x ${String(Math.round(height))})`).toBeGreaterThanOrEqual(minSize - TOLERANCE);
    if (coarse) await locator.tap({ trial: true });
    else await locator.click({ trial: true });
}
