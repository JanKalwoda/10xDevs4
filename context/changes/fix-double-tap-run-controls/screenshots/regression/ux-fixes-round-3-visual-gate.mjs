// Gate for S-22 (script, not human) on /dev/timer-ui and on the production views.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node ux-fixes-round-3-visual-gate.mjs
// Writes screenshots next to this file and ux-fixes-round-3-checks.json with every assertion result.
// Section A: one press = one step (mouse, tap, tap with primary fine, delayed click, hold) and the arrows inside the frame, per pointer setup.
// Section B: seven states x light/dark x 1280/390 x three pointer setups, tooltips, Current/Next and page overflow.
// Section C: no horizontal overflow at 390 px on the production views (/, /create, /{id}/edit, /{id}, /timers and the run view).
//   It needs the local Supabase (`npx supabase start`): a throw-away user is created through the admin API and removed at the end.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.PLAYWRIGHT_PATH ?? here, "noop.js"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const THEMES = ["light", "dark"];
const VIEWPORTS = [
    { name: "1280", width: 1280, height: 900 },
    { name: "390", width: 390, height: 844 },
];
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

const FIELDS = [
    { name: "preparation", label: "preparation", unit: " second" },
    { name: "exercise", label: "exercise", unit: " second" },
    { name: "rest", label: "rest", unit: " second" },
    { name: "repetitions", label: "repetitions", unit: "" },
];
const stepButton = (c, field, dir) => c.getByRole("button", { name: `${dir} ${field.label} by 1${field.unit}` });
const inputOf = (c, field) => c.locator(`input[name="${field.name}"]`);
const groupOf = (input) => input.locator("xpath=ancestor::*[@data-slot='input-group'][1]");
const rect = (locator) =>
    locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    });
const stepperCard = (page, fixture) => page.locator(`[data-testid="stepper-${fixture}"]`);

async function prepare(page, theme = "light") {
    await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="stepper-default"]');
    // The island is client:load; interactions before hydration do nothing.
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="stepper-default"] button[aria-label="Increase exercise by 1 second"]');
        return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    });
    await page.waitForTimeout(1500); // dev server: let late hydration and HMR settle before pointer input
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
    await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
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

const pageOverflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

// ---------------------------------------------------------------------------------------------------------------------
// Section A: one press = one step, arrows inside the frame.
// ---------------------------------------------------------------------------------------------------------------------
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

    // Arrows inside the frame of the field, layout from the primary pointer.
    const coarsePrimary = setup.pointer === "coarse";
    check(
        `${tag}: form card fits the viewport`,
        await card.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= document.documentElement.clientWidth),
    );
    for (const f of FIELDS) {
        const fieldInput = inputOf(card, f);
        const group = groupOf(fieldInput);
        const upBtn = stepButton(card, f, "Increase");
        const downBtn = stepButton(card, f, "Decrease");
        const [g, u, d, i] = [await rect(group), await rect(upBtn), await rect(downBtn), await rect(fieldInput)];
        check(
            `${tag} ${f.name}: frame is 44 px high and holds field and both arrows`,
            Math.abs(g.height - 44) < 0.5 && i.right <= g.right && u.right <= g.right + 0.5 && d.right <= g.right + 0.5 && u.x >= i.right - 0.5,
            JSON.stringify({ g, i, u, d }),
        );
        check(`${tag} ${f.name}: the field has no border of its own`, (await fieldInput.evaluate((el) => getComputedStyle(el).borderTopWidth)) === "0px");
        if (coarsePrimary) {
            check(
                `${tag} ${f.name}: 44 px buttons side by side, down left of up`,
                u.width === 44 && u.height === 44 && d.width === 44 && d.height === 44 && d.x < u.x && Math.abs(d.y - u.y) < 0.5,
                JSON.stringify({ u, d }),
            );
        } else {
            check(
                `${tag} ${f.name}: column, up above down, each half of the frame`,
                Math.abs(u.x - d.x) < 0.5 && u.y < d.y && u.height >= 20 && d.height >= 20 && u.height + d.height <= 44.5,
                JSON.stringify({ u, d }),
            );
        }
    }
    const speaker = card.getByRole("button", { name: "Play exercise signal" });
    const exerciseGroup = groupOf(inputOf(card, FIELDS[1]));
    check(`${tag}: speaker icon is outside the frame, on its right`, (await rect(speaker)).x >= (await rect(exerciseGroup)).right - 0.5);
    await context.close();
}

