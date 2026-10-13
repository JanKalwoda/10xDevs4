// Shared helpers for the Claude Code hooks in .claude/hooks/.
// Signal protocol (PostToolUse and Stop): exit 2 + stderr is the only channel Claude reads.
// Exit 0 means "checked and clean" or "nothing to check"; anything else must not pass silently.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const LINT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".astro"]);
export const MODULE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const MAX_LINES = 150;

const PLAIN_ENV = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", GREP_OPTIONS: "" };
delete PLAIN_ENV.NODE_TEST_CONTEXT;

/** Payloads are untrusted shapes: empty stdin or invalid JSON mean "nothing to check". */
export function readPayload() {
    let raw = "";
    try {
        raw = readFileSync(0, "utf8");
    } catch {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function payloadCwd(payload) {
    return typeof payload.cwd === "string" && payload.cwd !== "" ? payload.cwd : process.cwd();
}

export function sessionId(payload) {
    return typeof payload.session_id === "string" ? payload.session_id.replace(/[^A-Za-z0-9_-]/g, "") : "";
}

export function git(cwd, args) {
    if (!isDirectory(cwd)) return null;
    const result = spawnSync("git", args, { cwd, encoding: "utf8", env: PLAIN_ENV });
    return result.status === 0 ? result.stdout.trim() : null;
}

export function isDirectory(p) {
    try {
        return statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export function isFile(p) {
    try {
        return statSync(p).isFile();
    } catch {
        return false;
    }
}

function samePath(a, b) {
    const na = path.resolve(a);
    const nb = path.resolve(b);
    return process.platform === "win32" ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

export function toplevel(dir) {
    const root = git(dir, ["rev-parse", "--show-toplevel"]);
    return root ? path.resolve(root) : null;
}

function commonDir(dir) {
    return git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
}

/**
 * The edited file from a PostToolUse payload, with the checkout it belongs to.
 * Returns null when there is nothing to check: no path, missing file, or a file of
 * another repository than the session's (~/.claude, other projects). Any worktree of
 * the session's repository counts, wherever $CLAUDE_PROJECT_DIR points.
 */
export function editedFile(payload, extensions) {
    const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
    const raw = [input.file_path, input.notebook_path].find((v) => typeof v === "string" && v !== "");
    if (!raw) return null;
    const cwd = payloadCwd(payload);
    const file = path.resolve(cwd, raw);
    if (!extensions.has(path.extname(file).toLowerCase()) || !isFile(file)) return null;
    const root = toplevel(path.dirname(file));
    if (!root) return null;
    const repo = commonDir(root);
    const sessionRepo = commonDir(cwd);
    if (!repo || !sessionRepo || !samePath(repo, sessionRepo)) return null;
    const rel = path.relative(root, file).split(path.sep).join("/");
    return { file, root, rel };
}

function registryPath(sid) {
    return path.join(os.tmpdir(), "claude-hooks", `${sid}.roots`);
}

/** Remember the checkout so the Stop hook sweeps it too, even when it is not the session cwd. */
export function registerRoot(payload, root) {
    const sid = sessionId(payload);
    if (!sid) return;
    try {
        mkdirSync(path.dirname(registryPath(sid)), { recursive: true });
        appendFileSync(registryPath(sid), `${root}\n`);
    } catch {
        // The Stop hook still sweeps the session cwd.
    }
}

export function registeredRoots(payload) {
    const sid = sessionId(payload);
    if (!sid) return [];
    try {
        return readFileSync(registryPath(sid), "utf8").split(/\r?\n/).filter(Boolean);
    } catch {
        return [];
    }
}

export function clearRegistry(payload) {
    const sid = sessionId(payload);
    if (!sid || !existsSync(registryPath(sid))) return;
    try {
        writeFileSync(registryPath(sid), "");
    } catch {
        // Next turn sweeps a few extra checkouts; harmless.
    }
}

/** Unique checkouts, compared case-insensitively on Windows. */
export function uniqueRoots(roots) {
    const out = [];
    for (const r of roots) {
        if (r && isDirectory(r) && !out.some((o) => samePath(o, r))) out.push(path.resolve(r));
    }
    return out;
}

export class MissingToolError extends Error {}

/** Run a package binary from the checkout's own node_modules; a missing one is an error, never a pass. */
export function runPackageBin(root, binPath, args) {
    const bin = path.join(root, "node_modules", ...binPath.split("/"));
    if (!isFile(bin)) {
        throw new MissingToolError(`${binPath} is not installed in ${root} (run npm install); the check did not run.`);
    }
    return run(process.execPath, [bin, ...args], root);
}

export function run(command, args, cwd, options = {}) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: PLAIN_ENV,
        maxBuffer: 64 * 1024 * 1024,
        shell: options.shell ?? false,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}`;
    return { ok: result.status === 0, status: result.status, output: output.trim() };
}

/** Keep hook output readable for the model: the tail holds the summary of every runner here. */
export function clip(text, maxLines = MAX_LINES) {
    const lines = text.split(/\r?\n/);
    if (lines.length <= maxLines) return text;
    return [`[... ${lines.length - maxLines} earlier lines omitted ...]`, ...lines.slice(-maxLines)].join("\n");
}

/** Block with a message the agent reads (exit 2 + stderr). */
export function block(message) {
    process.stderr.write(`${message.trim()}\n`);
    process.exit(2);
}
