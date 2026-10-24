import assert from "node:assert/strict";
import test from "node:test";

import { buildSentryServerOptions } from "./sentry-server-options.ts";

interface Integration {
    name: string;
    maxRequestBodySize?: string;
}

function resolveIntegrations(defaults: Integration[]): Integration[] {
    const { integrations } = buildSentryServerOptions({ dsn: "", release: undefined });
    assert.equal(typeof integrations, "function");
    return (integrations as (defaults: Integration[]) => Integration[])(defaults);
}

void test("exactly one HttpServer integration, and it attaches no request bodies", () => {
    const resolved = resolveIntegrations([{ name: "Dedupe" }, { name: "HttpServer", maxRequestBodySize: "medium" }, { name: "Hono" }]);
    const httpServer = resolved.filter((integration) => integration.name === "HttpServer");
    assert.equal(httpServer.length, 1);
    assert.equal(httpServer[0].maxRequestBodySize, "none");
});

void test("HttpServer is added even when the defaults lack it", () => {
    const resolved = resolveIntegrations([{ name: "Dedupe" }]);
    assert.equal(resolved.filter((integration) => integration.name === "HttpServer").length, 1);
});

void test("the other default integrations and CaptureConsole are kept", () => {
    const names = resolveIntegrations([{ name: "Dedupe" }, { name: "HttpServer" }]).map((integration) => integration.name);
    assert.ok(names.includes("Dedupe"));
    assert.ok(names.includes("CaptureConsole"));
});

void test("dsn and release pass through", () => {
    const options = buildSentryServerOptions({ dsn: "https://key@example.invalid/1", release: "v1" });
    assert.equal(options.dsn, "https://key@example.invalid/1");
    assert.equal(options.release, "v1");
});
