import { useId, useState, type ReactNode, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignalPreviewControl from "@/components/timer/SignalPreviewControl";
import { useSignalPreview } from "@/components/hooks/useSignalPreview";
import type { DrillAudioPort } from "@/lib/drill-audio";
import { PREPARATION_NO_SOUND, signalAvailability, type PreviewSignal } from "@/lib/drill-signal-preview";
import { submitDrillConfig } from "@/lib/drill-config-submit";
import type { DrillConfigErrors, DrillConfigInput } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillConfigFormProps {
    values: DrillConfigInput;
    onValuesChange: (values: DrillConfigInput) => void;
    onStart: (configuration: Readonly<DrillConfiguration>) => void;
    createAudio?: () => Promise<DrillAudioPort | null>;
}

interface ConfigFieldProps {
    id: string;
    field: Exclude<keyof DrillConfigInput, "randomStartEnabled">;
    label: string;
    hint: string;
    value: string;
    error?: string;
    onChange: (field: Exclude<keyof DrillConfigInput, "randomStartEnabled">, value: string) => void;
    children?: ReactNode;
}

function ConfigField({ id, field, label, hint, value, error, onChange, children }: ConfigFieldProps) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
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
            />
            <p id={hintId} className="text-muted-foreground text-sm">
                {hint}
            </p>
            {error && (
                <p id={errorId} className="text-destructive text-sm" role="alert">
                    {error}
                </p>
            )}
            {children}
        </div>
    );
}

export default function DrillConfigForm({ values, onValuesChange, onStart, createAudio }: DrillConfigFormProps) {
    const id = useId();
    const [errors, setErrors] = useState<DrillConfigErrors>({});
    const preview = useSignalPreview(createAudio);
    const [lastSignal, setLastSignal] = useState<PreviewSignal | null>(null);

    function playPreview(signal: PreviewSignal) {
        setLastSignal(signal);
        preview.play(signal);
    }

    function previewControl(signal: PreviewSignal) {
        return (
            <SignalPreviewControl
                id={`${id}-${signal}-preview`}
                signal={signal}
                availability={signalAvailability(values, signal)}
                status={preview.status}
                activeSignal={preview.signal ?? lastSignal}
                onPlay={playPreview}
            />
        );
    }

    function handleChange(field: Exclude<keyof DrillConfigInput, "randomStartEnabled">, value: string) {
        onValuesChange({ ...values, [field]: value });
        if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const result = submitDrillConfig(values, { releasePreview: preview.release, onStart });
        setErrors(result.valid ? {} : result.errors);
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
            >
                <p className="text-muted-foreground text-sm">{PREPARATION_NO_SOUND}</p>
            </ConfigField>
            <ConfigField id={`${id}-exercise`} field="exercise" label="Exercise" hint="0:01 to 10:00" value={values.exercise} error={errors.exercise} onChange={handleChange}>
                {previewControl("exercise")}
            </ConfigField>
            <ConfigField id={`${id}-rest`} field="rest" label="Rest" hint="0:00 to 10:00" value={values.rest} error={errors.rest} onChange={handleChange}>
                {previewControl("rest")}
            </ConfigField>
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
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${id}-random-start`}
                        name="randomStartEnabled"
                        checked={values.randomStartEnabled}
                        onCheckedChange={(checked) => {
                            onValuesChange({ ...values, randomStartEnabled: checked === true });
                        }}
                        aria-describedby={`${id}-random-start-hint`}
                    />
                    <Label htmlFor={`${id}-random-start`}>Random start</Label>
                </div>
                <p id={`${id}-random-start-hint`} className="text-muted-foreground text-sm">
                    Wait a random 1–5 seconds before exercise starts.
                </p>
                {previewControl("standby")}
            </div>
            <Button type="submit" className="w-full">
                Start
            </Button>
        </form>
    );
}
