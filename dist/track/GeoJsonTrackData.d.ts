import type * as GeoJSON from 'geojson';
import type { MapPlaceOverlay, OverlayTrackData } from '../Place';
export declare function resolveOverlayTrackData(overlay: MapPlaceOverlay): OverlayTrackData | undefined;
export declare function resolveOverlayTrackDataWork(overlay: MapPlaceOverlay): Generator<void, OverlayTrackData | undefined>;
export declare function extractTrackDataFromGeoJson(geojson: GeoJSON.FeatureCollection): OverlayTrackData | undefined;
export declare function extractTrackDataFromGeoJsonWork(geojson: GeoJSON.FeatureCollection): Generator<void, OverlayTrackData | undefined>;
