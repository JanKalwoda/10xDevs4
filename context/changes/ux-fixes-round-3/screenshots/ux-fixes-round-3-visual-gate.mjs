// Gate for S-22 (script, not human) on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node ux-fixes-round-3-visual-gate.mjs
// Writes ux-fixes-round-3-checks.json next to this file with every assertion result.
// Sections are added phase by phase; every section keeps running in later phases as a regression check.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_PATH ?? here, "noop.js"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const checks = [];
const check = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
    if (!ok) console.error(`FAIL ${name} ${detail}`);
};

const browser = await chromium.launch();

// Primary pointer decides the layout, so the setups differ in `pointer`, not only in `any-pointer`:
// hasTouch alone makes Chromium report pointer: coarse, so "fine primary + touch" is a plain context with CDP touch events.
const SETUPS = [
    { name: "fine", options: {}, pointer: "fine", anyCoarse: false, touch: false },
    { name: "coarse", options: { hasTouch: true, isMobile: true }, pointer: "coarse", anyCoarse: true, touch: true },
    { name: "fine-touch", options: {}, pointer: "fine", anyCoarse: false, touch: "cdp" },
];

async function prepare(page) {
    await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="stepper-default"]');
    // The island is client:load; interactions before hydration do nothing.
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="stepper-default"] button[aria-label="Increase exercise by 1 second"]');
        return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    });
    await page.waitForTimeout(1500); // dev server: let late hydration and HMR settle before pointer input
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
}

const center = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

for (const setup of SETUPS) {
    const context = await browser.newContext({ viewport: { width: setup.name === "coarse" ? 390 : 1280, height: 900 }, ...setup.options });
    const page = await context.newPage();
    await prepare(page);
    const tag = setup.name;
    const media = await page.evaluate(() => ({
        fine: matchMedia("(pointer: fine)").matches,
        anyCoarse: matchMedia("(any-pointer: coarse)").matches,
    }));
    check(`${tag}: primary pointer matches the setup`, media.fine === (setup.pointer === "fine"), JSON.stringify(media));
    check(`${tag}: any-pointer matches the setup`, media.anyCoarse === setup.anyCoarse, JSON.stringify(media));

    const card = page.locator('[data-testid="stepper-default"]');
    const input = card.locator('input[name="exercise"]');
    const up = card.getByRole("button", { name: "Increase exercise by 1 second" });
    const value = () => input.inputValue();
    const reset = async () => {
        await input.fill("0:04");
        await page.waitForTimeout(100);
    };
    // Log of the click details the browser really sends (detail 0 = keyboard / assistive technology).
    await up.evaluate((el) => {
        window.__clicks = [];
        el.addEventListener("click", (event) => window.__clicks.push(event.detail));
    });

    async function tapOnce() {
        const { x, y } = await center(up);
        if (setup.touch === "cdp") {
            const cdp = await context.newCDPSession(page);
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else if (setup.touch) {
            await up.tap();
        } else {
            await page.mouse.click(x, y);
        }
    }

    await reset();
    await tapOnce();
    await page.waitForTimeout(500);
    check(`${tag}: one real ${setup.touch ? "tap" : "click"} steps exactly once`, (await value()) === "0:05", await value());
    const details = await page.evaluate(() => window.__clicks);
    check(`${tag}: the click of a pointer press has detail > 0`, details.length === 1 && details[0] > 0, JSON.stringify(details));

    // The click arrives long after pointerup (slow render, touchpad): still exactly one step.
    await reset();
    await up.evaluate(async (el) => {
        const init = { bubbles: true, pointerId: 41, pointerType: "touch", isPrimary: true, button: 0 };
        el.dispatchEvent(new PointerEvent("pointerdown", init));
        await new Promise((resolve) => setTimeout(resolve, 60));
        el.dispatchEvent(new PointerEvent("pointerup", init));
        el.dispatchEvent(new PointerEvent("lostpointercapture", init));
        await new Promise((resolve) => setTimeout(resolve, 300));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    await page.waitForTimeout(300);
    check(`${tag}: a click 300 ms after pointerup steps exactly once`, (await value()) === "0:05", await value());

    // A click without a pointer (keyboard, screen reader, voice control) steps once.
    await reset();
    await up.evaluate((el) => el.click());
    await page.waitForTimeout(300);
    check(`${tag}: click with detail 0 steps exactly once`, (await value()) === "0:05", await value());

    // Hold: repeats after the pause, and the click after the release adds nothing.
    if (!setup.touch) {
        await reset();
        const { x, y } = await center(up);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(250);
        check(`${tag}: nothing steps during the 400 ms pause`, (await value()) === "0:04", await value());
        await page.waitForTimeout(1050);
        const held = Number((await value()).split(":")[1]);
        check(`${tag}: hold repeats about every 100 ms after the pause`, held - 4 >= 8 && held - 4 <= 11, String(held - 4) + " steps");
        await page.mouse.up();
        await page.waitForTimeout(600);
        const after = Number((await value()).split(":")[1]);
        check(`${tag}: release adds no extra step`, after - held <= 1 && after >= held, `${held} -> ${after}`);
        const settled = await value();
        await page.waitForTimeout(600);
        check(`${tag}: nothing steps after the release`, (await value()) === settled, await value());
        // The flag of the hold must not swallow the next key click.
        await up.evaluate((el) => el.click());
        await page.waitForTimeout(200);
        check(`${tag}: a key click after a hold steps once`, Number((await value()).split(":")[1]) === Number(settled.split(":")[1]) + 1, await value());
    }
    await context.close();
}

await browser.close();
const failed = checks.filter((entry) => !entry.ok);
writeFileSync(join(here, "ux-fixes-round-3-checks.json"), JSON.stringify(checks, null, 2));
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
