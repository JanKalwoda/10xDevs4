import { LoaderCircle, Pause, Play, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DrillDisplay } from "@/lib/drill-run";

interface DrillTimerViewProps {
    display: DrillDisplay;
    repetitions: number;
    initializing: boolean;
    resumePending?: boolean;
    wakeLockUnavailable?: boolean;
    onCancel: () => void;
    onPause: () => void;
    onResume: () => void;
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DrillTimerView({
    display,
    repetitions,
    initializing,
    resumePending = false,
    wakeLockUnavailable = false,
    onCancel,
    onPause,
    onResume,
}: DrillTimerViewProps) {
    const phase = display.phase;
    if (!phase) return null;
    const phaseName = phase.kind.charAt(0).toUpperCase() + phase.kind.slice(1);
    const timerWarnings = [
        !initializing && !display.audioAvailable ? "Audio unavailable; running silently." : null,
        !initializing && wakeLockUnavailable ? "Screen may lock." : null,
    ].filter((warning) => warning !== null);

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            <div className="min-h-20">
                {timerWarnings.length > 0 && (
                    <Alert>
                        <AlertDescription>{timerWarnings.join(" ")}</AlertDescription>
                    </Alert>
                )}
            </div>
            <h2 className="text-foreground text-2xl font-semibold">{phaseName}</h2>
            <div className="flex min-h-20 items-center justify-center sm:min-h-24">
                {!initializing && phase.kind !== "standby" ? (
                    <p className="text-foreground text-6xl font-bold tabular-nums sm:text-7xl" role="timer" aria-label={`${formatTime(display.remainingSeconds ?? 0)} remaining`}>
                        {formatTime(display.remainingSeconds ?? 0)}
                    </p>
                ) : null}
            </div>
            <p className="text-muted-foreground text-lg">{phase.kind === "preparation" ? "Preparing" : `Repetition ${phase.repetition} of ${repetitions}`}</p>
            <div className="grid grid-cols-3 items-center">
                <div className="justify-self-start">
                    <Button type="button" variant="outline" size="icon" className="size-12" aria-label="Cancel drill" title="Cancel drill" onClick={onCancel}>
                        <X aria-hidden="true" className="size-5" />
                    </Button>
                </div>
                <span aria-hidden="true" className="size-12 justify-self-center" />
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
                        <Button type="button" variant="outline" size="icon" className="size-12" aria-label="Resume drill" title="Resume drill" onClick={onResume}>
                            <Play aria-hidden="true" className="size-5" />
                        </Button>
                    ) : (
                        <Button type="button" variant="outline" size="icon" className="size-12" aria-label="Pause drill" title="Pause drill" onClick={onPause}>
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
        </section>
    );
}
