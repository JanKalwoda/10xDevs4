import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import type { DrillConfigInput } from "@/lib/drill-timer";

interface StepperFixtureProps {
    title: string;
    description: string;
    fixture: string;
    visualState: string;
    initial: DrillConfigInput;
    pending?: boolean;
}

function StepperFixture({ title, description, fixture, visualState, initial, pending = false }: StepperFixtureProps) {
    const [values, setValues] = useState<DrillConfigInput>(initial);
    const [starts, setStarts] = useState(0);

    return (
        <Card data-fixture={fixture} data-testid={`stepper-${fixture}`} data-visual-state={visualState}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <DrillConfigForm
                    values={values}
                    onValuesChange={setValues}
                    pending={pending}
                    onStart={() => {
                        setStarts((current) => current + 1);
                    }}
                />
                <p className="text-muted-foreground text-sm">
                    Start calls: <span data-evidence="start-calls">{starts}</span>
                </p>
            </CardContent>
        </Card>
    );
}

const DEFAULT_VALUES: DrillConfigInput = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false };

export default function ConfigStepperFixtures() {
    return (
        <section aria-label="Config stepper examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Config stepper</h2>
            <p className="text-muted-foreground text-sm">
                Production configuration form. The layout follows the pointer of the browser: a 22 px column for a mouse, two 44 px buttons when any pointer is coarse. Hover is
                driven by the visual gate; focus-visible belongs to the field (↑/↓), because the arrows skip Tab.
            </p>
            <div className="grid gap-6 lg:grid-cols-3">
                <StepperFixture title="Default" description="Mid-range values; every arrow is enabled." fixture="default" visualState="default" initial={DEFAULT_VALUES} />
                <StepperFixture
                    title="Disabled (lower bounds)"
                    description="Exercise 0:01, Preparation and Rest 0:00 and Repetitions 1: the down arrows are aria-disabled."
                    fixture="disabled-min"
                    visualState="disabled"
                    initial={{ ...DEFAULT_VALUES, preparation: "0:00", exercise: "0:01", rest: "0:00", repetitions: "1" }}
                />
                <StepperFixture
                    title="Disabled (upper bounds)"
                    description="Preparation, Exercise and Rest 10:00 and Repetitions 100: the up arrows are aria-disabled."
                    fixture="disabled-max"
                    visualState="disabled"
                    initial={{ ...DEFAULT_VALUES, preparation: "10:00", exercise: "10:00", rest: "10:00", repetitions: "100" }}
                />
                <StepperFixture
                    title="Error (invalid values)"
                    description="Press Start to show the validation errors; the first arrow press then steps an invalid value to the field minimum."
                    fixture="error"
                    visualState="error"
                    initial={{ ...DEFAULT_VALUES, preparation: "abc", exercise: "", rest: "0:5", repetitions: "0" }}
                />
                <StepperFixture
                    title="Loading (pending)"
                    description="Submit is disabled and busy; the arrows stay usable."
                    fixture="loading"
                    visualState="loading"
                    initial={DEFAULT_VALUES}
                    pending
                />
            </div>
        </section>
    );
}
