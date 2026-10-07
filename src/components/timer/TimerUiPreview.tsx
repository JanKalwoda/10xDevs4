import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import SignalPreviewFixtures from "@/components/timer/SignalPreviewFixtures";
import PhaseSectionsFixtures from "@/components/timer/PhaseSectionsFixtures";
import CreateDrillFixtures from "@/components/timer/CreateDrillFixtures";
import EditDrillFixtures from "@/components/timer/EditDrillFixtures";
import SavedDrillFixtures from "@/components/timer/SavedDrillFixtures";
import DeleteDrillFixtures from "@/components/timer/DeleteDrillFixtures";
import { DrillCompleted } from "@/components/timer/DrillApp";
import DrillTimer from "@/components/timer/DrillTimer";
import DrillTimerView from "@/components/timer/DrillTimerView";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { createDrillRunIdentityState } from "@/lib/drill-run-identity";
import type { DrillVisibilityPort } from "@/lib/drill-visibility";
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
    {
        title: "Loading",
        display: {
            phase: { kind: "preparation", durationSeconds: 5 },
            remainingSeconds: 5,
            next: { kind: "exercise", durationSeconds: 4, repetition: 1 },
            paused: false,
            audioAvailable: true,
        },
        initializing: true,
    },
    {
        title: "Preparation",
        display: {
            phase: { kind: "preparation", durationSeconds: 5 },
            remainingSeconds: 5,
            next: { kind: "exercise", durationSeconds: 4, repetition: 1 },
            paused: false,
            audioAvailable: true,
        },
    },
    {
        title: "Exercise",
        display: {
            phase: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            remainingSeconds: 3,
            next: { kind: "rest", durationSeconds: 2, repetition: 2 },
            paused: false,
            audioAvailable: true,
        },
    },
    { title: "Rest", display: { phase: { kind: "rest", durationSeconds: 2, repetition: 3 }, remainingSeconds: 2, next: null, paused: false, audioAvailable: true } },
    {
        title: "Standby",
        display: {
            phase: { kind: "standby", repetition: 2 },
            remainingSeconds: null,
            next: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            paused: false,
            audioAvailable: true,
        },
    },
    {
        title: "Paused",
        display: {
            phase: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            remainingSeconds: 3,
            next: { kind: "rest", durationSeconds: 2, repetition: 2 },
            paused: true,
            audioAvailable: true,
        },
    },
    {
        title: "Recovery pending",
        display: {
            phase: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            remainingSeconds: 3,
            next: { kind: "rest", durationSeconds: 2, repetition: 2 },
            paused: true,
            audioAvailable: true,
        },
        resumePending: true,
    },
    {
        title: "Wake Lock unavailable",
        display: {
            phase: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            remainingSeconds: 3,
            next: { kind: "rest", durationSeconds: 2, repetition: 2 },
            paused: false,
            audioAvailable: true,
        },
        wakeLockUnavailable: true,
    },
    {
        title: "Audio unavailable",
        display: {
            phase: { kind: "exercise", durationSeconds: 4, repetition: 2 },
            remainingSeconds: 3,
            next: { kind: "rest", durationSeconds: 2, repetition: 2 },
            paused: false,
            audioAvailable: false,
        },
    },
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
    restartCount: number;
    rejectedCompletions: number;
    staleIntents: number;
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
    restartCount: 0,
    rejectedCompletions: 0,
    staleIntents: 0,
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

interface CapturedWake {
    id: number;
    callback: () => void;
    invocations: number;
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

    advanceBy(seconds: number) {
        this.time += seconds;
    }

    /** Captures the exact callback of the newest scheduled wake; it survives clearWake. */
    captureActiveWake(): CapturedWake | null {
        let captured: CapturedWake | null = null;
        for (const [id, callback] of this.wakes) {
            const wake: CapturedWake = {
                id,
                invocations: 0,
                callback: () => {
                    wake.invocations += 1;
                    callback();
                },
            };
            captured = wake;
        }
        return captured;
    }

