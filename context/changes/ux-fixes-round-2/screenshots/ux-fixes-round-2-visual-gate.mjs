// Visual gate for S-21 (script, not human) on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node ux-fixes-round-2-visual-gate.mjs
// Writes screenshots next to this file and ux-fixes-round-2-checks.json with every assertion result.
// Sections are added phase by phase; every section keeps running in later phases as a regression check.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
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
    await page.waitForTimeout(1500); // dev server: let late hydration and HMR settle before pointer input
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
            // A fresh page per tooltip: a hover right after another tooltip closed can miss in this Radix setup.
            if (fixture !== "default" || name !== "exercise") await prepare(page, theme);
            const target = icon(card(page, fixture), name);
            await page.mouse.move(0, 0);
            await target.scrollIntoViewIfNeeded();
            await target.hover();
            const fit = await tooltipFit(page).catch((error) => {
                console.error(`tooltip missing: ${tag} ${fixture} ${name}`);
                throw error;
            });
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

// Phase 2: Current looks like Next (same box, label, one body line), Standby shows no time, positions are stable.
const SECTION = 'section[aria-label="Current drill phase"]';
for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        const tag = `${viewport.name}-${theme}`;
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
        await page.waitForSelector(`[data-testid="sections-two-warnings"] ${SECTION}`);
        await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
        await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
        const cards = page.locator('[data-testid^="sections-"]').filter({ has: page.locator(SECTION) });
        const count = await cards.count();
        check(`${tag}: phase 2 fixture cards found`, count >= 14, `count=${count}`);
        const rows = [];
        for (let i = 0; i < count; i++) {
            const el = cards.nth(i);
            const id = await el.getAttribute("data-testid");
            const data = await el.evaluate((root, sel) => {
                const section = root.querySelector(sel);
                const top = section.getBoundingClientRect().top;
                const box = (label) => {
                    const labelEl = [...section.querySelectorAll("p")].find((p) => p.textContent === label);
                    const group = labelEl?.closest('[role="group"]');
                    if (!group || group.getAttribute("aria-labelledby") !== labelEl.id) return null;
                    const body = group.querySelectorAll("p")[1];
                    const g = getComputedStyle(group);
                    const l = getComputedStyle(labelEl);
                    const b = getComputedStyle(body);
                    const lineHeight = parseFloat(b.lineHeight);
                    return {
                        style: [g.backgroundColor, g.borderTopColor, g.borderTopWidth, g.borderRadius, g.paddingTop, g.paddingLeft].join("|"),
                        labelSize: parseFloat(l.fontSize),
                        bodySize: parseFloat(b.fontSize),
                        oneLine: body.getBoundingClientRect().height <= lineHeight + 0.5,
                        text: body.textContent,
                        top: group.getBoundingClientRect().top - top,
                        height: group.getBoundingClientRect().height,
                    };
                };
                const timer = section.querySelector('[role="timer"]');
                const standby = [...section.querySelectorAll("p")].find((p) => p.textContent === "Standby" && !p.closest('[role="group"]'));
                const main = timer ?? standby;
                const bar = [...section.querySelectorAll("button")].find((b) => /Cancel drill/.test(b.getAttribute("aria-label") ?? ""));
                return {
                    current: box("Current"),
                    next: box("Next"),
                    mainTop: main ? main.getBoundingClientRect().top - top : null,
                    barTop: bar ? bar.getBoundingClientRect().top - top : null,
                    timerCount: section.querySelectorAll('[role="timer"]').length,
                    timerOnlyTime: timer ? /^\d+:\d\d$/.test(timer.textContent ?? "") : true,
                    overflow: section.scrollWidth > section.clientWidth,
                };
            }, SECTION);
            rows.push({ id, ...data });
        }
        for (const r of rows) {
            check(`${tag} ${r.id}: Current and Next boxes exist`, !!r.current && !!r.next);
            if (!r.current || !r.next) continue;
            check(`${tag} ${r.id}: Current has the same box style as Next`, r.current.style === r.next.style, `${r.current.style} vs ${r.next.style}`);
            check(`${tag} ${r.id}: label larger than body`, r.current.labelSize > r.current.bodySize && r.next.labelSize > r.next.bodySize);
            check(`${tag} ${r.id}: Current and Next bodies are one line`, r.current.oneLine && r.next.oneLine, `${r.current.text} / ${r.next.text}`);
            check(`${tag} ${r.id}: Current and Next boxes have equal height`, Math.abs(r.current.height - r.next.height) < 0.5, `${r.current.height} vs ${r.next.height}`);
            check(`${tag} ${r.id}: role=timer only on the number`, r.timerCount <= 1 && r.timerOnlyTime);
            check(`${tag} ${r.id}: no overflow`, !r.overflow);
        }
        const byId = (id) => rows.find((r) => r.id === id);
        check(`${tag}: Standby Current text is exactly "Standby"`, byId("sections-standby-exercise")?.current?.text === "Standby", String(byId("sections-standby-exercise")?.current?.text));
        check(`${tag}: Standby Next text has no time`, !/\d:\d\d/.test(byId("sections-preparation-standby")?.next?.text ?? "0:00"), String(byId("sections-preparation-standby")?.next?.text));
        check(`${tag}: longest values fit on one line`, byId("sections-longest-values")?.current?.oneLine === true, String(byId("sections-longest-values")?.current?.text));
        const timed = rows.filter((r) => r.current && r.mainTop !== null && r.id !== "sections-initializing");
        const base = timed.find((r) => r.id === "sections-preparation-exercise");
        check(`${tag}: time, Current and the button bar sit at fixed positions in every scenario`,
            timed.every((r) => r.mainTop === base.mainTop && r.current.top === base.current.top && r.barTop === base.barTop),
            JSON.stringify(timed.filter((r) => r.mainTop !== base.mainTop || r.current.top !== base.current.top || r.barTop !== base.barTop).map((r) => [r.id, r.mainTop, r.current.top, r.barTop])));
        await page.locator('section[aria-label="Phase sections examples"]').screenshot({ path: join(here, `current-like-next-${tag}.png`) });
        await page.locator('[data-testid="sections-standby-exercise"]').screenshot({ path: join(here, `standby-${tag}.png`) });
        await page.close();
    }
}

