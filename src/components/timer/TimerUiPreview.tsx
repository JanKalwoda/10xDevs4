import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import { DrillCompleted } from "@/components/timer/DrillApp";
import DrillTimer from "@/components/timer/DrillTimer";
import DrillTimerView from "@/components/timer/DrillTimerView";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "@/lib/drill-audio";
import type { DrillClock, DrillDisplay } from "@/lib/drill-run";
import { createDrillWakeLockController, type WakeLockProvider, type WakeLockSentinelPort } from "@/lib/drill-wake-lock";
import { createDrillWakeLockSession, type DrillWakeLockSession } from "@/lib/drill-wake-lock-session";
import type { DrillConfiguration } from "@/types";

const fixtures: {
    title: string;
    display: DrillDisplay;
    initializing?: boolean;
    resumePending?: boolean;
    wakeLockUnavailable?: boolean;
}[] = [
    { title: "Loading", display: { phase: { kind: "preparation", durationSeconds: 5 }, remainingSeconds: 5, paused: false, audioAvailable: true }, initializing: true },
    { title: "Preparation", display: { phase: { kind: "preparation", durationSeconds: 5 }, remainingSeconds: 5, paused: false, audioAvailable: true } },
    { title: "Exercise", display: { phase: { kind: "exercise", durationSeconds: 4, repetition: 2 }, remainingSeconds: 3, paused: false, audioAvailable: true } },
    { title: "Rest", display: { phase: { kind: "rest", durationSeconds: 2, repetition: 3 }, remainingSeconds: 2, paused: false, audioAvailable: true } },
    { title: "Standby", display: { phase: { kind: "standby", repetition: 2 }, remainingSeconds: null, paused: false, audioAvailable: true } },
    { title: "Paused", display: { phase: { kind: "exercise", durationSeconds: 4, repetition: 2 }, remainingSeconds: 3, paused: true, audioAvailable: true } },
    {
        title: "Recovery pending",
        display: { phase: { kind: "exercise", durationSeconds: 4, repetition: 2 }, remainingSeconds: 3, paused: true, audioAvailable: true },
        resumePending: true,
    },
    {
        title: "Wake Lock unavailable",
        display: { phase: { kind: "exercise", durationSeconds: 4, repetition: 2 }, remainingSeconds: 3, paused: false, audioAvailable: true },
        wakeLockUnavailable: true,
    },
    { title: "Audio unavailable", display: { phase: { kind: "exercise", durationSeconds: 4, repetition: 2 }, remainingSeconds: 3, paused: false, audioAvailable: false } },
];

type CancelScenario = "A" | "B" | "C" | "D";

const CANCEL_FIXTURE_CONFIGURATION: Readonly<DrillConfiguration> = {
    preparationSeconds: 0,
    exerciseSeconds: 4,
    restSeconds: 0,
    repetitions: 1,
    randomStartEnabled: false,
};

interface LifecycleCounters {
    cancelCount: number;
    completionCount: number;
    audioSchedules: number;
    audioCancellations: number;
    audioCloses: number;
    wakeRequests: number;
    wakeReleases: number;
    resumeAudioRequests: number;
    staleWakeFires: number;
    displayChanges: number;
}

type LifecycleCounter = keyof LifecycleCounters;

const EMPTY_LIFECYCLE_COUNTERS: LifecycleCounters = {
    cancelCount: 0,
    completionCount: 0,
    audioSchedules: 0,
    audioCancellations: 0,
    audioCloses: 0,
    wakeRequests: 0,
    wakeReleases: 0,
    resumeAudioRequests: 0,
    staleWakeFires: 0,
    displayChanges: 0,
};

class FixtureAudio implements DrillAudioPort {
    available = true;
    private readonly cues: { cue: DrillCue; at: number; end: number }[] = [];
    private unavailableHandler: (() => void) | undefined;

    constructor(private readonly increment: (counter: LifecycleCounter) => void) {}

    get scheduleEvidence() {
        return this.cues.map(({ cue, at }) => ({ cue, expectedStart: at, scheduledStart: at, deviationSeconds: 0 }));
    }

    schedule(cue: DrillCue, at: number): ScheduledCue {
        const end = at + CUE_DURATION[cue];
        this.cues.push({ cue, at, end });
        this.increment("audioSchedules");
        return { start: at, end };
    }

