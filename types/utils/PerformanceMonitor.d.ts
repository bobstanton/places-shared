type PerformanceDetails = Record<string, unknown>;
export interface PerformanceMonitor {
    mark(event: string, details?: PerformanceDetails): void;
    measure<T>(event: string, work: () => T, details?: PerformanceDetails, options?: {
        slowOnly?: boolean;
        thresholdMs?: number;
    }): T;
    measureAsync<T>(event: string, work: () => Promise<T>, details?: PerformanceDetails, options?: {
        slowOnly?: boolean;
        thresholdMs?: number;
    }): Promise<T>;
}
export declare function createPerformanceMonitor(name: string, baseDetails?: PerformanceDetails, options?: {
    enabled?: boolean;
}): PerformanceMonitor;
export {};
