export interface DrillConfiguration {
    preparationSeconds: number;
    exerciseSeconds: number;
    restSeconds: number;
    repetitions: number;
}

export type DrillPhaseKind = "preparation" | "exercise" | "rest";

export type DrillPhase = { kind: "preparation"; durationSeconds: number } | { kind: "exercise" | "rest"; durationSeconds: number; repetition: number };
