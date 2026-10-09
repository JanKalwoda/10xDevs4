// Visual gate for S-19 (script, not human): signal preview icon on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node signal-preview-visual-gate.mjs
// Writes screenshots next to this file and signal-preview-checks.json with every assertion result.
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
const STATE_CARDS = ["default", "random-on", "disabled-zero", "disabled-invalid", "error", "loading", "playing"];
const checks = [];
const check = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
    if (!ok) console.error(`FAIL ${name} ${detail}`);
};

const card = (page, fixture) => page.locator(`[data-testid="signal-preview-signal-${fixture}"]`);
const cues = (c) => c.locator('[data-evidence="cues"]').innerText();
// sr-only text has a 1px box; anything larger is a visible duplicate of the tooltip.
const statusVisible = (c) =>
    c.locator('[role="status"]').evaluateAll((els) => els.some((el) => el.textContent.trim() !== "" && (el.getBoundingClientRect().width > 1 || el.getBoundingClientRect().height > 1)));
const statusText = (c) => c.locator('[role="status"]').evaluateAll((els) => els.map((el) => el.textContent.trim()).join(""));
const icon = (c, name) => c.getByRole("button", { name: `Play ${name} signal` });

async function prepare(page, theme) {
    await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="signal-preview-signal-default"]');
    // The island is client:load; taps before hydration do nothing.
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="signal-preview-signal-default"] button[aria-label="Play exercise signal"]');
        return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    });
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
    await page.evaluate((t) => {
        document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
}

async function tooltipInViewport(page, tag, what) {
    const content = page.locator(TOOLTIP);
    await content.first().waitFor({ state: "visible", timeout: 2000 });
    // Let the fade/zoom-in animation finish so the box and the screenshot are final.
    await page.waitForTimeout(400);
    const box = await content.first().boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    const ok = !!box && box.x >= 0 && box.x + box.width <= vw;
    check(`${tag}: tooltip (${what}) inside viewport`, ok, JSON.stringify(box));
    return box;
}

async function shot(page, target, path, extraBox, scroll = true) {
    if (scroll) await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    const boxes = extraBox ? [box, extraBox] : [box];
    const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 8);
    const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 8);
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + 8;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 8;
    const vp = page.viewportSize();
    await page.screenshot({ path, clip: { x, y, width: Math.min(right, vp.width) - x, height: Math.min(bottom, vp.height) - y } });
}

const browser = await chromium.launch();

