// Visual gate for S-21 (script, not human) on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node ux-fixes-round-2-visual-gate.mjs
// Writes screenshots next to this file and ux-fixes-round-2-checks.json with every assertion result.
// Sections are added phase by phase; every section keeps running in later phases as a regression check.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_PATH ?? here, "noop.js"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const VIEWPORTS = [
    { name: "1280", width: 1280, height: 900 },
    { name: "390", width: 390, height: 844 },
];
const THEMES = ["light", "dark"];
const TOOLTIP = '[data-slot="tooltip-content"]';
const checks = [];
const check = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
    if (!ok) console.error(`FAIL ${name} ${detail}`);
};

const card = (page, fixture) => page.locator(`[data-testid="signal-preview-signal-${fixture}"]`);
const icon = (c, name) => c.getByRole("button", { name: `Play ${name} signal` });

async function prepare(page, theme) {
    await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="signal-preview-signal-default"]');
    // The island is client:load; interactions before hydration do nothing.
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="signal-preview-signal-default"] button[aria-label="Play exercise signal"]');
        return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    });
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
    await page.evaluate((t) => {
        document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
}

async function shot(page, target, path) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    const vp = page.viewportSize();
    const x = Math.max(0, box.x - 8);
    const y = Math.max(0, box.y - 8);
    await page.screenshot({ path, clip: { x, y, width: Math.min(box.x + box.width + 8, vp.width) - x, height: Math.min(box.y + box.height + 8, vp.height) - y } });
}

// Width of the widest text line against the inner width of the tooltip box (A5.3: no empty right half).
async function tooltipFit(page) {
    const content = page.locator(TOOLTIP).first();
    await content.waitFor({ state: "visible", timeout: 2000 });
    await page.waitForTimeout(400);
    return content.evaluate((el) => {
        const style = getComputedStyle(el);
        const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        let widest = 0;
        for (const p of el.querySelectorAll("p")) {
            const range = document.createRange();
            range.selectNodeContents(p);
            for (const rect of range.getClientRects()) widest = Math.max(widest, rect.width);
        }
        return { inner, widest, gap: inner - widest, textBalance: style.textWrap };
    });
}

const browser = await chromium.launch();

// Phase 1: A5.3 tooltip fit and A5.9 hover on a disabled icon.
for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        const tag = `${viewport.name}-${theme}`;
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await prepare(page, theme);

        // A5.3: Exercise, Standby (long text) and the disabled Rest reason.
        for (const [fixture, name] of [
            ["default", "exercise"],
            ["default", "Standby"],
            ["disabled-zero", "rest"],
        ]) {
            const target = icon(card(page, fixture), name);
            await page.mouse.move(0, 0);
            await target.scrollIntoViewIfNeeded();
            await target.hover();
            const fit = await tooltipFit(page);
            // One word of slack: greedy wrapping may leave the last word of the widest line on the next one.
            check(`${tag}: A5.3 ${name} tooltip has no empty right half`, fit.gap <= 48 && fit.textBalance !== "balance", JSON.stringify(fit));
            await shot(page, card(page, fixture), join(here, `tooltip-${name.toLowerCase()}-${tag}.png`));
            await page.mouse.move(0, 0);
            await page.locator(TOOLTIP).first().waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
        }

        // A5.9: a disabled icon keeps its icon color, background and not-allowed cursor on hover.
        const disabled = icon(card(page, "disabled-zero"), "rest");
        await disabled.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        const read = () =>
            disabled.evaluate((el) => {
                const style = getComputedStyle(el);
                return { color: style.color, background: style.backgroundColor, cursor: style.cursor, ariaDisabled: el.getAttribute("aria-disabled"), disabled: el.hasAttribute("disabled") };
            });
        const before = await read();
        await disabled.hover();
        await page.waitForTimeout(400); // transition-all
        const after = await read();
        check(`${tag}: A5.9 disabled icon keeps its color on hover`, before.color === after.color, `${before.color} -> ${after.color}`);
        check(`${tag}: A5.9 disabled icon keeps its background on hover`, before.background === after.background, `${before.background} -> ${after.background}`);
        check(`${tag}: A5.9 disabled icon keeps cursor not-allowed`, after.cursor === "not-allowed", after.cursor);
        check(`${tag}: A5.9 icon is aria-disabled, not disabled`, after.ariaDisabled === "true" && !after.disabled);
        await shot(page, card(page, "disabled-zero"), join(here, `disabled-hover-${tag}.png`));

        // An enabled icon still highlights on hover (the rule must not leak). Light accent-foreground equals foreground, so compare the background.
        const enabled = icon(card(page, "default"), "exercise");
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        const enabledBefore = await enabled.evaluate((el) => getComputedStyle(el).backgroundColor);
        await enabled.scrollIntoViewIfNeeded();
        await enabled.hover();
        await page.waitForTimeout(400);
        const enabledAfter = await enabled.evaluate((el) => getComputedStyle(el).backgroundColor);
        check(`${tag}: enabled icon still highlights on hover`, enabledBefore !== enabledAfter, `${enabledBefore} -> ${enabledAfter}`);

        await page.close();
    }
}

await browser.close();
writeFileSync(join(here, "ux-fixes-round-2-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: checks.filter((c) => !c.ok).length, checks }, null, 2));
const failed = checks.filter((c) => !c.ok).length;
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
