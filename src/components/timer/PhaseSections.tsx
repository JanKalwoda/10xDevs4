import { useId } from "react";
import { cn } from "@/lib/utils";
import { currentPhaseBody, nextPhaseBody, type PhaseSections as PhaseSectionsModel } from "@/lib/drill-phase-sections";

interface PhaseSectionsProps {
    sections: PhaseSectionsModel;
    initializing: boolean;
}

/** Next is a framed box; Current has a transparent border of the same width so both lines sit at identical positions. */
function PhaseBox({ label, body, framed }: { label: string; body: string; framed: boolean }) {
    const id = useId();
    return (
        <div role="group" aria-labelledby={id} className={cn("rounded-lg border px-4 py-3", framed ? "bg-muted border-border" : "border-transparent")}>
            <p id={id} className="text-foreground text-xl font-semibold">
                {label}
            </p>
            <p className="text-foreground text-lg font-medium tabular-nums">{body}</p>
        </div>
    );
}

export default function PhaseSections({ sections, initializing }: PhaseSectionsProps) {
    const { main, repetition, current, next } = sections;
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <div className="flex min-h-20 items-center justify-center sm:min-h-24">
                    {main.kind === "standby" ? (
                        <p className="text-foreground text-6xl font-bold sm:text-7xl">Standby</p>
                    ) : !initializing ? (
                        <p className="text-foreground text-6xl font-bold tabular-nums sm:text-7xl" role="timer" aria-label={`${main.text} remaining`}>
                            {main.text}
                        </p>
                    ) : null}
                </div>
                <p className="text-muted-foreground min-h-7 text-lg">{repetition}</p>
            </div>
            <PhaseBox label="Current" body={currentPhaseBody(current)} framed={false} />
            <PhaseBox label="Next" body={nextPhaseBody(next)} framed />
        </div>
    );
}
