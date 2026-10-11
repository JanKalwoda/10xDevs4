import type { MouseEvent, PointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroupAddon } from "@/components/ui/input-group";
import { useStepRepeat } from "@/components/hooks/useStepRepeat";
import { cn } from "@/lib/utils";
import { canStep, type StepDirection, type StepperField } from "@/lib/drill-stepper";

interface ConfigStepperProps {
    field: StepperField;
    inputId: string;
    value: string;
    /** Lower-case field name for the accessible names, e.g. "exercise". */
    label: string;
    onStep: (next: string) => void;
}

// Inside the field frame. Default (primary pointer is fine, also a touch laptop): a column of two halves of the row.
// Primary pointer coarse: two 44 px buttons side by side, extended over the frame border (-my-px) to a full 44 px target.
const BUTTON_CLASS =
    "relative w-8 flex-1 touch-none select-none rounded-none border-0 p-0 shadow-none focus-visible:z-10 pointer-coarse:-my-px pointer-coarse:size-11 pointer-coarse:flex-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-foreground dark:aria-disabled:hover:bg-transparent";

/**
 * Up/down buttons inside the frame of one field, at its right edge like a native spinner: a column (up above down)
 * when the primary pointer is fine, two 44 px buttons side by side (down, up) when it is coarse. A single step always comes from the click (mouse, touch, keyboard, screen reader, voice control); holding the
 * button repeats after a pause. Keyboard users have ↑/↓ in the field, so the buttons skip Tab.
 */
export default function ConfigStepper({ field, inputId, value, label, onStep }: ConfigStepperProps) {
    const press = useStepRepeat(field, value, onStep);

    function handlePointerDown(direction: StepDirection, event: PointerEvent<HTMLButtonElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // A synthesized or already ended pointer cannot be captured; the press works without it.
        }
        press.pointerDown(direction);
    }

    function isInside(event: PointerEvent<HTMLButtonElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    // A captured pointer never fires pointerleave, so leaving the button is detected here.
    function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (!isInside(event)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            press.pointerAbort();
        }
    }

    function handleClick(direction: StepDirection, event: MouseEvent<HTMLButtonElement>) {
        // detail is 0 for a click from the keyboard or from assistive technology.
        press.click(direction, event.detail > 0);
    }

    const unit = field === "repetitions" ? "" : " second";
    const buttons: { direction: StepDirection; name: string; Icon: typeof ChevronUp; className: string }[] = [
        { direction: "up", name: "Increase", Icon: ChevronUp, className: "rounded-tr-md pointer-coarse:rounded-r-md" },
        {
            direction: "down",
            name: "Decrease",
            Icon: ChevronDown,
            className: "border-input rounded-br-md border-t pointer-coarse:rounded-none pointer-coarse:border-t-0 pointer-coarse:border-r",
        },
    ];

    return (
        <InputGroupAddon className="border-input flex-col border-l pointer-coarse:flex-row-reverse">
            {buttons.map(({ direction, name, Icon, className }) => (
                <Button
                    key={direction}
                    type="button"
                    variant="ghost"
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
                    onPointerUp={(event) => {
                        press.pointerUp(isInside(event));
                    }}
                    onPointerCancel={press.pointerAbort}
                    onLostPointerCapture={press.pointerAbort}
                    onPointerLeave={press.pointerAbort}
                    onBlur={press.blur}
                    onContextMenu={(event) => {
                        event.preventDefault();
                    }}
                    onClick={(event) => {
                        handleClick(direction, event);
                    }}
                >
                    <Icon aria-hidden="true" />
                </Button>
            ))}
        </InputGroupAddon>
    );
}
