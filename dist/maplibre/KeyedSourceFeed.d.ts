import type * as GeoJSON from 'geojson';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
export type KeyedSourceSubmission = {
    kind: 'full';
    data: GeoJSON.FeatureCollection;
} | {
    kind: 'diff';
    diff: GeoJSONSourceDiff;
} | {
    kind: 'unchanged';
};
type FeatureId = string | number;
export declare class KeyedSourceFeed {
    private readonly orderMatters;
    private submitted;
    constructor(orderMatters: boolean);
    recordWhole(features: readonly GeoJSON.Feature[]): void;
    forget(id: FeatureId): void;
    submit(features: GeoJSON.Feature[], canDiff: boolean): KeyedSourceSubmission;
}
export {};
