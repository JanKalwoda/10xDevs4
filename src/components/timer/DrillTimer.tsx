import { useEffect, useRef, useState } from "react";
import DrillTimerView from "@/components/timer/DrillTimerView";
import { createDrillAudio, evaluateDrillSchedule, type DrillAudioPort } from "@/lib/drill-audio";
import { observeDrillAudioInitialization } from "@/lib/drill-audio-initializer";
import { DrillRun, browserDrillClock, type DrillClock, type DrillDisplay } from "@/lib/drill-run";
import { createDrillResumePendingState } from "@/lib/drill-resume-pending";
import type { WakeLockStatus } from "@/lib/drill-wake-lock";
import type { DrillWakeLockSession } from "@/lib/drill-wake-lock-session";
import { firstDrillPhase } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillTimerProps {
    configuration: Readonly<DrillConfiguration>;
    audio: Promise<DrillAudioPort | null>;
    wakeLock: DrillWakeLockSession;
    onComplete: () => void;
    onCancel: () => void;
    clock?: DrillClock;
    createResumeAudio?: () => Promise<DrillAudioPort | null>;
}

export default function DrillTimer({ configuration, audio, wakeLock, onComplete, onCancel, clock = browserDrillClock, createResumeAudio = createDrillAudio }: DrillTimerProps) {
    const runRef = useRef<DrillRun | null>(null);
    const resumePendingRef = useRef(createDrillResumePendingState());
    const cancelIntentRef = useRef(false);
    const disposeRef = useRef<() => void>(() => undefined);
    const [initializing, setInitializing] = useState(true);
    const [resumePending, setResumePending] = useState(false);
    const [wakeLockStatus, setWakeLockStatus] = useState<WakeLockStatus>(() => wakeLock.getStatus());
    const [display, setDisplay] = useState<DrillDisplay>(() => {
        const phase = firstDrillPhase(configuration);
        return { phase, remainingSeconds: phase.kind === "standby" ? null : phase.durationSeconds, paused: false, audioAvailable: true };
    });

    useEffect(() => {
        let disposed = false;
        let finished = false;
        let pauseWhenReady = wakeLock.wasHidden() || document.hidden;
        let run: DrillRun | null = null;
        const resumePendingState = resumePendingRef.current;
        const unsubscribeWakeLock = wakeLock.subscribe(setWakeLockStatus);
        function begin(audioPort: DrillAudioPort | null) {
            if (disposed || cancelIntentRef.current) {
                audioPort?.close();
                return;
            }
            run = new DrillRun(configuration, clock, audioPort);
            runRef.current = run;
            run.start();
            run.subscribe((current) => {
                if (disposed || cancelIntentRef.current) return;
                if (!current.phase) {
                    if (!finished) {
                        finished = true;
                        void wakeLock.release();
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
            if (pauseWhenReady || document.hidden) {
                run.hide();
                void wakeLock.release();
            }
        }
        const disposeAudioInitialization = observeDrillAudioInitialization(audio, begin);
        const onVisibilityChange = () => {
            if (document.hidden) {
                pauseWhenReady = true;
                void wakeLock.release();
                run?.hide();
                resumePendingState.invalidate();
                setResumePending(false);
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        if (document.hidden) onVisibilityChange();
        const interval = window.setInterval(() => {
            if (!disposed && !cancelIntentRef.current) run?.tick();
        }, 100);
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            resumePendingState.invalidate();
            disposeAudioInitialization();
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.clearInterval(interval);
            run?.stop();
            void wakeLock.dispose();
            unsubscribeWakeLock();
            runRef.current = null;
        };
        disposeRef.current = dispose;
        if (cancelIntentRef.current) dispose();

        return () => {
            if (disposeRef.current === dispose) disposeRef.current = () => undefined;
            dispose();
        };
    }, [audio, clock, configuration, onComplete, wakeLock]);

    function cancel() {
        if (cancelIntentRef.current) return;
        cancelIntentRef.current = true;
        disposeRef.current();
        onCancel();
    }

    function pause() {
        if (cancelIntentRef.current) return;
        resumePendingRef.current.invalidate();
        setResumePending(false);
        runRef.current?.hide();
        void wakeLock.release();
    }

    function resume() {
        if (cancelIntentRef.current || document.hidden) return;
        const run = runRef.current;
        if (!run) return;
        const attempt = resumePendingRef.current.begin();
        setResumePending(true);
        const recovery = run.resumeWithAudio(createResumeAudio);
        void wakeLock.requestForVisibleGesture();
        void recovery.then(
            () => {
                if (cancelIntentRef.current) return;
                if (resumePendingRef.current.finish(attempt)) setResumePending(false);
            },
            () => {
                if (cancelIntentRef.current) return;
                if (resumePendingRef.current.finish(attempt)) setResumePending(false);
            },
        );
    }

    return (
        <DrillTimerView
            display={display}
            repetitions={configuration.repetitions}
            initializing={initializing}
            resumePending={resumePending}
            wakeLockUnavailable={wakeLockStatus === "unavailable"}
            onCancel={cancel}
            onPause={pause}
            onResume={resume}
        />
    );
}