// Mouse and keyboard pass.
for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        const tag = `${viewport.name}-${theme}`;
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await prepare(page, theme);

        // Form layout in every card that renders the config form (signal, create, edit fixtures).
        const forms = page.locator('[data-testid^="signal-preview-signal-"], [data-testid^="create-"], [data-testid^="edit-"]').locator("form");
        const formCount = await forms.count();
        check(`${tag}: config forms found`, formCount >= 7, `count=${formCount}`);
        for (let i = 0; i < formCount; i++) {
            const overflow = await forms.nth(i).evaluate((form) => {
                const fr = form.getBoundingClientRect();
                let child = "";
                for (const el of form.querySelectorAll("*")) {
                    const r = el.getBoundingClientRect();
                    if (r.width > 1 && getComputedStyle(el).opacity !== "0" && (r.right > fr.right + 0.5 || r.left < fr.left - 0.5)) child = el.tagName + "." + String(el.className).slice(0, 60);
                }
                return form.scrollWidth > form.clientWidth ? "scrollWidth" : child;
            });
            check(`${tag}: form ${i} has no horizontal overflow`, !overflow, overflow);
        }

        // Hitbox, aria contract, icon at the end of the input row.
        const def = card(page, "default");
        for (const name of ["exercise", "rest", "Standby"]) {
            const b = icon(def, name);
            const box = await b.boundingBox();
            check(`${tag}: ${name} icon hitbox >= 44px`, !!box && box.width >= 44 && box.height >= 44, JSON.stringify(box));
            const attrs = await b.evaluate((el) => {
                const d = el.getAttribute("aria-describedby");
                const target = d ? document.getElementById(d) : null;
                return { disabled: el.hasAttribute("disabled"), text: target?.textContent ?? "" };
            });
            check(`${tag}: ${name} has aria-describedby text and no disabled attribute`, !attrs.disabled && attrs.text.length > 10, attrs.text.slice(0, 40));
        }
        const iconInRow = await def.evaluate((el) => {
            const input = el.querySelector('input[name="exercise"]');
            const btn = [...el.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Play exercise signal");
            if (!input || !btn) return { found: false };
            const a = input.getBoundingClientRect();
            const c = btn.getBoundingClientRect();
            return { found: true, sameRow: Math.abs(a.top + a.height / 2 - (c.top + c.height / 2)) < 4, atEnd: c.left >= a.right - 0.5 };
        });
        check(`${tag}: exercise icon sits at the end of the input row`, iconInRow.found && iconInRow.sameRow && iconInRow.atEnd, JSON.stringify(iconInRow));

        // Seven states (empty is N/A: the form always shows its fields; Create/Edit default covers the empty name).
        for (const fixture of STATE_CARDS) {
            await shot(page, card(page, fixture), join(here, `state-${fixture}-${tag}.png`));
        }

        // Hover and focus-visible on the default card.
        for (const name of ["exercise", "Standby"]) {
            const b = icon(def, name);
            await page.mouse.move(0, 0);
            await b.scrollIntoViewIfNeeded();
            await b.hover();
            const hoverBox = await tooltipInViewport(page, tag, `hover ${name}`);
            await shot(page, def, join(here, `hover-${name.toLowerCase()}-${tag}.png`), hoverBox, false);
            await page.mouse.move(0, 0);
            await page.locator(TOOLTIP).first().waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
            await b.focus();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            const focused = await b.evaluate((el) => el === document.activeElement && el.matches(":focus-visible"));
            check(`${tag}: ${name} icon shows :focus-visible`, focused);
            const focusBox = await tooltipInViewport(page, tag, `focus ${name}`);
            await shot(page, def, join(here, `focus-${name.toLowerCase()}-${tag}.png`), focusBox);
            await page.keyboard.press("Escape");
            await page.locator(TOOLTIP).first().waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
        }

        // Disabled icon: click and keyboard do not play, tooltip shows the reason, live region announces it.
        const zero = card(page, "disabled-zero");
        const rest = icon(zero, "rest");
        check(
            `${tag}: disabled rest icon is aria-disabled without disabled`,
            (await rest.getAttribute("aria-disabled")) === "true" && !(await rest.evaluate((el) => el.hasAttribute("disabled"))),
        );
        await rest.click({ force: true });
        check(`${tag}: click on disabled icon plays nothing`, (await cues(zero)) === "none", await cues(zero));
        await page.waitForTimeout(300);
        const live = await zero.locator('[role="status"]:not(:empty)').first().innerText();
        check(`${tag}: live region announces the reason after click`, /Rest/i.test(live) && live.length > 5, live);
        check(`${tag}: live region text is not visible (sr-only)`, !(await statusVisible(zero)));
        await rest.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        check(`${tag}: Enter/Space on disabled icon play nothing`, (await cues(zero)) === "none", await cues(zero));
        const reasonBox = await tooltipInViewport(page, tag, "disabled reason");
        const reasonText = await page.locator(TOOLTIP).first().innerText();
        check(`${tag}: disabled tooltip shows the reason`, /Rest/i.test(reasonText) && reasonText.length > 30, reasonText);
        await shot(page, zero, join(here, `disabled-reason-${tag}.png`), reasonBox);
        await page.keyboard.press("Escape");
        // The reason is cleared when availability changes (Rest 0:00 -> 0:30).
        check(`${tag}: reason is announced before Rest changes`, /Rest/i.test(await statusText(zero)), await statusText(zero));
        await zero.getByLabel("Rest", { exact: true }).fill("0:30");
        await page.waitForTimeout(200);
        check(`${tag}: announcement disappears after Rest becomes valid`, (await statusText(zero)) === "", await statusText(zero));

        // Enabled icon: click, Enter and Space play.
        const ex = icon(def, "exercise");
        await ex.click();
        check(`${tag}: click on enabled icon schedules a cue`, (await cues(def)) === "exercise", await cues(def));
        await ex.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(100);
        check(`${tag}: Enter on enabled icon schedules another cue`, (await cues(def)) === "exercise, exercise", await cues(def));
        await page.keyboard.press("Space");
        await page.waitForTimeout(100);
        check(`${tag}: Space on enabled icon schedules another cue`, (await cues(def)) === "exercise, exercise, exercise", await cues(def));

        // Error: Alert below the row, not in the tooltip.
        const err = card(page, "error");
        await icon(err, "exercise").click();
        await err.getByRole("alert").waitFor({ state: "visible", timeout: 2000 });
        check(`${tag}: error shows a visible Alert`, /unavailable/i.test(await err.getByRole("alert").innerText()));
        await shot(page, err, join(here, `error-alert-${tag}.png`));

        // Loading: aria-busy while initialization is held.
        const load = card(page, "loading");
        await icon(load, "exercise").click();
        await page.waitForTimeout(100);
        check(`${tag}: loading sets aria-busy`, (await icon(load, "exercise").getAttribute("aria-busy")) === "true");
        await shot(page, load, join(here, `loading-busy-${tag}.png`));
        await page.close();
    }
}

