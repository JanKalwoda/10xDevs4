import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint, Linter } from "eslint";
import contract from "./account-entry-ui-contract.mjs";

const linter = new Linter();
const config = {
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { account: { rules: { contract } } },
    rules: { "account/contract": "error" },
};

test("account-entry contract rejects palette and arbitrary view styles while accepting semantic tokens", () => {
    for (const source of ['<a className="text-purple-300" />', '<div className="bg-[#112233]" />', '<div className="p-[13px]" />', '<div style={{ color: "red" }} />']) {
        assert.ok(
            linter.verify(source, config).some((message) => message.ruleId === "account/contract"),
            source,
        );
    }

    for (const source of [
        '<a className="bg-card text-foreground border-border focus-visible:ring-ring px-4 rounded-lg" />',
        '<a className="text-muted-foreground hover:text-foreground" />',
    ]) {
        assert.deepEqual(linter.verify(source, config), [], source);
    }
});

test("the repository lint configuration protects account-entry views and root navigation", async () => {
    const eslint = new ESLint();
    for (const filePath of [
        "src/components/auth/SignInForm.tsx",
        "src/pages/auth/signin.astro",
        "src/pages/auth/confirm-email.astro",
        "src/pages/auth/callback.astro",
        "src/pages/index.astro",
    ]) {
        const result = await eslint.calculateConfigForFile(filePath);
        assert.equal(result.rules["account-entry-ui/contract"][0], 2, filePath);
    }

    const result = await eslint.lintText('<a class="text-purple-300" />', { filePath: "src/pages/auth/signin.astro" });
    assert.ok(result[0].messages.some((message) => message.ruleId === "account-entry-ui/contract"));
});
