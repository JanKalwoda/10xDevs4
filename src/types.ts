export interface DrillConfiguration {
    preparationSeconds: number;
    exerciseSeconds: number;
    restSeconds: number;
    repetitions: number;
    randomStartEnabled: boolean;
}

export type DrillPhaseKind = "preparation" | "standby" | "exercise" | "rest";

export type DrillPhase =
    { kind: "preparation"; durationSeconds: number } | { kind: "standby"; repetition: number } | { kind: "exercise" | "rest"; durationSeconds: number; repetition: number };