// Touch pass: tap shows the hint for 8 s; Esc and an outside tap close it.
for (const theme of THEMES) {
    const tag = `390-${theme}-touch`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await prepare(page, theme);
    const def = card(page, "default");
    const tapIcon = async (c, name) => {
        const b = icon(c, name);
        await b.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const box = await b.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };

    await tapIcon(def, "Standby");
    await page.waitForTimeout(500);
    const hintBox = await tooltipInViewport(page, tag, "tap Standby");
    check(`${tag}: tap on enabled icon plays`, (await cues(def)) === "standby-first, standby-second", await cues(def));
    check(`${tag}: Standby tooltip carries the off note`, /Random start/i.test(await page.locator(TOOLTIP).first().innerText()));
    await shot(page, def, join(here, `tap-standby-${tag}.png`), hintBox);
    await page.waitForTimeout(8000);
    check(`${tag}: hint closes after about 8 s`, (await page.locator(TOOLTIP).count()) === 0);

    await tapIcon(def, "exercise");
    await page.waitForTimeout(500);
    await tooltipInViewport(page, tag, "tap exercise");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check(`${tag}: Escape closes the touch hint`, (await page.locator(TOOLTIP).count()) === 0);

    await tapIcon(def, "exercise");
    await page.waitForTimeout(500);
    check(`${tag}: hint visible before outside tap`, (await page.locator(TOOLTIP).count()) > 0);
    const heading = await page.getByRole("heading", { name: "Signal preview" }).boundingBox();
    await page.touchscreen.tap(heading.x + 4, heading.y + 4);
    await page.waitForTimeout(300);
    check(`${tag}: outside tap closes the touch hint`, (await page.locator(TOOLTIP).count()) === 0);

    const zero = card(page, "disabled-zero");
    await tapIcon(zero, "rest");
    await page.waitForTimeout(500);
    const zBox = await tooltipInViewport(page, tag, "tap disabled rest");
    check(`${tag}: tap on disabled icon shows the reason and plays nothing`, (await cues(zero)) === "none" && /Rest/i.test(await page.locator(TOOLTIP).first().innerText()));
    check(`${tag}: no visible duplicate of the reason under the field`, !(await statusVisible(zero)));
    await shot(page, zero, join(here, `tap-disabled-${tag}.png`), zBox);
    await context.close();
}

await browser.close();
writeFileSync(join(here, "signal-preview-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: checks.filter((c) => !c.ok).length, checks }, null, 2));
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
