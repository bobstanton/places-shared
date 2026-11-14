export type ApiUsageService = string;
export declare const API_USAGE_SERVICES: {
    readonly geocoding: "geocoding";
    readonly elevation: "elevation";
    readonly routeOverlay: "routeOverlay";
    readonly snap: "snap";
    readonly trackMatch: "trackMatch";
    readonly tiles: "tiles";
};
export interface ApiUsageOrigin {
    sourcePath?: string;
    blockType?: string;
}
export interface ApiUsageEvent {
    provider: string;
    service: ApiUsageService;
    success: boolean;
    durationMs: number;
    origin?: ApiUsageOrigin;
    cached?: boolean;
}
export interface ApiUsageRecorder {
    record(event: ApiUsageEvent): void;
}
export declare function trackApiUsage<T>(recorder: ApiUsageRecorder | undefined, event: {
    provider: string;
    service: ApiUsageService;
    origin?: ApiUsageOrigin;
}, fn: () => Promise<T>): Promise<T>;
