import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrillCreateForm from "@/components/timer/DrillCreateForm";
import type { DrillCreateFailure, DrillCreateStatus } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { SAVE_DRILL_MESSAGES } from "@/lib/services/drill-configurations";

const VALUES: DrillConfigInput = {
    preparation: "0:05",
    exercise: "0:04",
    rest: "0:02",
    repetitions: "3",
    randomStartEnabled: false,
};

type VisualState = "default" | "loading" | "error" | "disabled";

interface Scenario {
    fixture: string;
    title: string;
    description: string;
    visualState: VisualState;
    name: string;
    nameError?: string;
    status?: DrillCreateStatus;
    failure?: DrillCreateFailure;
}

/** Each scenario feeds the production `DrillCreateForm` the exact props the `useDrillCreate` hook would produce for that state. */
const SCENARIOS: Scenario[] = [
    { fixture: "default", title: "Default (empty)", description: "Empty name, default parameters. Also the empty state.", visualState: "default", name: "" },
    { fixture: "filled", title: "Filled", description: "A name is entered, ready to save.", visualState: "default", name: "Morning drill" },
    {
        fixture: "name-required",
        title: "Error: name required",
        description: "Submit with an empty name.",
        visualState: "error",
        name: "",
        nameError: SAVE_DRILL_MESSAGES.name,
    },
    {
        fixture: "duplicate-name",
        title: "Error: duplicate name",
        description: "The name field carries the server message.",
        visualState: "error",
        name: "morning drill",
        nameError: SAVE_DRILL_MESSAGES.duplicate_name,
    },
    {
        fixture: "limit-reached",
        title: "Error: limit reached",
        description: "Destructive alert above the submit.",
        visualState: "error",
        name: "Timer 51",
        status: "error",
        failure: { code: "limit_reached", message: SAVE_DRILL_MESSAGES.limit_reached },
    },
    {
        fixture: "saving",
        title: "Loading: saving",
        description: "Submit disabled and busy, name read-only. Also the redirect state: after a save the form stays locked while the page goes to the new timer.",
        visualState: "loading",
        name: "Morning drill",
        status: "saving",
    },
    {
        fixture: "unavailable",
        title: "Error: unavailable",
        description: "Table missing or no client: saving is temporarily unavailable.",
        visualState: "error",
        name: "Morning drill",
        status: "error",
        failure: { code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable },
    },
    {
        fixture: "session-expired",
        title: "Error: session expired",
        description: "Alert with a link back to sign-in.",
        visualState: "error",
        name: "Morning drill",
        status: "error",
        failure: { code: "unauthorized", message: SAVE_DRILL_MESSAGES.unauthorized },
    },
];

function CreateDrillFixture({ scenario }: { scenario: Scenario }) {
    const [values, setValues] = useState<DrillConfigInput>(VALUES);
    const [name, setName] = useState(scenario.name);
    const status = scenario.status ?? "idle";

    return (
        <Card data-fixture={`create-${scenario.fixture}`} data-testid={`create-${scenario.fixture}`} data-visual-state={scenario.visualState}>
            <CardHeader>
                <CardTitle>{scenario.title}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <DrillCreateForm
                    values={values}
                    onValuesChange={setValues}
                    name={name}
                    onNameChange={setName}
                    nameError={scenario.nameError ?? null}
                    status={status}
                    failure={scenario.failure ?? null}
                    savedName={null}
                    onSubmitAttempt={() => undefined}
                    onSave={() => undefined}
                    createAudio={() => Promise.resolve(null)}
                />
            </CardContent>
        </Card>
    );
}

export default function CreateDrillFixtures() {
    return (
        <section aria-label="Create timer examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Create a timer</h2>
            <p className="text-muted-foreground text-sm">
                Production create form with the props every save state produces. Hover and focus-visible are scripted on Save in the Filled card.
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {SCENARIOS.map((scenario) => (
                    <CreateDrillFixture key={scenario.fixture} scenario={scenario} />
                ))}
            </div>
        </section>
    );
}
