import type * as GeoJSON from 'geojson';
import type { MapPlace } from '../Place';
export type MapHitKind = 'marker' | 'waypoint' | 'track' | 'feature';
export interface MapHit {
    readonly kind: MapHitKind;
    readonly place: MapPlace;
    readonly id: string;
    readonly order: number;
    readonly label: string;
    readonly icon?: string;
    readonly kinds: readonly MapHitKind[];
    readonly feature?: GeoJSON.Feature;
    readonly sourcePath?: string;
    readonly layerId?: string;
}
export declare function createMapHit(kind: MapHitKind, place: MapPlace, order: number): MapHit;
export declare function createOverlayPointHit(feature: GeoJSON.Feature, order: number, sourcePath?: string): MapHit | undefined;
export declare function createFeatureHit(feature: GeoJSON.Feature, order: number, options: {
    layerId: string;
    label: string;
    coordinate: {
        latitude: number;
        longitude: number;
    };
}): MapHit;
export declare function orderMapHits(hits: readonly MapHit[]): MapHit[];
