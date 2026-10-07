import { fixupPluginRules } from "@eslint/compat";
import eslint from "@eslint/js";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import pluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import tseslint from "typescript-eslint";
import accountEntryUiContract from "./scripts/eslint-rules/account-entry-ui-contract.mjs";
import timerUiContract from "./scripts/eslint-rules/timer-ui-contract.mjs";

// eslint-plugin-react still uses context APIs removed in ESLint 10; wrap it until it ships native support.
const reactPlugin = fixupPluginRules(pluginReact);

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const baseConfig = defineConfig({
    extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },
    rules: {
        "no-console": "warn",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
                destructuredArrayIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
        "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
});

const reactConfig = defineConfig({
    files: ["**/*.{js,jsx,ts,tsx}"],
    extends: [eslintPluginReactHooks.configs.flat["recommended-latest"]],
    plugins: { react: reactPlugin },
    languageOptions: {
        ...pluginReact.configs.flat.recommended.languageOptions,
        globals: {
            window: true,
            document: true,
        },
    },
    settings: { react: { version: "detect" } },
    rules: {
        ...pluginReact.configs.flat.recommended.rules,
        "react/react-in-jsx-scope": "off",
    },
});

const astroConfig = defineConfig({
    files: ["**/*.astro"],
    languageOptions: {
        // astro-eslint-parser does not support projectService yet and warns on every file; hand it a project path instead.
        parserOptions: { projectService: false, project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
    },
    rules: {
        "astro/no-set-html-directive": "error",
        "astro/no-unused-css-selector": "warn",
        "astro/prefer-class-list-directive": "warn",
    },
});

const scriptsConfig = defineConfig({
    files: ["scripts/**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { console: true, process: true, fetch: true, URLSearchParams: true } },
    rules: { "no-console": "off" },
});

export default defineConfig(
    includeIgnoreFile(gitignorePath),
    globalIgnores([".agents/**"]),
    baseConfig,
    reactConfig,
    eslintPluginAstro.configs["flat/recommended"],
    eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
    astroConfig,
    scriptsConfig,
    {
        files: [
            "src/components/auth/SignInForm.tsx",
            "src/pages/auth/signin.astro",
            "src/pages/auth/confirm-email.astro",
            "src/pages/auth/callback.astro",
            "src/pages/index.astro",
        ],
        plugins: { "account-entry-ui": { rules: { contract: accountEntryUiContract } } },
        rules: { "account-entry-ui/contract": "error" },
    },
    {
        files: [
            "src/components/timer/**/*.{ts,tsx}",
            "src/pages/index.astro",
            "src/pages/create.astro",
            "src/pages/dashboard.astro",
            // In minimatch "[id]" is a character class, so the literal brackets of the dynamic routes are escaped as "[[]id[]]".
            "src/pages/[[]id[]].astro",
            "src/pages/[[]id[]]/edit.astro",
            "src/pages/404.astro",
            "src/pages/dev/timer-ui.astro",
            "src/components/ui/{input,label,checkbox,card,alert}.tsx",
        ],
        plugins: { "timer-ui": { rules: { contract: timerUiContract } } },
        rules: { "timer-ui/contract": "error" },
    },
    eslintPluginPrettier,
);
