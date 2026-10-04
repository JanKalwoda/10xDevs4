import React, { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
    next: string;
}

type FormState = "idle" | "pending" | "invalid" | "error";

export default function SignInForm({ next }: Props) {
    const [email, setEmail] = useState("");
    const [state, setState] = useState<FormState>("idle");
    const emailInput = useRef<HTMLInputElement>(null);
    const isPending = state === "pending";

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!emailInput.current?.checkValidity()) {
            setState("invalid");
            emailInput.current?.focus();
            return;
        }

        setState("pending");
        const form = new FormData(event.currentTarget);
        try {
            const response = await fetch("/api/auth/signin", { method: "POST", body: form });
            const result = (await response.json()) as { ok?: boolean };
            if (response.ok && result.ok) {
                window.location.assign("/auth/confirm-email?next=" + encodeURIComponent(next));
                return;
            }
            setState(response.status === 400 ? "invalid" : "error");
        } catch {
            setState("error");
        }
    }

    return (
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                    ref={emailInput}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    required
                    disabled={isPending}
                    aria-invalid={state === "invalid"}
                    aria-describedby={state === "invalid" ? "email-error" : undefined}
                    onChange={(event) => {
                        setEmail(event.currentTarget.value);
                        if (state !== "pending") setState("idle");
                    }}
                />
                {state === "invalid" && (
                    <p id="email-error" className="text-destructive text-sm" role="alert">
                        Enter a valid email address.
                    </p>
                )}
            </div>

            {state === "error" && (
                <p className="text-destructive text-sm" role="alert">
                    We couldn&apos;t request a sign-in link right now. Please try again.
                </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending} aria-busy={isPending}>
                {isPending ? "Sending link…" : "Email me a sign-in link"}
            </Button>

            <p className="text-muted-foreground text-sm" aria-live="polite">
                New and existing accounts use the same secure email link.
            </p>
        </form>
    );
}
