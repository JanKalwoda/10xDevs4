// Stop: sweep everything this turn changed before the agent finishes; one retry only.
// Re-lints every changed file (also files rewritten through Bash, which never reach the
// per-edit hooks), runs the whole unit suite (~7 s), then the project typecheck.
import path from "node:path";
import {
    block,
    clearRegistry,
    clip,
    git,
    isFile,
    LINT_EXTENSIONS,
    MissingToolError,
    payloadCwd,
    readPayload,
    registeredRoots,
    run,
    runPackageBin,
    toplevel,
    uniqueRoots,
} from "./lib/hook-utils.mjs";

const CONFIG_FILES = new Set(["package.json", "package-lock.json", "tsconfig.json", "eslint.config.js", "astro.config.mjs"]);
const HOOK_TEST = "scripts/agent-hooks.test.mjs";

const payload = readPayload();

// Already sent back once by this hook: let it finish. The commit gate and CI catch the rest.
// (loop_count covers Cursor, which imports hooks from .claude/settings.json.)
if (payload.stop_hook_active === true || Number(payload.loop_count) > 0) process.exit(0);

// The session checkout (payload cwd follows EnterWorktree, $CLAUDE_PROJECT_DIR does not)
// plus every checkout the per-edit hooks registered for this session.
const roots = uniqueRoots([toplevel(payloadCwd(payload)), ...registeredRoots(payload)]);
if (roots.length === 0) {
    process.stdout.write(`${JSON.stringify({ systemMessage: `end-of-turn.mjs: no git checkout at ${payloadCwd(payload)}, nothing checked.` })}\n`);
    process.exit(0);
}

const sections = [];
const report = (title, root, output) => sections.push(`${title} (${root}):\n${clip(output)}`);

function sweep(root) {
    const listed = [git(root, ["diff", "--name-only", "HEAD"]), git(root, ["ls-files", "-o", "--exclude-standard"])];
    const changed = [
        ...new Set(
            listed
                .filter(Boolean)
                .flatMap((out) => out.split(/\r?\n/))
                .filter(Boolean),
        ),
    ];
    const existing = changed.filter((f) => isFile(path.join(root, f)));
    const code = existing.filter((f) => LINT_EXTENSIONS.has(path.extname(f).toLowerCase()));
    const config = changed.some((f) => CONFIG_FILES.has(f));
    // Nothing that lint, tests or types read changed (a Q&A turn, docs only): nothing to check.
    if (code.length === 0 && !config) return;

    if (code.length > 0) {
        const lint = runPackageBin(root, "eslint/bin/eslint.js", ["--quiet", "--no-warn-ignored", ...code]);
        if (!lint.ok) report("ESLint errors in changed files", root, lint.output);
    }

    // The whole unit suite runs in seconds, so it also catches a red test in a module this turn only imported.
    // One command string: npm is npm.cmd on Windows, and shell + an args array is deprecated (DEP0190).
    const unit = run("npm test --silent", [], root, { shell: true });
    if (!unit.ok) report("Unit tests fail (npm test)", root, unit.output);

    if (changed.some((f) => f.startsWith("scripts/eslint-rules/"))) {
        const ruleTests = (git(root, ["ls-files", "--", ":(glob)scripts/eslint-rules/*.test.mjs"]) ?? "").split(/\r?\n/).filter(Boolean);
        if (ruleTests.length > 0) {
            const rules = run(process.execPath, ["--test", "--test-reporter=spec", ...ruleTests], root);
            if (!rules.ok) report("ESLint contract rule tests fail", root, rules.output);
        }
    }

    if (isFile(path.join(root, HOOK_TEST)) && changed.some((f) => f.startsWith(".claude/hooks/") || f === HOOK_TEST || f === ".claude/settings.json")) {
        const hooks = run(process.execPath, ["--test", "--test-reporter=spec", HOOK_TEST], root);
        if (!hooks.ok) report("Agent hook tests fail", root, hooks.output);
    }

    // .astro/ is gitignored, so regenerate the astro:* types here when a checkout lacks them.
    if (isFile(path.join(root, "astro.config.mjs")) && !isFile(path.join(root, ".astro", "types.d.ts"))) {
        const sync = runPackageBin(root, "astro/bin/astro.mjs", ["sync"]);
        if (!sync.ok) report("astro sync failed, so the typecheck cannot be trusted", root, sync.output);
    }
    const tsc = runPackageBin(root, "typescript/bin/tsc", ["--noEmit", "--pretty", "false"]);
    if (!tsc.ok) {
        const title = /error TS\d+/.test(tsc.output) ? "Typecheck fails (tsc --noEmit)" : "Typecheck could not run (tsc --noEmit)";
        report(title, root, tsc.output);
    }

    // tsc does not read .astro files; astro check (~50 s) does, so run it only when one changed.
    if (code.some((f) => f.endsWith(".astro"))) {
        const astro = runPackageBin(root, "astro/bin/astro.mjs", ["check"]);
        if (!astro.ok) report("astro check fails", root, astro.output);
    }
}

for (const root of roots) {
    try {
        sweep(root);
    } catch (error) {
        if (!(error instanceof MissingToolError)) throw error;
        report("A check could not run", root, error.message);
    }
}

if (sections.length > 0) block(`Fix these before you finish:\n\n${sections.join("\n\n")}`);
// Green: the registered checkouts are clean, start the next turn with an empty registry.
clearRegistry(payload);
