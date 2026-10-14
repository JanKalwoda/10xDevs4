// risk: test-plan.md #4 — the run shows the wrong phase, time or repetition, Resume starts the wrong
// repetition, or Standby reveals the remaining wait.
// seed: tests/e2e/seed.spec.ts
// Oracle (PRD US-01, FR-003, FR-005, FR-006, FR-013, FR-018, Guardrail Standby), written as literals:
// preparation once, then per repetition Standby → exercise → positive rest, the last rest announces the end;
// the countdown starts at the full configured time and only counts down; Current shows the full time;
// Standby shows no countdown and nothing that changes during the hidden wait; a pause in the exercise resumes
// with the full preparation and the same repetition from Standby.
// The phase logic itself is unit-tested (src/lib/drill-run-flow.test.ts); this covers the rendered view.
import { test, expect } from "@playwright/test";

import { waitForHydration } from "./support/hydration";
import { recordRunUntilCompleted, type RunView } from "./support/run-view";

// The run is guest-only: it creates no data, so there is nothing to clean up.
test.use({ storageState: { cookies: [], origins: [] } });

interface ExpectedPhase {
    current: string;
    repetition: string;
    next: string;
    paused?: true;
    /** The first countdown of a timed phase: its full configured time. */
    countdown?: string;
}

// Preparation 0:01, Exercise 0:03, Rest 0:01, 2 repetitions, random start; paused once in the exercise of repetition 2.
const EXPECTED_PHASES: ExpectedPhase[] = [
    { current: "Preparation · 0:01", repetition: "Repetition 1 of 2", next: "Standby", countdown: "0:01" },
    { current: "Standby", repetition: "Repetition 1 of 2", next: "Exercise · 0:03" },
    { current: "Exercise · 0:03", repetition: "Repetition 1 of 2", next: "Rest · 0:01", countdown: "0:03" },
    { current: "Rest · 0:01", repetition: "Repetition 1 of 2", next: "Standby", countdown: "0:01" },
    { current: "Standby", repetition: "Repetition 2 of 2", next: "Exercise · 0:03" },
    { current: "Exercise · 0:03", repetition: "Repetition 2 of 2", next: "Rest · 0:01", countdown: "0:03" },
    { current: "Exercise · 0:03", repetition: "Repetition 2 of 2", next: "Rest · 0:01", paused: true },
    // Resume after a pause in the exercise: full preparation, then the same repetition from Standby.
    { current: "Preparation · 0:01", repetition: "Repetition 2 of 2", next: "Standby", countdown: "0:01" },
    { current: "Standby", repetition: "Repetition 2 of 2", next: "Exercise · 0:03" },
    { current: "Exercise · 0:03", repetition: "Repetition 2 of 2", next: "Rest · 0:01", countdown: "0:03" },
    { current: "Rest · 0:01", repetition: "Repetition 2 of 2", next: "Drill complete", countdown: "0:01" },
];

/** A view of the running drill (not the start-up or the completion screen). */
function isRunView(view: RunView): boolean {
    return !view.completed && view.current !== null;
}

/** Consecutive views of one phase occurrence (same Current, repetition and pause state). */
function groupPhases(views: RunView[]): RunView[][] {
    const phases: RunView[][] = [];
    for (const view of views) {
        const occurrence = phases.at(-1);
        const previous = occurrence?.at(-1);
        if (occurrence && previous?.current === view.current && previous.repetition === view.repetition && previous.paused === view.paused) occurrence.push(view);
        else phases.push([view]);
    }
    return phases;
}

function seconds(countdown: string): number {
    const [minutes, rest] = countdown.split(":");
    return Number(minutes) * 60 + Number(rest);
}

test.describe("risk #4: run phase sequence", () => {
    test("a short drill shows every phase, time and repetition in PRD order, resumes the same repetition and never reveals the Standby wait", async ({ page }) => {
        test.setTimeout(120_000);

        // Configure 1 s preparation, 3 s exercise, 1 s rest, 2 repetitions, random start.
        await page.goto("/");
        await waitForHydration(page);
        await page.getByRole("textbox", { name: "Preparation" }).fill("0:01");
        await page.getByRole("textbox", { name: "Exercise" }).fill("0:03");
        await page.getByRole("textbox", { name: "Rest" }).fill("0:01");
        await page.getByRole("textbox", { name: "Repetitions" }).fill("2");
        await page.getByRole("checkbox", { name: "Random start" }).check();

        // Start, follow the whole run, pause once in the exercise of repetition 2 and resume.
        let pauseClicked = false;
        let resumeClicked = false;
        await page.getByRole("button", { name: "Start", exact: true }).click();
        const views = await recordRunUntilCompleted(
            page,
            async (view, recorded) => {
                if (!pauseClicked && !view.paused && view.current === "Exercise · 0:03" && view.repetition === "Repetition 2 of 2") {
                    pauseClicked = true;
                    await page.getByRole("button", { name: "Pause drill" }).click();
                } else if (view.paused && !resumeClicked) {
                    resumeClicked = true;
                    await page.getByRole("button", { name: "Resume drill" }).click();
                }
                // More phases than the PRD allows: stop following, the sequence assertion below reports it.
                return groupPhases(recorded.filter(isRunView)).length > EXPECTED_PHASES.length;
            },
            90_000,
        );
        const phases = groupPhases(views.filter(isRunView));

        // Phases, Current, Next and repetitions follow the PRD order.
        expect(phases.map(([first]) => ({ current: first.current, repetition: first.repetition, next: first.next, paused: first.paused }))).toEqual(
            EXPECTED_PHASES.map(({ current, repetition, next, paused }) => ({ current, repetition, next, paused: paused ?? false })),
        );

        // The drill ends after the last rest.
        await expect(page.getByRole("heading", { level: 2, name: "Completed" })).toBeVisible();

        for (const [index, expected] of EXPECTED_PHASES.entries()) {
            const occurrence = phases[index];
            if (expected.current === "Standby") {
                // Standby: no countdown, the word Standby, and a view that never changes during the hidden wait.
                expect(occurrence, `Standby ${index} changes nothing the user can read during the wait`).toHaveLength(1);
                const [standby] = occurrence;
                expect(standby.countdown).toBeNull();
                expect(standby.headline).toBe("Standby");
                // The only time on screen is the next exercise's full configured time (FR-005), nothing about the wait.
                const withoutNext = standby.raw.replace(`- paragraph: ${expected.next}`, "");
                expect(withoutNext).not.toMatch(/\d:\d\d|remaining|\d\s?s\b/);
            } else if (expected.countdown) {
                // Timed phase: the countdown starts at the full configured time and never goes up.
                const countdowns = occurrence.map((view) => view.countdown);
                expect(countdowns[0], `phase ${index} starts at its full time`).toBe(expected.countdown);
                for (const [step, countdown] of countdowns.entries()) {
                    expect(countdown, `phase ${index} always shows a countdown`).not.toBeNull();
                    if (step > 0) expect(seconds(countdown ?? "")).toBeLessThanOrEqual(seconds(countdowns[step - 1] ?? ""));
                }
            }
        }
    });
});
