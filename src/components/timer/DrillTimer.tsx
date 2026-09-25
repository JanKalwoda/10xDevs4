import { useEffect, useState } from "react";
import { DrillRun, browserDrillClock } from "@/lib/drill-run";
import { firstDrillPhase } from "@/lib/drill-timer";
import type { DrillConfiguration, DrillPhase } from "@/types";

interface DrillTimerProps {
    configuration: Readonly<DrillConfiguration>;
    onComplete: () => void;
}

interface TimerDisplay {
    phase: DrillPhase;
    remainingSeconds: number;
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DrillTimer({ configuration, onComplete }: DrillTimerProps) {
    const [display, setDisplay] = useState<TimerDisplay>(() => {
        const phase = firstDrillPhase(configuration);
        return { phase, remainingSeconds: phase.kind === "standby" ? 0 : phase.durationSeconds };
    });

    useEffect(() => {
        let finished = false;
        const run = new DrillRun(configuration, browserDrillClock, null);
        run.subscribe(({ phase, remainingSeconds }) => {
            if (!phase) {
                if (!finished) {
                    finished = true;
                    onComplete();
                }
            } else {
                setDisplay({ phase, remainingSeconds: remainingSeconds ?? 0 });
            }
        });
        run.start();
        const interval = window.setInterval(() => {
            run.tick();
        }, 100);
        return () => {
            window.clearInterval(interval);
            run.stop();
        };
    }, [configuration, onComplete]);

    const phaseName = display.phase.kind.charAt(0).toUpperCase() + display.phase.kind.slice(1);

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">{phaseName}</h2>
            {display.phase.kind !== "standby" && (
                <p className="text-6xl font-bold text-slate-950 tabular-nums sm:text-7xl" role="timer" aria-label={`${formatTime(display.remainingSeconds)} remaining`}>
                    {formatTime(display.remainingSeconds)}
                </p>
            )}
            <p className="text-lg text-slate-700">
                {display.phase.kind === "preparation" ? "Preparing" : `Repetition ${display.phase.repetition} of ${configuration.repetitions}`}
            </p>
        </section>
    );
}