// ---------------------------------------------------------------------------------------------------------------------
// Section B: seven states, tooltips, Current/Next and page overflow in 3 pointer setups x 1280/390 x light/dark.
// ---------------------------------------------------------------------------------------------------------------------
const TOOLTIP = '[data-slot="tooltip-content"]';
const tipCard = (page, fixture) => page.locator(`[data-testid="signal-preview-signal-${fixture}"]`);
const measureTooltip = (el) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    let widest = 0;
    let lines = 0;
    for (const p of el.querySelectorAll("p")) {
        const range = document.createRange();
        range.selectNodeContents(p);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        lines += new Set(rects.map((r) => Math.round(r.top))).size;
        for (const r of rects) widest = Math.max(widest, r.width);
    }
    const inner = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return { width: box.width, inner, widest, gap: inner - widest, lines, right: box.right, left: box.left, iw: innerWidth };
};
const TIP_CASES = [
    { fixture: "default", label: "exercise", state: "available" },
    { fixture: "default", label: "rest", state: "available" },
    { fixture: "default", label: "Standby", state: "with off note" },
    { fixture: "random-on", label: "Standby", state: "available" },
    { fixture: "disabled-zero", label: "rest", state: "disabled with reason" },
    { fixture: "disabled-invalid", label: "rest", state: "disabled until valid" },
];

async function tooltipChecks(page, tag, { tap, wide }) {
    for (const c of TIP_CASES) {
        const trigger = tipCard(page, c.fixture).getByRole("button", { name: `Play ${c.label} signal` });
        await page.mouse.move(0, 0);
        await page
            .locator(TOOLTIP)
            .first()
            .waitFor({ state: "detached", timeout: 2000 })
            .catch(() => {});
        await trigger.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        let m = null;
        for (let attempt = 0; attempt < 4 && !m; attempt++) {
            if (tap) await trigger.tap({ force: true });
            else await trigger.hover({ force: true });
            await page.waitForTimeout(500);
            m = await page
                .locator(TOOLTIP)
                .first()
                .evaluate(measureTooltip, null, { timeout: 1500 })
                .catch(() => null);
            if (!m) await page.mouse.move(0, 0);
        }
        const name = `${tag} tooltip ${c.label} (${c.state})`;
        check(`${name}: opens`, !!m);
        if (!m) continue;
        check(`${name}: no empty space on the right (gap <= ${wide ? 12 : 8} px; one word cannot be split)`, m.gap <= (wide ? 12 : 8), JSON.stringify(m));
        check(`${name}: inside the viewport`, m.left >= 0 && m.right <= m.iw, JSON.stringify(m));
        if (wide) check(`${name}: at most 3 text lines in total`, m.lines <= 3, JSON.stringify(m));
        check(`${name}: max width ${wide ? "448" : "320"} px`, m.width <= (wide ? 448 : 320) + 0.5, JSON.stringify(m));
    }
    await page.mouse.move(0, 0);
}

async function currentChecks(page, tag) {
    for (const fixture of ["preparation-exercise", "preparation-standby", "standby-exercise", "exercise-rest", "longest-values"]) {
        const view = page.locator(`[data-testid="sections-${fixture}"]`);
        await view.scrollIntoViewIfNeeded();
        const boxes = await view.evaluate((el) => {
            const info = (g) => {
                const s = getComputedStyle(g);
                const r = g.getBoundingClientRect();
                return {
                    height: r.height,
                    borderColor: s.borderTopColor,
                    bg: s.backgroundColor,
                    lineTop: g.querySelector("p:last-child").getBoundingClientRect().top - r.top,
                    labelTop: g.querySelector("p").getBoundingClientRect().top - r.top,
                    left: g.querySelector("p").getBoundingClientRect().left - r.left,
                };
            };
            return [...el.querySelectorAll('[role="group"]')].map(info);
        });
        const [cur, nxt] = boxes;
        check(
            `${tag} ${fixture}: Current is unframed and has a transparent background`,
            cur.bg === "rgba(0, 0, 0, 0)" && /rgba\(0, 0, 0, 0\)|transparent/.test(cur.borderColor),
            JSON.stringify(cur),
        );
        check(`${tag} ${fixture}: Next keeps its frame and fill`, nxt.bg !== "rgba(0, 0, 0, 0)" && nxt.borderColor !== "rgba(0, 0, 0, 0)", JSON.stringify(nxt));
        check(
            `${tag} ${fixture}: Current and Next have the same height and text offsets`,
            cur.height === nxt.height && cur.lineTop === nxt.lineTop && cur.labelTop === nxt.labelTop && cur.left === nxt.left,
            JSON.stringify({ cur, nxt }),
        );
    }
    // Control bar and time do not move between phases (Standby included).
    const tops = [];
    for (const fixture of ["preparation-exercise", "standby-exercise", "exercise-rest", "rest-standby"]) {
        tops.push(
            await page.locator(`[data-testid="sections-${fixture}"]`).evaluate((el) => {
                const base = el.getBoundingClientRect().top;
                const bar = el.querySelector('button[aria-label*="Cancel" i], button[aria-label*="Restart" i]');
                const timer = el.querySelector('[role="timer"], p.text-6xl');
                return { bar: bar.getBoundingClientRect().top - base, time: timer.getBoundingClientRect().top - base };
            }),
        );
    }
    check(
        `${tag}: control bar and time sit at the same offset in every phase`,
        tops.every((t) => t.bar === tops[0].bar && t.time === tops[0].time),
        JSON.stringify(tops),
    );
}

