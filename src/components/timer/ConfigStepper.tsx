import { useEffect, useRef, type PointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStepRepeat } from "@/components/hooks/useStepRepeat";
import { cn } from "@/lib/utils";
import { canStep, stepFieldValue, type StepDirection, type StepperField } from "@/lib/drill-stepper";

/** The click that follows a pointer press is ignored for this long after the pointer is released. */
const CLICK_AFTER_POINTER_MS = 100;

interface ConfigStepperProps {
    field: StepperField;
    inputId: string;
    value: string;
    /** Lower-case field name for the accessible names, e.g. "exercise". */
    label: string;
    onStep: (next: string) => void;
}

const BUTTON_CLASS =
    "relative h-5.5 w-8 touch-none select-none rounded-none p-0 shadow-none focus-visible:z-10 any-pointer-coarse:size-11 any-pointer-coarse:rounded-md any-pointer-coarse:border-t any-pointer-coarse:shadow-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-background aria-disabled:hover:text-foreground dark:aria-disabled:hover:bg-input/30";

/**
 * Up/down buttons for one field: a 2 x 22 px column for a mouse, two 44 px buttons side by side when any pointer is
 * coarse. Mouse and touch step on pointerdown and repeat while held; a click without a preceding pointer press
 * (keyboard, screen reader, voice control) steps once. Keyboard users have ↑/↓ in the field, so the buttons skip Tab.
 */
export default function ConfigStepper({ field, inputId, value, label, onStep }: ConfigStepperProps) {
    const { start, stop } = useStepRepeat(field, value, onStep);
    const handledByPointer = useRef(false);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(
        () => () => {
            clearTimeout(clearTimer.current);
        },
        [],
    );

    function release() {
        stop();
        clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => {
            handledByPointer.current = false;
        }, CLICK_AFTER_POINTER_MS);
    }

    function handlePointerDown(direction: StepDirection, event: PointerEvent<HTMLButtonElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        clearTimeout(clearTimer.current);
        handledByPointer.current = true;
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // A synthesized or already ended pointer cannot be captured; stepping still works without it.
        }
        start(direction);
    }

    // A captured pointer never fires pointerleave, so leaving the button is detected here.
    function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            release();
        }
    }

    function handleClick(direction: StepDirection) {
        if (handledByPointer.current) {
            handledByPointer.current = false;
            return;
        }
        if (canStep(field, value, direction)) onStep(stepFieldValue(field, value, direction === "up" ? 1 : -1));
    }

    const unit = field === "repetitions" ? "" : " second";
    const buttons: { direction: StepDirection; name: string; Icon: typeof ChevronUp; className: string }[] = [
        { direction: "up", name: "Increase", Icon: ChevronUp, className: "rounded-t-md" },
        { direction: "down", name: "Decrease", Icon: ChevronDown, className: "rounded-b-md border-t-0" },
    ];

    return (
        <div className="flex shrink-0 flex-col any-pointer-coarse:flex-row-reverse any-pointer-coarse:gap-2">
            {buttons.map(({ direction, name, Icon, className }) => (
                <Button
                    key={direction}
                    type="button"
                    variant="outline"
                    size="icon"
                    tabIndex={-1}
                    className={cn(BUTTON_CLASS, className)}
                    aria-label={`${name} ${label} by 1${unit}`}
                    aria-controls={inputId}
                    aria-disabled={!canStep(field, value, direction)}
                    onPointerDown={(event) => {
                        handlePointerDown(direction, event);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={release}
                    onPointerCancel={release}
                    onLostPointerCapture={release}
                    onPointerLeave={release}
                    onBlur={() => {
                        stop();
                        handledByPointer.current = false;
                    }}
                    onContextMenu={(event) => {
                        event.preventDefault();
                    }}
                    onClick={() => {
                        handleClick(direction);
                    }}
                >
                    <Icon aria-hidden="true" />
                </Button>
            ))}
        </div>
    );
}
