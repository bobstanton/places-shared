import { Kilometers } from '../Units';
export type MetricWindow = {
    readonly kind: 'distance';
    readonly km: number;
} | {
    readonly kind: 'time';
    readonly ms: number;
};
export declare const DEFAULT_SPEED_WINDOW: MetricWindow;
export declare const DEFAULT_GRADE_WINDOW: MetricWindow;
export declare class MetricWindowError extends Error {
    constructor(rawValue: string);
}
export declare const KM_PER_UNIT: ReadonlyArray<readonly [RegExp, number]>;
export declare function parseMetricWindow(value: unknown, fallback: MetricWindow): MetricWindow;
export declare function isMetricWindowValue(value: string): boolean;
export declare function formatMetricWindow(window: MetricWindow): string;
export declare function metricWindowKm(window: MetricWindow): Kilometers | undefined;
export declare function timeWindowUnsupportedMessage(setting: string, window: MetricWindow): string;