const readButton = (locator) =>
    locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            background: style.backgroundColor,
            color: style.color,
            cursor: style.cursor,
            opacity: style.opacity,
            ariaDisabled: el.getAttribute("aria-disabled"),
            disabled: el.hasAttribute("disabled"),
        };
    });
const frameHeights = (c) => c.evaluate((root) => [...root.querySelectorAll("[data-slot='input-group']")].map((g) => g.getBoundingClientRect().height));

for (const setup of SETUPS) {
    for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
            const tag = `${setup.name}-${viewport.name}-${theme}`;
            const coarsePrimary = setup.pointer === "coarse";
            const options = { ...setup.options };
            if (setup.name === "coarse" && viewport.name === "1280") delete options.isMobile; // a coarse tablet-sized window
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ...options });
            const page = await context.newPage();
            await prepare(page, theme);
            const media = await page.evaluate(() => ({ fine: matchMedia("(pointer: fine)").matches, anyCoarse: matchMedia("(any-pointer: coarse)").matches }));
            check(`${tag}: primary pointer matches the setup`, media.fine === (setup.pointer === "fine"), JSON.stringify(media));
            const overflow = await pageOverflow(page);
            check(`${tag}: /dev/timer-ui has no horizontal page overflow`, overflow.sw <= overflow.cw, JSON.stringify(overflow));

            // Layout invariants in every fixture: four frames of 44 px, no overflow, arrows follow the primary pointer and stay inside the frame.
            for (const fixture of ["default", "disabled-min", "disabled-max", "error", "loading"]) {
                const c = stepperCard(page, fixture);
                await c.scrollIntoViewIfNeeded();
                const heights = await frameHeights(c);
                check(`${tag} ${fixture}: the four field frames are 44 px`, heights.length === 4 && heights.every((h) => Math.abs(h - 44) < 0.5), JSON.stringify(heights));
                check(
                    `${tag} ${fixture}: card has no horizontal overflow`,
                    await c.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= document.documentElement.clientWidth),
                );
                const exercise = FIELDS[1];
                const [u, d, g] = [await rect(stepButton(c, exercise, "Increase")), await rect(stepButton(c, exercise, "Decrease")), await rect(groupOf(inputOf(c, exercise)))];
                check(
                    `${tag} ${fixture}: arrow order and size follow the primary pointer`,
                    coarsePrimary
                        ? u.width === 44 && u.height === 44 && d.width === 44 && d.x < u.x
                        : u.height >= 20 && d.height >= 20 && u.height + d.height <= 42.5 && u.y < d.y && Math.abs(u.x - d.x) < 0.5, // about 21 px each inside the 1 px frame
                    JSON.stringify({ u, d }),
                );
                check(
                    `${tag} ${fixture}: both arrows are inside the frame`,
                    u.right <= g.right + 0.5 && d.right <= g.right + 0.5 && u.y >= g.y - 0.5 && u.bottom <= g.bottom + 0.5 && d.y >= g.y - 0.5 && d.bottom <= g.bottom + 0.5,
                    JSON.stringify({ u, d, g }),
                );
            }
            // Longest values do not overflow the frame at this width.
            const longest = stepperCard(page, "default");
            await inputOf(longest, FIELDS[1]).fill("10:00");
            await inputOf(longest, FIELDS[3]).fill("100");
            check(
                `${tag}: longest values (10:00, 100) are not clipped and do not overflow`,
                await longest.evaluate((el) => [...el.querySelectorAll("input")].every((i) => i.scrollWidth <= i.clientWidth) && el.scrollWidth <= el.clientWidth),
            );
            await inputOf(longest, FIELDS[1]).fill("0:04");
            await inputOf(longest, FIELDS[3]).fill("3");

            // 1 default
            const def = stepperCard(page, "default");
            for (const field of FIELDS) {
                for (const dir of ["Increase", "Decrease"]) {
                    check(`${tag} default ${field.name} ${dir}: enabled`, (await stepButton(def, field, dir).getAttribute("aria-disabled")) === "false");
                }
            }
            await shot(page, def, join(here, `state-default-${tag}.png`));

            // 2 hover: the arrow highlights (Tailwind 4 gates hover: behind (hover: hover); a touch-only browser has none, nothing sticks).
            const hoverTarget = stepButton(def, FIELDS[1], "Increase");
            await page.mouse.move(0, 0);
            await page.waitForTimeout(300);
            const idle = await readButton(hoverTarget);
            await hoverTarget.scrollIntoViewIfNeeded();
            await hoverTarget.hover();
            await page.waitForTimeout(400);
            const hovered = await readButton(hoverTarget);
            const canHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
            check(
                `${tag} hover: ${canHover ? "the enabled arrow changes its background" : "N/A without (hover: hover), nothing sticks"}`,
                canHover ? idle.background !== hovered.background : idle.background === hovered.background,
                `${idle.background} -> ${hovered.background}`,
            );
            await shot(page, def, join(here, `state-hover-${tag}.png`));
            await page.mouse.move(0, 0);

            // 3 focus-visible: one ring on the frame of the field, none on the field itself, arrows skip Tab.
            const exerciseInput = inputOf(def, FIELDS[1]);
            const exerciseGroup = groupOf(exerciseInput);
            const unfocused = await exerciseGroup.evaluate((el) => getComputedStyle(el).boxShadow);
            await exerciseInput.scrollIntoViewIfNeeded();
            await page.keyboard.press("Tab");
            await exerciseInput.focus();
            await page.keyboard.press("ArrowUp");
            await page.waitForTimeout(250);
            const focused = await exerciseInput.evaluate((el) => ({
                visible: el.matches(":focus-visible"),
                own: getComputedStyle(el).boxShadow,
                frame: getComputedStyle(el.closest("[data-slot='input-group']")).boxShadow,
            }));
            check(
                `${tag} focus-visible: the frame shows one ring, the field none`,
                focused.visible &&
                    focused.frame.includes("0px 0px 0px 2px") &&
                    focused.frame !== unfocused &&
                    !/0px 0px 0px [1-9]px/.test(focused.own.replace(/rgba\(0, 0, 0, 0\)/g, "")),
                JSON.stringify({ unfocused, focused }),
            );
            check(`${tag} focus-visible: the arrows are not tab stops (N/A for the arrows)`, (await stepButton(def, FIELDS[1], "Increase").getAttribute("tabindex")) === "-1");
            await shot(page, def, join(here, `state-focus-visible-${tag}.png`));
            await exerciseInput.blur();

            // 4 disabled at both bounds: aria-disabled, dimmed, no hover change, a click does nothing.
            for (const [fixture, blocked, open, expected] of [
                ["disabled-min", "Decrease", "Increase", { preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1" }],
                ["disabled-max", "Increase", "Decrease", { preparation: "10:00", exercise: "10:00", rest: "10:00", repetitions: "100" }],
            ]) {
                const c = stepperCard(page, fixture);
                await c.scrollIntoViewIfNeeded();
                for (const field of FIELDS) {
                    const target = stepButton(c, field, blocked);
                    await page.mouse.move(0, 0);
                    await page.waitForTimeout(250);
                    const before = await readButton(target);
                    await target.hover();
                    await page.waitForTimeout(400);
                    const after = await readButton(target);
                    check(
                        `${tag} ${fixture} ${field.name}: ${blocked} is aria-disabled, not disabled, dimmed`,
                        before.ariaDisabled === "true" && !before.disabled && Number(before.opacity) < 1,
                        JSON.stringify(before),
                    );
                    check(
                        `${tag} ${fixture} ${field.name}: ${blocked} keeps color, background and not-allowed on hover`,
                        before.color === after.color && before.background === after.background && after.cursor === "not-allowed",
                        JSON.stringify({ before, after }),
                    );
                    await target.dispatchEvent("click");
                    check(
                        `${tag} ${fixture} ${field.name}: click on the blocked arrow changes nothing`,
                        (await inputOf(c, field).inputValue()) === expected[field.name],
                        await inputOf(c, field).inputValue(),
                    );
                    check(`${tag} ${fixture} ${field.name}: ${open} stays enabled`, (await stepButton(c, field, open).getAttribute("aria-disabled")) === "false");
                }
                await page.mouse.move(0, 0);
                await shot(page, c, join(here, `state-disabled-${fixture.replace("disabled-", "")}-${tag}.png`));
            }

            // 5 error: invalid values show alerts after Start and colour the frame, the first arrow press steps to the field minimum and clears the error.
            const err = stepperCard(page, "error");
            await err.scrollIntoViewIfNeeded();
            await err.getByRole("button", { name: "Start" }).click();
            await page.waitForTimeout(250);
            check(`${tag} error: four validation alerts`, (await err.locator("p[role='alert']").count()) === 4, String(await err.locator("p[role='alert']").count()));
            check(`${tag} error: inputs are aria-invalid`, (await err.locator("input[aria-invalid='true']").count()) === 4);
            check(`${tag} error: Start did not run`, (await err.locator("[data-evidence='start-calls']").textContent()) === "0");
            check(`${tag} error: no arrow is aria-disabled for an invalid value`, (await err.locator("button[aria-label*=' by 1'][aria-disabled='true']").count()) === 0);
            const frameColors = await Promise.all([groupOf(inputOf(err, FIELDS[0])), exerciseGroup].map((g) => g.evaluate((el) => getComputedStyle(el).borderTopColor)));
            check(`${tag} error: the invalid frame is coloured, a valid one is not`, frameColors[0] !== frameColors[1], JSON.stringify(frameColors));
            await shot(page, err, join(here, `state-error-${tag}.png`));
            const minimum = { preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1" };
            for (const field of FIELDS) {
                await stepButton(err, field, "Increase").dispatchEvent("click");
                check(
                    `${tag} error ${field.name}: first press gives the minimum`,
                    (await inputOf(err, field).inputValue()) === minimum[field.name],
                    await inputOf(err, field).inputValue(),
                );
            }
            check(`${tag} error: the alerts clear once the values are valid`, (await err.locator("p[role='alert']").count()) === 0);

            // 6 empty: not a separate state. The form always has values; an emptied field is the error state above.
            check(`${tag} empty: N/A (an emptied field is the error state)`, true, "justified in plan: the form always has values");

            // 7 loading: pending submit, arrows still usable.
            const load = stepperCard(page, "loading");
            await load.scrollIntoViewIfNeeded();
            const submit = load.getByRole("button", { name: "Start" });
            check(`${tag} loading: submit is disabled and busy`, (await submit.isDisabled()) && (await submit.getAttribute("aria-busy")) === "true");
            await stepButton(load, FIELDS[1], "Increase").dispatchEvent("click");
            check(`${tag} loading: the arrows still step`, (await inputOf(load, FIELDS[1]).inputValue()) === "0:05", await inputOf(load, FIELDS[1]).inputValue());
            await shot(page, load, join(here, `state-loading-${tag}.png`));

            // Tooltips (3 signals x available/disabled) and Current/Next.
            await tooltipChecks(page, tag, { tap: setup.touch === true, wide: viewport.width >= 768 });
            await currentChecks(page, tag);
            if (theme === "light") {
                await shot(page, page.locator('[data-testid="sections-preparation-exercise"]'), join(here, `current-unframed-${tag}.png`));
                await shot(page, page.locator('[data-testid="sections-standby-exercise"]'), join(here, `current-standby-${tag}.png`));
            }
            await context.close();
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Section C: no horizontal overflow at 390 px on the production views.
// ---------------------------------------------------------------------------------------------------------------------
async function localSupabase() {
    const text = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], cwd: join(here, "../../../../..") });
    return Object.fromEntries(
        text
            .split("\n")
            .map((line) => line.match(/^(\w+)="?(.*?)"?$/))
            .filter(Boolean)
            .map((m) => [m[1], m[2]]),
    );
}

