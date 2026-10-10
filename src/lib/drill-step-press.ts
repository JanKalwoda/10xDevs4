import type { StepRepeater } from "./drill-step-repeat.ts";
import type { StepDirection } from "./drill-stepper.ts";

export interface StepPress {
    pointerDown: (direction: StepDirection) => void;
    /** `overButton`: the pointer was released over the button, so the browser will send a click. */
    pointerUp: (overButton: boolean) => void;
    /** Leave, cancel or lost capture; a no-op once the pointer was released. */
    pointerAbort: () => void;
    /** Focus left the button or it unmounted. */
    blur: () => void;
    /** `fromPointer`: the click came from a pointer (`event.detail > 0`), not from a key or an assistive technology. */
    click: (direction: StepDirection, fromPointer: boolean) => void;
    /** Replaces `step` and `canStep`, so a component can hand in the newest props after every render. */
    bind: (handlers: StepHandlers) => void;
}

interface StepHandlers {
    /** One step of the field; returns false when the field cannot move further in that direction. */
    step: (direction: StepDirection) => boolean;
    /** Whether the field can move in that direction right now. */
    canStep: (direction: StepDirection) => boolean;
}

interface StepPressOptions extends StepHandlers {
    repeater: StepRepeater;
}

/**
 * One press of a stepper arrow. A single step always comes from `click`, so a tap can never step twice; the pointer
 * only arms the hold-to-repeat. When the repeat started and the pointer is released over the button, the click that
 * follows belongs to the hold and is skipped. No timer decides this: the flag is cleared by that click, a new press,
 * or any end of the gesture after which no click will come.
 */
export function createStepPress({ repeater, ...initial }: StepPressOptions): StepPress {
    let handlers: StepHandlers = initial;
    let pressed = false;
    let repeatStarted = false;
    let skipClick = false;

    function end() {
        pressed = false;
        repeatStarted = false;
        repeater.stop();
    }

    return {
        pointerDown(direction) {
            end();
            skipClick = false;
            pressed = true;
            if (!handlers.canStep(direction)) return;
            repeater.arm(
                () => handlers.step(direction),
                () => {
                    repeatStarted = true;
                },
            );
        },
        pointerUp(overButton) {
            if (!pressed) return;
            const held = repeatStarted;
            end();
            skipClick = held && overButton;
        },
        pointerAbort() {
            if (!pressed) return;
            end();
            skipClick = false;
        },
        blur() {
            end();
            skipClick = false;
        },
        click(direction, fromPointer) {
            const skip = skipClick && fromPointer;
            skipClick = false;
            if (skip) return;
            if (handlers.canStep(direction)) handlers.step(direction);
        },
        bind(next) {
            handlers = next;
        },
    };
}
