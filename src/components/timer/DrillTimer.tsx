import { useEffect, useState } from "react";
import { firstDrillPhase, nextDrillPhase } from "@/lib/drill-timer";
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
        return { phase, remainingSeconds: phase.durationSeconds };
    });

    useEffect(() => {
        let phase = firstDrillPhase(configuration);
        let deadline = performance.now() + phase.durationSeconds * 1000;
        let finished = false;

        function update() {
            const now = performance.now();
            while (now >= deadline) {
                const next = nextDrillPhase(configuration, phase);
                if (!next) {
                    if (!finished) {
                        finished = true;
                        onComplete();
                    }
                    return;
                }
                phase = next;
                deadline += phase.durationSeconds * 1000;
            }
            setDisplay({ phase, remainingSeconds: Math.ceil((deadline - now) / 1000) });
        }

        const interval = window.setInterval(update, 100);
        return () => {
            window.clearInterval(interval);
        };
    }, [configuration, onComplete]);

    const phaseName = display.phase.kind.charAt(0).toUpperCase() + display.phase.kind.slice(1);

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">{phaseName}</h2>
            <p className="text-6xl font-bold text-slate-950 tabular-nums sm:text-7xl" role="timer" aria-label={`${formatTime(display.remainingSeconds)} remaining`}>
                {formatTime(display.remainingSeconds)}
            </p>
            <p className="text-lg text-slate-700">
                {display.phase.kind === "preparation" ? "Preparing" : `Repetition ${display.phase.repetition} of ${configuration.repetitions}`}
            </p>
        </section>
    );
}
