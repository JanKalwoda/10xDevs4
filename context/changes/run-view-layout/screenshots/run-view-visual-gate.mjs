// Visual gate for S-18 (script, not human): run view layout on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node run-view-visual-gate.mjs
// Writes screenshots next to this file and run-view-checks.json with every assertion result.
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
const SECTION = 'section[aria-label="Current drill phase"]';
const checks = [];
const check = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
    if (!ok) console.error(`FAIL ${name} ${detail}`);
};

const browser = await chromium.launch();
for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        const tag = `${viewport.name}-${theme}`;
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.goto(`${BASE_URL}/dev/timer-ui`, { waitUntil: "networkidle" });
        await page.waitForSelector(`[data-testid="sections-two-warnings"] ${SECTION}`);
        await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
        await page.evaluate((t) => {
            document.documentElement.classList.toggle("dark", t === "dark");
        }, theme);

        // Every phase-state fixture card that renders one run section (sections-* and timer-*-fixture).
        const cards = page.locator('[data-testid^="sections-"], [data-testid^="timer-"][data-testid$="-fixture"]').filter({ has: page.locator(SECTION) });
        const count = await cards.count();
        check(`${tag}: fixture cards found`, count >= 16, `count=${count}`);

        const rows = [];
        for (let i = 0; i < count; i++) {
            const card = cards.nth(i);
            const id = await card.getAttribute("data-testid");
            const data = await card.evaluate((el, sel) => {
                const section = el.querySelector(sel);
                const top = section.getBoundingClientRect().top;
                const buttons = [...section.querySelectorAll("button")].filter((b) =>
                    /Cancel drill|Restart drill|Pause drill|Resume|Timer is starting/.test(b.getAttribute("aria-label") ?? ""),
                );
                const timer = section.querySelector('[role="timer"]');
                const paragraphs = [...section.querySelectorAll("p")];
                const standby = paragraphs.find((p) => p.textContent === "Standby" && !p.closest('[role="group"]'));
                const main = timer ?? standby ?? null;
                const rep = paragraphs.find((p) => /^Repetition \d+ of \d+$/.test(p.textContent ?? ""));
                const h2 = section.querySelector("h2");
                const group = section.querySelector('[role="group"][aria-label="Next phase"]');
                const follows = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
                const sr = section.getBoundingClientRect();
                let overflowChild = false;
                for (const child of section.querySelectorAll("*")) {
                    const r = child.getBoundingClientRect();
                    if (r.width && (r.right > sr.right + 0.5 || r.left < sr.left - 0.5)) overflowChild = true;
                }
                return {
                    buttonTops: buttons.map((b) => Math.round((b.getBoundingClientRect().top - top) * 100) / 100),
                    buttonCount: buttons.length,
                    order: (main ? follows(main, rep) : true) && follows(rep, h2) && follows(h2, group),
                    hasMain: !!main,
                    repOutsideTimer: !!rep && !timer?.contains(rep),
                    timerHasOnlyTime: timer ? !/Repetition/.test(timer.textContent ?? "") : true,
                    repPresent: !!rep,
                    repText: rep?.textContent ?? null,
                    sectionOverflow: section.scrollWidth > section.clientWidth || overflowChild,
                };
            }, SECTION);
            rows.push({ id, ...data });
        }
        const baseline = rows.find((r) => r.id === "sections-preparation-exercise").buttonTops[0];
        for (const r of rows) {
            check(`${tag} ${r.id}: three bar buttons`, r.buttonCount === 3, `count=${r.buttonCount}`);
            check(`${tag} ${r.id}: button top equals baseline`, r.buttonTops.every((t) => t === r.buttonTops[0]) && r.buttonTops[0] === baseline, `tops=${r.buttonTops} baseline=${baseline}`);
            check(`${tag} ${r.id}: repetition present and outside role=timer`, r.repPresent && r.repOutsideTimer && r.timerHasOnlyTime, `rep=${r.repText}`);
            check(`${tag} ${r.id}: DOM order time -> repetition -> Current -> Next`, r.order, `hasMain=${r.hasMain}`);
            check(`${tag} ${r.id}: no horizontal overflow inside run section`, !r.sectionOverflow);
        }
        const byId = (id) => rows.find((r) => r.id === id);
        check(`${tag}: longest values show Repetition 10 of 10`, byId("sections-longest-values").repText === "Repetition 10 of 10", String(byId("sections-longest-values").repText));
        check(`${tag}: Preparation shows the upcoming repetition`, byId("sections-preparation-exercise").repText === "Repetition 1 of 3", String(byId("sections-preparation-exercise").repText));
        check(`${tag}: Standby shows repetition outside the time`, byId("sections-standby-exercise").repPresent && byId("sections-standby-exercise").repOutsideTimer);

        // Screenshots: whole fixtures region, the stress cards, interaction states.
        await page.locator('section[aria-label="Phase sections examples"]').screenshot({ path: join(here, `sections-${tag}.png`) });
        await page.locator('[data-testid="sections-two-warnings"]').screenshot({ path: join(here, `error-two-warnings-${tag}.png`) });
        await page.locator('[data-testid="sections-longest-values"]').screenshot({ path: join(here, `default-longest-${tag}.png`) });
        await page.locator('[data-testid="sections-initializing"]').screenshot({ path: join(here, `loading-${tag}.png`) });
        const target = page.locator('[data-testid="sections-exercise-rest"]');
        await target.getByRole("button", { name: "Pause drill" }).hover();
        await target.screenshot({ path: join(here, `hover-pause-${tag}.png`) });
        await page.mouse.move(0, 0);
        for (const name of ["Cancel drill", "Restart drill", "Pause drill"]) {
            const button = target.getByRole("button", { name });
            await button.focus();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            const focused = await button.evaluate((b) => b === document.activeElement && b.matches(":focus-visible"));
            check(`${tag}: ${name} shows :focus-visible`, focused);
            await target.screenshot({ path: join(here, `focus-${name.split(" ")[0].toLowerCase()}-${tag}.png`) });
        }
        const disabled = page.locator('[data-testid="sections-initializing"]').getByRole("button", { name: "Timer is starting" });
        check(`${tag}: initializing right slot is disabled`, await disabled.isDisabled());
        await page.close();
    }
}
await browser.close();
writeFileSync(join(here, "run-view-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: checks.filter((c) => !c.ok).length, checks }, null, 2));
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
