// risk: test-plan.md #3 — no Standby or exercise start signal at Start, after Resume, or after returning
// from a locked screen or another app.
// seed: tests/e2e/seed.spec.ts
// Oracle (PRD FR-004, FR-006, §NFR): preparation has no sound; Standby is two short sounds in a different pitch
// than the exercise start, the hidden 1–5 s wait counts from the end of the second one, then one long sound
// starts the exercise; a pause in the exercise resumes with the full preparation and the same repetition with
// its signals; switching away pauses the drill until a manual Resume; a signal is at most 0.2 s off its moment.
// Real: the page, React wiring, Web Audio (observed through a pass-through spy). Emulated: page visibility only.
import { test, expect, type Page } from "@playwright/test";

import { installAudioSpy, readAudioContexts, type RecordedAudioContext } from "./support/audio-spy";
import { waitForHydration } from "./support/hydration";
import { setPageHidden } from "./support/page-visibility";

const PREPARATION_SECONDS = 1;
const SIGNAL_TOLERANCE_SECONDS = 0.2;
// Standby waits are drawn every 0.01 s; the spy reads two clocks, so allow that much drift on contiguity.
const CLOCK_SLACK_SECONDS = 0.01;

// The run is guest-only: it creates no data, so there is nothing to clean up.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * The gesture number `gesture` (1 = Start) must have opened its own running audio output, closed every earlier
 * one, and scheduled on it the Standby pair after the full preparation and the long exercise sound after the
 * hidden wait — and the output must actually reach the exercise sound.
 */
async function expectSignalsAfterGesture(page: Page, gesture: number) {
    let contexts: RecordedAudioContext[] = [];
    await expect
        .poll(
            async () => {
                contexts = await readAudioContexts(page);
                const current = contexts.at(gesture - 1);
                return current ? current.tones.length >= 3 && current.tones[2].reached : false;
            },
            { message: `gesture ${gesture} plays the Standby pair and reaches the exercise sound`, timeout: 15_000 },
        )
        .toBe(true);

    expect(contexts, "each Start or Resume opens exactly one audio output").toHaveLength(gesture);
    const current = contexts[gesture - 1];
    expect(current.state, "the output of the latest gesture is running").toBe("running");
    for (const earlier of contexts.slice(0, -1)) expect(earlier.state, "an earlier output is released").toBe("closed");

    const [first, second, exercise] = current.tones;
    expect(current.tones, "only the Standby pair and the exercise start sound, no sound for the preparation").toHaveLength(3);
    // Preparation has no sound: the first Standby sound starts when the full preparation ends.
    expect(first.start - current.createdAt).toBeGreaterThanOrEqual(PREPARATION_SECONDS - CLOCK_SLACK_SECONDS);
    expect(first.start - current.createdAt).toBeLessThanOrEqual(PREPARATION_SECONDS + SIGNAL_TOLERANCE_SECONDS);
    // Standby: two short sounds, one right after the other, in a different pitch than the exercise start.
    expect(Math.abs(second.start - first.end)).toBeLessThanOrEqual(CLOCK_SLACK_SECONDS);
    expect(first.frequency).not.toBe(exercise.frequency);
    expect(second.frequency).not.toBe(exercise.frequency);
    // The exercise start is one long sound, longer than either Standby sound.
    expect(exercise.end - exercise.start).toBeGreaterThan(first.end - first.start);
    expect(exercise.end - exercise.start).toBeGreaterThan(second.end - second.start);
    // The hidden wait of 1–5 s counts from the end of the second Standby sound.
    expect(exercise.start - second.end).toBeGreaterThanOrEqual(1 - CLOCK_SLACK_SECONDS);
    expect(exercise.start - second.end).toBeLessThanOrEqual(5 + CLOCK_SLACK_SECONDS);
}

test.describe("risk #3: run audio signals", () => {
    test("Standby and exercise signals play after Start, after Resume and after returning to a hidden page", async ({ page }) => {
        test.setTimeout(90_000);
        await installAudioSpy(page);

        // Configure a short drill with random start: 1 s preparation, a long exercise to pause in, no rest, one repetition.
        await page.goto("/");
        await waitForHydration(page);
        await page.getByRole("textbox", { name: "Preparation" }).fill("0:01");
        await page.getByRole("textbox", { name: "Exercise" }).fill("1:00");
        await page.getByRole("textbox", { name: "Rest" }).fill("0:00");
        await page.getByRole("textbox", { name: "Repetitions" }).fill("1");
        await page.getByRole("checkbox", { name: "Random start" }).check();

        const current = page.getByRole("group", { name: "Current" });
        const resume = page.getByRole("button", { name: "Resume drill" });

        // Start: the gesture unlocks audio and the first repetition gets its signals.
        await page.getByRole("button", { name: "Start" }).click();
        await expectSignalsAfterGesture(page, 1);
        await expect(current).toContainText("Exercise");

        // Pause in the exercise, then Resume: full preparation, the same repetition from Standby, with signals.
        await page.getByRole("button", { name: "Pause drill" }).click();
        await resume.click();
        await expectSignalsAfterGesture(page, 2);
        await expect(current).toContainText("Exercise");
        await expect(page.getByText("Repetition 1 of 1")).toBeVisible();

        // Switching to another app pauses the drill and waits for a manual Resume after returning.
        await setPageHidden(page, true);
        await expect(resume).toBeVisible();
        await setPageHidden(page, false);
        await expect(resume).toBeVisible();
        await resume.click();
        await expectSignalsAfterGesture(page, 3);
        await expect(current).toContainText("Exercise");
    });
});
