import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import DrillTimerView from "@/components/timer/DrillTimerView";
import { createDrillAudio, evaluateDrillSchedule, type DrillAudioPort } from "@/lib/drill-audio";
import { observeDrillAudioInitialization } from "@/lib/drill-audio-initializer";
import { DrillRun, browserDrillClock, type DrillClock, type DrillDisplay } from "@/lib/drill-run";
import { unlockedDrillControlGuard, type DrillControlGuard } from "@/lib/drill-control-guard";
import { createDrillResumePendingState } from "@/lib/drill-resume-pending";
import type { WakeLockStatus } from "@/lib/drill-wake-lock";
import type { DrillWakeLockSession } from "@/lib/drill-wake-lock-session";
import { initialDrillDisplay } from "@/lib/drill-phase-sections";
import { browserDrillVisibility, type DrillVisibilityPort } from "@/lib/drill-visibility";
import type { DrillConfiguration } from "@/types";

interface DrillTimerProps {
    configuration: Readonly<DrillConfiguration>;
    audio: Promise<DrillAudioPort | null>;
    wakeLock: DrillWakeLockSession;
    onComplete: () => void;
    onCancel: () => void;
    onRestart: () => void;
    clock?: DrillClock;
    visibility?: DrillVisibilityPort;
    createResumeAudio?: () => Promise<DrillAudioPort | null>;
    controlGuard?: DrillControlGuard;
}

export default function DrillTimer({
    configuration,
    audio,
    wakeLock,
    onComplete,
    onCancel,
    onRestart,
    clock = browserDrillClock,
    visibility = browserDrillVisibility,
    createResumeAudio = createDrillAudio,
    controlGuard = unlockedDrillControlGuard,
}: DrillTimerProps) {
    const controlsLocked = useSyncExternalStore(controlGuard.subscribe, controlGuard.isLocked, () => false);
    const runRef = useRef<DrillRun | null>(null);
    const resumePendingRef = useRef(createDrillResumePendingState());
    const retiredIntentRef = useRef(false);
    const disposeRef = useRef<() => void>(() => undefined);
    const [initializing, setInitializing] = useState(true);
    const [resumePending, setResumePending] = useState(false);
    const [wakeLockStatus, setWakeLockStatus] = useState<WakeLockStatus>(() => wakeLock.getStatus());
    const [display, setDisplay] = useState<DrillDisplay>(() => initialDrillDisplay(configuration));

    useEffect(() => {
        let disposed = false;
        let finished = false;
        let pauseWhenReady = wakeLock.wasHidden() || visibility.isHidden();
        let run: DrillRun | null = null;
        const resumePendingState = resumePendingRef.current;
        const unsubscribeWakeLock = wakeLock.subscribe(setWakeLockStatus);
        function begin(audioPort: DrillAudioPort | null) {
            if (disposed || retiredIntentRef.current) {
                audioPort?.close();
                return;
            }
            run = new DrillRun(configuration, clock, audioPort);
            runRef.current = run;
            run.start();
            run.subscribe((current) => {
                if (disposed || retiredIntentRef.current) return;
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
            if (pauseWhenReady || visibility.isHidden()) {
                run.hide();
                void wakeLock.release();
            }
        }
        const disposeAudioInitialization = observeDrillAudioInitialization(audio, begin);
        const onVisibilityChange = () => {
            if (visibility.isHidden()) {
                pauseWhenReady = true;
                void wakeLock.release();
                run?.hide();
                resumePendingState.invalidate();
                setResumePending(false);
            }
        };
        const unsubscribeVisibility = visibility.subscribe(onVisibilityChange);
        if (visibility.isHidden()) onVisibilityChange();
        const interval = window.setInterval(() => {
            if (!disposed && !retiredIntentRef.current) run?.tick();
        }, 100);
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            resumePendingState.invalidate();
            disposeAudioInitialization();
            unsubscribeVisibility();
            window.clearInterval(interval);
            run?.stop();
            void wakeLock.dispose();
            unsubscribeWakeLock();
            runRef.current = null;
        };
        disposeRef.current = dispose;
        if (retiredIntentRef.current) dispose();

        return () => {
            if (disposeRef.current === dispose) disposeRef.current = () => undefined;
            dispose();
        };
    }, [audio, clock, configuration, onComplete, visibility, wakeLock]);

    function retireIntent(): boolean {
        if (retiredIntentRef.current) return false;
        retiredIntentRef.current = true;
        disposeRef.current();
        return true;
    }

    function cancel() {
        if (!retireIntent()) return;
        onCancel();
    }

    function restart() {
        // Ask the guard before retiring: a rejected Restart must not leave a retired, stopped run on screen.
        if (retiredIntentRef.current || !controlGuard.tryActivate()) return;
        if (!retireIntent()) return;
        onRestart();
    }

    function pause() {
        if (retiredIntentRef.current || !controlGuard.tryActivate()) return;
        resumePendingRef.current.invalidate();
        setResumePending(false);
        runRef.current?.hide();
        void wakeLock.release();
    }

    function resume() {
        if (retiredIntentRef.current || visibility.isHidden()) return;
        const run = runRef.current;
        if (!run || !controlGuard.tryActivate()) return;
        const attempt = resumePendingRef.current.begin();
        setResumePending(true);
        const recovery = run.resumeWithAudio(createResumeAudio);
        void wakeLock.requestForVisibleGesture();
        void recovery.then(
            () => {
                if (retiredIntentRef.current) return;
                if (resumePendingRef.current.finish(attempt)) setResumePending(false);
            },
            () => {
                if (retiredIntentRef.current) return;
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
            controlsLocked={controlsLocked}
            wakeLockUnavailable={wakeLockStatus === "unavailable"}
            onCancel={cancel}
            onRestart={restart}
            onPause={pause}
            onResume={resume}
        />
    );
}
