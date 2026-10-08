import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrillTimerView from "@/components/timer/DrillTimerView";
import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "@/lib/drill-audio";
import { initialDrillDisplay } from "@/lib/drill-phase-sections";
import { DrillRun, type DrillClock, type DrillDisplay } from "@/lib/drill-run";
import type { DrillConfiguration } from "@/types";

/** Deterministic clock: time moves only when a fixture advances it, so nothing depends on the real clock. */
class FixtureClock implements DrillClock {
    time = 0;
    now() {
        return this.time;
    }
    setWake() {
        return 0;
    }
    clearWake() {
        return undefined;
    }
}

class SilentFixtureAudio implements DrillAudioPort {
    available = true;
    schedule(cue: DrillCue, at: number): ScheduledCue {
        return { start: at, end: at + CUE_DURATION[cue] };
    }
    cancel() {
        return undefined;
    }
    close() {
        return undefined;
    }
    onUnavailable() {
        return undefined;
    }
}

type Action = "pause" | "resume";

interface Scenario {
    fixture: string;
    title: string;
    description: string;
    configuration: DrillConfiguration;
    /** Seconds after the start at which the display is captured. */
    at?: number;
    action?: Action;
    audio?: boolean;
    initializing?: boolean;
    wakeLockUnavailable?: boolean;
}

const BASE: DrillConfiguration = { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: false };
const RANDOM: DrillConfiguration = { ...BASE, randomStartEnabled: true };
const SINGLE_NO_REST: DrillConfiguration = { ...BASE, preparationSeconds: 0, restSeconds: 0, repetitions: 1 };
const LONG: DrillConfiguration = { ...BASE, preparationSeconds: 0, exerciseSeconds: 600, restSeconds: 2, repetitions: 10 };
const SINGLE: DrillConfiguration = { ...BASE, preparationSeconds: 0, repetitions: 1 };

const SCENARIOS: Scenario[] = [
    { fixture: "preparation-exercise", title: "Preparation → Exercise", description: "Preparing, then the first exercise.", configuration: BASE },
    { fixture: "preparation-standby", title: "Preparation → Standby", description: "Random start on: Standby follows the preparation.", configuration: RANDOM },
    { fixture: "exercise-rest", title: "Exercise → Rest", description: "Exercise with a rest after it.", configuration: BASE, at: 6 },
    { fixture: "exercise-complete", title: "Exercise → Drill complete", description: "Last exercise, rest 0:00: the drill ends.", configuration: SINGLE_NO_REST, at: 1 },
    {
        fixture: "standby-exercise",
        title: "Standby → Exercise",
        description: "Standby shows the word, no time, no countdown.",
        configuration: { ...RANDOM, preparationSeconds: 0 },
    },
    { fixture: "rest-exercise", title: "Rest → Exercise", description: "Rest followed by the next repetition.", configuration: BASE, at: 10 },
    { fixture: "rest-standby", title: "Rest → Standby", description: "Rest followed by Standby; Next carries no time.", configuration: RANDOM, at: 13 },
    { fixture: "rest-complete", title: "Last Rest → Drill complete", description: "Rest after the last repetition.", configuration: SINGLE, at: 5 },
    {
        fixture: "resume-preparation",
        title: "Resume preparation → resumed repetition",
        description: "Paused in repetition 2, resumed: preparing, then repetition 2 again.",
        configuration: BASE,
        at: 13,
        action: "resume",
    },
    { fixture: "paused", title: "Paused", description: "Paused exercise keeps its next phase.", configuration: BASE, at: 13, action: "pause" },
    { fixture: "initializing", title: "Initializing", description: "Audio still starting: no main countdown, sections visible.", configuration: BASE, initializing: true },
    { fixture: "audio-unavailable", title: "Audio unavailable", description: "Warning shown below the control bar.", configuration: BASE, at: 6, audio: false },
    {
        fixture: "two-warnings",
        title: "Both warnings",
        description: "Audio and Wake Lock warnings together: the time and the control bar stay where they are.",
        configuration: BASE,
        at: 6,
        audio: false,
        wakeLockUnavailable: true,
    },
    {
        fixture: "longest-values",
        title: "Longest time and repetition",
        description: "Time 10:00 in repetition 10 of 10: nothing wraps or overflows at 390 px.",
        configuration: LONG,
        at: 5418,
    },
];

function capture(scenario: Scenario): DrillDisplay {
    if (scenario.initializing) return initialDrillDisplay(scenario.configuration);
    const clock = new FixtureClock();
    const run = new DrillRun(scenario.configuration, clock, scenario.audio === false ? null : new SilentFixtureAudio(), () => 0.5);
    run.start();
    clock.time = scenario.at ?? 0;
    run.tick();
    if (scenario.action) run.hide();
    if (scenario.action === "resume") run.resume();
    const display = run.display;
    run.stop();
    return display;
}

export default function PhaseSectionsFixtures() {
    const captured = useMemo(() => SCENARIOS.map((scenario) => ({ scenario, display: capture(scenario) })), []);
    return (
        <section aria-label="Phase sections examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Phase sections</h2>
            <p className="text-muted-foreground text-sm">Production timer view with displays captured from the real drill run on a deterministic clock.</p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {captured.map(({ scenario, display }) => (
                    <Card
                        key={scenario.fixture}
                        data-fixture={`sections-${scenario.fixture}`}
                        data-testid={`sections-${scenario.fixture}`}
                        data-visual-state={scenario.initializing ? "loading" : scenario.audio === false ? "error" : "default"}
                    >
                        <CardHeader>
                            <CardTitle>{scenario.title}</CardTitle>
                            <CardDescription>{scenario.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DrillTimerView
                                display={display}
                                repetitions={scenario.configuration.repetitions}
                                initializing={scenario.initializing ?? false}
                                wakeLockUnavailable={scenario.wakeLockUnavailable ?? false}
                                onCancel={() => undefined}
                                onRestart={() => undefined}
                                onPause={() => undefined}
                                onResume={() => undefined}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}
