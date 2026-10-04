import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import DrillTimer from "@/components/timer/DrillTimer";
import ThemeToggle from "@/components/timer/ThemeToggle";
import { createDrillAudio, type DrillAudioPort } from "@/lib/drill-audio";
import { createDrillWakeLockController, type WakeLockProvider, type WakeLockSentinelPort } from "@/lib/drill-wake-lock";
import { createDrillWakeLockSession, type DrillWakeLockSession } from "@/lib/drill-wake-lock-session";
import type { DrillConfigInput } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

const DEFAULT_VALUES: DrillConfigInput = {
    preparation: "0:05",
    exercise: "0:04",
    rest: "0:02",
    repetitions: "3",
    randomStartEnabled: false,
};

interface ActiveRun {
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

export function DrillCompleted({ onReturn }: { onReturn: () => void }) {
    return (
        <section className="space-y-6 text-center">
            <h2 className="text-2xl font-semibold">Completed</h2>
            <Button type="button" className="w-full" onClick={onReturn}>
                Return to configuration
            </Button>
        </section>
    );
}

export default function DrillApp() {
    const [values, setValues] = useState<DrillConfigInput>(DEFAULT_VALUES);
    const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
    const [view, setView] = useState<"configuration" | "running" | "completed">("configuration");
    const complete = useCallback(() => {
        setView("completed");
    }, []);

    function start(snapshot: Readonly<DrillConfiguration>) {
        // Begin unlocking Web Audio while the Start gesture is still active.
        const audio = createDrillAudio();
        const wakeLock = createDrillWakeLockSession(
            createDrillWakeLockController(createBrowserWakeLockProvider()),
            () => !document.hidden,
            (onHidden) => {
                const onVisibilityChange = () => {
                    if (document.hidden) onHidden();
                };
                document.addEventListener("visibilitychange", onVisibilityChange);
                return () => {
                    document.removeEventListener("visibilitychange", onVisibilityChange);
                };
            },
        );
        void wakeLock.requestForVisibleGesture();
        setActiveRun({ configuration: snapshot, audio, wakeLock });
        setView("running");
    }

    return (
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <span aria-hidden="true" className="size-9" />
                    <h1 className="text-center text-3xl font-bold">Drill timer</h1>
                    <ThemeToggle />
                </CardHeader>
                <CardContent>
                    {view === "configuration" && <DrillConfigForm values={values} onValuesChange={setValues} onStart={start} />}
                    {view === "running" && activeRun && (
                        <DrillTimer configuration={activeRun.configuration} audio={activeRun.audio} wakeLock={activeRun.wakeLock} onComplete={complete} />
                    )}
                    {view === "completed" && (
                        <DrillCompleted
                            onReturn={() => {
                                setView("configuration");
                            }}
                        />
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
