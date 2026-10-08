import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrillCreateForm from "@/components/timer/DrillCreateForm";
import { DrillEditLinks } from "@/components/timer/DrillEditApp";
import type { DrillCreateFailure, DrillCreateStatus } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { configInputFromSavedDrill } from "@/lib/saved-drill-summary";
import { SAVE_DRILL_MESSAGES } from "@/lib/services/drill-configurations";
import type { DrillConfiguration } from "@/types";

const DRILL_ID = "00000000-0000-4000-8000-000000000003";
const SIGN_IN_HREF = `/auth/signin?next=${encodeURIComponent(`/${DRILL_ID}/edit`)}`;
const STORED: DrillConfiguration = { preparationSeconds: 5, exerciseSeconds: 600, restSeconds: 0, repetitions: 3, randomStartEnabled: true };
const STORED_NAME = "Morning drill";
// What the server answers for a rest of 99:99, the same text the form shows for it inline.
const REST_ERROR = "Enter a time from 0:00 to 10:00 in m:ss format.";

type VisualState = "default" | "loading" | "error" | "disabled";

interface Scenario {
    fixture: string;
    title: string;
    description: string;
    visualState: VisualState;
    name?: string;
    values?: DrillConfigInput;
    nameError?: string;
    status?: DrillCreateStatus;
    failure?: DrillCreateFailure;
    savedName?: string;
}

/** Each scenario feeds the production `DrillCreateForm` the exact props `DrillEditApp` produces for that state (stored values come from `configInputFromSavedDrill`). */
const SCENARIOS: Scenario[] = [
    {
        fixture: "default",
        title: "Default (prefilled)",
        description: "Stored name and parameters (0:00 rest, 10:00 exercise, random start). Hover and focus-visible are scripted on Save changes.",
        visualState: "default",
    },
    {
        fixture: "saved",
        title: "Saved",
        description: "Confirmation, the saved name stays in the field, links back stay visible.",
        visualState: "default",
        status: "saved",
        savedName: STORED_NAME,
    },
    {
        fixture: "saving",
        title: "Loading: saving",
        description: "Submit disabled and busy, name read-only. Covers the disabled state.",
        visualState: "loading",
        status: "saving",
    },
    {
        fixture: "name-required",
        title: "Error: name required",
        description: "The name was cleared and submitted.",
        visualState: "error",
        name: "",
        nameError: SAVE_DRILL_MESSAGES.name,
    },
    {
        fixture: "duplicate-name",
        title: "Error: duplicate name",
        description: "Another own timer has this name (any case); every typed value stays.",
        visualState: "error",
        name: "evening drill",
        nameError: SAVE_DRILL_MESSAGES.duplicate_name,
    },
    {
        fixture: "invalid-parameters",
        title: "Error: invalid parameters",
        description: "Rest is 99:99; the inline error appears when Save changes is pressed (scripted).",
        visualState: "error",
        values: { ...configInputFromSavedDrill(STORED), rest: "99:99" },
    },
    {
        fixture: "server-validation",
        title: "Error: server validation",
        description: "The server refused the parameters; its message is an alert above the submit.",
        visualState: "error",
        status: "error",
        failure: { code: "validation", message: REST_ERROR },
    },
    {
        fixture: "not-found",
        title: "Error: timer gone",
        description: "The row was deleted or is not the user's: alert with a link back to the timers.",
        visualState: "error",
        status: "error",
        failure: { code: "not_found", message: SAVE_DRILL_MESSAGES.not_found },
    },
    {
        fixture: "session-expired",
        title: "Error: session expired",
        description: "Alert with a link that returns to this edit page after signing in.",
        visualState: "error",
        status: "error",
        failure: { code: "unauthorized", message: SAVE_DRILL_MESSAGES.unauthorized },
    },
    {
        fixture: "unavailable",
        title: "Error: unavailable",
        description: "Table missing or no client: saving is temporarily unavailable.",
        visualState: "error",
        status: "error",
        failure: { code: "unavailable", message: SAVE_DRILL_MESSAGES.unavailable },
    },
];

function EditDrillFixture({ scenario }: { scenario: Scenario }) {
    const [values, setValues] = useState<DrillConfigInput>(scenario.values ?? configInputFromSavedDrill(STORED));
    const [name, setName] = useState(scenario.name ?? STORED_NAME);

    return (
        <Card className="min-w-0" data-fixture={`edit-${scenario.fixture}`} data-testid={`edit-${scenario.fixture}`} data-visual-state={scenario.visualState}>
            <CardHeader>
                <CardTitle>{scenario.title}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <DrillCreateForm
                    values={values}
                    onValuesChange={setValues}
                    name={name}
                    onNameChange={setName}
                    nameError={scenario.nameError ?? null}
                    status={scenario.status ?? "idle"}
                    failure={scenario.failure ?? null}
                    savedName={scenario.savedName ?? null}
                    onSubmitAttempt={() => undefined}
                    onSave={() => undefined}
                    createAudio={() => Promise.resolve(null)}
                    submitLabel="Save changes"
                    signInHref={SIGN_IN_HREF}
                />
                <DrillEditLinks id={DRILL_ID} />
            </CardContent>
        </Card>
    );
}

export default function EditDrillFixtures() {
    return (
        <section aria-label="Edit timer examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Edit a timer</h2>
            <p className="text-muted-foreground text-sm">
                Production edit form (`DrillCreateForm` with `Save changes`) and the links of `DrillEditApp`. Empty is N/A (the form is always prefilled; the empty-name error is
                shown). Disabled and loading are the saving card. The shared 404 for a foreign or unknown id is an Astro view checked over HTTP.
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {SCENARIOS.map((scenario) => (
                    <EditDrillFixture key={scenario.fixture} scenario={scenario} />
                ))}
            </div>
        </section>
    );
}
