import { Alert, AlertDescription } from "@/components/ui/alert";
import { OPEN_DRILL_MESSAGES } from "@/lib/services/drill-configurations";
import { describeDrillConfiguration } from "@/lib/saved-drill-summary";
import type { SavedDrill } from "@/types";

export type SavedDrillListState = { kind: "ok"; drills: readonly SavedDrill[] } | { kind: "unavailable" };

// A read failure is its own state: it must never be rendered as the empty text ("you have no timers").
export default function SavedDrillList({ state }: { state: SavedDrillListState }) {
    if (state.kind === "unavailable") {
        return (
            <Alert variant="destructive">
                <AlertDescription>{OPEN_DRILL_MESSAGES.unavailable}</AlertDescription>
            </Alert>
        );
    }

    if (state.drills.length === 0) {
        return <p className="text-muted-foreground text-sm">{OPEN_DRILL_MESSAGES.empty}</p>;
    }

    return (
        <ul className="space-y-3">
            {state.drills.map((drill) => (
                <li key={drill.id}>
                    <a
                        href={`/${drill.id}`}
                        className="bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:border-ring block rounded-lg border p-4 shadow-xs transition-colors outline-none focus-visible:ring-2"
                    >
                        <span className="block font-medium break-words">{drill.name}</span>
                        <span className="text-muted-foreground mt-1 block text-sm">{describeDrillConfiguration(drill.configuration).join(" · ")}</span>
                    </a>
                </li>
            ))}
        </ul>
    );
}
