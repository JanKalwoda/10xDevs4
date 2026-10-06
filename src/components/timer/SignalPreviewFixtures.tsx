import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrillConfigForm from "@/components/timer/DrillConfigForm";
import { CUE_DURATION, type DrillAudioPort, type DrillCue, type ScheduledCue } from "@/lib/drill-audio";
import type { DrillConfigInput } from "@/lib/drill-timer";

/** How the injected `createAudio` behaves for a fixture. */
type AudioMode = "ok" | "playing-held" | "loading-held" | "unavailable";

const HELD_PLAYBACK_SECONDS = 3600;

interface Evidence {
    created: number;
    closes: number;
    cancels: number;
    cues: DrillCue[];
    startCalls: number;
}

const EMPTY_EVIDENCE: Evidence = { created: 0, closes: 0, cancels: 0, cues: [], startCalls: 0 };

class PreviewFixtureAudio implements DrillAudioPort {
    available = true;
    private unavailableHandler: (() => void) | undefined;

    constructor(
        private readonly holdPlayback: boolean,
        private readonly record: (change: (current: Evidence) => Evidence) => void,
    ) {}

    schedule(cue: DrillCue, at: number): ScheduledCue {
        const end = at + (this.holdPlayback ? HELD_PLAYBACK_SECONDS : CUE_DURATION[cue]);
        this.record((current) => ({ ...current, cues: [...current.cues, cue] }));
        return { start: at, end };
    }

    cancel() {
        this.record((current) => ({ ...current, cancels: current.cancels + 1 }));
    }

    close() {
        this.available = false;
        this.record((current) => ({ ...current, closes: current.closes + 1 }));
    }

    onUnavailable(handler: () => void) {
        this.unavailableHandler = handler;
    }
}

interface PreviewFixtureProps {
    title: string;
    description: string;
    fixture: string;
    visualState: string;
    mode: AudioMode;
    initial: DrillConfigInput;
}

function PreviewFixture({ title, description, fixture, visualState, mode, initial }: PreviewFixtureProps) {
    const [values, setValues] = useState<DrillConfigInput>(initial);
    const [evidence, setEvidence] = useState<Evidence>(EMPTY_EVIDENCE);
    const [runKey, setRunKey] = useState(0);
    const heldResolve = useRef<((audio: DrillAudioPort | null) => void) | null>(null);

    function record(change: (current: Evidence) => Evidence) {
        setEvidence(change);
    }

    function createAudio(): Promise<DrillAudioPort | null> {
        record((current) => ({ ...current, created: current.created + 1 }));
        if (mode === "unavailable") return Promise.resolve(null);
        const audio = new PreviewFixtureAudio(mode === "playing-held", record);
        if (mode === "loading-held") {
            return new Promise((resolve) => {
                heldResolve.current = resolve;
            });
        }
        return Promise.resolve(audio);
    }

    function reset() {
        heldResolve.current = null;
        setEvidence(EMPTY_EVIDENCE);
        setRunKey((current) => current + 1);
    }

    return (
        <Card data-fixture={fixture} data-testid={`signal-preview-${fixture}`} data-visual-state={visualState}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <DrillConfigForm
                    key={runKey}
                    values={values}
                    onValuesChange={setValues}
                    createAudio={createAudio}
                    onStart={() => {
                        setEvidence((current) => ({ ...current, startCalls: current.startCalls + 1 }));
                    }}
                />
                <dl className="text-muted-foreground grid grid-cols-2 gap-1 text-sm" data-testid={`signal-preview-${fixture}-evidence`}>
                    <dt>Start calls</dt>
                    <dd data-evidence="start-calls">{evidence.startCalls}</dd>
                    <dt>Audio created</dt>
                    <dd data-evidence="created">{evidence.created}</dd>
                    <dt>Audio closed</dt>
                    <dd data-evidence="closes">{evidence.closes}</dd>
                    <dt>Cues scheduled</dt>
                    <dd data-evidence="cues">{evidence.cues.join(", ") || "none"}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                    {mode === "loading-held" && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                heldResolve.current?.(new PreviewFixtureAudio(false, record));
                                heldResolve.current = null;
                            }}
                        >
                            Grant held audio
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={reset}>
                        Reset fixture
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

const DEFAULT_VALUES: DrillConfigInput = { preparation: "0:05", exercise: "0:04", rest: "0:02", repetitions: "3", randomStartEnabled: false };

export default function SignalPreviewFixtures() {
    return (
        <section aria-label="Signal preview examples" className="space-y-4">
            <h2 className="text-xl font-semibold">Signal preview</h2>
            <p className="text-muted-foreground text-sm">Production configuration form with injected audio; no sound is produced. Click a Play button to drive each state.</p>
            <div className="grid gap-6 lg:grid-cols-3">
                <PreviewFixture
                    title="Default (Random start off)"
                    description="Idle controls; Standby shows the off note."
                    fixture="signal-default"
                    visualState="default"
                    mode="ok"
                    initial={DEFAULT_VALUES}
                />
                <PreviewFixture
                    title="Random start on"
                    description="Standby note is absent; click plays two Standby cues."
                    fixture="signal-random-on"
                    visualState="default"
                    mode="ok"
                    initial={{ ...DEFAULT_VALUES, randomStartEnabled: true }}
                />
                <PreviewFixture
                    title="Disabled (Rest 0:00)"
                    description="Rest preview is disabled with a visible reason."
                    fixture="signal-disabled-zero"
                    visualState="disabled"
                    mode="ok"
                    initial={{ ...DEFAULT_VALUES, rest: "0:00" }}
                />
                <PreviewFixture
                    title="Disabled (Rest invalid)"
                    description="Rest preview is disabled until Rest is valid."
                    fixture="signal-disabled-invalid"
                    visualState="disabled"
                    mode="ok"
                    initial={{ ...DEFAULT_VALUES, rest: "abc" }}
                />
                <PreviewFixture
                    title="Error (sound unavailable)"
                    description="createAudio resolves null; every click retries."
                    fixture="signal-error"
                    visualState="error"
                    mode="unavailable"
                    initial={DEFAULT_VALUES}
                />
                <PreviewFixture
                    title="Loading (initializing)"
                    description="Audio initialization is held until granted manually."
                    fixture="signal-loading"
                    visualState="loading"
                    mode="loading-held"
                    initial={DEFAULT_VALUES}
                />
                <PreviewFixture
                    title="Playing"
                    description="Playback end is held far in the future; reset to stop."
                    fixture="signal-playing"
                    visualState="default"
                    mode="playing-held"
                    initial={{ ...DEFAULT_VALUES, randomStartEnabled: true }}
                />
            </div>
        </section>
    );
}
