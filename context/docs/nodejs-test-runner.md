# Node.js test runner (`node:test`) — dokumentacja z Context7

- **Library ID:** `/websites/nodejs_latest-v24_x_api` (Node.js v24 API, reputacja High, benchmark 84.43)
- **Data pobrania:** 2026-10-12
- **Źródło:** https://nodejs.org/docs/latest-v24.x/api/test.html, pobrane przez `npx ctx7@latest docs`
- **Zmiana:** `testing-run-flow-form-behaviour`
- **Zapytania:**
  1. `node:test MockTimers mock.timers.enable apis setTimeout Date tick`
  2. `node:test mock.fn and mock.method spy call arguments context.mock restore`
- **Wnioski dla projektu:** `mock.timers` mockuje tylko `setTimeout`, `setInterval`, `setImmediate` i `Date` (nie `performance.now()` ani `AudioContext.currentTime`), dlatego testy przebiegu sterują czasem przez wstrzykiwany port `DrillClock`, a nie przez `mock.timers`. `t.mock.fn` / `t.mock.method` przywracają się same po teście.

## Zapytanie 1: `node:test MockTimers mock.timers.enable apis setTimeout Date tick`

### mock.timers.enable()

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Enables timer mocking for the specified timers. Optionally accepts an object with 'apis' array and 'now' initial time. When enabled, associated clear functions are also mocked.

```APIDOC
## mock.timers.enable()

### Description
Enables timer mocking for the specified timers. Optionally accepts an object with 'apis' array and 'now' initial time. When enabled, associated clear functions are also mocked.

### Method
enable

### Parameters
#### enableOptions (Object) - Optional
- **apis** (Array) - Optional - An array of timers to mock. Supported values: 'setInterval', 'setTimeout', 'setImmediate', 'Date'. Default: ['setInterval', 'setTimeout', 'setImmediate', 'Date']. If no array provided, all time related APIs are mocked.
- **now** (number | Date) - Optional - Initial time in milliseconds for Date.now(). Default: 0.

### Request Example
```mjs
import { mock } from 'node:test';
mock.timers.enable({ apis: ['setInterval'] });
```

```cjs
const { mock } = require('node:test');
mock.timers.enable({ apis: ['setInterval'] });
```

### Notes
- When enabling a specific timer, its associated clear function is also implicitly mocked.
- Mocking Date affects the behavior of mocked timers as they use the same internal clock.
- Calling without parameters mocks all timers and Date.
```

--------------------------------

### Mocking setTimeout with .tick()

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Demonstrates using .tick() to advance time and trigger a mocked setTimeout function.

```mjs
import assert from 'node:assert';
import { test } from 'node:test';

test('mocks setTimeout to be executed synchronously without having to actually wait for it', (context) => {
  const fn = context.mock.fn();

  context.mock.timers.enable({ apis: ['setTimeout'] });

  setTimeout(fn, 9999);

  assert.strictEqual(fn.mock.callCount(), 0);

  // Advance in time
  context.mock.timers.tick(9999);

  assert.strictEqual(fn.mock.callCount(), 1);
});
```

```cjs
const assert = require('node:assert');
const { test } = require('node:test');

test('mocks setTimeout to be executed synchronously without having to actually wait for it', (context) => {
  const fn = context.mock.fn();
  context.mock.timers.enable({ apis: ['setTimeout'] });

  setTimeout(fn, 9999);
  assert.strictEqual(fn.mock.callCount(), 0);

  // Advance in time
  context.mock.timers.tick(9999);

  assert.strictEqual(fn.mock.callCount(), 1);
});
```

--------------------------------

### timers.tick([milliseconds])

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Advance the mock timers by the specified number of milliseconds, or by 1 millisecond if no value is provided. This method is used to simulate the passage of time in tests.

```APIDOC
## Method: timers.tick([milliseconds])

### Description
Advance the mock timers by the given number of milliseconds, or by 1 millisecond if the argument is omitted. This method is part of the mock timers API and allows you to simulate the passage of time in your tests.

### Method
`tick`

### Endpoint
`timers.tick([milliseconds])`

### Parameters
#### Optional Parameter
- **milliseconds** (number) - Optional - The number of milliseconds to advance the timers. If not provided, defaults to 1 millisecond.

### Returns
No explicit return value is documented.

```