const offenders = (page) =>
    page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > vw + 0.5 && el.getBoundingClientRect().width > 0)
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    });

let supabase = null;
let userId = null;
try {
    supabase = await localSupabase();
    const email = `gate-s22-${Date.now()}@example.com`;
    const headers = { apikey: supabase.SERVICE_ROLE_KEY, Authorization: `Bearer ${supabase.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
    const newLink = async () =>
        (await fetch(`${supabase.API_URL}/auth/v1/admin/generate_link`, { method: "POST", headers, body: JSON.stringify({ type: "magiclink", email }) })).json();
    const origin = new URL(BASE_URL).origin;

    for (const setup of [SETUPS[1], SETUPS[0]]) {
        const tag = `views-${setup.name}-390`;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...setup.options });
        const generated = await newLink(); // a token works once
        userId = generated.id;
        const callback = await context.request.post(`${BASE_URL}/api/auth/callback`, {
            form: { token_hash: generated.hashed_token, type: "email", next: "/timers" },
            headers: { Origin: origin },
            maxRedirects: 0,
        });
        check(`${tag}: signed in with a throw-away local user`, callback.status() === 303, String(callback.status()));
        const save = await context.request.post(`${BASE_URL}/api/drills`, {
            data: {
                name: `Gate S-22 ${setup.name} long name for the overflow check at the narrowest width`,
                preparation: "10:00",
                exercise: "10:00",
                rest: "10:00",
                repetitions: "100",
                randomStartEnabled: true,
            },
            headers: { Origin: origin },
        });
        const drill = (await save.json()).drill;
        check(`${tag}: a saved timer with the longest values exists`, save.status() === 201 && !!drill?.id, String(save.status()));
        if (!drill?.id) {
            await context.close();
            continue;
        }
        const page = await context.newPage();
        for (const path of ["/", "/create", `/${drill.id}/edit`, `/${drill.id}`, "/timers"]) {
            await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1200);
            await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
            const o = await pageOverflow(page);
            check(
                `${tag} ${path === "/" || path === "/create" || path === "/timers" ? path : path.replace(drill.id, "{id}")}: no horizontal overflow`,
                o.sw <= o.cw,
                JSON.stringify({ ...o, offenders: o.sw > o.cw ? await offenders(page) : [] }),
            );
            if (path === `/${drill.id}/edit`) {
                await page.locator('input[name="exercise"]').fill("10:00");
                await page.locator('input[name="repetitions"]').fill("100");
                const o2 = await pageOverflow(page);
                check(`${tag} /{id}/edit: no horizontal overflow with the longest values`, o2.sw <= o2.cw, JSON.stringify(o2));
                await page.screenshot({ path: join(here, `view-edit-${setup.name}-390.png`), fullPage: true });
            }
            if (path === "/") await page.screenshot({ path: join(here, `view-home-${setup.name}-390.png`), fullPage: true });
        }
        // The run view: start from `/` with the longest values and a fast-forward-free preparation, then look at the layout.
        await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        await page.locator('input[name="preparation"]').fill("10:00");
        await page.locator('input[name="exercise"]').fill("10:00");
        await page.locator('input[name="rest"]').fill("10:00");
        await page.locator('input[name="repetitions"]').fill("100");
        const startOverflow = await pageOverflow(page);
        check(`${tag} /: no horizontal overflow with the longest values`, startOverflow.sw <= startOverflow.cw, JSON.stringify(startOverflow));
        await page.getByRole("button", { name: "Start" }).click();
        const cancel = page.getByRole("button", { name: /Cancel drill/i });
        const running = await cancel
            .waitFor({ state: "visible", timeout: 8000 })
            .then(() => true)
            .catch(() => false);
        check(`${tag}: the run view opens`, running);
        if (running) {
            await page.waitForTimeout(800);
            const o = await pageOverflow(page);
            check(
                `${tag} run view (Preparation, longest values): no horizontal overflow`,
                o.sw <= o.cw,
                JSON.stringify({ ...o, offenders: o.sw > o.cw ? await offenders(page) : [] }),
            );
            await page.screenshot({ path: join(here, `view-run-${setup.name}-390.png`), fullPage: true });
            await cancel.click();
        }
        await context.close();
    }
} catch (error) {
    check("section C: production views could be checked (needs the local Supabase)", false, String(error));
} finally {
    if (supabase && userId) {
        await fetch(`${supabase.API_URL}/auth/v1/admin/users/${userId}`, {
            method: "DELETE",
            headers: { apikey: supabase.SERVICE_ROLE_KEY, Authorization: `Bearer ${supabase.SERVICE_ROLE_KEY}` },
        }).catch(() => {});
    }
}

await browser.close();
const failed = checks.filter((entry) => !entry.ok);
writeFileSync(join(here, "ux-fixes-round-3-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: failed.length, checks }, null, 2));
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
