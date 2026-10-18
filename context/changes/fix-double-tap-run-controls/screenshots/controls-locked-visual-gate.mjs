// Visual gate for fix-double-tap-run-controls: "Controls locked" fixtures on /dev/timer-ui.
// Usage: BASE_URL=http://localhost:4321 PLAYWRIGHT_PATH=<dir with node_modules/playwright> node controls-locked-visual-gate.mjs
// Writes screenshots next to this file and controls-locked-checks.json.
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
const FIXTURES = ["timer-exercise-fixture", "timer-controls-locked-active-fixture", "timer-controls-locked-paused-fixture"];
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
        await page.waitForSelector('[data-testid="timer-controls-locked-active-fixture"]');
        await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
        await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);

        const tops = {};
        for (const id of FIXTURES) {
            const card = page.locator(`[data-testid="${id}"]`);
            await card.scrollIntoViewIfNeeded();
            const data = await card.evaluate((el) => {
                const top = el.getBoundingClientRect().top;
                const byName = (re) => [...el.querySelectorAll("button")].find((b) => re.test(b.getAttribute("aria-label") ?? ""));
                const info = (b) =>
                    b
                        ? {
                              ariaDisabled: b.getAttribute("aria-disabled"),
                              disabled: b.disabled,
                              opacity: getComputedStyle(b).opacity,
                              pointerEvents: getComputedStyle(b).pointerEvents,
                              top: Math.round((b.getBoundingClientRect().top - top) * 100) / 100,
                          }
                        : null;
                return { cancel: info(byName(/Cancel drill/)), restart: info(byName(/Restart drill/)), toggle: info(byName(/Pause drill|Resume/)) };
            });
            tops[id] = [data.cancel?.top, data.restart?.top, data.toggle?.top];
            const locked = id.includes("locked");
            check(
                `${tag} ${id}: Cancel never aria-disabled and fully opaque`,
                data.cancel && data.cancel.ariaDisabled === null && !data.cancel.disabled && data.cancel.opacity === "1",
                JSON.stringify(data.cancel),
            );
            for (const key of ["restart", "toggle"]) {
                const b = data[key];
                check(
                    `${tag} ${id}: ${key} ${locked ? "locked (aria-disabled, dimmed, no pointer)" : "active"}`,
                    b && (locked ? b.ariaDisabled === "true" && b.opacity === "0.5" && b.pointerEvents === "none" && !b.disabled : b.ariaDisabled === null && b.opacity === "1"),
                    JSON.stringify(b),
                );
            }
            await card.screenshot({ path: join(here, `${id.replace(/^timer-|-fixture$/g, "")}-${tag}.png`) });
        }
        const base = tops["timer-exercise-fixture"].join();
        for (const id of FIXTURES) check(`${tag} ${id}: bar does not move vs. active baseline`, tops[id].join() === base, `${tops[id]} vs ${base}`);
        await page.close();
    }
}
await browser.close();
writeFileSync(join(here, "controls-locked-checks.json"), JSON.stringify({ baseUrl: BASE_URL, failed: checks.filter((c) => !c.ok).length, checks }, null, 2));
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