--------------------------------

### setTime does not execute timers (ESM)

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Uses context.mock.timers.setTime to move the mocked time without executing timers. Timers only run after calling tick(0). Asserts that Date.now() reflects the set time and that the timer callback is not called until tick.

```mjs
import assert from 'node:assert';
import { test } from 'node:test';

test('setTime does not execute timers', (context) => {
  // Optionally choose what to mock
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const fn = context.mock.fn();
  setTimeout(fn, 1000);

  context.mock.timers.setTime(800);
  // Timer is not executed as the time is not yet reached
  assert.strictEqual(fn.mock.callCount(), 0);
  assert.strictEqual(Date.now(), 800);

  context.mock.timers.setTime(1200);
  // Timer is still not executed
  assert.strictEqual(fn.mock.callCount(), 0);
  // Advance in time to execute the timer
  context.mock.timers.tick(0);
  assert.strictEqual(fn.mock.callCount(), 1);
  assert.strictEqual(Date.now(), 1200);
});
```

### mock.timers.enable()

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Enables timer mocking for the specified timers.

## Zapytanie 2: `node:test mock.fn and mock.method spy call arguments context.mock restore`

### Spy on an object method using TestContext

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Creates a spy on an object method using the TestContext API, which ensures automatic restoration of mocked functionality after the test finishes.

```js
test('spies on an object method', (t) => {
  const number = {
    value: 5,
    add(a) {
      return this.value + a;
    },
  };

  t.mock.method(number, 'add');
  assert.strictEqual(number.add.mock.callCount(), 0);
  assert.strictEqual(number.add(3), 8);
  assert.strictEqual(number.add.mock.callCount(), 1);

  const call = number.add.mock.calls[0];

  assert.deepStrictEqual(call.arguments, [3]);
  assert.strictEqual(call.result, 8);
  assert.strictEqual(call.target, undefined);
  assert.strictEqual(call.this, number);
});
```

--------------------------------

### Spy on a function using node:test (CommonJS)

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Creates a spy on a function that adds two numbers using the top-level mock object in a CommonJS environment.

```cjs
const assert = require('node:assert');
const { mock, test } = require('node:test');

test('spies on a function', () => {
  const sum = mock.fn((a, b) => {
    return a + b;
  });

  assert.strictEqual(sum.mock.callCount(), 0);
  assert.strictEqual(sum(3, 4), 7);
  assert.strictEqual(sum.mock.callCount(), 1);

  const call = sum.mock.calls[0];
  assert.deepStrictEqual(call.arguments, [3, 4]);
  assert.strictEqual(call.result, 7);
  assert.strictEqual(call.error, undefined);

  // Reset the globally tracked mocks.
  mock.reset();
});
```

--------------------------------

### mock.fn([original][, implementation][, options])

Source: https://nodejs.org/docs/latest-v24.x/api/test.json

Creates a mock function. The mocked function contains a special `mock` property, which is an instance of MockFunctionContext, and can be used for inspecting and changing the behavior of the mocked function.

```APIDOC
## mock.fn([original][, implementation][, options])

### Description
Creates a mock function. The mocked function contains a special `mock` property, which is an instance of `MockFunctionContext`, and can be used for inspecting and changing the behavior of the mocked function.

### Parameters
- **original** (Function|AsyncFunction) - Optional - An optional function to create a mock on. Default: A no-op function.
- **implementation** (Function|AsyncFunction) - Optional - An optional function used as the mock implementation for `original`. This is useful for creating mocks that exhibit one behavior for a specified number of calls and then restore the behavior of `original`. Default: The function specified by `original`.
- **options** (Object) - Optional - Optional configuration options for the mock function. The following properties are supported:
  - **times** (integer) - Optional - The number of times that the mock will use the behavior of `implementation`. Once the mock function has been called `times` times, it will automatically restore the behavior of `original`. This value must be an integer greater than zero. Default: `Infinity`.

### Example
```js
test('mocks a counting function', (t) => {
  let cnt = 0;

  function addOne() {
    cnt++;
    return cnt;
  }

