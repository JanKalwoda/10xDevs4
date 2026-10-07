import { SAVED_DRILL_HEADING_CLASS } from "@/components/timer/DrillApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SavedDrillDetails from "@/components/timer/SavedDrillDetails";
import SavedDrillList, { type SavedDrillListState } from "@/components/timer/SavedDrillList";
import type { DeleteDrillPort } from "@/lib/drill-delete-controller";
import type { SavedDrill } from "@/types";

// The preview must never delete anything: the Delete in these cards is wired to inert ports.
const INERT_DELETE: { deleteDrill: DeleteDrillPort; navigate: () => void } = {
    deleteDrill: () => Promise.resolve({ ok: false, code: "unavailable" }),
    navigate: () => undefined,
};
const LONG_HEADING_DRILL: SavedDrill = makeDrill(4, "y".repeat(200));

function makeDrill(index: number, name: string, overrides: Partial<SavedDrill["configuration"]> = {}): SavedDrill {
    return {
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name,
        configuration: { preparationSeconds: 5, exerciseSeconds: 4, restSeconds: 2, repetitions: 3, randomStartEnabled: false, ...overrides },
        createdAt: "2026-10-07T10:00:00.000Z",
        updatedAt: "2026-10-07T10:00:00.000Z",
    };
}

const SHORT_LIST: SavedDrill[] = [
    makeDrill(3, "Morning drill", { randomStartEnabled: true }),
    makeDrill(2, "Draw from holster", { exerciseSeconds: 3, restSeconds: 5, repetitions: 10 }),
    makeDrill(1, "Single shot", { repetitions: 1 }),
];

const LONG_NAME = "Very long timer name without any spaces to prove that wrapping works ".replaceAll(" ", "_");
const STRESS_LIST: SavedDrill[] = Array.from({ length: 50 }, (_, index) =>
    makeDrill(50 - index, index % 2 === 0 ? `${LONG_NAME}${String(50 - index)}` : `Long name with spaces number ${String(50 - index)} that should wrap on narrow screens`),
);

interface Scenario {
    fixture: string;
    title: string;
    description: string;
    visualState: "default" | "empty" | "error";
    state: SavedDrillListState;
}

/** Each scenario feeds the production `SavedDrillList` the exact state `resolveDashboardPage` produces. */
const SCENARIOS: Scenario[] = [
    {
        fixture: "list",
        title: "List (3 timers)",
        description: "Cards as links; hover and focus-visible are scripted on the first card.",
        visualState: "default",
        state: { kind: "ok", drills: SHORT_LIST },
    },
    { fixture: "empty", title: "Empty", description: "No saved timers yet.", visualState: "empty", state: { kind: "ok", drills: [] } },
    { fixture: "unavailable", title: "Error: unavailable", description: "Never rendered as the empty text.", visualState: "error", state: { kind: "unavailable" } },
    {
        fixture: "stress",
        title: "Stress (50 long names)",
        description: "The per-user limit with long and unbroken names.",
        visualState: "default",
        state: { kind: "ok", drills: STRESS_LIST },
    },
];

export default function SavedDrillFixtures() {
    return (
        <section aria-label="Saved timers examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Saved timers</h2>
            <p className="text-muted-foreground text-sm">
                Production dashboard list and saved-timer details with deterministic data. Disabled is N/A (no disabled control); loading is N/A (pages are server-rendered); the
                404 page is an Astro view checked over HTTP.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
                {SCENARIOS.map((scenario) => (
                    <Card
                        key={scenario.fixture}
                        className="min-w-0"
                        data-fixture={`saved-${scenario.fixture}`}
                        data-testid={`saved-${scenario.fixture}`}
                        data-visual-state={scenario.visualState}
                    >
                        <CardHeader>
                            <CardTitle>{scenario.title}</CardTitle>
                            <CardDescription>{scenario.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SavedDrillList state={scenario.state} />
                        </CardContent>
                    </Card>
                ))}
                <Card className="min-w-0" data-fixture="saved-details" data-testid="saved-details" data-visual-state="default">
                    <CardHeader>
                        <CardTitle>Morning drill</CardTitle>
                        <CardDescription>
                            Saved timer details with the Edit and Delete timer actions (the name is the page heading in production). Hover and focus-visible are scripted on Edit
                            timer and Delete timer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SavedDrillDetails drill={SHORT_LIST[0]} onStart={() => undefined} deletePorts={INERT_DELETE} />
                    </CardContent>
                </Card>
                <Card className="min-w-0" data-fixture="saved-page-long-name" data-testid="saved-page-long-name" data-visual-state="default">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <span aria-hidden="true" className="size-9" />
                        <h1 className={SAVED_DRILL_HEADING_CLASS}>{LONG_HEADING_DRILL.name}</h1>
                        <span aria-hidden="true" className="size-9" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            The `DrillApp` header (same classes) with a 200-character name without spaces: it wraps instead of widening the page (regression of S-11, fixed in
                            S-13). The full page is verified over HTTP on the preview.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