    cancel() {
        this.increment("audioCancellations");
    }

    close() {
        this.available = false;
        this.increment("audioCloses");
    }

    onUnavailable(handler: () => void) {
        this.unavailableHandler = handler;
    }

    fail() {
        this.available = false;
        this.unavailableHandler?.();
    }
}

class FixtureClock implements DrillClock {
    private time = 0;
    private nextWake = 0;
    private readonly wakes = new Map<number, () => void>();
    private readonly clearedWakes: (() => void)[] = [];

    now() {
        return this.time;
    }

    setWake(callback: () => void) {
        const id = ++this.nextWake;
        this.wakes.set(id, callback);
        return id;
    }

    clearWake(handle: unknown) {
        const id = handle as number;
        const callback = this.wakes.get(id);
        if (callback) this.clearedWakes.push(callback);
        this.wakes.delete(id);
    }

    advancePastRunEnd() {
        this.time = 20;
    }

    fireRetainedWake() {
        const callback = this.clearedWakes.pop();
        if (!callback) return false;
        callback();
        return true;
    }
}

class FixtureWakeLockSentinel implements WakeLockSentinelPort {
    private readonly listeners = new Set<() => void>();

    constructor(private readonly increment: (counter: LifecycleCounter) => void) {}

    release(): Promise<void> {
        this.increment("wakeReleases");
        return Promise.resolve();
    }

    addEventListener(_type: "release", listener: () => void) {
        this.listeners.add(listener);
    }

    removeEventListener(_type: "release", listener: () => void) {
        this.listeners.delete(listener);
    }
}

interface HeldTimerHarness {
    scenario: CancelScenario;
    audio: Promise<DrillAudioPort | null>;
    clock: FixtureClock;
    wakeLock: DrillWakeLockSession;
    createResumeAudio: () => Promise<DrillAudioPort | null>;
    resolveInitialAudio: () => void;
    resolveResumeAudio: () => void;
    resolveWakeGrants: () => void;
}

function createHeldTimerHarness(scenario: CancelScenario, increment: (counter: LifecycleCounter) => void): HeldTimerHarness {
    const clock = new FixtureClock();
    let resolveInitial!: (audio: DrillAudioPort | null) => void;
    let initialResolved = false;
    const audio = new Promise<DrillAudioPort | null>((resolve) => {
        resolveInitial = resolve;
    });
    if (scenario !== "A") {
        initialResolved = true;
        resolveInitial(new FixtureAudio(increment));
    }

    let resolveResume!: (audio: DrillAudioPort | null) => void;
    let resumePending = false;
    const pendingWakeGrants: ((sentinel: WakeLockSentinelPort) => void)[] = [];
    const heldWakeRequest = scenario === "A" ? 1 : scenario === "D" ? 2 : -1;
    let wakeRequestCount = 0;
    const provider: WakeLockProvider = {
        request() {
            wakeRequestCount++;
            increment("wakeRequests");
            const requestNumber = wakeRequestCount;
            if (requestNumber === heldWakeRequest) {
                return new Promise((resolve) => pendingWakeGrants.push(resolve));
            }
            return Promise.resolve(new FixtureWakeLockSentinel(increment));
        },
    };
    const controller = createDrillWakeLockController(provider);
    const wakeLock = createDrillWakeLockSession(controller, () => true);
    void wakeLock.requestForVisibleGesture();

    return {
        scenario,
        audio,
        clock,
        wakeLock,
        createResumeAudio: () => {
            increment("resumeAudioRequests");
            if (scenario === "D") {
                resumePending = true;
                return new Promise((resolve) => {
                    resolveResume = resolve;
                });
            }
            return Promise.resolve(new FixtureAudio(increment));
        },
        resolveInitialAudio: () => {
            if (initialResolved) return;
            initialResolved = true;
            resolveInitial(new FixtureAudio(increment));
        },
        resolveResumeAudio: () => {
            if (!resumePending) return;
            resumePending = false;
            resolveResume(new FixtureAudio(increment));
        },
        resolveWakeGrants: () => {
            for (const resolve of pendingWakeGrants.splice(0)) resolve(new FixtureWakeLockSentinel(increment));
        },
    };
}

