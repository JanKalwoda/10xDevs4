import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local E2E variables (E2E_USERNAME, MAILPIT_URL, optional E2E_PORT) come from the gitignored .env.e2e.
// Never load .env here: it may hold production Supabase values. The preview reads its own .dev.vars (local stack).
// In CI the file is absent and the variables come from the job.
if (existsSync(".env.e2e")) process.loadEnvFile(".env.e2e");

// 4321 is the default port of `astro preview` (astro.config.mjs and the preview script set none).
// E2E_PORT overrides it when that port is taken on this machine.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "setup", testMatch: /.*\.setup\.ts/ },
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
            dependencies: ["setup"],
        },
    ],
    webServer: {
        // Production-like build + preview (Cloudflare runtime), on the port above.
        command: `npm run build && npm run preview -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // Astro 7 moves `astro preview` into a background daemon when it detects an AI agent; keep it in the foreground.
        env: { ASTRO_PREVIEW_BACKGROUND: "1" },
    },
});
