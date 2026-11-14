import type * as GeoJSON from 'geojson';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import type { MapPlace } from "../overlay/index";
export interface ViewportBucketTrack {
    place: MapPlace;
    signature: string;
}
export type ViewportBucketUpdate = ({
    initial: GeoJSON.FeatureCollection;
    diff?: never;
} | {
    initial?: never;
    diff: GeoJSONSourceDiff;
}) & {
    snapshot?: GeoJSON.FeatureCollection;
};
export declare class ViewportTrackBucketData {
    private tracks;
    private initialized;
    private nextFeatureId;
    private readonly features;
    private readonly paintDefaults;
    constructor(snapshotUpdates?: boolean, paintDefaults?: Readonly<Record<string, unknown>>);
    update(next: ReadonlyMap<string, ViewportBucketTrack>, build: (place: MapPlace) => GeoJSON.Feature[]): ViewportBucketUpdate | null;
}
