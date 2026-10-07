import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DrillCreateForm from "@/components/timer/DrillCreateForm";
import ThemeToggle from "@/components/timer/ThemeToggle";
import { useDrillCreate } from "@/components/hooks/useDrillCreate";
import { putSaveDrill } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { configInputFromSavedDrill } from "@/lib/saved-drill-summary";
import { cn } from "@/lib/utils";
import type { SavedDrill } from "@/types";

// /{id}/edit: the /create form prefilled with the stored timer; saving puts the full body to that one timer.
export default function DrillEditApp({ drill }: { drill: SavedDrill }) {
    const [values, setValues] = useState<DrillConfigInput>(() => configInputFromSavedDrill(drill.configuration));
    const edit = useDrillCreate(putSaveDrill(drill.id), { initialName: drill.name, keepAfterSave: true });

    return (
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <span aria-hidden="true" className="size-9" />
                    <h1 className="text-center text-3xl font-bold">Edit timer</h1>
                    <ThemeToggle />
                </CardHeader>
                <CardContent className="space-y-5">
                    <DrillCreateForm
                        values={values}
                        onValuesChange={(next) => {
                            setValues(next);
                            edit.markEdited();
                        }}
                        name={edit.name}
                        onNameChange={edit.setName}
                        nameError={edit.nameError}
                        status={edit.status}
                        failure={edit.failure}
                        savedName={edit.savedName}
                        onSubmitAttempt={edit.submitAttempt}
                        onSave={() => {
                            edit.save(values);
                        }}
                        submitLabel="Save changes"
                        signInHref={`/auth/signin?next=${encodeURIComponent(`/${drill.id}/edit`)}`}
                    />
                    <div className="flex flex-col">
                        <a href={`/${drill.id}`} className={cn(buttonVariants({ variant: "link" }), "w-full")}>
                            Back to timer
                        </a>
                        <a href="/dashboard" className={cn(buttonVariants({ variant: "link" }), "w-full")}>
                            Back to dashboard
                        </a>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
