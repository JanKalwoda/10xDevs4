import { useEffect, useId, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import ConfigStepper from "@/components/timer/ConfigStepper";
import SignalPreviewControl, { type SignalPreviewSlots } from "@/components/timer/SignalPreviewControl";
import { useSignalPreview } from "@/components/hooks/useSignalPreview";
import type { DrillAudioPort } from "@/lib/drill-audio";
import { stepFieldValue } from "@/lib/drill-stepper";
import { PREPARATION_NO_SOUND, signalAvailability, type PreviewSignal } from "@/lib/drill-signal-preview";
import { submitDrillConfig } from "@/lib/drill-config-submit";
import type { DrillConfigErrors, DrillConfigInput } from "@/lib/drill-timer";
import type { DrillConfiguration } from "@/types";

interface DrillConfigFormProps {
    values: DrillConfigInput;
    onValuesChange: (values: DrillConfigInput) => void;
    onStart: (configuration: Readonly<DrillConfiguration>) => void;
    createAudio?: () => Promise<DrillAudioPort | null>;
    submitLabel?: string;
    /** Rendered above the parameter fields. */
    leading?: ReactNode;
    /** Rendered directly above the submit button. */
    beforeSubmit?: ReactNode;
    /** Disables submit and marks it busy. */
    pending?: boolean;
    /** Called at the start of every submit, before the parameters are validated. */
    onSubmitAttempt?: () => void;
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
    /** End of the input row. */
    action?: ReactNode;
    /** Under the hint and the error. */
    feedback?: ReactNode;
}

/** Pause after the last button step before the new value is announced, so a held button announces only the end. */
const ANNOUNCE_DELAY_MS = 300;

function ConfigField({ id, field, label, hint, value, error, onChange, children, action, feedback }: ConfigFieldProps) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const [announcement, setAnnouncement] = useState("");
    const announceStep = useRef(false);

    useEffect(() => {
        if (!announceStep.current) return;
        const timer = setTimeout(() => {
            announceStep.current = false;
            setAnnouncement(`${label} ${value}`);
        }, ANNOUNCE_DELAY_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [label, value]);

    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    name={field}
                    type="text"
                    inputMode={field === "repetitions" ? "numeric" : "text"}
                    value={value}
                    onChange={(event) => {
                        announceStep.current = false;
                        setAnnouncement("");
                        onChange(field, event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                        event.preventDefault();
                        const amount = event.shiftKey ? 10 : 1;
                        onChange(field, stepFieldValue(field, value, event.key === "ArrowUp" ? amount : -amount));
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
                    className="min-w-0 flex-1"
                />
                <ConfigStepper
                    field={field}
                    inputId={id}
                    value={value}
                    label={label.toLowerCase()}
                    onStep={(next) => {
                        announceStep.current = true;
                        onChange(field, next);
                    }}
                />
                {action}
            </div>
            <p role="status" className="sr-only">
                {announcement}
            </p>
            <p id={hintId} className="text-muted-foreground text-sm">
                {hint}
            </p>
            {error && (
                <p id={errorId} className="text-destructive text-sm" role="alert">
                    {error}
                </p>
            )}
            {feedback}
            {children}
        </div>
    );
}

export default function DrillConfigForm({
    values,
    onValuesChange,
    onStart,
    createAudio,
    submitLabel = "Start",
    leading,
    beforeSubmit,
    pending = false,
    onSubmitAttempt,
}: DrillConfigFormProps) {
    const id = useId();
    const [errors, setErrors] = useState<DrillConfigErrors>({});
    const preview = useSignalPreview(createAudio);
    const [lastSignal, setLastSignal] = useState<PreviewSignal | null>(null);

    function playPreview(signal: PreviewSignal) {
        setLastSignal(signal);
        preview.play(signal);
    }

    function previewControl(signal: PreviewSignal, children: (slots: SignalPreviewSlots) => ReactNode) {
        return (
            <SignalPreviewControl
                id={`${id}-${signal}-preview`}
                signal={signal}
                availability={signalAvailability(values, signal)}
                status={preview.status}
                activeSignal={preview.signal ?? lastSignal}
                onPlay={playPreview}
            >
                {children}
            </SignalPreviewControl>
        );
    }

    function handleChange(field: Exclude<keyof DrillConfigInput, "randomStartEnabled">, value: string) {
        onValuesChange({ ...values, [field]: value });
        if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmitAttempt?.();
        const result = submitDrillConfig(values, { releasePreview: preview.release, onStart });
        setErrors(result.valid ? {} : result.errors);
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <TooltipProvider>
                {leading}
                <p className="text-muted-foreground text-sm">Enter times in m:ss format (for example, 0:05). Use the arrows, or ↑ and ↓ in a field (Shift for 10).</p>
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
                {previewControl("exercise", ({ action, feedback }) => (
                    <ConfigField
                        id={`${id}-exercise`}
                        field="exercise"
                        label="Exercise"
                        hint="0:01 to 10:00"
                        value={values.exercise}
                        error={errors.exercise}
                        onChange={handleChange}
                        action={action}
                        feedback={feedback}
                    />
                ))}
                {previewControl("rest", ({ action, feedback }) => (
                    <ConfigField
                        id={`${id}-rest`}
                        field="rest"
                        label="Rest"
                        hint="0:00 to 10:00"
                        value={values.rest}
                        error={errors.rest}
                        onChange={handleChange}
                        action={action}
                        feedback={feedback}
                    />
                ))}
                <ConfigField
                    id={`${id}-repetitions`}
                    field="repetitions"
                    label="Repetitions"
                    hint="Whole number from 1 to 100"
                    value={values.repetitions}
                    error={errors.repetitions}
                    onChange={handleChange}
                />
                {previewControl("standby", ({ action, feedback }) => (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
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
                            {action}
                        </div>
                        <p id={`${id}-random-start-hint`} className="text-muted-foreground text-sm">
                            Wait a random 1–5 seconds before exercise starts.
                        </p>
                        {feedback}
                    </div>
                ))}
                {beforeSubmit}
                <Button type="submit" className="w-full" disabled={pending} aria-busy={pending || undefined}>
                    {submitLabel}
                </Button>
            </TooltipProvider>
        </form>
    );
}
