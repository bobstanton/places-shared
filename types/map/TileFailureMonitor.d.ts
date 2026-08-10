export interface TileFailureReport {
    host: string;
    status?: number;
    failureCount: number;
}
export interface TileFailureMonitorOptions {
    onChange: (report: TileFailureReport | undefined) => void;
    settleMs?: number;
    setTimer?: (callback: () => void, ms: number) => number;
    clearTimer?: (handle: number) => void;
}
export declare class TileFailureMonitor {
    private readonly options;
    private successes;
    private failures;
    private host;
    private status;
    private timer;
    private reported;
    private disposed;
    private readonly settleMs;
    private readonly setTimer;
    private readonly clearTimer;
    constructor(options: TileFailureMonitorOptions);
    recordSuccess(): void;
    recordFailure(url: string, error?: unknown): void;
    dispose(): void;
    private schedule;
    private settle;
}
export declare function describeTileFailure(report: TileFailureReport): string;
