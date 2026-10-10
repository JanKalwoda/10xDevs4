import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DrillCreateForm from "@/components/timer/DrillCreateForm";
import { useDrillCreate } from "@/components/hooks/useDrillCreate";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { cn } from "@/lib/utils";

const DEFAULT_VALUES: DrillConfigInput = {
    preparation: "0:05",
    exercise: "0:04",
    rest: "0:02",
    repetitions: "3",
    randomStartEnabled: false,
};

export default function DrillCreateApp() {
    const [values, setValues] = useState<DrillConfigInput>(DEFAULT_VALUES);
    const create = useDrillCreate();

    return (
        <main className="bg-background text-foreground flex flex-1 items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <h1 className="text-center text-3xl font-bold">Create a timer</h1>
                </CardHeader>
                <CardContent className="space-y-5">
                    <DrillCreateForm
                        values={values}
                        onValuesChange={setValues}
                        name={create.name}
                        onNameChange={create.setName}
                        nameError={create.nameError}
                        status={create.status}
                        failure={create.failure}
                        savedName={create.savedName}
                        onSubmitAttempt={create.submitAttempt}
                        onSave={() => {
                            create.save(values);
                        }}
                    />
                    <a href="/timers" className={cn(buttonVariants({ variant: "link" }), "w-full")}>
                        Back to timers
                    </a>
                </CardContent>
            </Card>
        </main>
    );
}
