import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import DrillTimer from "@/components/timer/DrillTimer";
import { createDrillAudio, type DrillAudioPort } from "@/lib/drill-audio";
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
        setActiveRun({ configuration: snapshot, audio });
        setView("running");
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-900">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
                <h1 className="mb-6 text-center text-3xl font-bold">Drill timer</h1>
                {view === "configuration" && <DrillConfigForm values={values} onValuesChange={setValues} onStart={start} />}
                {view === "running" && activeRun && <DrillTimer configuration={activeRun.configuration} audio={activeRun.audio} onComplete={complete} />}
                {view === "completed" && (
                    <section className="space-y-6 text-center">
                        <h2 className="text-2xl font-semibold">Completed</h2>
                        <Button
                            type="button"
                            className="w-full"
                            onClick={() => {
                                setView("configuration");
                            }}
                        >
                            Return to configuration
                        </Button>
                    </section>
                )}
            </div>
        </main>
    );
}