// Phase 4: ConfigStepper in DrillConfigForm, in three pointer setups (fine, coarse, mouse + touch) and with the keyboard.
const FIELDS = [
    { name: "preparation", label: "preparation", step: " second" },
    { name: "exercise", label: "exercise", step: " second" },
    { name: "rest", label: "rest", step: " second" },
    { name: "repetitions", label: "repetitions", step: "" },
];
const stepButton = (c, field, dir) => c.getByRole("button", { name: `${dir} ${field.label} by 1${field.step}` });
const inputOf = (c, field) => c.locator(`input[name="${field.name}"]`);
const rect = (locator) =>
    locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

const SETUPS = [
    { name: "fine", options: {}, coarse: false },
    { name: "coarse", options: { hasTouch: true, isMobile: true }, coarse: true },
    { name: "mouse-touch", options: { hasTouch: true }, coarse: true },
];
for (const setup of SETUPS) {
    for (const viewport of VIEWPORTS) {
        if (setup.name === "coarse" && viewport.name !== "390") continue;
        if (setup.name === "mouse-touch" && viewport.name !== "1280") continue;
        for (const theme of THEMES) {
            const tag = `${setup.name}-${viewport.name}-${theme}`;
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ...setup.options });
            const page = await context.newPage();
            await prepare(page, theme);
            const c = card(page, "default");
            await c.scrollIntoViewIfNeeded();

            check(`${tag}: any-pointer matches the setup`, (await page.evaluate(() => matchMedia("(any-pointer: coarse)").matches)) === setup.coarse);
            check(`${tag}: paragraph mentions arrows and Shift`, /Use the arrows, or ↑ and ↓ in a field \(Shift for 10\)\./.test(await c.innerText()));
            // The page itself has a known 414 px overflow in TimerUiPreview (out of scope); the form card must fit the viewport and not overflow inside.
            check(
                `${tag}: form card has no horizontal overflow`,
                await c.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= document.documentElement.clientWidth),
            );

            for (const field of FIELDS) {
                const up = stepButton(c, field, "Increase");
                const down = stepButton(c, field, "Decrease");
                const input = inputOf(c, field);
                const inputId = await input.getAttribute("id");
                check(
                    `${tag} ${field.name}: buttons exist, tabIndex -1, aria-controls`,
                    (await up.count()) === 1 && (await down.count()) === 1 && (await up.getAttribute("tabindex")) === "-1" && (await down.getAttribute("aria-controls")) === inputId,
                );
                const [u, d] = [await rect(up), await rect(down)];
                const row = await rect(input.locator(".."));
                const column = await rect(up.locator(".."));
                check(`${tag} ${field.name}: row is 44 px`, Math.abs(row.height - 44) < 0.5, String(row.height));
                if (setup.coarse) {
                    check(
                        `${tag} ${field.name}: buttons 44 px side by side, down left of up`,
                        u.width === 44 && u.height === 44 && d.width === 44 && d.height === 44 && d.x < u.x && Math.abs(d.y - u.y) < 0.5,
                        JSON.stringify({ u, d }),
                    );
                } else {
                    check(
                        `${tag} ${field.name}: column is 44 px, buttons 22 px, up above down`,
                        column.height === 44 && u.height === 22 && d.height === 22 && u.y < d.y && Math.abs(d.y - (u.y + u.height)) < 0.5,
                        JSON.stringify({ column, u, d }),
                    );
                    const border = await down.evaluate((el) => getComputedStyle(el).borderTopWidth);
                    check(`${tag} ${field.name}: no double border between the buttons`, border === "0px", border);
                }
            }
            const exercise = FIELDS[1];
            const speaker = icon(c, "exercise");
            check(`${tag}: stepper sits before the speaker icon`, (await rect(stepButton(c, exercise, "Increase"))).x < (await rect(speaker)).x);
            check(`${tag}: speaker icon stays 44 px`, (await rect(speaker)).height === 44);
            const stepperXs = [];
            for (const f of FIELDS) stepperXs.push((await rect(stepButton(c, f, "Increase"))).x);
            check(`${tag}: steppers of all four rows share one column`, stepperXs.every((x) => Math.abs(x - stepperXs[0]) < 0.5), JSON.stringify(stepperXs));

            // One press steps exactly once (pointerdown, then the click that follows is ignored).
            const exerciseInput = inputOf(c, exercise);
            const up = stepButton(c, exercise, "Increase");
            const down = stepButton(c, exercise, "Decrease");
            await exerciseInput.fill("0:04");
            if (setup.options.isMobile) await up.tap();
            else await up.click();
            check(`${tag}: one press steps exactly once`, (await exerciseInput.inputValue()) === "0:05", await exerciseInput.inputValue());
            await page.waitForTimeout(250);
            // A click without a pointer press (keyboard, screen reader, voice control) steps once.
            await down.dispatchEvent("click");
            check(`${tag}: click without pointerdown steps once`, (await exerciseInput.inputValue()) === "0:04", await exerciseInput.inputValue());
            await page.waitForTimeout(500);
            const statusTexts = await c.locator("p.sr-only[role='status']").allTextContents();
            check(`${tag}: sr-only status announces the last value`, statusTexts.includes("Exercise 0:04"), JSON.stringify(statusTexts));

            if (!setup.options.isMobile) {
                const press = async () => {
                    await exerciseInput.fill("0:01");
                    await page.waitForTimeout(100);
                    const box = await rect(up);
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                    await page.mouse.down();
                    return box;
                };
                let box = await press();
                await page.waitForTimeout(200);
                const early = await exerciseInput.inputValue();
                check(`${tag}: hold makes one step before the delay`, early === "0:02", early);
                await page.waitForTimeout(1100);
                const held = Number((await exerciseInput.inputValue()).split(":")[1]);
                check(`${tag}: hold repeats about every 100 ms`, held >= 8 && held <= 13, String(held));
                await page.mouse.up();
                await page.waitForTimeout(60); // an in-flight tick (input event round trip) may still land right after release
                const afterUp = await exerciseInput.inputValue();
                await page.waitForTimeout(400);
                check(`${tag}: hold stops on release`, (await exerciseInput.inputValue()) === afterUp, afterUp);

                box = await press();
                await page.waitForTimeout(700);
                await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 - 100);
                const left = await exerciseInput.inputValue();
                await page.waitForTimeout(500);
                check(`${tag}: hold stops when the pointer leaves`, (await exerciseInput.inputValue()) === left, left);
                await page.mouse.up();

                await press();
                await page.waitForTimeout(700);
                await up.evaluate((el) => el.blur());
                const blurred = await exerciseInput.inputValue();
                await page.waitForTimeout(500);
                check(`${tag}: hold stops on blur`, (await exerciseInput.inputValue()) === blurred, blurred);
                await page.mouse.up();
                await page.waitForTimeout(250);
            }

            await exerciseInput.fill("0:05");
            await exerciseInput.press("ArrowUp");
            check(`${tag}: ArrowUp +1`, (await exerciseInput.inputValue()) === "0:06");
            await page.waitForTimeout(500);
            const keyStatus = await c.locator("p.sr-only[role='status']").allTextContents();
            check(`${tag}: ArrowUp is announced by the status region`, keyStatus.includes("Exercise 0:06"), JSON.stringify(keyStatus));
            await exerciseInput.press("Shift+ArrowUp");
            check(`${tag}: Shift+ArrowUp +10`, (await exerciseInput.inputValue()) === "0:16");
            await exerciseInput.press("Shift+ArrowDown");
            await exerciseInput.press("Shift+ArrowDown");
            check(`${tag}: Shift+ArrowDown clamps at the minimum 0:01`, (await exerciseInput.inputValue()) === "0:01", await exerciseInput.inputValue());
            check(`${tag}: Decrease is aria-disabled, not disabled, at the minimum`, (await down.getAttribute("aria-disabled")) === "true" && (await down.getAttribute("disabled")) === null);
            await exerciseInput.fill("9:59");
            await exerciseInput.press("Shift+ArrowUp");
            check(`${tag}: Shift+ArrowUp clamps at 10:00 in m:ss`, (await exerciseInput.inputValue()) === "10:00", await exerciseInput.inputValue());
            check(`${tag}: Increase is aria-disabled at the maximum`, (await up.getAttribute("aria-disabled")) === "true");
            await exerciseInput.fill("");
            await up.dispatchEvent("click");
            check(`${tag}: empty value steps to the field minimum`, (await exerciseInput.inputValue()) === "0:01", await exerciseInput.inputValue());
            const repetitions = inputOf(c, FIELDS[3]);
            await repetitions.fill("100");
            check(`${tag}: Repetitions at 100: Increase aria-disabled`, (await stepButton(c, FIELDS[3], "Increase").getAttribute("aria-disabled")) === "true");
            await repetitions.press("ArrowDown");
            check(`${tag}: Repetitions ArrowDown gives a whole number`, (await repetitions.inputValue()) === "99", await repetitions.inputValue());

            await shot(page, c, join(here, `stepper-${tag}.png`));
            await context.close();
        }
    }
}

