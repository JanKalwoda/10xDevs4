import type { DrillConfigInput } from "./lib/drill-timer";

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

export interface SavedDrill {
    id: string;
    name: string;
    configuration: DrillConfiguration;
    createdAt: string;
    updatedAt: string;
}

export type SaveDrillRequest = DrillConfigInput & { name: string };

export type SaveDrillErrorCode =
    "validation" | "duplicate_name" | "limit_reached" | "not_found" | "unauthorized" | "unsupported_media_type" | "payload_too_large" | "unavailable" | "unexpected";

export type SaveDrillFieldErrors = Partial<Record<keyof SaveDrillRequest, string>>;

export type SaveDrillResponse = { ok: true; drill: SavedDrill } | { ok: false; code: SaveDrillErrorCode; message: string; fieldErrors?: SaveDrillFieldErrors };
