import { LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DrillDisplay } from "@/lib/drill-run";

interface DrillTimerViewProps {
    display: DrillDisplay;
    repetitions: number;
    initializing: boolean;
    onResume: () => void;
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DrillTimerView({ display, repetitions, initializing, onResume }: DrillTimerViewProps) {
    const phase = display.phase;
    if (!phase) return null;
    const phaseName = phase.kind.charAt(0).toUpperCase() + phase.kind.slice(1);

    return (
        <section aria-label="Current drill phase" className="space-y-4 text-center">
            {!initializing && !display.audioAvailable && (
                <Alert>
                    <AlertDescription>Audio is unavailable. The drill will continue silently.</AlertDescription>
                </Alert>
            )}
            {display.paused && (
                <div className="bg-muted text-foreground space-y-3 rounded-md p-4">
                    <p className="font-medium">Paused while the page was hidden.</p>
                    <Button type="button" className="w-full" onClick={onResume}>
                        Resume
                    </Button>
                </div>
            )}
            <h2 className="text-foreground text-2xl font-semibold">{phaseName}</h2>
            <div className="flex min-h-20 items-center justify-center sm:min-h-24">
                {initializing ? (
                    <p role="status" className="text-muted-foreground flex items-center gap-2">
                        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                        Starting timer…
                    </p>
                ) : phase.kind !== "standby" ? (
                    <p className="text-foreground text-6xl font-bold tabular-nums sm:text-7xl" role="timer" aria-label={`${formatTime(display.remainingSeconds ?? 0)} remaining`}>
                        {formatTime(display.remainingSeconds ?? 0)}
                    </p>
                ) : null}
            </div>
            <p className="text-muted-foreground text-lg">{phase.kind === "preparation" ? "Preparing" : `Repetition ${phase.repetition} of ${repetitions}`}</p>
        </section>
    );
}
