// PostToolUse (Write|Edit): run the unit tests that import the edited module.
// node --test has no related mode, so the tests are selected by import specifier
// ('./drill-timer.ts', '../types', '@/lib/drill-run'). One import level only: the
// end-of-turn hook runs the whole unit suite and catches the rest.
import path from "node:path";
import { block, clip, editedFile, git, MODULE_EXTENSIONS, readPayload, registerRoot, run } from "./lib/hook-utils.mjs";

// The files `npm test` and the CI eslint-rules step pick up.
const TEST_PATHSPECS = [":(glob)src/lib/*.test.ts", ":(glob)src/lib/services/*.test.ts", ":(glob)scripts/eslint-rules/*.test.mjs"];
const IS_TEST = /^(src\/lib\/(services\/)?[^/]+\.test\.ts|scripts\/eslint-rules\/[^/]+\.test\.mjs)$/;

const payload = readPayload();
const target = editedFile(payload, MODULE_EXTENSIONS);
if (!target) process.exit(0);
registerRoot(payload, target.root);

let tests;
if (IS_TEST.test(target.rel)) {
    tests = [target.rel];
} else {
    const base = path.basename(target.rel, path.extname(target.rel)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = `['"][^'"]*/${base}(\\.[cm]?[jt]sx?)?['"]`;
    const found = git(target.root, ["grep", "--untracked", "-lE", pattern, "--", ...TEST_PATHSPECS]);
    tests = found ? found.split(/\r?\n/).filter(Boolean) : [];
}
if (tests.length === 0) process.exit(0);

const result = run(process.execPath, ["--test", "--test-reporter=spec", ...tests], target.root);
if (!result.ok) block(`Tests importing ${target.rel} fail (${tests.join(", ")}):\n${clip(result.output)}`);
