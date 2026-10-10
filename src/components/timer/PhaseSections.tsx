import { useId } from "react";
import { currentPhaseBody, nextPhaseBody, type PhaseSections as PhaseSectionsModel } from "@/lib/drill-phase-sections";

interface PhaseSectionsProps {
    sections: PhaseSectionsModel;
    initializing: boolean;
}

function PhaseBox({ label, body }: { label: string; body: string }) {
    const id = useId();
    return (
        <div role="group" aria-labelledby={id} className="bg-muted border-border rounded-lg border px-4 py-3">
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
            <PhaseBox label="Current" body={currentPhaseBody(current)} />
            <PhaseBox label="Next" body={nextPhaseBody(next)} />
        </div>
    );
}