    /** True exactly when the captured callback was invoked (observed through its own invocation counter). */
    fireCapturedWake(captured: CapturedWake) {
        const before = captured.invocations;
        captured.callback();
        return captured.invocations > before;
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

class FixtureVisibility implements DrillVisibilityPort {
    private hidden = false;
    private readonly listeners = new Set<() => void>();

    isHidden() {
        return this.hidden;
    }

    subscribe(onChange: () => void) {
        this.listeners.add(onChange);
        return () => {
            this.listeners.delete(onChange);
        };
    }

    setHidden(hidden: boolean) {
        if (this.hidden === hidden) return;
        this.hidden = hidden;
        for (const listener of [...this.listeners]) listener();
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

function createHeldTimerHarness(scenario: CancelScenario, increment: (counter: LifecycleCounter) => void, visibility?: FixtureVisibility): HeldTimerHarness {
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
    const wakeLock = visibility
        ? createDrillWakeLockSession(
              controller,
              () => !visibility.isHidden(),
              (onHidden) =>
                  visibility.subscribe(() => {
                      if (visibility.isHidden()) onHidden();
                  }),
          )
        : createDrillWakeLockSession(controller, () => true);
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

type CancelControlState = "active" | "paused" | "resuming";

function CancelControlTransitionFixture() {
    const [state, setState] = useState<CancelControlState>("active");
    const [cancelMessage, setCancelMessage] = useState("");
    const display: DrillDisplay = {
        phase: { kind: "exercise", durationSeconds: 45, repetition: 2 },
        remainingSeconds: 28,
        next: { kind: "rest", durationSeconds: 2, repetition: 2 },
        paused: state !== "active",
        audioAvailable: false,
    };

    return (
        <Card data-fixture="cancel-control-transition" data-testid="cancel-control-transition-fixture" data-transition-state={state}>
            <CardHeader>
                <CardTitle>Cancel and Pause/Resume control states</CardTitle>
                <CardDescription>Use the right control to move through Active, Paused, and pending Resume; both fallback messages remain visible.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <DrillTimerView
                    display={display}
                    repetitions={3}
                    initializing={false}
                    resumePending={state === "resuming"}
                    wakeLockUnavailable
                    onCancel={() => {
                        setCancelMessage("Cancel was activated; this preview fixture remains mounted for inspection.");
                    }}
                    onRestart={() => {
                        setCancelMessage("Restart was activated; this preview fixture remains mounted for inspection.");
                    }}
                    onPause={() => {
                        setState("paused");
                    }}
                    onResume={() => {
                        setState("resuming");
                    }}
                />
                {cancelMessage && (
                    <p data-testid="cancel-preview-response" role="status" className="text-muted-foreground text-sm">
                        {cancelMessage}
                    </p>
                )}
            </CardContent>
        </Card>
    );
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
    const onRestart = useCallback(() => {
        if (!harness) return;
        setMessage("Restart callback recorded. Replacement runs are exercised by the Held-mounted Restart lifecycle gate.");
    }, [harness]);

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
                                    onRestart={onRestart}
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

const RESTART_FIXTURE_CONFIGURATION: Readonly<DrillConfiguration> = {
    preparationSeconds: 3,
    exerciseSeconds: 4,
    restSeconds: 0,
    repetitions: 2,
    randomStartEnabled: false,
};

type RunOutcome = "current" | "retired" | "cancelled" | "completed";

interface RestartBundle {
    identity: number;
    harness: HeldTimerHarness;
    mounted: boolean;
    outcome: RunOutcome;
    capturedWake: CapturedWake | null;
    onComplete: () => void;
    onCancel: () => void;
    onRestart: () => void;
}

/** Parent stand-in that composes the production identity guard with the production DrillTimer. */
class RestartLab {
    readonly identityState = createDrillRunIdentityState();
    readonly visibility = new FixtureVisibility();
    bundles: RestartBundle[] = [];
    readonly counters = new Map<number, LifecycleCounters>();
    message = "No run started.";
    private version = 0;
    private readonly listeners = new Set<() => void>();

    readonly subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    readonly getVersion = () => this.version;

    private emit() {
        this.version++;
        for (const listener of [...this.listeners]) listener();
    }

    private count(identity: number, counter: LifecycleCounter) {
        const current = this.counters.get(identity) ?? EMPTY_LIFECYCLE_COUNTERS;
        this.counters.set(identity, { ...current, [counter]: current[counter] + 1 });
        this.emit();
    }

    private find(identity: number) {
        return this.bundles.find((bundle) => bundle.identity === identity);
    }

    /** Synchronously allocates identity and a fresh resource bundle, like the production Start/Restart gesture. */
    private createBundle(scenario: CancelScenario): RestartBundle {
        const identity = this.identityState.begin();
        this.counters.set(identity, EMPTY_LIFECYCLE_COUNTERS);
        const bundle: RestartBundle = {
            identity,
            harness: createHeldTimerHarness(
                scenario,
                (counter) => {
                    this.count(identity, counter);
                },
                this.visibility,
            ),
            mounted: true,
            outcome: "current",
            capturedWake: null,
            onComplete: () => {
                this.complete(identity);
            },
            onCancel: () => {
                this.cancel(identity);
            },
            onRestart: () => {
                this.restart(identity);
            },
        };
        this.bundles = [...this.bundles, bundle];
        return bundle;
    }

    start(scenario: CancelScenario) {
        if (this.bundles.length) return;
        this.createBundle(scenario);
        this.message = `Run 1 started in scenario ${scenario}.`;
        this.emit();
    }

    restart(identity: number) {
        const bundle = this.find(identity);
        if (!bundle || !this.identityState.retire(identity)) {
            this.count(identity, "staleIntents");
            this.message = `Restart from retired run ${identity} rejected.`;
            this.emit();
            return;
        }
        bundle.outcome = "retired";
        this.count(identity, "restartCount");
        const replacement = this.createBundle("A");
        this.message = `Run ${identity} restarted; run ${replacement.identity} owns the timer.`;
        this.emit();
    }

    cancel(identity: number) {
        const bundle = this.find(identity);
        if (!bundle || !this.identityState.retire(identity)) {
            this.count(identity, "staleIntents");
            this.message = `Cancel from retired run ${identity} rejected.`;
            this.emit();
            return;
        }
        bundle.outcome = "cancelled";
        this.count(identity, "cancelCount");
        this.message = `Run ${identity} cancelled; the timer stays mounted until Unmount.`;
        this.emit();
    }

    complete(identity: number) {
        const bundle = this.find(identity);
        const accepted =
            bundle !== undefined &&
            this.identityState.complete(identity, () => {
                bundle.outcome = "completed";
                this.count(identity, "completionCount");
                this.message = `Run ${identity} completed.`;
            });
        if (!accepted) {
            this.count(identity, "rejectedCompletions");
            this.message = `Completion from retired run ${identity} rejected.`;
        }
        this.emit();
    }

    replayIntent(identity: number, intent: "restart" | "cancel" | "complete") {
        const bundle = this.find(identity);
        if (!bundle) return;
        if (intent === "restart") bundle.onRestart();
        else if (intent === "cancel") bundle.onCancel();
        else bundle.onComplete();
    }

    advance(identity: number, seconds: number) {
        this.find(identity)?.harness.clock.advanceBy(seconds);
        this.message = `Run ${identity} clock advanced by ${seconds}s.`;
        this.emit();
    }

    advancePastEnd(identity: number) {
        this.find(identity)?.harness.clock.advancePastRunEnd();
        this.message = `Run ${identity} clock advanced past the run end.`;
        this.emit();
    }

    captureWake(identity: number) {
        const bundle = this.find(identity);
        if (!bundle) return;
        bundle.capturedWake = bundle.harness.clock.captureActiveWake();
        this.message = bundle.capturedWake ? `Run ${identity} wake ${bundle.capturedWake.id} captured.` : `Run ${identity} has no scheduled wake to capture.`;
        this.emit();
    }

    fireCapturedWake(identity: number) {
        const bundle = this.find(identity);
        if (!bundle?.capturedWake) {
            this.message = `Run ${identity} has no captured wake.`;
            this.emit();
            return;
        }
        const fired = bundle.harness.clock.fireCapturedWake(bundle.capturedWake);
        if (fired) this.count(identity, "staleWakeFires");
        this.message = `Run ${identity} captured wake ${bundle.capturedWake.id} fired: ${fired}.`;
        this.emit();
    }

    resolve(identity: number, resource: "audio" | "resume" | "wake") {
        const harness = this.find(identity)?.harness;
        if (!harness) return;
        if (resource === "audio") harness.resolveInitialAudio();
        else if (resource === "resume") harness.resolveResumeAudio();
        else harness.resolveWakeGrants();
        this.message = `Run ${identity} ${resource} resolved.`;
        this.emit();
    }

    setHidden(hidden: boolean) {
        this.visibility.setHidden(hidden);
        this.message = hidden ? "Fixture page hidden." : "Fixture page visible.";
        this.emit();
    }

    unmount(identity: number) {
        const bundle = this.find(identity);
        if (!bundle?.mounted) return;
        bundle.mounted = false;
        this.message = `Run ${identity} unmounted.`;
        this.emit();
    }
}

const RESTART_COUNTER_LABELS: [LifecycleCounter, string][] = [
    ["audioSchedules", "audio-schedules"],
    ["audioCancellations", "audio-cancellations"],
    ["audioCloses", "audio-closes"],
    ["wakeRequests", "wake-requests"],
    ["wakeReleases", "wake-releases"],
    ["resumeAudioRequests", "resume-audio-requests"],
    ["staleWakeFires", "stale-wake-fires"],
    ["completionCount", "completions"],
    ["rejectedCompletions", "rejected-completions"],
    ["cancelCount", "cancels"],
    ["restartCount", "restarts"],
    ["staleIntents", "stale-intents"],
];

const RESTART_SCENARIOS: { scenario: CancelScenario; label: string }[] = [
    { scenario: "A", label: "initial audio pending" },
    { scenario: "B", label: "active" },
    { scenario: "C", label: "paused (use Pause)" },
    { scenario: "D", label: "pending Resume (Pause, then Resume)" },
];

function RunActionButton({ label, disabled, onAction }: { label: string; disabled?: boolean; onAction: () => void }) {
    return (
        <Button type="button" variant="outline" disabled={disabled} onClick={onAction}>
            {label}
        </Button>
    );
}

function HeldMountedRestartFixture() {
    const [lab] = useState(() => new RestartLab());
    useSyncExternalStore(lab.subscribe, lab.getVersion, lab.getVersion);
    const latest = lab.bundles.at(-1);

    return (
        <Card data-fixture="held-mounted-restart" data-testid="held-mounted-restart-fixture">
            <CardHeader>
                <CardTitle>Held-mounted Restart lifecycle gate</CardTitle>
                <CardDescription>
                    Real DrillTimer and run-identity guard. Each Restart creates a new keyed child and resource bundle; retired children stay mounted (hidden) until unmounted.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!latest && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {RESTART_SCENARIOS.map(({ scenario, label }) => (
                            <Button
                                key={scenario}
                                type="button"
                                variant="outline"
                                data-restart-scenario={scenario}
                                onClick={() => {
                                    lab.start(scenario);
                                }}
                            >
                                {`Start run ${scenario} — ${label}`}
                            </Button>
                        ))}
                    </div>
                )}
                <p role="status" data-testid="restart-message" className="text-muted-foreground text-sm">
                    {lab.message}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <RunActionButton
                        label="Hide fixture page"
                        onAction={() => {
                            lab.setHidden(true);
                        }}
                    />
                    <RunActionButton
                        label="Show fixture page"
                        onAction={() => {
                            lab.setHidden(false);
                        }}
                    />
                    <span data-testid="restart-visibility" className="text-muted-foreground text-sm">
                        {lab.visibility.isHidden() ? "hidden" : "visible"}
                    </span>
                </div>
                {lab.bundles.map((bundle) => (
                    <div key={bundle.identity} hidden={bundle !== latest} data-restart-slot={bundle.identity}>
                        {bundle.mounted ? (
                            <div data-testid="restart-timer" className="border-border rounded-md border p-4">
                                <DrillTimer
                                    configuration={RESTART_FIXTURE_CONFIGURATION}
                                    audio={bundle.harness.audio}
                                    wakeLock={bundle.harness.wakeLock}
                                    clock={bundle.harness.clock}
                                    visibility={lab.visibility}
                                    createResumeAudio={bundle.harness.createResumeAudio}
                                    onComplete={bundle.onComplete}
                                    onCancel={bundle.onCancel}
                                    onRestart={bundle.onRestart}
                                />
                            </div>
                        ) : (
                            <p role="status" className="text-muted-foreground text-sm">
                                Run {bundle.identity} timer unmounted.
                            </p>
                        )}
                    </div>
                ))}
                {lab.bundles.map((bundle) => {
                    const run = bundle.identity;
                    const counters = lab.counters.get(run) ?? EMPTY_LIFECYCLE_COUNTERS;
                    return (
                        <section key={run} aria-label={`Run ${run} controls`} data-run-controls={run} className="border-border space-y-2 rounded-md border p-3">
                            <h3 className="text-sm font-semibold">
                                Run {run} — <span data-run-outcome={run}>{bundle.outcome}</span> — {bundle.mounted ? "mounted" : "unmounted"}
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-run-counters={run}>
                                {RESTART_COUNTER_LABELS.map(([counter, label]) => (
                                    <div key={counter} className="contents">
                                        <dt>{label}</dt>
                                        <dd data-counter={label}>{counters[counter]}</dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <RunActionButton
                                    label={`Resolve initial audio (run ${run})`}
                                    onAction={() => {
                                        lab.resolve(run, "audio");
                                    }}
                                />
                                <RunActionButton
                                    label={`Resolve Resume audio (run ${run})`}
                                    onAction={() => {
                                        lab.resolve(run, "resume");
                                    }}
                                />
                                <RunActionButton
                                    label={`Resolve Wake Lock grants (run ${run})`}
                                    onAction={() => {
                                        lab.resolve(run, "wake");
                                    }}
                                />
                                <RunActionButton
                                    label={`Advance clock 4s (run ${run})`}
                                    onAction={() => {
                                        lab.advance(run, 4);
                                    }}
                                />
                                <RunActionButton
                                    label={`Advance clock past end (run ${run})`}
                                    onAction={() => {
                                        lab.advancePastEnd(run);
                                    }}
                                />
                                <RunActionButton
                                    label={`Capture scheduled wake (run ${run})`}
                                    onAction={() => {
                                        lab.captureWake(run);
                                    }}
                                />
                                <RunActionButton
                                    label={`Fire captured wake (run ${run})`}
                                    onAction={() => {
                                        lab.fireCapturedWake(run);
                                    }}
                                />
                                <RunActionButton
                                    label={`Invoke completion callback (run ${run})`}
                                    onAction={() => {
                                        lab.replayIntent(run, "complete");
                                    }}
                                />
                                <RunActionButton
                                    label={`Replay Restart intent (run ${run})`}
                                    onAction={() => {
                                        lab.replayIntent(run, "restart");
                                    }}
                                />
                                <RunActionButton
                                    label={`Replay Cancel intent (run ${run})`}
                                    onAction={() => {
                                        lab.replayIntent(run, "cancel");
                                    }}
                                />
                                <RunActionButton
                                    label={`Unmount run ${run}`}
                                    disabled={!bundle.mounted}
                                    onAction={() => {
                                        lab.unmount(run);
                                    }}
                                />
                            </div>
                        </section>
                    );
                })}
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
        <Card data-fixture={empty ? "error" : "default"} data-testid={empty ? "timer-error-state" : "timer-default-state"} data-visual-state={empty ? "error" : "default"}>
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
        <main className="bg-background text-foreground mx-auto min-h-screen w-full max-w-6xl space-y-6 px-4 py-8">
            <header className="space-y-3">
                <h1 className="text-2xl font-semibold">Timer UI preview</h1>
                <p className="text-muted-foreground text-sm">Inspect default, hover, focus-visible, disabled, error, empty, and loading states in both themes.</p>
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

            <div className="mx-auto w-full max-w-2xl">
                <CancelControlTransitionFixture />
            </div>
            <section aria-label="Configuration state examples" className="grid gap-6 lg:grid-cols-3">
                <ConfigurationFixture />
                <ConfigurationFixture empty />
                <Card data-fixture="disabled" data-testid="timer-disabled-state" data-visual-state="disabled">
                    <CardHeader>
                        <CardTitle>Configuration controls</CardTitle>
                        <CardDescription>Disabled controls remain readable.</CardDescription>
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
            </section>
            <SignalPreviewFixtures />
            <PhaseSectionsFixtures />
            <CreateDrillFixtures />
            <EditDrillFixtures />
            <SavedDrillFixtures />
            <DeleteDrillFixtures />
            <section aria-label="Timer phase state examples" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {fixtures.map(({ title, display, initializing, resumePending, wakeLockUnavailable }) => (
                    <Card
                        key={title}
                        data-fixture={title.toLowerCase().replaceAll(" ", "-")}
                        data-testid={`timer-${title.toLowerCase().replaceAll(" ", "-")}-fixture`}
                        data-visual-state={initializing ? "loading" : resumePending ? "disabled" : "default"}
                    >
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
                                onRestart={() => {
                                    setPreviewStatus(`${title} fixture restarted; the preview remains mounted.`);
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
            </section>
            <HeldMountedCancelFixture />
            <HeldMountedRestartFixture />
            <section aria-label="Completion and empty timer state" className="grid gap-6 lg:grid-cols-2">
                <Card data-fixture="completed" data-testid="timer-empty-state" data-visual-state="empty">
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
                        <CardTitle>Random start control</CardTitle>
                        <CardDescription>Enabled checkbox example.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
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
                    </CardContent>
                </Card>
            </section>
            <section aria-label="Alert examples" className="grid gap-6 md:grid-cols-2">
                <Alert>
                    <AlertTitle>Audio unavailable</AlertTitle>
                    <AlertDescription>The drill will continue silently.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                    <AlertTitle>Check the configuration</AlertTitle>
                    <AlertDescription>Correct the exercise time before starting.</AlertDescription>
                </Alert>
            </section>
        </main>
    );
}
