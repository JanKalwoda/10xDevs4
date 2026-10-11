# StrykerJS — dokumentacja z Context7

- **Library ID:** `/stryker-mutator/stryker-js` (Stryker JS, reputacja High, benchmark 82.61)
- **Data pobrania:** 2026-10-11
- **Źródło:** https://stryker-mutator.io/docs/stryker-js/ (repozytorium https://github.com/stryker-mutator/stryker-js), pobrane przez `npx ctx7@latest docs`
- **Zmiana:** `mutation-testing-stryker`
- **Zapytania:**
  1. `tap runner testRunner configuration nodeArgs testFiles`
  2. `mutate option glob patterns and line range file.ts:start-end`
  3. `coverageAnalysis perTest off all options`
  4. `ignorePatterns and tempDirName sandbox configuration`
  5. `thresholds high low break mutation score`

## Zapytanie 1: `tap runner testRunner configuration nodeArgs testFiles`

### Configure tap test runner in stryker.config.json

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/tap-runner.md

Configure the tap test runner in stryker.config.json. Sets testFiles glob, nodeArgs for tsx, and forceBail to true.

```json
{
  "testRunner": "tap",
  "tap": {
    "testFiles": ["test/**/*.@(js|ts)"],
    "nodeArgs": ["--import", "tsx"],
    "forceBail": true
  }
}
```

### Configuring

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/tap-runner.md

You can configure the tap test runner in the `stryker.config.json` (or `stryker.config.js`) file.