// Phase 5: seven states of the stepper fixtures x light/dark x 1280/390 x fine/coarse pointer.
const stepperCard = (page, fixture) => page.locator(`[data-testid="stepper-${fixture}"]`);
const STATE_SETUPS = [
    { name: "fine", options: {}, coarse: false },
    { name: "coarse", options: { hasTouch: true }, coarse: true },
];
const readButton = (locator) =>
    locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, color: style.color, cursor: style.cursor, opacity: style.opacity, ariaDisabled: el.getAttribute("aria-disabled"), disabled: el.hasAttribute("disabled") };
    });
const rowsAre44 = (c) => c.evaluate((root) => [...root.querySelectorAll("input[name]")].filter((i) => i.type === "text").map((i) => i.parentElement.getBoundingClientRect().height));

for (const setup of STATE_SETUPS) {
    for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
            const tag = `state-${setup.name}-${viewport.name}-${theme}`;
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ...setup.options, ...(setup.coarse && viewport.name === "390" ? { isMobile: true } : {}) });
            const page = await context.newPage();
            await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
            await page.waitForSelector('[data-testid="stepper-default"]');
            await page.waitForFunction(() => {
                const button = document.querySelector('[data-testid="stepper-default"] button[aria-label="Increase exercise by 1 second"]');
                return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
            });
            await page.waitForTimeout(1500);
            await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
            await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
            check(`${tag}: any-pointer matches the setup`, (await page.evaluate(() => matchMedia("(any-pointer: coarse)").matches)) === setup.coarse);

            // Layout invariants in every fixture: four rows of 44 px, no horizontal overflow.
            for (const fixture of ["default", "disabled-min", "disabled-max", "error", "loading"]) {
                const c = stepperCard(page, fixture);
                await c.scrollIntoViewIfNeeded();
                const heights = await rowsAre44(c);
                check(`${tag} ${fixture}: the four field rows are 44 px`, heights.length === 4 && heights.every((h) => Math.abs(h - 44) < 0.5), JSON.stringify(heights));
                check(`${tag} ${fixture}: card has no horizontal overflow`, await c.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= document.documentElement.clientWidth));
                const exercise = FIELDS[1];
                const [u, d] = [await rect(stepButton(c, exercise, "Increase")), await rect(stepButton(c, exercise, "Decrease"))];
                check(
                    `${tag} ${fixture}: arrow order and size follow the pointer`,
                    setup.coarse ? u.width === 44 && u.height === 44 && d.width === 44 && d.x < u.x : u.height === 22 && d.height === 22 && u.y < d.y,
                    JSON.stringify({ u, d }),
                );
            }

            // 1 default
            const def = stepperCard(page, "default");
            for (const field of FIELDS) {
                for (const dir of ["Increase", "Decrease"]) {
                    check(`${tag} default ${field.name} ${dir}: enabled`, (await stepButton(def, field, dir).getAttribute("aria-disabled")) === "false");
                }
            }
            await shot(page, def, join(here, `state-default-${setup.name}-${viewport.name}-${theme}.png`));

            // 2 hover: the arrow highlights, in both pointer layouts.
            const hoverTarget = stepButton(def, FIELDS[1], "Increase");
            await page.mouse.move(0, 0);
            await page.waitForTimeout(300);
            const idle = await readButton(hoverTarget);
            await hoverTarget.scrollIntoViewIfNeeded();
            await hoverTarget.hover();
            await page.waitForTimeout(400);
            const hovered = await readButton(hoverTarget);
            // Tailwind 4 gates hover: behind (hover: hover); a touch-only browser reports none, so no highlight sticks after a tap.
            const canHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
            check(
                `${tag} hover: ${canHover ? "the enabled arrow changes its background" : "N/A without (hover: hover), nothing sticks"}`,
                canHover ? idle.background !== hovered.background : idle.background === hovered.background,
                `${idle.background} -> ${hovered.background}`,
            );
            await shot(page, def, join(here, `state-hover-${setup.name}-${viewport.name}-${theme}.png`));
            await page.mouse.move(0, 0);

            // 3 focus-visible: belongs to the field (the arrows skip Tab).
            const exerciseInput = inputOf(def, FIELDS[1]);
            const unfocused = await exerciseInput.evaluate((el) => getComputedStyle(el).boxShadow);
            await page.keyboard.press("Tab");
            await exerciseInput.focus();
            await page.keyboard.press("ArrowUp");
            await page.waitForTimeout(250);
            const focused = await exerciseInput.evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, visible: el.matches(":focus-visible") }));
            check(`${tag} focus-visible: the field shows a ring`, focused.visible && focused.shadow !== "none" && focused.shadow !== unfocused, JSON.stringify({ unfocused, focused }));
            check(`${tag} focus-visible: the arrows are not tab stops (N/A for the arrows)`, (await stepButton(def, FIELDS[1], "Increase").getAttribute("tabindex")) === "-1");
            await shot(page, def, join(here, `state-focus-visible-${setup.name}-${viewport.name}-${theme}.png`));
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
                    check(`${tag} ${fixture} ${field.name}: ${blocked} is aria-disabled, not disabled, dimmed`, before.ariaDisabled === "true" && !before.disabled && Number(before.opacity) < 1, JSON.stringify(before));
                    check(
                        `${tag} ${fixture} ${field.name}: ${blocked} keeps color, background and not-allowed on hover`,
                        before.color === after.color && before.background === after.background && after.cursor === "not-allowed",
                        JSON.stringify({ before, after }),
                    );
                    await target.dispatchEvent("click");
                    check(`${tag} ${fixture} ${field.name}: click on the blocked arrow changes nothing`, (await inputOf(c, field).inputValue()) === expected[field.name], await inputOf(c, field).inputValue());
                    check(`${tag} ${fixture} ${field.name}: ${open} stays enabled`, (await stepButton(c, field, open).getAttribute("aria-disabled")) === "false");
                }
                await page.mouse.move(0, 0);
                await shot(page, c, join(here, `state-disabled-${fixture.replace("disabled-", "")}-${setup.name}-${viewport.name}-${theme}.png`));
            }

            // 5 error: invalid values show errors after Start, the first arrow press steps to the field minimum and clears the error.
            const err = stepperCard(page, "error");
            await err.scrollIntoViewIfNeeded();
            await err.getByRole("button", { name: "Start" }).click();
            await page.waitForTimeout(250);
            check(`${tag} error: four validation alerts`, (await err.locator("p[role='alert']").count()) === 4, String(await err.locator("p[role='alert']").count()));
            check(`${tag} error: inputs are aria-invalid`, (await err.locator("input[aria-invalid='true']").count()) === 4);
            check(`${tag} error: Start did not run`, (await err.locator("[data-evidence='start-calls']").textContent()) === "0");
            check(`${tag} error: no arrow is aria-disabled for an invalid value`, (await err.locator("button[aria-label*=' by 1'][aria-disabled='true']").count()) === 0);
            await shot(page, err, join(here, `state-error-${setup.name}-${viewport.name}-${theme}.png`));
            const minimum = { preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1" };
            for (const field of FIELDS) {
                await stepButton(err, field, "Increase").dispatchEvent("click");
                check(`${tag} error ${field.name}: first press gives the minimum`, (await inputOf(err, field).inputValue()) === minimum[field.name], await inputOf(err, field).inputValue());
            }
            check(`${tag} error: the alerts clear once the values are valid`, (await err.locator("p[role='alert']").count()) === 0);

            // 6 empty: not a separate state. The form always has values; an emptied field is the error state above.
            check(`${tag} empty: N/A (an emptied field is the error state)`, true, "justified in plan: formularz zawsze ma wartości");

            // 7 loading: pending submit, arrows still usable.
            const load = stepperCard(page, "loading");
            await load.scrollIntoViewIfNeeded();
            const submit = load.getByRole("button", { name: "Start" });
            check(`${tag} loading: submit is disabled and busy`, (await submit.isDisabled()) && (await submit.getAttribute("aria-busy")) === "true");
            await stepButton(load, FIELDS[1], "Increase").dispatchEvent("click");
            check(`${tag} loading: the arrows still step`, (await inputOf(load, FIELDS[1]).inputValue()) === "0:05", await inputOf(load, FIELDS[1]).inputValue());
            await shot(page, load, join(here, `state-loading-${setup.name}-${viewport.name}-${theme}.png`));

            await context.close();
        }
    }
}

// Regression of phases 1 and 2 on the same page: the link on /create and the Current box.
const createApp = readFileSync(join(here, "../../../../src/components/timer/DrillCreateApp.tsx"), "utf8");
check("A3.7: DrillCreateApp links to /timers", /href="\/timers"/.test(createApp) && /Back to timers/.test(createApp) && !/Back to the timer/.test(createApp));

await browser.close();
writeFileSync(join(here, "ux-fixes-round-2-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: checks.filter((c) => !c.ok).length, checks }, null, 2));
const failed = checks.filter((c) => !c.ok).length;
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
