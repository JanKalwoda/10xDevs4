// @ts-check
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import sentry from "@sentry/astro";
import process from "node:process";
import { loadEnv } from "vite";

// Read SENTRY_AUTH_TOKEN from .env locally and from the process environment in CI (source map upload).
const { SENTRY_AUTH_TOKEN } = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "SENTRY_");

// https://astro.build/config
export default defineConfig({
    site: "https://drill-me.twincoder.workers.dev",
    output: "server",
    integrations: [
        react(),
        sitemap(),
        sentry({
            // The server side runs @sentry/cloudflare in src/middleware.ts: the Node transport of @sentry/astro silently drops events on Workers.
            enabled: { client: true, server: false },
            org: "twincoder",
            project: "10xdevs4",
            authToken: SENTRY_AUTH_TOKEN,
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
    adapter: cloudflare({ imageService: "compile" }),
    env: {
        schema: {
            SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
            SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
        },
    },
});
