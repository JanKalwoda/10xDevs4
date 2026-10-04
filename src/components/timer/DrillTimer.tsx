import { useEffect, useRef, useState } from "react";
import DrillTimerView from "@/components/timer/DrillTimerView";
import { createDrillAudio, evaluateDrillSchedule, type DrillAudioPort } from "@/lib/drill-audio";
import { DrillRun, browserDrillClock, type DrillDisplay } from "@/lib/drill-run";
import { createDrillResumePendingState } from "@/lib/drill-resume-pending";
import { firstDrillPhase } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillTimerProps {
    configuration: Readonly<DrillConfiguration>;
    audio: Promise<DrillAudioPort | null>;
    onComplete: () => void;
}

export default function DrillTimer({ configuration, audio, onComplete }: DrillTimerProps) {
    const runRef = useRef<DrillRun | null>(null);
    const resumePendingRef = useRef(createDrillResumePendingState());
    const [initializing, setInitializing] = useState(true);
    const [resumePending, setResumePending] = useState(false);
    const [display, setDisplay] = useState<DrillDisplay>(() => {
        const phase = firstDrillPhase(configuration);
        return { phase, remainingSeconds: phase.kind === "standby" ? null : phase.durationSeconds, paused: false, audioAvailable: true };
    });

    useEffect(() => {
        let disposed = false;
        let finished = false;
        let run: DrillRun | null = null;
        function begin(audioPort: DrillAudioPort | null) {
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
                        if (run?.scheduleEvidence.length) {
                            performance.mark("drill-audio-schedule", {
                                detail: evaluateDrillSchedule(
                                    run.scheduleEvidence,
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
                    setInitializing(false);
                }
            });
            if (document.hidden) run.hide();
        }
        void audio.then(begin, () => {
            begin(null);
        });
        const onVisibilityChange = () => {
            if (document.hidden) {
                run?.hide();
                resumePendingRef.current.invalidate();
                setResumePending(false);
            }
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

    return (
        <DrillTimerView
            display={display}
            repetitions={configuration.repetitions}
            initializing={initializing}
            resumePending={resumePending}
            onPause={() => {
                resumePendingRef.current.invalidate();
                setResumePending(false);
                runRef.current?.hide();
            }}
            onResume={() => {
                if (document.hidden) return;
                const attempt = resumePendingRef.current.begin();
                setResumePending(true);
                void runRef.current?.resumeWithAudio(createDrillAudio).finally(() => {
                    if (resumePendingRef.current.finish(attempt)) setResumePending(false);
                });
            }}
        />
    );
}
