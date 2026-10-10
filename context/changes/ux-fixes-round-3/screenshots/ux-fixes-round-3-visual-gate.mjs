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

const shot = async (page, locator, path) => {
    await locator.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await locator.screenshot({ path });
};

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

    // Phase 2: arrows inside the frame of the field, layout from the primary pointer.
    const rect = (locator) =>
        locator.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        });
    const coarsePrimary = setup.pointer === "coarse";
    const fields = [
        { name: "preparation", label: "preparation", unit: " second" },
        { name: "exercise", label: "exercise", unit: " second" },
        { name: "rest", label: "rest", unit: " second" },
        { name: "repetitions", label: "repetitions", unit: "" },
    ];
    const cardRect = await rect(card);
    check(`${tag}: form card fits the viewport`, await card.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= document.documentElement.clientWidth), JSON.stringify(cardRect));
    for (const f of fields) {
        const fieldInput = card.locator(`input[name="${f.name}"]`);
        const group = fieldInput.locator("xpath=ancestor::*[@data-slot='input-group'][1]");
        const upBtn = card.getByRole("button", { name: `Increase ${f.label} by 1${f.unit}` });
        const downBtn = card.getByRole("button", { name: `Decrease ${f.label} by 1${f.unit}` });
        const [g, u, d, i] = [await rect(group), await rect(upBtn), await rect(downBtn), await rect(fieldInput)];
        check(`${tag} ${f.name}: frame is 44 px high and holds field and both arrows`, Math.abs(g.height - 44) < 0.5 && i.right <= g.right && u.right <= g.right + 0.5 && d.right <= g.right + 0.5 && u.x >= i.right - 0.5, JSON.stringify({ g, i, u, d }));
        check(`${tag} ${f.name}: the field has no border of its own`, (await fieldInput.evaluate((el) => getComputedStyle(el).borderTopWidth)) === "0px");
        if (coarsePrimary) {
            check(`${tag} ${f.name}: 44 px buttons side by side, down left of up`, u.width === 44 && u.height === 44 && d.width === 44 && d.height === 44 && d.x < u.x && Math.abs(d.y - u.y) < 0.5, JSON.stringify({ u, d }));
        } else {
            check(`${tag} ${f.name}: column, up above down, each half of the frame`, Math.abs(u.x - d.x) < 0.5 && u.y < d.y && u.height >= 20 && d.height >= 20 && u.height + d.height <= 44.5, JSON.stringify({ u, d }));
        }
    }
    const speaker = card.getByRole("button", { name: "Play exercise signal" });
    const exerciseGroup = card.locator('input[name="exercise"]').locator("xpath=ancestor::*[@data-slot='input-group'][1]");
    check(`${tag}: speaker icon is outside the frame, on its right`, (await rect(speaker)).x >= (await rect(exerciseGroup)).right - 0.5);
    // Longest values still fit the field without clipping.
    await card.locator('input[name="exercise"]').fill("10:00");
    await card.locator('input[name="repetitions"]').fill("100");
    check(
        `${tag}: longest values are not clipped`,
        await card.locator("input").evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth)),
    );
    // One focus ring for the whole frame.
    await card.locator('input[name="rest"]').focus();
    const restGroup = card.locator('input[name="rest"]').locator("xpath=ancestor::*[@data-slot='input-group'][1]");
    check(`${tag}: focus draws a ring on the frame`, (await restGroup.evaluate((el) => getComputedStyle(el).boxShadow)) !== "none");
    // Error state colors the frame, not the field.
    const errorCard = page.locator('[data-testid="stepper-error"]');
    await errorCard.getByRole("button", { name: "Start" }).click();
    await page.waitForTimeout(300);
    const errorGroup = errorCard.locator('input[name="preparation"]').locator("xpath=ancestor::*[@data-slot='input-group'][1]");
    const colors = await Promise.all([errorGroup, exerciseGroup].map((g) => g.evaluate((el) => getComputedStyle(el).borderTopColor)));
    check(`${tag}: invalid field colors the frame`, colors[0] !== colors[1], JSON.stringify(colors));
    // Phase 3: tooltip width follows the text on desktop, Current has no frame and no fill.
    const TOOLTIP = '[data-slot="tooltip-content"]';
    const tipCard = (fixture) => page.locator(`[data-testid="signal-preview-signal-${fixture}"]`);
    const measure = (el) => {
            const box = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            let widest = 0;
            let lines = 0;
            for (const p of el.querySelectorAll("p")) {
                const range = document.createRange();
                range.selectNodeContents(p);
                const rects = [...range.getClientRects()].filter((r) => r.width > 0);
                const tops = new Set(rects.map((r) => Math.round(r.top)));
                lines += tops.size;
                for (const r of rects) widest = Math.max(widest, r.width);
            }
            const inner = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return { width: box.width, inner, widest, gap: inner - widest, lines, right: box.right, left: box.left, vw: document.documentElement.clientWidth, iw: innerWidth, sw: document.documentElement.scrollWidth, vv: visualViewport.width };
    };
    const tipCases = [
        { fixture: "signal-default", label: "exercise", state: "available" },
        { fixture: "signal-default", label: "rest", state: "available" },
        { fixture: "signal-default", label: "Standby", state: "with off note" },
        { fixture: "signal-random-on", label: "Standby", state: "available" },
        { fixture: "signal-disabled-zero", label: "rest", state: "disabled with reason" },
        { fixture: "signal-disabled-invalid", label: "rest", state: "disabled until valid" },
    ];
    for (const c of tipCases) {
        const trigger = tipCard(c.fixture.replace("signal-", "")).getByRole("button", { name: `Play ${c.label} signal` });
        await page.mouse.move(0, 0);
        await page.locator(TOOLTIP).first().waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
        await trigger.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        let m = null;
        for (let attempt = 0; attempt < 4 && !m; attempt++) {
            if (setup.touch === true) await trigger.tap({ force: true });
            else await trigger.hover({ force: true });
            await page.waitForTimeout(500);
            m = await page.locator(TOOLTIP).first().evaluate(measure, null, { timeout: 1500 }).catch(() => null);
            if (!m) await page.mouse.move(0, 0);
        }
        if (!m) check(`${tag} tooltip ${c.label} (${c.state}): opens`, false);
        if (!m) continue;
        const name = `${tag} tooltip ${c.label} (${c.state})`;
        check(`${name}: no empty space on the right (gap <= ${coarsePrimary ? 8 : 12} px; one word cannot be split)`, m.gap <= (coarsePrimary ? 8 : 12), JSON.stringify(m));
        check(`${name}: inside the viewport`, m.left >= 0 && m.right <= m.iw, JSON.stringify(m));
        if (!coarsePrimary) check(`${name}: fits in 1-2 lines per paragraph block (<= 3 lines total)`, m.lines <= 3, JSON.stringify(m));
        check(`${name}: max width ${coarsePrimary ? "320" : "448"} px`, m.width <= (coarsePrimary ? 320 : 448) + 0.5, JSON.stringify(m));
    }
    await page.mouse.move(0, 0);

    for (const fixture of ["preparation-exercise", "preparation-standby", "standby-exercise", "exercise-rest", "longest-values"]) {
        const view = page.locator(`[data-testid="sections-${fixture}"]`);
        await view.scrollIntoViewIfNeeded();
        const boxes = await view.evaluate((el) => {
            const groups = [...el.querySelectorAll('[role="group"]')];
            const info = (g) => {
                const s = getComputedStyle(g);
                const r = g.getBoundingClientRect();
                return { height: r.height, borderColor: s.borderTopColor, borderWidth: s.borderTopWidth, bg: s.backgroundColor, lineTop: g.querySelector("p:last-child").getBoundingClientRect().top - r.top, labelTop: g.querySelector("p").getBoundingClientRect().top - r.top, left: g.querySelector("p").getBoundingClientRect().left - r.left };
            };
            return groups.map(info);
        });
        const [cur, nxt] = boxes;
        check(`${tag} ${fixture}: Current is unframed and has a transparent background`, cur.bg === "rgba(0, 0, 0, 0)" && /rgba\(0, 0, 0, 0\)|transparent/.test(cur.borderColor), JSON.stringify(cur));
        check(`${tag} ${fixture}: Next keeps its frame and fill`, nxt.bg !== "rgba(0, 0, 0, 0)" && nxt.borderColor !== "rgba(0, 0, 0, 0)", JSON.stringify(nxt));
        check(`${tag} ${fixture}: Current and Next have the same height and text offsets`, cur.height === nxt.height && cur.lineTop === nxt.lineTop && cur.labelTop === nxt.labelTop && cur.left === nxt.left, JSON.stringify({ cur, nxt }));
    }
    // Control bar and time do not move between phases (Standby included).
    const barTops = [];
    for (const fixture of ["preparation-exercise", "standby-exercise", "exercise-rest", "rest-standby"]) {
        const view = page.locator(`[data-testid="sections-${fixture}"]`);
        barTops.push(await view.evaluate((el) => {
            const base = el.getBoundingClientRect().top;
            const bar = el.querySelector('button[aria-label*="Cancel" i], button[aria-label*="Restart" i]');
            const timer = el.querySelector('[role="timer"], p.text-6xl');
            return { bar: bar.getBoundingClientRect().top - base, time: timer.getBoundingClientRect().top - base };
        }));
    }
    check(`${tag}: control bar and time sit at the same offset in every phase`, barTops.every((t) => t.bar === barTops[0].bar && t.time === barTops[0].time), JSON.stringify(barTops));
    await shot(page, page.locator('[data-testid="sections-preparation-exercise"]'), join(here, `current-unframed-${tag}.png`));
    await shot(page, page.locator('[data-testid="sections-standby-exercise"]'), join(here, `current-standby-${tag}.png`));
    await context.close();
}

await browser.close();
const failed = checks.filter((entry) => !entry.ok);
writeFileSync(join(here, "ux-fixes-round-3-checks.json"), JSON.stringify(checks, null, 2));
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
