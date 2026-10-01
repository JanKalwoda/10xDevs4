import { useId, useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { parseDrillConfig, type DrillConfigErrors, type DrillConfigInput } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillConfigFormProps {
    values: DrillConfigInput;
    onValuesChange: (values: DrillConfigInput) => void;
    onStart: (configuration: Readonly<DrillConfiguration>) => void;
}

interface ConfigFieldProps {
    id: string;
    field: Exclude<keyof DrillConfigInput, "randomStartEnabled">;
    label: string;
    hint: string;
    value: string;
    error?: string;
    onChange: (field: Exclude<keyof DrillConfigInput, "randomStartEnabled">, value: string) => void;
}

function ConfigField({ id, field, label, hint, value, error, onChange }: ConfigFieldProps) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="block text-sm font-medium">
                {label}
            </label>
            <input
                id={id}
                name={field}
                type="text"
                inputMode={field === "repetitions" ? "numeric" : "text"}
                value={value}
                onChange={(event) => {
                    onChange(field, event.target.value);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-invalid:border-red-600"
            />
            <p id={hintId} className="text-muted-foreground text-sm">
                {hint}
            </p>
            {error && (
                <p id={errorId} className="text-destructive text-sm" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

export default function DrillConfigForm({ values, onValuesChange, onStart }: DrillConfigFormProps) {
    const id = useId();
    const [errors, setErrors] = useState<DrillConfigErrors>({});

    function handleChange(field: Exclude<keyof DrillConfigInput, "randomStartEnabled">, value: string) {
        onValuesChange({ ...values, [field]: value });
        if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const result = parseDrillConfig(values);
        if (!result.valid) {
            setErrors(result.errors);
            return;
        }

        setErrors({});
        onStart(Object.freeze({ ...result.configuration }));
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <p className="text-muted-foreground text-sm">Enter times in m:ss format (for example, 0:05).</p>
            <ConfigField
                id={`${id}-preparation`}
                field="preparation"
                label="Preparation"
                hint="0:00 to 10:00"
                value={values.preparation}
                error={errors.preparation}
                onChange={handleChange}
            />
            <ConfigField id={`${id}-exercise`} field="exercise" label="Exercise" hint="0:01 to 10:00" value={values.exercise} error={errors.exercise} onChange={handleChange} />
            <ConfigField id={`${id}-rest`} field="rest" label="Rest" hint="0:00 to 10:00" value={values.rest} error={errors.rest} onChange={handleChange} />
            <ConfigField
                id={`${id}-repetitions`}
                field="repetitions"
                label="Repetitions"
                hint="Whole number from 1 to 100"
                value={values.repetitions}
                error={errors.repetitions}
                onChange={handleChange}
            />
            <div className="space-y-1">
                <label htmlFor={`${id}-random-start`} className="flex items-center gap-2 text-sm font-medium">
                    <input
                        id={`${id}-random-start`}
                        name="randomStartEnabled"
                        type="checkbox"
                        checked={values.randomStartEnabled}
                        onChange={(event) => {
                            onValuesChange({ ...values, randomStartEnabled: event.target.checked });
                        }}
                        aria-describedby={`${id}-random-start-hint`}
                        className="size-4 accent-blue-600"
                    />
                    Random start
                </label>
                <p id={`${id}-random-start-hint`} className="text-muted-foreground text-sm">
                    Wait a random 1–5 seconds before exercise starts.
                </p>
            </div>
            <Button type="submit" className="w-full">
                Start
            </Button>
        </form>
    );
}
