# Playwright Test — dokumentacja z Context7

- **Library ID:** `/websites/playwright_dev` (Playwright, reputacja High, benchmark 90.32); repo ma `@playwright/test` 1.64.1
- **Data pobrania:** 2026-10-15
- **Źródło:** https://playwright.dev/docs/emulation, https://playwright.dev/docs/api/class-testoptions, https://playwright.dev/docs/actionability, https://playwright.dev/docs/api/class-locator, https://playwright.dev/docs/api/class-locatorassertions — pobrane przez `npx ctx7@latest docs`
- **Zmiana:** `testing-key-screen-layout`
- **Zapytania:**
    1. `emulation hasTouch isMobile viewport project use options devices Pixel`
    2. `toBeInViewport ratio assertion and locator boundingBox`
    3. `TestOptions hasTouch isMobile description; actionability checks receives events hit target check obscured`
    4. `locator.click trial option perform actionability checks only; locator.tap requires hasTouch`

## Zapytanie 1: emulacja urządzeń w projektach

Projekty w `playwright.config.ts` dostają parametry urządzenia przez `use` (rozwinięcie `devices[...]` albo własne opcje):

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "Mobile Chrome", use: devices["Pixel 5"] },
    ],
});
```

`test.use({ ...devices['Pixel 7'] })` ustawia to samo na poziomie pliku. Zdarzenia z `locator.dispatchEvent('touchstart', …)` nie są zaufane (`isTrusted === false`).

## Zapytanie 2: `toBeInViewport` i `boundingBox`

- `expect(locator).toBeInViewport({ ratio })` — element przecina viewport wg Intersection Observer; `ratio` (domyślnie `0`) to minimalny ułamek elementu w viewporcie, `ratio: 1` = cały element w oknie. Od v1.31.
- `boundingBox()` → `{ x, y, width, height }` względem viewportu ramki głównej albo `null`, gdy element niewidoczny.

## Zapytanie 3: `hasTouch`, `isMobile`, actionability

- `hasTouch` (v1.10): „Specifies if viewport supports touch events. Defaults to false.”
- `isMobile` (v1.10): „Whether the `meta viewport` tag is taken into account and touch events are enabled.” Domyślnie `false`, nieobsługiwane w Firefox; jest częścią deskryptora urządzenia.
- `locator.click()` / `tap()` przed akcją czekają na: dokładnie jeden element, Visible, Stable, **Receives Events** („element is the hit target of the pointer event at the action point … whether some other element (usually an overlay) will instead capture the click”), Enabled.

## Zapytanie 4: `trial` i `tap`

- `locator.tap(options)` wymaga `hasTouch: true` w kontekście; tapnięcie środka elementu przez `page.touchscreen`.
- Opcja `trial: true` (dla `click`/`tap`): „only performs the actionability checks and skips the action” — czyli sprawdza m.in. Receives Events (brak przykrycia) bez wykonania akcji.
- `scroll: "none"` — nie przewija elementu do widoku; akcja kończy się błędem, gdy element nie jest w viewporcie.

## Zapytanie 5 (2026-10-18, zmiana `fix-double-tap-run-controls`): definicja Enabled w actionability

- `npx ctx7@latest docs /websites/playwright_dev "actionability Enabled check: element is considered enabled unless disabled or aria-disabled=true descendant"` zwrócił tylko „Element is considered enabled when it is **not disabled**”; pełna lista pobrana z https://playwright.dev/docs/actionability (exa `web_fetch_exa`, 2026-10-18).
- „Element is disabled when: it is a `<button>`, `<select>`, `<input>`, `<textarea>`, `<option>` or `<optgroup>` with a `[disabled]` attribute; … part of a `<fieldset>` with a `[disabled]` attribute; it is a descendant of an element with `[aria-disabled=true]` attribute.”
- `locator.click()`, `dblclick()` i `tap()` czekają na Enabled; `page.touchscreen.tap(x, y)` i `page.mouse.*` nie wykonują żadnych sprawdzeń actionability.
