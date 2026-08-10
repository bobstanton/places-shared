import type * as GeoJSON from 'geojson';
import type { Coordinate } from '../geo/DistanceCalculator';
export type PlaceNoteRequest = PoiPlaceNoteRequest | LocationPlaceNoteRequest | GeocodedPlaceNoteRequest | RouteOverlayPlaceNoteRequest;
export interface PoiPlaceNoteRequest {
    readonly kind: 'poi';
    readonly name: string;
    readonly class: string;
    readonly subclass?: string;
    readonly lat: number;
    readonly lng: number;
    readonly geometry?: GeoJSON.Geometry;
}
export interface LocationPlaceNoteRequest {
    readonly kind: 'location';
    readonly coordinate: Coordinate;
}
export interface RouteOverlayPlaceNoteRequest {
    readonly kind: 'route-overlay';
    readonly overlayKind: 'directions' | 'isochrone';
    readonly name: string;
    readonly geojson: GeoJSON.FeatureCollection;
    readonly sourcePath?: string;
    readonly location?: GeoJSON.Position;
}
export interface GeocodedPlaceNoteRequest {
    readonly kind: 'place';
    readonly name: string;
    readonly lat: number;
    readonly lng: number;
    readonly address?: string;
    readonly website?: string;
    readonly tags?: readonly string[];
}
export interface PlaceNoteHost {
    createNote(request: PlaceNoteRequest): Promise<void>;
    resolveIcon(request: PlaceNoteRequest): string;
}
