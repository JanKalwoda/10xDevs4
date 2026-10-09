import { useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSignalAnnouncer } from "@/components/hooks/useSignalAnnouncer";
import { useSignalHint } from "@/components/hooks/useSignalHint";
import { SIGNAL_MEANINGS, type PreviewSignal } from "@/lib/drill-signal-preview";
import type { SignalPreviewStatus } from "@/lib/drill-signal-preview-controller";
import { decidePress } from "@/lib/signal-preview-hint";

const SIGNAL_LABELS: Readonly<Record<PreviewSignal, string>> = {
    exercise: "exercise",
    rest: "rest",
    standby: "Standby",
};

export interface SignalPreviewSlots {
    /** The icon button, for the end of the field row. */
    action: ReactNode;
    /** Live region and the sound error, for under the row. */
    feedback: ReactNode;
}

interface SignalPreviewControlProps {
    id: string;
    signal: PreviewSignal;
    availability: { enabled: boolean; note?: string };
    status: SignalPreviewStatus;
    activeSignal: PreviewSignal | null;
    onPlay: (signal: PreviewSignal) => void;
    children: (slots: SignalPreviewSlots) => ReactNode;
}

export default function SignalPreviewControl({ id, signal, availability, status, activeSignal, onPlay, children }: SignalPreviewControlProps) {
    const label = SIGNAL_LABELS[signal];
    const isActive = activeSignal === signal;
    const initializing = isActive && status === "initializing";
    const playing = isActive && status === "playing";
    const failed = isActive && status === "unavailable";
    const descriptionId = `${id}-description`;
    const { open: hintOpen, hint } = useSignalHint();
    const [radixOpen, setRadixOpen] = useState(false);
    const { text: announcement, announcer } = useSignalAnnouncer();
    const pointerType = useRef("");
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The reason belongs to the availability it explained; a changed Rest must not keep the old message.
    useEffect(() => {
        announcer.clear();
    }, [announcer, availability.enabled, availability.note]);

    function handleClick() {
        const decision = decidePress({ enabled: availability.enabled, pointerType: pointerType.current, note: availability.note });
        pointerType.current = "";
        if (decision.showHint) hint.showFor();
        if (decision.announce) announcer.announce(decision.announce);
        if (decision.play) onPlay(signal);
    }

    const statusText = initializing ? "Starting sound…" : playing ? `Playing ${label} signal` : announcement;
    const meaning = SIGNAL_MEANINGS[signal];

    const action = (
        <>
            <span id={descriptionId} className="sr-only">
                {meaning}
                {availability.note ? ` ${availability.note}` : ""}
            </span>
            {/* Open = Radix (hover, focus) or the touch hint. Radix also closes on the trigger's own click and on pointer leave; that must not end a touch hint, so only Esc and an outside press hide it. */}
            <Tooltip open={radixOpen || hintOpen} onOpenChange={setRadixOpen}>
                <TooltipTrigger asChild>
                    <Button
                        ref={triggerRef}
                        id={id}
                        type="button"
                        variant="outline"
                        size="icon"
                        className="aria-disabled:hover:bg-background dark:aria-disabled:hover:bg-input/30 size-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        aria-label={`Play ${label} signal`}
                        aria-disabled={!availability.enabled}
                        aria-busy={initializing}
                        aria-describedby={descriptionId}
                        onPointerDown={(event) => {
                            pointerType.current = event.pointerType;
                        }}
                        onClick={handleClick}
                    >
                        <Volume2 aria-hidden="true" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent
                    onEscapeKeyDown={() => {
                        hint.hide();
                    }}
                    onPointerDownOutside={(event) => {
                        if (event.target instanceof Node && triggerRef.current?.contains(event.target)) return;
                        hint.hide();
                    }}
                >
                    <p>{meaning}</p>
                    {availability.note && <p>{availability.note}</p>}
                </TooltipContent>
            </Tooltip>
        </>
    );

    const feedback = (
        <>
            {/* Screen readers only: the tooltip is the visible description. */}
            <p role="status" className="sr-only">
                {statusText}
            </p>
            {failed && (
                <Alert variant="destructive">
                    <AlertDescription>Sound is unavailable in this browser.</AlertDescription>
                </Alert>
            )}
        </>
    );

    return <>{children({ action, feedback })}</>;
}
