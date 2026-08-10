import type * as GeoJSON from 'geojson';
import type { RouteOverlayPlaceNoteRequest } from '../map/PlaceNoteRequest';
export declare function prepareDirectionsOverlayNote(routeFeature: GeoJSON.Feature, sourcePath?: string): Promise<RouteOverlayPlaceNoteRequest>;
export declare function prepareIsochroneOverlayNote(geojson: GeoJSON.FeatureCollection, sourcePath?: string): RouteOverlayPlaceNoteRequest;
export declare function cloneFeatureCollection(geojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection;
