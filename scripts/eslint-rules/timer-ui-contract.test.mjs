import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint, Linter } from "eslint";
import contract from "./timer-ui-contract.mjs";

const linter = new Linter();
const config = {
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { timer: { rules: { contract } } },
    rules: { "timer/contract": "error" },
};

test("contract rejects palettes, dimensions and inline colors while accepting tokens/scale", () => {
    const bad = [
        '<div className="dark:hover:bg-blue-500/20" />',
        '<div className="accent-blue-600" />',
        '<div className="border-t-blue-500 ring-offset-blue-500" />',
        '<div className="-mt-[13px] translate-x-[13px]" />',
        '<div className="text-white" />',
        '<div className="w-[123px] p-[1rem] text-[18px]" />',
        '<div className="bg-[#ff0000]" />',
        '<div className="grid-cols-[1fr_auto]" />',
        '<div style={{ color: "red" }} />',
        '<div style={{ color: "cyan" }} />',
        '<div style={{ color: "coral" }} />',
        '<div style={{ border: "1px solid red" }} />',
        '<div style={{ background: "linear-gradient(coral, cyan)" }} />',
        '<div style={{ color: "var(--foreground, red)" }} />',
        '<div style={{ background: "linear-gradient(var(--foreground, coral), var(--background))" }} />',
        '<div className="w-[calc(var(--spacing)+13px)]" />',
        '<div style={{ backgroundColor: "rgb(1,2,3)" }} />',
        '<div style={{ borderColor: "#abcdef" }} />',
        'const classes = `focus:text-purple-200 ${true ? "p-4" : "p-2"}`;',
    ];
    for (const source of bad)
        assert.ok(
            linter.verify(source, config).some((message) => message.ruleId === "timer/contract"),
            source,
        );
    const good = [
        '<div className="bg-card text-card-foreground bg-primary/90 dark:bg-input/30 ring-2 px-4 rounded-xl text-6xl size-3.5" />',
        '<div className="data-[state=checked]:bg-primary [&>svg]:size-4 transition-[color,box-shadow]" />',
        '<div style={{ color: "var(--foreground)" }} />',
        '<div style={{ color: "var(--red)" }} />',
        '<div className="w-[var(--timer-width)]" />',
    ];
    for (const source of good) assert.deepEqual(linter.verify(source, config), [], source);
});

test("actual ESLint configuration enforces React/Astro timer scope and leaves account scope alone", async () => {
    const eslint = new ESLint();
    for (const filePath of ["src/components/timer/DrillApp.tsx", "src/pages/index.astro", "src/pages/dev/timer-ui.astro", "src/components/ui/input.tsx"]) {
        const source = filePath.endsWith(".astro")
            ? '<div class="accent-blue-600" style="color: red" />'
            : 'export default function Example() { return <div className="accent-blue-600" />; }';
        const results = await eslint.lintText(source, { filePath });
        assert.ok(
            results[0].messages.some((message) => message.ruleId === "timer-ui/contract"),
            filePath,
        );
    }
    const account = await eslint.calculateConfigForFile("src/pages/auth/signin.astro");
    assert.equal(account.rules["timer-ui/contract"], undefined);
    for (const source of ['<div style="color: cyan" />', '<div style="border: 1px solid red" />']) {
        const results = await eslint.lintText(source, { filePath: "src/pages/index.astro" });
        assert.ok(
            results[0].messages.some((message) => message.ruleId === "timer-ui/contract"),
            source,
        );
    }
});

// In minimatch "[id]" is a character class, so a glob written as src/pages/[id].astro silently matches nothing.
test("dynamic route files [id].astro and [id]/edit.astro are really under the timer UI contract", async () => {
    const eslint = new ESLint();
    for (const filePath of ["src/pages/[id].astro", "src/pages/[id]/edit.astro"]) {
        const config = await eslint.calculateConfigForFile(filePath);
        assert.equal(config.rules["timer-ui/contract"]?.[0], 2, `${filePath} must have timer-ui/contract enabled`);

        const results = await eslint.lintText('<div class="accent-blue-600" style="color: red" />', { filePath });
        assert.ok(
            results[0].messages.some((message) => message.ruleId === "timer-ui/contract"),
            filePath,
        );
    }
});
