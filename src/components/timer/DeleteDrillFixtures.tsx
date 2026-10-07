import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DeleteDrillDialog from "@/components/timer/DeleteDrillDialog";
import type { DeleteDrillPort } from "@/lib/drill-delete-controller";

const DRILL_ID = "00000000-0000-4000-8000-000000000003";
// 200 characters without a space: the worst case the name limit allows.
const LONG_NAME = "x".repeat(200);
// Composed emoji, a ZWJ sequence and a decomposed (NFD) letter.
const EMOJI_NAME = "🎯 Draw 👩‍🎓 café".normalize("NFD");

const pending: DeleteDrillPort = () =>
    new Promise(() => {
        // Never resolves: the dialog stays in its deleting state.
    });
const unavailable: DeleteDrillPort = () => Promise.resolve({ ok: false, code: "unavailable" });
const unauthorized: DeleteDrillPort = () => Promise.resolve({ ok: false, code: "unauthorized" });
const done: DeleteDrillPort = () => Promise.resolve({ ok: true });
const navigate = () => undefined;

interface Scenario {
    fixture: string;
    title: string;
    description: string;
    name: string;
    deleteDrill: DeleteDrillPort;
}

/** Each scenario opens the production `DeleteDrillDialog` with deterministic ports; `Delete` is pressed by the visual-gate script where a state needs it. */
const SCENARIOS: Scenario[] = [
    { fixture: "default", title: "Default (open)", description: "Cancel has focus; the name is quoted.", name: "Morning drill", deleteDrill: done },
    { fixture: "long-name", title: "Long name", description: "200 characters without a space wrap inside the dialog.", name: LONG_NAME, deleteDrill: done },
    { fixture: "emoji-name", title: "Emoji and NFD name", description: "Composed emoji and a decomposed letter.", name: EMOJI_NAME, deleteDrill: done },
    {
        fixture: "deleting",
        title: "Loading: deleting",
        description: "After Delete: `Deleting…`, aria-disabled, the request never ends.",
        name: "Morning drill",
        deleteDrill: pending,
    },
    { fixture: "error", title: "Error: unavailable", description: "After Delete: alert, the dialog stays open, retry works.", name: "Morning drill", deleteDrill: unavailable },
    {
        fixture: "unauthorized",
        title: "Error: session expired",
        description: "After Delete: alert with a sign-in link back to the timer.",
        name: "Morning drill",
        deleteDrill: unauthorized,
    },
];

function fixtureFromUrl(): string | null {
    const requested = new URLSearchParams(window.location.search).get("delete");
    return SCENARIOS.some((scenario) => scenario.fixture === requested) ? requested : null;
}

// The URL never changes while the page is open.
function subscribeNever() {
    return () => undefined;
}

export default function DeleteDrillFixtures() {
    const [picked, setPicked] = useState<{ fixture: string; run: number } | null>(null);
    // `?delete=<fixture>` opens a scenario for the screenshot script; the page has no open modal by default so the other sections stay reachable.
    const fromUrl = useSyncExternalStore(subscribeNever, fixtureFromUrl, () => null);
    const selected = picked ?? (fromUrl ? { fixture: fromUrl, run: 0 } : null);

    const scenario = SCENARIOS.find((candidate) => candidate.fixture === selected?.fixture);

    return (
        <section aria-label="Delete timer examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Delete a timer</h2>
            <p className="text-muted-foreground text-sm">
                Production `DeleteDrillDialog` with injected ports. A Radix modal hides and traps the rest of the page, so one dialog is open at a time: pick a state below or load
                the page with `?delete=&lt;state&gt;`. Empty is N/A (a dialog always has a name); hover, focus-visible and disabled are scripted on Delete and Cancel. The closed
                trigger sits in the saved timer details card.
            </p>
            <div className="flex flex-wrap gap-2">
                {SCENARIOS.map((candidate) => (
                    <Button
                        key={candidate.fixture}
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`delete-open-${candidate.fixture}`}
                        onClick={() => {
                            setPicked({ fixture: candidate.fixture, run: (selected?.run ?? 0) + 1 });
                        }}
                    >
                        {candidate.title}
                    </Button>
                ))}
            </div>
            {scenario && selected ? (
                <Card className="min-w-0" data-fixture={`delete-${scenario.fixture}`} data-testid="delete-scenario" data-visual-state={scenario.fixture}>
                    <CardHeader>
                        <CardTitle>{scenario.title}</CardTitle>
                        <CardDescription>{scenario.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DeleteDrillDialog
                            key={`${scenario.fixture}-${String(selected.run)}`}
                            drill={{ id: DRILL_ID, name: scenario.name }}
                            deleteDrill={scenario.deleteDrill}
                            navigate={navigate}
                            defaultOpen
                        />
                    </CardContent>
                </Card>
            ) : null}
        </section>
    );
}