The tap runner will look for files that match the `testFiles` [glob expressions](./config-file.md#glob-patterns) and execute them using the `nodeArgs` as additional node arguments.

--------------------------------

### Tips and tricks

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/tap-runner.md

## Tips and tricks

- **Configuring**  
  When you rely on your test runner to compile your typescript files, you should first try to run them yourself, for example by using `node --import tsx test/my-test-file.spec.ts`. If that succeeds, you can proceed to add `"nodeArgs": ["--import", "tsx"]` to your `tap` configuration.
- **Debugging**  
  You can run Stryker with `--logLevel debug` to see the actual node arguments that are used to run your tests.
- **Performance**  
  When you're normally using a JIT compiler like `tsx` to run your tests, you can speed up mutation testing considerably by using a [`buildCommand`](./configuration.md#buildcommand-string) to compile your files before running them.

  ```diff
  {
  + "buildCommand": "tsc",
    "tap": {
  +   "testFiles": ["dist/test/**/*.js"],
  -   "nodeArgs": ["--import", "tsx"],
  -   "testFiles": ["test/**/*.ts"]
    }
  }
  ```

--------------------------------

### Configuring > `tap.nodeArgs` [`string[]`] > Examples

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/tap-runner.md

| Config                                                                                    | Generated actual node arguments                                                                                  | Explanation                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `[]`                                                                                      | `["-r", "actual/hook.cjs", "test/foo.spec.js"]`                                                                  | The default, works when using raw JavaScript test files as input |
| `["--import", "tsx"]`                                                                      | `["-r", "actual/hook.cjs", "--import", "tsx", "test/foo.spec.js"]`                                               | If you want to use `tsx` to run your TypeScript tests            |
| `["node_modules/ava/entrypoints/cli.mjs", "--tap", "--node-arguments='-r {{hookFile}}'"]` | `["node_modules/ava/entrypoints/cli.mjs", "--tap", "--node-arguments='-r actual/hook.cjs'", "test/foo.spec.js"]` | If you are running tests with [Ava](https://github.com/avajs/ava) < v8 |
| `["node_modules/ava/entrypoints/cli.js", "--tap", "--node-arguments='-r {{hookFile}}'"]` | `["node_modules/ava/entrypoints/cli.js", "--tap", "--node-arguments='-r actual/hook.cjs'", "test/foo.spec.js"]` | If you are running tests with [Ava](https://github.com/avajs/ava) >= v8 |

--------------------------------

### Configuring > `tap.testFiles` [`string[]`]

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/tap-runner.md

Default: `["{**/@(test|tests|__test__|__tests__)/**,**/*.@(test|tests|spec)}.@(cjs|mjs|js|jsx|ts|tsx|mts|cts)"]`

Specify [glob expressions](./config-file.md#glob-patterns) to your test files. By default, the tap runner will look for testy-looking files, like files in the `test` directory, as well as any files that end in `*.spec.js` or `*.test.js`. If you want to run a specific file, you should override this setting.

## Zapytanie 2: `mutate option glob patterns and line range file.ts:start-end`

### mutate mutation range examples

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

Specifies exact code blocks to mutate using mutation ranges. Ranges are postfixed to the file path.

```text
"src/app.js:1-11"
```

```text
"src/app.js:5:4-6:4"
```

```text
"src/app.js:5-6:4"
```

--------------------------------

### mutate config file examples

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

Configures the files to mutate via the config file. Supports globbing patterns and negation.

```json
"mutate": ["src/**/*.js", "a.js"]
```

```json
"mutate": ["src/**/*.ts","!src/**/*.spec.ts","!src/**/*.module.ts"]
```

--------------------------------

### mutate command line examples

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

Configures the files to mutate via the command line. Supports globbing patterns, negation, and specific files.

```bash
--mutate "src/**/*.js", "a.js"
```

```bash
-m "src/**/*.js", "a.js"
```

```bash
--mutate "src/**/*.ts","!src/**/*.spec.ts","!src/**/*.module.ts"
```

```bash
--mutate src/app/home/home.component.ts
```

```bash
--mutate "src/app/home/*.ts","!src/app/home/*.spec.ts"
```

### mutate

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

### `mutate` [`string[]`]

Default: `['{src,lib}/**/!(*.+(s|S)pec|*.+(t|T)est).+(cjs|mjs|js|ts|mts|cts|jsx|tsx|html|vue|svelte)', '!{src,lib}/**/__tests__/**/*.+(cjs|mjs|js|ts|mts|cts|jsx|tsx|html|vue|svelte)']`<br />

- Config file: `"mutate": ["src/**/*.js", "a.js"]` or `"mutate": ["src/**/*.ts","!src/**/*.spec.ts","!src/**/*.module.ts"]`
- Command line:
  - `--mutate "src/**/*.js", "a.js"`, `-m "src/**/*.js", "a.js"`
  - `--mutate "src/**/*.ts","!src/**/*.spec.ts","!src/**/*.module.ts"` (For usage of `*`, `**` and other [globbing expressions see above](#usage-of-globbing-expressions-on-options))
  - `--mutate src/app/home/home.component.ts`, for one specific file
  - `--mutate "src/app/home/*.ts","!src/app/home/*.spec.ts"`, if you want to mutate just one specific directory

With `mutate` you configure the subset of files or just one specific file to be mutated. These should be your _production code files_, and definitely not your test files.
(Whereas with [`ignorePatterns`](#ignorepatterns-string) you prevent non-relevant files from being copied to the [sandbox directory](#tempdirname-string) in the first place)

The default will try to guess your production code files based on sane defaults. It reads like this:

- Include all js-like files inside the `src` or `lib` dir
  - Except files inside `__tests__` directories and file names ending with `test` or `spec`.

If the defaults are not sufficient for you, for example in an angular project you might want to **exclude** not only the `*.spec.ts` files but other files too, just like the default already does.

It is possible to specify exactly which code blocks to mutate by means of a _mutation range_. This can be done postfixing your file with `:startLine[:startColumn]-endLine[:endColumn]`. Some examples:

- `"src/app.js:1-11"` will mutate lines 1 through 11 inside app.js.
- `"src/app.js:5:4-6:4"` will mutate from line 5, column 4 through line 6 column 4 inside app.js (columns 4 are included).
- `"src/app.js:5-6:4"` will mutate from line 5, column 0 through line 6 column 4 inside app.js (column 4 is included).

_Note:_ It is **not** possible to combine mutation range with a [globbing expression](#usage-of-globbing-expressions-on-options) in the same line.

--------------------------------

### Config file > Glob patterns

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/config-file.md

## Glob patterns

Some options allow for a glob pattern to be defined. These glob patterns are defined relative to the cwd.

For example, using `"mutate": [ "src/components/**/*.component.js" ]` will make sure only files ending with ".component.js" in the "src/components" directory are mutated.

We suggest using [https://globster.xyz/](https://globster.xyz/) when auditing more complex glob expressions; it can help you get them just right.

## Zapytanie 3: `coverageAnalysis perTest off all options`

### Configure jasmine test runner in stryker.config.json

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/jasmine-runner.md

Example configuration for the jasmine test runner in the `stryker.config.json` (or `stryker.config.js`) file. Sets coverage analysis to perTest, the test runner to jasmine, and points to the jasmine configuration file.

```json
{
  "coverageAnalysis": "perTest",
  "testRunner": "jasmine",
  "jasmineConfigFile": "spec/support/jasmine.json"
}
```

--------------------------------

### Example stryker.config.json with mocha test runner

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/config-file.md

Example config file specifying the mocha test runner and per-test coverage analysis.

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "mocha",
  "coverageAnalysis": "perTest"
}
```

### coverageAnalysis

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

### `coverageAnalysis` [`string`]

Default: `perTest`<br />
Command line: `--coverageAnalysis perTest`<br />
Config file: `"coverageAnalysis": "perTest"`

_Note:_ The default changed from `"off"` to `"perTest"` in Stryker v5.

With `coverageAnalysis` you specify which coverage analysis strategy you want to use.

Stryker can analyze mutant coverage results. Doing this can speed up mutation testing because Stryker then decides to run only the exact tests covering the mutant it is testing (instead of running them all).
This performance optimization does _not_ influence the resulting mutation testing score but does allow Stryker to distinguish between "Survived" and "NoCoverage".

All official test runner plugins (`@stryker-mutator/mocha-runner`, `@stryker-mutator/jasmine-runner`, `@stryker-mutator/karma-runner` and `@stryker-mutator/jest-runner`)
support coverage analysis, except for the `command` test runner, since Stryker will just run your command has no way of knowing more about your tests.

The possible values are:

- **off**: Stryker does no optimization. All tests are executed for each mutant.
- **all**: Stryker will determine the mutants covered by your tests during the initial test run phase. Mutants without code coverage will be reported with `NoCoverage` and will not be tested. This requires your test runner plugin to report code coverage back to Stryker.
- **perTest**: Stryker will determine which tests cover which mutant during the initial test run phase. Only the tests that cover a specific mutant are executed for each mutant. Your tests should be _able to run independently of each other and in random order_. Stryker will determine which mutants are _static_ and will run all tests for them during mutation testing. A mutant is 'static' when it is executed during the loading of the file rather than during a test.

--------------------------------

### Coverage analysis

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/jest-runner.md

## Coverage analysis

The `@stryker-mutator/jest-runner` plugin supports coverage analysis and test filtering, meaning you can run with `--coverageAnalysis perTest` for optimal performance.

--------------------------------

### Cucumber Runner > Coverage analysis

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/cucumber-runner.md

## Coverage analysis

The `@stryker-mutator/cucumber-runner` plugin supports coverage analysis, test filtering and test location reporting. This means that `--coverageAnalysis perTest` (which is the default) is supported and will yield the best performance.

## Zapytanie 4: `ignorePatterns and tempDirName sandbox configuration`

### ignorePatterns config file example

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

Configure ignorePatterns in the Stryker config file to specify glob patterns for files or directories that should not be copied to the sandbox. The default is an empty array.

```json
"ignorePatterns": ["dist", "coverage"]
```

--------------------------------

### Configure sandbox for module-alias

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/troubleshooting.md

Workaround to keep using module-alias: mark node_modules as part of the sandbox by adding ignorePatterns and setting symlinkNodeModules to false.

```diff
{
+  "ignorePatterns": ["!node_modules"],
+  "symlinkNodeModules": false
}
```

--------------------------------

### Set tempDirName to non-hidden directory for Jest

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/troubleshooting.md

Change the temporary directory name to a non-hidden directory to avoid Jest not matching hidden folders on Windows. This resolves the 'No tests found' error when using the @stryker-mutator/jest-runner.

```json
{
  "tempDirName": "stryker-tmp"
}
```

### ignorePatterns

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

### `ignorePatterns` [`string[]`]

Default: `[]`<br />
Command line: `--ignorePatterns dist,coverage`<br />
Config file: `"ignorePatterns": ["dist", "coverage"]`<br />

Specify the patterns to all files or directories that are not used to run your tests and thus should _not be copied_ to the sandbox directory for mutation testing. Each patterns in this array should be a [glob pattern](#usage-of-globbing-expressions-on-options).

These patterns are **always ignored**: `['node_modules', '.git', '*.tsbuildinfo', '/stryker.log']`. The configured files in the `tempDirName`,`incrementalFile`, `htmlReporter.fileName` and `jsonReporter.fileName` options are also ignored.
Because Stryker always ignores these, you should rarely have to adjust the `"ignorePatterns"` setting at all. If you want to undo one of these ignore patterns, you can use the `!` prefix, for example: `["!node_modules"]`.

Overriding `--ignorePatterns` is only needed when you experience a slow Stryker startup, because too many (or too large) files are copied to the sandbox that are not needed to run the tests.
For example, image or movie directories. This is useful to speed up Stryker by ignoring big directories/files you might have in your repo that has nothing to do with your code. For example, 1.5GB of movie/image files.

This option has **no effect at all**, when used in combination with [`--inPlace`](#inplace-boolean).

Note that, to **select specific files to be mutated**, you should use [`mutate`](#mutate-string).

If a glob pattern starts with `/`, the pattern is relative to the current working directory. For example, `/foo.js` matches to `foo.js` but not `subdir/foo.js`.

When using the command line, the list can only contain a comma separated list of globbing expressions.

- `--ignorePatterns ".idea",".angular","/src/assets/*.png","/src/assets/*.jpg"`
- `--ignorePatterns "/src/**/*.css"`
- `--ignorePatterns` with `"!"` (= undo) for example:
  - `--ignorePatterns "src/**","!str/app/important/*.ts"` (for details on usage of glob patterns like `!`, `*`, `**` see [above](#usage-of-globbing-expressions-on-options))
  - or in the config file: `"ignorePatterns": ["src/**","!str/app/important/*.ts"]` This would ignore everything in and below `src` - directory **except** the typescript files in `src/app/important` directory, but the `--mutate` might be the better option in that case, see [below](#mutate-string)
  - Keep in mind that you should **not accidentally ignore any other configuration** files your test runner might need for running the tests in the sandbox directory.

--------------------------------

### tempDirName

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

### `tempDirName` [`string`]

Default: `'.stryker-tmp'`<br />
Command line: `--tempDirName .stryker-tmp`<br />
Config file: `"tempDirName": '.stryker-tmp'`

Choose a different temp dir that Stryker uses for mutation testing. This directory will contain copies of your source code during a mutation test run.
It will be created if it not exists and is **entirely deleted** after a successful run, so change this with caution.

It is advised to use a directory inside the directory that holds your repository. This way `node_modules` are resolved as expected. Be sure to
not check-in your chosen temp directory in your `.gitignore` file.

## Zapytanie 5: `thresholds high low break mutation score`

### All mutants survive with module-alias

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/troubleshooting.md

Example output showing all mutants surviving when using module-alias, with a survived ArithmeticOperator mutant and a 0.00% mutation score.

```text
[...]
#3. [Survived] ArithmeticOperator
C:\z\github\stryker-mutator\stryker-js\e2e\test\jest-node\src\sum.js:5:10
-     return a - b;
+     return a + b;
Ran all tests for this mutant.

Ran 0.00 tests per mutant on average.
----------|---------|----------|-----------|------------|----------|---------|
File      | % score | # killed | # timeout | # survived | # no cov | # error |
----------|---------|----------|-----------|------------|----------|---------|
All files |    0.00 |        0 |         0 |          4 |        0 |       0 |
 sum.js   |    0.00 |        0 |         0 |          4 |        0 |       0 |
----------|---------|----------|-----------|------------|----------|---------|
```

--------------------------------

### Exclude mutator in Stryker configuration

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/disable-mutants.md

Disables the EqualityOperator mutator for all files by adding its name to the excludedMutations array in the Stryker configuration file. This is a shotgun approach because it disables the mutator everywhere.

```json
{
  "mutator": {
    "excludedMutations": ["EqualityOperator"]
  }
}
```

--------------------------------

### Disable specific mutators with custom reason

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/disable-mutants.md

Disables two specific mutators for an entire file with a custom reason after the colon.

```javascript
// Stryker disable EqualityOperator,ObjectLiteral: We'll implement tests for these next sprint
function max(a, b) {
  return a < b ? b : a;
}
```

--------------------------------

### Clear-text reporter output showing a survived mutant

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/disable-mutants.md

Shows the console output of the clear-text reporter (enabled by default) with the mutator name in the mutant header. Use it to look up the mutator name to exclude.

```text
#3. [Survived] EqualityOperator
src/math.js:3:12
-       return a < b ? b : a;
+       return a <= b ? b : a;
Tests ran:
    math should return 4 for max(4, 3)
    math should return 4 for max(3, 4)
```

### thresholds

Source: https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md

### `thresholds` [`object`]

Default: `{ high: 80, low: 60, break: null }`<br />
Command line: _none_<br />
Config file: `"thresholds": { "high": 80, "low": 60, "break": null }`

Specify the thresholds for mutation score.

- `mutation score >= high`: Awesome! Reporters should color this green and happy.
- `high > mutation score >= low`: Warning! Reporters should color this orange/yellow. Watch yourself!
- `mutation score < low`: Danger! Reporters should color this in red. You're in danger!
- `mutation score < break`: Error! Stryker will exit with exit code 1, indicating a build failure. No consequence for reporters, though.

It is not allowed to only supply one value of the values (it's all or nothing). However, `high` and `low` values can be the same, making sure colors are either red or green. Set `break` to `null` (default) to never let your build fail.

