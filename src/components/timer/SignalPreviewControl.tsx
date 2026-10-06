import { Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SIGNAL_MEANINGS, type PreviewSignal } from "@/lib/drill-signal-preview";
import type { SignalPreviewStatus } from "@/lib/drill-signal-preview-controller";

const SIGNAL_LABELS: Readonly<Record<PreviewSignal, string>> = {
    exercise: "exercise",
    rest: "rest",
    standby: "Standby",
};

interface SignalPreviewControlProps {
    id: string;
    signal: PreviewSignal;
    availability: { enabled: boolean; note?: string };
    status: SignalPreviewStatus;
    activeSignal: PreviewSignal | null;
    onPlay: (signal: PreviewSignal) => void;
}

export default function SignalPreviewControl({ id, signal, availability, status, activeSignal, onPlay }: SignalPreviewControlProps) {
    const label = SIGNAL_LABELS[signal];
    const isActive = activeSignal === signal;
    const initializing = isActive && status === "initializing";
    const playing = isActive && status === "playing";
    const failed = isActive && status === "unavailable";
    const meaningId = `${id}-meaning`;
    const noteId = `${id}-note`;
    const describedBy = `${meaningId}${availability.note ? ` ${noteId}` : ""}`;

    return (
        <div className="space-y-2 pt-1">
            <Button
                id={id}
                type="button"
                variant="outline"
                size="sm"
                disabled={!availability.enabled}
                aria-busy={initializing}
                aria-describedby={describedBy}
                onClick={() => {
                    onPlay(signal);
                }}
            >
                <Play aria-hidden="true" />
                Play {label} signal
            </Button>
            <p id={meaningId} className="text-muted-foreground text-sm">
                {SIGNAL_MEANINGS[signal]}
            </p>
            {availability.note && (
                <p id={noteId} className="text-muted-foreground text-sm">
                    {availability.note}
                </p>
            )}
            <p role="status" className="text-sm">
                {playing ? `Playing ${label} signal` : ""}
            </p>
            {failed && (
                <Alert variant="destructive">
                    <AlertDescription>Sound is unavailable in this browser.</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
