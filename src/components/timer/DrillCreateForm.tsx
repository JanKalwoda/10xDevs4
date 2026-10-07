import { useEffect, useId, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import type { DrillAudioPort } from "@/lib/drill-audio";
import type { DrillCreateFailure, DrillCreateStatus } from "@/lib/drill-create-controller";
import type { DrillConfigInput } from "@/lib/drill-timer";
import { cn } from "@/lib/utils";

export const SIGN_IN_FOR_CREATE_HREF = "/auth/signin?next=%2Fcreate";

interface DrillCreateFormProps {
    values: DrillConfigInput;
    onValuesChange: (values: DrillConfigInput) => void;
    name: string;
    onNameChange: (name: string) => void;
    nameError: string | null;
    status: DrillCreateStatus;
    failure: DrillCreateFailure | null;
    savedName: string | null;
    onSubmitAttempt: () => void;
    onSave: () => void;
    createAudio?: () => Promise<DrillAudioPort | null>;
    /** Submit button text; the pending label stays `Saving…`. */
    submitLabel?: string;
    /** Where the `unauthorized` alert sends the user to sign in again. */
    signInHref?: string;
}

/** Purely presentational: every state comes from props so `/dev/timer-ui` can render it deterministically. */
export default function DrillCreateForm({
    values,
    onValuesChange,
    name,
    onNameChange,
    nameError,
    status,
    failure,
    savedName,
    onSubmitAttempt,
    onSave,
    createAudio,
    submitLabel = "Save timer",
    signInHref = SIGN_IN_FOR_CREATE_HREF,
}: DrillCreateFormProps) {
    const id = useId();
    const nameId = `${id}-name`;
    const hintId = `${nameId}-hint`;
    const errorId = `${nameId}-error`;
    const nameRef = useRef<HTMLInputElement>(null);
    const pending = status === "saving";

    useEffect(() => {
        if (status === "saved") nameRef.current?.focus();
    }, [status]);

    const nameField = (
        <div className="space-y-1">
            <Label htmlFor={nameId}>Name</Label>
            {/* No maxLength: it counts UTF-16 units and would cut astral names; the 200 code-point limit is validated by the service. */}
            <Input
                ref={nameRef}
                id={nameId}
                name="name"
                type="text"
                autoComplete="off"
                value={name}
                readOnly={pending}
                onChange={(event) => {
                    onNameChange(event.target.value);
                }}
                aria-invalid={Boolean(nameError)}
                aria-describedby={`${hintId}${nameError ? ` ${errorId}` : ""}`}
            />
            <p id={hintId} className="text-muted-foreground text-sm">
                1 to 200 characters
            </p>
            {nameError && (
                <p id={errorId} className="text-destructive text-sm" role="alert">
                    {nameError}
                </p>
            )}
        </div>
    );

    const failureAlert = failure && (
        <Alert variant="destructive">
            <AlertDescription>
                <p>{failure.message}</p>
                {failure.code === "unauthorized" && (
                    <a href={signInHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                        Sign in
                    </a>
                )}
                {failure.code === "not_found" && (
                    <a href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                        Back to dashboard
                    </a>
                )}
            </AlertDescription>
        </Alert>
    );

    return (
        <div className="space-y-5">
            {status === "saved" && savedName !== null && (
                <Alert role="status">
                    <AlertDescription>{`Saved "${savedName}".`}</AlertDescription>
                </Alert>
            )}
            <DrillConfigForm
                values={values}
                onValuesChange={onValuesChange}
                onStart={onSave}
                createAudio={createAudio}
                submitLabel={pending ? "Saving…" : submitLabel}
                pending={pending}
                onSubmitAttempt={onSubmitAttempt}
                leading={nameField}
                beforeSubmit={failureAlert}
            />
        </div>
    );
}
