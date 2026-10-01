import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { evaluateDrillSchedule, type DrillAudioPort } from "@/lib/drill-audio";
import { DrillRun, browserDrillClock, type DrillDisplay } from "@/lib/drill-run";
import { firstDrillPhase } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillTimerProps {
    configuration: Readonly<DrillConfiguration>;
    audio: Promise<DrillAudioPort | null>;
    onComplete: () => void;
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DrillTimer({ configuration, audio, onComplete }: DrillTimerProps) {
    const runRef = useRef<DrillRun | null>(null);
    const [display, setDisplay] = useState<DrillDisplay>(() => {
        const phase = firstDrillPhase(configuration);
        return { phase, remainingSeconds: phase.kind === "standby" ? null : phase.durationSeconds, paused: false, audioAvailable: true };
    });

    useEffect(() => {
        let disposed = false;
        let finished = false;
        let run: DrillRun | null = null;
        void audio.then((audioPort) => {
            if (disposed) {
                audioPort?.close();
                return;
            }
            run = new DrillRun(configuration, browserDrillClock, audioPort);
            runRef.current = run;
            run.start();
            run.subscribe((current) => {
                if (!current.phase) {
                    if (!finished) {
                        finished = true;
                        if (audioPort?.scheduleEvidence?.length) {
                            performance.mark("drill-audio-schedule", {
                                detail: evaluateDrillSchedule(
                                    audioPort.scheduleEvidence,
                                    configuration.repetitions,
                                    configuration.randomStartEnabled,
                                    configuration.restSeconds > 0,
                                    current.audioAvailable,
                                ),
                            });
                        }
                        onComplete();
                    }
                } else {
                    setDisplay(current);
                }
            });
            if (document.hidden) run.hide();
        });
        const onVisibilityChange = () => {
            if (document.hidden) run?.hide();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        const interval = window.setInterval(() => {
            run?.tick();
        }, 100);
        return () => {
            disposed = true;
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.clearInterval(interval);
            run?.stop();
            runRef.current = null;
        };
    }, [audio, configuration, onComplete]);

    if (!display.phase) return null;
    const phase = display.phase;
    const phaseName = phase.kind.charAt(0).toUpperCase() + phase.kind.slice(1);

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            {!display.audioAvailable && (
                <p role="alert" className="rounded-md bg-amber-100 p-3 text-sm text-amber-950">
                    Audio is unavailable. The drill will continue silently.
                </p>
            )}
            {display.paused && (
                <div className="bg-muted text-foreground space-y-3 rounded-md p-4">
                    <p className="font-medium">Paused while the page was hidden.</p>
                    <Button
                        type="button"
                        className="w-full"
                        onClick={() => {
                            if (!document.hidden) runRef.current?.resume();
                        }}
                    >
                        Resume
                    </Button>
                </div>
            )}
            <h2 className="text-foreground text-2xl font-semibold">{phaseName}</h2>
            {phase.kind !== "standby" && (
                <p className="text-foreground text-6xl font-bold tabular-nums sm:text-7xl" role="timer" aria-label={`${formatTime(display.remainingSeconds ?? 0)} remaining`}>
                    {formatTime(display.remainingSeconds ?? 0)}
                </p>
            )}
            <p className="text-muted-foreground text-lg">{phase.kind === "preparation" ? "Preparing" : `Repetition ${phase.repetition} of ${configuration.repetitions}`}</p>
        </section>
    );
}
