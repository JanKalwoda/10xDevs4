// PostToolUse (Write|Edit): lint only the file the agent just edited, in its own checkout.
// ESLint here also enforces the timer-ui and account-entry-ui contracts. No --fix: the agent
// fixes the report itself, so its next Edit does not fail with "file modified since read".
import { block, clip, editedFile, LINT_EXTENSIONS, MissingToolError, readPayload, registerRoot, runPackageBin } from "./lib/hook-utils.mjs";

const payload = readPayload();
const target = editedFile(payload, LINT_EXTENSIONS);
if (!target) process.exit(0);
registerRoot(payload, target.root);

try {
    const result = runPackageBin(target.root, "eslint/bin/eslint.js", ["--quiet", "--no-warn-ignored", target.rel]);
    if (!result.ok) block(`ESLint reported errors in ${target.rel}:\n${clip(result.output)}`);
} catch (error) {
    if (error instanceof MissingToolError) block(`Hook lint-edited-file.mjs: ${error.message}`);
    throw error;
}
