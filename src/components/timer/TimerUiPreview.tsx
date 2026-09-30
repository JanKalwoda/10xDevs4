import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TimerUiPreview() {
    const id = useId();
    const [randomStartEnabled, setRandomStartEnabled] = useState(false);

    return (
        <main className="bg-background text-foreground mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-8">
            <header className="space-y-3">
                <h1 className="text-2xl font-semibold">Timer UI preview</h1>
                <p className="text-muted-foreground text-sm">Shared controls. Use Tab to inspect focus and Space to toggle the checkbox.</p>
                <nav aria-label="Preview theme" className="flex gap-2">
                    <Button asChild variant="outline">
                        <a href="?theme=light">Light preview</a>
                    </Button>
                    <Button asChild variant="outline">
                        <a href="?theme=dark">Dark preview</a>
                    </Button>
                </nav>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Configuration controls</CardTitle>
                    <CardDescription>Default, error and disabled examples.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-preparation`}>Preparation</Label>
                        <Input id={`${id}-preparation`} name="preparation" defaultValue="0:05" aria-describedby={`${id}-preparation-hint`} />
                        <p id={`${id}-preparation-hint`} className="text-muted-foreground text-sm">
                            0:00 to 10:00, in m:ss format.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-exercise`}>Exercise (error example)</Label>
                        <Input id={`${id}-exercise`} name="exercise" defaultValue="0:00" aria-invalid="true" aria-describedby={`${id}-exercise-hint ${id}-exercise-error`} />
                        <p id={`${id}-exercise-hint`} className="text-muted-foreground text-sm">
                            0:01 to 10:00, in m:ss format.
                        </p>
                        <p id={`${id}-exercise-error`} className="text-destructive text-sm">
                            Enter an exercise time from 0:01 to 10:00.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-repetitions`} className="text-muted-foreground">
                            Repetitions (disabled example)
                        </Label>
                        <Input id={`${id}-repetitions`} name="repetitions" inputMode="numeric" defaultValue="3" disabled aria-describedby={`${id}-repetitions-hint`} />
                        <p id={`${id}-repetitions-hint`} className="text-muted-foreground text-sm">
                            Whole number from 1 to 100.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`${id}-random-start`}
                                name="randomStartEnabled"
                                checked={randomStartEnabled}
                                onCheckedChange={(checked) => {
                                    setRandomStartEnabled(checked === true);
                                }}
                                aria-describedby={`${id}-random-start-hint`}
                            />
                            <Label htmlFor={`${id}-random-start`}>Random start</Label>
                        </div>
                        <p id={`${id}-random-start-hint`} className="text-muted-foreground text-sm">
                            Wait a random 1–5 seconds before exercise starts.
                        </p>
                        <p className="text-muted-foreground text-sm">Current value: {randomStartEnabled ? "true" : "false"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox id={`${id}-disabled-checkbox`} disabled checked />
                        <Label htmlFor={`${id}-disabled-checkbox`} className="text-muted-foreground">
                            Disabled checkbox
                        </Label>
                    </div>
                    <Button type="button" disabled className="w-full">
                        Start (disabled example)
                    </Button>
                </CardContent>
            </Card>

            <Alert>
                <AlertTitle>Audio unavailable</AlertTitle>
                <AlertDescription>The drill will continue silently.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
                <AlertTitle>Check the configuration</AlertTitle>
                <AlertDescription>Correct the exercise time before starting.</AlertDescription>
            </Alert>
        </main>
    );
}