function HeldMountedCancelFixture() {
    const [harness, setHarness] = useState<HeldTimerHarness | null>(null);
    const [mounted, setMounted] = useState(false);
    const [message, setMessage] = useState("");
    const [counters, setCounters] = useState(EMPTY_LIFECYCLE_COUNTERS);
    const [displayAtCancel, setDisplayAtCancel] = useState("Not cancelled");
    const timerRegionRef = useRef<HTMLDivElement>(null);
    const increment = useCallback((counter: LifecycleCounter) => {
        setCounters((current) => ({ ...current, [counter]: current[counter] + 1 }));
    }, []);

    useEffect(() => {
        if (!harness || !mounted || !timerRegionRef.current) return;
        const region = timerRegionRef.current;
        let lastDisplay: string | null = null;
        const updateDisplayCount = () => {
            const timerText = region.querySelector("[role='timer']")?.textContent;
            const visibleDisplay = timerText ? timerText.trim() : "No visible time";
            if (lastDisplay === null) {
                lastDisplay = visibleDisplay;
                return;
            }
            if (lastDisplay !== visibleDisplay) {
                lastDisplay = visibleDisplay;
                increment("displayChanges");
            }
        };
        updateDisplayCount();
        const observer = new MutationObserver(updateDisplayCount);
        observer.observe(region, { childList: true, characterData: true, subtree: true });
        return () => {
            observer.disconnect();
        };
    }, [harness, increment, mounted]);

    const onCancel = useCallback(() => {
        if (!harness) return;
        const timerText = timerRegionRef.current?.querySelector("[role='timer']")?.textContent;
        setDisplayAtCancel(timerText ? timerText.trim() : "No visible time");
        setMessage("Cancel recorded. DrillTimer remains mounted until the separate Unmount control is used.");
        increment("cancelCount");
    }, [harness, increment]);
    const onComplete = useCallback(() => {
        if (!harness) return;
        setMessage("Completion callback recorded.");
        increment("completionCount");
    }, [harness, increment]);

    function mountScenario(scenario: CancelScenario) {
        if (mounted) return;
        setCounters(EMPTY_LIFECYCLE_COUNTERS);
        setDisplayAtCancel("Not cancelled");
        setMessage(`Scenario ${scenario} mounted and held for lifecycle checks.`);
        setHarness(createHeldTimerHarness(scenario, increment));
        setMounted(true);
    }

    return (
        <Card data-fixture="held-mounted-cancel" data-testid="held-mounted-cancel-fixture">
            <CardHeader>
                <CardTitle>Held-mounted Cancel lifecycle gate</CardTitle>
                <CardDescription>Real DrillTimer; Cancel records the parent callback and keeps the timer mounted until explicit teardown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                        type="button"
                        variant="outline"
                        data-scenario="A"
                        disabled={mounted}
                        onClick={() => {
                            mountScenario("A");
                        }}
                    >
                        Mount A — initial audio pending
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        data-scenario="B"
                        disabled={mounted}
                        onClick={() => {
                            mountScenario("B");
                        }}
                    >
                        Mount B — active stale wake
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        data-scenario="C"
                        disabled={mounted}
                        onClick={() => {
                            mountScenario("C");
                        }}
                    >
                        Mount C — paused
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        data-scenario="D"
                        disabled={mounted}
                        onClick={() => {
                            mountScenario("D");
                        }}
                    >
                        Mount D — Resume pending
                    </Button>
                </div>
                {harness && (
                    <>
                        <p role="status" data-testid="lifecycle-message" className="text-muted-foreground text-sm">
                            {message}
                        </p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <dt>Cancel callbacks</dt>
                            <dd data-counter="cancel">{counters.cancelCount}</dd>
                            <dt>Completion callbacks</dt>
                            <dd data-counter="complete">{counters.completionCount}</dd>
                            <dt>Audio schedules / cancellations / closes</dt>
                            <dd data-counter="audio">
                                {counters.audioSchedules} / {counters.audioCancellations} / {counters.audioCloses}
                            </dd>
                            <dt>Wake Lock requests / sentinel releases</dt>
                            <dd data-counter="wake">
                                {counters.wakeRequests} / {counters.wakeReleases}
                            </dd>
                            <dt>Resume audio requests</dt>
                            <dd data-counter="resume-audio">{counters.resumeAudioRequests}</dd>
                            <dt>Stale clock wakes fired</dt>
                            <dd data-counter="stale-wake">{counters.staleWakeFires}</dd>
                            <dt>Visible timer changes</dt>
                            <dd data-counter="display">{counters.displayChanges}</dd>
                            <dt>Time at Cancel</dt>
                            <dd data-testid="display-at-cancel">{displayAtCancel}</dd>
                        </dl>
                        {mounted ? (
                            <div ref={timerRegionRef} data-testid="held-mounted-timer" className="border-border rounded-md border p-4">
                                <DrillTimer
                                    configuration={CANCEL_FIXTURE_CONFIGURATION}
                                    audio={harness.audio}
                                    wakeLock={harness.wakeLock}
                                    clock={harness.clock}
                                    createResumeAudio={harness.createResumeAudio}
                                    onCancel={onCancel}
                                    onComplete={onComplete}
                                />
                            </div>
                        ) : (
                            <p role="status" data-testid="timer-unmounted" className="text-muted-foreground text-sm">
                                Timer unmounted; counters are retained for idempotence checks.
                            </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {harness.scenario === "A" && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!mounted}
                                    onClick={() => {
                                        harness.resolveInitialAudio();
                                        setMessage("Late initial audio settled while DrillTimer remains mounted.");
                                    }}
                                >
                                    Resolve late initial audio
                                </Button>
                            )}
                            {harness.scenario === "B" && mounted && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            harness.clock.advancePastRunEnd();
                                            setMessage("Fake clock advanced beyond the run end.");
                                        }}
                                    >
                                        Advance fake clock past run end
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            if (harness.clock.fireRetainedWake()) {
                                                increment("staleWakeFires");
                                                setMessage("Latest retained clock wake fired after Cancel.");
                                            } else {
                                                setMessage("No retained clock wake was available to fire.");
                                            }
                                        }}
                                    >
                                        Fire retained stale clock wake
                                    </Button>
                                </>
                            )}
                            {harness.scenario === "D" && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!mounted}
                                    onClick={() => {
                                        harness.resolveResumeAudio();
                                        setMessage("Late Resume audio settled while DrillTimer remains mounted.");
                                    }}
                                >
                                    Resolve late Resume audio
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!mounted}
                                onClick={() => {
                                    harness.resolveWakeGrants();
                                    setMessage("Pending Wake Lock grants settled while DrillTimer remains mounted.");
                                }}
                            >
                                Resolve pending Wake Lock grants
                            </Button>
                            {mounted && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setMounted(false);
                                        setMessage("Timer unmounted explicitly.");
                                    }}
                                >
                                    Unmount held timer
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function ConfigurationFixture({ empty = false }: { empty?: boolean }) {
    const [values, setValues] = useState<DrillConfigInput>({
        preparation: empty ? "" : "0:05",
        exercise: empty ? "" : "0:04",
        rest: empty ? "" : "0:02",
        repetitions: empty ? "" : "3",
        randomStartEnabled: false,
    });
    const [valid, setValid] = useState(false);
    return (
        <Card data-fixture={empty ? "error" : "default"}>
            <CardHeader>
                <CardTitle>{empty ? "Empty fields / validation" : "Default configuration"}</CardTitle>
                <CardDescription>{empty ? "Press Start to show real validation errors." : "Production form; validation only, no timer or audio."}</CardDescription>
            </CardHeader>
            <CardContent>
                <DrillConfigForm
                    values={values}
                    onValuesChange={setValues}
                    onStart={() => {
                        setValid(true);
                    }}
                />
                {valid && (
                    <p role="status" className="text-muted-foreground mt-4 text-sm">
                        Configuration valid. Preview does not run a drill.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function TimerUiPreview() {
    const id = useId();
    const [randomStartEnabled, setRandomStartEnabled] = useState(false);
    const [previewStatus, setPreviewStatus] = useState("");

    return (
        <main className="bg-background text-foreground mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-8">
            <header className="space-y-3">
                <h1 className="text-2xl font-semibold">Timer UI preview</h1>
                <p className="text-muted-foreground text-sm">Shared controls. Use Tab to inspect focus and Space to toggle the checkbox.</p>
                {previewStatus && (
                    <p role="status" className="text-muted-foreground text-sm">
                        {previewStatus}
                    </p>
                )}
                <nav aria-label="Preview theme" className="flex gap-2">
                    <Button asChild variant="outline">
                        <a href="?theme=light">Light preview</a>
                    </Button>
                    <Button asChild variant="outline">
                        <a href="?theme=dark">Dark preview</a>
                    </Button>
                </nav>
            </header>

            <ConfigurationFixture />
            <ConfigurationFixture empty />
            {fixtures.map(({ title, display, initializing, resumePending, wakeLockUnavailable }) => (
                <Card key={title} data-fixture={title.toLowerCase().replaceAll(" ", "-")}>
                    <CardHeader>
                        <CardTitle>{title} fixture</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DrillTimerView
                            display={display}
                            repetitions={3}
                            initializing={initializing ?? false}
                            resumePending={resumePending ?? false}
                            wakeLockUnavailable={wakeLockUnavailable ?? false}
                            onCancel={() => {
                                setPreviewStatus(`${title} fixture cancelled; the preview remains mounted.`);
                            }}
                            onPause={() => {
                                setPreviewStatus(`${title} fixture paused.`);
                            }}
                            onResume={() => {
                                setPreviewStatus(`${title} fixture resumed.`);
                            }}
                        />
                    </CardContent>
                </Card>
            ))}
            <HeldMountedCancelFixture />
            <Card data-fixture="completed">
                <CardHeader>
                    <CardTitle>Empty timer state — N/A</CardTitle>
                    <CardDescription>phase: null is routed to the completion view; the timer never renders an empty phase.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DrillCompleted onReturn={() => undefined} />
                </CardContent>
            </Card>

            <Card data-fixture="disabled">
                <CardHeader>
                    <CardTitle>Configuration controls</CardTitle>
                    <CardDescription>Default, error and disabled examples.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-preparation`}>Preparation</Label>
                        <Input id={`${id}-preparation`} name="preparation" defaultValue="0:05" aria-describedby={`${id}-preparation-hint`} />
                        <p id={`${id}-preparation-hint`} className="text-muted-foreground text-sm">
                            0:00 to 10:00, in m:ss format.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-exercise`}>Exercise (error example)</Label>
                        <Input id={`${id}-exercise`} name="exercise" defaultValue="0:00" aria-invalid="true" aria-describedby={`${id}-exercise-hint ${id}-exercise-error`} />
                        <p id={`${id}-exercise-hint`} className="text-muted-foreground text-sm">
                            0:01 to 10:00, in m:ss format.
                        </p>
                        <p id={`${id}-exercise-error`} className="text-destructive text-sm">
                            Enter an exercise time from 0:01 to 10:00.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-repetitions`} className="text-muted-foreground">
                            Repetitions (disabled example)
                        </Label>
                        <Input id={`${id}-repetitions`} name="repetitions" inputMode="numeric" defaultValue="3" disabled aria-describedby={`${id}-repetitions-hint`} />
                        <p id={`${id}-repetitions-hint`} className="text-muted-foreground text-sm">
                            Whole number from 1 to 100.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`${id}-random-start`}
                                name="randomStartEnabled"
                                checked={randomStartEnabled}
                                onCheckedChange={(checked) => {
                                    setRandomStartEnabled(checked === true);
                                }}
                                aria-describedby={`${id}-random-start-hint`}
                            />
                            <Label htmlFor={`${id}-random-start`}>Random start</Label>
                        </div>
                        <p id={`${id}-random-start-hint`} className="text-muted-foreground text-sm">
                            Wait a random 1–5 seconds before exercise starts.
                        </p>
                        <p className="text-muted-foreground text-sm">Current value: {randomStartEnabled ? "true" : "false"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox id={`${id}-disabled-checkbox`} disabled checked />
                        <Label htmlFor={`${id}-disabled-checkbox`} className="text-muted-foreground">
                            Disabled checkbox
                        </Label>
                    </div>
                    <Button type="button" disabled className="w-full">
                        Start (disabled example)
                    </Button>
                </CardContent>
            </Card>

            <Alert>
                <AlertTitle>Audio unavailable</AlertTitle>
                <AlertDescription>The drill will continue silently.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
                <AlertTitle>Check the configuration</AlertTitle>
                <AlertDescription>Correct the exercise time before starting.</AlertDescription>
            </Alert>
        </main>
    );
}
