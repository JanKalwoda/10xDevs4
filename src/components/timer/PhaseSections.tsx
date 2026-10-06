import { cn } from "@/lib/utils";
import { nextPhaseText, type PhaseSections as PhaseSectionsModel } from "@/lib/drill-phase-sections";

interface PhaseSectionsProps {
    sections: PhaseSectionsModel;
    initializing: boolean;
}

export default function PhaseSections({ sections, initializing }: PhaseSectionsProps) {
    const { main, current, next } = sections;
    return (
        <div className="space-y-4">
            <div className="flex min-h-20 items-center justify-center sm:min-h-24">
                {main.kind === "standby" ? (
                    <p className="text-foreground text-6xl font-bold sm:text-7xl">Standby</p>
                ) : !initializing ? (
                    <p className="text-foreground text-6xl font-bold tabular-nums sm:text-7xl" role="timer" aria-label={`${main.text} remaining`}>
                        {main.text}
                    </p>
                ) : null}
            </div>
            <div className="space-y-1">
                <h2 className="text-foreground text-xl font-semibold">
                    {current.name}
                    <span className="text-muted-foreground font-normal tabular-nums"> · {current.time}</span>
                </h2>
                <p className="text-muted-foreground text-base">{current.detail}</p>
            </div>
            <div role="group" aria-label="Next phase" className={cn("bg-muted border-border rounded-lg border px-4 py-3")}>
                <p className="text-foreground text-lg font-medium tabular-nums">{nextPhaseText(next)}</p>
            </div>
        </div>
    );
}
