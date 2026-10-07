import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import DrillTimer from "@/components/timer/DrillTimer";
import SavedDrillDetails from "@/components/timer/SavedDrillDetails";
import ThemeToggle from "@/components/timer/ThemeToggle";
import { createDrillAudio, type DrillAudioPort } from "@/lib/drill-audio";
import { createDrillWakeLockController, type WakeLockProvider, type WakeLockSentinelPort } from "@/lib/drill-wake-lock";
import { createDrillWakeLockSession, type DrillWakeLockSession } from "@/lib/drill-wake-lock-session";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { createDrillRunIdentityState } from "@/lib/drill-run-identity";
import { browserDrillVisibility } from "@/lib/drill-visibility";
import type { DrillConfiguration, SavedDrill } from "@/types";

const DEFAULT_VALUES: DrillConfigInput = {
    preparation: "0:05",
    exercise: "0:04",
    rest: "0:02",
    repetitions: "3",
    randomStartEnabled: false,
};

interface ActiveRun {
    identity: number;
    configuration: Readonly<DrillConfiguration>;
    audio: Promise<DrillAudioPort | null>;
    wakeLock: DrillWakeLockSession;
}

type BrowserWakeLockSentinel = WakeLockSentinelPort;

interface BrowserWakeLockApi {
    request(type: "screen"): Promise<BrowserWakeLockSentinel>;
}

function createBrowserWakeLockProvider(): WakeLockProvider | null {
    if (typeof navigator === "undefined") return null;
    const wakeLock = Reflect.get(navigator, "wakeLock") as BrowserWakeLockApi | undefined;
    if (!wakeLock) return null;
    return { request: () => wakeLock.request("screen") };
}

export function DrillCompleted({ onReturn, returnLabel = "Return to configuration" }: { onReturn: () => void; returnLabel?: string }) {
    return (
        <section className="space-y-6 text-center">
            <h2 className="text-2xl font-semibold">Completed</h2>
            <Button type="button" className="w-full" onClick={onReturn}>
                {returnLabel}
            </Button>
        </section>
    );
}

// With savedDrill the app runs that stored timer: read-only details instead of the configuration form.
export default function DrillApp({ savedDrill }: { savedDrill?: SavedDrill }) {
    const [values, setValues] = useState<DrillConfigInput>(DEFAULT_VALUES);
    const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
    const [view, setView] = useState<"configuration" | "running" | "completed">("configuration");
    const [identityState] = useState(createDrillRunIdentityState);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const restoreFocus = useRef(false);

    // Start unmounts while a run is on screen, so after Cancel or Return focus would fall to <body>; park it on the heading.
    useEffect(() => {
        if (view === "configuration" && restoreFocus.current) {
            restoreFocus.current = false;
            headingRef.current?.focus();
        }
    }, [view]);

    const createActiveRun = useCallback(
        (configuration: Readonly<DrillConfiguration>): ActiveRun => {
            const identity = identityState.begin();
            // Begin unlocking Web Audio while the Start or Restart gesture is still active.
            const audio = createDrillAudio();
            const wakeLock = createDrillWakeLockSession(
                createDrillWakeLockController(createBrowserWakeLockProvider()),
                () => !browserDrillVisibility.isHidden(),
                (onHidden) =>
                    browserDrillVisibility.subscribe(() => {
                        if (browserDrillVisibility.isHidden()) onHidden();
                    }),
            );
            void wakeLock.requestForVisibleGesture();
            return { identity, configuration, audio, wakeLock };
        },
        [identityState],
    );

    const complete = useCallback(() => {
        if (!activeRun) return;
        identityState.complete(activeRun.identity, () => {
            setView("completed");
        });
    }, [activeRun, identityState]);

    const cancel = useCallback(() => {
        if (!activeRun || !identityState.retire(activeRun.identity)) return;
        setActiveRun(null);
        restoreFocus.current = true;
        setView("configuration");
    }, [activeRun, identityState]);

    const restart = useCallback(() => {
        if (!activeRun || !identityState.retire(activeRun.identity)) return;
        setActiveRun(createActiveRun(activeRun.configuration));
        setView("running");
    }, [activeRun, createActiveRun, identityState]);

    function start(snapshot: Readonly<DrillConfiguration>) {
        setActiveRun(createActiveRun(snapshot));
        setView("running");
    }

    return (
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <span aria-hidden="true" className="size-9" />
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className={savedDrill ? "text-center text-3xl font-bold break-words outline-none" : "text-center text-3xl font-bold outline-none"}
                    >
                        {savedDrill ? savedDrill.name : "Drill timer"}
                    </h1>
                    <ThemeToggle />
                </CardHeader>
                <CardContent>
                    {view === "configuration" && !savedDrill && <DrillConfigForm values={values} onValuesChange={setValues} onStart={start} />}
                    {view === "configuration" && savedDrill && <SavedDrillDetails drill={savedDrill} onStart={start} />}
                    {view === "running" && activeRun && (
                        <DrillTimer
                            key={activeRun.identity}
                            configuration={activeRun.configuration}
                            audio={activeRun.audio}
                            wakeLock={activeRun.wakeLock}
                            onComplete={complete}
                            onCancel={cancel}
                            onRestart={restart}
                        />
                    )}
                    {view === "completed" && (
                        <DrillCompleted
                            returnLabel={savedDrill ? "Return to timer" : undefined}
                            onReturn={() => {
                                restoreFocus.current = true;
                                setView("configuration");
                            }}
                        />
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
