type PerformanceDetails = Record<string, unknown>;
export interface PerformanceMeasureOptions {
    slowOnly?: boolean;
    thresholdMs?: number;
    warnOnSlow?: boolean;
}
export interface PerformanceMonitor {
    mark(event: string, details?: PerformanceDetails): void;
    measure<T>(event: string, work: () => T, details?: PerformanceDetails, options?: PerformanceMeasureOptions): T;
    measureAsync<T>(event: string, work: () => Promise<T>, details?: PerformanceDetails, options?: PerformanceMeasureOptions): Promise<T>;
}
export declare function createPerformanceMonitor(name: string, baseDetails?: PerformanceDetails, options?: {
    enabled?: boolean;
}): PerformanceMonitor;
export declare function heapUsedMB(): number | undefined;
export interface HeapUsage {
    usedMB: number;
    limitMB: number;
    ratio: number;
}
export declare function heapUsage(): HeapUsage | undefined;
export declare function reportHeapPressure(report: (usage: HeapUsage) => void): void;
export {};
