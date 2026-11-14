import type * as GeoJSON from 'geojson';
export type RouteOverlayFeatureMatch = {
    readonly kind: 'directions';
    readonly feature: GeoJSON.Feature;
} | {
    readonly kind: 'isochrone';
    readonly collection: GeoJSON.FeatureCollection;
};
export declare function isDirectionsRouteLineFeature(feature: GeoJSON.Feature): boolean;
export declare function isIsochroneFeature(feature: GeoJSON.Feature): boolean;
export declare function cloneRouteFeature(feature: GeoJSON.Feature): GeoJSON.Feature;
export declare function classifyRouteOverlayFeature(feature: GeoJSON.Feature, overlayGeoJson?: GeoJSON.GeoJSON): RouteOverlayFeatureMatch | null;
