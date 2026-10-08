import { nextPhaseBody, type PhaseSections as PhaseSectionsModel } from "@/lib/drill-phase-sections";

interface PhaseSectionsProps {
    sections: PhaseSectionsModel;
    initializing: boolean;
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
            <div>
                <h2 className="text-foreground text-xl font-semibold">{current.name}</h2>
                <p className="text-muted-foreground min-h-6 text-base tabular-nums" aria-hidden={current.time ? undefined : true}>
                    {current.time}
                </p>
            </div>
            <div role="group" aria-label="Next phase" className="bg-muted border-border rounded-lg border px-4 py-3">
                <p className="text-foreground text-xl font-semibold">Next</p>
                <p className="text-foreground text-lg font-medium tabular-nums">{nextPhaseBody(next)}</p>
            </div>
        </div>
    );
}
