// Proof for the Claude Code hooks in .claude/hooks/ (configured in .claude/settings.json).
// Every case pipes a payload into the real script, inside a throwaway git repository that holds
// a copy of the hooks and stub binaries (eslint, tsc) which flag a marker, plus a real
// node --test suite. Run: npm run test:hooks
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SETTINGS = JSON.parse(readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"));
const TEMP = mkdtempSync(path.join(os.tmpdir(), "agent-hooks-test-"));
after(() => rmSync(TEMP, { recursive: true, force: true }));

const ENV = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
delete ENV.NODE_TEST_CONTEXT;

const ESLINT_STUB = `
const fs = require("node:fs");
let failed = false;
for (const f of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
  if (fs.readFileSync(f, "utf8").includes("LINT_ERROR")) { console.log(f + ":1:1 error  LINT_ERROR marker  no-marker"); failed = true; }
}
process.exit(failed ? 1 : 0);
`;
const TSC_STUB = `
const fs = require("node:fs");
const path = require("node:path");
let failed = false;
for (const f of fs.readdirSync("src/lib")) {
  if (fs.readFileSync(path.join("src/lib", f), "utf8").includes("TYPE_ERROR")) { console.log("src/lib/" + f + "(1,1): error TS2322: TYPE_ERROR marker"); failed = true; }
}
process.exit(failed ? 1 : 0);
`;

function sh(cwd, command, args) {
    const result = spawnSync(command, args, { cwd, encoding: "utf8", env: ENV });
    assert.equal(result.status, 0, `${command} ${args.join(" ")} failed: ${result.stderr}`);
    return result.stdout.trim();
}

let counter = 0;
/** A fresh repository: clean, committed, with the hooks, stub linters and one real unit test. */
function makeRepo() {
    const root = path.join(TEMP, `repo-${++counter}`);
    mkdirSync(path.join(root, "src", "lib"), { recursive: true });
    cpSync(path.join(REPO_ROOT, ".claude", "hooks"), path.join(root, ".claude", "hooks"), { recursive: true });
    cpSync(path.join(REPO_ROOT, ".claude", "settings.json"), path.join(root, ".claude", "settings.json"));
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test src/lib/*.test.ts" } }));
    writeFileSync(path.join(root, "README.md"), "# fixture\n");
    writeFileSync(path.join(root, "src", "lib", "math.ts"), "export const add = (a: number, b: number) => a + b;\n");
    writeFileSync(
        path.join(root, "src", "lib", "math.test.ts"),
        'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "./math.ts";\n\ntest("add", () => assert.equal(add(1, 2), 3));\n',
    );
    for (const [bin, body] of [
        ["eslint/bin/eslint.js", ESLINT_STUB],
        ["typescript/bin/tsc", TSC_STUB],
    ]) {
        const file = path.join(root, "node_modules", ...bin.split("/"));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, body);
    }
    writeFileSync(path.join(root, "node_modules", "package.json"), JSON.stringify({ type: "commonjs" }));
    sh(root, "git", ["init", "-q", "-b", "main"]);
    sh(root, "git", ["add", "."]);
    sh(root, "git", ["-c", "user.name=hook-test", "-c", "user.email=hook-test@example.invalid", "commit", "-qm", "fixture"]);
    return root;
}

function hook(repo, name, payload, env = {}) {
    const input = typeof payload === "string" ? payload : JSON.stringify(payload);
    const result = spawnSync(process.execPath, [path.join(repo, ".claude", "hooks", name)], {
        cwd: repo,
        input,
        encoding: "utf8",
        env: { ...ENV, ...env },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const edit = (repo, file, extra = {}) => ({ hook_event_name: "PostToolUse", tool_name: "Edit", cwd: repo, tool_input: { file_path: file }, ...extra });
const stop = (repo, extra = {}) => ({ hook_event_name: "Stop", cwd: repo, stop_hook_active: false, ...extra });
const write = (repo, rel, content) => writeFileSync(path.join(repo, ...rel.split("/")), content);

test("per edit: a broken file blocks with exit 2 and names the file and the problem", () => {
    const repo = makeRepo();
    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => a + b; // LINT_ERROR\n");
    const lint = hook(repo, "lint-edited-file.mjs", edit(repo, path.join(repo, "src", "lib", "math.ts")));
    assert.equal(lint.code, 2);
    assert.match(lint.stderr, /ESLint reported errors in src\/lib\/math\.ts/);
    assert.match(lint.stderr, /LINT_ERROR marker/);

    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => a - b;\n");
    const tests = hook(repo, "related-tests.mjs", edit(repo, path.join(repo, "src", "lib", "math.ts")));
    assert.equal(tests.code, 2);
    assert.match(tests.stderr, /Tests importing src\/lib\/math\.ts fail \(src\/lib\/math\.test\.ts\)/);
});

test("per edit: a clean file passes without output", () => {
    const repo = makeRepo();
    for (const name of ["lint-edited-file.mjs", "related-tests.mjs"]) {
        const result = hook(repo, name, edit(repo, path.join(repo, "src", "lib", "math.ts")));
        assert.deepEqual([result.code, result.stderr], [0, ""], name);
    }
});

test("per edit: uncovered type, missing file and payloads without a path pass", () => {
    const repo = makeRepo();
    write(repo, "README.md", "LINT_ERROR\n");
    const payloads = [
        edit(repo, path.join(repo, "README.md")),
        edit(repo, path.join(repo, "src", "lib", "gone.ts")),
        {},
        "not json",
        "",
        { tool_name: "Edit", cwd: repo, tool_input: {} },
        { tool_name: "Edit", cwd: repo, tool_input: "x" },
    ];
    for (const payload of payloads) {
        for (const name of ["lint-edited-file.mjs", "related-tests.mjs"]) {
            const result = hook(repo, name, payload);
            assert.deepEqual([result.code, result.stderr], [0, ""], `${name} ${JSON.stringify(payload)}`);
        }
    }
});

test("end of turn: retry flag lets the agent finish even with errors left", () => {
    const repo = makeRepo();
    write(repo, "src/lib/math.ts", "export const add = 1; // LINT_ERROR\n");
    assert.equal(hook(repo, "end-of-turn.mjs", stop(repo, { stop_hook_active: true })).code, 0);
    assert.equal(hook(repo, "end-of-turn.mjs", stop(repo, { loop_count: 1 })).code, 0);
    assert.equal(hook(repo, "end-of-turn.mjs", stop(repo)).code, 2);
});

test("end of turn: a file written without the per-edit hook is caught; no changes means no checks", () => {
    const repo = makeRepo();
    const clean = hook(repo, "end-of-turn.mjs", stop(repo));
    assert.deepEqual([clean.code, clean.stderr], [0, ""]);

    // Edited through Bash (no PostToolUse payload): lint, a red unit test and a type error.
    write(repo, "src/lib/shell-written.ts", "export const x = 1; // LINT_ERROR\n");
    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => a - b; // TYPE_ERROR\n");
    const result = hook(repo, "end-of-turn.mjs", stop(repo));
    assert.equal(result.code, 2);
    assert.match(result.stderr, /ESLint errors in changed files/);
    assert.match(result.stderr, /src\/lib\/shell-written\.ts:1:1 error/);
    assert.match(result.stderr, /Unit tests fail \(npm test\)/);
    assert.match(result.stderr, /Typecheck fails \(tsc --noEmit\)[\s\S]*error TS2322/);
});

test("end of turn: a docs-only turn runs no checks", () => {
    const repo = makeRepo();
    rmSync(path.join(repo, "node_modules"), { recursive: true });
    write(repo, "README.md", "# changed\n");
    const result = hook(repo, "end-of-turn.mjs", stop(repo));
    assert.deepEqual([result.code, result.stderr], [0, ""]);
});

test("checkout: hooks follow the session checkout, not $CLAUDE_PROJECT_DIR", () => {
    const repo = makeRepo();
    const other = makeRepo();
    write(other, "src/lib/math.ts", "export const add = 1; // LINT_ERROR TYPE_ERROR\n");
    const env = { CLAUDE_PROJECT_DIR: other };
    assert.equal(hook(repo, "lint-edited-file.mjs", edit(repo, path.join(repo, "src", "lib", "math.ts")), env).code, 0);
    assert.equal(hook(repo, "end-of-turn.mjs", stop(repo), env).code, 0);

    // A file of another repository is skipped, even when broken.
    assert.equal(hook(repo, "lint-edited-file.mjs", edit(repo, path.join(other, "src", "lib", "math.ts"))).code, 0);

    // A relative path resolves against the payload cwd.
    write(repo, "src/lib/math.ts", "export const add = 1; // LINT_ERROR\n");
    const relative = hook(repo, "lint-edited-file.mjs", edit(repo, "src/lib/math.ts"));
    assert.equal(relative.code, 2);
    assert.match(relative.stderr, /src\/lib\/math\.ts/);
});

test("checkout: an edit in a sibling worktree is swept at end of turn", () => {
    const repo = makeRepo();
    const sibling = path.join(TEMP, `sibling-${counter}`);
    sh(repo, "git", ["worktree", "add", "-q", "-b", "sibling", sibling]);
    cpSync(path.join(repo, "node_modules"), path.join(sibling, "node_modules"), { recursive: true });
    write(sibling, "src/lib/math.ts", "export const add = (a: number, b: number) => a + b; // LINT_ERROR\n");

    const session = `agent-hooks-test-${process.pid}-${counter}`;
    const perEdit = hook(repo, "lint-edited-file.mjs", edit(repo, path.join(sibling, "src", "lib", "math.ts"), { session_id: session }));
    assert.equal(perEdit.code, 2, "a worktree of the session repository is checked");

    const result = hook(repo, "end-of-turn.mjs", stop(repo, { session_id: session }));
    assert.equal(result.code, 2);
    assert.ok(result.stderr.includes(path.resolve(sibling)), result.stderr);
});

test("config: every settings.json command reaches its script from a worktree subdirectory", (t) => {
    const bash = process.platform === "win32" ? ["C:\\Program Files\\Git\\bin\\bash.exe", process.env.CLAUDE_CODE_GIT_BASH_PATH].find((p) => p && existsSync(p)) : "bash";
    if (!bash) {
        t.skip("Git Bash not found: set CLAUDE_CODE_GIT_BASH_PATH to run this case");
        return;
    }
    const repo = makeRepo();
    const worktree = path.join(TEMP, `config-wt-${counter}`);
    sh(repo, "git", ["worktree", "add", "-q", "-b", "config-wt", worktree]);
    const commands = Object.values(SETTINGS.hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)));
    assert.ok(commands.length >= 3);
    for (const command of commands) {
        const result = spawnSync(bash, ["-c", command], {
            cwd: path.join(worktree, "src", "lib"),
            input: "{}",
            encoding: "utf8",
            env: { ...ENV, CLAUDE_PROJECT_DIR: path.join(TEMP, "does-not-exist") },
        });
        assert.equal(result.status, 0, `${command}\n${result.stderr}`);
    }
});

test("no silent success: a missing linter or typechecker fails visibly", () => {
    const repo = makeRepo();
    renameSync(path.join(repo, "node_modules", "eslint"), path.join(repo, "node_modules", "eslint-off"));
    const lint = hook(repo, "lint-edited-file.mjs", edit(repo, path.join(repo, "src", "lib", "math.ts")));
    assert.equal(lint.code, 2);
    assert.match(lint.stderr, /eslint\/bin\/eslint\.js is not installed/);

    renameSync(path.join(repo, "node_modules", "eslint-off"), path.join(repo, "node_modules", "eslint"));
    renameSync(path.join(repo, "node_modules", "typescript"), path.join(repo, "node_modules", "typescript-off"));
    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => a + b; // edited\n");
    const result = hook(repo, "end-of-turn.mjs", stop(repo));
    assert.equal(result.code, 2);
    assert.match(result.stderr, /typescript\/bin\/tsc is not installed/);
});
