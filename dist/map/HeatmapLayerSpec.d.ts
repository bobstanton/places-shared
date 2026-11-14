export declare const HEATMAP_OPACITY = 0.65;
export declare const HEATMAP_GAUSSIAN_COEFFICIENT: number;
export declare const HEATMAP_POINT_SOURCE_OPTIONS: {
    readonly cluster: true;
    readonly clusterRadius: 1;
    readonly clusterMaxZoom: 23;
    readonly maxzoom: 24;
};
export declare function createHeatmapSourceOptions(weighted?: boolean): {
    clusterProperties?: {
        densityWeight: (string | unknown[])[];
    } | undefined;
    cluster: true;
    clusterRadius: 1;
    clusterMaxZoom: 23;
    maxzoom: 24;
};
export declare function heatmapRadius(zoom: number): number;
export declare function heatmapIntensity(zoom: number): number;
export declare function heatmapWeight(weight: number): number;
export declare function heatmapAlpha(density: number): number;
export declare function createHeatmapLayerPaint(colorScheme?: string): Record<string, unknown>;
export declare function createClusterHeatmapPaint(colorScheme?: string): Record<string, unknown>;
export declare function buildHeatmapRamp(colorScheme?: string): Uint8ClampedArray;
export declare const CLUSTER_HEATMAP_HIT_TOLERANCE_PX = 20;
export declare const CLUSTER_HEATMAP_HIT_LIMIT = 8;
