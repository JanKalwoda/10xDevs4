// Visual gate for the `retry` state of /auth/callback (fix-auth-error-visibility, impl-review F4).
// Run `npm run dev` (BASE defaults to http://localhost:4321), then:
//   PLAYWRIGHT_PATH=<directory that contains node_modules/playwright> OUT=<this folder> node callback-retry-visual-gate.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire((process.env.PLAYWRIGHT_PATH ?? process.cwd()).replace(/\/?$/, "/"));
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE ?? "http://localhost:4321";
const OUT = process.env.OUT ?? path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const FOCUS = "main a";

const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};

const browser = await chromium.launch();
const checks = [];
for (const theme of ["light", "dark"]) {
    for (const width of [1280, 390]) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 1280 ? 800 : 844 }, colorScheme: theme });
        await ctx.addInitScript((t) => {
            try {
                localStorage.setItem("drill-timer-theme", t);
            } catch {
                /* storage unavailable */
            }
        }, theme);
        const page = await ctx.newPage();
        const res = await page.goto(`${BASE}/auth/callback?error=invalid&next=%2Ftimers`, { waitUntil: "networkidle", timeout: 120000 });
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press("Tab");
            if (await page.evaluate((sel) => document.activeElement === document.querySelector(sel), FOCUS)) break;
        }
        await page.waitForTimeout(400);
        const info = await page.evaluate(() => {
            const cv = document.createElement("canvas").getContext("2d");
            const rgb = (c) => {
                cv.clearRect(0, 0, 1, 1);
                cv.fillStyle = "#000";
                cv.fillStyle = c;
                cv.fillRect(0, 0, 1, 1);
                return Array.from(cv.getImageData(0, 0, 1, 1).data).slice(0, 3);
            };
            const el = document.activeElement;
            const card = document.querySelector("main > *");
            const p = document.querySelector("[data-slot=card-description]");
            return {
                focusText: el?.textContent?.trim(),
                focusRing: getComputedStyle(el).boxShadow,
                overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                h1: document.querySelector("h1")?.textContent,
                linkColor: rgb(getComputedStyle(el).color),
                descColor: p ? rgb(getComputedStyle(p).color) : null,
                cardBg: rgb(getComputedStyle(card).backgroundColor),
            };
        });
        checks.push({
            name: "callback-retry",
            theme,
            width,
            status: res.status(),
            focusText: info.focusText,
            focusRing: info.focusRing,
            overflowX: info.overflowX,
            h1: info.h1,
            contrast: { link: +ratio(info.linkColor, info.cardBg).toFixed(2), description: info.descColor ? +ratio(info.descColor, info.cardBg).toFixed(2) : null },
        });
        await page.screenshot({ path: path.join(OUT, `callback-retry-${width}-${theme}.png`), fullPage: true });
        await ctx.close();
    }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "checks-callback-retry.json"), JSON.stringify(checks, null, 4) + "\n");
console.log(JSON.stringify(checks.map(({ theme, width, status, overflowX, contrast, focusText }) => ({ theme, width, status, overflowX, contrast, focusText }))));
