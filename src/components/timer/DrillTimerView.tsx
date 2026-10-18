import { LoaderCircle, Pause, Play, RotateCcw, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import PhaseSections from "@/components/timer/PhaseSections";
import { cn } from "@/lib/utils";
import { buildPhaseSections } from "@/lib/drill-phase-sections";
import type { DrillDisplay } from "@/lib/drill-run";

interface DrillTimerViewProps {
    display: DrillDisplay;
    repetitions: number;
    initializing: boolean;
    resumePending?: boolean;
    controlsLocked?: boolean;
    wakeLockUnavailable?: boolean;
    onCancel: () => void;
    onRestart: () => void;
    onPause: () => void;
    onResume: () => void;
}

export default function DrillTimerView({
    display,
    repetitions,
    initializing,
    resumePending = false,
    controlsLocked = false,
    wakeLockUnavailable = false,
    onCancel,
    onRestart,
    onPause,
    onResume,
}: DrillTimerViewProps) {
    const sections = buildPhaseSections(display, repetitions);
    if (!sections) return null;
    const timerWarnings = [
        !initializing && !display.audioAvailable ? "Audio unavailable; running silently." : null,
        !initializing && wakeLockUnavailable ? "Screen may lock." : null,
    ].filter((warning) => warning !== null);
    // aria-disabled, never disabled (like DeleteDrillDialog): Playwright and AT read it, focus and geometry stay put.
    const lockedClass = cn("size-12", "aria-disabled:pointer-events-none aria-disabled:opacity-50");
    const guarded = (onActivate: () => void) => () => {
        if (!controlsLocked) onActivate();
    };
    const ariaDisabled = controlsLocked ? true : undefined;

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            <PhaseSections sections={sections} initializing={initializing} />
            <div className="grid grid-cols-3 items-center">
                <div className="justify-self-start">
                    <Button type="button" variant="outline" size="icon" className="size-12" aria-label="Cancel drill" title="Cancel drill" onClick={onCancel}>
                        <X aria-hidden="true" className="size-5" />
                    </Button>
                </div>
                <div className="justify-self-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={lockedClass}
                        aria-label="Restart drill"
                        title="Restart drill"
                        aria-disabled={ariaDisabled}
                        onClick={guarded(onRestart)}
                    >
                        <RotateCcw aria-hidden="true" className="size-5" />
                    </Button>
                </div>
                <div className="justify-self-end">
                    {initializing || resumePending ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-12"
                            aria-label={resumePending ? "Resume is loading" : "Timer is starting"}
                            title={resumePending ? "Resume is loading" : "Timer is starting"}
                            disabled
                        >
                            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                        </Button>
                    ) : display.paused ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={lockedClass}
                            aria-label="Resume drill"
                            title="Resume drill"
                            aria-disabled={ariaDisabled}
                            onClick={guarded(onResume)}
                        >
                            <Play aria-hidden="true" className="size-5" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={lockedClass}
                            aria-label="Pause drill"
                            title="Pause drill"
                            aria-disabled={ariaDisabled}
                            onClick={guarded(onPause)}
                        >
                            <Pause aria-hidden="true" className="size-5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="text-muted-foreground flex min-h-10 items-center justify-center gap-2">
                {initializing ? (
                    <p role="status" className="flex items-center gap-2">
                        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                        Starting timer…
                    </p>
                ) : resumePending ? (
                    <p role="status" className="flex items-center gap-2">
                        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                        Resuming timer…
                    </p>
                ) : display.paused ? (
                    <p role="status">Drill paused.</p>
                ) : null}
            </div>
            <div className="min-h-20">
                {timerWarnings.length > 0 && (
                    <Alert>
                        <AlertDescription>{timerWarnings.join(" ")}</AlertDescription>
                    </Alert>
                )}
            </div>
        </section>
    );
}
