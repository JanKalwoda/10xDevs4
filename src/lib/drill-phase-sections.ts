import { firstDrillPhase, nextDrillPhase } from "./drill-timer.ts";
import type { DrillDisplay } from "./drill-run.ts";
import type { DrillConfiguration, DrillPhase } from "../types.ts";

export type MainSection = { kind: "time"; text: string } | { kind: "standby" };

export interface CurrentSection {
    name: string;
    /** Fixed full configured time; null for Standby, where the phase name already says "Standby". */
    time: string | null;
}

export type NextSection = { kind: "phase"; name: string; time: string | null } | { kind: "end" };

export interface PhaseSections {
    main: MainSection;
    /** "Repetition X of N"; in Preparation X is the upcoming repetition taken from `next`. Phase values only. */
    repetition: string | null;
    current: CurrentSection;
    next: NextSection;
}

export function formatPhaseTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function phaseName(phase: DrillPhase): string {
    return phase.kind.charAt(0).toUpperCase() + phase.kind.slice(1);
}

function phaseTime(phase: DrillPhase): string | null {
    return phase.kind === "standby" ? null : formatPhaseTime(phase.durationSeconds);
}

export function initialDrillDisplay(configuration: DrillConfiguration): DrillDisplay {
    const phase = firstDrillPhase(configuration);
    return {
        phase,
        remainingSeconds: phase.kind === "standby" ? null : phase.durationSeconds,
        next: nextDrillPhase(configuration, phase),
        paused: false,
        audioAvailable: true,
    };
}

/** Everything is derived from phase values only, so nothing here can reveal the random Standby wait. */
export function buildPhaseSections(display: DrillDisplay, repetitions: number): PhaseSections | null {
    const phase = display.phase;
    if (!phase) return null;
    const next = display.next;
    const repetition = phase.kind === "preparation" ? (next && "repetition" in next ? next.repetition : null) : "repetition" in phase ? phase.repetition : null;
    return {
        main: phase.kind === "standby" ? { kind: "standby" } : { kind: "time", text: formatPhaseTime(display.remainingSeconds ?? 0) },
        repetition: repetition === null ? null : `Repetition ${repetition} of ${repetitions}`,
        current: { name: phaseName(phase), time: phaseTime(phase) },
        next: next ? { kind: "phase", name: phaseName(next), time: phaseTime(next) } : { kind: "end" },
    };
}

/** Body of the Next section; the "Next" label is rendered separately. */
export function nextPhaseBody(next: NextSection): string {
    if (next.kind === "end") return "Drill complete";
    return next.time ? `${next.name} · ${next.time}` : next.name;
}
